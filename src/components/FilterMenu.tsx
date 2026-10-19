import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Anchor,
  Baby,
  BookOpen,
  Banknote,
  BarChart3,
  Briefcase,
  ChevronDown,
  DollarSign,
  Flame,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Hourglass,
  Landmark,
  Network,
  PiggyBank,
  Plane,
  Radar,
  Scale,
  ShieldAlert,
  ShieldHalf,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  Vote,
  Wallet,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { FilterKey } from '../types';
import { FILTERS } from '../lib/metrics';

export const FILTER_ICONS: Record<FilterKey, LucideIcon> = {
  confidence: HeartPulse,
  gdp: BarChart3,
  ppp: Wallet,
  growth: TrendingUp,
  debt: PiggyBank,
  traj10: TrendingUp,
  traj25: Hourglass,
  exposure: Radar,
  tourism: Plane,
  usd: DollarSign,
  china: Network,
  us_trade: Anchor,
  eu_trade: Landmark,
  energy: Flame,
  food: Wheat,
  remittances: Users,
  aid: HandCoins,
  external_debt: Banknote,
  reserves: ShieldHalf,
  population: Users,
  fertility: Baby,
  median_age: UserRound,
  life_expectancy: Stethoscope,
  hdi: GraduationCap,
  gini: Scale,
  corruption: ShieldAlert,
  unemployment: Briefcase,
  politics: Vote,
};

interface FilterMenuProps {
  label: string;
  icon: LucideIcon;
  sections: { group: string; keys: FilterKey[] }[];
  filter: FilterKey;
  onChange: (key: FilterKey) => void;
  /** opens the filter guide at the given filter */
  onHelp?: (key: FilterKey) => void;
}

/** Dropdown grouping several globe colour modes. Rendered in a portal: the top bar scrolls horizontally. */
export default function FilterMenu({ label, icon: GroupIcon, sections, filter, onChange, onHelp }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 12, width: 520 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const keys = sections.flatMap((s) => s.keys);
  const activeKey = keys.includes(filter) ? filter : null;
  const ActiveIcon = activeKey ? FILTER_ICONS[activeKey] : GroupIcon;
  const twoColumns = sections.length > 1;

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(twoColumns ? 540 : 320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      setPos({ top: rect.bottom + 8, left, width });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeKey ? FILTERS[activeKey].label : label}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
          activeKey
            ? 'bg-terminal-accent text-black shadow-[0_0_18px_-4px_rgba(245,166,35,0.8)]'
            : 'text-terminal-sub hover:bg-white/[0.06] hover:text-terminal-ink'
        }`}
      >
        <ActiveIcon size={13} strokeWidth={2.25} />
        <span className={activeKey ? 'hidden sm:inline' : undefined}>{label}</span>
        {activeKey && <span className="max-w-[120px] truncate sm:before:mr-1 sm:before:content-['·']">{FILTERS[activeKey].short}</span>}
        <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            className="glass-panel fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl p-2 animate-fade-in"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className={`grid gap-x-2 ${twoColumns ? 'sm:grid-cols-2' : ''}`}>
              {sections.map(({ group, keys: groupKeys }) => (
                <div key={group} className="py-1">
                  <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-muted">{group}</div>
                  {groupKeys.map((key) => {
                    const Icon = FILTER_ICONS[key];
                    const active = key === filter;
                    return (
                      <button
                        key={key}
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          onChange(key);
                          setOpen(false);
                        }}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                          active ? 'bg-terminal-accent/15' : 'hover:bg-white/[0.06]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            active ? 'bg-terminal-accent text-black' : 'bg-white/[0.06] text-terminal-sub'
                          }`}
                        >
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-xs font-medium ${active ? 'text-terminal-accent' : 'text-terminal-ink'}`}>{FILTERS[key].label}</span>
                          <span className="line-clamp-2 block text-[10px] leading-snug text-terminal-muted">{FILTERS[key].description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {onHelp && (
              <button
                onClick={() => {
                  onHelp(activeKey ?? keys[0]);
                  setOpen(false);
                }}
                className="mt-1 flex w-full items-center gap-2 border-t border-terminal-line px-2 pb-1 pt-2.5 text-left text-[11px] font-medium text-terminal-accent hover:underline"
              >
                <BookOpen size={13} /> Comprendre ces filtres en détail
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
