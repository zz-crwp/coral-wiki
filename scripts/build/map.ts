// Cartes du wiki (« Map:Coral Island » et « Map:Coral Island Diving Map », voir scripts/fetch-map.ts) :
// chaque lieu et chaque zone d'apparition reçoit ses repères sur l'image de l'île ou de la plongée.
// Repère compact : [carte (0 île, 1 plongée), x ‰, y ‰ depuis le haut, n° de zone dans la liste].
// À appeler avant la traduction : les zones sont encore en anglais.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR } from '../lib/api.ts';
import { clean } from './norm.ts';
import { Ctx } from './ctx.ts';

type Marker = { id: string; title: string; cat: string; link: string; x: number; y: number; map: 0 | 1 };
export type Pin = [0 | 1, number, number, number];
export type MapInfo = { nom: string; img: string; w: number; h: number; source: string };

const TITLES = ['Map:Coral Island', 'Map:Coral Island Diving Map'];
const NOMS = ["Carte de l'île", 'Carte de la plongée'];
const low = (s: string) => clean(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export function mapData(ctx: Ctx): { cartes: MapInfo[] } | null {
  const f = join(CACHE_DIR, 'map.json');
  if (!existsSync(f)) return null;
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  const markers: Marker[] = [];
  const cartes: MapInfo[] = [];
  TITLES.forEach((t, mi) => {
    const m = raw[t]?.map;
    const img = raw[t]?.image;
    if (!m || !img) return;
    const [[x0, y0], [x1, y1]] = m.mapBounds;
    const cats = new Map<string, string>(m.categories.map((c: any) => [String(c.id), c.name]));
    for (const k of m.markers) {
      const [x, y] = k.position;
      const top = m.origin === 'bottom-left' ? 1 - (y - y0) / (y1 - y0) : (y - y0) / (y1 - y0);
      markers.push({ id: String(k.id), title: k.popup?.title ?? '', cat: cats.get(String(k.categoryId)) ?? '', link: k.popup?.link?.url ?? '', x: Math.round(((x - x0) / (x1 - x0)) * 1000), y: Math.round(top * 1000), map: mi as 0 | 1 });
    }
    // Vignette de 1600 px servie par le CDN du wiki (image non copiée dans le dépôt)
    const width = Math.min(1600, img.width);
    const url = String(img.url).replace('/revision/latest', `/revision/latest/scale-to-width-down/${width}`);
    cartes.push({ nom: NOMS[mi], img: url, w: width, h: Math.round((img.height * width) / img.width), source: `https://coralisland.fandom.com/wiki/${t.replace(/ /g, '_')}` });
  });
  if (!markers.length) return null;

  const byTitle = (re: RegExp, map?: 0 | 1) => markers.filter((m) => re.test(low(m.title)) && (map === undefined || m.map === map));
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = (name: string, map?: 0 | 1) => byTitle(new RegExp(`^${esc(low(name))}$`), map);

  /** Repères d'une zone d'apparition (« River (Farm, Forest) », « Ocean (Beach) », « Herding Area »…). */
  const zoneMarkers = (zone: string): Marker[] => {
    const z = low(zone);
    const inner = /\(([^)]*)\)/.exec(z)?.[1]?.split(/\s*,\s*/) ?? [];
    const base = z.replace(/\s*\(.*$/, '').trim();
    if (base === 'river') return (inner.length ? inner : ['farm', 'forest', 'town']).flatMap((p) => exact(`${p} river`, 0));
    if (base === 'ocean') return inner.length ? inner.flatMap((p) => exact(`ocean ${p}`, 0)) : byTitle(/^ocean /, 0);
    if (/^(wind|water|earth|fire) mine|^cavern|^mines?$/.test(z)) return exact('cavern and mines inside', 0);
    if (base === 'lake') return byTitle(/^lake temple$/, 0).filter((m) => m.cat === 'Fishing locations');
    const dive = /^zone (\d)$/.exec(z);
    if (dive) return byTitle(new RegExp(`^zone ${dive[1]} - \\d+m$`), 1);
    if (/ area$/.test(z)) return byTitle(new RegExp(`^\\d+m ${esc(z)}$`), 1);
    if (base === 'forest') return [...exact('forest sacred tree', 0), ...exact('forest cavern waypoint', 0)];
    if (base === 'vineyard' || base === 'hillside brewery and vineyard') return exact('vineyard shed', 0);
    if (base === 'town' || base === 'starlet town') return exact('town waypoint', 0);
    if (/^trash cans?$/.test(base)) return markers.filter((m) => m.map === 0 && m.cat === 'Trash cans');
    const direct = exact(base, 0).filter((m) => !/trash/i.test(m.cat));
    if (direct.length) return direct;
    return exact(`${base} waypoint`, 0);
  };
  /** Repères d'une fiche lieu : identifiant de la carte (mapid), lien de la bulle, titre, ou point de voyage. */
  const placeMarkers = (title: string, mapid: string): Marker[] => {
    const t = low(title);
    if (mapid) {
      const m = markers.filter((k) => k.map === 0 && k.id === mapid);
      if (m.length) return m.slice(0, 1);
    }
    const byLink = markers.filter((k) => k.map === 0 && low(k.link) === t && !/^fishing$/i.test(k.link));
    if (byLink.length) return byLink.slice(0, 3);
    const z = zoneMarkers(title);
    return z.slice(0, 6);
  };

  const pins = (zones: string[]): Pin[] => zones.flatMap((z, i) => zoneMarkers(z).map((m) => [m.map, m.x, m.y, i] as Pin));
  let nPlace = 0;
  let nZone = 0;
  for (const d of ctx.drafts.values()) {
    if (d.domain === 'lieux') {
      const ms = placeMarkers(d.nom_en, clean(d.infobox?.params.mapid ?? ''));
      if (ms.length) {
        d.extra.carte = ms.map((m) => [m.map, m.x, m.y, 0] as Pin);
        nPlace++;
      }
      continue;
    }
    if (d.lieux.length) {
      const p = pins(d.lieux);
      if (p.length) (d.extra.carte = p), nZone++;
    }
    for (const c of (d.extra.conditions ?? []) as any[]) {
      const p = pins(c.zones?.length ? c.zones : c.zone ? [c.zone] : d.lieux);
      if (p.length) c.carte = p;
    }
  }
  console.log(`cartes : ${markers.length} repères ; ${nPlace} lieux et ${nZone} fiches placés sur la carte`);
  return { cartes };
}
