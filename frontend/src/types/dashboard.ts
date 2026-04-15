export type TaskStatus = 'nao_iniciada' | 'em_andamento' | 'concluida';
export type CriticalSeverity = 'alta' | 'media' | 'baixa';

export interface DashboardFilters {
  dataInicio?: string;
  dataFim?: string;
  campus?: string;
  setor?: string;
  tipoProcesso?: string;
  status?: string;
  responsavel?: string;
}

export interface DashboardKpis {
  processosAtivos: number;
  processosConcluidos: number;
  processosAtrasados: number;
  slaAderido: number;
}

export interface StatusDistribution {
  status: string;
  quantidade: number;
  percentual: number;
}

export interface ProcessTypeDistribution {
  tipo: string;
  quantidade: number;
}

export interface EfficiencyConfig {
  pesoSlaNoPrazo: number;
  pesoTempoMedio: number;
  pesoPendenciasResolvidas: number;
  metaTempoDias: number;
}

export interface EfficiencySnapshot {
  indice: number;
  componentes: {
    slaNoPrazo: number;
    tempoMedio: number;
    pendenciasResolvidas: number;
  };
}

export interface ProcessEvolutionSeries {
  periodo: string;
  iniciados: number;
  concluidos: number;
}

export interface CriticalPendingItem {
  id: string;
  titulo: string;
  quantidade?: number;
  severidade: CriticalSeverity;
  prioridade: number;
}

export interface PriorityTaskItem {
  id: string;
  titulo: string;
  status: TaskStatus;
  responsavel?: string;
  prazo?: string;
}

export interface DashboardSnapshot {
  filtrosAplicados: DashboardFilters;
  kpis: DashboardKpis;
  distribuicaoStatus: StatusDistribution[];
  distribuicaoTipos: ProcessTypeDistribution[];
  eficiencia: EfficiencySnapshot;
  evolucao: ProcessEvolutionSeries[];
  pendenciasCriticas: CriticalPendingItem[];
  tarefasPrioritarias: PriorityTaskItem[];
}

export interface ProcessRecord {
  id: string;
  numeroProcesso: string;
  tipoProcesso: string;
  setorOrigem: string;
  setorAtual: string;
  campus: string;
  responsavel: string;
  status: string;
  dataAbertura: string;
  dataConclusao?: string;
  prazoDias: number;
  dataLimite: string;
  prioridade: 'alta' | 'media' | 'baixa';
}
