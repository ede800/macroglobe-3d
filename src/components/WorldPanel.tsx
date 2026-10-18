import { useMemo } from 'react';
import { Globe2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Country } from '../types';
import { COLORS, confidenceColor, flagUrl, fmt } from '../lib/metrics';

interface WorldPanelProps {
  countries: Country[];
  onSelect: (iso3: string) => void;
}

/** Global snapshot: coverage, GDP-weighted confidence, mood split and today's headline movers. */
export default function WorldPanel({ countries, onSelect }: WorldPanelProps) {
  const stats = useMemo(() => {
    const totalGdp = countries.reduce((s, c) => s + c.indicators.gdp_usd, 0);
    const weighted = countries.reduce((s, c) => s + c.confidence.score * c.indicators.gdp_usd, 0) / Math.max(1, totalGdp);
    const split = { down: 0, neutral: 0, up: 0 };
    for (const c of countries) {
      if (c.confidence.score < 40) split.down += 1;
      else if (c.confidence.score > 60) split.up += 1;
      else split.neutral += 1;
    }
    const withNews = countries.filter((c) => c.sentiment.status !== 'neutral' && c.sentiment.n_articles >= 5);
    const bySentiment = [...withNews].sort((a, b) => b.sentiment.compound - a.sentiment.compound);
    return {
      totalGdp,
      weighted,
      split,
      best: bySentiment.slice(0, 3),
      // never list a country on both sides when few countries have news
      worst: bySentiment.slice(Math.max(3, bySentiment.length - 3)).reverse(),
      live: countries.filter((c) => c.sentiment.status === 'live').length,
    };
  }, [countries]);

  const total = countries.length || 1;
  const segments = [
    { key: 'down', n: stats.split.down, color: COLORS.down, label: 'Pessimistes', icon: TrendingDown },
    { key: 'neutral', n: stats.split.neutral, color: '#6b6b66', label: 'Neutres', icon: Minus },
    { key: 'up', n: stats.split.up, color: COLORS.up, label: 'Optimistes', icon: TrendingUp },
  ];

  return (
    <div className="glass-panel pointer-events-auto w-[300px] rounded-xl px-4 py-3 text-xs">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-sub">
        <Globe2 size={13} className="text-terminal-accent" /> Pouls mondial
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-terminal-muted">Confiance pondérée</div>
          <div className="flex items-baseline gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: confidenceColor(stats.weighted) }} />
            <span className="font-mono text-2xl font-semibold tabular-nums text-terminal-ink">{fmt.num(stats.weighted)}</span>
          </div>
          <div className="text-[10px] text-terminal-muted">moyenne pondérée par le PIB</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-terminal-muted">PIB couvert</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-terminal-ink">{fmt.usd(stats.totalGdp)}</div>
          <div className="text-[10px] text-terminal-muted">{countries.length} économies</div>
        </div>
      </div>

      <div className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Répartition des pays par humeur">
        {segments.map((s) => (s.n ? <div key={s.key} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} /> : null))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-terminal-sub">
        {segments.map(({ key, n, color, label, icon: Icon }) => (
          <span key={key} className="flex items-center gap-1">
            <Icon size={11} color={color} strokeWidth={2.5} />
            <span className="font-mono tabular-nums text-terminal-ink">{n}</span> {label}
          </span>
        ))}
      </div>

      {stats.best.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-terminal-line pt-2.5">
          {[
            { title: 'Actu. la plus positive', list: stats.best, icon: TrendingUp, color: COLORS.up },
            { title: 'Actu. la plus négative', list: stats.worst, icon: TrendingDown, color: COLORS.down },
          ].map(({ title, list, icon: Icon, color }) => (
            <div key={title}>
              <div className="mb-1 flex items-center gap-1 text-[10px] text-terminal-muted">
                <Icon size={11} color={color} strokeWidth={2.5} /> {title}
              </div>
              <ul className="space-y-0.5">
                {list.map((c) => (
                  <li key={c.iso3}>
                    <button onClick={() => onSelect(c.iso3)} className="flex w-full items-center gap-1.5 rounded px-0.5 text-left hover:bg-white/[0.06]">
                      <img src={flagUrl(c.iso2)} alt="" className="h-2.5 w-4 rounded-[1px] object-cover" />
                      <span className="flex-1 truncate text-[11px] text-terminal-sub">{c.name_fr}</span>
                      <span className="font-mono text-[10px] tabular-nums text-terminal-ink">{fmt.signed(c.sentiment.compound, 2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[10px] text-terminal-muted">Actualité analysée aujourd’hui pour {stats.live} pays</div>
    </div>
  );
}
