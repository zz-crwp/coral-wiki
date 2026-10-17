// Inventaire complet des fichiers du wiki (list=allimages) : icônes de carte, météo, qualité… → .cache/allimages.json
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiRaw, CACHE_DIR } from './lib/api.ts';
const all: { name: string; url: string; width: number; height: number }[] = [];
let cont: any = {};
for (;;) {
  const j = await apiRaw({ action: 'query', list: 'allimages', ailimit: 500, aiprop: 'url|size', ...cont });
  all.push(...(j.query?.allimages ?? []).map((i: any) => ({ name: i.name, url: i.url, width: i.width, height: i.height })));
  if (!j.continue) break;
  cont = j.continue;
}
writeFileSync(join(CACHE_DIR, 'allimages.json'), JSON.stringify(all));
console.log(all.length);
