const express = require('express');
const pool = require('../db');
const { exigirAutenticacao, exigirMaster, exigirGestaoProcessos } = require('../middleware/auth');
const { normalizarTexto, validarOpcaoGut } = require('../utils/validators');
const { respostaProcesso } = require('../utils/formatters');

const router = express.Router();

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

const SELECT_PROCESSO_COMPLETO = `
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
`;

router.get('/', exigirAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query(
      `
        SELECT ${SELECT_PROCESSO_COMPLETO}
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

router.get('/fila-interna', exigirAutenticacao, async (req, res) => {
  const setorIdRaw = req.query.setorId;
  const setorId = setorIdRaw === undefined ? null : Number(setorIdRaw);

  if (setorIdRaw !== undefined && (!Number.isInteger(setorId) || setorId <= 0)) {
    return res.status(400).json({ erro: 'setorId invalido.' });
  }

  try {
    const lista = await pool.query(
      `
        SELECT ${SELECT_PROCESSO_COMPLETO}
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

router.post('/', exigirAutenticacao, async (req, res) => {
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

  const prazoNumerico =
    prazoDiasUteis === '' || prazoDiasUteis === null || prazoDiasUteis === undefined
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
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING
          id, status, precisa_resposta, data_recebimento, protocolo, link,
          origem, destino, prazo_dias_uteis, prazo_em_dias_uteis, assunto, observacao,
          gut_gravidade, gut_gravidade_pontos, gut_urgencia, gut_urgencia_pontos,
          gut_tendencia, gut_tendencia_pontos, gut_prioridade_final,
          setor_destino_id, distribuido_em, distribuido_por,
          criado_por, atualizado_por, criado_em, atualizado_em
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

router.put('/:id', exigirAutenticacao, async (req, res) => {
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

  const prazoNumerico =
    prazoDiasUteis === '' || prazoDiasUteis === null || prazoDiasUteis === undefined
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
          id, status, precisa_resposta, data_recebimento, protocolo, link,
          origem, destino, prazo_dias_uteis, prazo_em_dias_uteis, assunto, observacao,
          gut_gravidade, gut_gravidade_pontos, gut_urgencia, gut_urgencia_pontos,
          gut_tendencia, gut_tendencia_pontos, gut_prioridade_final,
          setor_destino_id, distribuido_em, distribuido_por,
          criado_por, atualizado_por, criado_em, atualizado_em
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

router.put('/:id/distribuicao-interna', exigirAutenticacao, exigirGestaoProcessos, async (req, res) => {
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
        SELECT ${SELECT_PROCESSO_COMPLETO}
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

router.put('/:id/gut', exigirAutenticacao, exigirMaster, async (req, res) => {
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
          id, status, precisa_resposta, data_recebimento, protocolo, link,
          origem, destino, prazo_dias_uteis, prazo_em_dias_uteis, assunto, observacao,
          gut_gravidade, gut_gravidade_pontos, gut_urgencia, gut_urgencia_pontos,
          gut_tendencia, gut_tendencia_pontos, gut_prioridade_final,
          setor_destino_id, distribuido_em, distribuido_por,
          criado_por, atualizado_por, criado_em, atualizado_em
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

module.exports = router;
