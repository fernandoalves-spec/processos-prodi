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
  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    throw new Error('ApiDataProvider ainda nao implementado para a V1.');
  }

  async getFilterOptions() {
    throw new Error('ApiDataProvider ainda nao implementado para a V1.');
  }
}

export function createDashboardProvider(mode: 'mock' | 'api' = 'mock'): DashboardDataProvider {
  if (mode === 'api') return new ApiDataProvider();
  return new MockDataProvider();
}
