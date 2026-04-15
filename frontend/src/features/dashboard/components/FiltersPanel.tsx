import { DashboardFilters } from '../../../types/dashboard';

interface FilterOptions {
  campus: string[];
  setores: string[];
  tipos: string[];
  status: string[];
  responsaveis: string[];
}

interface FiltersPanelProps {
  filtros: DashboardFilters;
  options: FilterOptions;
  onChange: (next: DashboardFilters) => void;
}

export function FiltersPanel({ filtros, options, onChange }: FiltersPanelProps) {
  const update = (field: keyof DashboardFilters, value: string) => {
    onChange({ ...filtros, [field]: value || undefined });
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Filtros Globais</h2>
        <span>Aplicados a todos os indicadores</span>
      </div>
      <div className="filters-grid">
        <label>
          Período início
          <input type="date" value={filtros.dataInicio || ''} onChange={(e) => update('dataInicio', e.target.value)} />
        </label>
        <label>
          Período fim
          <input type="date" value={filtros.dataFim || ''} onChange={(e) => update('dataFim', e.target.value)} />
        </label>
        <label>
          Campus
          <select value={filtros.campus || ''} onChange={(e) => update('campus', e.target.value)}>
            <option value="">Todos</option>
            {options.campus.map((campus) => (
              <option key={campus} value={campus}>
                {campus}
              </option>
            ))}
          </select>
        </label>
        <label>
          Setor
          <select value={filtros.setor || ''} onChange={(e) => update('setor', e.target.value)}>
            <option value="">Todos</option>
            {options.setores.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de processo
          <select value={filtros.tipoProcesso || ''} onChange={(e) => update('tipoProcesso', e.target.value)}>
            <option value="">Todos</option>
            {options.tipos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={filtros.status || ''} onChange={(e) => update('status', e.target.value)}>
            <option value="">Todos</option>
            {options.status.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsável
          <select value={filtros.responsavel || ''} onChange={(e) => update('responsavel', e.target.value)}>
            <option value="">Todos</option>
            {options.responsaveis.map((responsavel) => (
              <option key={responsavel} value={responsavel}>
                {responsavel}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
