const express = require('express');
const pool = require('../db');
const { exigirAutenticacao } = require('../middleware/auth');

const router = express.Router();

router.get('/', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, nome, descricao FROM perfis ORDER BY nome');
    res.json(resultado.rows);
  } catch (error) {
    console.error('Erro ao listar perfis:', error.message);
    res.status(500).json({ erro: 'Erro interno ao listar perfis.' });
  }
});

module.exports = router;
