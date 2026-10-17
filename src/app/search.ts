// Recherche instantanée FR/EN : insensible aux accents et à la casse, tolérante aux fautes, préfixes.
import MiniSearch from 'minisearch';
import { loadEntries, type Entry } from './data.ts';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'et', 'the', 'of', 'en']);

let engineP: Promise<{ ms: MiniSearch<Entry>; list: Entry[] }> | null = null;

export function engine() {
  return (engineP ??= loadEntries().then((list) => {
    const ms = new MiniSearch<Entry>({
      idField: 'id',
      fields: ['fr', 'en', 'frAlias', 'alias', 'cat'],
      storeFields: [],
      tokenize: (s) => s.split(/[\s\-'’,.()/|&]+/),
      processTerm: (t) => {
        const f = fold(t);
        return f && !STOP.has(f) ? f : null;
      },
      searchOptions: {
        boost: { fr: 3, en: 2.5, frAlias: 2.2, alias: 1.5, cat: 0.4 },
        prefix: (term) => term.length >= 2,
        fuzzy: (term) => (term.length >= 4 ? 0.25 : false),
        combineWith: 'AND',
      },
    });
    ms.addAll(list);
    return { ms, list };
  }));
}

export type Hit = { e: Entry; score: number };

export async function search(q: string): Promise<Hit[]> {
  const query = q.trim();
  if (!query) return [];
  const { ms, list } = await engine();
  const byId = new Map(list.map((e) => [e.id, e]));
  let res = ms.search(query);
  // Repli en OU si aucun résultat avec tous les mots
  if (!res.length) res = ms.search(query, { combineWith: 'OR' });
  const fq = fold(query);
  return res
    .map((r) => {
      const e = byId.get(r.id)!;
      // Bonus : correspondance exacte ou en début de nom
      const names = [fold(e.fr), fold(e.en), fold(e.frAlias)];
      const bonus = names.some((n) => n === fq) ? 50 : names.some((n) => n.startsWith(fq)) ? 10 : 0;
      return { e, score: r.score + bonus };
    })
    .sort((a, b) => b.score - a.score);
}

/** Regroupe par domaine, ordre des groupes = meilleur score du groupe. */
export function groupHits(hits: Hit[]) {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) (groups.get(h.e.dom) ?? groups.set(h.e.dom, []).get(h.e.dom)!).push(h);
  return [...groups].sort((a, b) => b[1][0].score - a[1][0].score);
}
