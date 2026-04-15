import { CriticalPendingItem, PriorityTaskItem, ProcessRecord } from '../../types/dashboard';

export const mockProcessos: ProcessRecord[] = [
  {
    id: '1',
    numeroProcesso: '23000.000001/2026-11',
    tipoProcesso: 'Planejamento Institucional',
    setorOrigem: 'PRODI',
    setorAtual: 'Coordenação de Planejamento',
    campus: 'Campo Grande',
    responsavel: 'Ana Souza',
    status: 'Em andamento',
    dataAbertura: '2026-01-08',
    prazoDias: 30,
    dataLimite: '2026-02-07',
    prioridade: 'alta'
  },
  {
    id: '2',
    numeroProcesso: '23000.000002/2026-14',
    tipoProcesso: 'Obras e Engenharia',
    setorOrigem: 'PRODI',
    setorAtual: 'Engenharia',
    campus: 'Dourados',
    responsavel: 'Carlos Lima',
    status: 'Concluído',
    dataAbertura: '2026-01-02',
    dataConclusao: '2026-01-19',
    prazoDias: 25,
    dataLimite: '2026-01-27',
    prioridade: 'media'
  },
  {
    id: '3',
    numeroProcesso: '23000.000003/2026-17',
    tipoProcesso: 'Contratos e Licitações',
    setorOrigem: 'PRODI',
    setorAtual: 'Licitações',
    campus: 'Três Lagoas',
    responsavel: 'Marina Alves',
    status: 'Em análise',
    dataAbertura: '2026-01-20',
    prazoDias: 20,
    dataLimite: '2026-02-09',
    prioridade: 'alta'
  },
  {
    id: '4',
    numeroProcesso: '23000.000004/2026-19',
    tipoProcesso: 'Projetos Estratégicos',
    setorOrigem: 'PRODI',
    setorAtual: 'Projetos',
    campus: 'Coxim',
    responsavel: 'Tiago Prado',
    status: 'Atrasado',
    dataAbertura: '2025-12-15',
    prazoDias: 18,
    dataLimite: '2026-01-02',
    prioridade: 'alta'
  },
  {
    id: '5',
    numeroProcesso: '23000.000005/2026-21',
    tipoProcesso: 'Gestão do Conhecimento',
    setorOrigem: 'PRODI',
    setorAtual: 'Desenvolvimento Institucional',
    campus: 'Campo Grande',
    responsavel: 'Rafaela Moura',
    status: 'Concluído',
    dataAbertura: '2026-02-02',
    dataConclusao: '2026-02-26',
    prazoDias: 20,
    dataLimite: '2026-02-22',
    prioridade: 'media'
  },
  {
    id: '6',
    numeroProcesso: '23000.000006/2026-29',
    tipoProcesso: 'Desenvolvimento Institucional',
    setorOrigem: 'PRODI',
    setorAtual: 'Desenvolvimento Institucional',
    campus: 'Nova Andradina',
    responsavel: 'Bianca Vieira',
    status: 'Em andamento',
    dataAbertura: '2026-03-01',
    prazoDias: 28,
    dataLimite: '2026-03-29',
    prioridade: 'baixa'
  },
  {
    id: '7',
    numeroProcesso: '23000.000007/2026-31',
    tipoProcesso: 'Planejamento Institucional',
    setorOrigem: 'PRODI',
    setorAtual: 'Coordenação de Planejamento',
    campus: 'Aquidauana',
    responsavel: 'Ana Souza',
    status: 'Concluído',
    dataAbertura: '2026-03-03',
    dataConclusao: '2026-03-20',
    prazoDias: 25,
    dataLimite: '2026-03-28',
    prioridade: 'media'
  },
  {
    id: '8',
    numeroProcesso: '23000.000008/2026-34',
    tipoProcesso: 'Obras e Engenharia',
    setorOrigem: 'PRODI',
    setorAtual: 'Engenharia',
    campus: 'Ponta Porã',
    responsavel: 'Carlos Lima',
    status: 'Em andamento',
    dataAbertura: '2026-03-10',
    prazoDias: 35,
    dataLimite: '2026-04-14',
    prioridade: 'alta'
  },
  {
    id: '9',
    numeroProcesso: '23000.000009/2026-39',
    tipoProcesso: 'Contratos e Licitações',
    setorOrigem: 'PRODI',
    setorAtual: 'Licitações',
    campus: 'Campo Grande',
    responsavel: 'Marina Alves',
    status: 'Concluído',
    dataAbertura: '2026-03-12',
    dataConclusao: '2026-04-03',
    prazoDias: 24,
    dataLimite: '2026-04-05',
    prioridade: 'alta'
  },
  {
    id: '10',
    numeroProcesso: '23000.000010/2026-41',
    tipoProcesso: 'Projetos Estratégicos',
    setorOrigem: 'PRODI',
    setorAtual: 'Projetos',
    campus: 'Dourados',
    responsavel: 'Tiago Prado',
    status: 'Em análise',
    dataAbertura: '2026-03-20',
    prazoDias: 21,
    dataLimite: '2026-04-10',
    prioridade: 'alta'
  }
];

export const mockPendencias: CriticalPendingItem[] = [
  { id: 'p1', titulo: 'Relatórios pendentes de validação', quantidade: 6, severidade: 'alta', prioridade: 1 },
  { id: 'p2', titulo: 'Contratos com prazo vencido', quantidade: 3, severidade: 'alta', prioridade: 2 },
  { id: 'p3', titulo: 'Orçamentos em análise sem parecer final', quantidade: 5, severidade: 'media', prioridade: 3 }
];

export const mockTarefasPrioritarias: PriorityTaskItem[] = [
  { id: 't1', titulo: 'Revisão de políticas institucionais', status: 'em_andamento', responsavel: 'Gestão PRODI', prazo: '2026-05-30' },
  { id: 't2', titulo: 'Auditoria interna de fluxos', status: 'nao_iniciada', responsavel: 'Comissão Interna', prazo: '2026-06-15' },
  { id: 't3', titulo: 'Consolidação do planejamento estratégico', status: 'concluida', responsavel: 'Coordenação de Planejamento', prazo: '2026-04-10' }
];
