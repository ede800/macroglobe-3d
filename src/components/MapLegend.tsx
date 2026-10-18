import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Country, FilterKey } from '../types';
import { FILTERS, flagUrl } from '../lib/metrics';

interface MapLegendProps {
  filter: FilterKey;
  countries: Country[];
  onSelect: (iso3: string) => void;
}

export default function MapLegend({ filter, countries, onSelect }: MapLegendProps) {
  const [showRanking, setShowRanking] = useState(true);
  const def = FILTERS[filter];
  const ranked = [...countries].sort((a, b) => def.value(b) - def.value(a));
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-3).reverse();

  return (
    <div className="glass-panel pointer-events-auto w-[280px] rounded-xl px-4 py-3 text-xs">
      <div className="font-semibold text-terminal-ink">{def.label}</div>
      <p className="mt-0.5 text-[11px] leading-snug text-terminal-muted">{def.description}</p>
      <div className="mt-3 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${def.legend.stops.join(', ')})` }} />
      <div className="relative mt-1 h-4 font-mono text-[10px] text-terminal-muted">
        {def.legend.ticks.map((t) => (
          <span
            key={t.label}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${t.at * 100}%`, transform: t.at === 0 ? 'none' : t.at === 1 ? 'translateX(-100%)' : undefined }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="text-[10px] text-terminal-muted">{def.legend.caption}</div>

      <button
        onClick={() => setShowRanking((v) => !v)}
        className="mt-3 flex w-full items-center justify-between border-t border-terminal-line pt-2 text-[11px] font-medium uppercase tracking-wider text-terminal-sub"
      >
        Classement
        {showRanking ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {showRanking && (
        <ol className="mt-1.5 space-y-0.5">
          {[...top.map((c, i) => ({ c, rank: i + 1 })), null, ...bottom.map((c, i) => ({ c, rank: ranked.length - i }))].map((row, i) =>
            row === null ? (
              <li key="sep" className="py-0.5 text-center text-terminal-muted">⋯</li>
            ) : (
              <li key={`${row.c.iso3}-${i}`}>
                <button onClick={() => onSelect(row.c.iso3)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.06]">
                  <span className="w-5 font-mono text-[10px] text-terminal-muted">{row.rank}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: def.color(row.c) }} />
                  <img src={flagUrl(row.c.iso2)} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
                  <span className="flex-1 truncate text-terminal-sub">{row.c.name_fr}</span>
                  <span className="font-mono text-[10px] text-terminal-ink">{def.format(row.c).split(' · ')[0]}</span>
                </button>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}
