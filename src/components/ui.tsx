import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { COLORS, confidenceColor, confidenceTone, fmt } from '../lib/metrics';

export function Section({ title, icon, aside, children }: { title: string; icon?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-terminal-line px-5 py-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-sub">
          {icon}
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, title }: { label: string; value: string; sub?: ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-terminal-line bg-white/[0.03] px-3 py-2.5" title={title}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-terminal-muted">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold leading-tight text-terminal-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-terminal-muted">{sub}</div>}
    </div>
  );
}

const TONE_META = {
  down: { icon: TrendingDown, color: COLORS.down },
  neutral: { icon: Minus, color: COLORS.sub },
  up: { icon: TrendingUp, color: COLORS.up },
};

export function ToneBadge({ score, label }: { score: number; label: string }) {
  const tone = TONE_META[confidenceTone(score)];
  const Icon = tone.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-terminal-line bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-terminal-ink">
      <Icon size={13} color={tone.color} strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}

/** Semi-circular 0-100 gauge with the three confidence zones. */
export function ConfidenceGauge({ score, size = 200 }: { score: number; size?: number }) {
  const w = size;
  const h = size * 0.58;
  const cx = w / 2;
  const cy = h - 6;
  const r = w / 2 - 24;
  const point = (v: number, radius = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = point(score, r - 16);
  const zones: [number, number, string][] = [
    [0, 39.4, COLORS.down],
    [40.6, 59.4, '#5a5a55'],
    [60.6, 100, COLORS.up],
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Indice de confiance ${fmt.num(score)} sur 100`}>
      <path d={arc(0, 100)} stroke="rgba(255,255,255,0.06)" strokeWidth={12} fill="none" strokeLinecap="round" />
      {zones.map(([a, b, color]) => (
        <path key={a} d={arc(a, b)} stroke={color} strokeOpacity={0.35} strokeWidth={12} fill="none" />
      ))}
      <path d={arc(0, Math.max(0.5, score))} stroke={confidenceColor(score)} strokeWidth={4} fill="none" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={COLORS.ink} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={COLORS.ink} />
      {[0, 40, 60, 100].map((v) => {
        const [tx, ty] = point(v, r + 10);
        return (
          <text key={v} x={tx} y={ty} fill={COLORS.muted} fontSize={9} textAnchor="middle" dominantBaseline="middle" className="font-mono">
            {v}
          </text>
        );
      })}
    </svg>
  );
}

/** Horizontal 0-max meter with an optional marker label. */
export function Meter({ value, max, color, label, valueLabel }: { value: number; max: number; color: string; label: string; valueLabel: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-terminal-sub">{label}</span>
        <span className="font-mono font-semibold text-terminal-ink">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md border border-terminal-line bg-[#0c1017f2] px-3 py-2 text-xs shadow-glass backdrop-blur">
      <div className="mb-1 font-mono font-semibold text-terminal-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-terminal-sub">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-mono text-terminal-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const AXIS_PROPS = {
  stroke: COLORS.axis,
  tick: { fill: COLORS.muted, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
};
