import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Database, Globe2, Info, Loader2, RotateCcw, X } from 'lucide-react';
import GlobeView, { type GlobeViewHandle } from './components/GlobeView';
import CountrySidebar from './components/CountrySidebar';
import ComparisonModal from './components/ComparisonModal';
import SearchBar from './components/SearchBar';
import MapLegend from './components/MapLegend';
import type { CountryCollection, FilterKey, MacroData } from './types';
import { FILTER_ORDER, FILTERS, fmt } from './lib/metrics';

const BASE = import.meta.env.BASE_URL;

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: MacroData; geo: CountryCollection };

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} : HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<FilterKey>('confidence');
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIso, setCompareIso] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const globeRef = useRef<GlobeViewHandle>(null);

  useEffect(() => {
    Promise.all([loadJson<MacroData>('data/macro_data.json'), loadJson<CountryCollection>('data/countries.geojson')])
      .then(([data, geo]) => setState({ status: 'ready', data, geo }))
      .catch((err: unknown) => setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, []);

  const countries = useMemo(() => (state.status === 'ready' ? state.data.countries : []), [state]);
  const byIso = useMemo(() => new Map(countries.map((c) => [c.iso3, c])), [countries]);
  const sortedByName = useMemo(() => [...countries].sort((a, b) => a.name_fr.localeCompare(b.name_fr, 'fr')), [countries]);

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
    const iso = window.location.hash.slice(1).toUpperCase();
    const country = byIso.get(iso);
    if (!country) return;
    setSelectedIso(iso);
    const timer = window.setTimeout(() => globeRef.current?.flyTo(country), 600);
    return () => window.clearTimeout(timer);
  }, [state.status, byIso]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const url = selectedIso ? `#${selectedIso}` : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }, [selectedIso, state.status]);

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

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-terminal-sub">
        <Loader2 className="animate-spin text-terminal-accent" size={20} /> Chargement des données macroéconomiques…
      </div>
    );
  }

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
    <div className="relative h-full w-full overflow-hidden">
      <GlobeView
        ref={globeRef}
        features={state.geo.features}
        countries={byIso}
        filter={filter}
        selectedIso={selectedIso}
        compareIso={compareIso}
        onSelect={handleSelect}
      />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 md:p-4">
        <div className="glass-panel pointer-events-auto flex flex-col gap-3 rounded-xl px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4 lg:px-4">
          <div className="flex items-center gap-2.5">
            <Globe2 size={22} className="text-terminal-accent" />
            <div className="leading-tight">
              <h1 className="font-mono text-sm font-semibold tracking-wide text-terminal-ink">
                MACROGLOBE<span className="text-terminal-accent"> 3D</span>
              </h1>
              <p className="hidden text-[10px] text-terminal-muted sm:block">{meta.country_count} économies · mise à jour quotidienne</p>
            </div>
            <button onClick={() => setShowAbout((v) => !v)} className="icon-btn ml-auto lg:hidden" aria-label="Méthodologie">
              <Info size={17} />
            </button>
          </div>

          <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-0.5 lg:flex-1 lg:justify-center" aria-label="Filtre de coloration du globe">
            {FILTER_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === key ? 'bg-terminal-accent text-black' : 'text-terminal-sub hover:bg-white/[0.06] hover:text-terminal-ink'
                }`}
              >
                <span className="hidden 2xl:inline">{FILTERS[key].label}</span>
                <span className="2xl:hidden">{FILTERS[key].short}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 lg:w-72">
            <SearchBar countries={sortedByName} onSelect={handleSelect} placeholder={compareMode ? 'Pays à comparer…' : undefined} />
            <button onClick={() => setShowAbout((v) => !v)} className="icon-btn hidden lg:inline-flex" aria-label="Méthodologie">
              <Info size={17} />
            </button>
          </div>
        </div>
      </header>

      {compareMode && selected && (
        <div className="absolute left-1/2 top-[132px] z-20 -translate-x-1/2 lg:top-24">
          <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-2 text-xs text-terminal-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-terminal-accent" />
            Comparer <b>{selected.name_fr}</b> avec… cliquez un pays
            <button onClick={() => setCompareMode(false)} className="text-terminal-muted hover:text-terminal-ink" aria-label="Annuler la comparaison">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom-left legend + data status */}
      <div className={`pointer-events-none absolute bottom-4 left-4 z-10 flex-col gap-2 ${selected ? 'hidden md:flex' : 'flex'}`}>
        <MapLegend filter={filter} countries={countries} onSelect={handleSelect} />
        <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] text-terminal-muted">
          <Database size={12} />
          <span>
            Données : {fmt.date(meta.generated_at)} · WB {meta.status.world_bank} · Actu {meta.status.news}
          </span>
        </div>
      </div>

      {!selected && (
        <button
          onClick={() => globeRef.current?.resetView()}
          className="glass-panel absolute bottom-4 right-4 z-10 hidden items-center gap-2 rounded-lg px-3 py-2 text-xs text-terminal-sub hover:text-terminal-ink md:flex"
        >
          <RotateCcw size={13} /> Vue globale
        </button>
      )}

      {selected && (
        <CountrySidebar
          key={selected.iso3}
          country={selected}
          compareMode={compareMode}
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
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-terminal-muted">Sources</h3>
            <ul className="space-y-1">
              {meta.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-terminal-up hover:underline">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-terminal-muted">
              Outil pédagogique : les scores et projections sont des constructions mécaniques, pas des conseils d’investissement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
