// Shapes of public/data/macro_data.json, produced by scripts/update_macro_data.py.

export type ConfidenceLabel = 'Pessimiste' | 'Neutre' | 'Optimiste';
export type SentimentStatus = 'live' | 'cache' | 'neutral';
export type UsdRegime =
  | 'dollarized'
  | 'hard_peg'
  | 'managed_usd'
  | 'managed_basket'
  | 'free_float'
  | 'euro_member'
  | 'issuer';

export interface GrowthPoint {
  year: number;
  value: number;
}

export interface Indicators {
  gdp_usd: number;
  gdp_year: number;
  gdp_growth: number;
  growth_5y_avg: number;
  growth_history: GrowthPoint[];
  inflation: number;
  debt_gdp: number;
  current_account: number;
  pop_growth: number;
  tourism_exports_pct: number;
  tourism_gdp_pct: number;
}

export interface UsdDependence {
  score: number;
  regime: UsdRegime;
  regime_label: string;
  tags: string[];
  components: {
    regime: number;
    commodities: number;
    external_debt: number;
    invoicing: number;
    deposits: number;
  };
  inputs: {
    commodity_export_share: number;
    usd_external_debt_share: number;
    usd_invoicing_share: number;
    fx_deposit_share: number;
  };
}

export interface ConfidenceFactor {
  label: string;
  weight: number;
  subscore: number;
  impact: number;
  detail: string;
}

export interface Confidence {
  score: number;
  label: ConfidenceLabel;
  components: { macro: number; fiscal: number; sentiment: number };
  subscores: {
    growth: number;
    inflation: number;
    debt: number;
    current_account: number;
    sentiment: number;
  };
  factors: ConfidenceFactor[];
}

export interface Headline {
  title: string;
  url: string;
  source: string;
  compound: number;
}

export interface Sentiment {
  compound: number;
  score: number;
  n_articles: number;
  source: string;
  status: SentimentStatus;
  as_of: string;
  headlines: Headline[];
  history: { date: string; score: number }[];
}

export interface ProjectionPoint {
  year: number;
  gdp: number; // USD bn, constant base-year prices
  growth: number;
  debt: number;
  stability: number;
}

export interface Projection {
  scenario: string;
  base_year: number;
  unit: string;
  assumptions: {
    growth_ma5: number;
    long_run_growth: number;
    debt_drag: number;
    confidence_adjustment: number;
    real_interest_rate: number;
  };
  cagr_10: number;
  cagr_25: number;
  gdp_10: number;
  gdp_25: number;
  stability_10: number;
  stability_25: number;
  debt_10: number;
  debt_25: number;
  series: ProjectionPoint[];
}

export interface Country {
  iso3: string;
  iso2: string;
  name: string;
  name_fr: string;
  region: string;
  currency: string;
  lat: number;
  lng: number;
  gdp_rank: number;
  indicators: Indicators;
  sources: Record<string, string>;
  usd: UsdDependence;
  confidence: Confidence;
  sentiment: Sentiment;
  projection: Projection;
}

export interface MacroMeta {
  schema_version: number;
  generated_at: string;
  mode: 'online' | 'offline';
  status: { world_bank: string; news: string };
  country_count: number;
  sources: { name: string; url: string }[];
  methodology: {
    confidence_weights: Record<string, number>;
    usd_weights: Record<string, number>;
    notes: string[];
    [key: string]: unknown;
  };
}

export interface MacroData {
  meta: MacroMeta;
  countries: Country[];
}

export type FilterKey = 'confidence' | 'gdp' | 'tourism' | 'usd' | 'traj10' | 'traj25';

export interface CountryFeature {
  type: 'Feature';
  properties: { ISO_A3: string; NAME: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

export interface CountryCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}
