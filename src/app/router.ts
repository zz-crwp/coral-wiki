// Routeur par hash (compatible GitHub Pages sans réécriture serveur) + restauration du défilement.
import { signal, computed } from '@preact/signals';

export type Route = { path: string[]; query: URLSearchParams; raw: string };

function parse(hash = location.hash): Route {
  const raw = hash.replace(/^#/, '').split('#')[0] || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), raw };
}

export const route = signal<Route>(parse());
export const tab = computed(() => {
  const s = route.value.path[0] ?? '';
  if (['chercher', 'explorer', 'encyclo', 'fiche', 'recherche'].includes(s)) return 'chercher';
  if (['collections', 'progression', 'trackers', 'temple', 'musee'].includes(s)) return 'collections';
  if (['habitants'].includes(s)) return 'habitants';
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

/** Adresse sans la fiche ouverte en sheet : ouvrir ou fermer une fiche ne fait pas défiler la page. */
const base = (r: Route) => {
  const q = new URLSearchParams(r.query);
  q.delete('f');
  return r.path.join('/') + '?' + q.toString();
};

window.addEventListener('hashchange', () => {
  const prev = route.value;
  route.value = parse();
  if (base(prev) === base(route.value)) return;
  const y = scrolls[base(route.value)] ?? 0;
  // Après rendu : restaure la position (retour) ou remonte en haut (nouvelle page)
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
});

window.addEventListener(
  'scroll',
  () => {
    scrolls[base(route.value)] = window.scrollY;
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
    delete scrolls[base(parse(h))];
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

// --- Fiches en sheet : « #/chercher/poissons?f=arapaima » garde la liste derrière ---
const RECENT = 'cw-recent';
export function recent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]');
  } catch {
    return [];
  }
}
function remember(id: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify([id, ...recent().filter((x) => x !== id)].slice(0, 12)));
  } catch {}
}
export function openFiche(id: string) {
  remember(id);
  const r = route.value;
  // Depuis l'ancienne page « fiche », on reste en page ; sinon la sheet s'ouvre au-dessus de l'écran courant
  const path = r.path[0] === 'fiche' ? '/chercher' : '/' + r.path.join('/');
  const q = Object.fromEntries(r.query);
  go(path, { ...q, f: id });
}
export function closeFiche() {
  if (historyDepth > 0) back();
  else {
    const q = Object.fromEntries(route.value.query);
    delete q.f;
    go('/' + route.value.path.join('/'), q, true);
  }
}

// Les clics sur liens internes comptent comme navigation avant ; un lien de fiche ouvre la sheet
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest?.('a[href^="#"]');
  if (a && !e.defaultPrevented && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey) {
    const h = a.getAttribute('href')!;
    const m = /^#\/fiche\/([^?#]+)/.exec(h);
    if (m) {
      e.preventDefault();
      openFiche(decodeURIComponent(m[1]));
      return;
    }
    if (h.slice(1) !== route.value.raw) {
      delete scrolls[base(parse(h))];
      historyDepth++;
    }
  }
});
