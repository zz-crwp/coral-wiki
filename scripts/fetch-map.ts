// Carte interactive du wiki (« Map:Coral Island », espace de noms Map) : image de l'île et repères des lieux.
// Sortie : .cache/map.json (contenu brut de la carte) + infos de l'image de fond. 2 requêtes, cache sur disque.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { api, CACHE_DIR } from './lib/api.ts';

const out: Record<string, any> = {};
for (const title of ['Map:Coral Island', 'Map:Coral Island Diving Map']) {
  const r = await api({ action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main', titles: title, format: 'json', formatversion: 2 });
  const p = r.query.pages[0];
  const rev = p.revisions?.[0];
  const map = rev ? JSON.parse(rev.slots.main.content) : null;
  const img = map?.mapImage;
  let image = null;
  if (img) {
    const ii = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size', titles: `File:${img}`, format: 'json', formatversion: 2 });
    image = ii.query.pages[0].imageinfo?.[0] ?? null;
  }
  out[title] = { rev: rev?.revid, date: rev?.timestamp, map, image };
  console.log(title, rev?.revid, img, image?.width, image?.height, map?.markers?.length ?? Object.keys(map?.categories ?? {}).length);
}
writeFileSync(join(CACHE_DIR, 'map.json'), JSON.stringify(out));
