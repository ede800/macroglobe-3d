import {
  Activity,
  ArrowLeftRight,
  DollarSign,
  ExternalLink,
  Gauge,
  LineChart as LineChartIcon,
  Newspaper,
  Plane,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Country, ProjectionPoint } from '../types';
import { COLORS, flagUrl, fmt } from '../lib/metrics';
import { AXIS_PROPS, ChartTooltipBox, ConfidenceGauge, Meter, Section, StatTile, ToneBadge } from './ui';

interface CountrySidebarProps {
  country: Country;
  compareMode: boolean;
  onClose: () => void;
  onCompare: () => void;
}

const USD_PARTS: { key: keyof Country['usd']['components']; label: string; max: number }[] = [
  { key: 'regime', label: 'Régime de change', max: 35 },
  { key: 'commodities', label: 'Matières premières en USD', max: 20 },
  { key: 'external_debt', label: 'Dette externe en USD', max: 20 },
  { key: 'invoicing', label: 'Facturation en USD', max: 15 },
  { key: 'deposits', label: 'Dépôts en USD', max: 10 },
];

const STATUS_LABEL = { live: 'Live', cache: 'Cache', neutral: 'Neutre' } as const;

function FactorBars({ country }: { country: Country }) {
  const maxAbs = Math.max(12, ...country.confidence.factors.map((f) => Math.abs(f.impact)));
  return (
    <ul className="space-y-2">
      {country.confidence.factors.map((f) => {
        const width = (Math.abs(f.impact) / maxAbs) * 50;
        const positive = f.impact >= 0;
        return (
          <li key={f.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-terminal-sub">{f.label}</span>
              <span className="font-mono font-semibold text-terminal-ink">{fmt.signed(f.impact)} pts</span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-white/[0.05]">
              <div className="absolute left-1/2 top-[-2px] h-3 w-px bg-white/25" />
              <div
                className="absolute top-0 h-2"
                style={{
                  left: positive ? '50%' : `${50 - width}%`,
                  width: `${width}%`,
                  background: positive ? COLORS.up : COLORS.down,
                  borderRadius: positive ? '0 4px 4px 0' : '4px 0 0 4px',
                }}
              />
            </div>
            <div className="mt-0.5 text-[10px] text-terminal-muted">{f.detail}</div>
          </li>
        );
      })}
    </ul>
  );
}

function ProjectionCharts({ series }: { series: ProjectionPoint[] }) {
  const base = series[0].year;
  const marks = [base + 10, base + 25];
  return (
    <div className="space-y-4">
      <figure>
        <figcaption className="mb-1 text-xs text-terminal-sub">PIB réel projeté (Md USD constants {base})</figcaption>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gdpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.up} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.up} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="year" {...AXIS_PROPS} ticks={[base, base + 10, base + 25]} />
              <YAxis {...AXIS_PROPS} width={46} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}T` : `${v.toFixed(0)}`)} />
              {marks.map((m) => (
                <ReferenceLine key={m} x={m} stroke={COLORS.accent} strokeDasharray="3 3" strokeOpacity={0.6} />
              ))}
              <Tooltip
                cursor={{ stroke: COLORS.sub, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as ProjectionPoint;
                  return (
                    <ChartTooltipBox
                      title={String(p.year)}
                      rows={[
                        { label: 'PIB', value: fmt.usdBn(p.gdp), color: COLORS.up },
                        { label: 'Croissance', value: fmt.pct(p.growth, true) },
                      ]}
                    />
                  );
                }}
              />
              <Area isAnimationActive={false} type="monotone" dataKey="gdp" stroke={COLORS.up} strokeWidth={2} fill="url(#gdpFill)" activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-1 text-xs text-terminal-sub">Score de stabilité projeté (0-100, zone neutre 40-60)</figcaption>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <ReferenceArea y1={40} y2={60} fill="#ffffff" fillOpacity={0.04} />
              <XAxis dataKey="year" {...AXIS_PROPS} ticks={[base, base + 10, base + 25]} />
              <YAxis {...AXIS_PROPS} width={46} domain={[0, 100]} ticks={[0, 40, 60, 100]} />
              {marks.map((m) => (
                <ReferenceLine key={m} x={m} stroke={COLORS.accent} strokeDasharray="3 3" strokeOpacity={0.6} />
              ))}
              <Tooltip
                cursor={{ stroke: COLORS.sub, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as ProjectionPoint;
                  return (
                    <ChartTooltipBox
                      title={String(p.year)}
                      rows={[
                        { label: 'Stabilité', value: fmt.num(p.stability), color: COLORS.ink },
                        { label: 'Dette / PIB', value: `${fmt.num(p.debt, 0)} %` },
                      ]}
                    />
                  );
                }}
              />
              <Line isAnimationActive={false} type="monotone" dataKey="stability" stroke={COLORS.ink} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}

function SentimentSpark({ history }: { history: { date: string; score: number }[] }) {
  if (history.length < 2) return null;
  return (
    <div className="h-10 w-28" title="Historique du sentiment quotidien">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={[0, 100]} />
          <ReferenceLine y={50} stroke={COLORS.axis} />
          <Line type="monotone" dataKey="score" stroke={COLORS.sub} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CountrySidebar({ country, compareMode, onClose, onCompare }: CountrySidebarProps) {
  const { indicators: ind, confidence, usd, sentiment, projection } = country;

  const growthDelta = ind.gdp_growth - ind.growth_5y_avg;

  return (
    <aside
      className="glass-panel fixed inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col rounded-t-2xl animate-fade-in md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:max-h-none md:w-[420px] md:rounded-2xl md:animate-slide-in"
      aria-label={`Tableau de bord ${country.name_fr}`}
    >
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        <img src={flagUrl(country.iso2, 80)} alt="" className="mt-1 h-8 w-12 rounded-sm object-cover ring-1 ring-white/15" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-terminal-ink">{country.name_fr}</h2>
          <p className="text-xs text-terminal-muted">
            {country.region} · {country.currency} · Rang PIB #{country.gdp_rank}
          </p>
        </div>
        <button onClick={onClose} className="icon-btn" aria-label="Fermer le panneau">
          <X size={18} />
        </button>
      </header>

      <div className="px-5 pb-4">
        <button
          onClick={onCompare}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            compareMode
              ? 'border-terminal-accent bg-terminal-accent/15 text-terminal-accent'
              : 'border-terminal-line bg-white/[0.04] text-terminal-ink hover:border-terminal-accent/60 hover:text-terminal-accent'
          }`}
        >
          <ArrowLeftRight size={15} />
          {compareMode ? 'Choisissez un 2e pays sur le globe ou via la recherche…' : 'Comparer avec un autre pays'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
        <Section title="Indicateurs clés" icon={<Activity size={13} />} aside={<span className="font-mono text-[10px] text-terminal-muted">{ind.gdp_year}</span>}>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="PIB nominal" value={fmt.usd(ind.gdp_usd)} sub={`USD courants · ${country.sources.gdp_usd}`} />
            <StatTile
              label="Croissance réelle"
              value={fmt.pct(ind.gdp_growth, true)}
              sub={`${fmt.signed(growthDelta)} pt vs moy. 5 ans`}
              title={country.sources.gdp_growth}
            />
            <StatTile label="Dette / PIB" value={`${fmt.num(ind.debt_gdp, 0)} %`} sub={country.sources.debt_gdp} />
            <StatTile label="Inflation" value={fmt.pct(ind.inflation)} sub={country.sources.inflation} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-terminal-muted">
            <div>
              Balance courante <span className="font-mono text-terminal-sub">{fmt.pct(ind.current_account, true)}</span>
            </div>
            <div>
              Démographie <span className="font-mono text-terminal-sub">{fmt.pct(ind.pop_growth, true)}/an</span>
            </div>
          </div>
        </Section>

        <Section title="Indice de sentiment & confiance" icon={<Gauge size={13} />} aside={<ToneBadge score={confidence.score} label={confidence.label} />}>
          <div className="flex flex-col items-center">
            <ConfidenceGauge score={confidence.score} size={220} />
            <div className="-mt-2 font-mono text-3xl font-semibold text-terminal-ink">{fmt.num(confidence.score)}</div>
            <div className="text-[11px] text-terminal-muted">sur 100 · Pessimiste &lt; 40 · Neutre 40-60 · Optimiste &gt; 60</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Macro (40 %)', v: confidence.components.macro },
              { label: 'Dette & CA (30 %)', v: confidence.components.fiscal },
              { label: 'Actualité (30 %)', v: confidence.components.sentiment },
            ].map((c) => (
              <div key={c.label} className="rounded-md bg-white/[0.03] px-2 py-1.5">
                <div className="font-mono text-sm font-semibold text-terminal-ink">{fmt.num(c.v, 0)}</div>
                <div className="text-[10px] text-terminal-muted">{c.label}</div>
              </div>
            ))}
          </div>
          <h4 className="mb-2 mt-4 text-xs font-medium text-terminal-sub">Contribution de chaque facteur (vs neutre 50)</h4>
          <FactorBars country={country} />
        </Section>

        <Section title="Dépendances structurelles" icon={<Plane size={13} />}>
          <div className="space-y-3">
            <Meter
              label="Tourisme, % des exportations"
              value={ind.tourism_exports_pct}
              max={30}
              color="#d95926"
              valueLabel={fmt.pct(ind.tourism_exports_pct)}
            />
            <Meter label="Tourisme, % du PIB" value={ind.tourism_gdp_pct} max={12} color="#d95926" valueLabel={fmt.pct(ind.tourism_gdp_pct)} />
            <p className="text-[10px] text-terminal-muted">Source : {country.sources.tourism_exports_pct}</p>
          </div>

          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-terminal-sub">
                <DollarSign size={13} /> Dépendance au dollar US
              </span>
              <span className="font-mono text-lg font-semibold text-terminal-ink">
                {fmt.num(usd.score, 0)}
                <span className="text-xs text-terminal-muted"> / 100</span>
              </span>
            </div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label="Décomposition du score de dépendance au USD">
              {USD_PARTS.map((p, i) =>
                usd.components[p.key] > 0 ? (
                  <div key={p.key} style={{ width: `${usd.components[p.key]}%`, background: COLORS.series[i] }} title={`${p.label} : ${fmt.num(usd.components[p.key])} / ${p.max}`} />
                ) : null,
              )}
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-1 text-[11px]">
              {USD_PARTS.map((p, i) => (
                <li key={p.key} className="flex items-center gap-2 text-terminal-sub">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COLORS.series[i] }} />
                  {p.label}
                  <span className="ml-auto font-mono text-terminal-ink">
                    {fmt.num(usd.components[p.key])}
                    <span className="text-terminal-muted"> / {p.max}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-terminal-sub">
              Régime : <span className="font-medium text-terminal-ink">{usd.regime_label}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {usd.tags.map((t) => (
                <span key={t} className="rounded-full border border-terminal-line bg-white/[0.04] px-2 py-0.5 text-[11px] text-terminal-sub">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Actualité du jour"
          icon={<Newspaper size={13} />}
          aside={
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                sentiment.status === 'live' ? 'bg-terminal-up/15 text-terminal-up' : 'bg-white/[0.06] text-terminal-muted'
              }`}
            >
              {STATUS_LABEL[sentiment.status]}
            </span>
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-2xl font-semibold text-terminal-ink">
                {fmt.num(sentiment.score, 0)}
                <span className="text-xs text-terminal-muted"> / 100</span>
              </div>
              <div className="text-[11px] text-terminal-muted">
                VADER {fmt.signed(sentiment.compound, 2)} · {sentiment.n_articles} titres · {sentiment.source}
              </div>
            </div>
            <SentimentSpark history={sentiment.history} />
          </div>
          {sentiment.headlines.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {sentiment.headlines.slice(0, 5).map((h) => (
                <li key={h.url || h.title} className="group flex gap-2 text-xs">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: h.compound > 0.05 ? COLORS.up : h.compound < -0.05 ? COLORS.down : COLORS.muted }}
                    aria-hidden
                  />
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-terminal-sub transition group-hover:text-terminal-ink">
                    {h.title}
                    <span className="ml-1 whitespace-nowrap text-[10px] text-terminal-muted">
                      {h.source && `${h.source} · `}
                      {fmt.signed(h.compound, 2)}
                      <ExternalLink size={9} className="ml-0.5 inline" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-terminal-muted">Aucun titre récent disponible ; sentiment neutre appliqué.</p>
          )}
        </Section>

        <Section title={`Projections · ${projection.scenario}`} icon={<LineChartIcon size={13} />}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <StatTile label={`PIB ${projection.base_year + 10}`} value={fmt.usdBn(projection.gdp_10)} sub={`TCAM ${fmt.pct(projection.cagr_10, true)}`} />
            <StatTile label={`PIB ${projection.base_year + 25}`} value={fmt.usdBn(projection.gdp_25)} sub={`TCAM ${fmt.pct(projection.cagr_25, true)}`} />
            <StatTile
              label="Stabilité +10 ans"
              value={fmt.num(projection.stability_10)}
              sub={`${fmt.signed(projection.stability_10 - confidence.score)} pts · dette ${fmt.num(projection.debt_10, 0)} %`}
            />
            <StatTile
              label="Stabilité +25 ans"
              value={fmt.num(projection.stability_25)}
              sub={`${fmt.signed(projection.stability_25 - confidence.score)} pts · dette ${fmt.num(projection.debt_25, 0)} %`}
            />
          </div>
          <ProjectionCharts series={projection.series} />
          <details className="mt-3 text-[11px] text-terminal-muted">
            <summary className="cursor-pointer text-terminal-sub">Hypothèses du modèle</summary>
            <ul className="mt-2 space-y-1 font-mono">
              <li>Croissance moy. 5 ans (bornée −4/+10) : {fmt.pct(projection.assumptions.growth_ma5, true)}</li>
              <li>Ancre de long terme (démographie) : {fmt.pct(projection.assumptions.long_run_growth, true)}</li>
              <li>Frein de la dette (&gt; 90 % PIB) : {fmt.signed(projection.assumptions.debt_drag, 2)} pt</li>
              <li>Ajustement de confiance (s’estompe) : {fmt.signed(projection.assumptions.confidence_adjustment, 2)} pt</li>
              <li>Taux réel pour la dette : {fmt.pct(projection.assumptions.real_interest_rate)}</li>
            </ul>
            <p className="mt-2">Trajectoire mécanique « en l’état actuel », pas une prévision.</p>
          </details>
        </Section>
      </div>
    </aside>
  );
}
