const crypto = require('crypto');
const pool = require('../db');
const { MASTER_EMAIL } = require('../bootstrap-db');
const { normalizarEmail } = require('../utils/validators');

const SESSION_COOKIE_NAME = 'prodi_sid';
const SESSION_HOURS = 8;

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
  const masterNome = process.env.MASTER_NOME || 'Administrador Master';
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
    [masterNome, MASTER_EMAIL]
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

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_HOURS,
  parseCookies,
  definirCookieSessao,
  limparCookieSessao,
  obterUsuarioPorSessao,
  criarSessao,
  exigirAutenticacao,
  exigirMaster,
  exigirGestaoProcessos,
  garantirUsuarioMaster,
  criarOuAtualizarUsuarioGoogle
};
