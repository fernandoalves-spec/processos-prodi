const express = require('express');
const pool = require('../db');
const { exigirAutenticacao } = require('../middleware/auth');
const { validarDataISO, normalizarTexto, normalizarInteiro } = require('../utils/validators');
const { obterMetricasOperacionais } = require('../services/processos-metricas.service');
const { obterDashboardHome, obterDashboardHomeOptions } = require('../services/dashboard-home.service');
const {
  listarPendenciasCriticas,
  criarPendenciaCritica,
  atualizarPendenciaCritica,
  removerPendenciaCritica,
  listarTarefasPrioritarias,
  criarTarefaPrioritaria,
  atualizarTarefaPrioritaria,
  removerTarefaPrioritaria
} = require('../services/dashboard-management.service');

const router = express.Router();

router.get('/operacional', exigirAutenticacao, async (req, res) => {
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

router.get('/home/options', exigirAutenticacao, async (req, res) => {
  try {
    const payload = await obterDashboardHomeOptions();
    return res.json(payload);
  } catch (error) {
    console.error('Erro ao listar opcoes de filtros do dashboard home:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar opcoes de filtros.' });
  }
});

router.get('/home', exigirAutenticacao, async (req, res) => {
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

router.get('/home/pendencias', exigirAutenticacao, async (req, res) => {
  try {
    const lista = await listarPendenciasCriticas();
    return res.json(lista);
  } catch (error) {
    console.error('Erro ao listar pendencias criticas:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar pendencias criticas.' });
  }
});

router.post('/home/pendencias', exigirAutenticacao, async (req, res) => {
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

router.put('/home/pendencias/:id', exigirAutenticacao, async (req, res) => {
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

router.delete('/home/pendencias/:id', exigirAutenticacao, async (req, res) => {
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

router.get('/home/tarefas', exigirAutenticacao, async (req, res) => {
  try {
    const lista = await listarTarefasPrioritarias();
    return res.json(lista);
  } catch (error) {
    console.error('Erro ao listar tarefas prioritarias:', error.message);
    return res.status(500).json({ erro: 'Erro interno ao listar tarefas prioritarias.' });
  }
});

router.post('/home/tarefas', exigirAutenticacao, async (req, res) => {
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

router.put('/home/tarefas/:id', exigirAutenticacao, async (req, res) => {
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

router.delete('/home/tarefas/:id', exigirAutenticacao, async (req, res) => {
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

router.get('/gerencial', exigirAutenticacao, async (req, res) => {
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

module.exports = router;
