// Chargement du cache brut + résolution titre → id.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, WIKI } from './api.ts';
import { normName } from './wikitext.ts';

export type Page = {
  pageid: number;
  ns: number;
  title: string;
  revid: number;
  timestamp: string;
  content: string;
  categories: { title: string; hidden: boolean }[];
  pageimage: string | null;
  original: { source: string; width: number; height: number } | null;
  categoryinfo: { size: number; pages: number; files: number; subcats: number } | null;
};

export function loadNs(ns: number): Map<string, Page> {
  const dir = join(CACHE_DIR, 'pages', String(ns));
  const out = new Map<string, Page>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p: Page = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    out.set(p.title, p);
  }
  return out;
}

export function loadJson<T>(rel: string, fallback: T): T {
  const f = join(CACHE_DIR, rel);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;
}

export function pageUrl(title: string) {
  return `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`;
}

/** Slug ASCII stable à partir du titre EN. */
export function slug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Clé de comparaison tolérante (casse, apostrophes, espaces, pluriels simples non gérés). */
export function key(s: string): string {
  return normName(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Résolveur : nom (lien, valeur de template, « Wood*10 ») → id d'entité.
 * Gère redirections, casse, ancres, suffixes de quantité/qualité.
 */
export class Resolver {
  private byKey = new Map<string, string>();
  private redirects = new Map<string, string>();
  unresolved = new Map<string, number>();

  constructor(redirects: Record<string, string>) {
    for (const [from, to] of Object.entries(redirects)) this.redirects.set(key(from), to.replace(/#.*/, ''));
  }

  add(title: string, id: string) {
    this.byKey.set(key(title), id);
  }

  alias(name: string, id: string) {
    const k = key(name);
    if (!this.byKey.has(k)) this.byKey.set(k, id);
  }

  has(id: string) {
    for (const v of this.byKey.values()) if (v === id) return true;
    return false;
  }

  /** Résout ou renvoie null (et comptabilise l'échec). */
  resolve(raw: string, track = true): string | null {
    if (!raw) return null;
    let name = raw
      .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
      .replace(/'''?/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/#.*/, '')
      .replace(/\*\s*[\d.,]+.*$/, '') // « Wood*10 »
      .replace(/\/\s*(bronze|silver|gold|osmium|\d).*$/i, '') // « Item/gold »
      .trim();
    if (!name) return null;
    let k = key(name);
    for (let hop = 0; hop < 3; hop++) {
      const id = this.byKey.get(k);
      if (id) return id;
      const r = this.redirects.get(k);
      if (!r) break;
      k = key(r);
    }
    // Variantes : sans parenthèse finale, singulier naïf
    const variants = [k.replace(/\s*\(.*\)$/, ''), k.replace(/s$/, ''), k.replace(/es$/, ''), k + 's'];
    for (const v of variants) {
      const id = this.byKey.get(v) ?? (this.redirects.get(v) ? this.byKey.get(key(this.redirects.get(v)!)) : undefined);
      if (id) return id;
    }
    if (track) this.unresolved.set(name, (this.unresolved.get(name) ?? 0) + 1);
    return null;
  }
}
