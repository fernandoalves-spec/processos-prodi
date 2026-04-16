import { DashboardFilters, DashboardSnapshot } from '../types/dashboard';

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

export function createDashboardProvider(): DashboardDataProvider {
  return new ApiDataProvider();
}
