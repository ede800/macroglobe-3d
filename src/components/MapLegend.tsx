import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ListOrdered } from 'lucide-react';
import type { Country, FilterKey } from '../types';
import { FILTERS, flagUrl, rampColor } from '../lib/metrics';

interface MapLegendProps {
  filter: FilterKey;
  countries: Country[];
  onSelect: (iso3: string) => void;
}

const BINS = 24;

function RankRow({ c, rank, filter, onSelect }: { c: Country; rank: number; filter: FilterKey; onSelect: (iso3: string) => void }) {
  const def = FILTERS[filter];
  return (
    <li>
      <button onClick={() => onSelect(c.iso3)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.06]">
        <span className="w-6 font-mono text-[10px] tabular-nums text-terminal-muted">{rank}</span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: def.color(c) }} />
        <img src={flagUrl(c.iso2)} alt="" loading="lazy" className="h-3 w-[18px] rounded-[2px] object-cover" />
        <span className="flex-1 truncate text-terminal-sub">{c.name_fr}</span>
        <span className="font-mono text-[10px] tabular-nums text-terminal-ink">{def.compact(c)}</span>
      </button>
    </li>
  );
}

export default function MapLegend({ filter, countries, onSelect }: MapLegendProps) {
  const [showRanking, setShowRanking] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const def = FILTERS[filter];

  const withData = useMemo(() => countries.filter((c) => def.available(c)), [countries, def]);
  const ranked = useMemo(() => [...withData].sort((a, b) => def.value(b) - def.value(a)), [withData, def]);
  const missing = countries.length - withData.length;

  const bins = useMemo(() => {
    const counts = new Array<number>(BINS).fill(0);
    for (const c of withData) counts[Math.min(BINS - 1, Math.floor(def.position(c) * BINS))] += 1;
    return counts;
  }, [withData, def]);
  const maxBin = Math.max(1, ...bins);

  return (
    <div className="glass-panel pointer-events-auto w-[300px] rounded-xl px-4 py-3 text-xs">
      <div className="font-semibold text-terminal-ink">{def.label}</div>
      <p className="mt-0.5 text-[11px] leading-snug text-terminal-muted">{def.description}</p>

      <div className="mt-3 flex h-10 items-end gap-[2px]" role="img" aria-label={`Répartition des ${ranked.length} pays sur l’échelle`}>
        {bins.map((n, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[2px] transition-[height] duration-500"
            style={{ height: `${n ? Math.max(8, (n / maxBin) * 100) : 0}%`, background: rampColor(def.legend.stops, (i + 0.5) / BINS) }}
            title={`${n} pays`}
          />
        ))}
      </div>
      <div className="mt-[2px] h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${def.legend.stops.join(', ')})` }} />
      <div className="relative mt-1 h-4 font-mono text-[10px] text-terminal-muted">
        {def.legend.ticks.map((t) => (
          <span
            key={t.label}
            className="absolute whitespace-nowrap"
            style={{ left: `${t.at * 100}%`, transform: t.at === 0 ? 'none' : t.at === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-terminal-muted">
        <span>{def.legend.caption}</span>
        {missing > 0 && (
          <span className="flex shrink-0 items-center gap-1" title="Pays sans donnée publiée pour cet indicateur">
            <span className="h-2 w-2 rounded-sm bg-[#2a2f38] ring-1 ring-white/15" /> {missing} n.d.
          </span>
        )}
      </div>

      <button
        onClick={() => setShowRanking((v) => !v)}
        className="mt-3 flex w-full items-center justify-between border-t border-terminal-line pt-2 text-[11px] font-medium uppercase tracking-wider text-terminal-sub"
        aria-expanded={showRanking}
      >
        <span className="flex items-center gap-1.5">
          <ListOrdered size={13} /> Classement · {ranked.length} pays
        </span>
        {showRanking ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {showRanking && (
        <>
          {expanded ? (
            <ol className="mt-1.5 max-h-60 space-y-0.5 overflow-y-auto pr-1">
              {ranked.map((c, i) => (
                <RankRow key={c.iso3} c={c} rank={i + 1} filter={filter} onSelect={onSelect} />
              ))}
            </ol>
          ) : (
            <ol className="mt-1.5 space-y-0.5">
              {ranked.slice(0, 5).map((c, i) => (
                <RankRow key={c.iso3} c={c} rank={i + 1} filter={filter} onSelect={onSelect} />
              ))}
              <li className="py-0.5 text-center text-terminal-muted">⋯</li>
              {ranked
                .slice(-3)
                .map((c, i) => <RankRow key={c.iso3} c={c} rank={ranked.length - 2 + i} filter={filter} onSelect={onSelect} />)}
            </ol>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 w-full rounded-md py-1 text-[11px] text-terminal-accent hover:bg-white/[0.05]">
            {expanded ? 'Réduire' : `Voir les ${ranked.length} pays`}
          </button>
        </>
      )}
    </div>
  );
}
