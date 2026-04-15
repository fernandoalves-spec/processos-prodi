import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ProcessTypeDistribution } from '../../../types/dashboard';

interface TypeBarChartProps {
  data: ProcessTypeDistribution[];
}

export function TypeBarChart({ data }: TypeBarChartProps) {
  return (
    <section className="panel chart-panel">
      <div className="panel-title">
        <h3>Tipos de Processos</h3>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="tipo" width={170} />
            <Tooltip />
            <Bar dataKey="quantidade" fill="#2563eb" radius={[0, 8, 8, 0]}>
              <LabelList dataKey="quantidade" position="right" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
