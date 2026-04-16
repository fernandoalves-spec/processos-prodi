const crypto = require('crypto');
const express = require('express');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const { MASTER_EMAIL, PERFIS, initDatabase } = require('./bootstrap-db');
const { obterMetricasOperacionais } = require('./services/processos-metricas.service');
const { obterDashboardHome, obterDashboardHomeOptions } = require('./services/dashboard-home.service');
const {
  listarPendenciasCriticas,
  criarPendenciaCritica,
  atualizarPendenciaCritica,
  removerPendenciaCritica,
  listarTarefasPrioritarias,
  criarTarefaPrioritaria,
  atualizarTarefaPrioritaria,
  removerTarefaPrioritaria
} = require('./services/dashboard-management.service');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_COOKIE_NAME = 'prodi_sid';
const SESSION_HOURS = 8;
const CLIENT_DIST_DIR = path.join(__dirname, '..', 'dist', 'client');

const PERFIL_NOME_POR_ID = PERFIS.reduce((acc, item) => {
  acc[item.id] = item.nome;
  return acc;
}, {});

const oauthEstados = new Map();
const GUT_GRAVIDADE_PONTOS = {
  'Nao e Grave': 1,
  'Pouco Grave': 2,
  Grave: 3,
  'Muito Grave': 4,
  Gravissimo: 5
};
const GUT_URGENCIA_PONTOS = {
  'Nao tem pressa': 1,
  'Pode esperar um pouco': 2,
  'Resolver o mais cedo possivel': 3,
  'Resolver com alguma urgencia': 4,
  'Necessita de acao imediata': 5
};
const GUT_TENDENCIA_PONTOS = {
  'Nao vai piorar': 1,
  'Vai piorar em longo prazo': 2,
  'Vai piorar em medio prazo': 3,
  'Vai piorar em pouco tempo': 4,
  'Vai piorar rapidamente': 5
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(CLIENT_DIST_DIR, { index: false }));

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
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
    gutGravidade: processo.gut_gravidade,
    gutGravidadePontos: processo.gut_gravidade_pontos,
    gutUrgencia: processo.gut_urgencia,
    gutUrgenciaPontos: processo.gut_urgencia_pontos,
    gutTendencia: processo.gut_tendencia,
    gutTendenciaPontos: processo.gut_tendencia_pontos,
    gutPrioridadeFinal: processo.gut_prioridade_final,
    setorDestinoId: processo.setor_destino_id ? Number(processo.setor_destino_id) : null,
    setorDestinoNome: processo.setor_destino_nome || null,
    setorDestinoSigla: processo.setor_destino_sigla || null,
    distribuidoEm: processo.distribuido_em || null,
    distribuidoPor: processo.distribuido_por || null,
    filaInternaPendente: Boolean(processo.setor_destino_id) && processo.status !== 'Finalizado',
    criadoPor: processo.criado_por,
    atualizadoPor: processo.atualizado_por,
    criadoEm: processo.criado_em,
    atualizadoEm: processo.atualizado_em
  };
}

function respostaSetor(setor) {
  return {
    id: Number(setor.id),
    nome: setor.nome,
    sigla: setor.sigla,
    ativo: Boolean(setor.ativo),
    criadoEm: setor.criado_em,
    atualizadoEm: setor.atualizado_em
  };
}

function validarDataISO(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto;
}

function normalizarInteiro(valor, padrao, minimo, maximo) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return null;
  if (numero < minimo || numero > maximo) return null;
  return numero;
}

function validarOpcaoGut(valor, mapaPontuacao, rotuloCampo) {
  const texto = normalizarTexto(valor);
  if (!texto) return { opcao: null, pontos: null };

  if (!Object.prototype.hasOwnProperty.call(mapaPontuacao, texto)) {
    return {
      erro: `${rotuloCampo} invalida. Valores permitidos: ${Object.keys(mapaPontuacao).join(', ')}.`
    };
  }

  return { opcao: texto, pontos: mapaPontuacao[texto] };
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

function exigirGestaoProcessos(req, res, next) {
  const perfisPermitidos = new Set(['ADMIN_MASTER', 'GESTOR_PRODI']);
  if (!perfisPermitidos.has(req.usuario.perfil)) {
    return res.status(403).json({
      erro: 'Apenas Administrador Master e Gestor PRODI podem distribuir processos internamente.'
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

    return res.redirect('/dashboard');
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

app.get('/api/dashboard/operacional', exigirAutenticacao, async (req, res) => {
  try {
    const payload = await obterMetricasOperacionais({
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim
    });

    return res.json(payload);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ erro: error.message });
    }

    console.error('Erro ao montar dashboard operacional:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao montar dashboard operacional.' });
  }
});

app.get('/api/dashboard/home/options', exigirAutenticacao, async (req, res) => {
  try {
    const payload = await obterDashboardHomeOptions();
    return res.json(payload);
  } catch (error) {
    console.error('Erro ao listar opcoes de filtros do dashboard home:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar opcoes de filtros.' });
  }
});

app.get('/api/dashboard/home', exigirAutenticacao, async (req, res) => {
  const chavesPermitidas = new Set([
    'dataInicio',
    'dataFim',
    'campus',
    'setor',
    'tipoProcesso',
    'status',
    'responsavel'
  ]);

  const chavesInvalidas = Object.keys(req.query).filter((chave) => !chavesPermitidas.has(chave));
  if (chavesInvalidas.length) {
    return res.status(400).json({ erro: `Filtros invalidos: ${chavesInvalidas.join(', ')}` });
  }

  const filtros = {
    dataInicio: req.query.dataInicio ? validarDataISO(req.query.dataInicio) : undefined,
    dataFim: req.query.dataFim ? validarDataISO(req.query.dataFim) : undefined,
    campus: normalizarTexto(req.query.campus) || undefined,
    setor: normalizarTexto(req.query.setor) || undefined,
    tipoProcesso: normalizarTexto(req.query.tipoProcesso) || undefined,
    status: normalizarTexto(req.query.status) || undefined,
    responsavel: normalizarTexto(req.query.responsavel) || undefined
  };

  if (req.query.dataInicio && !filtros.dataInicio) {
    return res.status(400).json({ erro: 'dataInicio deve estar no formato YYYY-MM-DD.' });
  }
  if (req.query.dataFim && !filtros.dataFim) {
    return res.status(400).json({ erro: 'dataFim deve estar no formato YYYY-MM-DD.' });
  }
  if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
    return res.status(400).json({ erro: 'dataInicio nao pode ser maior que dataFim.' });
  }

  try {
    const payload = await obterDashboardHome(filtros);
    return res.json(payload);
  } catch (error) {
    console.error('Erro ao montar dashboard home:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao montar dashboard home.' });
  }
});

app.get('/api/dashboard/home/pendencias', exigirAutenticacao, async (req, res) => {
  try {
    const lista = await listarPendenciasCriticas();
    return res.json(lista);
  } catch (error) {
    console.error('Erro ao listar pendencias criticas:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar pendencias criticas.' });
  }
});

app.post('/api/dashboard/home/pendencias', exigirAutenticacao, async (req, res) => {
  try {
    const pendencia = await criarPendenciaCritica(req.body || {});
    return res.status(201).json({
      mensagem: 'Pendencia critica cadastrada com sucesso.',
      pendencia
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao cadastrar pendencia critica:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar pendencia critica.' });
  }
});

app.put('/api/dashboard/home/pendencias/:id', exigirAutenticacao, async (req, res) => {
  try {
    const pendencia = await atualizarPendenciaCritica(req.params.id, req.body || {});
    return res.json({
      mensagem: 'Pendencia critica atualizada com sucesso.',
      pendencia
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao atualizar pendencia critica:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar pendencia critica.' });
  }
});

app.delete('/api/dashboard/home/pendencias/:id', exigirAutenticacao, async (req, res) => {
  try {
    await removerPendenciaCritica(req.params.id);
    return res.json({ mensagem: 'Pendencia critica removida com sucesso.' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao remover pendencia critica:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao remover pendencia critica.' });
  }
});

app.get('/api/dashboard/home/tarefas', exigirAutenticacao, async (req, res) => {
  try {
    const lista = await listarTarefasPrioritarias();
    return res.json(lista);
  } catch (error) {
    console.error('Erro ao listar tarefas prioritarias:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar tarefas prioritarias.' });
  }
});

app.post('/api/dashboard/home/tarefas', exigirAutenticacao, async (req, res) => {
  try {
    const tarefa = await criarTarefaPrioritaria(req.body || {});
    return res.status(201).json({
      mensagem: 'Tarefa prioritaria cadastrada com sucesso.',
      tarefa
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao cadastrar tarefa prioritaria:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar tarefa prioritaria.' });
  }
});

app.put('/api/dashboard/home/tarefas/:id', exigirAutenticacao, async (req, res) => {
  try {
    const tarefa = await atualizarTarefaPrioritaria(req.params.id, req.body || {});
    return res.json({
      mensagem: 'Tarefa prioritaria atualizada com sucesso.',
      tarefa
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao atualizar tarefa prioritaria:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar tarefa prioritaria.' });
  }
});

app.delete('/api/dashboard/home/tarefas/:id', exigirAutenticacao, async (req, res) => {
  try {
    await removerTarefaPrioritaria(req.params.id);
    return res.json({ mensagem: 'Tarefa prioritaria removida com sucesso.' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error('Erro ao remover tarefa prioritaria:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao remover tarefa prioritaria.' });
  }
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

app.get('/api/dashboard/gerencial', exigirAutenticacao, async (req, res) => {
  const chavesPermitidas = new Set([
    'q',
    'status',
    'origem',
    'destino',
    'perfil',
    'setorAtivo',
    'dataInicio',
    'dataFim',
    'limiteRecentes',
    'limiteRank'
  ]);

  const chavesInvalidas = Object.keys(req.query).filter((chave) => !chavesPermitidas.has(chave));
  if (chavesInvalidas.length) {
    return res.status(400).json({ erro: `Filtros invalidos: ${chavesInvalidas.join(', ')}` });
  }

  const q = normalizarTexto(req.query.q);
  const status = normalizarTexto(req.query.status);
  const origem = normalizarTexto(req.query.origem);
  const destino = normalizarTexto(req.query.destino);
  const perfil = normalizarTexto(req.query.perfil);
  const setorAtivo = normalizarTexto(req.query.setorAtivo).toLowerCase();

  if (setorAtivo && setorAtivo !== 'ativo' && setorAtivo !== 'inativo') {
    return res.status(400).json({ erro: 'Filtro setorAtivo deve ser ativo ou inativo.' });
  }

  const dataInicio = req.query.dataInicio ? validarDataISO(req.query.dataInicio) : null;
  const dataFim = req.query.dataFim ? validarDataISO(req.query.dataFim) : null;

  if (req.query.dataInicio && !dataInicio) {
    return res.status(400).json({ erro: 'dataInicio deve estar no formato YYYY-MM-DD.' });
  }

  if (req.query.dataFim && !dataFim) {
    return res.status(400).json({ erro: 'dataFim deve estar no formato YYYY-MM-DD.' });
  }

  if (dataInicio && dataFim && dataInicio > dataFim) {
    return res.status(400).json({ erro: 'dataInicio nao pode ser maior que dataFim.' });
  }

  const limiteRecentes = normalizarInteiro(req.query.limiteRecentes, 10, 1, 50);
  const limiteRank = normalizarInteiro(req.query.limiteRank, 10, 1, 50);

  if (limiteRecentes === null) {
    return res.status(400).json({ erro: 'limiteRecentes deve ser inteiro entre 1 e 50.' });
  }

  if (limiteRank === null) {
    return res.status(400).json({ erro: 'limiteRank deve ser inteiro entre 1 e 50.' });
  }

  const qLike = q ? `%${q}%` : '';

  try {
    const queryDashboard = await pool.query(
      `
        WITH filtered AS (
          SELECT
            p.*,
            u.perfil AS perfil_criador,
            ua.perfil AS perfil_atualizador,
            COALESCE(ua.perfil, u.perfil, 'SEM_PERFIL') AS perfil_responsavel
          FROM processos p
          LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(COALESCE(p.criado_por, ''))
          LEFT JOIN usuarios ua ON LOWER(ua.email) = LOWER(COALESCE(p.atualizado_por, ''))
          WHERE
            ($1 = '' OR (
              COALESCE(p.protocolo, '') ILIKE $1
              OR COALESCE(p.assunto, '') ILIKE $1
              OR COALESCE(p.origem, '') ILIKE $1
              OR COALESCE(p.destino, '') ILIKE $1
              OR COALESCE(p.observacao, '') ILIKE $1
            ))
            AND ($2 = '' OR p.status = $2)
            AND ($3 = '' OR COALESCE(p.origem, '') = $3)
            AND ($4 = '' OR COALESCE(p.destino, '') = $4)
            AND ($5 = '' OR COALESCE(ua.perfil, u.perfil, 'SEM_PERFIL') = $5)
            AND (
              $6 = ''
              OR (
                $6 = 'ativo'
                AND EXISTS (
                  SELECT 1
                  FROM setores s
                  WHERE s.ativo = TRUE
                    AND (
                      LOWER(COALESCE(p.origem, '')) = LOWER(s.nome)
                      OR LOWER(COALESCE(p.origem, '')) = LOWER(s.sigla)
                      OR LOWER(COALESCE(p.origem, '')) = LOWER(s.sigla || ' - ' || s.nome)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.nome)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.sigla)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.sigla || ' - ' || s.nome)
                    )
                )
              )
              OR (
                $6 = 'inativo'
                AND EXISTS (
                  SELECT 1
                  FROM setores s
                  WHERE s.ativo = FALSE
                    AND (
                      LOWER(COALESCE(p.origem, '')) = LOWER(s.nome)
                      OR LOWER(COALESCE(p.origem, '')) = LOWER(s.sigla)
                      OR LOWER(COALESCE(p.origem, '')) = LOWER(s.sigla || ' - ' || s.nome)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.nome)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.sigla)
                      OR LOWER(COALESCE(p.destino, '')) = LOWER(s.sigla || ' - ' || s.nome)
                    )
                )
              )
            )
            AND ($7::date IS NULL OR p.criado_em::date >= $7::date)
            AND ($8::date IS NULL OR p.criado_em::date <= $8::date)
        ),
        kpis AS (
          SELECT
            COUNT(*)::int AS total_processos,
            COUNT(*) FILTER (WHERE status = 'Em analise')::int AS em_analise,
            COUNT(*) FILTER (WHERE status = 'Finalizado')::int AS finalizados,
            COUNT(*) FILTER (WHERE status <> 'Finalizado' AND status <> 'Em analise')::int AS aguardando_andamento,
            COUNT(*) FILTER (WHERE COALESCE(TRIM(destino), '') = '')::int AS processos_sem_destino
          FROM filtered
        ),
        status_dist AS (
          SELECT COALESCE(NULLIF(TRIM(status), ''), 'Sem status') AS label, COUNT(*)::int AS qtd
          FROM filtered
          GROUP BY 1
          ORDER BY qtd DESC, label
        ),
        origem_dist AS (
          SELECT COALESCE(NULLIF(TRIM(origem), ''), 'Sem origem') AS label, COUNT(*)::int AS qtd
          FROM filtered
          GROUP BY 1
          ORDER BY qtd DESC, label
        ),
        destino_dist AS (
          SELECT COALESCE(NULLIF(TRIM(destino), ''), 'Sem destino') AS label, COUNT(*)::int AS qtd
          FROM filtered
          GROUP BY 1
          ORDER BY qtd DESC, label
        ),
        perfil_dist AS (
          SELECT COALESCE(NULLIF(TRIM(perfil_responsavel), ''), 'SEM_PERFIL') AS label, COUNT(*)::int AS qtd
          FROM filtered
          GROUP BY 1
          ORDER BY qtd DESC, label
        ),
        fluxos AS (
          SELECT
            COALESCE(NULLIF(TRIM(origem), ''), 'Sem origem') AS origem,
            COALESCE(NULLIF(TRIM(destino), ''), 'Sem destino') AS destino,
            COUNT(*)::int AS qtd
          FROM filtered
          GROUP BY 1, 2
          ORDER BY qtd DESC, origem, destino
          LIMIT $9
        ),
        recentes AS (
          SELECT
            id,
            status,
            protocolo,
            assunto,
            origem,
            destino,
            criado_em,
            atualizado_em
          FROM filtered
          ORDER BY COALESCE(atualizado_em, criado_em) DESC, id DESC
          LIMIT $10
        ),
        alertas_base AS (
          SELECT
            (
              SELECT COUNT(*)::int
              FROM filtered f
              WHERE EXISTS (
                SELECT 1
                FROM setores s
                WHERE s.ativo = FALSE
                  AND (
                    LOWER(COALESCE(f.origem, '')) = LOWER(s.nome)
                    OR LOWER(COALESCE(f.origem, '')) = LOWER(s.sigla)
                    OR LOWER(COALESCE(f.origem, '')) = LOWER(s.sigla || ' - ' || s.nome)
                    OR LOWER(COALESCE(f.destino, '')) = LOWER(s.nome)
                    OR LOWER(COALESCE(f.destino, '')) = LOWER(s.sigla)
                    OR LOWER(COALESCE(f.destino, '')) = LOWER(s.sigla || ' - ' || s.nome)
                  )
              )
            ) AS setores_inativos_vinculados,
            (
              SELECT COUNT(*)::int
              FROM filtered f
              WHERE EXISTS (
                SELECT 1
                FROM usuarios u
                WHERE u.ativo = FALSE
                  AND (
                    LOWER(COALESCE(f.criado_por, '')) = LOWER(u.email)
                    OR LOWER(COALESCE(f.atualizado_por, '')) = LOWER(u.email)
                  )
              )
            ) AS usuarios_inativos_vinculados,
            (
              SELECT COALESCE(MAX(c.qtd), 0)::int
              FROM (
                SELECT COUNT(*)::int AS qtd
                FROM filtered
                GROUP BY status
              ) c
            ) AS maior_status_qtd,
            (
              SELECT COUNT(*)::int
              FROM filtered
            ) AS total
        )
        SELECT
          jsonb_build_object(
            'totalProcessos', (SELECT total_processos FROM kpis),
            'emAnalise', (SELECT em_analise FROM kpis),
            'finalizados', (SELECT finalizados FROM kpis),
            'aguardandoAndamento', (SELECT aguardando_andamento FROM kpis),
            'setoresAtivos', (SELECT COUNT(*)::int FROM setores WHERE ativo = TRUE),
            'usuariosAtivos', (SELECT COUNT(*)::int FROM usuarios WHERE ativo = TRUE),
            'processosSemDestino', (SELECT processos_sem_destino FROM kpis),
            'taxaFinalizacaoPeriodo', CASE
              WHEN (SELECT total_processos FROM kpis) > 0
                THEN ROUND((((SELECT finalizados FROM kpis)::numeric / (SELECT total_processos FROM kpis)::numeric) * 100), 2)
              ELSE NULL
            END
          ) AS kpis,
          jsonb_build_object(
            'status', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM status_dist), '[]'::jsonb),
            'origem', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM origem_dist), '[]'::jsonb),
            'destino', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM destino_dist), '[]'::jsonb),
            'perfil', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM perfil_dist), '[]'::jsonb)
          ) AS graficos,
          jsonb_build_object(
            'fluxos', COALESCE((SELECT jsonb_agg(jsonb_build_object('origem', origem, 'destino', destino, 'qtd', qtd)) FROM fluxos), '[]'::jsonb),
            'setoresComMaisOrigem', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM (SELECT label, qtd FROM origem_dist LIMIT $9) t), '[]'::jsonb),
            'setoresComMaisDestino', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'qtd', qtd)) FROM (SELECT label, qtd FROM destino_dist LIMIT $9) t), '[]'::jsonb)
          ) AS rankings,
          COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'id', id,
                'status', status,
                'protocolo', protocolo,
                'assunto', assunto,
                'origem', origem,
                'destino', destino,
                'criadoEm', criado_em,
                'atualizadoEm', atualizado_em
              )
            ) FROM recentes),
            '[]'::jsonb
          ) AS recentes,
          jsonb_build_object(
            'setoresInativosVinculados', (SELECT setores_inativos_vinculados FROM alertas_base),
            'usuariosInativosVinculados', (SELECT usuarios_inativos_vinculados FROM alertas_base),
            'processosSemDestino', (SELECT processos_sem_destino FROM kpis),
            'concentracaoStatus', jsonb_build_object(
              'qtd', (SELECT maior_status_qtd FROM alertas_base),
              'total', (SELECT total FROM alertas_base),
              'percentual', CASE
                WHEN (SELECT total FROM alertas_base) > 0
                  THEN ROUND((((SELECT maior_status_qtd FROM alertas_base)::numeric / (SELECT total FROM alertas_base)::numeric) * 100), 2)
                ELSE 0
              END
            )
          ) AS alertas
      `,
      [qLike, status, origem, destino, perfil, setorAtivo, dataInicio, dataFim, limiteRank, limiteRecentes]
    );

    const row = queryDashboard.rows[0] || {};
    const alertaItens = [];

    if ((row.alertas?.setoresInativosVinculados || 0) > 0) {
      alertaItens.push({
        codigo: 'setores_inativos_vinculados',
        nivel: 'medio',
        titulo: 'Setores inativos vinculados a processos',
        quantidade: row.alertas.setoresInativosVinculados,
        descricao: 'Existem processos associados a setores marcados como inativos.'
      });
    }

    if ((row.alertas?.usuariosInativosVinculados || 0) > 0) {
      alertaItens.push({
        codigo: 'usuarios_inativos_vinculados',
        nivel: 'medio',
        titulo: 'Usuarios inativos ainda vinculados',
        quantidade: row.alertas.usuariosInativosVinculados,
        descricao: 'Foram encontrados processos vinculados a usuarios inativos.'
      });
    }

    if ((row.alertas?.processosSemDestino || 0) > 0) {
      alertaItens.push({
        codigo: 'processos_sem_destino',
        nivel: 'alto',
        titulo: 'Processos sem destino definido',
        quantidade: row.alertas.processosSemDestino,
        descricao: 'Revise os processos sem preenchimento de destino.'
      });
    }

    const percentualConcentracao = Number(row.alertas?.concentracaoStatus?.percentual || 0);
    if (percentualConcentracao >= 60) {
      alertaItens.push({
        codigo: 'concentracao_status',
        nivel: 'medio',
        titulo: 'Concentracao elevada em um unico status',
        quantidade: row.alertas?.concentracaoStatus?.qtd || 0,
        descricao: `Mais de ${percentualConcentracao}% dos processos estao concentrados no mesmo status.`
      });
    }

    return res.json({
      filtrosAplicados: {
        q,
        status,
        origem,
        destino,
        perfil,
        setorAtivo,
        dataInicio,
        dataFim,
        limiteRecentes,
        limiteRank
      },
      kpis: row.kpis || {},
      graficos: row.graficos || { status: [], origem: [], destino: [], perfil: [] },
      rankings: row.rankings || { fluxos: [], setoresComMaisOrigem: [], setoresComMaisDestino: [] },
      alertas: {
        ...(row.alertas || {}),
        itens: alertaItens
      },
      recentes: row.recentes || [],
      metadados: {
        camposDisponiveis: {
          taxaFinalizacaoPeriodo: true,
          tempoTramitacao: false,
          responsavelAtual: false,
          conclusaoNoPrazo: false
        },
        statusAguardandoRegra: "status diferente de 'Finalizado' e 'Em analise'"
      }
    });
  } catch (error) {
    console.error('Erro ao montar dashboard gerencial:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao montar dashboard gerencial.' });
  }
});

app.get('/api/setores', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT id, nome, sigla, ativo, criado_em, atualizado_em
        FROM setores
        WHERE ativo = TRUE
        ORDER BY nome
      `
    );

    res.json(resultado.rows.map(respostaSetor));
  } catch (error) {
    console.error('Erro ao listar setores ativos:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar setores.' });
  }
});

app.get('/api/setores/todos', exigirAutenticacao, exigirMaster, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT id, nome, sigla, ativo, criado_em, atualizado_em
        FROM setores
        ORDER BY nome
      `
    );

    res.json(resultado.rows.map(respostaSetor));
  } catch (error) {
    console.error('Erro ao listar todos os setores:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar setores.' });
  }
});

app.post('/api/setores', exigirAutenticacao, exigirMaster, async (req, res) => {
  const nome = normalizarTexto(req.body.nome);
  const sigla = normalizarTexto(req.body.sigla).toUpperCase();

  if (!nome || !sigla) {
    return res.status(400).json({ erro: 'Informe nome e sigla para cadastrar o setor.' });
  }

  try {
    const inserido = await pool.query(
      `
        INSERT INTO setores (nome, sigla, ativo, atualizado_em)
        VALUES ($1, $2, TRUE, NOW())
        RETURNING id, nome, sigla, ativo, criado_em, atualizado_em
      `,
      [nome, sigla]
    );

    res.status(201).json({
      mensagem: 'Setor cadastrado com sucesso.',
      setor: respostaSetor(inserido.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe setor com este nome ou sigla.' });
    }

    console.error('Erro ao cadastrar setor:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar setor.' });
  }
});

app.put('/api/setores/:id', exigirAutenticacao, exigirMaster, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de setor invalido.' });
  }

  try {
    const atual = await pool.query(
      'SELECT id, nome, sigla, ativo, criado_em, atualizado_em FROM setores WHERE id = $1',
      [id]
    );

    if (!atual.rowCount) {
      return res.status(404).json({ erro: 'Setor nao encontrado.' });
    }

    const setor = atual.rows[0];
    const nome = req.body.nome !== undefined ? normalizarTexto(req.body.nome) : setor.nome;
    const sigla = req.body.sigla !== undefined ? normalizarTexto(req.body.sigla).toUpperCase() : setor.sigla;
    const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : Boolean(setor.ativo);

    if (!nome || !sigla) {
      return res.status(400).json({ erro: 'Nome e sigla do setor sao obrigatorios.' });
    }

    const atualizado = await pool.query(
      `
        UPDATE setores
        SET nome = $1,
            sigla = $2,
            ativo = $3,
            atualizado_em = NOW()
        WHERE id = $4
        RETURNING id, nome, sigla, ativo, criado_em, atualizado_em
      `,
      [nome, sigla, ativo, id]
    );

    res.json({
      mensagem: 'Setor atualizado com sucesso.',
      setor: respostaSetor(atualizado.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe setor com este nome ou sigla.' });
    }

    console.error('Erro ao atualizar setor:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar setor.' });
  }
});

app.post('/api/setores/importar', exigirAutenticacao, exigirMaster, async (req, res) => {
  const lista = Array.isArray(req.body.setores) ? req.body.setores : [];

  if (!lista.length) {
    return res.status(400).json({ erro: 'Informe uma lista de setores para importar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const item of lista) {
      const nome = normalizarTexto(item.nome);
      const sigla = normalizarTexto(item.sigla).toUpperCase();

      if (!nome || !sigla) {
        ignorados += 1;
        continue;
      }

      const resultado = await client.query(
        `
          INSERT INTO setores (nome, sigla, ativo, atualizado_em)
          VALUES ($1, $2, TRUE, NOW())
          ON CONFLICT ((LOWER(sigla))) DO UPDATE
            SET nome = EXCLUDED.nome,
                sigla = EXCLUDED.sigla,
                ativo = TRUE,
                atualizado_em = NOW()
          RETURNING (xmax = 0) AS inserido
        `,
        [nome, sigla]
      );

      if (resultado.rows[0].inserido) {
        inseridos += 1;
      } else {
        atualizados += 1;
      }
    }

    await client.query('COMMIT');

    res.json({
      mensagem: 'Importacao de setores concluida.',
      resumo: { inseridos, atualizados, ignorados }
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Conflito de nome ou sigla ao importar setores.' });
    }

    console.error('Erro ao importar setores:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao importar setores.' });
  } finally {
    client.release();
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
          p.id,
          p.status,
          p.precisa_resposta,
          p.data_recebimento,
          p.protocolo,
          p.link,
          p.origem,
          p.destino,
          p.prazo_dias_uteis,
          p.prazo_em_dias_uteis,
          p.assunto,
          p.observacao,
          p.gut_gravidade,
          p.gut_gravidade_pontos,
          p.gut_urgencia,
          p.gut_urgencia_pontos,
          p.gut_tendencia,
          p.gut_tendencia_pontos,
          p.gut_prioridade_final,
          p.setor_destino_id,
          sd.nome AS setor_destino_nome,
          sd.sigla AS setor_destino_sigla,
          p.distribuido_em,
          p.distribuido_por,
          p.criado_por,
          p.atualizado_por,
          p.criado_em,
          p.atualizado_em
        FROM processos p
        LEFT JOIN setores sd ON sd.id = p.setor_destino_id
        ORDER BY p.criado_em DESC, p.id DESC
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
          gut_gravidade,
          gut_gravidade_pontos,
          gut_urgencia,
          gut_urgencia_pontos,
          gut_tendencia,
          gut_tendencia_pontos,
          gut_prioridade_final,
          setor_destino_id,
          distribuido_em,
          distribuido_por,
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
          gut_gravidade,
          gut_gravidade_pontos,
          gut_urgencia,
          gut_urgencia_pontos,
          gut_tendencia,
          gut_tendencia_pontos,
          gut_prioridade_final,
          setor_destino_id,
          distribuido_em,
          distribuido_por,
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

app.put('/api/processos/:id/distribuicao-interna', exigirAutenticacao, exigirGestaoProcessos, async (req, res) => {
  const id = Number(req.params.id);
  const setorDestinoId = Number(req.body.setorDestinoId);
  const statusAtualizado = req.body.status !== undefined ? normalizarTexto(req.body.status) : null;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de processo invalido.' });
  }

  if (!Number.isInteger(setorDestinoId) || setorDestinoId <= 0) {
    return res.status(400).json({ erro: 'Informe um setor interno valido para distribuicao.' });
  }

  try {
    const setorConsulta = await pool.query(
      'SELECT id, nome, sigla, ativo FROM setores WHERE id = $1',
      [setorDestinoId]
    );

    if (!setorConsulta.rowCount) {
      return res.status(404).json({ erro: 'Setor de destino nao encontrado.' });
    }

    const setorDestino = setorConsulta.rows[0];
    if (!setorDestino.ativo) {
      return res.status(400).json({ erro: 'Nao e possivel distribuir para setor inativo.' });
    }

    const destinoLegado = `${setorDestino.sigla} - ${setorDestino.nome}`;
    const atualizado = await pool.query(
      `
        UPDATE processos
        SET
          setor_destino_id = $1,
          destino = $2,
          status = COALESCE(NULLIF($3, ''), status),
          distribuido_em = NOW(),
          distribuido_por = $4,
          atualizado_por = $4,
          atualizado_em = NOW()
        WHERE id = $5
        RETURNING id
      `,
      [setorDestinoId, destinoLegado, statusAtualizado, req.usuario.email, id]
    );

    if (!atualizado.rowCount) {
      return res.status(404).json({ erro: 'Processo nao encontrado.' });
    }

    const detalhado = await pool.query(
      `
        SELECT
          p.id,
          p.status,
          p.precisa_resposta,
          p.data_recebimento,
          p.protocolo,
          p.link,
          p.origem,
          p.destino,
          p.prazo_dias_uteis,
          p.prazo_em_dias_uteis,
          p.assunto,
          p.observacao,
          p.gut_gravidade,
          p.gut_gravidade_pontos,
          p.gut_urgencia,
          p.gut_urgencia_pontos,
          p.gut_tendencia,
          p.gut_tendencia_pontos,
          p.gut_prioridade_final,
          p.setor_destino_id,
          sd.nome AS setor_destino_nome,
          sd.sigla AS setor_destino_sigla,
          p.distribuido_em,
          p.distribuido_por,
          p.criado_por,
          p.atualizado_por,
          p.criado_em,
          p.atualizado_em
        FROM processos p
        LEFT JOIN setores sd ON sd.id = p.setor_destino_id
        WHERE p.id = $1
      `,
      [id]
    );

    return res.json({
      mensagem: 'Distribuicao interna registrada com sucesso.',
      processo: respostaProcesso(detalhado.rows[0])
    });
  } catch (error) {
    console.error('Erro ao distribuir processo internamente:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao distribuir processo internamente.' });
  }
});

app.get('/api/processos/fila-interna', exigirAutenticacao, async (req, res) => {
  const setorIdRaw = req.query.setorId;
  const setorId = setorIdRaw === undefined ? null : Number(setorIdRaw);

  if (setorIdRaw !== undefined && (!Number.isInteger(setorId) || setorId <= 0)) {
    return res.status(400).json({ erro: 'setorId invalido.' });
  }

  try {
    const lista = await pool.query(
      `
        SELECT
          p.id,
          p.status,
          p.precisa_resposta,
          p.data_recebimento,
          p.protocolo,
          p.link,
          p.origem,
          p.destino,
          p.prazo_dias_uteis,
          p.prazo_em_dias_uteis,
          p.assunto,
          p.observacao,
          p.gut_gravidade,
          p.gut_gravidade_pontos,
          p.gut_urgencia,
          p.gut_urgencia_pontos,
          p.gut_tendencia,
          p.gut_tendencia_pontos,
          p.gut_prioridade_final,
          p.setor_destino_id,
          sd.nome AS setor_destino_nome,
          sd.sigla AS setor_destino_sigla,
          p.distribuido_em,
          p.distribuido_por,
          p.criado_por,
          p.atualizado_por,
          p.criado_em,
          p.atualizado_em
        FROM processos p
        LEFT JOIN setores sd ON sd.id = p.setor_destino_id
        WHERE p.setor_destino_id IS NOT NULL
          AND p.status <> 'Finalizado'
          AND ($1::int IS NULL OR p.setor_destino_id = $1)
        ORDER BY p.distribuido_em DESC NULLS LAST, p.id DESC
      `,
      [setorId]
    );

    return res.json(lista.rows.map(respostaProcesso));
  } catch (error) {
    console.error('Erro ao listar fila interna de processos:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar fila interna.' });
  }
});

app.put('/api/processos/:id/gut', exigirAutenticacao, exigirMaster, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de processo invalido.' });
  }

  const protocolo = normalizarTexto(req.body.protocolo);
  const assunto = normalizarTexto(req.body.assunto);

  if (!protocolo || !assunto) {
    return res.status(400).json({ erro: 'Os campos protocolo e assunto sao obrigatorios.' });
  }

  const gravidade = validarOpcaoGut(req.body.gutGravidade, GUT_GRAVIDADE_PONTOS, 'Gravidade');
  if (gravidade.erro) return res.status(400).json({ erro: gravidade.erro });

  const urgencia = validarOpcaoGut(req.body.gutUrgencia, GUT_URGENCIA_PONTOS, 'Urgencia');
  if (urgencia.erro) return res.status(400).json({ erro: urgencia.erro });

  const tendencia = validarOpcaoGut(req.body.gutTendencia, GUT_TENDENCIA_PONTOS, 'Tendencia');
  if (tendencia.erro) return res.status(400).json({ erro: tendencia.erro });

  const gutPrioridadeFinal =
    gravidade.pontos !== null && urgencia.pontos !== null && tendencia.pontos !== null
      ? gravidade.pontos + urgencia.pontos + tendencia.pontos
      : null;

  try {
    const atualizado = await pool.query(
      `
        UPDATE processos
        SET
          protocolo = $1,
          assunto = $2,
          gut_gravidade = $3,
          gut_gravidade_pontos = $4,
          gut_urgencia = $5,
          gut_urgencia_pontos = $6,
          gut_tendencia = $7,
          gut_tendencia_pontos = $8,
          gut_prioridade_final = $9,
          atualizado_por = $10,
          atualizado_em = NOW()
        WHERE id = $11
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
          gut_gravidade,
          gut_gravidade_pontos,
          gut_urgencia,
          gut_urgencia_pontos,
          gut_tendencia,
          gut_tendencia_pontos,
          gut_prioridade_final,
          setor_destino_id,
          distribuido_em,
          distribuido_por,
          criado_por,
          atualizado_por,
          criado_em,
          atualizado_em
      `,
      [
        protocolo,
        assunto,
        gravidade.opcao,
        gravidade.pontos,
        urgencia.opcao,
        urgencia.pontos,
        tendencia.opcao,
        tendencia.pontos,
        gutPrioridadeFinal,
        req.usuario.email,
        id
      ]
    );

    if (!atualizado.rowCount) {
      return res.status(404).json({ erro: 'Processo nao encontrado.' });
    }

    return res.json({
      mensagem: 'Matriz GUT atualizada com sucesso.',
      processo: respostaProcesso(atualizado.rows[0])
    });
  } catch (error) {
    console.error('Erro ao atualizar matriz GUT:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar matriz GUT.' });
  }
});

app.get(['/', '/dashboard', '/processos', '/setores', '/usuarios', '/gut'], (req, res) => {
  res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
});

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initComRetry(maxTentativas = 6, esperaBaseMs = 2000) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      await initDatabase();
      await garantirUsuarioMaster();
      return;
    } catch (error) {
      ultimoErro = error;
      const deveRetentar = tentativa < maxTentativas;
      console.error(`Falha na inicializacao (tentativa ${tentativa}/${maxTentativas}):`, error.message);

      if (deveRetentar) {
        await esperar(esperaBaseMs * tentativa);
      }
    }
  }

  throw ultimoErro;
}

(async () => {
  try {
    await initComRetry();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar servidor:', error.message);
    process.exit(1);
  }
})();
