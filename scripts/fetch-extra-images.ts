// Images manquantes : recherche de fichiers par préfixe (list=allimages) pour les fiches sans image.
// Entrée : noms passés en JSON sur stdin. Sortie : fusion dans .cache/images.json + .cache/image-candidates.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiRaw, CACHE_DIR } from './lib/api.ts';
import { normFile } from './fetch.ts';

const names: string[] = JSON.parse(readFileSync(0, 'utf8'));
const imgFile = join(CACHE_DIR, 'images.json');
const candFile = join(CACHE_DIR, 'image-candidates.json');
const images = JSON.parse(readFileSync(imgFile, 'utf8'));
const cands: Record<string, string[]> = existsSync(candFile) ? JSON.parse(readFileSync(candFile, 'utf8')) : {};
for (const n of names) {
  if (n in cands) continue;
  const prefix = n.replace(/[’']/g, "'").split(/\s+/).slice(0, 3).join(' ');
  const j = await apiRaw({ action: 'query', list: 'allimages', aiprefix: prefix.replace(/ /g, '_'), ailimit: 20, aiprop: 'url|size' });
  cands[n] = [];
  for (const im of j.query?.allimages ?? []) {
    const f = normFile(im.name);
    images[f] = { url: im.url, width: im.width, height: im.height };
    cands[n].push(f);
  }
  console.log(n, '→', cands[n].slice(0, 4).join(' | '));
}
writeFileSync(imgFile, JSON.stringify(images));
writeFileSync(candFile, JSON.stringify(cands, null, 1));
