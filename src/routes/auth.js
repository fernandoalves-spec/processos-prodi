const crypto = require('crypto');
const express = require('express');
const { MASTER_EMAIL } = require('../bootstrap-db');
const {
  SESSION_COOKIE_NAME,
  parseCookies,
  definirCookieSessao,
  limparCookieSessao,
  obterUsuarioPorSessao,
  criarSessao,
  criarOuAtualizarUsuarioGoogle
} = require('../middleware/auth');
const { respostaUsuario } = require('../utils/formatters');
const { normalizarEmail } = require('../utils/validators');
const pool = require('../db');

const router = express.Router();
const oauthEstados = new Map();

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

router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({
      erro: 'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no ambiente.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthEstados.set(state, Date.now());
  return res.redirect(buildGoogleAuthUrl(state));
});

router.get('/google/callback', async (req, res) => {
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

router.get('/me', async (req, res) => {
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

router.post('/logout', async (req, res) => {
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

module.exports = router;
