'use client';

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export interface TrendPoint {
  date: string;
  criadas: number;
  concluidas: number;
}

const SERIES = [
  { key: 'criadas' as const, label: 'Criadas', color: '#2E7DFF' },
  { key: 'concluidas' as const, label: 'Concluídas', color: '#22C55E' },
];

/**
 * Série temporal de tarefas.
 * Cores vêm dos tokens da marca; o eixo Y começa em zero e usa números
 * inteiros — contagem fracionária de tarefa não existe e enganaria a leitura.
 */
export function TaskTrendChart({ data }: { data: TrendPoint[] }) {
  const formatted = data.map((point) => ({
    ...point,
    label: new Date(`${point.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  const hasData = data.some((point) => point.criadas > 0 || point.concluidas > 0);

  if (!hasData) {
    return (
      <p className="py-16 text-center text-sm text-ink-faint">
        Ainda não há tarefas suficientes no período para montar o gráfico.
      </p>
    );
  }

  return (
    <>
      <div className="mb-3 flex gap-4">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="size-2 rounded-full" style={{ backgroundColor: series.color }} aria-hidden />
            {series.label}
          </span>
        ))}
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              {SERIES.map((series) => (
                <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={series.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid stroke="#1B2436" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#5B6B85', fontSize: 11 }}
              axisLine={{ stroke: '#1B2436' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#5B6B85', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: '#121B2E',
                border: '1px solid #1B2436',
                borderRadius: 12,
                fontSize: 12,
                color: '#F2F6FD',
              }}
              labelStyle={{ color: '#B8C4D9' }}
            />

            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                fill={`url(#fill-${series.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
