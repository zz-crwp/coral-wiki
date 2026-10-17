// Routeur par hash (compatible GitHub Pages sans réécriture serveur) + restauration du défilement.
import { signal, computed } from '@preact/signals';

export type Route = { path: string[]; query: URLSearchParams; raw: string };

function parse(): Route {
  const raw = location.hash.replace(/^#/, '').split('#')[0] || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), raw };
}

export const route = signal<Route>(parse());
export const tab = computed(() => {
  const s = route.value.path[0] ?? '';
  if (s === 'recherche') return 'recherche';
  if (['encyclo', 'fiche', 'temple', 'musee', 'rang', 'mines'].includes(s)) return 'encyclo';
  if (s === 'trackers') return 'trackers';
  if (['plus', 'credits', 'outils', 'favoris'].includes(s)) return 'plus';
  return 'aujourdhui';
});

const SCROLL_KEY = 'cw-scroll';
const scrolls: Record<string, number> = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}');
  } catch {
    return {};
  }
})();
let historyDepth = 0;

window.addEventListener('hashchange', () => {
  route.value = parse();
  const y = scrolls[route.value.raw] ?? 0;
  // Après rendu : restaure la position (retour) ou remonte en haut (nouvelle page)
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
});

window.addEventListener(
  'scroll',
  () => {
    scrolls[route.value.raw] = window.scrollY;
  },
  { passive: true },
);
window.addEventListener('pagehide', () => {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrolls));
  } catch {}
});

export function href(path: string, query?: Record<string, string | undefined>) {
  const q = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString() : '';
  return `#${path}${q ? `?${q}` : ''}`;
}

export function go(path: string, query?: Record<string, string | undefined>, replace = false) {
  const h = href(path, query);
  if (replace) {
    history.replaceState(null, '', h);
    route.value = parse();
  } else {
    delete scrolls[h.slice(1)];
    historyDepth++;
    location.hash = h.slice(1);
  }
}

/** Retour : historique de l'app si possible, sinon page parente. */
export function back(fallback = '/') {
  if (historyDepth > 0) {
    historyDepth--;
    history.back();
  } else go(fallback, undefined, true);
}

export function canGoBack() {
  return historyDepth > 0;
}

// Les clics sur liens internes comptent comme navigation avant
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a[href^="#"]');
  if (a && !e.defaultPrevented && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey) {
    const h = a.getAttribute('href')!;
    if (h.slice(1) !== route.value.raw) {
      delete scrolls[h.slice(1)];
      historyDepth++;
    }
  }
});
