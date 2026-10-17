// Phase 1.5 — Noms français : wiki Fandom FR (coral-island.fandom.com/fr) + liens interlangues.
// Sortie : .cache/fr/pages.json (titre FR → contenu + lien EN), .cache/fr/langlinks-en.json (titre EN → titre FR)
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiAll, apiRaw, API_FR, chunk, CACHE_DIR } from './lib/api.ts';

const DIR = join(CACHE_DIR, 'fr');

async function main() {
  await mkdir(DIR, { recursive: true });

  // 1. Liens interlangues déclarés côté EN
  const enToFr: Record<string, string> = {};
  for await (const j of apiAll(
    { action: 'query', generator: 'allpages', gapnamespace: 0, gaplimit: 500, gapfilterredir: 'nonredirects', prop: 'langlinks', lllang: 'fr', lllimit: 'max' },
    { fresh: true },
  )) {
    for (const p of j.query?.pages ?? []) for (const l of p.langlinks ?? []) enToFr[p.title] = l.title;
  }
  console.log(`langlinks EN→FR: ${Object.keys(enToFr).length}`);

  // 2. Inventaire + contenu du wiki FR
  const ids: number[] = [];
  for await (const j of apiAll({ action: 'query', list: 'allpages', apnamespace: 0, aplimit: 500, apfilterredir: 'nonredirects' }, { fresh: true, base: API_FR })) {
    for (const p of j.query?.allpages ?? []) ids.push(p.pageid);
  }
  const pages: Record<string, { content: string; en: string | null; categories: string[] }> = {};
  for (const batch of chunk(ids, 50)) {
    let cont: Record<string, string> = {};
    for (;;) {
      const j = await apiRaw(
        { action: 'query', pageids: batch.join('|'), prop: 'revisions|langlinks|categories', rvprop: 'content', rvslots: 'main', lllang: 'en', lllimit: 'max', cllimit: 'max', ...cont },
        API_FR,
      );
      for (const p of j.query?.pages ?? []) {
        const prev = pages[p.title] ?? { content: '', en: null, categories: [] };
        pages[p.title] = {
          content: p.revisions?.[0]?.slots?.main?.content ?? prev.content,
          en: p.langlinks?.[0]?.title ?? prev.en,
          categories: [...prev.categories, ...(p.categories ?? []).map((c: any) => c.title.replace(/^Catégorie:/, ''))],
        };
      }
      if (!j.continue) break;
      cont = j.continue;
    }
  }
  console.log(`pages FR: ${Object.keys(pages).length}`);

  // 3. Redirections FR (variantes orthographiques → alias de recherche)
  const redirects: string[] = [];
  for await (const j of apiAll({ action: 'query', list: 'allpages', apnamespace: 0, aplimit: 500, apfilterredir: 'redirects' }, { fresh: true, base: API_FR })) {
    for (const p of j.query?.allpages ?? []) redirects.push(p.title);
  }

  await writeFile(join(DIR, 'langlinks-en.json'), JSON.stringify(enToFr, null, 1));
  await writeFile(join(DIR, 'pages.json'), JSON.stringify(pages));
  await writeFile(join(DIR, 'redirects.json'), JSON.stringify(redirects));
  console.log('terminé');
}

await main();
