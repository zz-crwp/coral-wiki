import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from './icons.tsx';
import { back, canGoBack, tab } from './router.ts';
import { entry, thumb, seasonsOf, SEASON_FR, type Entry } from './data.ts';

/** Image du jeu : CDN d'origine, dimensions fixes, lazy, repli pictogramme si échec. */
export function GameImg({ src, dom, size, alt = '', eager = false }: { src: string; dom: string; size: number; alt?: string; eager?: boolean }) {
  // 0 = CORS (mise en cache propre par le service worker), 1 = sans CORS (repli), 2 = pictogramme
  const [mode, setMode] = useState(src ? 0 : 2);
  useEffect(() => setMode(src ? 0 : 2), [src]);
  return (
    <div class="thumb" style={{ width: size, height: size }}>
      {mode === 2 ? (
        <Icon name={dom} class="fallback" />
      ) : (
        <img
          key={mode}
          src={thumb(src, size <= 48 ? 96 : size <= 100 ? 200 : 400)}
          width={size}
          height={size}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerpolicy="no-referrer"
          crossOrigin={mode === 0 ? 'anonymous' : undefined}
          onError={() => setMode((m) => m + 1)}
        />
      )}
    </div>
  );
}

export function TopBar({ title, backTo, actions }: { title: string; backTo?: string; actions?: ComponentChildren }) {
  return (
    <header class="topbar">
      {backTo !== undefined && (
        <button class="icon-btn" onClick={() => back(backTo)} aria-label={canGoBack() ? 'Retour' : 'Remonter'}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      {actions}
    </header>
  );
}

const TABS = [
  { id: 'aujourdhui', label: "Aujourd'hui", icon: 'today', href: '#/' },
  { id: 'recherche', label: 'Recherche', icon: 'search', href: '#/recherche' },
  { id: 'encyclo', label: 'Encyclopédie', icon: 'book', href: '#/encyclo' },
  { id: 'trackers', label: 'Trackers', icon: 'check', href: '#/trackers' },
  { id: 'plus', label: 'Plus', icon: 'more', href: '#/plus' },
];

export function TabBar() {
  return (
    <nav class="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => (
        <a key={t.id} href={t.href} aria-current={tab.value === t.id ? 'page' : undefined}>
          <span class="tab-pill">
            <Icon name={t.icon} />
          </span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export function SeasonBadges({ mask }: { mask: number }) {
  if (!mask || mask === 15) return null;
  return (
    <span class="badges">
      {seasonsOf(mask).map((s) => (
        <span key={s} class={`badge ${s}`}>
          {SEASON_FR[s]}
        </span>
      ))}
    </span>
  );
}

export function EntryRow({ e, sub, highlight }: { e: Entry; sub?: ComponentChildren; highlight?: string }) {
  return (
    <a class="row" href={`#/fiche/${e.id}`}>
      <GameImg src={e.img} dom={e.dom} size={44} />
      <span class="txt">
        <span class="name">{highlight ? <Highlight text={e.fr} q={highlight} /> : e.fr}</span>
        <span class="sub">{sub ?? (e.hasFr ? `${e.en} · ${e.cat}` : e.frAlias ? `≈ ${e.frAlias} · ${e.cat}` : e.cat)}</span>
      </span>
      <Icon name="chevron" class="chev" />
    </a>
  );
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Surligne la première occurrence (insensible aux accents) du terme recherché. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const t = fold(text);
  const words = fold(q).split(/\s+/).filter((w) => w.length > 1);
  for (const w of words) {
    const i = t.indexOf(w);
    if (i >= 0) return <>{text.slice(0, i)}<mark>{text.slice(i, i + w.length)}</mark>{text.slice(i + w.length)}</>;
  }
  return <>{text}</>;
}

/**
 * Liste virtualisée sur le défilement de la fenêtre (lignes de hauteur fixe).
 * Seules les lignes visibles ± marge sont rendues : fluide même avec 450 éléments.
 */
export function VirtualList<T>({ items, rowHeight, render, overscan = 8 }: { items: T[]; rowHeight: number; render: (item: T, i: number) => ComponentChildren; overscan?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, Math.min(items.length, 30)]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const y = window.scrollY - top;
      const h = window.innerHeight;
      const start = Math.max(0, Math.floor(y / rowHeight) - overscan);
      const end = Math.min(items.length, Math.ceil((y + h) / rowHeight) + overscan);
      setRange((r) => (r[0] === start && r[1] === end ? r : [start, end]));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [items, rowHeight, overscan]);
  const [a, b] = range;
  return (
    <div ref={ref} class="list" role="list" style={{ position: 'relative', height: items.length * rowHeight }}>
      {items.slice(a, b).map((it, k) => (
        <div role="listitem" key={a + k} style={{ position: 'absolute', top: (a + k) * rowHeight, left: 0, right: 0 }}>
          {render(it, a + k)}
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon = 'wave', children }: { icon?: string; children: ComponentChildren }) {
  return (
    <div class="empty">
      <Icon name={icon} />
      {children}
    </div>
  );
}

/** Lien interne encodé « [[id|libellé]] » dans les textes générés → <a>. */
export function RichText({ text }: { text: string }) {
  const parts: ComponentChildren[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([a-z0-9-]+)\|([^\]]*)\]\]/g)) {
    parts.push(text.slice(last, m.index));
    const e = entry(m[1]);
    const label = e && e.hasFr && m[2].trim().toLowerCase() === e.en.toLowerCase() ? e.fr : m[2];
    parts.push(
      <a key={m.index} href={`#/fiche/${m[1]}`}>
        {label}
      </a>,
    );
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Case à cocher de suivi (cible 44 px), liée à une clé du profil actif. */
export function CheckBtn({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button class="check" aria-pressed={on} aria-label={label} onClick={onToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        {on && <path d="m8 12.3 2.7 2.7 5.3-5.6" />}
      </svg>
    </button>
  );
}

/** Barre de progression accessible. */
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done * 100) / total) : 0;
  return (
    <div class="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} sur ${total} (${pct} %)`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
