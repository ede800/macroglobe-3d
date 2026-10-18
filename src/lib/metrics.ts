import type { Country, DependencyKey, ExposureAxisKey, FilterKey, MacroData, PoliticalCategory, QuickFilters } from '../types';

// ---------------------------------------------------------------------------
// Color ramps (dark surface). Sequential: near-zero recedes toward the dark
// surface, high values get brighter. Diverging: red <-> gray midpoint <-> blue.
// ---------------------------------------------------------------------------

export const COLORS = {
  surface: '#0c1017',
  ink: '#f0efec',
  sub: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  accent: '#f5a623',
  down: '#e66767',
  up: '#3987e5',
  neutral: '#383835',
  noData: '#151a22',
  // categorical slots (dark-mode steps), used in fixed order
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};

const BLUE_RAMP = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
const ORANGE_RAMP = ['#3a1708', '#6b2a0f', '#a33f16', '#d95926', '#ec7b4b', '#f4a57f', '#fbd2bb'];
const DIVERGING = ['#e66767', '#b85250', '#7a3f3d', '#383835', '#2c4f7a', '#2f6cb4', '#3987e5'];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** One-hue sequential ramp for the dark surface: near-zero recedes into the background, high values glow. */
function hueRamp(hex: string): string[] {
  const mix = (a: string, b: string, t: number) => {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  };
  return [mix(hex, '#05070b', 0.82), mix(hex, '#05070b', 0.62), mix(hex, '#05070b', 0.38), hex, mix(hex, '#ffffff', 0.3), mix(hex, '#ffffff', 0.58)];
}

function interpolateRamp(ramp: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(ramp[i]);
  const b = hexToRgb(ramp[i + 1]);
  return rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function rampColor(stops: string[], t: number): string {
  return interpolateRamp(stops, t);
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const fmt = {
  usd(value: number): string {
    if (value >= 1e12) return `${nf1.format(value / 1e12)} T$`;
    if (value >= 1e9) return `${nf0.format(value / 1e9)} Md$`;
    return `${nf0.format(value / 1e6)} M$`;
  },
  usdBn(bn: number): string {
    return bn >= 1000 ? `${nf1.format(bn / 1000)} T$` : `${nf0.format(bn)} Md$`;
  },
  pct(value: number, signed = false): string {
    const s = nf1.format(value);
    return `${signed && value > 0 ? '+' : ''}${s} %`;
  },
  num(value: number, digits = 1): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  },
  signed(value: number, digits = 1): string {
    return `${value > 0 ? '+' : ''}${fmt.num(value, digits)}`;
  },
  date(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  },
};

export function flagUrl(iso2: string, width: 40 | 80 = 40): string {
  return `https://flagcdn.com/w${width}/${iso2.toLowerCase()}.png`;
}

export function confidenceTone(score: number): 'down' | 'neutral' | 'up' {
  if (score < 40) return 'down';
  if (score > 60) return 'up';
  return 'neutral';
}

export function confidenceColor(score: number): string {
  return interpolateRamp(DIVERGING, (score - 20) / 60);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface LegendSpec {
  kind: 'sequential' | 'diverging' | 'categorical';
  stops: string[];
  ticks: { at: number; label: string }[];
  caption: string;
}

export interface FilterDef {
  key: FilterKey;
  /** false when the country has no data for this metric (drawn as "no data", left out of rankings) */
  available: (c: Country) => boolean;
  label: string;
  short: string;
  description: string;
  value: (c: Country) => number;
  format: (c: Country) => string;
  /** short value for rankings and the ticker */
  compact: (c: Country) => string;
  /** 0-1 position of the country on the color scale (shared by the globe, the legend and the histogram) */
  position: (c: Country) => number;
  color: (c: Country) => string;
  legend: LegendSpec;
  higherIsBetter: boolean | null;
  /** categorical filters (politics, fertility bands): legend swatches + category of each country */
  categories?: { label: string; color: string }[];
  categoryOf?: (c: Country) => number | null;
}

function trajectoryDelta(c: Country, horizon: 10 | 25): number {
  const target = horizon === 10 ? c.projection.stability_10 : c.projection.stability_25;
  return target - c.confidence.score;
}

const gdpLog = (c: Country) => Math.log10(Math.max(c.indicators.gdp_usd, 1e8));

const TRAJ_TICKS = [
  { at: 0, label: '≤ −20' },
  { at: 0.25, label: '−10' },
  { at: 0.5, label: '0' },
  { at: 0.75, label: '+10' },
  { at: 1, label: '≥ +20' },
];

const RED_RAMP = hueRamp('#e66767');
const VIOLET_RAMP = hueRamp('#9085e9');
const AMBER_RAMP = hueRamp('#d99a1e');
const AQUA_RAMP = hueRamp('#1fb27e');
const MAGENTA_RAMP = hueRamp('#d55181');

const always = () => true;

export const POLITICAL_COLORS: { label: PoliticalCategory; color: string }[] = [
  { label: 'Extrême-Gauche / Communiste', color: '#e5252f' },
  { label: 'Gauche / Social-démocrate', color: '#f47c6c' },
  { label: 'Centre / Libéral', color: '#f2b318' },
  { label: 'Droite / Conservateur', color: '#3b78f0' },
  { label: 'Droite Nationaliste / Extrême-Droite', color: '#4a3fc4' },
  { label: 'Monarchie Absolue / Théocratie / Autre', color: '#a35be8' },
];

export const POLITICAL_SHORT = ['Ext. gauche / Communiste', 'Gauche', 'Centre', 'Droite', 'Nationaliste / Ext. droite', 'Monarchie / Autre'];

export function politicalIndex(c: Country): number | null {
  const cat = c.politics?.political_category;
  if (!cat) return null;
  const idx = POLITICAL_COLORS.findIndex((p) => p.label === cat);
  return idx < 0 ? null : idx;
}

export const FERTILITY_BANDS = [
  { label: '< 1,5 · hiver démographique', color: '#e5484d' },
  { label: '1,5 - 2,1 · sous le renouvellement', color: '#f5c518' },
  { label: '2,1 - 2,5 · optimal', color: '#10b981' },
  { label: '> 2,5 · boom démographique', color: '#3b82f6' },
];

export function fertilityBand(tfr: number | null): number | null {
  if (tfr === null) return null;
  if (tfr < 1.5) return 0;
  if (tfr < 2.1) return 1;
  if (tfr <= 2.5) return 2;
  return 3;
}

export function fmtPopulation(v: number): string {
  if (v >= 1e9) return `${fmt.num(v / 1e9, 2)} Md hab.`;
  if (v >= 1e6) return `${fmt.num(v / 1e6, v >= 1e8 ? 0 : 1)} M hab.`;
  return `${fmt.num(v / 1e3, 0)} k hab.`;
}

const depValue = (c: Country, k: DependencyKey) => c.dependencies?.indicators[k]?.value ?? null;
const partnerShare = (c: Country, p: 'china' | 'us' | 'eu') => c.dependencies?.partners?.[p]?.share ?? null;
const axisValue = (c: Country, k: ExposureAxisKey) => c.dependencies?.exposure.axes.find((a) => a.key === k)?.value ?? null;

interface MetricSpec {
  key: FilterKey;
  label: string;
  short: string;
  description: string;
  get: (c: Country) => number | null;
  show: (v: number) => string;
  /** shorter value for rankings (defaults to show) */
  brief?: (v: number) => string;
  detail?: (c: Country) => string;
  scale: (v: number) => number;
  ramp: string[];
  ticks: { at: number; label: string }[];
  caption: string;
  higherIsBetter: boolean | null;
}

/** Filter over a value that may be missing for some countries. */
function metric(m: MetricSpec): FilterDef {
  const pos = (c: Country) => clamp01(m.scale(m.get(c) ?? 0));
  return {
    key: m.key,
    available: (c) => m.get(c) !== null,
    label: m.label,
    short: m.short,
    description: m.description,
    value: (c) => m.get(c) ?? Number.NEGATIVE_INFINITY,
    format: (c) => {
      const v = m.get(c);
      if (v === null) return 'Donnée indisponible';
      const extra = m.detail?.(c);
      return extra ? `${m.show(v)} · ${extra}` : m.show(v);
    },
    compact: (c) => {
      const v = m.get(c);
      return v === null ? 'n.d.' : (m.brief ?? m.show)(v);
    },
    position: pos,
    color: (c) => interpolateRamp(m.ramp, pos(c)),
    legend: { kind: 'sequential', stops: m.ramp, ticks: m.ticks, caption: m.caption },
    higherIsBetter: m.higherIsBetter,
  };
}

const pctTicks = (max: number, steps: number[]) => [
  ...steps.map((v) => ({ at: v / max, label: `${v} %` })),
  { at: 1, label: `≥ ${max} %` },
];

const sqrtTicks = (max: number, steps: number[]) => [
  { at: 0, label: '0 %' },
  ...steps.map((v) => ({ at: Math.sqrt(v / max), label: `${v} %` })),
  { at: 1, label: `≥ ${max} %` },
];

function partnerDetail(c: Country, p: 'china' | 'us' | 'eu'): string {
  const s = c.dependencies?.partners?.[p];
  if (!s) return '';
  return `export. ${s.exports === null ? 'n.d.' : fmt.pct(s.exports)} · import. ${s.imports === null ? 'n.d.' : fmt.pct(s.imports)}`;
}

export const FILTERS: Record<FilterKey, FilterDef> = {
  confidence: {
    key: 'confidence',
    available: always,
    compact: (c) => fmt.num(c.confidence.score),
    label: 'Santé globale / Confiance',
    short: 'Confiance',
    description: 'Indice 0-100 : 40 % dynamique macro, 30 % dette & balance courante, 30 % sentiment de l’actualité.',
    value: (c) => c.confidence.score,
    format: (c) => `${fmt.num(c.confidence.score)} / 100 · ${c.confidence.label}`,
    position: (c) => clamp01((c.confidence.score - 20) / 60),
    color: (c) => confidenceColor(c.confidence.score),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: [{ at: 0, label: '≤ 20' }, { at: 1 / 3, label: '40' }, { at: 0.5, label: '50' }, { at: 2 / 3, label: '60' }, { at: 1, label: '≥ 80' }], caption: 'Pessimiste ← Neutre → Optimiste' },
    higherIsBetter: true,
  },
  gdp: {
    key: 'gdp',
    available: always,
    compact: (c) => fmt.usd(c.indicators.gdp_usd),
    label: 'PIB & Croissance',
    short: 'PIB',
    description: 'Couleur = PIB nominal (échelle log). Hauteur du relief = croissance réelle annuelle.',
    value: (c) => c.indicators.gdp_usd,
    format: (c) => `${fmt.usd(c.indicators.gdp_usd)} · croissance ${fmt.pct(c.indicators.gdp_growth, true)}`,
    position: (c) => clamp01((gdpLog(c) - 9) / 4.5),
    color: (c) => interpolateRamp(BLUE_RAMP, clamp01((gdpLog(c) - 9) / 4.5)),
    legend: {
      kind: 'sequential',
      stops: BLUE_RAMP,
      ticks: [{ at: 0, label: '1 Md$' }, { at: 0.222, label: '10' }, { at: 0.444, label: '100' }, { at: 0.667, label: '1 T$' }, { at: 1, label: '30 T$' }],
      caption: 'PIB nominal (USD courants, échelle log)',
    },
    higherIsBetter: null,
  },
  tourism: {
    key: 'tourism',
    available: always,
    compact: (c) => fmt.pct(c.indicators.tourism_exports_pct),
    label: 'Dépendance au tourisme',
    short: 'Tourisme',
    description: 'Recettes du tourisme international en % des exportations totales.',
    value: (c) => c.indicators.tourism_exports_pct,
    format: (c) => `${fmt.pct(c.indicators.tourism_exports_pct)} des exportations · ${fmt.pct(c.indicators.tourism_gdp_pct)} du PIB`,
    position: (c) => clamp01(Math.sqrt(Math.max(0, c.indicators.tourism_exports_pct) / 50)),
    color: (c) => interpolateRamp(ORANGE_RAMP, clamp01(Math.sqrt(Math.max(0, c.indicators.tourism_exports_pct) / 50))),
    legend: {
      kind: 'sequential',
      stops: ORANGE_RAMP,
      ticks: [{ at: 0, label: '0 %' }, { at: 0.316, label: '5 %' }, { at: 0.548, label: '15 %' }, { at: 0.775, label: '30 %' }, { at: 1, label: '≥ 50 %' }],
      caption: 'Tourisme, % des exportations (échelle racine)',
    },
    higherIsBetter: false,
  },
  usd: {
    key: 'usd',
    available: always,
    compact: (c) => `${fmt.num(c.usd.score, 0)} / 100`,
    label: 'Dépendance au dollar US',
    short: 'USD',
    description: 'Score 0-100 : régime de change, matières premières en USD, dette externe en USD, facturation et dépôts en USD.',
    value: (c) => c.usd.score,
    format: (c) => `${fmt.num(c.usd.score)} / 100 · ${c.usd.regime_label}`,
    position: (c) => clamp01(c.usd.score / 90),
    color: (c) => interpolateRamp(BLUE_RAMP, clamp01(c.usd.score / 90)),
    legend: { kind: 'sequential', stops: BLUE_RAMP, ticks: [{ at: 0, label: '0' }, { at: 1 / 3, label: '30' }, { at: 2 / 3, label: '60' }, { at: 1, label: '≥ 90' }], caption: 'Score de dépendance au USD' },
    higherIsBetter: false,
  },
  traj10: {
    key: 'traj10',
    available: always,
    compact: (c) => `${fmt.signed(trajectoryDelta(c, 10))} pts`,
    label: 'Trajectoire à 10 ans',
    short: '+10 ans',
    description: 'Évolution projetée du score de stabilité à +10 ans (scénario « Continuité actuelle »).',
    value: (c) => trajectoryDelta(c, 10),
    format: (c) =>
      `Stabilité ${fmt.signed(trajectoryDelta(c, 10))} pts · TCAM PIB ${fmt.pct(c.projection.cagr_10, true)}`,
    position: (c) => clamp01((trajectoryDelta(c, 10) + 20) / 40),
    color: (c) => interpolateRamp(DIVERGING, clamp01((trajectoryDelta(c, 10) + 20) / 40)),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: TRAJ_TICKS, caption: 'Variation du score de stabilité (pts)' },
    higherIsBetter: true,
  },
  traj25: {
    key: 'traj25',
    available: always,
    compact: (c) => `${fmt.signed(trajectoryDelta(c, 25))} pts`,
    label: 'Trajectoire à 25 ans',
    short: '+25 ans',
    description: 'Évolution projetée du score de stabilité à +25 ans (scénario « Continuité actuelle »).',
    value: (c) => trajectoryDelta(c, 25),
    format: (c) =>
      `Stabilité ${fmt.signed(trajectoryDelta(c, 25))} pts · TCAM PIB ${fmt.pct(c.projection.cagr_25, true)}`,
    position: (c) => clamp01((trajectoryDelta(c, 25) + 20) / 40),
    color: (c) => interpolateRamp(DIVERGING, clamp01((trajectoryDelta(c, 25) + 20) / 40)),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: TRAJ_TICKS, caption: 'Variation du score de stabilité (pts)' },
    higherIsBetter: true,
  },
  exposure: metric({
    key: 'exposure',
    label: 'Exposition externe (indice)',
    short: 'Exposition',
    description: 'Moyenne de 10 dépendances ramenées à 0-100 : Chine, États-Unis, énergie, alimentation, diaspora, aide, matières premières, tourisme, dollar, dette extérieure.',
    get: (c) => c.dependencies?.exposure.score ?? null,
    show: (v) => `${fmt.num(v)} / 100`,
    scale: (v) => (v - 10) / 55,
    ramp: MAGENTA_RAMP,
    ticks: [{ at: 0, label: '≤ 10' }, { at: 0.364, label: '30' }, { at: 0.727, label: '50' }, { at: 1, label: '≥ 65' }],
    caption: 'Indice d’exposition externe (0-100)',
    higherIsBetter: false,
  }),
  china: metric({
    key: 'china',
    label: 'Dépendance commerciale à la Chine',
    short: 'Chine',
    description: 'Part de la Chine dans le commerce total de biens du pays (exportations + importations).',
    get: (c) => partnerShare(c, 'china'),
    show: (v) => `${fmt.pct(v)} des échanges`,
    brief: (v) => fmt.pct(v),
    detail: (c) => partnerDetail(c, 'china'),
    scale: (v) => v / 40,
    ramp: RED_RAMP,
    ticks: pctTicks(40, [0, 10, 20, 30]),
    caption: 'Part de la Chine dans le commerce de biens',
    higherIsBetter: false,
  }),
  us_trade: metric({
    key: 'us_trade',
    label: 'Dépendance commerciale aux États-Unis',
    short: 'États-Unis',
    description: 'Part des États-Unis dans le commerce total de biens du pays (exportations + importations).',
    get: (c) => partnerShare(c, 'us'),
    show: (v) => `${fmt.pct(v)} des échanges`,
    brief: (v) => fmt.pct(v),
    detail: (c) => partnerDetail(c, 'us'),
    scale: (v) => v / 40,
    ramp: BLUE_RAMP,
    ticks: pctTicks(40, [0, 10, 20, 30]),
    caption: 'Part des États-Unis dans le commerce de biens',
    higherIsBetter: false,
  }),
  eu_trade: metric({
    key: 'eu_trade',
    label: 'Dépendance commerciale à l’Union européenne',
    short: 'UE',
    description: 'Part de l’UE dans le commerce total de biens (pour les membres, inclut le commerce intra-européen).',
    get: (c) => partnerShare(c, 'eu'),
    show: (v) => `${fmt.pct(v)} des échanges`,
    brief: (v) => fmt.pct(v),
    detail: (c) => partnerDetail(c, 'eu'),
    scale: (v) => v / 70,
    ramp: VIOLET_RAMP,
    ticks: pctTicks(70, [0, 20, 40]),
    caption: 'Part de l’UE dans le commerce de biens',
    higherIsBetter: false,
  }),
  energy: metric({
    key: 'energy',
    label: 'Dépendance énergétique',
    short: 'Énergie',
    description: 'Importations nettes d’énergie en % de la consommation (0 = exportateur net). À défaut : part des carburants dans les importations.',
    get: (c) => axisValue(c, 'energy'),
    show: (v) => (v <= 0 ? 'Exportateur net' : `${fmt.num(v, 0)} % importés`),
    brief: (v) => (v <= 0 ? 'export. net' : `${fmt.num(v, 0)} %`),
    scale: (v) => v / 100,
    ramp: AMBER_RAMP,
    ticks: [{ at: 0, label: 'Export.' }, { at: 0.25, label: '25 %' }, { at: 0.5, label: '50 %' }, { at: 0.75, label: '75 %' }, { at: 1, label: '100 %' }],
    caption: 'Énergie importée, % de la consommation',
    higherIsBetter: false,
  }),
  food: metric({
    key: 'food',
    label: 'Dépendance alimentaire',
    short: 'Alimentation',
    description: 'Part des produits alimentaires dans les importations de biens.',
    get: (c) => depValue(c, 'food_imports'),
    show: (v) => `${fmt.pct(v)} des importations`,
    brief: (v) => fmt.pct(v),
    scale: (v) => v / 30,
    ramp: AQUA_RAMP,
    ticks: pctTicks(30, [0, 10, 20]),
    caption: 'Alimentation, % des importations de biens',
    higherIsBetter: false,
  }),
  remittances: metric({
    key: 'remittances',
    label: 'Dépendance aux diasporas',
    short: 'Diaspora',
    description: 'Envois de fonds des travailleurs émigrés, en % du PIB.',
    get: (c) => depValue(c, 'remittances'),
    show: (v) => `${fmt.pct(v)} du PIB`,
    brief: (v) => fmt.pct(v),
    scale: (v) => Math.sqrt(Math.max(0, v) / 30),
    ramp: VIOLET_RAMP,
    ticks: sqrtTicks(30, [2, 8, 17]),
    caption: 'Envois de fonds, % du PIB (échelle racine)',
    higherIsBetter: false,
  }),
  aid: metric({
    key: 'aid',
    label: 'Dépendance à l’aide internationale',
    short: 'Aide',
    description: 'Aide publique au développement nette reçue, en % du revenu national brut.',
    get: (c) => depValue(c, 'aid') ?? (c.income === 'HIC' ? 0 : null),
    show: (v) => `${fmt.pct(v)} du RNB`,
    brief: (v) => fmt.pct(v),
    scale: (v) => Math.sqrt(Math.max(0, v) / 20),
    ramp: AQUA_RAMP,
    ticks: sqrtTicks(20, [1, 5, 11]),
    caption: 'Aide reçue, % du RNB (échelle racine)',
    higherIsBetter: false,
  }),
  external_debt: metric({
    key: 'external_debt',
    label: 'Dette extérieure',
    short: 'Dette ext.',
    description: 'Encours de dette extérieure (publique et privée) en % du RNB — publié pour les pays à revenu faible et intermédiaire.',
    get: (c) => depValue(c, 'external_debt'),
    show: (v) => `${fmt.num(v, 0)} % du RNB`,
    brief: (v) => `${fmt.num(v, 0)} %`,
    detail: (c) => {
      const s = depValue(c, 'debt_service');
      return s === null ? '' : `service ${fmt.pct(s)} des exportations`;
    },
    scale: (v) => v / 150,
    ramp: RED_RAMP,
    ticks: [{ at: 0, label: '0 %' }, { at: 1 / 3, label: '50 %' }, { at: 2 / 3, label: '100 %' }, { at: 1, label: '≥ 150 %' }],
    caption: 'Dette extérieure, % du RNB',
    higherIsBetter: false,
  }),
  ppp: metric({
    key: 'ppp',
    label: 'Pouvoir d’achat (PIB PPA / habitant)',
    short: 'PIB PPA/hab',
    description: 'PIB par habitant en parité de pouvoir d’achat (dollars internationaux courants) : le niveau de vie corrigé du coût de la vie.',
    get: (c) => c.society?.gdp_ppp_per_capita ?? null,
    show: (v) => `${fmt.num(v / 1000, 1)} k$ PPA`,
    scale: (v) => (Math.log10(Math.max(v, 500)) - 3) / 2.1,
    ramp: AQUA_RAMP,
    ticks: [{ at: 0, label: '1 k$' }, { at: 0.476, label: '10 k$' }, { at: 0.81, label: '50 k$' }, { at: 1, label: '≥ 125 k$' }],
    caption: 'PIB PPA par habitant (échelle log)',
    higherIsBetter: true,
  }),
  growth: metric({
    key: 'growth',
    label: 'Croissance réelle du PIB',
    short: 'Croissance',
    description: 'Croissance réelle annuelle du PIB, dernière année publiée (Banque mondiale / FMI).',
    get: (c) => c.indicators.gdp_growth,
    show: (v) => fmt.pct(v, true),
    scale: (v) => (v + 6) / 12,
    ramp: DIVERGING,
    ticks: [{ at: 0, label: '≤ −6 %' }, { at: 0.25, label: '−3' }, { at: 0.5, label: '0' }, { at: 0.75, label: '+3' }, { at: 1, label: '≥ +6 %' }],
    caption: 'Récession ← 0 → Expansion',
    higherIsBetter: true,
  }),
  debt: metric({
    key: 'debt',
    label: 'Dette publique / PIB',
    short: 'Dette/PIB',
    description: 'Dette brute des administrations publiques en % du PIB (FMI en priorité).',
    get: (c) => c.indicators.debt_gdp,
    show: (v) => `${fmt.num(v, 0)} % du PIB`,
    brief: (v) => `${fmt.num(v, 0)} %`,
    scale: (v) => v / 150,
    ramp: RED_RAMP,
    ticks: [{ at: 0, label: '0 %' }, { at: 0.4, label: '60 %' }, { at: 0.6, label: '90 %' }, { at: 1, label: '≥ 150 %' }],
    caption: 'Dette publique, % du PIB',
    higherIsBetter: false,
  }),
  population: metric({
    key: 'population',
    label: 'Population totale',
    short: 'Population',
    description: 'Nombre d’habitants (Banque mondiale, à défaut ONU).',
    get: (c) => c.demography?.population ?? null,
    show: (v) => fmtPopulation(v),
    detail: (c) => `croissance ${fmt.pct(c.demography?.population_growth ?? c.indicators.pop_growth, true)}/an`,
    scale: (v) => (Math.log10(Math.max(v, 1e4)) - 5) / 4.2,
    ramp: VIOLET_RAMP,
    ticks: [{ at: 0, label: '100 k' }, { at: 0.238, label: '1 M' }, { at: 0.476, label: '10 M' }, { at: 0.714, label: '100 M' }, { at: 1, label: '1,5 Md' }],
    caption: 'Habitants (échelle log)',
    higherIsBetter: null,
  }),
  fertility: {
    ...metric({
      key: 'fertility',
      label: 'Enfants par femme (fécondité)',
      short: 'Fécondité',
      description: 'Indice synthétique de fécondité. Seuil de renouvellement des générations : 2,1 enfants par femme.',
      get: (c) => c.demography?.fertility_rate ?? null,
      show: (v) => `${fmt.num(v, 2)} enfant${v >= 2 ? 's' : ''}/femme`,
      brief: (v) => fmt.num(v, 2),
      detail: (c) => c.demography?.fertility_status ?? '',
      scale: (v) => v / 6,
      ramp: ['#e5484d', '#f5c518', '#10b981', '#3b82f6'],
      ticks: [{ at: 0.25, label: '1,5' }, { at: 0.35, label: '2,1' }, { at: 0.417, label: '2,5' }, { at: 1, label: '6' }],
      caption: 'Enfants par femme',
      higherIsBetter: null,
    }),
    legend: {
      kind: 'categorical',
      stops: [],
      ticks: [],
      caption: 'Seuil de renouvellement : 2,1 enfants par femme',
    },
    categories: FERTILITY_BANDS,
    categoryOf: (c) => fertilityBand(c.demography?.fertility_rate ?? null),
    color: (c) => {
      const band = fertilityBand(c.demography?.fertility_rate ?? null);
      return band === null ? COLORS.noData : FERTILITY_BANDS[band].color;
    },
  },
  median_age: metric({
    key: 'median_age',
    label: 'Âge médian',
    short: 'Âge médian',
    description: 'Âge qui partage la population en deux moitiés égales (ONU, World Population Prospects).',
    get: (c) => c.demography?.median_age ?? null,
    show: (v) => `${fmt.num(v, 1)} ans`,
    scale: (v) => (v - 15) / 35,
    ramp: MAGENTA_RAMP,
    ticks: [{ at: 0, label: '≤ 15' }, { at: 0.286, label: '25' }, { at: 0.571, label: '35' }, { at: 0.857, label: '45' }, { at: 1, label: '50 ans' }],
    caption: 'Âge médian (ans)',
    higherIsBetter: null,
  }),
  life_expectancy: metric({
    key: 'life_expectancy',
    label: 'Espérance de vie',
    short: 'Espérance de vie',
    description: 'Espérance de vie à la naissance, en années.',
    get: (c) => c.demography?.life_expectancy ?? null,
    show: (v) => `${fmt.num(v, 1)} ans`,
    scale: (v) => (v - 50) / 35,
    ramp: AQUA_RAMP,
    ticks: [{ at: 0, label: '≤ 50' }, { at: 0.286, label: '60' }, { at: 0.571, label: '70' }, { at: 0.857, label: '80' }, { at: 1, label: '85 ans' }],
    caption: 'Espérance de vie à la naissance',
    higherIsBetter: true,
  }),
  hdi: metric({
    key: 'hdi',
    label: 'Indice de développement humain (IDH)',
    short: 'IDH',
    description: 'IDH du PNUD (0 à 1) : santé, éducation et niveau de vie.',
    get: (c) => c.society?.hdi ?? null,
    show: (v) => fmt.num(v, 3),
    scale: (v) => (v - 0.35) / 0.62,
    ramp: BLUE_RAMP,
    ticks: [{ at: 0, label: '≤ 0,35' }, { at: 0.403, label: '0,6' }, { at: 0.726, label: '0,8' }, { at: 1, label: '0,97' }],
    caption: 'IDH (PNUD)',
    higherIsBetter: true,
  }),
  gini: metric({
    key: 'gini',
    label: 'Inégalités de revenus (indice de Gini)',
    short: 'Gini',
    description: 'Indice de Gini (0 = égalité parfaite, 100 = inégalité maximale), dernière enquête disponible.',
    get: (c) => c.society?.gini ?? null,
    show: (v) => fmt.num(v, 1),
    scale: (v) => (v - 24) / 36,
    ramp: AMBER_RAMP,
    ticks: [{ at: 0, label: '≤ 24' }, { at: 0.333, label: '36' }, { at: 0.667, label: '48' }, { at: 1, label: '≥ 60' }],
    caption: 'Indice de Gini (plus = plus inégalitaire)',
    higherIsBetter: false,
  }),
  corruption: metric({
    key: 'corruption',
    label: 'Perception de la corruption (IPC)',
    short: 'Corruption',
    description: 'Indice de perception de la corruption de Transparency International : 0 = très corrompu, 100 = très intègre.',
    get: (c) => c.society?.corruption_cpi ?? null,
    show: (v) => `${fmt.num(v, 0)} / 100`,
    scale: (v) => (v - 10) / 80,
    ramp: DIVERGING,
    ticks: [{ at: 0, label: '≤ 10' }, { at: 0.25, label: '30' }, { at: 0.5, label: '50' }, { at: 0.75, label: '70' }, { at: 1, label: '≥ 90' }],
    caption: 'Corrompu ← → Intègre',
    higherIsBetter: true,
  }),
  unemployment: metric({
    key: 'unemployment',
    label: 'Taux de chômage',
    short: 'Chômage',
    description: 'Chômeurs en % de la population active (estimation modélisée de l’OIT).',
    get: (c) => c.society?.unemployment ?? null,
    show: (v) => fmt.pct(v),
    scale: (v) => v / 25,
    ramp: RED_RAMP,
    ticks: [{ at: 0, label: '0 %' }, { at: 0.2, label: '5 %' }, { at: 0.4, label: '10 %' }, { at: 0.8, label: '20 %' }, { at: 1, label: '≥ 25 %' }],
    caption: 'Taux de chômage',
    higherIsBetter: false,
  }),
  politics: {
    key: 'politics',
    available: (c) => politicalIndex(c) !== null,
    label: 'Couleur politique du pouvoir',
    short: 'Politique',
    description: 'Camp politique du parti au pouvoir (positionnement Wikidata du parti du dirigeant exécutif principal).',
    value: (c) => c.politics?.political_position_score ?? Number.NEGATIVE_INFINITY,
    format: (c) => {
      const p = c.politics;
      if (!p) return 'Donnée indisponible';
      return [p.political_category ?? 'Non classé', p.ruling_party?.name].filter(Boolean).join(' · ');
    },
    compact: (c) => (c.politics?.political_position_score == null ? '—' : fmt.signed(c.politics.political_position_score, 0)),
    position: (c) => clamp01(((c.politics?.political_position_score ?? 0) + 100) / 200),
    color: (c) => {
      const idx = politicalIndex(c);
      return idx === null ? COLORS.noData : POLITICAL_COLORS[idx].color;
    },
    legend: { kind: 'categorical', stops: [], ticks: [], caption: 'Orientation du parti au pouvoir' },
    categories: POLITICAL_COLORS,
    categoryOf: politicalIndex,
    higherIsBetter: null,
  },
  reserves: metric({
    key: 'reserves',
    label: 'Coussin de réserves de change',
    short: 'Réserves',
    description: 'Réserves de change en mois d’importations. Sous 3 mois : seuil d’alerte usuel du FMI.',
    get: (c) => depValue(c, 'reserves_months'),
    show: (v) => `${fmt.num(v)} mois`,
    scale: (v) => v / 12,
    ramp: BLUE_RAMP,
    ticks: [{ at: 0, label: '0' }, { at: 0.25, label: '3 mois' }, { at: 0.5, label: '6' }, { at: 0.75, label: '9' }, { at: 1, label: '≥ 12' }],
    caption: 'Mois d’importations couverts (plus = plus résilient)',
    higherIsBetter: true,
  }),
};

export const FILTER_GROUPS: { id: string; label: string; sections: { group: string; keys: FilterKey[] }[] }[] = [
  {
    id: 'economy',
    label: 'Économie',
    sections: [
      { group: 'Santé économique', keys: ['confidence', 'gdp', 'ppp', 'growth', 'debt'] },
      { group: 'Exposition', keys: ['tourism', 'usd'] },
    ],
  },
  {
    id: 'dependencies',
    label: 'Dépendances',
    sections: [
      { group: 'Synthèse', keys: ['exposure'] },
      { group: 'Partenaires commerciaux', keys: ['china', 'us_trade', 'eu_trade'] },
      { group: 'Ressources & revenus', keys: ['energy', 'food', 'remittances', 'aid'] },
      { group: 'Finance', keys: ['external_debt', 'reserves'] },
    ],
  },
  {
    id: 'demography',
    label: 'Démographie',
    sections: [
      { group: 'Population', keys: ['population', 'fertility', 'median_age', 'life_expectancy'] },
      { group: 'Société', keys: ['hdi', 'gini', 'corruption', 'unemployment'] },
    ],
  },
  { id: 'projections', label: 'Projections', sections: [{ group: 'Scénario « Continuité actuelle »', keys: ['traj10', 'traj25'] }] },
];

export const DEPENDENCY_FILTERS = FILTER_GROUPS.find((g) => g.id === 'dependencies')!.sections;

export const FILTER_ORDER: FilterKey[] = [...FILTER_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.keys)), 'politics'];

export function groupOf(key: FilterKey): string | null {
  return FILTER_GROUPS.find((g) => g.sections.some((s) => s.keys.includes(key)))?.id ?? null;
}

// ---------------------------------------------------------------------------
// Quick isolation filters (pills under the top bar)
// ---------------------------------------------------------------------------

export const DEFAULT_QUICK_FILTERS: QuickFilters = { bloc: 'all', demography: 'all', mood: 'all' };

export function matchesQuickFilters(c: Country, q: QuickFilters): boolean {
  if (q.bloc !== 'all') {
    const idx = politicalIndex(c);
    if (idx === null) return false;
    if (q.bloc === 'left' && idx > 1) return false;
    if (q.bloc === 'center' && idx !== 2) return false;
    if (q.bloc === 'right' && (idx < 3 || idx > 4)) return false;
  }
  if (q.demography !== 'all') {
    const tfr = c.demography?.fertility_rate ?? null;
    if (tfr === null) return false;
    if (q.demography === 'decline' && tfr >= 2.1) return false;
    if (q.demography === 'growth' && tfr <= 2.1) return false;
  }
  if (q.mood === 'optimist' && c.confidence.score <= 60) return false;
  if (q.mood === 'pessimist' && c.confidence.score >= 40) return false;
  return true;
}

export const isQuickFilterActive = (q: QuickFilters) => q.bloc !== 'all' || q.demography !== 'all' || q.mood !== 'all';

// ---------------------------------------------------------------------------
// Data normalisation (French names for the ~160 countries the pipeline only knows in English)
// ---------------------------------------------------------------------------

const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
})();

// Shorter / more usual French names than the CLDR ones for a few territories.
const NAME_OVERRIDES: Record<string, string> = {
  MO: 'Macao',
  HK: 'Hong Kong',
  PS: 'Palestine',
  MM: 'Birmanie',
  CD: 'RD Congo',
  CG: 'Congo',
  VC: 'Saint-Vincent-et-les-Grenadines',
  BA: 'Bosnie-Herzégovine',
  VI: 'Îles Vierges (É.-U.)',
  VG: 'Îles Vierges britanniques',
  MF: 'Saint-Martin',
  XK: 'Kosovo',
};

function frenchName(iso2: string, fallback: string): string {
  const override = NAME_OVERRIDES[iso2.toUpperCase()];
  if (override) return override;
  try {
    const name = REGION_NAMES?.of(iso2.toUpperCase());
    return name && name.toUpperCase() !== iso2.toUpperCase() ? name : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeData(data: MacroData): MacroData {
  return {
    ...data,
    countries: data.countries.map((c) => ({
      ...c,
      name_fr: NAME_OVERRIDES[c.iso2.toUpperCase()] ?? (c.name_fr || frenchName(c.iso2, c.name)),
      data_quality: c.data_quality ?? { score: 100, estimated: [], usd_proxies: [] },
      currency: c.currency ?? null,
    })),
  };
}

export const INCOME_LABELS: Record<string, string> = {
  HIC: 'Revenu élevé',
  UMC: 'Revenu intermédiaire sup.',
  LMC: 'Revenu intermédiaire inf.',
  LIC: 'Faible revenu',
};
