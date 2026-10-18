import type { Country, FilterKey } from '../types';

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

function interpolateRamp(ramp: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(ramp[i]);
  const b = hexToRgb(ramp[i + 1]);
  return rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
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
  kind: 'sequential' | 'diverging';
  stops: string[];
  ticks: { at: number; label: string }[];
  caption: string;
}

export interface FilterDef {
  key: FilterKey;
  label: string;
  short: string;
  description: string;
  value: (c: Country) => number;
  format: (c: Country) => string;
  color: (c: Country) => string;
  legend: LegendSpec;
  higherIsBetter: boolean | null;
}

function trajectoryDelta(c: Country, horizon: 10 | 25): number {
  const target = horizon === 10 ? c.projection.stability_10 : c.projection.stability_25;
  return target - c.confidence.score;
}

const gdpLog = (c: Country) => Math.log10(Math.max(c.indicators.gdp_usd, 1e9));

const TRAJ_TICKS = [
  { at: 0, label: '≤ −20' },
  { at: 0.25, label: '−10' },
  { at: 0.5, label: '0' },
  { at: 0.75, label: '+10' },
  { at: 1, label: '≥ +20' },
];

export const FILTERS: Record<FilterKey, FilterDef> = {
  confidence: {
    key: 'confidence',
    label: 'Santé globale / Confiance',
    short: 'Confiance',
    description: 'Indice 0-100 : 40 % dynamique macro, 30 % dette & balance courante, 30 % sentiment de l’actualité.',
    value: (c) => c.confidence.score,
    format: (c) => `${fmt.num(c.confidence.score)} / 100 · ${c.confidence.label}`,
    color: (c) => confidenceColor(c.confidence.score),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: [{ at: 0, label: '≤ 20' }, { at: 1 / 3, label: '40' }, { at: 0.5, label: '50' }, { at: 2 / 3, label: '60' }, { at: 1, label: '≥ 80' }], caption: 'Pessimiste ← Neutre → Optimiste' },
    higherIsBetter: true,
  },
  gdp: {
    key: 'gdp',
    label: 'PIB & Croissance',
    short: 'PIB',
    description: 'Couleur = PIB nominal (échelle log). Hauteur du relief = croissance réelle annuelle.',
    value: (c) => c.indicators.gdp_usd,
    format: (c) => `${fmt.usd(c.indicators.gdp_usd)} · croissance ${fmt.pct(c.indicators.gdp_growth, true)}`,
    color: (c) => interpolateRamp(BLUE_RAMP, (gdpLog(c) - 11.3) / (13.5 - 11.3)),
    legend: { kind: 'sequential', stops: BLUE_RAMP, ticks: [{ at: 0, label: '200 Md$' }, { at: 0.32, label: '1 T$' }, { at: 0.64, label: '5 T$' }, { at: 1, label: '30 T$' }], caption: 'PIB nominal (USD courants, log)' },
    higherIsBetter: null,
  },
  tourism: {
    key: 'tourism',
    label: 'Dépendance au tourisme',
    short: 'Tourisme',
    description: 'Recettes du tourisme international en % des exportations totales.',
    value: (c) => c.indicators.tourism_exports_pct,
    format: (c) => `${fmt.pct(c.indicators.tourism_exports_pct)} des exportations · ${fmt.pct(c.indicators.tourism_gdp_pct)} du PIB`,
    color: (c) => interpolateRamp(ORANGE_RAMP, Math.sqrt(c.indicators.tourism_exports_pct / 25)),
    legend: { kind: 'sequential', stops: ORANGE_RAMP, ticks: [{ at: 0, label: '0 %' }, { at: 0.4, label: '4 %' }, { at: 0.63, label: '10 %' }, { at: 1, label: '≥ 25 %' }], caption: 'Tourisme, % des exportations' },
    higherIsBetter: false,
  },
  usd: {
    key: 'usd',
    label: 'Dépendance au dollar US',
    short: 'USD',
    description: 'Score 0-100 : régime de change, matières premières en USD, dette externe en USD, facturation et dépôts en USD.',
    value: (c) => c.usd.score,
    format: (c) => `${fmt.num(c.usd.score)} / 100 · ${c.usd.regime_label}`,
    color: (c) => interpolateRamp(BLUE_RAMP, c.usd.score / 90),
    legend: { kind: 'sequential', stops: BLUE_RAMP, ticks: [{ at: 0, label: '0' }, { at: 1 / 3, label: '30' }, { at: 2 / 3, label: '60' }, { at: 1, label: '≥ 90' }], caption: 'Score de dépendance au USD' },
    higherIsBetter: false,
  },
  traj10: {
    key: 'traj10',
    label: 'Trajectoire à 10 ans',
    short: '+10 ans',
    description: 'Évolution projetée du score de stabilité à +10 ans (scénario « Continuité actuelle »).',
    value: (c) => trajectoryDelta(c, 10),
    format: (c) =>
      `Stabilité ${fmt.signed(trajectoryDelta(c, 10))} pts · TCAM PIB ${fmt.pct(c.projection.cagr_10, true)}`,
    color: (c) => interpolateRamp(DIVERGING, (trajectoryDelta(c, 10) + 20) / 40),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: TRAJ_TICKS, caption: 'Variation du score de stabilité (pts)' },
    higherIsBetter: true,
  },
  traj25: {
    key: 'traj25',
    label: 'Trajectoire à 25 ans',
    short: '+25 ans',
    description: 'Évolution projetée du score de stabilité à +25 ans (scénario « Continuité actuelle »).',
    value: (c) => trajectoryDelta(c, 25),
    format: (c) =>
      `Stabilité ${fmt.signed(trajectoryDelta(c, 25))} pts · TCAM PIB ${fmt.pct(c.projection.cagr_25, true)}`,
    color: (c) => interpolateRamp(DIVERGING, (trajectoryDelta(c, 25) + 20) / 40),
    legend: { kind: 'diverging', stops: DIVERGING, ticks: TRAJ_TICKS, caption: 'Variation du score de stabilité (pts)' },
    higherIsBetter: true,
  },
};

export const FILTER_ORDER: FilterKey[] = ['confidence', 'gdp', 'tourism', 'usd', 'traj10', 'traj25'];
