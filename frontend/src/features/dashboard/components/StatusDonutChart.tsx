import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { StatusDistribution } from '../../../types/dashboard';

const COLORS = ['#0ea5e9', '#16a34a', '#dc2626', '#f59e0b'];

interface StatusDonutChartProps {
  data: StatusDistribution[];
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  return (
    <section className="panel chart-panel">
      <div className="panel-title">
        <h3>Status dos Processos</h3>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="quantidade"
              nameKey="status"
              innerRadius={70}
              outerRadius={100}
              label={({ status, percentual }) => `${status} (${percentual}%)`}
            >
              {data.map((entry, index) => (
                <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value}`, 'Quantidade']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
