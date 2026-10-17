// Phase 1.1 — Récupération brute du wiki Fandom via l'API MediaWiki.
// Incrémental : l'inventaire (allpages + lastrevid) est rafraîchi à chaque run,
// seules les pages dont la révision a changé sont re-téléchargées.
//
// Sortie : .cache/pages/<ns>/<pageid>.json, .cache/inventory.json, .cache/redirects.json,
//          .cache/images.json, .cache/categories.json
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiAll, apiRaw, chunk, CACHE_DIR } from './lib/api.ts';

// 0 = articles, 10 = templates (données), 14 = catégories, 828 = modules Lua (tables de données)
const NAMESPACES = [0, 10, 14, 828];
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');

type InvPage = { pageid: number; ns: number; title: string; lastrevid: number; touched: string };

async function inventory(): Promise<InvPage[]> {
  const all: InvPage[] = [];
  for (const ns of NAMESPACES) {
    for await (const j of apiAll(
      { action: 'query', generator: 'allpages', gapnamespace: ns, gaplimit: 500, gapfilterredir: 'nonredirects', prop: 'info' },
      { fresh: true },
    )) {
      for (const p of j.query?.pages ?? []) all.push({ pageid: p.pageid, ns: p.ns, title: p.title, lastrevid: p.lastrevid, touched: p.touched });
    }
    console.log(`inventaire ns${ns}: ${all.filter((p) => p.ns === ns).length} pages`);
  }
  return all;
}

async function redirects() {
  // allpages(redirects) donne id→titre source, allredirects donne id source→cible.
  const titles = new Map<number, string>();
  for await (const j of apiAll({ action: 'query', list: 'allpages', apnamespace: 0, aplimit: 500, apfilterredir: 'redirects' }, { fresh: true })) {
    for (const p of j.query?.allpages ?? []) titles.set(p.pageid, p.title);
  }
  const out: Record<string, string> = {};
  for await (const j of apiAll(
    { action: 'query', list: 'allredirects', arnamespace: 0, arlimit: 500, arprop: 'ids|title|fragment' },
    { fresh: true },
  )) {
    for (const r of j.query?.allredirects ?? []) {
      const from = titles.get(r.fromid);
      if (from) out[from] = r.title + (r.fragment ? `#${r.fragment}` : '');
    }
  }
  console.log(`redirections: ${Object.keys(out).length}`);
  return out;
}

function pageFile(p: { ns: number; pageid: number }) {
  return join(CACHE_DIR, 'pages', String(p.ns), `${p.pageid}.json`);
}

/** Télécharge contenu + catégories + image principale pour un lot de pages (≤ 50). */
async function fetchBatch(ids: number[]) {
  const merged = new Map<number, any>();
  let cont: Record<string, string> = {};
  for (;;) {
    const j = await apiRaw({
      action: 'query',
      pageids: ids.join('|'),
      prop: 'revisions|categories|pageimages|categoryinfo',
      rvprop: 'content|ids|timestamp',
      rvslots: 'main',
      cllimit: 'max',
      clprop: 'hidden',
      piprop: 'original|name',
      ...cont,
    });
    for (const p of j.query?.pages ?? []) {
      const prev = merged.get(p.pageid) ?? { categories: [] };
      merged.set(p.pageid, {
        ...prev,
        ...p,
        revisions: p.revisions ?? prev.revisions,
        categories: [...prev.categories, ...(p.categories ?? [])],
      });
    }
    if (!j.continue) break;
    cont = j.continue;
  }
  for (const p of merged.values()) {
    const rev = p.revisions?.[0];
    const rec = {
      pageid: p.pageid,
      ns: p.ns,
      title: p.title,
      revid: rev?.revid,
      timestamp: rev?.timestamp,
      content: rev?.slots?.main?.content ?? '',
      categories: (p.categories ?? []).map((c: any) => ({ title: c.title.replace(/^Category:/, ''), hidden: !!c.hidden })),
      pageimage: p.pageimage ?? null,
      original: p.original ?? null,
      categoryinfo: p.categoryinfo ?? null,
    };
    await mkdir(join(CACHE_DIR, 'pages', String(p.ns)), { recursive: true });
    await writeFile(pageFile(p), JSON.stringify(rec));
  }
}

async function needsFetch(p: InvPage) {
  if (FORCE) return true;
  const f = pageFile(p);
  if (!existsSync(f)) return true;
  const cached = JSON.parse(await readFile(f, 'utf8'));
  return cached.revid !== p.lastrevid;
}

/** Récupère les URL CDN (imageinfo) de tous les fichiers référencés par les pages. */
async function images() {
  const file = join(CACHE_DIR, 'images.json');
  const known: Record<string, { url: string; width: number; height: number } | null> = existsSync(file)
    ? JSON.parse(await readFile(file, 'utf8'))
    : {};
  const wanted = new Set<string>();
  const dir = join(CACHE_DIR, 'pages', '0');
  for (const f of await readdir(dir)) {
    const p = JSON.parse(await readFile(join(dir, f), 'utf8'));
    if (p.pageimage) wanted.add(normFile(p.pageimage));
    // Paramètres d'infobox « image = X.png » et galeries
    for (const m of p.content.matchAll(/\|\s*(?:image|icon|portrait)\w*\s*=\s*(?:\[\[(?:File|Image):)?([^|\]\n{}<]+\.(?:png|gif|jpe?g|webp))/gi)) wanted.add(normFile(m[1]));
    for (const m of p.content.matchAll(/\[\[(?:File|Image):([^|\]\n]+)/gi)) wanted.add(normFile(m[1]));
    for (const m of p.content.matchAll(/^([^|\n<>{}=]+\.(?:png|gif|jpe?g|webp))\s*\|/gim)) wanted.add(normFile(m[1]));
  }
  const todo = [...wanted].filter((n) => !(n in known));
  console.log(`images: ${wanted.size} référencées, ${todo.length} à résoudre`);
  for (const [i, batch] of chunk(todo, 50).entries()) {
    const j = await apiRaw({ action: 'query', titles: batch.map((n) => `File:${n}`).join('|'), prop: 'imageinfo', iiprop: 'url|size' });
    const norm = new Map<string, string>((j.query?.normalized ?? []).map((n: any) => [n.to, n.from]));
    for (const n of batch) known[n] = null;
    for (const p of j.query?.pages ?? []) {
      const name = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
      const ii = p.imageinfo?.[0];
      known[normFile(name)] = ii ? { url: ii.url, width: ii.width, height: ii.height } : null;
    }
    if (i % 10 === 0) await writeFile(file, JSON.stringify(known));
  }
  await writeFile(file, JSON.stringify(known));
}

export function normFile(n: string) {
  const s = n.trim().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const inv = await inventory();
  await writeFile(join(CACHE_DIR, 'inventory.json'), JSON.stringify(inv));
  await writeFile(join(CACHE_DIR, 'redirects.json'), JSON.stringify(await redirects()));

  const todo: InvPage[] = [];
  for (const p of inv) if (await needsFetch(p)) todo.push(p);
  console.log(`pages à (re)télécharger: ${todo.length}/${inv.length}`);
  const batches = chunk(todo.map((p) => p.pageid), 50);
  for (const [i, b] of batches.entries()) {
    await fetchBatch(b);
    process.stdout.write(`\r  lot ${i + 1}/${batches.length}`);
  }
  process.stdout.write('\n');
  await images();
  await writeFile(join(CACHE_DIR, 'fetched-at.json'), JSON.stringify({ at: new Date().toISOString() }));
  console.log('terminé');
}

if (import.meta.main ?? process.argv[1]?.endsWith('fetch.ts')) await main();
