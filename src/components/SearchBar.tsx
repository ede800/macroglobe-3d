import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Country } from '../types';
import { flagUrl, fmt } from '../lib/metrics';

interface SearchBarProps {
  countries: Country[];
  onSelect: (iso3: string) => void;
  placeholder?: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function SearchBar({ countries, onSelect, placeholder = 'Rechercher un pays…' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return countries.slice(0, 8);
    return countries
      .filter((c) => [c.name_fr, c.name, c.iso3, c.iso2, c.currency].some((v) => normalize(v).includes(q)))
      .sort((x, y) => Number(!normalize(x.name_fr).startsWith(q)) - Number(!normalize(y.name_fr).startsWith(q)))
      .slice(0, 8);
  }, [countries, query]);

  useEffect(() => setActive(0), [query]);

  // "/" focuses the search, like most terminals and dashboards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const choose = (c: Country) => {
    onSelect(c.iso3);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <label className="flex items-center gap-2 rounded-lg border border-terminal-line bg-black/40 px-3 py-2 focus-within:border-terminal-accent/70">
        <Search size={15} className="shrink-0 text-terminal-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && results[active]) {
              choose(results[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Rechercher un pays"
          className="w-full bg-transparent text-sm text-terminal-ink placeholder:text-terminal-muted focus:outline-none"
        />
        <kbd className="hidden rounded border border-terminal-line px-1.5 font-mono text-[10px] text-terminal-muted sm:block">/</kbd>
      </label>
      {open && results.length > 0 && (
        <ul className="glass-panel absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg py-1" role="listbox">
          {results.map((c, i) => (
            <li key={c.iso3} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-white/[0.07]' : ''}`}
              >
                <img src={flagUrl(c.iso2)} alt="" className="h-3.5 w-5 rounded-[2px] object-cover" />
                <span className="flex-1 truncate text-terminal-ink">{c.name_fr}</span>
                <span className="font-mono text-[11px] text-terminal-muted">{fmt.usd(c.indicators.gdp_usd)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
