const crypto = require('crypto');
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const MASTER_EMAIL = 'fernando.alves@ifms.edu.br';
const SESSION_COOKIE_NAME = 'prodi_sid';

const PERFIS = [
  {
    id: 'ADMIN_MASTER',
    nome: 'Administrador Master',
    descricao: 'Controle total de usuarios, perfis e configuracoes do sistema.'
  },
  {
    id: 'GESTOR_PRODI',
    nome: 'Gestor PRODI',
    descricao: 'Acompanha indicadores, organiza fluxo e supervisiona processos.'
  },
  {
    id: 'ANALISTA_PROCESSOS',
    nome: 'Analista de Processos',
    descricao: 'Registra, atualiza e acompanha a tramitacao de processos.'
  },
  {
    id: 'APOIO_ADMINISTRATIVO',
    nome: 'Apoio Administrativo',
    descricao: 'Apoia cadastros e atualizacoes operacionais dos processos.'
  }
];

const usuarios = [
  {
    id: 1,
    nome: 'Fernando Alves',
    email: MASTER_EMAIL,
    perfil: 'ADMIN_MASTER',
    ativo: true,
    origem: 'seed',
    criadoEm: new Date().toISOString(),
    ultimoLoginEm: null
  }
];

const processos = [];
const sessoes = new Map();
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

function obterUsuarioPorSessao(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const sessao = sessoes.get(sessionId);
  if (!sessao) return null;

  const usuario = usuarios.find((item) => item.id === sessao.usuarioId);
  if (!usuario || !usuario.ativo) {
    sessoes.delete(sessionId);
    return null;
  }

  return usuario;
}

function definirCookieSessao(res, sessionId) {
  const partes = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 8}`
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
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    perfilNome: PERFIS.find((item) => item.id === usuario.perfil)?.nome || usuario.perfil,
    ativo: usuario.ativo,
    origem: usuario.origem,
    criadoEm: usuario.criadoEm,
    ultimoLoginEm: usuario.ultimoLoginEm
  };
}

function exigirAutenticacao(req, res, next) {
  const usuario = obterUsuarioPorSessao(req);

  if (!usuario) {
    return res.status(401).json({
      erro: 'Autenticacao obrigatoria. Entre com sua conta Google do IFMS.'
    });
  }

  req.usuario = usuario;
  return next();
}

function exigirMaster(req, res, next) {
  if (req.usuario.perfil !== 'ADMIN_MASTER') {
    return res.status(403).json({
      erro: 'Apenas o Administrador Master pode gerenciar usuarios.'
    });
  }

  return next();
}

function garantirUsuarioMaster() {
  const master = usuarios.find((item) => item.email === MASTER_EMAIL);

  if (!master) {
    usuarios.push({
      id: Date.now(),
      nome: 'Fernando Alves',
      email: MASTER_EMAIL,
      perfil: 'ADMIN_MASTER',
      ativo: true,
      origem: 'sistema',
      criadoEm: new Date().toISOString(),
      ultimoLoginEm: null
    });
    return;
  }

  master.perfil = 'ADMIN_MASTER';
  master.ativo = true;
}

function criarOuAtualizarUsuarioGoogle(userInfo) {
  const email = normalizarEmail(userInfo.email);
  let usuario = usuarios.find((item) => item.email === email);

  if (!usuario) {
    usuario = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      nome: userInfo.name || email,
      email,
      perfil: email === MASTER_EMAIL ? 'ADMIN_MASTER' : 'ANALISTA_PROCESSOS',
      ativo: true,
      origem: 'google',
      criadoEm: new Date().toISOString(),
      ultimoLoginEm: null
    };

    usuarios.push(usuario);
  }

  usuario.nome = userInfo.name || usuario.nome;
  usuario.ultimoLoginEm = new Date().toISOString();

  if (email === MASTER_EMAIL) {
    usuario.perfil = 'ADMIN_MASTER';
    usuario.ativo = true;
  }

  return usuario;
}

function buildGoogleAuthUrl(state) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
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
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
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

    const usuario = criarOuAtualizarUsuarioGoogle(userInfo);

    if (!usuario.ativo) {
      return res.status(403).send('Usuario inativo no sistema. Procure o Administrador Master.');
    }

    const sessionId = crypto.randomBytes(24).toString('hex');
    sessoes.set(sessionId, {
      usuarioId: usuario.id,
      criadoEm: Date.now()
    });

    definirCookieSessao(res, sessionId);
    return res.redirect('/usuarios');
  } catch (erro) {
    console.error('Erro no callback Google:', erro.message);
    return res.status(500).send('Nao foi possivel concluir a autenticacao Google.');
  }
});

app.get('/api/auth/me', (req, res) => {
  const usuario = obterUsuarioPorSessao(req);

  if (!usuario) {
    return res.json({ autenticado: false, usuario: null });
  }

  return res.json({ autenticado: true, usuario: respostaUsuario(usuario) });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];

  if (sessionId) {
    sessoes.delete(sessionId);
  }

  limparCookieSessao(res);

  return res.json({ mensagem: 'Sessao encerrada com sucesso.' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'processos-prodi'
  });
});

app.get('/api/perfis', exigirAutenticacao, (req, res) => {
  res.json(PERFIS);
});

app.get('/api/usuarios', exigirAutenticacao, exigirMaster, (req, res) => {
  const lista = usuarios
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map(respostaUsuario);

  res.json(lista);
});

app.post('/api/usuarios', exigirAutenticacao, exigirMaster, (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = normalizarEmail(req.body.email);
  const perfil = String(req.body.perfil || '').trim();

  if (!nome || !email || !perfil) {
    return res.status(400).json({
      erro: 'Informe nome, email e perfil para cadastrar o usuario.'
    });
  }

  if (!email.endsWith('@ifms.edu.br')) {
    return res.status(400).json({
      erro: 'Somente e-mails institucionais @ifms.edu.br sao permitidos.'
    });
  }

  if (!PERFIS.some((item) => item.id === perfil)) {
    return res.status(400).json({
      erro: 'Perfil de usuario invalido.'
    });
  }

  if (usuarios.some((item) => item.email === email)) {
    return res.status(409).json({
      erro: 'Ja existe usuario cadastrado com este e-mail.'
    });
  }

  const novoUsuario = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    nome,
    email,
    perfil: email === MASTER_EMAIL ? 'ADMIN_MASTER' : perfil,
    ativo: true,
    origem: 'manual',
    criadoEm: new Date().toISOString(),
    ultimoLoginEm: null
  };

  usuarios.push(novoUsuario);
  garantirUsuarioMaster();

  res.status(201).json({
    mensagem: 'Usuario cadastrado com sucesso.',
    usuario: respostaUsuario(novoUsuario)
  });
});

app.put('/api/usuarios/:id', exigirAutenticacao, exigirMaster, (req, res) => {
  const id = Number(req.params.id);
  const usuario = usuarios.find((item) => item.id === id);

  if (!usuario) {
    return res.status(404).json({
      erro: 'Usuario nao encontrado.'
    });
  }

  const nome = req.body.nome !== undefined ? String(req.body.nome).trim() : usuario.nome;
  const perfil = req.body.perfil !== undefined ? String(req.body.perfil).trim() : usuario.perfil;
  const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : usuario.ativo;

  if (!nome) {
    return res.status(400).json({
      erro: 'O nome do usuario nao pode ficar vazio.'
    });
  }

  const isMaster = usuario.email === MASTER_EMAIL;

  if (isMaster) {
    usuario.perfil = 'ADMIN_MASTER';
    usuario.ativo = true;
  } else {
    if (!PERFIS.some((item) => item.id === perfil)) {
      return res.status(400).json({
        erro: 'Perfil de usuario invalido.'
      });
    }

    usuario.perfil = perfil;
    usuario.ativo = ativo;
  }

  usuario.nome = nome;

  garantirUsuarioMaster();

  res.json({
    mensagem: 'Usuario atualizado com sucesso.',
    usuario: respostaUsuario(usuario)
  });
});

app.get('/api/processos', exigirAutenticacao, (req, res) => {
  res.json(processos);
});

app.post('/api/processos', exigirAutenticacao, (req, res) => {
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
    return res.status(400).json({
      erro: 'Os campos protocolo e assunto sao obrigatorios.'
    });
  }

  const novoProcesso = {
    id: Date.now(),
    status: status || 'Recebido',
    precisaResposta: precisaResposta || 'Nao',
    dataRecebimento: dataRecebimento || '',
    protocolo: protocolo || '',
    link: link || '',
    origem: origem || '',
    destino: destino || '',
    prazoDiasUteis: prazoDiasUteis || '',
    assunto: assunto || '',
    observacao: observacao || '',
    criadoPor: req.usuario.email,
    criadoEm: new Date().toISOString()
  };

  processos.push(novoProcesso);

  res.status(201).json({
    mensagem: 'Processo cadastrado com sucesso.',
    processo: novoProcesso
  });
});

app.put('/api/processos/:id', exigirAutenticacao, (req, res) => {
  const id = Number(req.params.id);

  const index = processos.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({
      erro: 'Processo nao encontrado.'
    });
  }

  const processoAtual = processos[index];
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
    return res.status(400).json({
      erro: 'Os campos protocolo e assunto sao obrigatorios.'
    });
  }

  processos[index] = {
    ...processoAtual,
    status: status || processoAtual.status,
    precisaResposta: precisaResposta || processoAtual.precisaResposta,
    dataRecebimento: dataRecebimento || '',
    protocolo: protocolo || '',
    link: link || '',
    origem: origem || '',
    destino: destino || '',
    prazoDiasUteis: prazoDiasUteis || '',
    assunto: assunto || '',
    observacao: observacao || '',
    atualizadoPor: req.usuario.email,
    atualizadoEm: new Date().toISOString()
  };

  res.json({
    mensagem: 'Processo atualizado com sucesso.',
    processo: processos[index]
  });
});

app.get('/usuarios', exigirAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'usuarios.html'));
});

garantirUsuarioMaster();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
