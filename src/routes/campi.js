const express = require('express');
const pool = require('../db');
const { exigirAutenticacao, exigirMaster } = require('../middleware/auth');
const { normalizarTexto } = require('../utils/validators');
const { respostaCampus } = require('../utils/formatters');

const router = express.Router();

router.get('/', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT id, nome, sigla, ativo, criado_em, atualizado_em
        FROM campi
        WHERE ativo = TRUE
        ORDER BY nome
      `
    );

    res.json(resultado.rows.map(respostaCampus));
  } catch (error) {
    console.error('Erro ao listar campi ativos:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar campi.' });
  }
});

router.get('/todos', exigirAutenticacao, exigirMaster, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT id, nome, sigla, ativo, criado_em, atualizado_em
        FROM campi
        ORDER BY nome
      `
    );

    res.json(resultado.rows.map(respostaCampus));
  } catch (error) {
    console.error('Erro ao listar todos os campi:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar campi.' });
  }
});

router.post('/', exigirAutenticacao, exigirMaster, async (req, res) => {
  const nome = normalizarTexto(req.body.nome);
  const sigla = normalizarTexto(req.body.sigla).toUpperCase();

  if (!nome || !sigla) {
    return res.status(400).json({ erro: 'Informe nome e sigla para cadastrar o campus.' });
  }

  try {
    const inserido = await pool.query(
      `
        INSERT INTO campi (nome, sigla, ativo, atualizado_em)
        VALUES ($1, $2, TRUE, NOW())
        RETURNING id, nome, sigla, ativo, criado_em, atualizado_em
      `,
      [nome, sigla]
    );

    res.status(201).json({
      mensagem: 'Campus cadastrado com sucesso.',
      campus: respostaCampus(inserido.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe campus com este nome ou sigla.' });
    }
    console.error('Erro ao cadastrar campus:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar campus.' });
  }
});

router.put('/:id', exigirAutenticacao, exigirMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Id de campus invalido.' });
  }

  try {
    const atual = await pool.query(
      'SELECT id, nome, sigla, ativo FROM campi WHERE id = $1',
      [id]
    );
    if (!atual.rowCount) {
      return res.status(404).json({ erro: 'Campus nao encontrado.' });
    }

    const campus = atual.rows[0];
    const nome = req.body.nome !== undefined ? normalizarTexto(req.body.nome) : campus.nome;
    const sigla = req.body.sigla !== undefined ? normalizarTexto(req.body.sigla).toUpperCase() : campus.sigla;
    const ativo = req.body.ativo !== undefined ? Boolean(req.body.ativo) : Boolean(campus.ativo);

    if (!nome || !sigla) {
      return res.status(400).json({ erro: 'Nome e sigla do campus sao obrigatorios.' });
    }

    const atualizado = await pool.query(
      `
        UPDATE campi
        SET nome = $1, sigla = $2, ativo = $3, atualizado_em = NOW()
        WHERE id = $4
        RETURNING id, nome, sigla, ativo, criado_em, atualizado_em
      `,
      [nome, sigla, ativo, id]
    );

    res.json({
      mensagem: 'Campus atualizado com sucesso.',
      campus: respostaCampus(atualizado.rows[0])
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ erro: 'Ja existe campus com este nome ou sigla.' });
    }
    console.error('Erro ao atualizar campus:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao atualizar campus.' });
  }
});

module.exports = router;
