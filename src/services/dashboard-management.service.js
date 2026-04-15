const pool = require('../db');

const SEVERIDADES = new Set(['alta', 'media', 'baixa']);
const STATUS_TAREFA = new Set(['nao_iniciada', 'em_andamento', 'concluida']);

function normalizarTexto(value) {
  return String(value || '').trim();
}

function parseInteiro(value, campo, min = 0) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    const error = new Error(`${campo} invalido.`);
    error.statusCode = 400;
    throw error;
  }
  return n;
}

function parseData(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const error = new Error('prazo deve estar no formato YYYY-MM-DD.');
    error.statusCode = 400;
    throw error;
  }
  return text;
}

async function listarPendenciasCriticas() {
  const resultado = await pool.query(
    `
      SELECT id, titulo, quantidade, severidade, prioridade, criado_em, atualizado_em
      FROM pendencias_criticas
      WHERE ativo = TRUE
      ORDER BY prioridade ASC, id ASC
    `
  );
  return resultado.rows;
}

async function criarPendenciaCritica(input) {
  const titulo = normalizarTexto(input.titulo);
  const severidade = normalizarTexto(input.severidade || 'media').toLowerCase();
  const quantidade = input.quantidade === undefined || input.quantidade === null || input.quantidade === ''
    ? null
    : parseInteiro(input.quantidade, 'quantidade', 0);
  const prioridade = parseInteiro(input.prioridade ?? 1, 'prioridade', 1);

  if (!titulo) {
    const error = new Error('titulo e obrigatorio.');
    error.statusCode = 400;
    throw error;
  }
  if (!SEVERIDADES.has(severidade)) {
    const error = new Error('severidade deve ser alta, media ou baixa.');
    error.statusCode = 400;
    throw error;
  }

  const resultado = await pool.query(
    `
      INSERT INTO pendencias_criticas (titulo, quantidade, severidade, prioridade, ativo, atualizado_em)
      VALUES ($1, $2, $3, $4, TRUE, NOW())
      RETURNING id, titulo, quantidade, severidade, prioridade, criado_em, atualizado_em
    `,
    [titulo, quantidade, severidade, prioridade]
  );
  return resultado.rows[0];
}

async function atualizarPendenciaCritica(id, input) {
  const pendenciaId = parseInteiro(id, 'id', 1);
  const atual = await pool.query(
    `
      SELECT id, titulo, quantidade, severidade, prioridade
      FROM pendencias_criticas
      WHERE id = $1 AND ativo = TRUE
    `,
    [pendenciaId]
  );
  if (!atual.rowCount) {
    const error = new Error('pendencia nao encontrada.');
    error.statusCode = 404;
    throw error;
  }

  const base = atual.rows[0];
  const titulo = input.titulo !== undefined ? normalizarTexto(input.titulo) : base.titulo;
  const severidade = input.severidade !== undefined ? normalizarTexto(input.severidade).toLowerCase() : base.severidade;
  const quantidade = input.quantidade !== undefined
    ? (input.quantidade === null || input.quantidade === '' ? null : parseInteiro(input.quantidade, 'quantidade', 0))
    : base.quantidade;
  const prioridade = input.prioridade !== undefined ? parseInteiro(input.prioridade, 'prioridade', 1) : base.prioridade;

  if (!titulo) {
    const error = new Error('titulo e obrigatorio.');
    error.statusCode = 400;
    throw error;
  }
  if (!SEVERIDADES.has(severidade)) {
    const error = new Error('severidade deve ser alta, media ou baixa.');
    error.statusCode = 400;
    throw error;
  }

  const resultado = await pool.query(
    `
      UPDATE pendencias_criticas
      SET titulo = $1,
          quantidade = $2,
          severidade = $3,
          prioridade = $4,
          atualizado_em = NOW()
      WHERE id = $5
      RETURNING id, titulo, quantidade, severidade, prioridade, criado_em, atualizado_em
    `,
    [titulo, quantidade, severidade, prioridade, pendenciaId]
  );
  return resultado.rows[0];
}

async function removerPendenciaCritica(id) {
  const pendenciaId = parseInteiro(id, 'id', 1);
  const resultado = await pool.query(
    `
      UPDATE pendencias_criticas
      SET ativo = FALSE,
          atualizado_em = NOW()
      WHERE id = $1 AND ativo = TRUE
      RETURNING id
    `,
    [pendenciaId]
  );
  if (!resultado.rowCount) {
    const error = new Error('pendencia nao encontrada.');
    error.statusCode = 404;
    throw error;
  }
}

async function listarTarefasPrioritarias() {
  const resultado = await pool.query(
    `
      SELECT id, titulo, status, responsavel, prazo, prioridade, criado_em, atualizado_em
      FROM tarefas_prioritarias
      WHERE ativo = TRUE
      ORDER BY prioridade ASC, id ASC
    `
  );
  return resultado.rows;
}

async function criarTarefaPrioritaria(input) {
  const titulo = normalizarTexto(input.titulo);
  const status = normalizarTexto(input.status || 'nao_iniciada').toLowerCase();
  const responsavel = normalizarTexto(input.responsavel) || null;
  const prazo = parseData(input.prazo);
  const prioridade = parseInteiro(input.prioridade ?? 1, 'prioridade', 1);

  if (!titulo) {
    const error = new Error('titulo e obrigatorio.');
    error.statusCode = 400;
    throw error;
  }
  if (!STATUS_TAREFA.has(status)) {
    const error = new Error('status deve ser nao_iniciada, em_andamento ou concluida.');
    error.statusCode = 400;
    throw error;
  }

  const resultado = await pool.query(
    `
      INSERT INTO tarefas_prioritarias (titulo, status, responsavel, prazo, prioridade, ativo, atualizado_em)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      RETURNING id, titulo, status, responsavel, prazo, prioridade, criado_em, atualizado_em
    `,
    [titulo, status, responsavel, prazo, prioridade]
  );
  return resultado.rows[0];
}

async function atualizarTarefaPrioritaria(id, input) {
  const tarefaId = parseInteiro(id, 'id', 1);
  const atual = await pool.query(
    `
      SELECT id, titulo, status, responsavel, prazo, prioridade
      FROM tarefas_prioritarias
      WHERE id = $1 AND ativo = TRUE
    `,
    [tarefaId]
  );
  if (!atual.rowCount) {
    const error = new Error('tarefa nao encontrada.');
    error.statusCode = 404;
    throw error;
  }
  const base = atual.rows[0];

  const titulo = input.titulo !== undefined ? normalizarTexto(input.titulo) : base.titulo;
  const status = input.status !== undefined ? normalizarTexto(input.status).toLowerCase() : base.status;
  const responsavel = input.responsavel !== undefined ? (normalizarTexto(input.responsavel) || null) : base.responsavel;
  const prazo = input.prazo !== undefined ? parseData(input.prazo) : base.prazo;
  const prioridade = input.prioridade !== undefined ? parseInteiro(input.prioridade, 'prioridade', 1) : base.prioridade;

  if (!titulo) {
    const error = new Error('titulo e obrigatorio.');
    error.statusCode = 400;
    throw error;
  }
  if (!STATUS_TAREFA.has(status)) {
    const error = new Error('status deve ser nao_iniciada, em_andamento ou concluida.');
    error.statusCode = 400;
    throw error;
  }

  const resultado = await pool.query(
    `
      UPDATE tarefas_prioritarias
      SET titulo = $1,
          status = $2,
          responsavel = $3,
          prazo = $4,
          prioridade = $5,
          atualizado_em = NOW()
      WHERE id = $6
      RETURNING id, titulo, status, responsavel, prazo, prioridade, criado_em, atualizado_em
    `,
    [titulo, status, responsavel, prazo, prioridade, tarefaId]
  );
  return resultado.rows[0];
}

async function removerTarefaPrioritaria(id) {
  const tarefaId = parseInteiro(id, 'id', 1);
  const resultado = await pool.query(
    `
      UPDATE tarefas_prioritarias
      SET ativo = FALSE,
          atualizado_em = NOW()
      WHERE id = $1 AND ativo = TRUE
      RETURNING id
    `,
    [tarefaId]
  );
  if (!resultado.rowCount) {
    const error = new Error('tarefa nao encontrada.');
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  listarPendenciasCriticas,
  criarPendenciaCritica,
  atualizarPendenciaCritica,
  removerPendenciaCritica,
  listarTarefasPrioritarias,
  criarTarefaPrioritaria,
  atualizarTarefaPrioritaria,
  removerTarefaPrioritaria
};
