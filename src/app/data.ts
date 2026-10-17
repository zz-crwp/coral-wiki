// Accès aux données : index compact chargé au démarrage, domaines chargés à la demande (chunks séparés).
import type { Entity } from '../data/schema.ts';
import meta from '../data/meta.json';
import domains from '../data/domaines.json';

export { meta };
export const DOMAINS = domains as Record<string, string>;

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
export const SEASON_FR: Record<Season, string> = { spring: 'Printemps', summer: 'Été', fall: 'Automne', winter: 'Hiver' };

export type Entry = {
  id: string;
  fr: string; // nom affiché (FR officiel ou EN)
  en: string;
  hasFr: boolean;
  cat: string;
  dom: string;
  img: string; // URL complète ou ''
  seasons: number; // masque 1=printemps 2=été 4=automne 8=hiver
  alias: string; // redirections EN (alias de recherche)
  frAlias: string; // nom FR non officiel ('' si aucun)
  universal: string; // niveau de cadeau universel : L/l/n/d/h ou ''
};

type RawSearch = { img: string; e: (string | number)[][] };

let entriesP: Promise<Entry[]> | null = null;
let byId: Map<string, Entry> | null = null;

export function loadEntries(): Promise<Entry[]> {
  return (entriesP ??= import('../data/search.json').then((m) => {
    const raw = (m.default ?? m) as unknown as RawSearch;
    const list = raw.e.map(([id, fr, en, cat, dom, img, s, alias, frAlias, universal]) => ({
      id: id as string,
      fr: (fr as string) || (en as string),
      en: en as string,
      hasFr: !!fr,
      cat: cat as string,
      dom: dom as string,
      img: !img ? '' : String(img).startsWith('http') ? (img as string) : raw.img + img,
      seasons: (s as number) ?? 0,
      alias: (alias as string) ?? '',
      frAlias: (frAlias as string) ?? '',
      universal: (universal as string) ?? '',
    }));
    byId = new Map(list.map((e) => [e.id, e]));
    return list;
  }));
}

export function entry(id: string): Entry | undefined {
  return byId?.get(id);
}

// Un chunk JSON par domaine, généré par Vite (import dynamique).
const domainFiles = import.meta.glob<{ default: Entity[] }>(['../data/*.json', '!../data/{search,meta,domaines,conflits,temple,musee,rang,mines,aujourdhui,suivi,cadeaux}.json']);
const articleFiles = import.meta.glob<{ default: Record<string, Block[]> }>('../data/articles/*.json');
const cache = new Map<string, Promise<Map<string, Entity>>>();

export function loadDomain(dom: string): Promise<Map<string, Entity>> {
  let p = cache.get(dom);
  if (!p) {
    const f = domainFiles[`../data/${dom}.json`];
    p = f ? f().then((m) => new Map(m.default.map((e) => [e.id, e]))) : Promise.resolve(new Map());
    cache.set(dom, p);
  }
  return p;
}

export async function loadEntity(id: string): Promise<Entity | undefined> {
  await loadEntries();
  const e = entry(id);
  if (!e) return undefined;
  return (await loadDomain(e.dom)).get(id);
}

export type Block = { t: 'h'; l: number; x: string } | { t: 'p'; x: string } | { t: 'ul'; i: string[] } | { t: 'tb'; h: string[]; r: string[][]; c?: string };

export async function loadArticle(dom: string, id: string): Promise<Block[] | undefined> {
  const f = articleFiles[`../data/articles/${dom}.json`];
  if (!f) return undefined;
  return (await f()).default[id];
}

/** Vignette CDN Fandom redimensionnée (évite de charger l'original). */
export function thumb(url: string, w: number): string {
  if (!url) return '';
  if (url.includes('wikia.nocookie.net')) return `${url.replace(/\/revision\/latest.*$/, '')}/revision/latest/scale-to-width-down/${w}`;
  return url;
}

export function seasonsOf(mask: number): Season[] {
  return SEASONS.filter((_, i) => mask & (1 << i));
}
