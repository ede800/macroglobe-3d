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
      <div class="globe-tip-muted">Hors des 40 économies couvertes</div></div>`;
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
    ${filter !== 'confidence' && filter !== 'gdp' ? `<div class="globe-tip-row"><span>${def.short}</span><b>${escapeHtml(def.format(country))}</b></div>` : ''}
    ${filter === 'gdp' ? `<div class="globe-tip-row"><span>Croissance</span><b>${fmt.pct(country.indicators.gdp_growth, true)}</b></div>` : ''}
    <div class="globe-tip-hint">Cliquer pour le détail</div>
  </div>`;
}

const GlobeView = forwardRef<GlobeViewHandle, GlobeViewProps>(function GlobeView(
  { features, countries, filter, selectedIso, compareIso, onSelect },
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

  const setAutoRotate = useCallback((on: boolean) => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = on;
  }, []);

  const pauseRotation = useCallback(() => {
    setAutoRotate(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      if (!selectedIso) setAutoRotate(true);
    }, 15000);
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
    controls.autoRotateSpeed = 0.35;
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
      const base = def.color(c);
      const highlighted = f.properties.ISO_A3 === hoverIso || f.properties.ISO_A3 === selectedIso || f.properties.ISO_A3 === compareIso;
      return withAlpha(base, highlighted ? 1 : 0.88);
    },
    [countries, def, hoverIso, selectedIso, compareIso],
  );

  const sideColor = useCallback(
    (obj: object) => {
      const c = countries.get((obj as CountryFeature).properties.ISO_A3);
      return c ? withAlpha(def.color(c), 0.35) : 'rgba(20, 26, 34, 0.3)';
    },
    [countries, def],
  );

  const strokeColor = useCallback(
    (obj: object) => {
      const iso = (obj as CountryFeature).properties.ISO_A3;
      if (iso === selectedIso || iso === compareIso) return COLORS.accent;
      if (iso === hoverIso) return '#ffffff';
      return countries.has(iso) ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.06)';
    },
    [countries, hoverIso, selectedIso, compareIso],
  );

  const altitude = useCallback(
    (obj: object) => {
      const iso = (obj as CountryFeature).properties.ISO_A3;
      const c = countries.get(iso);
      let alt = c ? 0.012 : 0.004;
      if (c && filter === 'gdp') alt += Math.max(0, c.indicators.gdp_growth) * 0.012;
      if (iso === selectedIso || iso === compareIso) alt += 0.05;
      else if (iso === hoverIso && c) alt += 0.035;
      return alt;
    },
    [countries, filter, hoverIso, selectedIso, compareIso],
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
        pointsData={markers}
        pointLat={(p: object) => (p as MarkerPoint).country.lat}
        pointLng={(p: object) => (p as MarkerPoint).country.lng}
        pointColor={(p: object) => def.color((p as MarkerPoint).country)}
        pointAltitude={(p: object) => ((p as MarkerPoint).country.iso3 === selectedIso ? 0.08 : 0.04)}
        pointRadius={0.9}
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
