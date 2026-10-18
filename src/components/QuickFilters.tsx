import { FilterX } from 'lucide-react';
import type { DemographicTrend, MoodFilter, PoliticalBloc, QuickFilters as QuickFiltersState } from '../types';
import { DEFAULT_QUICK_FILTERS, isQuickFilterActive, POLITICAL_COLORS } from '../lib/metrics';

interface QuickFiltersProps {
  value: QuickFiltersState;
  matched: number;
  total: number;
  onChange: (value: QuickFiltersState) => void;
}

interface PillOption<T extends string> {
  value: T;
  label: string;
  dot?: string[];
}

const BLOC: PillOption<PoliticalBloc>[] = [
  { value: 'all', label: 'Tous' },
  { value: 'left', label: 'Gauche / Communisme', dot: [POLITICAL_COLORS[0].color, POLITICAL_COLORS[1].color] },
  { value: 'center', label: 'Centre', dot: [POLITICAL_COLORS[2].color] },
  { value: 'right', label: 'Droite / Nationaliste', dot: [POLITICAL_COLORS[3].color, POLITICAL_COLORS[4].color] },
];

const DEMO: PillOption<DemographicTrend>[] = [
  { value: 'all', label: 'Tous' },
  { value: 'decline', label: 'Déclin < 2,1 enf.', dot: ['#e5484d'] },
  { value: 'growth', label: 'Croissance > 2,1', dot: ['#10b981'] },
];

const MOOD: PillOption<MoodFilter>[] = [
  { value: 'all', label: 'Tous' },
  { value: 'optimist', label: 'Optimiste > 60', dot: ['#3987e5'] },
  { value: 'pessimist', label: 'Pessimiste < 40', dot: ['#e66767'] },
];

function PillGroup<T extends string>({ label, options, value, onChange }: { label: string; options: PillOption<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="radiogroup" aria-label={label}>
      <span className="mr-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-terminal-muted min-[1600px]:inline">{label}</span>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition ${
              active
                ? 'border-terminal-accent/70 bg-terminal-accent/15 text-terminal-ink'
                : 'border-terminal-line text-terminal-sub hover:border-white/25 hover:text-terminal-ink'
            }`}
          >
            {o.dot && (
              <span className="flex -space-x-0.5">
                {o.dot.map((c) => (
                  <span key={c} className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: c }} />
                ))}
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Isolation pills: countries outside the selection fade to dark grey on the globe. */
export default function QuickFilters({ value, matched, total, onChange }: QuickFiltersProps) {
  const active = isQuickFilterActive(value);
  return (
    <div className="glass-panel pointer-events-auto flex items-center gap-4 overflow-x-auto rounded-xl px-3 py-2">
      <PillGroup label="Bloc" options={BLOC} value={value.bloc} onChange={(bloc) => onChange({ ...value, bloc })} />
      <span className="h-5 w-px shrink-0 bg-terminal-line" />
      <PillGroup label="Démographie" options={DEMO} value={value.demography} onChange={(demography) => onChange({ ...value, demography })} />
      <span className="h-5 w-px shrink-0 bg-terminal-line" />
      <PillGroup label="Dynamique" options={MOOD} value={value.mood} onChange={(mood) => onChange({ ...value, mood })} />
      {active && (
        <>
          <span className="h-5 w-px shrink-0 bg-terminal-line" />
          <span className="shrink-0 font-mono text-[11px] text-terminal-sub">
            <span className="text-terminal-ink">{matched}</span>/{total} pays
          </span>
          <button
            onClick={() => onChange(DEFAULT_QUICK_FILTERS)}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] text-terminal-accent hover:bg-white/[0.06]"
          >
            <FilterX size={12} /> Réinitialiser
          </button>
        </>
      )}
    </div>
  );
}
