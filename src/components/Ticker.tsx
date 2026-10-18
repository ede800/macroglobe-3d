import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import type { Country, MacroMeta } from '../types';
import { COLORS, confidenceColor, fmt } from '../lib/metrics';

interface TickerProps {
  countries: Country[];
  meta: MacroMeta;
  onSelect: (iso3: string) => void;
}

const MAX_ITEMS = 60;

/** Bloomberg-style scrolling tape: largest economies with confidence, growth and today's news tone. */
export default function Ticker({ countries, meta, onSelect }: TickerProps) {
  const items = useMemo(() => [...countries].sort((a, b) => a.gdp_rank - b.gdp_rank).slice(0, MAX_ITEMS), [countries]);
  const duration = items.length * 2.6;

  const renderItems = (copy: number) =>
    items.map((c) => {
      const tone = c.sentiment.compound > 0.05 ? 'up' : c.sentiment.compound < -0.05 ? 'down' : 'flat';
      return (
        <button
          key={`${copy}-${c.iso3}`}
          onClick={() => onSelect(c.iso3)}
          tabIndex={copy === 0 ? 0 : -1}
          aria-hidden={copy === 1}
          className="flex shrink-0 items-center gap-2 px-4 font-mono text-[11px] text-terminal-sub transition hover:text-terminal-ink"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: confidenceColor(c.confidence.score) }} />
          <span className="font-semibold text-terminal-ink">{c.iso3}</span>
          <span className="tabular-nums">{fmt.num(c.confidence.score)}</span>
          <span className="tabular-nums text-terminal-muted">{fmt.pct(c.indicators.gdp_growth, true)}</span>
          <span
            className="text-[10px]"
            style={{ color: tone === 'up' ? COLORS.up : tone === 'down' ? COLORS.down : COLORS.muted }}
            title="Tonalité de l’actualité du jour"
          >
            {tone === 'up' ? '▲' : tone === 'down' ? '▼' : '■'}
          </span>
        </button>
      );
    });

  return (
    <div className="glass-panel absolute inset-x-0 bottom-0 z-20 flex h-10 items-center rounded-none border-x-0 border-b-0">
      <div className="flex h-full shrink-0 items-center gap-2 border-r border-terminal-line px-3 text-[10px] text-terminal-muted">
        <Radio size={13} className="animate-pulse text-terminal-accent" />
        <span className="hidden font-mono uppercase tracking-wider text-terminal-accent sm:inline">Live</span>
        <span className="hidden lg:inline">MAJ {fmt.date(meta.generated_at)}</span>
      </div>
      <div className="ticker-mask relative h-full flex-1 overflow-hidden">
        <div className="ticker-track flex h-full w-max items-center" style={{ animationDuration: `${duration}s` }}>
          {renderItems(0)}
          {renderItems(1)}
        </div>
      </div>
    </div>
  );
}
