import { dashboardConfig, statusMapParaGrafico } from '../config/dashboardConfig';
import {
  DashboardFilters,
  DashboardSnapshot,
  ProcessRecord,
  ProcessTypeDistribution,
  StatusDistribution
} from '../types/dashboard';
import { mockPendencias, mockTarefasPrioritarias } from '../services/mock/mockProcessos';

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDentroDoPeriodo(value: string | undefined, filtros: DashboardFilters): boolean {
  if (!value) return false;
  const data = toDate(value);
  if (!data) return false;

  const inicio = toDate(filtros.dataInicio);
  const fim = toDate(filtros.dataFim);

  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  return true;
}

export function aplicarFiltros(processos: ProcessRecord[], filtros: DashboardFilters): ProcessRecord[] {
  return processos.filter((p) => {
    if (filtros.campus && p.campus !== filtros.campus) return false;
    if (filtros.setor && p.setorAtual !== filtros.setor) return false;
    if (filtros.tipoProcesso && p.tipoProcesso !== filtros.tipoProcesso) return false;
    if (filtros.status && p.status !== filtros.status) return false;
    if (filtros.responsavel && p.responsavel !== filtros.responsavel) return false;
    if (filtros.dataInicio || filtros.dataFim) {
      return isDentroDoPeriodo(p.dataAbertura, filtros);
    }
    return true;
  });
}

function calcularStatusDistribuicao(processos: ProcessRecord[]): StatusDistribution[] {
  const total = processos.length || 1;
  const atual = new Date();

  const contagem: Record<string, number> = {
    'Em andamento': 0,
    'Concluído': 0,
    'Atrasado': 0,
    'Em análise': 0
  };

  processos.forEach((p) => {
    if (p.status === 'Concluído') {
      contagem['Concluído'] += 1;
      return;
    }
    if (p.status === 'Em análise') {
      contagem['Em análise'] += 1;
      return;
    }

    const limite = toDate(p.dataLimite);
    if (limite && limite < atual) {
      contagem['Atrasado'] += 1;
      return;
    }

    contagem['Em andamento'] += 1;
  });

  return statusMapParaGrafico
    .map((status) => {
      const quantidade = contagem[status] || 0;
      return {
        status,
        quantidade,
        percentual: Number(((quantidade / total) * 100).toFixed(2))
      };
    })
    .filter((item) => item.quantidade > 0);
}

function calcularDistribuicaoTipos(processos: ProcessRecord[]): ProcessTypeDistribution[] {
  const map = new Map<string, number>();
  processos.forEach((p) => {
    map.set(p.tipoProcesso, (map.get(p.tipoProcesso) || 0) + 1);
  });
  return [...map.entries()]
    .map(([tipo, quantidade]) => ({ tipo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function calcularEvolucao(processos: ProcessRecord[]) {
  const evolucao = new Map<string, { iniciados: number; concluidos: number }>();
  processos.forEach((p) => {
    const abertura = new Date(`${p.dataAbertura}T00:00:00`);
    const chaveAbertura = abertura.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const atualAbertura = evolucao.get(chaveAbertura) || { iniciados: 0, concluidos: 0 };
    atualAbertura.iniciados += 1;
    evolucao.set(chaveAbertura, atualAbertura);

    if (p.dataConclusao) {
      const conclusao = new Date(`${p.dataConclusao}T00:00:00`);
      const chaveConclusao = conclusao.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      const atualConclusao = evolucao.get(chaveConclusao) || { iniciados: 0, concluidos: 0 };
      atualConclusao.concluidos += 1;
      evolucao.set(chaveConclusao, atualConclusao);
    }
  });

  return [...evolucao.entries()].map(([periodo, valores]) => ({
    periodo,
    iniciados: valores.iniciados,
    concluidos: valores.concluidos
  }));
}

function calcularIndicadorEficiencia(processos: ProcessRecord[]) {
  const concluidos = processos.filter((p) => p.status === 'Concluído' && p.dataConclusao);
  const now = new Date();

  const slaNoPrazo = concluidos.length
    ? (concluidos.filter((p) => {
        const limite = toDate(p.dataLimite);
        const fim = toDate(p.dataConclusao);
        return Boolean(limite && fim && fim <= limite);
      }).length / concluidos.length) * 100
    : 0;

  const tempoMedio = concluidos.length
    ? concluidos.reduce((acc, p) => {
        const ini = toDate(p.dataAbertura);
        const fim = toDate(p.dataConclusao);
        if (!ini || !fim) return acc;
        return acc + (fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / concluidos.length
    : dashboardConfig.metaTempoDias;

  const pendenciasResolvidas = processos.length
    ? (processos.filter((p) => p.status === 'Concluído').length / processos.length) * 100
    : 0;

  const scoreTempo = Math.max(0, 100 - (tempoMedio / dashboardConfig.metaTempoDias) * 100);

  const indice = Math.max(
    0,
    Math.min(
      100,
      slaNoPrazo * dashboardConfig.pesoSlaNoPrazo +
        scoreTempo * dashboardConfig.pesoTempoMedio +
        pendenciasResolvidas * dashboardConfig.pesoPendenciasResolvidas
    )
  );

  return {
    indice: Number(indice.toFixed(2)),
    componentes: {
      slaNoPrazo: Number(slaNoPrazo.toFixed(2)),
      tempoMedio: Number(tempoMedio.toFixed(2)),
      pendenciasResolvidas: Number(pendenciasResolvidas.toFixed(2))
    }
  };
}

export function construirSnapshot(processosFiltrados: ProcessRecord[], filtros: DashboardFilters): DashboardSnapshot {
  const agora = new Date();
  const concluidosNoPeriodo = processosFiltrados.filter(
    (p) => p.status === 'Concluído' && isDentroDoPeriodo(p.dataConclusao, filtros)
  );
  const ativos = processosFiltrados.filter(
    (p) => !['Concluído', 'Cancelado', 'Arquivado'].includes(p.status)
  );
  const atrasados = ativos.filter((p) => {
    const limite = toDate(p.dataLimite);
    return Boolean(limite && limite < agora);
  });
  const slaAderido = concluidosNoPeriodo.length
    ? (concluidosNoPeriodo.filter((p) => {
        const limite = toDate(p.dataLimite);
        const fim = toDate(p.dataConclusao);
        return Boolean(limite && fim && fim <= limite);
      }).length /
        concluidosNoPeriodo.length) *
      100
    : 0;

  return {
    filtrosAplicados: filtros,
    kpis: {
      processosAtivos: ativos.length,
      processosConcluidos: concluidosNoPeriodo.length,
      processosAtrasados: atrasados.length,
      slaAderido: Number(slaAderido.toFixed(2))
    },
    distribuicaoStatus: calcularStatusDistribuicao(processosFiltrados),
    distribuicaoTipos: calcularDistribuicaoTipos(processosFiltrados),
    eficiencia: calcularIndicadorEficiencia(processosFiltrados),
    evolucao: calcularEvolucao(processosFiltrados),
    pendenciasCriticas: [...mockPendencias].sort((a, b) => a.prioridade - b.prioridade),
    tarefasPrioritarias: mockTarefasPrioritarias
  };
}
