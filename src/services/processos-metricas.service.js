const pool = require('../db');

const STATUS_CONCLUIDOS = ['Concluido', 'Finalizado'];

function normalizarDataFiltro(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto;
}

/**
 * Retorna indicadores operacionais de processos.
 * A query usa fallback de colunas para manter compatibilidade com dados legados:
 * - data_abertura -> data_recebimento -> criado_em
 * - data_conclusao -> atualizado_em (apenas para status concluido/finalizado)
 * - sla_dias -> prazo_dias_uteis -> prazo_em_dias_uteis
 * - setor_atual -> destino -> origem
 */
async function obterMetricasOperacionais({ dataInicio, dataFim } = {}) {
  const inicio = normalizarDataFiltro(dataInicio);
  const fim = normalizarDataFiltro(dataFim);

  if ((dataInicio && !inicio) || (dataFim && !fim)) {
    const error = new Error('dataInicio e dataFim devem estar no formato YYYY-MM-DD.');
    error.statusCode = 400;
    throw error;
  }

  if (inicio && fim && inicio > fim) {
    const error = new Error('dataInicio nao pode ser maior que dataFim.');
    error.statusCode = 400;
    throw error;
  }

  const resultado = await pool.query(
    `
      WITH normalizado AS (
        SELECT
          p.id,
          COALESCE(NULLIF(TRIM(p.status), ''), 'Sem status') AS status,
          COALESCE(NULLIF(TRIM(p.setor_atual), ''), NULLIF(TRIM(p.destino), ''), NULLIF(TRIM(p.origem), ''), 'Nao informado') AS setor_atual_calc,
          COALESCE(p.data_abertura::timestamp, p.data_recebimento::timestamp, p.criado_em) AS data_abertura_calc,
          CASE
            WHEN COALESCE(NULLIF(TRIM(p.status), ''), '') ILIKE ANY($1::text[])
              THEN COALESCE(p.data_conclusao::timestamp, p.atualizado_em)
            ELSE p.data_conclusao::timestamp
          END AS data_conclusao_calc,
          COALESCE(p.sla_dias, p.prazo_dias_uteis, p.prazo_em_dias_uteis) AS sla_dias_calc
        FROM processos p
        WHERE ($2::date IS NULL OR COALESCE(p.data_abertura::date, p.data_recebimento::date, p.criado_em::date) >= $2::date)
          AND ($3::date IS NULL OR COALESCE(p.data_abertura::date, p.data_recebimento::date, p.criado_em::date) <= $3::date)
      ),
      ativos AS (
        SELECT *
        FROM normalizado
        WHERE NOT (status ILIKE ANY($1::text[]))
      ),
      backlog AS (
        SELECT setor_atual_calc AS setor, COUNT(*)::int AS quantidade
        FROM ativos
        GROUP BY setor_atual_calc
        ORDER BY quantidade DESC, setor_atual_calc
      ),
      concluidos AS (
        SELECT
          *,
          EXTRACT(EPOCH FROM (data_conclusao_calc - data_abertura_calc)) / 86400.0 AS lead_time_dias
        FROM normalizado
        WHERE status ILIKE ANY($1::text[])
          AND data_abertura_calc IS NOT NULL
          AND data_conclusao_calc IS NOT NULL
          AND data_conclusao_calc >= data_abertura_calc
      ),
      sla_base AS (
        SELECT *
        FROM concluidos
        WHERE sla_dias_calc IS NOT NULL
          AND sla_dias_calc >= 0
      ),
      sla AS (
        SELECT
          COUNT(*)::int AS total_avaliado,
          COUNT(*) FILTER (WHERE lead_time_dias <= sla_dias_calc)::int AS dentro_sla
        FROM sla_base
      )
      SELECT jsonb_build_object(
        'filtrosAplicados', jsonb_build_object(
          'dataInicio', $2::date,
          'dataFim', $3::date
        ),
        'wip', jsonb_build_object(
          'processosAtivos', (SELECT COUNT(*)::int FROM ativos),
          'backlogPorSetor', COALESCE((SELECT jsonb_agg(jsonb_build_object('setor', b.setor, 'quantidade', b.quantidade)) FROM backlog b), '[]'::jsonb)
        ),
        'tempoVelocidade', jsonb_build_object(
          'leadTimeMedioDias', ROUND(COALESCE((SELECT AVG(lead_time_dias) FROM concluidos), 0)::numeric, 2),
          'totalConcluidosConsiderados', (SELECT COUNT(*)::int FROM concluidos),
          'taxaCumprimentoSla', CASE
            WHEN (SELECT total_avaliado FROM sla) > 0
              THEN ROUND((((SELECT dentro_sla FROM sla)::numeric / (SELECT total_avaliado FROM sla)::numeric) * 100), 2)
            ELSE 0
          END,
          'totalSlaAvaliado', (SELECT total_avaliado FROM sla),
          'totalDentroSla', (SELECT dentro_sla FROM sla)
        )
      ) AS payload
    `,
    [STATUS_CONCLUIDOS.map((status) => status.toLowerCase()), inicio, fim]
  );

  return resultado.rows[0]?.payload || {
    filtrosAplicados: { dataInicio: inicio, dataFim: fim },
    wip: { processosAtivos: 0, backlogPorSetor: [] },
    tempoVelocidade: {
      leadTimeMedioDias: 0,
      totalConcluidosConsiderados: 0,
      taxaCumprimentoSla: 0,
      totalSlaAvaliado: 0,
      totalDentroSla: 0
    }
  };
}

module.exports = {
  obterMetricasOperacionais
};
