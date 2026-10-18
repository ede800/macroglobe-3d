import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { Country, CountryFeature, FilterKey } from '../types';
import { COLORS, FILTERS, flagUrl, fmt, withAlpha } from '../lib/metrics';

const BASE = import.meta.env.BASE_URL;

export interface GlobeViewHandle {
  flyTo: (country: Country) => void;
  resetView: () => void;
}

interface GlobeViewProps {
  features: CountryFeature[];
  countries: Map<string, Country>;
  filter: FilterKey;
  selectedIso: string | null;
  compareIso: string | null;
  /** quick-filter isolation: countries outside the set fade out (null = no isolation) */
  matched: Set<string> | null;
  onSelect: (iso3: string) => void;
}

interface MarkerPoint {
  country: Country;
}

function useViewport() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

function tooltipHtml(country: Country | undefined, featureName: string, filter: FilterKey): string {
  if (!country) {
    return `<div class="globe-tip"><div class="globe-tip-title">${escapeHtml(featureName)}</div>
      <div class="globe-tip-muted">Aucune donnée publiée pour ce territoire</div></div>`;
  }
  const def = FILTERS[filter];
  const c = country.confidence;
  return `<div class="globe-tip">
    <div class="globe-tip-head">
      <img src="${flagUrl(country.iso2)}" alt="" width="22" height="15" />
      <span class="globe-tip-title">${escapeHtml(country.name_fr)}</span>
    </div>
    <div class="globe-tip-row"><span>PIB</span><b>${fmt.usd(country.indicators.gdp_usd)}</b></div>
    <div class="globe-tip-row"><span>Confiance</span><b>${fmt.num(c.score)} · ${c.label}</b></div>
    ${country.politics && filter !== 'politics' ? `<div class="globe-tip-row"><span>Pouvoir</span><b>${escapeHtml(country.politics.leaders[0]?.name ?? country.politics.political_category ?? 'Non classé')}</b></div>` : ''}
    ${filter !== 'confidence' && filter !== 'gdp' ? `<div class="globe-tip-row"><span>${def.short}</span><b>${escapeHtml(def.format(country))}</b></div>` : ''}
    ${filter === 'gdp' ? `<div class="globe-tip-row"><span>Croissance</span><b>${fmt.pct(country.indicators.gdp_growth, true)}</b></div>` : ''}
    <div class="globe-tip-hint">Cliquer pour le détail</div>
  </div>`;
}

const GlobeView = forwardRef<GlobeViewHandle, GlobeViewProps>(function GlobeView(
  { features, countries, filter, selectedIso, compareIso, matched, onSelect },
  ref,
) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const { width, height } = useViewport();
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);

  const isMobile = width < 768;
  const defaultAltitude = isMobile ? 3.2 : 2.3;

  // Countries without a polygon at 1:110m (e.g. Singapore) are drawn as markers.
  const markers = useMemo<MarkerPoint[]>(() => {
    const drawn = new Set(features.map((f) => f.properties.ISO_A3));
    return [...countries.values()].filter((c) => !drawn.has(c.iso3)).map((country) => ({ country }));
  }, [features, countries]);

  const rings = useMemo(
    () =>
      [selectedIso, compareIso]
        .map((iso) => (iso ? countries.get(iso) : undefined))
        .filter((c): c is Country => Boolean(c))
        .map((c) => ({ lat: c.lat, lng: c.lng })),
    [selectedIso, compareIso, countries],
  );

  const setAutoRotate = useCallback((on: boolean) => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = on;
  }, []);

  const pauseRotation = useCallback(() => {
    setAutoRotate(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      if (!selectedIso) setAutoRotate(true);
    }, 30000);
  }, [selectedIso, setAutoRotate]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(country: Country) {
        setAutoRotate(false);
        // shift the camera so the country is not hidden behind the side panel on desktop
        const lngOffset = isMobile ? 0 : 18;
        const latOffset = isMobile ? -12 : 0;
        globeRef.current?.pointOfView({ lat: country.lat + latOffset, lng: country.lng + lngOffset, altitude: isMobile ? 2.4 : 1.7 }, 1400);
      },
      resetView() {
        globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: defaultAltitude }, 1200);
        setAutoRotate(true);
      },
    }),
    [defaultAltitude, isMobile, setAutoRotate],
  );

  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;
    controls.enableDamping = true;
    controls.minDistance = 130;
    controls.maxDistance = 700;
    globe.pointOfView({ lat: 20, lng: 10, altitude: defaultAltitude }, 0);
  }, [defaultAltitude]);

  useEffect(() => {
    if (selectedIso) setAutoRotate(false);
  }, [selectedIso, setAutoRotate]);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  const def = FILTERS[filter];

  const capColor = useCallback(
    (obj: object) => {
      const f = obj as CountryFeature;
      const c = countries.get(f.properties.ISO_A3);
      if (!c) return withAlpha(COLORS.noData, 0.55);
      if (matched && !matched.has(c.iso3)) return 'rgba(24, 28, 36, 0.28)';
      if (!def.available(c)) return withAlpha('#2a2f38', 0.75);
      const base = def.color(c);
      const highlighted = f.properties.ISO_A3 === hoverIso || f.properties.ISO_A3 === selectedIso || f.properties.ISO_A3 === compareIso;
      return withAlpha(base, highlighted ? 1 : 0.88);
    },
    [countries, def, hoverIso, selectedIso, compareIso, matched],
  );

  const sideColor = useCallback(
    (obj: object) => {
      const c = countries.get((obj as CountryFeature).properties.ISO_A3);
      if (c && matched && !matched.has(c.iso3)) return 'rgba(20, 24, 30, 0.1)';
      return c && def.available(c) ? withAlpha(def.color(c), 0.35) : 'rgba(20, 26, 34, 0.3)';
    },
    [countries, def, matched],
  );

  const strokeColor = useCallback(
    (obj: object) => {
      const iso = (obj as CountryFeature).properties.ISO_A3;
      if (iso === selectedIso || iso === compareIso) return COLORS.accent;
      if (iso === hoverIso) return '#ffffff';
      if (matched && !matched.has(iso)) return 'rgba(255, 255, 255, 0.05)';
      return countries.has(iso) ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.06)';
    },
    [countries, hoverIso, selectedIso, compareIso, matched],
  );

  const altitude = useCallback(
    (obj: object) => {
      const iso = (obj as CountryFeature).properties.ISO_A3;
      const c = countries.get(iso);
      let alt = c ? 0.012 : 0.004;
      if (c && matched && !matched.has(iso)) alt = 0.004;
      else if (c && filter === 'gdp') alt += Math.min(8, Math.max(0, c.indicators.gdp_growth)) * 0.01;
      if (iso === selectedIso || iso === compareIso) alt += 0.05;
      else if (iso === hoverIso && c) alt += 0.035;
      return alt;
    },
    [countries, filter, hoverIso, selectedIso, compareIso, matched],
  );

  const label = useCallback(
    (obj: object) => {
      const f = obj as CountryFeature;
      return tooltipHtml(countries.get(f.properties.ISO_A3), f.properties.NAME, filter);
    },
    [countries, filter],
  );

  const handleHover = useCallback(
    (obj: object | null) => {
      const iso = obj ? (obj as CountryFeature).properties.ISO_A3 : null;
      setHoverIso(iso && countries.has(iso) ? iso : null);
      document.body.style.cursor = iso && countries.has(iso) ? 'pointer' : 'grab';
      if (iso) pauseRotation();
    },
    [countries, pauseRotation],
  );

  const handleClick = useCallback(
    (obj: object) => {
      const iso = (obj as CountryFeature).properties.ISO_A3;
      if (countries.has(iso)) onSelect(iso);
    },
    [countries, onSelect],
  );

  return (
    <div className="absolute inset-0" onPointerDown={pauseRotation}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={`${BASE}textures/night-sky.png`}
        globeImageUrl={`${BASE}textures/earth-dark.jpg`}
        bumpImageUrl={`${BASE}textures/earth-topology.png`}
        showAtmosphere
        atmosphereColor="#3a7bd5"
        atmosphereAltitude={0.2}
        onGlobeReady={handleReady}
        polygonsData={features}
        polygonCapColor={capColor}
        polygonSideColor={sideColor}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonLabel={label}
        polygonsTransitionDuration={350}
        onPolygonHover={handleHover}
        onPolygonClick={handleClick}
        showGraticules
        ringsData={rings}
        ringColor={() => (t: number) => `rgba(245, 166, 35, ${Math.max(0, 1 - t)})`}
        ringMaxRadius={4.5}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={1100}
        ringAltitude={0.012}
        pointsData={markers}
        pointLat={(p: object) => (p as MarkerPoint).country.lat}
        pointLng={(p: object) => (p as MarkerPoint).country.lng}
        pointColor={(p: object) => {
          const c = (p as MarkerPoint).country;
          if (matched && !matched.has(c.iso3)) return 'rgba(60, 66, 76, 0.35)';
          return def.available(c) ? def.color(c) : '#3a404a';
        }}
        pointAltitude={(p: object) => {
          const iso = (p as MarkerPoint).country.iso3;
          return iso === selectedIso || iso === compareIso ? 0.07 : iso === hoverIso ? 0.045 : 0.025;
        }}
        pointRadius={0.38}
        pointResolution={16}
        onPointHover={(p: object | null) => {
          const iso = p ? (p as MarkerPoint).country.iso3 : null;
          setHoverIso(iso);
          document.body.style.cursor = iso ? 'pointer' : 'grab';
          if (iso) pauseRotation();
        }}
        pointLabel={(p: object) => {
          const c = (p as MarkerPoint).country;
          return tooltipHtml(c, c.name_fr, filter);
        }}
        onPointClick={(p: object) => onSelect((p as MarkerPoint).country.iso3)}
      />
    </div>
  );
});

export default GlobeView;
