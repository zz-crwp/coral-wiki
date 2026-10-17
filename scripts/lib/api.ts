// Client MediaWiki minimal : 1 requête/s max, User-Agent explicite, cache brut sur disque.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const WIKI = 'https://coralisland.fandom.com';
export const API = `${WIKI}/api.php`;
export const WIKI_FR = 'https://coral-island.fandom.com/fr';
export const API_FR = `${WIKI_FR}/api.php`;
export const UA =
  'CoralWikiBot/0.1 (offline PWA companion for Coral Island; non-commercial; contact: github.com/huguesrob)';
export const CACHE_DIR = join(import.meta.dirname, '..', '..', '.cache');

const MIN_INTERVAL_MS = 1050;
let last = 0;

async function throttle() {
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

export type Params = Record<string, string | number | undefined>;

/** Appel API brut, sans cache. Retente sur 429/5xx avec backoff. */
export async function apiRaw(params: Params, base = API): Promise<any> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2' });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const url = `${base}?${qs}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
    if (res.ok) {
      const json = await res.json();
      if (json.error) throw new Error(`API error ${json.error.code}: ${json.error.info}`);
      return json;
    }
    if (res.status === 429 || res.status >= 500) {
      const backoff = 2000 * 2 ** attempt;
      console.warn(`  HTTP ${res.status}, nouvel essai dans ${backoff} ms`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    throw new Error(`HTTP ${res.status} pour ${url}`);
  }
  throw new Error(`Échec après 5 essais : ${url}`);
}

/** Appel API avec cache disque (clé = hash des paramètres). `fresh` force le réseau. */
export async function api(params: Params, opts: { fresh?: boolean; base?: string } = {}): Promise<any> {
  const base = opts.base ?? API;
  const key = createHash('sha1').update(base + JSON.stringify(params)).digest('hex');
  const file = join(CACHE_DIR, 'query', `${key}.json`);
  if (!opts.fresh && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const json = await apiRaw(params, base);
  await mkdir(join(CACHE_DIR, 'query'), { recursive: true });
  await writeFile(file, JSON.stringify(json));
  return json;
}

/** Itère sur toutes les pages d'une requête paginée (`continue`). */
export async function* apiAll(params: Params, opts: { fresh?: boolean; base?: string } = {}): AsyncGenerator<any> {
  let cont: Record<string, string> = {};
  for (;;) {
    const json = await api({ ...params, ...cont }, opts);
    yield json;
    if (!json.continue) return;
    cont = json.continue;
  }
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
