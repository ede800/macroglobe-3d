import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Anchor,
  Banknote,
  ChevronDown,
  DollarSign,
  Flame,
  HandCoins,
  Landmark,
  Network,
  Plane,
  Radar,
  ShieldHalf,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import type { FilterKey } from '../types';
import { DEPENDENCY_FILTERS, FILTERS } from '../lib/metrics';

export const DEPENDENCY_ICONS: Partial<Record<FilterKey, LucideIcon>> = {
  exposure: Radar,
  china: Network,
  us_trade: Anchor,
  eu_trade: Landmark,
  tourism: Plane,
  energy: Flame,
  food: Wheat,
  remittances: Users,
  aid: HandCoins,
  usd: DollarSign,
  external_debt: Banknote,
  reserves: ShieldHalf,
};

interface DependencyMenuProps {
  filter: FilterKey;
  onChange: (key: FilterKey) => void;
}

export default function DependencyMenu({ filter, onChange }: DependencyMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 12, width: 520 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The filter bar scrolls horizontally (overflow hidden), so the menu is positioned in viewport coordinates.
  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(520, window.innerWidth - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
      setPos({ top: rect.bottom + 8, left, width });
    }
    setOpen((v) => !v);
  };
  const activeKey = DEPENDENCY_FILTERS.some((g) => g.keys.includes(filter)) ? filter : null;
  const ActiveIcon = (activeKey && DEPENDENCY_ICONS[activeKey]) || Radar;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
          activeKey
            ? 'bg-terminal-accent text-black shadow-[0_0_18px_-4px_rgba(245,166,35,0.8)]'
            : 'text-terminal-sub hover:bg-white/[0.06] hover:text-terminal-ink'
        }`}
      >
        <ActiveIcon size={13} strokeWidth={2.25} />
        {activeKey ? FILTERS[activeKey].short : 'Dépendances'}
        <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="glass-panel fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl p-2 animate-fade-in"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="grid gap-x-2 sm:grid-cols-2">
            {DEPENDENCY_FILTERS.map(({ group, keys }) => (
              <div key={group} className="py-1">
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-muted">{group}</div>
                {keys.map((key) => {
                  const Icon = DEPENDENCY_ICONS[key] ?? Radar;
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
        </div>,
          document.body,
        )}
    </div>
  );
}
