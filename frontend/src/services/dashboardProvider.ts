import { DashboardFilters, DashboardSnapshot } from '../types/dashboard';
import { aplicarFiltros, construirSnapshot } from '../mappers/dashboardMappers';
import { mockProcessos } from './mock/mockProcessos';

export interface DashboardDataProvider {
  getDashboardSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot>;
  getFilterOptions(): Promise<{
    campus: string[];
    setores: string[];
    tipos: string[];
    status: string[];
    responsaveis: string[];
  }>;
}

class MockDataProvider implements DashboardDataProvider {
  async getDashboardSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot> {
    const filtrados = aplicarFiltros(mockProcessos, filters);
    return construirSnapshot(filtrados, filters);
  }

  async getFilterOptions() {
    const uniq = <T,>(arr: T[]) => [...new Set(arr)];
    return {
      campus: uniq(mockProcessos.map((p) => p.campus)).sort(),
      setores: uniq(mockProcessos.map((p) => p.setorAtual)).sort(),
      tipos: uniq(mockProcessos.map((p) => p.tipoProcesso)).sort(),
      status: uniq(mockProcessos.map((p) => p.status)).sort(),
      responsaveis: uniq(mockProcessos.map((p) => p.responsavel)).sort()
    };
  }
}

class ApiDataProvider implements DashboardDataProvider {
  async getDashboardSnapshot(filters: DashboardFilters): Promise<DashboardSnapshot> {
    const params = new URLSearchParams();
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio);
    if (filters.dataFim) params.set('dataFim', filters.dataFim);
    if (filters.campus) params.set('campus', filters.campus);
    if (filters.setor) params.set('setor', filters.setor);
    if (filters.tipoProcesso) params.set('tipoProcesso', filters.tipoProcesso);
    if (filters.status) params.set('status', filters.status);
    if (filters.responsavel) params.set('responsavel', filters.responsavel);

    const url = params.toString() ? `/api/dashboard/home?${params.toString()}` : '/api/dashboard/home';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Falha ao carregar snapshot do dashboard.');
    }
    return response.json();
  }

  async getFilterOptions() {
    const response = await fetch('/api/dashboard/home/options');
    if (!response.ok) {
      throw new Error('Falha ao carregar opcoes de filtro.');
    }
    return response.json();
  }
}

export function createDashboardProvider(mode: 'mock' | 'api' = 'api'): DashboardDataProvider {
  if (mode === 'api') return new ApiDataProvider();
  return new MockDataProvider();
}
