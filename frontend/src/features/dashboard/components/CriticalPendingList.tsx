import { CriticalPendingItem } from '../../../types/dashboard';

interface CriticalPendingListProps {
  data: CriticalPendingItem[];
}

export function CriticalPendingList({ data }: CriticalPendingListProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h3>Pendências Críticas</h3>
      </div>
      <ul className="list">
        {data.map((item) => (
          <li key={item.id} className={`list-item severity-${item.severidade}`}>
            <div>
              <strong>{item.titulo}</strong>
              <small>Prioridade {item.prioridade}</small>
            </div>
            {item.quantidade !== undefined ? <span className="badge">{item.quantidade}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
