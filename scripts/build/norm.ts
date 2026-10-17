// Normalisation des valeurs d'infobox : nombres, saisons, météo, horaires, listes.
import type { Season } from '../../src/data/schema.ts';
import { plain } from '../lib/wikitext.ts';

export function num(v: string | undefined): number | null {
  if (v == null) return null;
  const s = plain(v).replace(/<!--[\s\S]*?-->/g, '');
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(s.replace(/\s(?=\d{3}\b)/g, ''));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function clean(v: string | undefined): string {
  return v ? plain(v.replace(/<!--[\s\S]*?-->/g, '')).trim() : '';
}

const SEASON_WORDS: Record<string, Season> = { spring: 'spring', summer: 'summer', fall: 'fall', autumn: 'fall', winter: 'winter' };
export const ALL_SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export function seasons(v: string | undefined): Season[] {
  const s = clean(v).toLowerCase();
  if (!s) return [];
  if (/\b(any|all)\b/.test(s) && !/\bany\b.*\(tilling only\)/.test(s)) return [...ALL_SEASONS];
  const out = new Set<Season>();
  for (const [w, season] of Object.entries(SEASON_WORDS)) if (new RegExp(`\\b${w}\\b`).test(s)) out.add(season);
  return ALL_SEASONS.filter((x) => out.has(x));
}

export const WEATHER_ALL = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];
export function weather(v: string | undefined): string[] {
  const s = clean(v).toLowerCase();
  if (!s) return [];
  if (/\bany\b/.test(s)) return [...WEATHER_ALL];
  const out = new Set<string>();
  if (/sunny|clear/.test(s)) out.add('sunny');
  if (/rain/.test(s)) out.add('rain');
  if (/storm/.test(s)) out.add('storm');
  if (/\bsnow/.test(s)) out.add('snow');
  if (/wind/.test(s)) out.add('windy');
  if (/blizzard/.test(s)) out.add('blizzard');
  return WEATHER_ALL.filter((x) => out.has(x));
}

/**
 * Périodes de la journée (heures décimales, 26 = 2h le lendemain).
 * Source : tableau « Time » de coralisland.wiki (cité par plusieurs guides) — confiance moyenne.
 * Poissons : Morning 6–12, Afternoon 12–16, Evening 16–19, Night 19–26.
 * Insectes/créatures : Day 6–18, Night 18–26 (début de la nuit variable selon la saison).
 */
export const PERIODS: Record<string, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 16],
  evening: [16, 19],
  night: [19, 26],
  day: [6, 18],
  noon: [6, 18],
};

export type TimeRange = { from: number; to: number };

export function times(v: string | undefined): TimeRange[] {
  const raw = clean(v);
  const s = raw.toLowerCase();
  if (!s) return [];
  if (/all ?day|any|anytime/.test(s)) return [{ from: 6, to: 26 }];
  const out: TimeRange[] = [];
  // Plages explicites « 6:00 - 18:00 » / « 8am-4pm »
  for (const m of s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–~to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/g)) {
    let a = Number(m[1]) + Number(m[2] ?? 0) / 60;
    let b = Number(m[4]) + Number(m[5] ?? 0) / 60;
    if (m[3] === 'pm' && a < 12) a += 12;
    if (m[6] === 'pm' && b < 12) b += 12;
    if (b <= a) b += 24;
    out.push({ from: a, to: b });
  }
  if (out.length) return merge(out);
  for (const [w, [a, b]] of Object.entries(PERIODS)) if (new RegExp(`\\b${w}\\b`).test(s)) out.push({ from: a, to: b });
  return merge(out);
}

/** Template {{Time|8|16}} → plage. */
export function timeTpl(v: string | undefined): TimeRange[] {
  const m = /\{\{\s*time\s*\|\s*([\d:.]+)\s*\|\s*([\d:.]+)/i.exec(v ?? '');
  if (!m) return times(v);
  const h = (x: string) => (x.includes(':') ? Number(x.split(':')[0]) + Number(x.split(':')[1]) / 60 : Number(x));
  let a = h(m[1]);
  let b = h(m[2]);
  if (b <= a) b += 24;
  return [{ from: a, to: b }];
}

export function merge(r: TimeRange[]): TimeRange[] {
  const s = [...r].sort((a, b) => a.from - b.from);
  const out: TimeRange[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x.from <= last.to) last.to = Math.max(last.to, x.to);
    else out.push({ ...x });
  }
  return out;
}

/**
 * Valeur « à portée » : « '''Surface:''' Fall<br />'''Mine:''' Any » → [{scope:'Surface', value:'Fall'}, …].
 * Sans libellé → scope = ''.
 */
export function scoped(v: string | undefined): { scope: string; value: string }[] {
  if (!v) return [];
  const parts = v.split(/<br\s*\/?>|\n/i).map((x) => x.trim()).filter(Boolean);
  const out: { scope: string; value: string }[] = [];
  for (const p of parts) {
    const m = /^'''\s*([^']+?)\s*:?\s*'''\s*:?\s*(.*)$/.exec(p);
    if (m) out.push({ scope: m[1].replace(/:$/, '').trim(), value: m[2] });
    else if (out.length && !/^'''/.test(p) && out[out.length - 1].scope) out[out.length - 1].value += ' ' + p;
    else out.push({ scope: '', value: p });
  }
  return out;
}

/** Sépare une liste wikitext (« ; », « • », « , », sauts de ligne) hors liens, templates et parenthèses. */
export function list(v: string | undefined): string[] {
  if (!v) return [];
  const s = v.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, '\n');
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    if (two === '[[' || two === '{{') { depth++; cur += two; i++; continue; }
    if ((two === ']]' || two === '}}') && depth > 0) { depth--; cur += two; i++; continue; }
    if (c === '(') depth++;
    if (c === ')' && depth > 0) depth--;
    if (depth === 0 && (c === ';' || c === '•' || c === '\n' || c === ',')) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** Calcule les prix par qualité selon la formule du wiki (×1.15, ×1.3, ×1.5, ×2). */
export function qualityPrices(base: number | null, given: Partial<Record<'bronze' | 'silver' | 'gold' | 'osmium', number | null>> = {}) {
  if (base == null) return null;
  const r = (m: number) => Math.round(base * m);
  return {
    base,
    bronze: given.bronze ?? r(1.15),
    silver: given.silver ?? r(1.3),
    gold: given.gold ?? r(1.5),
    osmium: given.osmium ?? r(2),
  };
}

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export function rank(v: string | undefined): string | null {
  const s = clean(v).toUpperCase();
  const m = /\b([FEDCBAS])\b/.exec(s);
  return m ? m[1] : null;
}
