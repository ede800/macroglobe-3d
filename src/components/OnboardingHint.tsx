import { useEffect, useState } from 'react';
import { MousePointerClick, X } from 'lucide-react';

const STORAGE_KEY = 'macroglobe:hint-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // private mode / storage blocked: the hint simply shows again next visit
  }
}

/** First-visit hint: how to use the globe. Hidden for good after the first country is opened or on dismiss. */
export default function OnboardingHint({ hasSelection, suppressed = false }: { hasSelection: boolean; suppressed?: boolean }) {
  const [visible, setVisible] = useState(() => !readDismissed());
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (hasSelection && visible) {
      writeDismissed();
      setVisible(false);
    }
  }, [hasSelection, visible]);

  if (!visible || hasSelection || suppressed) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[104px] z-20 flex justify-center px-4 sm:bottom-16">
      <div className="glass-panel pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-3 pr-2 text-xs text-terminal-sub shadow-[0_0_30px_-8px_rgba(245,166,35,0.6)] animate-fade-in">
        <span className="flex h-7 w-7 shrink-0 animate-pulse items-center justify-center rounded-full bg-terminal-accent text-black">
          <MousePointerClick size={15} />
        </span>
        <span>
          <b className="text-terminal-ink">{touch ? 'Touchez un pays' : 'Cliquez sur un pays'}</b> pour ouvrir son tableau de bord
          <span className="hidden sm:inline"> · glissez pour tourner le globe · « / » pour chercher</span>
        </span>
        <button
          onClick={() => {
            writeDismissed();
            setVisible(false);
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-terminal-muted hover:bg-white/10 hover:text-terminal-ink"
          aria-label="Masquer l’aide"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
