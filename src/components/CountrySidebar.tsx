import { useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  DollarSign,
  ExternalLink,
  Gauge,
  Globe2,
  Network,
  Radar as RadarIcon,
  Scale,
  LineChart as LineChartIcon,
  Newspaper,
  Plane,
  ShieldCheck,
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
import type { Country, DependencyKey, FilterKey, GrowthPoint, ProjectionPoint } from '../types';
import { COLORS, confidenceColor, DEPENDENCY_FILTERS, FILTERS, flagUrl, fmt, INCOME_LABELS, withAlpha } from '../lib/metrics';
import { AXIS_PROPS, ChartTooltipBox, ConfidenceGauge, Meter, Section, StatTile, ToneBadge } from './ui';
import ExposureRadar from './ExposureRadar';

interface CountrySidebarProps {
  country: Country;
  compareMode: boolean;
  activeFilter: FilterKey;
  onClose: () => void;
  onCompare: () => void;
  onShowOnGlobe: (filter: FilterKey) => void;
}

type Tab = 'overview' | 'dependencies' | 'news' | 'projections';

const TABS: { key: Tab; label: string; icon: typeof Activity }[] = [
  { key: 'overview', label: 'Synthèse', icon: Activity },
  { key: 'dependencies', label: 'Dépendances', icon: Plane },
  { key: 'news', label: 'Actualité', icon: Newspaper },
  { key: 'projections', label: 'Projections', icon: LineChartIcon },
];

const USD_PARTS: { key: keyof Country['usd']['components']; label: string; max: number }[] = [
  { key: 'regime', label: 'Régime de change', max: 35 },
  { key: 'commodities', label: 'Matières premières en USD', max: 20 },
  { key: 'external_debt', label: 'Dette externe en USD', max: 20 },
  { key: 'invoicing', label: 'Facturation en USD', max: 15 },
  { key: 'deposits', label: 'Dépôts en USD', max: 10 },
];

const STATUS_LABEL = { live: 'Live', cache: 'Cache', neutral: 'Neutre' } as const;

const isEstimate = (source: string | undefined) => Boolean(source?.startsWith('Estimation'));

function SourceNote({ source }: { source: string | undefined }) {
  if (!source) return null;
  return <span className={isEstimate(source) ? 'text-terminal-accent/90' : undefined}>{source}</span>;
}

interface DependencyRowSpec {
  key: DependencyKey;
  label: string;
  max: number;
  unit: (v: number) => string;
  filter?: FilterKey;
  hint?: string;
  marker?: { at: number; label: string };
}

const DEP_SECTIONS: { title: string; rows: DependencyRowSpec[] }[] = [
  {
    title: 'Énergie, alimentation & ressources',
    rows: [
      { key: 'energy_net_imports', label: 'Énergie importée (% de la consommation)', max: 100, unit: (v) => (v <= 0 ? 'exportateur net' : `${fmt.num(v, 0)} %`), filter: 'energy' },
      { key: 'fuel_imports', label: 'Carburants (% des importations)', max: 40, unit: (v) => fmt.pct(v) },
      { key: 'food_imports', label: 'Alimentation (% des importations)', max: 40, unit: (v) => fmt.pct(v), filter: 'food' },
      { key: 'resource_rents', label: 'Rentes des ressources naturelles (% du PIB)', max: 40, unit: (v) => fmt.pct(v) },
    ],
  },
  {
    title: 'Flux financiers',
    rows: [
      { key: 'remittances', label: 'Envois de fonds des diasporas (% du PIB)', max: 30, unit: (v) => fmt.pct(v), filter: 'remittances' },
      { key: 'aid', label: 'Aide au développement reçue (% du RNB)', max: 20, unit: (v) => fmt.pct(v), filter: 'aid' },
      { key: 'fdi', label: 'Investissements étrangers entrants (% du PIB)', max: 15, unit: (v) => fmt.pct(v, true) },
      { key: 'trade_openness', label: 'Ouverture commerciale (commerce / PIB)', max: 200, unit: (v) => `${fmt.num(v, 0)} %` },
    ],
  },
  {
    title: 'Dette extérieure & réserves',
    rows: [
      { key: 'external_debt', label: 'Dette extérieure (% du RNB)', max: 150, unit: (v) => `${fmt.num(v, 0)} %`, filter: 'external_debt' },
      { key: 'debt_service', label: 'Service de la dette (% des exportations)', max: 40, unit: (v) => fmt.pct(v) },
      {
        key: 'reserves_months',
        label: 'Réserves de change (mois d’importations)',
        max: 15,
        unit: (v) => `${fmt.num(v)} mois`,
        filter: 'reserves',
        hint: 'Coussin de sécurité : plus c’est haut, mieux c’est.',
        marker: { at: 3, label: 'seuil 3 mois' },
      },
    ],
  },
];

function GlobeLink({ filter, active, onClick }: { filter: FilterKey; active: boolean; onClick: (f: FilterKey) => void }) {
  return (
    <button
      onClick={() => onClick(filter)}
      className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition ${
        active ? 'bg-terminal-accent text-black' : 'text-terminal-muted hover:bg-white/[0.08] hover:text-terminal-accent'
      }`}
      title={`Colorer le globe : ${FILTERS[filter].label}`}
      aria-label={`Afficher « ${FILTERS[filter].label} » sur le globe`}
    >
      <Globe2 size={11} />
    </button>
  );
}

function DependencyRows({ country, rows, activeFilter, onShowOnGlobe }: { country: Country; rows: DependencyRowSpec[]; activeFilter: FilterKey; onShowOnGlobe: (f: FilterKey) => void }) {
  const ind = country.dependencies?.indicators;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const item = ind?.[r.key];
        const v = item?.value ?? (r.key === 'aid' && country.income === 'HIC' ? 0 : null);
        const color = r.filter && v !== null ? FILTERS[r.filter].color(country) : COLORS.sub;
        const pct = v === null ? 0 : Math.max(0, Math.min(100, (v / r.max) * 100));
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="flex items-center text-terminal-sub">
                {r.label}
                {r.filter && <GlobeLink filter={r.filter} active={activeFilter === r.filter} onClick={onShowOnGlobe} />}
              </span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-terminal-ink">{v === null ? 'n.d.' : r.unit(v)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.06]">
              {v !== null && <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />}
              {r.marker && (
                <div className="absolute -top-0.5 h-3 w-px bg-terminal-accent" style={{ left: `${(r.marker.at / r.max) * 100}%` }} title={r.marker.label} />
              )}
            </div>
            <div className="mt-0.5 text-[10px] text-terminal-muted">
              {v === null
                ? r.key === 'external_debt' || r.key === 'debt_service'
                  ? 'Publié uniquement pour les pays à revenu faible et intermédiaire'
                  : 'Aucune série récente publiée'
                : [item?.source ?? (r.key === 'aid' ? 'Pays à revenu élevé : non bénéficiaire' : null), r.hint].filter(Boolean).join(' · ')}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PartnersBlock({ country, activeFilter, onShowOnGlobe }: { country: Country; activeFilter: FilterKey; onShowOnGlobe: (f: FilterKey) => void }) {
  const partners = country.dependencies?.partners;
  if (!partners) return <p className="text-xs text-terminal-muted">Répartition du commerce indisponible (pays absent des statistiques du FMI).</p>;
  const rows: { key: 'china' | 'us' | 'eu'; label: string; flag: string; filter: FilterKey }[] = [
    { key: 'china', label: 'Chine', flag: 'cn', filter: 'china' },
    { key: 'us', label: 'États-Unis', flag: 'us', filter: 'us_trade' },
    { key: 'eu', label: 'Union européenne', flag: 'eu', filter: 'eu_trade' },
  ];
  const others = Math.max(0, 100 - rows.reduce((sum, r) => sum + (partners[r.key]?.share ?? 0), 0));
  return (
    <div>
      <div className="mb-3 flex h-3 gap-[2px] overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label="Répartition du commerce de biens par partenaire">
        {rows.map((r) => {
          const p = partners[r.key];
          return p && p.share > 0 ? (
            <div key={r.key} style={{ width: `${p.share}%`, background: FILTERS[r.filter].legend.stops[3] }} title={`${r.label} : ${fmt.pct(p.share)}`} />
          ) : null;
        })}
        <div style={{ width: `${others}%`, background: '#3a3f48' }} title={`Reste du monde : ${fmt.pct(others)}`} />
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const p = partners[r.key];
          return (
            <li key={r.key} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: FILTERS[r.filter].legend.stops[3] }} />
              <img src={flagUrl(r.flag)} alt="" className="h-3 w-[18px] rounded-[2px] object-cover" />
              <span className="flex flex-1 items-center text-xs text-terminal-sub">
                {r.label}
                <GlobeLink filter={r.filter} active={activeFilter === r.filter} onClick={onShowOnGlobe} />
              </span>
              {p ? (
                <span className="text-right">
                  <span className="font-mono text-sm font-semibold tabular-nums text-terminal-ink">{fmt.pct(p.share)}</span>
                  <span className="block text-[10px] text-terminal-muted">
                    export. {p.exports === null ? 'n.d.' : fmt.pct(p.exports)} · import. {p.imports === null ? 'n.d.' : fmt.pct(p.imports)}
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-terminal-muted">—</span>
              )}
            </li>
          );
        })}
        <li className="flex items-center gap-2.5 text-xs text-terminal-muted">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[#3a3f48]" />
          <span className="flex-1">Reste du monde</span>
          <span className="font-mono tabular-nums">{fmt.pct(others)}</span>
        </li>
      </ul>
      <p className="mt-2 text-[10px] text-terminal-muted">Part du commerce de biens (exportations + importations) · {partners.source}</p>
    </div>
  );
}

function FactorBars({ country }: { country: Country }) {
  const maxAbs = Math.max(12, ...country.confidence.factors.map((f) => Math.abs(f.impact)));
  return (
    <ul className="space-y-2.5">
      {country.confidence.factors.map((f) => {
        const width = (Math.abs(f.impact) / maxAbs) * 50;
        const positive = f.impact >= 0;
        return (
          <li key={f.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-terminal-sub">{f.label}</span>
              <span className="font-mono font-semibold tabular-nums text-terminal-ink">{fmt.signed(f.impact)} pts</span>
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

function GrowthBars({ history }: { history: GrowthPoint[] }) {
  const maxAbs = Math.max(2, ...history.map((h) => Math.abs(h.value)));
  const hasNeg = history.some((h) => h.value < 0);
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-terminal-sub">Croissance réelle, dernières années</figcaption>
      <div className="flex gap-2">
        {history.map((h) => {
          const pct = (Math.abs(h.value) / maxAbs) * (hasNeg ? 50 : 100);
          const positive = h.value >= 0;
          return (
            <div key={h.year} className="group flex-1 text-center" title={`${h.year} : ${fmt.pct(h.value, true)}`}>
              <div className="font-mono text-[10px] tabular-nums text-terminal-sub group-hover:text-terminal-ink">{fmt.signed(h.value)}</div>
              <div className="relative mt-1 h-14 rounded-sm bg-white/[0.03]">
                {hasNeg && <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />}
                <div
                  className={`absolute inset-x-1.5 ${positive ? 'rounded-t-[4px]' : 'rounded-b-[4px]'}`}
                  style={
                    positive
                      ? { bottom: hasNeg ? '50%' : 0, height: `${pct}%`, background: COLORS.up }
                      : { top: '50%', height: `${pct}%`, background: COLORS.down }
                  }
                />
              </div>
              <div className="mt-1 font-mono text-[10px] text-terminal-muted">{h.year}</div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function ProjectionCharts({ series }: { series: ProjectionPoint[] }) {
  const base = series[0].year;
  const marks = [base + 10, base + 25];
  return (
    <div className="space-y-5">
      <figure>
        <figcaption className="mb-1 text-xs text-terminal-sub">PIB réel projeté (Md USD constants {base})</figcaption>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gdpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.up} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={COLORS.up} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="year" {...AXIS_PROPS} ticks={[base, base + 10, base + 25]} />
              <YAxis
                {...AXIS_PROPS}
                width={46}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}T` : `${v.toFixed(v < 10 ? 1 : 0)}`)}
              />
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
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="gdp"
                stroke={COLORS.up}
                strokeWidth={2}
                fill="url(#gdpFill)"
                activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-1 text-xs text-terminal-sub">Score de stabilité projeté (0-100, zone neutre 40-60)</figcaption>
        <div className="h-36">
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
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="stability"
                stroke={COLORS.ink}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2 }}
              />
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
    <div className="h-12 w-32" title="Historique du sentiment quotidien">
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

function QualityBadge({ country }: { country: Country }) {
  const q = country.data_quality;
  const notes = [...q.estimated, ...q.usd_proxies.map((p) => `${p} (proxy)`)];
  const tone = q.score >= 85 ? 'text-terminal-up' : q.score >= 60 ? 'text-terminal-sub' : 'text-terminal-accent';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-terminal-line bg-black/30 px-2 py-0.5 text-[11px] text-terminal-sub"
      title={notes.length ? `Estimé : ${notes.join(', ')}` : 'Tous les indicateurs clés proviennent de la Banque mondiale / FMI'}
    >
      <ShieldCheck size={12} className={tone} />
      Données {q.score} %
    </span>
  );
}

export default function CountrySidebar({ country, compareMode, activeFilter, onClose, onCompare, onShowOnGlobe }: CountrySidebarProps) {
  // Opening a country while a dependency filter is active lands directly on the matching tab.
  const [tab, setTab] = useState<Tab>(() =>
    DEPENDENCY_FILTERS.some((g) => g.keys.includes(activeFilter)) ? 'dependencies' : 'overview',
  );
  const { indicators: ind, confidence, usd, sentiment, projection, sources } = country;
  const tint = confidenceColor(confidence.score);
  const growthDelta = ind.gdp_growth - ind.growth_5y_avg;
  const subtitle = [country.region, country.income ? INCOME_LABELS[country.income] : null, country.currency].filter(Boolean).join(' · ');

  return (
    <aside
      className="glass-panel fixed inset-x-0 bottom-0 z-30 flex max-h-[74vh] flex-col overflow-hidden rounded-t-2xl animate-fade-in md:inset-x-auto md:bottom-14 md:right-4 md:top-[88px] md:max-h-none md:w-[440px] md:rounded-2xl md:animate-slide-in"
      aria-label={`Tableau de bord ${country.name_fr}`}
    >
      <header
        className="relative px-5 pb-4 pt-5"
        style={{ background: `linear-gradient(135deg, ${withAlpha(tint, 0.3)} 0%, ${withAlpha(tint, 0.06)} 45%, transparent 75%)` }}
      >
        <div className="flex items-start gap-3">
          <img src={flagUrl(country.iso2, 80)} alt="" className="mt-0.5 h-9 w-[54px] rounded-[4px] object-cover shadow-lg ring-1 ring-white/20" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-terminal-ink">{country.name_fr}</h2>
            <p className="truncate text-xs text-terminal-sub/80">{subtitle}</p>
          </div>
          <button onClick={onClose} className="icon-btn -mr-1 -mt-1" aria-label="Fermer le panneau">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-terminal-sub">Indice de confiance</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-4xl font-semibold tabular-nums text-terminal-ink">{fmt.num(confidence.score)}</span>
              <span className="text-xs text-terminal-muted">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <ToneBadge score={confidence.score} label={confidence.label} />
            <QualityBadge country={country} />
          </div>
        </div>

        <button
          onClick={onCompare}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            compareMode
              ? 'border-terminal-accent bg-terminal-accent/15 text-terminal-accent'
              : 'border-white/15 bg-black/25 text-terminal-ink hover:border-terminal-accent/60 hover:text-terminal-accent'
          }`}
        >
          <ArrowLeftRight size={15} />
          {compareMode ? 'Choisissez un 2e pays sur le globe ou via la recherche…' : 'Comparer avec un autre pays'}
        </button>
      </header>

      <nav className="flex border-b border-terminal-line px-2" role="tablist" aria-label="Sections du pays">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 px-1 py-2.5 text-xs font-medium transition ${
              tab === key ? 'text-terminal-ink' : 'text-terminal-muted hover:text-terminal-sub'
            }`}
          >
            <Icon size={13} />
            {label}
            {tab === key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-terminal-accent" />}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-4" role="tabpanel">
        {tab === 'overview' && (
          <>
            <Section title="Indicateurs clés" icon={<Activity size={13} />} aside={<span className="font-mono text-[10px] text-terminal-muted">{ind.gdp_year}</span>}>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="PIB nominal" value={fmt.usd(ind.gdp_usd)} sub={<SourceNote source={sources.gdp_usd} />} />
                <StatTile label="Croissance réelle" value={fmt.pct(ind.gdp_growth, true)} sub={`${fmt.signed(growthDelta)} pt vs moy. 5 ans`} title={sources.gdp_growth} />
                <StatTile label="Dette / PIB" value={`${fmt.num(ind.debt_gdp, 0)} %`} sub={<SourceNote source={sources.debt_gdp} />} />
                <StatTile label="Inflation" value={fmt.pct(ind.inflation)} sub={<SourceNote source={sources.inflation} />} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-terminal-muted">
                <div title={sources.current_account}>
                  Balance courante <span className="font-mono text-terminal-sub">{fmt.pct(ind.current_account, true)}</span>
                </div>
                <div title={sources.pop_growth}>
                  Démographie <span className="font-mono text-terminal-sub">{fmt.pct(ind.pop_growth, true)}/an</span>
                </div>
              </div>
              <div className="mt-4">
                <GrowthBars history={ind.growth_history} />
              </div>
            </Section>

            <Section title="Sentiment & confiance" icon={<Gauge size={13} />}>
              <div className="flex flex-col items-center">
                <ConfidenceGauge score={confidence.score} size={220} />
                <div className="text-[11px] text-terminal-muted">Pessimiste &lt; 40 · Neutre 40-60 · Optimiste &gt; 60</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Macro (40 %)', v: confidence.components.macro },
                  { label: 'Dette & CA (30 %)', v: confidence.components.fiscal },
                  { label: 'Actualité (30 %)', v: confidence.components.sentiment },
                ].map((c) => (
                  <div key={c.label} className="rounded-md border border-terminal-line bg-white/[0.03] px-2 py-1.5">
                    <div className="font-mono text-sm font-semibold text-terminal-ink">{fmt.num(c.v, 0)}</div>
                    <div className="text-[10px] text-terminal-muted">{c.label}</div>
                  </div>
                ))}
              </div>
              <h4 className="mb-2 mt-4 text-xs font-medium text-terminal-sub">Contribution de chaque facteur (vs neutre 50)</h4>
              <FactorBars country={country} />
            </Section>
          </>
        )}

        {tab === 'dependencies' && (
          <>
            <Section
              title="Profil d’exposition externe"
              icon={<RadarIcon size={13} />}
              aside={
                country.dependencies?.exposure.score != null ? (
                  <span className="flex items-center font-mono text-lg font-semibold text-terminal-ink">
                    {fmt.num(country.dependencies.exposure.score, 0)}
                    <span className="text-xs text-terminal-muted">&nbsp;/ 100</span>
                    <GlobeLink filter="exposure" active={activeFilter === 'exposure'} onClick={onShowOnGlobe} />
                  </span>
                ) : undefined
              }
            >
              <ExposureRadar series={[{ country, color: '#d55181' }]} />
              {country.dependencies && (
                <p className="mt-1 text-[11px] leading-relaxed text-terminal-muted">
                  Principales dépendances :{' '}
                  <span className="text-terminal-sub">
                    {[...country.dependencies.exposure.axes]
                      .filter((a) => a.value !== null)
                      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                      .slice(0, 3)
                      .map((a) => `${a.label} (${fmt.num(a.value ?? 0, 0)})`)
                      .join(', ')}
                  </span>
                  . Chaque axe est ramené à 0-100 ; l’indice en est la moyenne.
                </p>
              )}
            </Section>

            <Section title="Partenaires commerciaux" icon={<Network size={13} />}>
              <PartnersBlock country={country} activeFilter={activeFilter} onShowOnGlobe={onShowOnGlobe} />
            </Section>

            {DEP_SECTIONS.map((section) => (
              <Section key={section.title} title={section.title} icon={<Scale size={13} />}>
                <DependencyRows country={country} rows={section.rows} activeFilter={activeFilter} onShowOnGlobe={onShowOnGlobe} />
              </Section>
            ))}

            <Section title="Tourisme" icon={<Plane size={13} />}>
              <div className="space-y-3">
                <Meter label="Recettes, % des exportations" value={ind.tourism_exports_pct} max={50} color="#d95926" valueLabel={fmt.pct(ind.tourism_exports_pct)} />
                <Meter label="Recettes, % du PIB" value={ind.tourism_gdp_pct} max={25} color="#d95926" valueLabel={fmt.pct(ind.tourism_gdp_pct)} />
                <p className="text-[10px] text-terminal-muted">
                  Source : <SourceNote source={sources.tourism_exports_pct} />
                </p>
              </div>
            </Section>

            <Section
              title="Dollar US"
              icon={<DollarSign size={13} />}
              aside={
                <span className="font-mono text-lg font-semibold text-terminal-ink">
                  {fmt.num(usd.score, 0)}
                  <span className="text-xs text-terminal-muted"> / 100</span>
                </span>
              }
            >
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label="Décomposition du score de dépendance au USD">
                {USD_PARTS.map((p, i) =>
                  usd.components[p.key] > 0 ? (
                    <div key={p.key} style={{ width: `${usd.components[p.key]}%`, background: COLORS.series[i] }} title={`${p.label} : ${fmt.num(usd.components[p.key])} / ${p.max}`} />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[11px]">
                {USD_PARTS.map((p, i) => (
                  <li key={p.key} className="flex items-center gap-2 text-terminal-sub">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: COLORS.series[i] }} />
                    {p.label}
                    <span className="ml-auto font-mono tabular-nums text-terminal-ink">
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
              <p className="mt-3 text-[10px] leading-relaxed text-terminal-muted">
                Matières premières : {fmt.num(usd.inputs.commodity_export_share * 100, 0)} % des exportations de biens (<SourceNote source={sources.commo} />).
                {country.data_quality.usd_proxies.length > 0 && <> Estimé par régime et région : {country.data_quality.usd_proxies.join(', ').toLowerCase()}.</>}
              </p>
            </Section>
          </>
        )}

        {tab === 'news' && (
          <Section
            title="Actualité économique du jour"
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
                <div className="font-mono text-3xl font-semibold text-terminal-ink">
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
              <ul className="mt-4 space-y-3">
                {sentiment.headlines.map((h) => (
                  <li key={h.url || h.title} className="group flex gap-2.5 text-[13px] leading-snug">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: h.compound > 0.05 ? COLORS.up : h.compound < -0.05 ? COLORS.down : COLORS.muted }}
                      aria-hidden
                    />
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-terminal-sub transition group-hover:text-terminal-ink">
                      {h.title}
                      <span className="mt-0.5 block text-[10px] text-terminal-muted">
                        {h.source && `${h.source} · `}
                        sentiment {fmt.signed(h.compound, 2)}
                        <ExternalLink size={9} className="ml-1 inline" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-terminal-muted">Aucun titre économique récent trouvé ; sentiment neutre (50) appliqué.</p>
            )}
          </Section>
        )}

        {tab === 'projections' && (
          <Section title={`Scénario · ${projection.scenario}`} icon={<LineChartIcon size={13} />}>
            <div className="mb-5 grid grid-cols-2 gap-2">
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
            <details className="mt-4 text-[11px] text-terminal-muted">
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
        )}

        {country.data_quality.estimated.length > 0 && (
          <p className="mx-5 mt-2 rounded-md border border-terminal-accent/25 bg-terminal-accent/[0.06] px-3 py-2 text-[11px] leading-relaxed text-terminal-sub">
            <span className="font-medium text-terminal-accent">Données estimées</span> (médiane régionale, faute de série publiée) :{' '}
            {country.data_quality.estimated.join(', ')}.
          </p>
        )}
      </div>
    </aside>
  );
}
