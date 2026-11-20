// Chart colours and helpers that don't need the chart library (so pages load without it).
import { num } from '../../utils/format';

// Chart palette — accent first, then navy and supporting hues. Text always uses mist tokens.
export const CHART = {
  blue: 'var(--chart-blue)',
  navy: 'var(--chart-navy)',
  teal: '#1A9C8C',
  amber: '#D99412',
  rose: '#D2546B',
  grey: '#9AA6B8',
  grid: 'var(--chart-grid)',
  text: 'var(--chart-text)',
};
export const SERIES = [CHART.blue, CHART.navy, CHART.teal, CHART.amber, CHART.rose];

export function LegendList({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.label} className="flex items-center gap-2.5 text-[13px]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color || SERIES[i % SERIES.length] }} />
          <span className="flex-1 text-mist-700">{d.label}</span>
          <span className="font-semibold text-ink-900 num">{num(d.value)}</span>
          <span className="w-10 text-right text-mist-500 num">{Math.round((d.value / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Bucket ISO dates into the last `n` weeks or months for trend charts. */
export function bucket(items, { getDate, n = 8, unit = 'week', reducers }) {
  const now = new Date();
  const buckets = Array.from({ length: n }, (_, i) => {
    const back = n - 1 - i;
    let start;
    let end;
    if (unit === 'week') {
      end = new Date(now.getTime() - back * 7 * 864e5);
      start = new Date(end.getTime() - 7 * 864e5);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - back, 1);
      end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
      if (end > now) end = now;
    }
    const label = unit === 'week' ? end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : start.toLocaleDateString('en-GB', { month: 'short' });
    return { start, end, label };
  });
  return buckets.map((b) => {
    const inB = items.filter((it) => {
      const t = new Date(getDate(it));
      return t > b.start && t <= b.end;
    });
    const row = { label: b.label };
    Object.entries(reducers).forEach(([k, fn]) => (row[k] = fn(inB)));
    return row;
  });
}
