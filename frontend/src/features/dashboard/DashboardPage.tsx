import { useEffect, useMemo, useState } from 'react';
import { FiltersPanel } from './components/FiltersPanel';
import { KpiCard } from './components/KpiCard';
import { StatusDonutChart } from './components/StatusDonutChart';
import { TypeBarChart } from './components/TypeBarChart';
import { EfficiencyGauge } from './components/EfficiencyGauge';
import { EvolutionLineChart } from './components/EvolutionLineChart';
import { CriticalPendingList } from './components/CriticalPendingList';
import { PriorityTaskList } from './components/PriorityTaskList';
import { createDashboardProvider } from '../../services/dashboardProvider';
import { DashboardFilters, DashboardSnapshot } from '../../types/dashboard';

const provider = createDashboardProvider('mock');

const snapshotVazio: DashboardSnapshot = {
  filtrosAplicados: {},
  kpis: { processosAtivos: 0, processosConcluidos: 0, processosAtrasados: 0, slaAderido: 0 },
  distribuicaoStatus: [],
  distribuicaoTipos: [],
  eficiencia: { indice: 0, componentes: { slaNoPrazo: 0, tempoMedio: 0, pendenciasResolvidas: 0 } },
  evolucao: [],
  pendenciasCriticas: [],
  tarefasPrioritarias: []
};

export function DashboardPage() {
  const [filtros, setFiltros] = useState<DashboardFilters>({});
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(snapshotVazio);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [options, setOptions] = useState({
    campus: [] as string[],
    setores: [] as string[],
    tipos: [] as string[],
    status: [] as string[],
    responsaveis: [] as string[]
  });

  useEffect(() => {
    provider.getFilterOptions().then(setOptions).catch(() => setOptions({ campus: [], setores: [], tipos: [], status: [], responsaveis: [] }));
  }, []);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    provider
      .getDashboardSnapshot(filtros)
      .then((data) => setSnapshot(data))
      .catch(() => setErro('Não foi possível carregar os dados do dashboard.'))
      .finally(() => setLoading(false));
  }, [filtros]);

  const kpiData = useMemo(
    () => [
      { titulo: 'Processos Ativos', valor: snapshot.kpis.processosAtivos, icone: '📌' },
      { titulo: 'Processos Concluídos', valor: snapshot.kpis.processosConcluidos, icone: '✅' },
      { titulo: 'Processos Atrasados', valor: snapshot.kpis.processosAtrasados, icone: '⚠️' },
      { titulo: 'SLA Aderido', valor: `${snapshot.kpis.slaAderido.toFixed(2)}%`, icone: '⏱️' }
    ],
    [snapshot]
  );

  return (
    <>
      <FiltersPanel filtros={filtros} options={options} onChange={setFiltros} />

      {erro ? <div className="error">{erro}</div> : null}
      {loading ? <div className="loading-inline">Atualizando indicadores...</div> : null}

      <section className="kpi-grid">
        {kpiData.map((item) => (
          <KpiCard key={item.titulo} titulo={item.titulo} valor={item.valor} icone={item.icone} />
        ))}
      </section>

      <section className="grid-2">
        <StatusDonutChart data={snapshot.distribuicaoStatus} />
        <TypeBarChart data={snapshot.distribuicaoTipos} />
      </section>

      <section className="grid-2">
        <EfficiencyGauge data={snapshot.eficiencia} />
        <EvolutionLineChart data={snapshot.evolucao} />
      </section>

      <section className="grid-2">
        <CriticalPendingList data={snapshot.pendenciasCriticas} />
        <PriorityTaskList data={snapshot.tarefasPrioritarias} />
      </section>
    </>
  );
}
