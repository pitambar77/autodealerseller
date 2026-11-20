import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num, tzsShort } from '../../utils/format';

import { CHART, SERIES } from './chartKit';

const axis = { stroke: CHART.text, fontSize: 12, tickLine: false, axisLine: false };

function Tip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-mist-200 bg-white px-3 py-2 text-[12.5px] shadow-lift">
      <p className="mb-1 font-semibold text-ink-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-mist-700 num">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink-900">{money ? tzsShort(p.value) : num(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const fmtTick = (money) => (v) => (money ? tzsShort(v).replace('TSh ', '') : num(v));

export function AreaTrend({ data, series, height = 260, money }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || SERIES[i]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color || SERIES[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="left" {...axis} width={52} tickFormatter={fmtTick(money)} />
        {series.some((s) => s.axis === 'right') && <YAxis yAxisId="right" orientation="right" {...axis} width={36} allowDecimals={false} />}
        <Tooltip content={<Tip money={money} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.text }} />}
        {series.map((s, i) => (
          <Area key={s.key} yAxisId={s.axis === 'right' ? 'right' : 'left'} type="monotone" dataKey={s.key} name={s.name} stroke={s.color || SERIES[i]} strokeWidth={2} fill={`url(#fill-${s.key})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, series, height = 260, stacked, money, layout = 'horizontal' }) {
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: vertical ? 8 : 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={CHART.grid} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...axis} tickFormatter={fmtTick(money)} />
            <YAxis type="category" dataKey="label" {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={48} tickFormatter={fmtTick(money)} />
          </>
        )}
        <Tooltip content={<Tip money={money} />} cursor={{ fill: 'var(--chart-cursor)' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.text }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId={stacked ? 'a' : undefined} fill={s.color || SERIES[i]} radius={stacked && i < series.length - 1 ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, series, height = 260, money }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={52} tickFormatter={fmtTick(money)} />
        <Tooltip content={<Tip money={money} />} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.text }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color || SERIES[i]} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 220, centerLabel, centerValue }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={d.color || SERIES[i % SERIES.length]} />
            ))}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue != null && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-ink-900 num">{centerValue}</span>
          <span className="text-[12px] text-mist-500">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

