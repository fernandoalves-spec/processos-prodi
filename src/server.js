const crypto = require('crypto');
const express = require('express');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const { MASTER_EMAIL, PERFIS, initDatabase } = require('./bootstrap-db');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE_NAME = 'prodi_sid';
const SESSION_HOURS = 8;

const PERFIL_NOME_POR_ID = PERFIS.reduce((acc, item) => {
  acc[item.id] = item.nome;
  return acc;
}, {});

const oauthEstados = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').reduce((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function definirCookieSessao(res, sessionId) {
  const partes = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * SESSION_HOURS}`
  ];

  if (process.env.NODE_ENV === 'production') {
    partes.push('Secure');
  }

  res.setHeader('Set-Cookie', partes.join('; '));
}

function limparCookieSessao(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function respostaUsuario(usuario) {
  return {
    id: Number(usuario.id),
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    perfilNome: usuario.perfil_nome || PERFIL_NOME_POR_ID[usuario.perfil] || usuario.perfil,
    ativo: Boolean(usuario.ativo),
    origem: usuario.origem,
    criadoEm: usuario.criado_em,
    ultimoLoginEm: usuario.ultimo_login_em
  };
}

function respostaProcesso(processo) {
  return {
    id: Number(processo.id),
    status: processo.status,
    precisaResposta: processo.precisa_resposta,
    dataRecebimento: processo.data_recebimento,
    protocolo: processo.protocolo,
    link: processo.link,
    origem: processo.origem,
    destino: processo.destino,
    prazoDiasUteis: processo.prazo_dias_uteis ?? processo.prazo_em_dias_uteis,
    assunto: processo.assunto,
    observacao: processo.observacao,
    criadoPor: processo.criado_por,
    atualizadoPor: processo.atualizado_por,
    criadoEm: processo.criado_em,
    atualizadoEm: processo.atualizado_em
  };
}

async function obterUsuarioPorSessao(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const consulta = await pool.query(
    `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.perfil,
        p.nome AS perfil_nome,
        u.ativo,
        u.origem,
        u.criado_em,
        u.ultimo_login_em
      FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN perfis p ON p.id = u.perfil
      WHERE s.session_id = $1
        AND s.expira_em > NOW()
    `,
    [sessionId]
  );

  if (!consulta.rowCount) {
    await pool.query('DELETE FROM sessoes WHERE session_id = $1 OR expira_em <= NOW()', [sessionId]);
    return null;
  }

  const usuario = consulta.rows[0];

  if (!usuario.ativo) {
    await pool.query('DELETE FROM sessoes WHERE session_id = $1', [sessionId]);
    return null;
  }

  return usuario;
}

async function criarSessao(usuarioId) {
  const sessionId = crypto.randomBytes(24).toString('hex');

  await pool.query(
    `
      INSERT INTO sessoes (session_id, usuario_id, expira_em)
      VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)
    `,
    [sessionId, usuarioId, SESSION_HOURS]
  );

  return sessionId;
}

async function exigirAutenticacao(req, res, next) {
  try {
    const usuario = await obterUsuarioPorSessao(req);

    if (!usuario) {
      return res.status(401).json({
        erro: 'Autenticacao obrigatoria. Entre com sua conta Google do IFMS.'
      });
    }

    req.usuario = usuario;
    return next();
  } catch (error) {
    console.error('Erro ao validar autenticacao:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao validar autenticacao.' });
  }
}

function exigirMaster(req, res, next) {
  if (req.usuario.perfil !== 'ADMIN_MASTER') {
    return res.status(403).json({
      erro: 'Apenas o Administrador Master pode gerenciar usuarios.'
    });
  }

  return next();
}

async function garantirUsuarioMaster() {
  await pool.query(
    `
      INSERT INTO usuarios (nome, email, perfil, ativo, origem)
      VALUES ($1, $2, 'ADMIN_MASTER', TRUE, 'sistema')
      ON CONFLICT (email) DO UPDATE
        SET nome = EXCLUDED.nome,
            perfil = 'ADMIN_MASTER',
            ativo = TRUE,
            atualizado_em = NOW()
    `,
    ['Fernando Alves', MASTER_EMAIL]
  );
}

async function criarOuAtualizarUsuarioGoogle(userInfo) {
  const email = normalizarEmail(userInfo.email);
  const nome = userInfo.name || email;

  const existente = await pool.query(
    `
      SELECT id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
      FROM usuarios
      WHERE email = $1
    `,
    [email]
  );

  if (!existente.rowCount) {
    const perfilPadrao = email === MASTER_EMAIL ? 'ADMIN_MASTER' : 'ANALISTA_PROCESSOS';
    const inserido = await pool.query(
      `
        INSERT INTO usuarios (nome, email, perfil, ativo, origem, ultimo_login_em)
        VALUES ($1, $2, $3, TRUE, 'google', NOW())
        RETURNING id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
      `,
      [nome, email, perfilPadrao]
    );

    return inserido.rows[0];
  }

  let usuario = existente.rows[0];

  if (email === MASTER_EMAIL) {
    const masterAtualizado = await pool.query(
      `
        UPDATE usuarios
        SET nome = $1,
            perfil = 'ADMIN_MASTER',
            ativo = TRUE,
            ultimo_login_em = NOW(),
            atualizado_em = NOW()
        WHERE id = $2
        RETURNING id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
      `,
      [nome, usuario.id]
    );

    return masterAtualizado.rows[0];
  }

  if (!usuario.ativo) {
    return usuario;
  }

  const atualizado = await pool.query(
    `
      UPDATE usuarios
      SET nome = $1,
          ultimo_login_em = NOW(),
          atualizado_em = NOW()
      WHERE id = $2
      RETURNING id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
    `,
    [nome, usuario.id]
  );

  return atualizado.rows[0];
}

function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function trocarCodigoPorToken(code) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  const resposta = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha ao trocar codigo por token: ${detalhe}`);
  }

  return resposta.json();
}

async function obterUserInfo(accessToken) {
  const resposta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha ao obter dados de usuario Google: ${detalhe}`);
  }

  return resposta.json();
}

app.get('/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({
      erro: 'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no ambiente.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthEstados.set(state, Date.now());
  return res.redirect(buildGoogleAuthUrl(state));
});

app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;

  const estadoCriadoEm = oauthEstados.get(state);
  oauthEstados.delete(state);

  if (!code || !state || !estadoCriadoEm) {
    return res.status(400).send('Resposta de autenticacao invalida. Tente novamente.');
  }

  if ((Date.now() - estadoCriadoEm) > 10 * 60 * 1000) {
    return res.status(400).send('Sessao de autenticacao expirada. Tente novamente.');
  }

  try {
    const token = await trocarCodigoPorToken(code);
    const userInfo = await obterUserInfo(token.access_token);
    const email = normalizarEmail(userInfo.email);

    if (!userInfo.email_verified) {
      return res.status(403).send('A conta Google precisa ter e-mail verificado.');
    }

    if (!email.endsWith('@ifms.edu.br')) {
      return res.status(403).send('Acesso permitido apenas para contas IFMS.');
    }

    const usuario = await criarOuAtualizarUsuarioGoogle(userInfo);

    if (!usuario.ativo) {
      return res.status(403).send('Usuario inativo no sistema. Procure o Administrador Master.');
    }

    const sessionId = await criarSessao(usuario.id);
    definirCookieSessao(res, sessionId);

    return res.redirect('/usuarios');
  } catch (error) {
    console.error('Erro no callback Google:', error.message);
    return res.status(500).send('Nao foi possivel concluir a autenticacao Google.');
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const usuario = await obterUsuarioPorSessao(req);

    if (!usuario) {
      return res.json({ autenticado: false, usuario: null });
    }

    return res.json({ autenticado: true, usuario: respostaUsuario(usuario) });
  } catch (error) {
    console.error('Erro no endpoint /api/auth/me:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao consultar sessao.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (sessionId) {
      await pool.query('DELETE FROM sessoes WHERE session_id = $1', [sessionId]);
    }

    limparCookieSessao(res);
    return res.json({ mensagem: 'Sessao encerrada com sucesso.' });
  } catch (error) {
    console.error('Erro no logout:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao encerrar sessao.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'processos-prodi'
  });
});

app.get('/api/perfis', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, nome, descricao FROM perfis ORDER BY nome');
    res.json(resultado.rows);
  } catch (error) {
    console.error('Erro ao listar perfis:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar perfis.' });
  }
});

app.get('/api/usuarios', exigirAutenticacao, exigirMaster, async (req, res) => {
  try {
    const lista = await pool.query(
      `
        SELECT
          u.id,
          u.nome,
          u.email,
          u.perfil,
          p.nome AS perfil_nome,
          u.ativo,
          u.origem,
          u.criado_em,
          u.ultimo_login_em
        FROM usuarios u
        LEFT JOIN perfis p ON p.id = u.perfil
        ORDER BY u.nome
      `
    );

    res.json(lista.rows.map(respostaUsuario));
  } catch (error) {
    console.error('Erro ao listar usuarios:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar usuarios.' });
  }
});

app.post('/api/usuarios', exigirAutenticacao, exigirMaster, async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = normalizarEmail(req.body.email);
  const perfil = String(req.body.perfil || '').trim();

  if (!nome || !email || !perfil) {
    return res.status(400).json({ erro: 'Informe nome, email e perfil para cadastrar o usuario.' });
  }

  if (!email.endsWith('@ifms.edu.br')) {
    return res.status(400).json({ erro: 'Somente e-mails institucionais @ifms.edu.br sao permitidos.' });
  }

  try {
    const perfilExiste = await pool.query('SELECT 1 FROM perfis WHERE id = $1', [perfil]);
    if (!perfilExiste.rowCount) {
      return res.status(400).json({ erro: 'Perfil de usuario invalido.' });
    }

    const perfilFinal = email === MASTER_EMAIL ? 'ADMIN_MASTER' : perfil;

    const novoUsuario = await pool.query(
      `
        INSERT INTO usuarios (nome, email, perfil, ativo, origem)
        VALUES ($1, $2, $3, TRUE, 'manual')
        RETURNING id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
      `,
      [nome, email, perfilFinal]
    );

    await garantirUsuarioMaster();

    res.status(201).json({
      mensagem: 'Usuario cadastrado com sucesso.',
      usuario: respostaUsuario(novoUsuario.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe usuario cadastrado com este e-mail.' });
    }

    console.error('Erro ao cadastrar usuario:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar usuario.' });
  }
});

app.put('/api/usuarios/:id', exigirAutenticacao, exigirMaster, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de usuario invalido.' });
  }

  try {
    const consultaUsuario = await pool.query(
      'SELECT id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em FROM usuarios WHERE id = $1',
      [id]
    );

    if (!consultaUsuario.rowCount) {
      return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    }

    const usuario = consultaUsuario.rows[0];
    const nome = req.body.nome !== undefined ? String(req.body.nome).trim() : usuario.nome;
    const perfil = req.body.perfil !== undefined ? String(req.body.perfil).trim() : usuario.perfil;
    const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : Boolean(usuario.ativo);

    if (!nome) {
      return res.status(400).json({ erro: 'O nome do usuario nao pode ficar vazio.' });
    }

    const isMaster = usuario.email === MASTER_EMAIL;

    if (!isMaster) {
      const perfilExiste = await pool.query('SELECT 1 FROM perfis WHERE id = $1', [perfil]);
      if (!perfilExiste.rowCount) {
        return res.status(400).json({ erro: 'Perfil de usuario invalido.' });
      }
    }

    const atualizado = await pool.query(
      `
        UPDATE usuarios
        SET
          nome = $1,
          perfil = $2,
          ativo = $3,
          atualizado_em = NOW()
        WHERE id = $4
        RETURNING id, nome, email, perfil, ativo, origem, criado_em, ultimo_login_em
      `,
      [nome, isMaster ? 'ADMIN_MASTER' : perfil, isMaster ? true : ativo, id]
    );

    await garantirUsuarioMaster();

    res.json({
      mensagem: 'Usuario atualizado com sucesso.',
      usuario: respostaUsuario(atualizado.rows[0])
    });
  } catch (error) {
    console.error('Erro ao atualizar usuario:', error.message);
    res.status(500).json({ erro: 'Erro interno ao atualizar usuario.' });
  }
});

app.get('/api/processos', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT
          id,
          status,
          precisa_resposta,
          data_recebimento,
          protocolo,
          link,
          origem,
          destino,
          prazo_dias_uteis,
          prazo_em_dias_uteis,
          assunto,
          observacao,
          criado_por,
          atualizado_por,
          criado_em,
          atualizado_em
        FROM processos
        ORDER BY criado_em DESC, id DESC
      `
    );

    res.json(resultado.rows.map(respostaProcesso));
  } catch (error) {
    console.error('Erro ao listar processos:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar processos.' });
  }
});

app.post('/api/processos', exigirAutenticacao, async (req, res) => {
  const {
    status,
    precisaResposta,
    dataRecebimento,
    protocolo,
    link,
    origem,
    destino,
    prazoDiasUteis,
    assunto,
    observacao
  } = req.body;

  if (!protocolo || !assunto) {
    return res.status(400).json({ erro: 'Os campos protocolo e assunto sao obrigatorios.' });
  }

  const prazoNumerico = prazoDiasUteis === '' || prazoDiasUteis === null || prazoDiasUteis === undefined
    ? null
    : Number(prazoDiasUteis);

  if (prazoNumerico !== null && !Number.isFinite(prazoNumerico)) {
    return res.status(400).json({ erro: 'Prazo em dias uteis invalido.' });
  }

  try {
    const inserido = await pool.query(
      `
        INSERT INTO processos (
          status,
          precisa_resposta,
          data_recebimento,
          protocolo,
          link,
          origem,
          destino,
          prazo_dias_uteis,
          assunto,
          observacao,
          criado_por
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )
        RETURNING
          id,
          status,
          precisa_resposta,
          data_recebimento,
          protocolo,
          link,
          origem,
          destino,
          prazo_dias_uteis,
          prazo_em_dias_uteis,
          assunto,
          observacao,
          criado_por,
          atualizado_por,
          criado_em,
          atualizado_em
      `,
      [
        status || 'Recebido',
        precisaResposta || 'Nao',
        dataRecebimento || null,
        protocolo,
        link || null,
        origem || null,
        destino || null,
        prazoNumerico,
        assunto,
        observacao || null,
        req.usuario.email
      ]
    );

    res.status(201).json({
      mensagem: 'Processo cadastrado com sucesso.',
      processo: respostaProcesso(inserido.rows[0])
    });
  } catch (error) {
    console.error('Erro ao cadastrar processo:', error.message);
    res.status(500).json({ erro: 'Erro interno ao cadastrar processo.' });
  }
});

app.put('/api/processos/:id', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de processo invalido.' });
  }

  const {
    status,
    precisaResposta,
    dataRecebimento,
    protocolo,
    link,
    origem,
    destino,
    prazoDiasUteis,
    assunto,
    observacao
  } = req.body;

  if (!protocolo || !assunto) {
    return res.status(400).json({ erro: 'Os campos protocolo e assunto sao obrigatorios.' });
  }

  const prazoNumerico = prazoDiasUteis === '' || prazoDiasUteis === null || prazoDiasUteis === undefined
    ? null
    : Number(prazoDiasUteis);

  if (prazoNumerico !== null && !Number.isFinite(prazoNumerico)) {
    return res.status(400).json({ erro: 'Prazo em dias uteis invalido.' });
  }

  try {
    const atualizado = await pool.query(
      `
        UPDATE processos
        SET
          status = $1,
          precisa_resposta = $2,
          data_recebimento = $3,
          protocolo = $4,
          link = $5,
          origem = $6,
          destino = $7,
          prazo_dias_uteis = $8,
          assunto = $9,
          observacao = $10,
          atualizado_por = $11,
          atualizado_em = NOW()
        WHERE id = $12
        RETURNING
          id,
          status,
          precisa_resposta,
          data_recebimento,
          protocolo,
          link,
          origem,
          destino,
          prazo_dias_uteis,
          prazo_em_dias_uteis,
          assunto,
          observacao,
          criado_por,
          atualizado_por,
          criado_em,
          atualizado_em
      `,
      [
        status || 'Recebido',
        precisaResposta || 'Nao',
        dataRecebimento || null,
        protocolo,
        link || null,
        origem || null,
        destino || null,
        prazoNumerico,
        assunto,
        observacao || null,
        req.usuario.email,
        id
      ]
    );

    if (!atualizado.rowCount) {
      return res.status(404).json({ erro: 'Processo nao encontrado.' });
    }

    res.json({
      mensagem: 'Processo atualizado com sucesso.',
      processo: respostaProcesso(atualizado.rows[0])
    });
  } catch (error) {
    console.error('Erro ao atualizar processo:', error.message);
    res.status(500).json({ erro: 'Erro interno ao atualizar processo.' });
  }
});

app.get('/usuarios', exigirAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'usuarios.html'));
});

(async () => {
  try {
    await initDatabase();
    await garantirUsuarioMaster();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error.message);
    process.exit(1);
  }
})();