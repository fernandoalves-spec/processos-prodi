import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { EfficiencySnapshot } from '../../../types/dashboard';

interface EfficiencyGaugeProps {
  data: EfficiencySnapshot;
}

export function EfficiencyGauge({ data }: EfficiencyGaugeProps) {
  return (
    <section className="panel">
      <div className="panel-title">
        <h3>Indicador de Eficiência</h3>
      </div>
      <div className="gauge-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <RadialBarChart
            innerRadius="60%"
            outerRadius="100%"
            data={[{ name: 'Índice', value: data.indice }]}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar dataKey="value" cornerRadius={8} fill="#16a34a" />
          </RadialBarChart>
        </ResponsiveContainer>
        <strong className="gauge-value">{data.indice.toFixed(1)}%</strong>
      </div>
      <div className="efficiency-breakdown">
        <span>SLA no prazo: {data.componentes.slaNoPrazo.toFixed(1)}%</span>
        <span>Tempo médio: {data.componentes.tempoMedio.toFixed(1)} dias</span>
        <span>Pendências resolvidas: {data.componentes.pendenciasResolvidas.toFixed(1)}%</span>
      </div>
    </section>
  );
}
