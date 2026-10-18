import { useEffect, useMemo } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Country } from '../types';
import { COLORS, flagUrl, fmt, fmtPopulation, POLITICAL_COLORS, politicalIndex } from '../lib/metrics';
import { AXIS_PROPS, ChartTooltipBox, ToneBadge } from './ui';
import ExposureRadar from './ExposureRadar';

interface ComparisonModalProps {
  a: Country;
  b: Country;
  onClose: () => void;
  onSwap: () => void;
}

type Better = 'higher' | 'lower' | 'none' | ((v: number) => number);

interface Row {
  group: string;
  label: string;
  get: (c: Country) => number | null;
  format: (v: number) => string;
  better: Better;
}

// For inflation, "better" means closer to the 2 % target.
const distanceToTarget = (v: number) => -Math.abs(v - 2);

const ROWS: Row[] = [
  { group: 'Aujourd’hui', label: 'PIB nominal', get: (c) => c.indicators.gdp_usd, format: fmt.usd, better: 'none' },
  { group: 'Aujourd’hui', label: 'Croissance réelle', get: (c) => c.indicators.gdp_growth, format: (v) => fmt.pct(v, true), better: 'higher' },
  { group: 'Aujourd’hui', label: 'Croissance moy. 5 ans', get: (c) => c.indicators.growth_5y_avg, format: (v) => fmt.pct(v, true), better: 'higher' },
  { group: 'Aujourd’hui', label: 'Inflation', get: (c) => c.indicators.inflation, format: (v) => fmt.pct(v), better: distanceToTarget },
  { group: 'Aujourd’hui', label: 'Dette / PIB', get: (c) => c.indicators.debt_gdp, format: (v) => `${fmt.num(v, 0)} %`, better: 'lower' },
  { group: 'Aujourd’hui', label: 'Balance courante', get: (c) => c.indicators.current_account, format: (v) => fmt.pct(v, true), better: 'higher' },
  { group: 'Aujourd’hui', label: 'Démographie', get: (c) => c.indicators.pop_growth, format: (v) => fmt.pct(v, true), better: 'none' },
  { group: 'Dépendances', label: 'Tourisme (% export.)', get: (c) => c.indicators.tourism_exports_pct, format: (v) => fmt.pct(v), better: 'lower' },
  { group: 'Dépendances', label: 'Dépendance USD', get: (c) => c.usd.score, format: (v) => `${fmt.num(v, 0)} / 100`, better: 'lower' },
  { group: 'Dépendances', label: 'Exposition externe', get: (c) => c.dependencies?.exposure.score ?? null, format: (v) => `${fmt.num(v, 0)} / 100`, better: 'lower' },
  { group: 'Dépendances', label: 'Commerce avec la Chine', get: (c) => c.dependencies?.partners?.china?.share ?? null, format: (v) => fmt.pct(v), better: 'none' },
  { group: 'Dépendances', label: 'Commerce avec les É.-U.', get: (c) => c.dependencies?.partners?.us?.share ?? null, format: (v) => fmt.pct(v), better: 'none' },
  { group: 'Dépendances', label: 'Commerce avec l’UE', get: (c) => c.dependencies?.partners?.eu?.share ?? null, format: (v) => fmt.pct(v), better: 'none' },
  { group: 'Dépendances', label: 'Énergie importée', get: (c) => c.dependencies?.indicators.energy_net_imports.value ?? null, format: (v) => (v <= 0 ? 'export. net' : `${fmt.num(v, 0)} %`), better: 'lower' },
  { group: 'Dépendances', label: 'Alimentation (% import.)', get: (c) => c.dependencies?.indicators.food_imports.value ?? null, format: (v) => fmt.pct(v), better: 'lower' },
  { group: 'Dépendances', label: 'Diaspora (% PIB)', get: (c) => c.dependencies?.indicators.remittances.value ?? null, format: (v) => fmt.pct(v), better: 'none' },
  { group: 'Dépendances', label: 'Dette extérieure (% RNB)', get: (c) => c.dependencies?.indicators.external_debt.value ?? null, format: (v) => `${fmt.num(v, 0)} %`, better: 'lower' },
  { group: 'Dépendances', label: 'Réserves (mois d’import.)', get: (c) => c.dependencies?.indicators.reserves_months.value ?? null, format: (v) => fmt.num(v), better: 'higher' },
  { group: 'Démographie & société', label: 'Population', get: (c) => c.demography?.population ?? null, format: fmtPopulation, better: 'none' },
  { group: 'Démographie & société', label: 'Enfants par femme', get: (c) => c.demography?.fertility_rate ?? null, format: (v) => fmt.num(v, 2), better: 'none' },
  { group: 'Démographie & société', label: 'Âge médian', get: (c) => c.demography?.median_age ?? null, format: (v) => `${fmt.num(v, 1)} ans`, better: 'none' },
  { group: 'Démographie & société', label: 'Espérance de vie', get: (c) => c.demography?.life_expectancy ?? null, format: (v) => `${fmt.num(v, 1)} ans`, better: 'higher' },
  { group: 'Démographie & société', label: 'IDH', get: (c) => c.society?.hdi ?? null, format: (v) => fmt.num(v, 3), better: 'higher' },
  { group: 'Démographie & société', label: 'PIB PPA / habitant', get: (c) => c.society?.gdp_ppp_per_capita ?? null, format: (v) => `${fmt.num(v / 1000, 1)} k$`, better: 'higher' },
  { group: 'Démographie & société', label: 'Chômage', get: (c) => c.society?.unemployment ?? null, format: (v) => fmt.pct(v), better: 'lower' },
  { group: 'Démographie & société', label: 'Inégalités (Gini)', get: (c) => c.society?.gini ?? null, format: (v) => fmt.num(v, 1), better: 'lower' },
  { group: 'Démographie & société', label: 'Intégrité (IPC)', get: (c) => c.society?.corruption_cpi ?? null, format: (v) => `${fmt.num(v, 0)} / 100`, better: 'higher' },
  { group: 'Confiance', label: 'Score de confiance', get: (c) => c.confidence.score, format: (v) => fmt.num(v), better: 'higher' },
  { group: 'Confiance', label: 'Sentiment actualité', get: (c) => c.sentiment.score, format: (v) => fmt.num(v, 0), better: 'higher' },
  { group: 'Projections', label: 'PIB +10 ans', get: (c) => c.projection.gdp_10 * 1e9, format: fmt.usd, better: 'none' },
  { group: 'Projections', label: 'PIB +25 ans', get: (c) => c.projection.gdp_25 * 1e9, format: fmt.usd, better: 'none' },
  { group: 'Projections', label: 'TCAM PIB 25 ans', get: (c) => c.projection.cagr_25, format: (v) => fmt.pct(v, true), better: 'higher' },
  { group: 'Projections', label: 'Stabilité +10 ans', get: (c) => c.projection.stability_10, format: (v) => fmt.num(v), better: 'higher' },
  { group: 'Projections', label: 'Stabilité +25 ans', get: (c) => c.projection.stability_25, format: (v) => fmt.num(v), better: 'higher' },
];

function winner(row: Row, a: Country, b: Country): 'a' | 'b' | null {
  if (row.better === 'none') return null;
  const key = typeof row.better === 'function' ? row.better : row.better === 'higher' ? (v: number) => v : (v: number) => -v;
  const ra = row.get(a);
  const rb = row.get(b);
  if (ra === null || rb === null) return null;
  const va = key(ra);
  const vb = key(rb);
  if (Math.abs(va - vb) < 1e-6) return null;
  return va > vb ? 'a' : 'b';
}

function CountryHead({ c, color }: { c: Country; color: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <img src={flagUrl(c.iso2)} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-white/15" />
      <span className="truncate font-semibold text-terminal-ink">{c.name_fr}</span>
    </div>
  );
}

export default function ComparisonModal({ a, b, onClose, onSwap }: ComparisonModalProps) {
  const colorA = COLORS.series[0];
  const colorB = COLORS.series[1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // GDP indexed to 100 at the base year so two economies of different size share one axis.
  const series = useMemo(() => {
    const sa = a.projection.series;
    const sb = b.projection.series;
    return sa.map((p, i) => ({
      t: i,
      label: `+${i} an${i > 1 ? 's' : ''}`,
      gdpA: (p.gdp / sa[0].gdp) * 100,
      gdpB: sb[i] ? (sb[i].gdp / sb[0].gdp) * 100 : null,
      stabA: p.stability,
      stabB: sb[i]?.stability ?? null,
    }));
  }, [a, b]);

  const groups = [...new Set(ROWS.map((r) => r.group))];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Comparaison ${a.name_fr} / ${b.name_fr}`}
        className="glass-panel flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-terminal-line px-5 py-4">
          <ArrowLeftRight size={18} className="text-terminal-accent" />
          <h2 className="text-lg font-semibold text-terminal-ink">Comparaison</h2>
          <button onClick={onSwap} className="ml-auto rounded-md border border-terminal-line px-2.5 py-1 text-xs text-terminal-sub hover:text-terminal-ink">
            Inverser
          </button>
          <button onClick={onClose} className="icon-btn" aria-label="Fermer la comparaison">
            <X size={18} />
          </button>
        </header>

        <div className="grid flex-1 gap-0 overflow-y-auto md:grid-cols-[1.1fr_1fr]">
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-[38%] pb-3 text-[11px] font-medium uppercase tracking-wider text-terminal-muted">Indicateur</th>
                  <th className="pb-3 pr-2">
                    <CountryHead c={a} color={colorA} />
                  </th>
                  <th className="pb-3">
                    <CountryHead c={b} color={colorB} />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-terminal-line">
                  <td className="py-2 text-xs text-terminal-sub">Pouvoir</td>
                  {[a, b].map((c) => {
                    const idx = politicalIndex(c);
                    return (
                      <td key={c.iso3} className="py-2 pr-2 text-[11px] leading-snug text-terminal-ink">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: idx === null ? COLORS.sub : POLITICAL_COLORS[idx].color }} />
                          {c.politics?.political_category ?? 'n.d.'}
                        </span>
                        {c.politics?.leaders[0] && <span className="text-terminal-muted">{c.politics.leaders[0].name}</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-terminal-line">
                  <td className="py-2 text-xs text-terminal-sub">Statut</td>
                  <td className="py-2 pr-2">
                    <ToneBadge score={a.confidence.score} label={a.confidence.label} />
                  </td>
                  <td className="py-2">
                    <ToneBadge score={b.confidence.score} label={b.confidence.label} />
                  </td>
                </tr>
                {groups.map((g) => (
                  <GroupRows key={g} group={g} a={a} b={b} />
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-terminal-muted">
              ▲ = meilleur des deux sur l’indicateur (inflation : la plus proche de 2 %). Dépendances : plus bas = moins exposé.
            </p>
          </div>

          <div className="space-y-5 border-t border-terminal-line px-5 py-4 md:border-l md:border-t-0">
            <figure>
              <figcaption className="mb-1 text-xs text-terminal-sub">Profil d’exposition externe (0-100 par axe)</figcaption>
              <ExposureRadar series={[{ country: a, color: colorA }, { country: b, color: colorB }]} height={280} />
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs text-terminal-sub">PIB réel projeté, indice 100 = {a.projection.base_year}</figcaption>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <XAxis dataKey="t" {...AXIS_PROPS} ticks={[0, 5, 10, 15, 20, 25]} tickFormatter={(t: number) => (t === 0 ? 'Auj.' : `+${t}`)} />
                    <YAxis {...AXIS_PROPS} width={40} domain={['auto', 'auto']} />
                    <Tooltip
                      cursor={{ stroke: COLORS.sub, strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof series)[number];
                        return (
                          <ChartTooltipBox
                            title={p.label}
                            rows={[
                              { label: a.name_fr, value: fmt.num(p.gdpA), color: colorA },
                              ...(p.gdpB != null ? [{ label: b.name_fr, value: fmt.num(p.gdpB), color: colorB }] : []),
                            ]}
                          />
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-terminal-sub">{v}</span>} />
                    <Line isAnimationActive={false} name={a.name_fr} type="monotone" dataKey="gdpA" stroke={colorA} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
                    <Line isAnimationActive={false} name={b.name_fr} type="monotone" dataKey="gdpB" stroke={colorB} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs text-terminal-sub">Score de stabilité projeté (zone neutre 40-60)</figcaption>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={COLORS.grid} vertical={false} />
                    <ReferenceArea y1={40} y2={60} fill="#ffffff" fillOpacity={0.04} />
                    <XAxis dataKey="t" {...AXIS_PROPS} ticks={[0, 5, 10, 15, 20, 25]} tickFormatter={(t: number) => (t === 0 ? 'Auj.' : `+${t}`)} />
                    <YAxis {...AXIS_PROPS} width={40} domain={[0, 100]} ticks={[0, 40, 60, 100]} />
                    <Tooltip
                      cursor={{ stroke: COLORS.sub, strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof series)[number];
                        return (
                          <ChartTooltipBox
                            title={p.label}
                            rows={[
                              { label: a.name_fr, value: fmt.num(p.stabA), color: colorA },
                              ...(p.stabB != null ? [{ label: b.name_fr, value: fmt.num(p.stabB), color: colorB }] : []),
                            ]}
                          />
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-terminal-sub">{v}</span>} />
                    <Line isAnimationActive={false} name={a.name_fr} type="monotone" dataKey="stabA" stroke={colorA} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
                    <Line isAnimationActive={false} name={b.name_fr} type="monotone" dataKey="stabB" stroke={colorB} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[a, b].map((c, i) => (
                <div key={c.iso3} className="rounded-lg border border-terminal-line bg-white/[0.03] p-3">
                  <CountryHead c={c} color={i === 0 ? colorA : colorB} />
                  <div className="mt-2 text-terminal-muted">Dépendance USD</div>
                  <div className="text-terminal-sub">{c.usd.regime_label}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.usd.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-terminal-sub">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupRows({ group, a, b }: { group: string; a: Country; b: Country }) {
  return (
    <>
      <tr>
        <td colSpan={3} className="pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-accent/80">
          {group}
        </td>
      </tr>
      {ROWS.filter((r) => r.group === group).map((r) => {
        const w = winner(r, a, b);
        return (
          <tr key={r.label} className="border-t border-terminal-line/60">
            <td className="py-1.5 text-xs text-terminal-sub">{r.label}</td>
            {(['a', 'b'] as const).map((side) => (
              <td key={side} className={`py-1.5 font-mono text-[13px] tabular-nums ${w === side ? 'font-semibold text-terminal-ink' : 'text-terminal-sub'}`}>
                {(() => {
                  const v = r.get(side === 'a' ? a : b);
                  return v === null ? <span className="text-terminal-muted">n.d.</span> : r.format(v);
                })()}
                {w === side && <span className="ml-1 text-[10px] text-terminal-accent">▲</span>}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
