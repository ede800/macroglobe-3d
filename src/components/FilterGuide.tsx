import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, ArrowLeft, BookOpen, ExternalLink, GraduationCap, Database, Eye, Globe2, Layers, MousePointerClick, SlidersHorizontal, X } from 'lucide-react';
import type { Country, FilterKey } from '../types';
import { FILTER_GROUPS, FILTERS, flagUrl, POLITICAL_COLORS } from '../lib/metrics';
import { FILTER_DOCS } from '../lib/filterGuide';
import { BENCHMARK_ISO3, FILTER_CONCEPTS, GLOSSARY, type SourceLink } from '../lib/filterConcepts';
import { FILTER_ICONS } from './FilterMenu';

interface FilterGuideProps {
  countries: Country[];
  activeFilter: FilterKey;
  /** filter to scroll to when the page opens */
  focus: FilterKey | null;
  onShow: (key: FilterKey) => void;
  onSelectCountry: (iso3: string) => void;
  onClose: () => void;
}

// Same order as the top bar: economy, dependencies, demography, politics, projections.
const CHAPTERS: { id: string; label: string; sections: { group: string; keys: FilterKey[] }[] }[] = [
  ...FILTER_GROUPS.filter((g) => g.id !== 'projections'),
  { id: 'politics', label: 'Politique', sections: [{ group: 'Pouvoir exécutif', keys: ['politics'] }] },
  ...FILTER_GROUPS.filter((g) => g.id === 'projections'),
];

const anchor = (id: string) => `guide-${id}`;

const PIPELINE_URL = 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py';

function Ext({ link, className = '' }: { link: SourceLink; className?: string }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={`text-terminal-up hover:underline ${className}`}>
      {link.label}
      <ExternalLink size={10} className="ml-0.5 inline align-[-1px] opacity-70" aria-hidden />
    </a>
  );
}

/** Paragraph whose [n] markers become superscript links to the n-th reference of the card. */
function Cited({ text, refs, refId }: { text: string; refs: SourceLink[]; refId: (n: number) => string }) {
  const parts = text.split(/\[(\d+)\]/);
  return (
    <p>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const n = Number(part);
        return (
          <sup key={i} className="ml-px">
            {refs[n - 1] ? (
              <a href={refs[n - 1].url} target="_blank" rel="noopener noreferrer" title={refs[n - 1].label} className="font-mono text-[10px] text-terminal-up hover:underline">
                [{n}]
              </a>
            ) : (
              <a href={`#${refId(n)}`} className="font-mono text-[10px] text-terminal-up">
                [{n}]
              </a>
            )}
          </sup>
        );
      })}
    </p>
  );
}

const READING_TIPS = [
  {
    icon: Layers,
    title: 'Trois types d’échelles',
    text: 'Séquentielle (une teinte, du sombre au clair) pour une quantité ; divergente (rouge ← gris → bleu) quand il existe un point neutre comme 0 ou 50 ; catégorielle (couleurs distinctes) pour des classes comme la fécondité ou la politique.',
  },
  {
    icon: Database,
    title: 'Gris foncé = pas de donnée',
    text: 'Un pays sans valeur publiée pour l’indicateur est grisé et sort du classement. Le nombre de pays « n.d. » est indiqué sous la légende.',
  },
  {
    icon: Eye,
    title: 'Échelles log et racine',
    text: 'Quand les valeurs s’étalent sur plusieurs ordres de grandeur (PIB, population) ou se concentrent près de zéro (tourisme, diaspora, aide), l’échelle est compressée pour que les écarts restent visibles. Les graduations de la légende donnent les vraies valeurs.',
  },
  {
    icon: MousePointerClick,
    title: 'Survoler, cliquer, comparer',
    text: 'Survolez un pays pour lire sa valeur, cliquez pour ouvrir sa fiche détaillée (décomposition des scores, séries, sources), puis « Comparer » pour le mettre face à un autre pays.',
  },
];

function Scale({ k, countries }: { k: FilterKey; countries: Country[] }) {
  const def = FILTERS[k];
  if (def.categories && def.categoryOf) {
    const withData = countries.filter((c) => def.available(c));
    return (
      <ul className="space-y-1.5">
        {def.categories.map((cat, i) => {
          const n = withData.filter((c) => def.categoryOf?.(c) === i).length;
          return (
            <li key={cat.label} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: cat.color }} />
              <span className="flex-1 text-terminal-sub">{cat.label}</span>
              <span className="font-mono tabular-nums text-terminal-ink">{n}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <div>
      <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${def.legend.stops.join(', ')})` }} />
      <div className="relative mt-1 h-4 font-mono text-[10px] text-terminal-muted">
        {def.legend.ticks.map((t) => (
          <span
            key={t.label}
            className="absolute whitespace-nowrap"
            style={{ left: `${t.at * 100}%`, transform: t.at === 0 ? 'none' : t.at === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CountryChip({ c, k, onSelect }: { c: Country; k: FilterKey; onSelect: (iso3: string) => void }) {
  return (
    <button
      onClick={() => onSelect(c.iso3)}
      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-white/[0.06]"
      title={`Ouvrir la fiche ${c.name_fr}`}
    >
      <img src={flagUrl(c.iso2)} alt="" loading="lazy" className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover" />
      <span className="flex-1 truncate text-terminal-sub">{c.name_fr}</span>
      <span className="font-mono text-[11px] tabular-nums text-terminal-ink">{FILTERS[k].compact(c)}</span>
    </button>
  );
}

function Today({ k, countries, onSelect }: { k: FilterKey; countries: Country[]; onSelect: (iso3: string) => void }) {
  const def = FILTERS[k];
  const ranked = useMemo(() => countries.filter((c) => def.available(c)).sort((a, b) => def.value(b) - def.value(a)), [countries, def]);
  if (ranked.length === 0) return null;
  const median = ranked[Math.floor(ranked.length / 2)];
  const categorical = Boolean(def.categories);
  const benchmarks = BENCHMARK_ISO3.map((iso) => countries.find((c) => c.iso3 === iso)).filter((c): c is Country => Boolean(c));
  return (
    <div>
      <p className="text-xs text-terminal-muted">
        <span className="font-mono text-terminal-ink">{ranked.length}</span>/{countries.length} pays couverts
        {!categorical && (
          <>
            {' '}· médiane <span className="font-mono text-terminal-ink">{def.compact(median)}</span>
          </>
        )}
      </p>
      {!categorical && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">Plus élevés</div>
            {ranked.slice(0, 3).map((c) => (
              <CountryChip key={c.iso3} c={c} k={k} onSelect={onSelect} />
            ))}
          </div>
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">Plus bas</div>
            {ranked.slice(-3).reverse().map((c) => (
              <CountryChip key={c.iso3} c={c} k={k} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
      {benchmarks.length > 0 && (
        <div className="mt-3">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">Repères</div>
          <div className="grid sm:grid-cols-2 sm:gap-x-3">
            {benchmarks.map((c) => (
              <BenchmarkRow key={c.iso3} c={c} k={k} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BenchmarkRow({ c, k, onSelect }: { c: Country; k: FilterKey; onSelect: (iso3: string) => void }) {
  const def = FILTERS[k];
  if (!def.categoryOf) return <CountryChip c={c} k={k} onSelect={onSelect} />;
  // categorical filters: show the class rather than a number
  const idx = def.categoryOf(c);
  const cat = idx === null ? null : def.categories?.[idx];
  return (
    <button onClick={() => onSelect(c.iso3)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-white/[0.06]" title={`Ouvrir la fiche ${c.name_fr}`}>
      <img src={flagUrl(c.iso2)} alt="" loading="lazy" className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover" />
      <span className="flex-1 truncate text-terminal-sub">{c.name_fr}</span>
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: cat?.color ?? '#2a2f38' }} />
      <span className="max-w-[45%] truncate text-[11px] text-terminal-ink">{cat ? (k === 'fertility' ? def.compact(c) : cat.label) : 'n.d.'}</span>
    </button>
  );
}

function Label({ children }: { children: string }) {
  return <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-muted">{children}</h4>;
}

function FilterCard({ k, active, countries, onShow, onSelect }: { k: FilterKey; active: boolean; countries: Country[]; onShow: (key: FilterKey) => void; onSelect: (iso3: string) => void }) {
  const def = FILTERS[k];
  const doc = FILTER_DOCS[k];
  const Icon = FILTER_ICONS[k];
  const concept = FILTER_CONCEPTS[k];
  const sense = def.higherIsBetter === null ? 'Ni bon ni mauvais en soi' : def.higherIsBetter ? 'Plus haut = mieux' : 'Plus bas = mieux';
  return (
    <article id={anchor(k)} className="scroll-mt-32 rounded-xl border border-terminal-line bg-white/[0.02] p-4 md:p-5">
      <header className="flex flex-wrap items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-terminal-accent text-black' : 'bg-white/[0.06] text-terminal-sub'}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-terminal-ink">{def.label}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">{def.description}</p>
        </div>
        <button
          onClick={() => onShow(k)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            active ? 'bg-terminal-accent/15 text-terminal-accent' : 'border border-terminal-line text-terminal-sub hover:border-white/25 hover:text-terminal-ink'
          }`}
        >
          <Globe2 size={13} /> {active ? 'Affiché sur le globe' : 'Afficher sur le globe'}
        </button>
      </header>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4 text-sm leading-relaxed text-terminal-sub">
          <section>
            <Label>Ce que ça mesure</Label>
            <p>{doc.what}</p>
          </section>
          <section className="rounded-lg border border-terminal-accent/20 bg-terminal-accent/[0.04] p-3.5">
            <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-accent">
              <GraduationCap size={13} aria-hidden /> Comprendre l’indicateur
            </h4>
            <div className="space-y-2.5">
              {concept.paragraphs.map((para) => (
                <Cited key={para} text={para} refs={concept.refs} refId={(n) => `ref-${k}-${n}`} />
              ))}
            </div>
            {concept.refs.length > 0 && (
              <div className="mt-3 border-t border-terminal-accent/15 pt-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-muted">Références</div>
                <ol className="space-y-0.5 text-[11px] leading-snug">
                  {concept.refs.map((r, i) => (
                    <li key={r.url + i} id={`ref-${k}-${i + 1}`} className="flex gap-1.5">
                      <span className="shrink-0 font-mono text-terminal-muted">[{i + 1}]</span>
                      <Ext link={r} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
          <section>
            <Label>Comment c’est calculé dans MacroGlobe</Label>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-terminal-muted">
              {doc.how.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-terminal-muted">
              Formules exactes : <Ext link={{ label: 'scripts/update_macro_data.py', url: PIPELINE_URL }} />
            </p>
          </section>
          <section>
            <Label>Comment le lire</Label>
            <p>{doc.read}</p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-terminal-line bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Échelle</Label>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-terminal-sub">{sense}</span>
            </div>
            <Scale k={k} countries={countries} />
            <p className="mt-1 text-[11px] text-terminal-muted">{def.legend.caption}</p>
          </section>
          <section className="rounded-lg border border-terminal-line bg-black/20 p-3">
            <Label>Aujourd’hui</Label>
            <Today k={k} countries={countries} onSelect={onSelect} />
          </section>
          {doc.caveats.length > 0 && (
            <section>
              <Label>À savoir</Label>
              <ul className="space-y-1.5 text-xs leading-relaxed text-terminal-sub">
                {doc.caveats.map((c) => (
                  <li key={c} className="flex gap-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-terminal-accent" aria-hidden />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <Label>Sources des données</Label>
            <ul className="space-y-0.5 text-xs leading-snug">
              {doc.sources.map((src) => (
                <li key={src.url + src.label}>
                  <Ext link={src} />
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-terminal-muted">L’année exacte de chaque valeur est indiquée dans la fiche du pays.</p>
          </section>
        </div>
      </div>
    </article>
  );
}

function QuickFiltersDoc() {
  const rows = [
    {
      title: 'Bloc',
      items: [
        { label: 'Gauche / Communisme', dots: [POLITICAL_COLORS[0].color, POLITICAL_COLORS[1].color], text: 'Pays dont le pouvoir est classé « Extrême-gauche / Communiste » ou « Gauche / Social-démocrate ».' },
        { label: 'Centre', dots: [POLITICAL_COLORS[2].color], text: 'Pays classés « Centre / Libéral ».' },
        { label: 'Droite / Nationaliste', dots: [POLITICAL_COLORS[3].color, POLITICAL_COLORS[4].color], text: 'Pays classés « Droite / Conservateur » ou « Droite nationaliste / Extrême-droite ».' },
      ],
      note: 'Les monarchies absolues, théocraties, juntes et les pays non classés n’appartiennent à aucun bloc : ils disparaissent dès qu’un bloc est choisi.',
    },
    {
      title: 'Démographie',
      items: [
        { label: 'Déclin < 2,1 enf.', dots: ['#e5484d'], text: 'Fécondité strictement inférieure au seuil de renouvellement de 2,1 enfants par femme.' },
        { label: 'Croissance > 2,1', dots: ['#10b981'], text: 'Fécondité strictement supérieure à 2,1.' },
      ],
      note: 'Les pays sans donnée de fécondité sont exclus des deux options.',
    },
    {
      title: 'Dynamique',
      items: [
        { label: 'Optimiste > 60', dots: ['#3987e5'], text: 'Score « Santé globale / Confiance » au-dessus de 60.' },
        { label: 'Pessimiste < 40', dots: ['#e66767'], text: 'Score de confiance en dessous de 40.' },
      ],
      note: 'Les pays « Neutres » (entre 40 et 60) ne sont retenus que par « Tous ».',
    },
  ];
  return (
    <div className="rounded-xl border border-terminal-line bg-white/[0.02] p-4 text-sm text-terminal-sub md:p-5">
      <p className="leading-relaxed">
        Les pastilles sous la barre du haut (bouton <SlidersHorizontal size={12} className="inline align-[-1px]" />) ne changent pas la couleur du globe : elles <b className="text-terminal-ink">isolent</b> un
        sous-ensemble de pays. Les autres s’éteignent en gris et sortent de la légende et du classement. Les trois critères se cumulent (il faut les remplir tous), et ils
        fonctionnent avec n’importe quel filtre de couleur : par exemple « Dette publique » + « Bloc : Droite » + « Démographie : Déclin ».
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {rows.map((r) => (
          <section key={r.title}>
            <Label>{r.title}</Label>
            <ul className="space-y-2">
              {r.items.map((it) => (
                <li key={it.label}>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-terminal-ink">
                    <span className="flex -space-x-0.5">
                      {it.dots.map((d) => (
                        <span key={d} className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: d }} />
                      ))}
                    </span>
                    {it.label}
                  </span>
                  <span className="text-xs leading-snug text-terminal-muted">{it.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-terminal-muted">{r.note}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Full-page documentation of every globe filter: what it measures, how it is built, how to read it. */
export default function FilterGuide({ countries, activeFilter, focus, onShow, onSelectCountry, onClose }: FilterGuideProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  const goTo = (id: string, smooth = true) => {
    const target = document.getElementById(anchor(id));
    if (target) target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  useEffect(() => {
    // give keyboard focus back to the button that opened the guide when it closes
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    if (focus) goTo(focus, false);
  }, [focus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = CHAPTERS.reduce((n, ch) => n + ch.sections.reduce((m, s) => m + s.keys.length, 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="guide-title" className="fixed inset-0 z-50 overflow-y-auto bg-terminal-bg/95 backdrop-blur-sm animate-fade-in">
      <header className="sticky top-0 z-10 border-b border-terminal-line bg-terminal-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="icon-btn" aria-label="Retour au globe" title="Retour au globe">
            <ArrowLeft size={18} />
          </button>
          <BookOpen size={18} className="text-terminal-accent" aria-hidden />
          <div className="min-w-0 flex-1 leading-tight">
            <h2 id="guide-title" className="text-sm font-semibold text-terminal-ink">
              Guide des filtres
            </h2>
            <p className="truncate text-[11px] text-terminal-muted">{total} colorations du globe, les filtres rapides et un lexique, expliqués en détail</p>
          </div>
          <button ref={closeRef} onClick={onClose} className="icon-btn" aria-label="Fermer le guide">
            <X size={18} />
          </button>
        </div>
        {/* phones: chapter chips instead of the side menu */}
        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 lg:hidden" aria-label="Chapitres">
          {[{ id: 'reading', label: 'Lire le globe' }, ...CHAPTERS, { id: 'quick', label: 'Filtres rapides' }, { id: 'glossary', label: 'Lexique' }].map((ch) => (
            <button
              key={ch.id}
              onClick={() => goTo(ch.id)}
              className="shrink-0 rounded-full border border-terminal-line px-2.5 py-1 text-[11px] text-terminal-sub hover:border-white/25 hover:text-terminal-ink"
            >
              {ch.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Sommaire">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto pb-6 text-xs">
            <button onClick={() => goTo('reading')} className="block font-medium text-terminal-sub hover:text-terminal-ink">
              Lire le globe
            </button>
            {CHAPTERS.map((ch) => (
              <div key={ch.id}>
                <button onClick={() => goTo(ch.id)} className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-terminal-muted hover:text-terminal-ink">
                  {ch.label}
                </button>
                <ul className="space-y-0.5 border-l border-terminal-line">
                  {ch.sections.flatMap((s) => s.keys).map((k) => (
                    <li key={k}>
                      <button
                        onClick={() => goTo(k)}
                        className={`-ml-px block w-full truncate border-l py-0.5 pl-3 text-left transition ${
                          k === activeFilter ? 'border-terminal-accent text-terminal-accent' : 'border-transparent text-terminal-sub hover:text-terminal-ink'
                        }`}
                      >
                        {FILTERS[k].short}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button onClick={() => goTo('quick')} className="block font-medium text-terminal-sub hover:text-terminal-ink">
              Filtres rapides
            </button>
            <button onClick={() => goTo('glossary')} className="block font-medium text-terminal-sub hover:text-terminal-ink">
              Lexique
            </button>
          </div>
        </nav>

        <main className="min-w-0 space-y-10">
          <section id={anchor('reading')} className="scroll-mt-28">
            <h2 className="text-xl font-semibold text-terminal-ink">Lire le globe</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-sub">
              Chaque filtre colore les pays selon un indicateur. Ils sont rangés en cinq familles dans la barre du haut : <b className="text-terminal-ink">Économie</b>,{' '}
              <b className="text-terminal-ink">Dépendances</b>, <b className="text-terminal-ink">Démographie</b>, <b className="text-terminal-ink">Politique</b> et{' '}
              <b className="text-terminal-ink">Projections</b>. La légende en bas à gauche rappelle l’échelle, montre la répartition des pays et le classement complet. Les
              données sont mises à jour automatiquement chaque jour à partir de sources publiques.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {READING_TIPS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-terminal-line bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-terminal-ink">
                    <Icon size={15} className="text-terminal-accent" aria-hidden /> {title}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-terminal-sub">{text}</p>
                </div>
              ))}
            </div>
          </section>

          {CHAPTERS.map((ch) => (
            <section key={ch.id} id={anchor(ch.id)} className="scroll-mt-28">
              <h2 className="text-xl font-semibold text-terminal-ink">{ch.label}</h2>
              <div className="mt-4 space-y-8">
                {ch.sections.map((s) => (
                  <div key={s.group}>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-muted">{s.group}</h3>
                    <div className="space-y-4">
                      {s.keys.map((k) => (
                        <FilterCard key={k} k={k} active={k === activeFilter} countries={countries} onShow={onShow} onSelect={onSelectCountry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section id={anchor('quick')} className="scroll-mt-28">
            <h2 className="mb-4 text-xl font-semibold text-terminal-ink">Filtres rapides</h2>
            <QuickFiltersDoc />
          </section>

          <section id={anchor('glossary')} className="scroll-mt-28">
            <h2 className="text-xl font-semibold text-terminal-ink">Lexique</h2>
            <p className="mt-2 text-sm text-terminal-sub">Les termes techniques utilisés dans le guide et dans les fiches pays.</p>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="rounded-xl border border-terminal-line bg-white/[0.02] p-4">
                  <dt className="text-sm font-medium text-terminal-ink">{g.term}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-terminal-sub">{g.definition}</dd>
                  {g.source && (
                    <dd className="mt-1.5 text-[11px]">
                      Source : <Ext link={g.source} />
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </section>

          <p className="border-t border-terminal-line pt-4 text-[11px] text-terminal-muted">
            Outil pédagogique : les scores et projections sont des constructions mécaniques, pas des conseils d’investissement.
          </p>
        </main>
      </div>
    </div>
  );
}
