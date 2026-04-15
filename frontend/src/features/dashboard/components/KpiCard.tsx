interface KpiCardProps {
  titulo: string;
  valor: string | number;
  icone?: string;
}

export function KpiCard({ titulo, valor, icone }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-title">
        <span>{titulo}</span>
        {icone ? <span aria-hidden="true">{icone}</span> : null}
      </div>
      <div className="kpi-value">{valor}</div>
      <small className="kpi-footnote">Pronto para exibir variação de período</small>
    </article>
  );
}
