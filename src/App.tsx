import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Globe2,
  Hourglass,
  Info,
  Radar,
  RotateCcw,
  SlidersHorizontal,
  Users,
  Vote,
  X,
  type LucideIcon,
} from 'lucide-react';
import GlobeView, { type GlobeViewHandle } from './components/GlobeView';
import CountrySidebar from './components/CountrySidebar';
import ComparisonModal from './components/ComparisonModal';
import SearchBar from './components/SearchBar';
import MapLegend from './components/MapLegend';
import WorldPanel from './components/WorldPanel';
import Ticker from './components/Ticker';
import FilterMenu from './components/FilterMenu';
import QuickFilters from './components/QuickFilters';
import type { CountryCollection, FilterKey, MacroData, QuickFilters as QuickFiltersState } from './types';
import { DEFAULT_QUICK_FILTERS, FILTER_GROUPS, FILTERS, isQuickFilterActive, matchesQuickFilters, normalizeData } from './lib/metrics';

const BASE = import.meta.env.BASE_URL;

const GROUP_ICONS: Record<string, LucideIcon> = {
  economy: BarChart3,
  dependencies: Radar,
  demography: Users,
  projections: Hourglass,
};

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: MacroData; geo: CountryCollection };

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} : HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function LoadingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-terminal-sub">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
        <defs>
          <radialGradient id="ld" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#1d3b66" />
            <stop offset="100%" stopColor="#05070b" />
          </radialGradient>
        </defs>
        <circle cx="44" cy="44" r="30" fill="url(#ld)" stroke="rgba(57,135,229,0.5)" />
        <g className="orbit">
          <ellipse cx="44" cy="44" rx="12" ry="30" fill="none" stroke="rgba(57,135,229,0.55)" />
        </g>
        <g className="orbit-slow">
          <ellipse cx="44" cy="44" rx="42" ry="14" fill="none" stroke="rgba(245,166,35,0.6)" strokeDasharray="4 6" />
          <circle cx="86" cy="44" r="3" fill="#f5a623" />
        </g>
      </svg>
      <div className="text-center">
        <div className="font-mono text-sm font-semibold tracking-[0.2em] text-terminal-ink">
          MACROGLOBE<span className="text-terminal-accent"> 3D</span>
        </div>
        <div className="mt-1 text-xs text-terminal-muted">Chargement des données macroéconomiques mondiales…</div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<FilterKey>(() => {
    const requested = new URLSearchParams(window.location.search).get('filter');
    return requested && requested in FILTERS ? (requested as FilterKey) : 'confidence';
  });
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIso, setCompareIso] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [quick, setQuick] = useState<QuickFiltersState>(DEFAULT_QUICK_FILTERS);
  const [showQuick, setShowQuick] = useState(() => window.innerWidth >= 768);
  const globeRef = useRef<GlobeViewHandle>(null);

  useEffect(() => {
    Promise.all([loadJson<MacroData>('data/macro_data.json'), loadJson<CountryCollection>('data/countries.geojson')])
      .then(([data, geo]) => setState({ status: 'ready', data: normalizeData(data), geo }))
      .catch((err: unknown) => setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, []);

  const countries = useMemo(() => (state.status === 'ready' ? state.data.countries : []), [state]);
  const byIso = useMemo(() => new Map(countries.map((c) => [c.iso3, c])), [countries]);
  const sortedByName = useMemo(() => [...countries].sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr')), [countries]);

  // Quick filters isolate a subset: others fade out on the globe and leave the legend / ranking.
  const matched = useMemo(
    () => (isQuickFilterActive(quick) ? new Set(countries.filter((c) => matchesQuickFilters(c, quick)).map((c) => c.iso3)) : null),
    [countries, quick],
  );
  const legendCountries = useMemo(() => (matched ? countries.filter((c) => matched.has(c.iso3)) : countries), [countries, matched]);

  const selected = selectedIso ? byIso.get(selectedIso) ?? null : null;
  const compared = compareIso ? byIso.get(compareIso) ?? null : null;

  const handleSelect = useCallback(
    (iso3: string) => {
      const country = byIso.get(iso3);
      if (!country) return;
      if (compareMode && selectedIso && iso3 !== selectedIso) {
        setCompareIso(iso3);
        setCompareMode(false);
        return;
      }
      setSelectedIso(iso3);
      globeRef.current?.flyTo(country);
    },
    [byIso, compareMode, selectedIso],
  );

  // Deep links: https://…/#FRA opens France directly; the hash follows the selection.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const [iso, other] = window.location.hash.slice(1).toUpperCase().split(',');
    const country = byIso.get(iso);
    if (!country) return;
    setSelectedIso(iso);
    if (other && other !== iso && byIso.has(other)) setCompareIso(other);
    const timer = window.setTimeout(() => globeRef.current?.flyTo(country), 600);
    return () => window.clearTimeout(timer);
  }, [state.status, byIso]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const params = new URLSearchParams(window.location.search);
    if (filter === 'confidence') params.delete('filter');
    else params.set('filter', filter);
    const query = params.toString();
    const hash = selectedIso ? `#${selectedIso}${compareIso ? `,${compareIso}` : ''}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${hash}`);
  }, [selectedIso, compareIso, filter, state.status]);

  const closeSidebar = useCallback(() => {
    setSelectedIso(null);
    setCompareMode(false);
    globeRef.current?.resetView();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || compared) return;
      if (compareMode) setCompareMode(false);
      else if (selectedIso) closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compareMode, compared, selectedIso, closeSidebar]);

  if (state.status === 'loading') return <LoadingScreen />;

  if (state.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="glass-panel max-w-md rounded-xl p-6 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-terminal-ink">
            <AlertTriangle size={18} className="text-terminal-accent" /> Données indisponibles
          </div>
          <p className="text-terminal-sub">{state.message}</p>
          <p className="mt-2 text-terminal-muted">
            Lancez <code className="font-mono">python scripts/update_macro_data.py --offline</code> pour régénérer le jeu de données.
          </p>
        </div>
      </div>
    );
  }

  const { meta } = state.data;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ ['--chrome-top' as string]: showQuick ? '146px' : '88px' }}
    >
      <GlobeView
        ref={globeRef}
        features={state.geo.features}
        countries={byIso}
        filter={filter}
        selectedIso={selectedIso}
        compareIso={compareIso}
        matched={matched}
        onSelect={handleSelect}
      />
      <div className="vignette pointer-events-none absolute inset-0" />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 md:p-4">
        <div className="glass-panel pointer-events-auto flex flex-col gap-3 rounded-xl px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4 lg:px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-terminal-accent/30 to-terminal-up/20 ring-1 ring-white/10">
              <Globe2 size={18} className="text-terminal-accent" />
            </div>
            <div className="leading-tight">
              <h1 className="font-mono text-sm font-semibold tracking-[0.12em] text-terminal-ink">
                MACROGLOBE<span className="text-terminal-accent"> 3D</span>
              </h1>
              <p className="hidden text-[10px] text-terminal-muted sm:block">{meta.country_count} économies · mise à jour quotidienne</p>
            </div>
            <button onClick={() => setShowAbout((v) => !v)} className="icon-btn ml-auto lg:hidden" aria-label="Méthodologie">
              <Info size={17} />
            </button>
          </div>

          <nav
            className="-mx-1 flex min-w-0 gap-1 overflow-x-auto rounded-lg px-1 pb-0.5 lg:flex-1 lg:justify-center lg:pb-0"
            aria-label="Mode de coloration du globe"
          >
            {FILTER_GROUPS.filter((g) => g.id !== 'projections').map((g) => (
              <FilterMenu key={g.id} label={g.label} icon={GROUP_ICONS[g.id]} sections={g.sections} filter={filter} onChange={setFilter} />
            ))}
            <button
              onClick={() => setFilter('politics')}
              aria-pressed={filter === 'politics'}
              title={FILTERS.politics.label}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === 'politics'
                  ? 'bg-terminal-accent text-black shadow-[0_0_18px_-4px_rgba(245,166,35,0.8)]'
                  : 'text-terminal-sub hover:bg-white/[0.06] hover:text-terminal-ink'
              }`}
            >
              <Vote size={13} strokeWidth={2.25} /> Politique
            </button>
            {FILTER_GROUPS.filter((g) => g.id === 'projections').map((g) => (
              <FilterMenu key={g.id} label={g.label} icon={GROUP_ICONS[g.id]} sections={g.sections} filter={filter} onChange={setFilter} />
            ))}
          </nav>

          <div className="flex items-center gap-2 lg:w-72">
            <SearchBar countries={sortedByName} onSelect={handleSelect} placeholder={compareMode ? 'Pays à comparer…' : undefined} />
            <button
              onClick={() => setShowQuick((v) => !v)}
              className={`icon-btn ${showQuick || matched ? 'text-terminal-accent' : ''}`}
              aria-label="Filtres rapides"
              aria-pressed={showQuick}
              title="Filtres rapides (isoler des pays)"
            >
              <SlidersHorizontal size={17} />
            </button>
            <button onClick={() => setShowAbout((v) => !v)} className="icon-btn hidden lg:inline-flex" aria-label="Méthodologie">
              <Info size={17} />
            </button>
          </div>
        </div>
        {showQuick && (
          <div className="mt-2 flex justify-center">
            <QuickFilters value={quick} matched={matched?.size ?? countries.length} total={countries.length} onChange={setQuick} />
          </div>
        )}
      </header>

      {compareMode && selected && (
        <div className="absolute left-1/2 top-[calc(var(--chrome-top)+44px)] z-20 -translate-x-1/2 lg:top-[calc(var(--chrome-top)+8px)]">
          <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-2 text-xs text-terminal-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-terminal-accent" />
            Comparer <b>{selected.name_fr}</b> avec… cliquez un pays
            <button onClick={() => setCompareMode(false)} className="text-terminal-muted hover:text-terminal-ink" aria-label="Annuler la comparaison">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Left column: world pulse (tall screens) + legend */}
      <div className="tall-only pointer-events-none absolute left-4 top-[var(--chrome-top)] z-10">
        <WorldPanel countries={countries} onSelect={handleSelect} />
      </div>
      <div className={`pointer-events-none absolute bottom-14 left-4 z-10 ${selected ? 'hidden md:block' : 'hidden sm:block'}`}>
        <MapLegend filter={filter} countries={legendCountries} onSelect={handleSelect} />
      </div>

      {!selected && (
        <button
          onClick={() => globeRef.current?.resetView()}
          className="glass-panel absolute bottom-14 right-4 z-10 hidden items-center gap-2 rounded-lg px-3 py-2 text-xs text-terminal-sub hover:text-terminal-ink md:flex"
        >
          <RotateCcw size={13} /> Vue globale
        </button>
      )}

      <div className={selected ? 'hidden md:block' : undefined}>
        <Ticker countries={countries} meta={meta} onSelect={handleSelect} />
      </div>

      {selected && (
        <CountrySidebar
          key={selected.iso3}
          country={selected}
          compareMode={compareMode}
          activeFilter={filter}
          onShowOnGlobe={setFilter}
          onClose={closeSidebar}
          onCompare={() => setCompareMode((v) => !v)}
        />
      )}

      {selected && compared && (
        <ComparisonModal
          a={selected}
          b={compared}
          onClose={() => setCompareIso(null)}
          onSwap={() => {
            setSelectedIso(compared.iso3);
            setCompareIso(selected.iso3);
            globeRef.current?.flyTo(compared);
          }}
        />
      )}

      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowAbout(false)}>
          <div className="glass-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-terminal-ink">Méthodologie</h2>
              <button onClick={() => setShowAbout(false)} className="icon-btn" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-terminal-sub">
              <li>
                <b className="text-terminal-ink">Confiance (0-100)</b> : 40 % dynamique de croissance & inflation, 30 % dette publique & balance courante, 30 % sentiment
                VADER des titres économiques du jour.
              </li>
              <li>
                <b className="text-terminal-ink">Dépendance USD (0-100)</b> : régime de change (35), exportations de matières premières cotées en USD (20), dette
                externe en USD (20), facturation commerciale en USD (15), dépôts en devises (10).
              </li>
              {meta.methodology.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-terminal-muted">Sources & statut du jour</h3>
            <ul className="space-y-1">
              {meta.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-terminal-up hover:underline">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[11px] text-terminal-muted">
              Banque mondiale : {meta.status.world_bank} · FMI : {meta.status.imf ?? 'n.d.'} · Actualité : {meta.status.news}
            </p>
            <p className="mt-4 text-[11px] text-terminal-muted">
              Outil pédagogique : les scores et projections sont des constructions mécaniques, pas des conseils d’investissement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
