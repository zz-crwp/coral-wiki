// Logique de jeu partagée (écran Aujourd'hui, listes, fiches) : disponibilités, ouvertures, rentabilité,
// position des habitants. Fonctions pures sur les données compactes d'aujourdhui.json et du profil.
import { SEASONS, type Season } from './data.ts';
import { weekday, type GameDate } from './store.ts';
import { hours } from './fiche/labels.ts';

type X = Record<string, any>;
export type Range = { from: number; to: number };
type Cond = { s: number; w: number; h: Range[]; dj?: [number, number, number][] };
export type TodayData = {
  anniversaires: { id: string; s: Season; j: number }[];
  festivals: { id: string; s: Season; j: number; f: number; h: string }[];
  captures: (Cond & { id: string; d: string; l: string; r?: string; c?: (Cond & { z: string })[] })[];
  cultures: { id: string; s: number; g: number; r: number; pg: number; v: number; gr: string; o: number; rg: string | null }[];
  boutiques: { id: string; o: { j: number[]; p: Range[] }[]; f: number[]; m: number; own?: string[] }[];
};
export type Capture = TodayData['captures'][number];
export type Crop = TodayData['cultures'][number];
export type Shop = TodayData['boutiques'][number];

let todayP: Promise<TodayData> | null = null;
export const loadToday = () => (todayP ??= import('../data/aujourdhui.json').then((m) => (m.default ?? m) as unknown as TodayData));

export const WEATHERS = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];
export const SBIT: Record<Season, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
const DAYS = 28;

/** Nombre de jours de d jusqu'à (s, j), dans les 112 jours à venir. */
export const daysUntil = (d: GameDate, s: Season, j: number) => (SEASONS.indexOf(s) * DAYS + j - (SEASONS.indexOf(d.season) * DAYS + d.day) + DAYS * 4) % (DAYS * 4);
export const inDays = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} j`);

const inRanges = (h: Range[], hr: number) => !h.length || h.some((r) => r.from <= hr && hr < r.to);
export const uniqRanges = (h: Range[]) => [...new Map(h.map((r) => [`${r.from}-${r.to}`, r])).values()].sort((a, b) => a.from - b.from);

/** Zones où la capture est possible (vide = indisponible). `hr` null = n'importe quand dans la journée. */
export function catchZones(c: Capture, bit: number, w: number, hr: number | null, day?: number): { zones: string[]; h: Range[] } {
  const inDay = (x: Cond) => !x.dj || day == null || x.dj.some(([b, a, z]) => b & bit && a <= day && day <= z);
  const ok = (x: Cond) => !!(x.s & bit) && !!(x.w & (1 << w)) && (hr == null || inRanges(x.h, hr)) && inDay(x);
  if (c.c) {
    const m = c.c.filter(ok);
    return { zones: m.map((x) => x.z), h: uniqRanges(m.flatMap((x) => x.h)) };
  }
  return ok(c) ? { zones: [c.l], h: uniqRanges(c.h) } : { zones: [], h: [] };
}

/** État d'une capture pour la date, la météo et l'heure du profil. */
export function catchState(c: Capture, d: GameDate, weather: string, hr: number) {
  const bit = SBIT[d.season];
  const w = Math.max(0, WEATHERS.indexOf(weather));
  const now = catchZones(c, bit, w, hr, d.day);
  const today = now.zones.length ? now : catchZones(c, bit, w, null, d.day);
  const season = !!(c.s & bit);
  return { now: now.zones.length > 0, today: today.zones.length > 0, season, zones: today.zones, h: today.h, next: today.h.find((r) => r.from > hr)?.from };
}

/** « jours 15–28 » quand une fenêtre de jours s'applique cette saison. */
export function dayWindows(c: Capture, bit: number) {
  const dj = [...(c.dj ?? []), ...(c.c ?? []).flatMap((x) => x.dj ?? [])].filter(([b]) => b & bit);
  return [...new Set(dj.map(([, a, z]) => `${a}–${z}`))];
}

/** Rentabilité d'une culture plantée aujourd'hui (prix de base, 1 récolte par plant). */
export function cropPlan(c: Crop, d: GameDate) {
  const r = cropCalc(c, d.season, d.day, 1, 1);
  return r && r.harvests > 0 ? { harvests: r.harvests, seeds: r.seeds, profit: r.profit, rem: r.rem } : null;
}

export function openNow(b: Shop, wd: number, hr: number) {
  if (b.f.includes(wd)) return { open: false, today: [] as Range[], known: true };
  const today = b.o.filter((o) => o.j.includes(wd)).flatMap((o) => o.p);
  const known = b.o.some((o) => o.j.length);
  return { open: today.some((r) => r.from <= hr && hr < r.to), today, known };
}

/** État d'une boutique : ouverte jusqu'à quand, sinon prochaine ouverture. */
export function shopState(b: Shop, d: GameDate, hr: number) {
  const st = openNow(b, weekday(d.day), hr);
  const close = st.today.find((r) => r.from <= hr && hr < r.to)?.to;
  const next = st.open ? null : nextOpening(b, d, hr);
  return { ...st, close, next };
}

export function nextOpening(b: Shop, d: GameDate, hr: number) {
  for (let k = 0; k < 8; k++) {
    const wd = (weekday(d.day) + k) % 7;
    if (b.f.includes(wd)) continue;
    const plages = b.o.filter((o) => o.j.includes(wd)).flatMap((o) => o.p).sort((a, c) => a.from - c.from);
    const r = plages.find((p) => (k > 0 ? true : p.from > hr));
    if (r) return { k, wd, from: r.from };
  }
  return null;
}

export function cropCalc(c: Crop, season: Season, day: number, plants: number, mult: number) {
  if (!(c.s & SBIT[season])) return null;
  let extra = 0;
  for (let k = 1, s = SEASONS.indexOf(season); k < 4; k++) {
    if (!(c.s & (1 << ((s + k) % 4)))) break;
    extra += DAYS;
  }
  const rem = DAYS - day + extra;
  const lastDay = Math.min(DAYS, DAYS + extra - c.g);
  if (rem < c.g) return { harvests: 0, seeds: 0, cost: 0, revenue: 0, profit: 0, perDay: 0, roi: 0, rem, lastDay, cycles: 0 };
  const cycles = c.r > 0 ? 1 : Math.floor(rem / c.g);
  const harvests = c.r > 0 ? 1 + Math.floor((rem - c.g) / c.r) : cycles;
  const price = Math.floor(c.v * mult);
  const cost = cycles * c.pg * plants;
  const revenue = harvests * price * plants;
  const profit = revenue - cost;
  return { harvests, seeds: cycles * plants, cost, revenue, profit, perDay: profit / rem, roi: cost ? profit / cost : 0, rem, lastDay, cycles };
}

// ---------- Où est l'habitant en ce moment (emploi du temps du wiki) ----------

const FR_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const FR_SEASONS: Record<string, Season> = { printemps: 'spring', été: 'summer', ete: 'summer', automne: 'fall', hiver: 'winter' };
type Scope = { days: number[] | null; seasons: Season[] | null; dates: { s: Season; a: number; b: number }[]; wet: boolean | null };

/** « Été ; lundi – vendredi », « Tous les jours sauf le mercredi », « 15–28 de l'automne », « Samedi, pluie ou neige »… */
function parseScope(txt: string): Scope {
  const t = txt.toLowerCase().replace(/[–—]/g, '-');
  const seasons = Object.entries(FR_SEASONS).filter(([k]) => new RegExp(`(^|[^a-zà-ü])${k}([^a-zà-ü]|$)`).test(t)).map(([, v]) => v);
  const dates = [...t.matchAll(/(\d{1,2})(?:\s*(?:-|à)\s*(\d{1,2}))?(?:\s*et\s*\d{1,2})?\s+d[eu]\s+l?'?\s*(printemps|été|ete|automne|hiver)/g)].map((m) => ({ s: FR_SEASONS[m[3]], a: +m[1], b: +(m[2] ?? m[1]) }));
  const wet = /pluvieux|pluie|neige|orage|neigeux/.test(t) ? true : null;
  let days: number[] | null = null;
  if (/tous les jours|n'importe quel jour|chaque jour/.test(t)) days = [0, 1, 2, 3, 4, 5, 6];
  const set = new Set<number>();
  for (const m of t.matchAll(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*(?:-|à)\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/g))
    for (let i = FR_DAYS.indexOf(m[1]); ; i = (i + 1) % 7) {
      set.add(i);
      if (i === FR_DAYS.indexOf(m[2])) break;
    }
  for (const [i, d] of FR_DAYS.entries()) if (new RegExp(`\\b${d}\\b`).test(t) && !new RegExp(`sauf (le )?${d}`).test(t)) set.add(i);
  if (set.size) days = days ?? [...set];
  const sauf = /sauf (le )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/.exec(t);
  if (sauf) days = (days ?? [0, 1, 2, 3, 4, 5, 6]).filter((d) => d !== FR_DAYS.indexOf(sauf[2]));
  return { days, seasons: seasons.length ? seasons : null, dates, wet };
}

export function whereNow(schedule: X[], d: GameDate, weather: string, hour: number) {
  const wd = weekday(d.day);
  const wet = ['rain', 'storm', 'snow', 'blizzard'].includes(weather);
  let best: { score: number; etapes: X[] } | null = null;
  for (const block of schedule) {
    const bs = parseScope(block.condition ?? '');
    for (const g of block.groupes ?? []) {
      const gs = parseScope(g.jours ?? '');
      const seasons = gs.seasons ?? bs.seasons;
      const dates = [...gs.dates, ...bs.dates];
      const w = gs.wet ?? bs.wet;
      if (seasons && !seasons.includes(d.season)) continue;
      if (dates.length && !dates.some((x) => x.s === d.season && x.a <= d.day && d.day <= x.b)) continue;
      if (w && !wet) continue;
      if (gs.days && !dates.length && !gs.days.includes(wd)) continue;
      if (!gs.days && !dates.length && !w && /^(cabanon|autres jours)/i.test(g.jours ?? '')) continue;
      // Le plus spécifique l'emporte : date > météo > saison > jours > habituel
      const score = (dates.length ? 8 : 0) + (w ? 4 : 0) + (seasons ? 2 : 0) + (gs.days && gs.days.length < 7 ? 1 : 0);
      if (!best || score > best.score) best = { score, etapes: g.etapes ?? [] };
    }
  }
  if (!best?.etapes.length) return null;
  const steps = best.etapes.filter((s) => s.texte && !/à compléter|to be added|^\(?\?\)?$/i.test(s.texte)).sort((a, b) => a.heure - b.heure);
  if (!steps.length) return null;
  const cur = [...steps].reverse().find((s) => s.heure <= hour);
  return cur ? { texte: cur.texte as string, depuis: cur.heure as number } : { texte: `Chez soi (sort vers ${hours(steps[0].heure)})`, depuis: null };
}
