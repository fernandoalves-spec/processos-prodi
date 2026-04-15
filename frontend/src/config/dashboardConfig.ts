import { EfficiencyConfig } from '../types/dashboard';

export const dashboardConfig: EfficiencyConfig = {
  pesoSlaNoPrazo: 0.45,
  pesoTempoMedio: 0.35,
  pesoPendenciasResolvidas: 0.2,
  metaTempoDias: 20
};

export const statusMapParaGrafico = ['Em andamento', 'Concluído', 'Atrasado', 'Em análise'];

export const tiposPadraoOrdenacao = [
  'Planejamento Institucional',
  'Obras e Engenharia',
  'Desenvolvimento Institucional',
  'Gestão do Conhecimento',
  'Contratos e Licitações',
  'Projetos Estratégicos'
];
