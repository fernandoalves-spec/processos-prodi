const pool = require('../db');

const STATUS_CONCLUIDOS = new Set(['concluido', 'finalizado']);
const STATUS_INATIVOS = new Set(['concluido', 'finalizado', 'cancelado', 'arquivado']);

function toDate(value) {
  if (!value) return null;
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatPeriodoMes(data) {
  return data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function normalizarTexto(value, fallback = 'Nao informado') {
  const text = String(value || '').trim();
  return text || fallback;
}

function getAbertura(row) {
  return toDate(row.data_recebimento || row.criado_em);
}

function getConclusao(row) {
  const status = normalizarTexto(row.status, '').toLowerCase();
  if (!STATUS_CONCLUIDOS.has(status)) return null;
  return toDate(row.atualizado_em || row.criado_em);
}

function getSlaDias(row) {
  const valor = row.prazo_dias_uteis ?? row.prazo_em_dias_uteis;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function getSetor(row) {
  return normalizarTexto(row.destino || row.origem);
}

function getCampus(row) {
  // Fallback atual: origem. Pode migrar para coluna campus quando existir.
  return normalizarTexto(row.origem);
}

function getTipo(row) {
  return normalizarTexto(row.faixa_2 || row.faixa);
}

function getResponsavel(row) {
  return normalizarTexto(row.atualizado_por || row.criado_por);
}

function parseIntervaloDias(inicio, fim) {
  const ms = fim.getTime() - inicio.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function dentroDoPeriodo(data, filtros) {
  if (!data) return false;
  if (filtros.dataInicio && data < toDate(`${filtros.dataInicio}T00:00:00`)) return false;
  if (filtros.dataFim && data > toDate(`${filtros.dataFim}T23:59:59`)) return false;
  return true;
}

function aplicaFiltros(rows, filtros) {
  return rows.filter((row) => {
    const status = normalizarTexto(row.status, '');
    if (filtros.status && status !== filtros.status) return false;
    if (filtros.campus && getCampus(row) !== filtros.campus) return false;
    if (filtros.setor && getSetor(row) !== filtros.setor) return false;
    if (filtros.tipoProcesso && getTipo(row) !== filtros.tipoProcesso) return false;
    if (filtros.responsavel && getResponsavel(row) !== filtros.responsavel) return false;

    const abertura = getAbertura(row);
    if (!dentroDoPeriodo(abertura, filtros)) return false;
    return true;
  });
}

function calculaStatus(row, now) {
  const statusRaw = normalizarTexto(row.status, '').toLowerCase();
  const abertura = getAbertura(row);
  const slaDias = getSlaDias(row);

  if (STATUS_CONCLUIDOS.has(statusRaw)) return 'Concluido';
  if (statusRaw.includes('analise')) return 'Em analise';

  if (abertura && slaDias !== null) {
    const limite = new Date(abertura);
    limite.setDate(limite.getDate() + slaDias);
    if (limite < now) return 'Atrasado';
  }

  return 'Em andamento';
}

function montarSnapshot(rows, filtros) {
  const now = new Date();
  const total = rows.length || 1;

  const ativos = rows.filter((row) => !STATUS_INATIVOS.has(normalizarTexto(row.status, '').toLowerCase()));
  const concluidosPeriodo = rows.filter((row) => {
    const conclusao = getConclusao(row);
    return dentroDoPeriodo(conclusao, filtros);
  });

  const atrasados = ativos.filter((row) => calculaStatus(row, now) === 'Atrasado');

  const concluidosComSla = concluidosPeriodo.filter((row) => {
    const abertura = getAbertura(row);
    const conclusao = getConclusao(row);
    const slaDias = getSlaDias(row);
    if (!abertura || !conclusao || slaDias === null) return false;
    return true;
  });

  const dentroSla = concluidosComSla.filter((row) => {
    const abertura = getAbertura(row);
    const conclusao = getConclusao(row);
    const slaDias = getSlaDias(row);
    return parseIntervaloDias(abertura, conclusao) <= slaDias;
  }).length;

  const slaAderido = concluidosComSla.length ? Number(((dentroSla / concluidosComSla.length) * 100).toFixed(2)) : 0;

  const statusCount = new Map();
  rows.forEach((row) => {
    const nome = calculaStatus(row, now);
    statusCount.set(nome, (statusCount.get(nome) || 0) + 1);
  });
  const distribuicaoStatus = [...statusCount.entries()].map(([status, quantidade]) => ({
    status,
    quantidade,
    percentual: Number(((quantidade / total) * 100).toFixed(2))
  }));

  const tipoCount = new Map();
  rows.forEach((row) => {
    const tipo = getTipo(row);
    tipoCount.set(tipo, (tipoCount.get(tipo) || 0) + 1);
  });
  const distribuicaoTipos = [...tipoCount.entries()]
    .map(([tipo, quantidade]) => ({ tipo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const evolucaoMap = new Map();
  rows.forEach((row) => {
    const abertura = getAbertura(row);
    if (abertura) {
      const periodo = formatPeriodoMes(abertura);
      const atual = evolucaoMap.get(periodo) || { periodo, iniciados: 0, concluidos: 0 };
      atual.iniciados += 1;
      evolucaoMap.set(periodo, atual);
    }
    const conclusao = getConclusao(row);
    if (conclusao) {
      const periodo = formatPeriodoMes(conclusao);
      const atual = evolucaoMap.get(periodo) || { periodo, iniciados: 0, concluidos: 0 };
      atual.concluidos += 1;
      evolucaoMap.set(periodo, atual);
    }
  });
  const evolucao = [...evolucaoMap.values()];

  const tempoMedio = concluidosPeriodo.length
    ? concluidosPeriodo.reduce((acc, row) => {
        const abertura = getAbertura(row);
        const conclusao = getConclusao(row);
        if (!abertura || !conclusao) return acc;
        return acc + parseIntervaloDias(abertura, conclusao);
      }, 0) / concluidosPeriodo.length
    : 0;
  const pendenciasResolvidas = rows.length ? Number(((concluidosPeriodo.length / rows.length) * 100).toFixed(2)) : 0;
  const scoreTempo = Math.max(0, 100 - (tempoMedio / 20) * 100);
  const indiceEficiencia = Number((slaAderido * 0.45 + scoreTempo * 0.35 + pendenciasResolvidas * 0.2).toFixed(2));

  const semDestino = rows.filter((row) => !String(row.destino || '').trim()).length;

  const pendenciasCriticas = [
    { id: 'pc1', titulo: 'Processos atrasados', quantidade: atrasados.length, severidade: 'alta', prioridade: 1 },
    { id: 'pc2', titulo: 'Processos sem destino definido', quantidade: semDestino, severidade: 'media', prioridade: 2 },
    {
      id: 'pc3',
      titulo: 'Processos em analise sem conclusao',
      quantidade: rows.filter((row) => calculaStatus(row, now) === 'Em analise').length,
      severidade: 'media',
      prioridade: 3
    }
  ];

  const tarefasPrioritarias = [
    { id: 'tp1', titulo: 'Revisao de politicas institucionais', status: 'em_andamento', responsavel: 'Gestao PRODI', prazo: null },
    { id: 'tp2', titulo: 'Auditoria interna de fluxos', status: 'nao_iniciada', responsavel: 'Comissao Interna', prazo: null },
    { id: 'tp3', titulo: 'Planejamento estrategico consolidado', status: 'concluida', responsavel: 'Coordenacao de Planejamento', prazo: null }
  ];

  return {
    filtrosAplicados: filtros,
    kpis: {
      processosAtivos: ativos.length,
      processosConcluidos: concluidosPeriodo.length,
      processosAtrasados: atrasados.length,
      slaAderido
    },
    distribuicaoStatus,
    distribuicaoTipos,
    eficiencia: {
      indice: indiceEficiencia,
      componentes: {
        slaNoPrazo: slaAderido,
        tempoMedio: Number(tempoMedio.toFixed(2)),
        pendenciasResolvidas
      }
    },
    evolucao,
    pendenciasCriticas,
    tarefasPrioritarias
  };
}

async function buscarRowsBase() {
  const resultado = await pool.query(
    `
      SELECT
        id,
        status,
        origem,
        destino,
        faixa,
        faixa_2,
        criado_por,
        atualizado_por,
        data_recebimento,
        criado_em,
        atualizado_em,
        prazo_dias_uteis,
        prazo_em_dias_uteis
      FROM processos
    `
  );
  return resultado.rows;
}

async function obterDashboardHome(filtros) {
  const rows = await buscarRowsBase();
  const filtrados = aplicaFiltros(rows, filtros);
  return montarSnapshot(filtrados, filtros);
}

async function obterDashboardHomeOptions() {
  const rows = await buscarRowsBase();
  const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b));
  return {
    campus: uniq(rows.map(getCampus)),
    setores: uniq(rows.map(getSetor)),
    tipos: uniq(rows.map(getTipo)),
    status: uniq(rows.map((row) => normalizarTexto(row.status))),
    responsaveis: uniq(rows.map(getResponsavel))
  };
}

module.exports = {
  obterDashboardHome,
  obterDashboardHomeOptions
};
