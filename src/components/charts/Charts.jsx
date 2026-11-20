'use client';
// Charts load on demand: the chart library (recharts, ~100 kB) is only downloaded on pages that
// show a chart, after the page itself is on screen.
import dynamic from 'next/dynamic';

export { CHART, SERIES, LegendList, bucket } from './chartKit';

const Placeholder = () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-mist-50" aria-hidden="true" />;
const lazy = (name) => dynamic(() => import('./ChartsImpl').then((m) => m[name]), { ssr: false, loading: Placeholder });

export const AreaTrend = lazy('AreaTrend');
export const Bars = lazy('Bars');
export const Lines = lazy('Lines');
export const Donut = lazy('Donut');
