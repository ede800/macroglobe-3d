// Shapes of public/data/macro_data.json, produced by scripts/update_macro_data.py.

export type ConfidenceLabel = 'Pessimiste' | 'Neutre' | 'Optimiste';
export type SentimentStatus = 'live' | 'cache' | 'neutral';
export type UsdRegime =
  | 'dollarized'
  | 'hard_peg'
  | 'managed_usd'
  | 'managed_basket'
  | 'free_float'
  | 'euro_peg'
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
  population?: number | null; // UN WPP medium variant when available
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
    population_trend?: number;
    fertility_drag_25?: number;
    aging_drag_25?: number;
  };
  cagr_10: number;
  cagr_25: number;
  gdp_10: number;
  gdp_25: number;
  stability_10: number;
  stability_25: number;
  debt_10: number;
  debt_25: number;
  population_10?: number | null;
  population_25?: number | null;
  series: ProjectionPoint[];
}

export interface DependencyIndicator {
  label: string;
  value: number | null;
  source: string | null;
}

export type DependencyKey =
  | 'energy_net_imports'
  | 'fuel_imports'
  | 'food_imports'
  | 'remittances'
  | 'aid'
  | 'resource_rents'
  | 'trade_openness'
  | 'fdi'
  | 'external_debt'
  | 'debt_service'
  | 'reserves_months';

export interface PartnerShare {
  share: number; // % of total goods trade (exports + imports)
  exports: number | null;
  imports: number | null;
}

export interface TradePartners {
  year: number;
  source: string;
  china: PartnerShare | null; // null for China itself
  us: PartnerShare | null; // null for the US itself
  eu: PartnerShare | null;
}

export type ExposureAxisKey =
  | 'china'
  | 'us'
  | 'energy'
  | 'food'
  | 'remittances'
  | 'aid'
  | 'commodities'
  | 'tourism'
  | 'usd'
  | 'external_debt';

export interface ExposureAxis {
  key: ExposureAxisKey;
  label: string;
  value: number | null; // 0-100 intensity
}

export interface Dependencies {
  indicators: Record<DependencyKey, DependencyIndicator>;
  partners: TradePartners | null;
  exposure: { score: number | null; axes: ExposureAxis[] };
}

export type FertilityStatus = 'Hiver démographique' | 'Sous le seuil de renouvellement' | 'Stable' | 'Boom démographique';

export interface Demography {
  population: number | null;
  population_growth: number;
  fertility_rate: number | null; // children per woman, replacement = 2.1
  fertility_status: FertilityStatus | null;
  life_expectancy: number | null;
  median_age: number | null;
  share_65plus: number | null;
  population_projection: { year: number; population: number }[];
  sources: Record<string, string>;
}

export interface Society {
  hdi: number | null; // 0-1
  gini: number | null; // 0-100
  gdp_ppp_per_capita: number | null; // current international $
  unemployment: number | null; // %
  corruption_cpi: number | null; // 0 (very corrupt) - 100 (very clean)
  low_carbon_electricity: number | null; // % of electricity
  energy_self_sufficiency: number | null; // % of energy use produced domestically (capped at 100 in display)
  sources: Record<string, string>;
}

export type PoliticalCategory =
  | 'Extrême-Gauche / Communiste'
  | 'Gauche / Social-démocrate'
  | 'Centre / Libéral'
  | 'Droite / Conservateur'
  | 'Droite Nationaliste / Extrême-Droite'
  | 'Monarchie Absolue / Théocratie / Autre';

export interface Leader {
  name: string;
  title: string | null;
  party: string | null;
  since: number | null;
  photo_url: string | null;
  wikidata: string;
}

export interface Politics {
  political_category: PoliticalCategory | null; // null = party without positioning data (unclassified)
  political_position_score: number | null; // -100 far left .. +100 far right
  regime_type: string | null;
  ruling_party: { name: string | null; ideology: string | null } | null;
  leaders: Leader[];
  source: string;
}

export interface DataQuality {
  score: number; // % of core indicators backed by World Bank / IMF data (not estimated)
  estimated: string[];
  usd_proxies: string[];
}

export interface Country {
  iso3: string;
  iso2: string;
  name: string;
  name_fr: string; // filled client-side via Intl.DisplayNames when the pipeline has no French name
  region: string;
  income: string | null;
  currency: string | null;
  stale?: boolean;
  data_quality: DataQuality;
  lat: number;
  lng: number;
  gdp_rank: number;
  indicators: Indicators;
  sources: Record<string, string>;
  usd: UsdDependence;
  dependencies?: Dependencies;
  demography?: Demography;
  society?: Society;
  politics?: Politics | null;
  confidence: Confidence;
  sentiment: Sentiment;
  projection: Projection;
}

export interface MacroMeta {
  schema_version: number;
  generated_at: string;
  mode: 'online' | 'offline';
  status: { world_bank: string; imf?: string; trade?: string; owid?: string; politics?: string; news: string };
  imf_vintage?: string | null;
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

export type FilterKey =
  | 'confidence'
  | 'gdp'
  | 'ppp'
  | 'growth'
  | 'debt'
  | 'traj10'
  | 'traj25'
  // demography & society
  | 'population'
  | 'fertility'
  | 'median_age'
  | 'life_expectancy'
  | 'hdi'
  | 'gini'
  | 'corruption'
  | 'unemployment'
  // politics
  | 'politics'
  // dependency filters
  | 'exposure'
  | 'tourism'
  | 'usd'
  | 'china'
  | 'us_trade'
  | 'eu_trade'
  | 'energy'
  | 'food'
  | 'remittances'
  | 'aid'
  | 'external_debt'
  | 'reserves';

export interface CountryFeature {
  type: 'Feature';
  properties: { ISO_A3: string; NAME: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}

export interface CountryCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

export type PoliticalBloc = 'all' | 'left' | 'center' | 'right';
export type DemographicTrend = 'all' | 'decline' | 'growth';
export type MoodFilter = 'all' | 'optimist' | 'pessimist';

export interface QuickFilters {
  bloc: PoliticalBloc;
  demography: DemographicTrend;
  mood: MoodFilter;
}
