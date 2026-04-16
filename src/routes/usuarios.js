const express = require('express');
const pool = require('../db');
const { MASTER_EMAIL } = require('../bootstrap-db');
const { exigirAutenticacao, exigirMaster, garantirUsuarioMaster } = require('../middleware/auth');
const { normalizarEmail, normalizarTexto } = require('../utils/validators');
const { respostaUsuario } = require('../utils/formatters');

const router = express.Router();

router.get('/', exigirAutenticacao, exigirMaster, async (req, res) => {
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

router.post('/', exigirAutenticacao, exigirMaster, async (req, res) => {
  const nome = normalizarTexto(req.body.nome);
  const email = normalizarEmail(req.body.email);
  const perfil = normalizarTexto(req.body.perfil);

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

router.put('/:id', exigirAutenticacao, exigirMaster, async (req, res) => {
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
    const nome = req.body.nome !== undefined ? normalizarTexto(req.body.nome) : usuario.nome;
    const perfil = req.body.perfil !== undefined ? normalizarTexto(req.body.perfil) : usuario.perfil;
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
        SET nome = $1, perfil = $2, ativo = $3, atualizado_em = NOW()
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

module.exports = router;
