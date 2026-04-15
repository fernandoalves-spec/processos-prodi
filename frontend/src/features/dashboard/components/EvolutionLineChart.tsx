import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ProcessEvolutionSeries } from '../../../types/dashboard';

interface EvolutionLineChartProps {
  data: ProcessEvolutionSeries[];
}

export function EvolutionLineChart({ data }: EvolutionLineChartProps) {
  return (
    <section className="panel chart-panel">
      <div className="panel-title">
        <h3>Evolução Temporal</h3>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="periodo" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="iniciados" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="concluidos" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
