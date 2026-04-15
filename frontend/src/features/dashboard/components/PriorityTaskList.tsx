import { PriorityTaskItem } from '../../../types/dashboard';

interface PriorityTaskListProps {
  data: PriorityTaskItem[];
}

function mapStatus(status: PriorityTaskItem['status']) {
  if (status === 'nao_iniciada') return 'Não iniciada';
  if (status === 'em_andamento') return 'Em andamento';
  return 'Concluída';
}

export function PriorityTaskList({ data }: PriorityTaskListProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h3>Tarefas Prioritárias</h3>
      </div>
      <ul className="list">
        {data.map((task) => (
          <li key={task.id} className="list-item">
            <div>
              <strong>{task.titulo}</strong>
              <small>
                {mapStatus(task.status)}
                {task.responsavel ? ` · ${task.responsavel}` : ''}
                {task.prazo ? ` · prazo ${task.prazo}` : ''}
              </small>
            </div>
            <span className={`badge status-${task.status}`}>{mapStatus(task.status)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
