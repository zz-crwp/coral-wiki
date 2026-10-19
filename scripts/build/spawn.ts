// Conditions d'apparition par zone (poissons, insectes, créatures marines).
// Le wiki mélange plusieurs écritures dans l'infobox :
//   location = '''Spring, Winter:''' [[Deep Forest]] <br />'''Fall 22-28:''' Water Mine • Wind Mine
//   season   = '''Surface:''' [[Spring]] • [[Winter]] <br />'''Mine:''' Any
//   time     = '''Deep Forest:''' All Day<br />'''River (Forest):''' Afternoon • Evening
//   weather  = '''River (Farm)/Lake:''' Rain • Storm   |   '''Sunny, Windy:''' [[Beach]] • [[Town]]
// On en tire une condition par zone : saisons, fenêtres de jours, plages horaires, météo.
import { clean, list, scoped, seasons, times, weather, WEATHER_ALL, type TimeRange } from './norm.ts';
import type { Season } from '../../src/data/schema.ts';

const ALL: Season[] = ['spring', 'summer', 'fall', 'winter'];
const SEASON_RE = /\b(spring|summer|fall|autumn|winter)\b/gi;
const SEAS = (w: string): Season => (w.toLowerCase() === 'autumn' ? 'fall' : (w.toLowerCase() as Season));

export type DayWindow = { saison: Season; de: number; a: number };
export type ZoneCond = { zone: string | null; zones?: string[]; saisons: Season[]; horaires: TimeRange[]; meteo: string[]; jours?: DayWindow[] };

/** Portée exprimée en saisons ? « Spring, Winter », « Fall 22-28 », « Any season », « All Year », « Fall to Spring ». */
function seasonScope(scope: string): { saisons: Season[]; jours: DayWindow[] } | null {
  const s = clean(scope).toLowerCase();
  if (/^(any( season)?|all year|year[- ]round)$/.test(s)) return { saisons: [...ALL], jours: [] };
  const range = /^(spring|summer|fall|winter) to (spring|summer|fall|winter)$/.exec(s);
  if (range) {
    const a = ALL.indexOf(range[1] as Season);
    const b = ALL.indexOf(range[2] as Season);
    const out: Season[] = [];
    for (let i = a; ; i = (i + 1) % 4) {
      out.push(ALL[i]);
      if (i === b) break;
    }
    return { saisons: ALL.filter((x) => out.includes(x)), jours: [] };
  }
  // Uniquement des mots de saison, éventuellement suivis de « 1-14 »
  if (!/^((spring|summer|fall|autumn|winter)(\s+\d+\s*-\s*\d+)?[\s,•&/]*(and\s+)?)+$/.test(s)) return null;
  const jours: DayWindow[] = [...s.matchAll(/(spring|summer|fall|autumn|winter)\s+(\d+)\s*-\s*(\d+)/g)].map((m) => ({ saison: SEAS(m[1]), de: +m[2], a: +m[3] }));
  const saisons = [...new Set([...s.matchAll(SEASON_RE)].map((m) => SEAS(m[1])))];
  return { saisons: ALL.filter((x) => saisons.includes(x)), jours };
}

/** Portée exprimée en météo ? « Sunny, Rain, Windy » / « Any ». */
function weatherScope(scope: string): string[] | null {
  const s = clean(scope).toLowerCase();
  if (s === 'any') return [...WEATHER_ALL];
  return /^((sunny|clear|rain|rainy|storm|stormy|snow|snowy|windy|blizzard)[\s,•&/]*)+$/.test(s) ? weather(s) : null;
}

const norm = (z: string) => clean(z).toLowerCase().replace(/\s+/g, ' ').trim();
const isMine = (z: string) => /\bmines?\b|cavern|lava/i.test(z);

/** La portée « Surface », « Mine(s) », « Deep Forest », « River (Farm)/Lake » s'applique-t-elle à la zone ? */
function scopeMatches(scope: string, zone: string): boolean {
  const z = norm(zone);
  return scope
    .split('/')
    .map(norm)
    .some((k) => {
      if (k === 'surface') return !isMine(zone);
      if (k === 'mine' || k === 'mines') return isMine(zone);
      return z === k || z.startsWith(k + ' ') || z.startsWith(k + '(') || k.startsWith(z);
    });
}

/** Valeur d'un champ portée par zone : portée qui correspond, sinon valeur sans portée, sinon rien. */
function forZone(parts: { scope: string; value: string }[], zone: string): string | undefined {
  const hit = parts.find((p) => p.scope && scopeMatches(p.scope, zone));
  if (hit) return hit.value;
  const free = parts.find((p) => !p.scope);
  return free?.value;
}

/** Fenêtres de jours écrites dans le champ saison : « [[Fall]] 8-21 • [[Winter]] 8-21 ». */
function dayWindows(v: string | undefined): DayWindow[] {
  return [...clean(v).matchAll(/(spring|summer|fall|autumn|winter)\s+(\d+)\s*-\s*(\d+)/gi)].map((m) => ({ saison: SEAS(m[1]), de: +m[2], a: +m[3] }));
}

/** Sépare les lignes « valeur (X only) » d'un champ ; `main` = les lignes sans annotation. */
function onlyLines(raw: string | undefined): { main?: string; only: { names: string; value: string }[] } {
  const only: { names: string; value: string }[] = [];
  const main: string[] = [];
  for (const line of (raw ?? '').split(/<br\s*\/?>/i)) {
    const m = /\(([^)]+?)\s+only\)/i.exec(clean(line));
    if (m) only.push({ names: m[1], value: clean(line).replace(m[0], '').trim() });
    else if (clean(line)) main.push(line);
  }
  return { main: main.length ? main.join('<br />') : undefined, only };
}

export function spawnConditions(P: Record<string, string>): ZoneCond[] {
  const L = scoped(P.location);
  const S = scoped(P.season);
  const T = scoped(P.time);
  const W = scoped(P.weather);

  // 1. Groupes de zones issus du champ « location »
  type Group = { zones: string[]; saisons?: Season[]; jours?: DayWindow[] };
  const groups: Group[] = [];
  for (const { scope, value } of L) {
    const zones = list(value).map((z) => clean(z)).filter(Boolean);
    // « '''Fall 8-21 • Winter 8-21''' Ocean (Lookout) » : la portée n'a pas de deux-points mais reste une portée de saison
    const ss = scope ? seasonScope(scope) : null;
    if (ss) groups.push({ zones, saisons: ss.saisons, jours: ss.jours.length ? ss.jours : undefined });
    else if (!zones.length) continue;
    else groups.push({ zones }); // portée de profondeur (« 10-20m ») ou « Land » : sans effet sur les saisons
  }
  if (!groups.length) groups.push({ zones: [''] }); // lieu absent : conditions sans zone
  const zonesAll = groups.flatMap((g) => g.zones);

  // 2. Météo portée par saison de zones (insectes) : « '''Sunny, Windy:''' [[Beach]] • [[Town]] »
  const weatherByZone = new Map<string, string[]>();
  for (const { scope, value } of W) {
    const ws = scope ? weatherScope(scope) : null;
    if (ws) for (const z of list(value)) weatherByZone.set(norm(z), ws);
  }

  // 3. Une condition par zone
  // Lignes annotées « … <small>(tilling only)</small> » dans les champs saison et heure : la ligne vaut pour
  // les zones citées, les autres lignes pour les autres zones (carabe : « Fall, Winter<br />Any (tilling only) » ;
  // bulot : « Spring • Summer (trash cans only) », la plongée restant ouverte toute l'année).
  const onlyS = onlyLines(P.season);
  const onlyT = onlyLines(P.time);
  const baseSeasons = (z: string) => {
    if (onlyS.only.length) {
      const o = onlyS.only.find((x) => scopeMatches(x.names, z));
      const v = o ? o.value : onlyS.main;
      return v && seasons(v).length ? seasons(v) : [...ALL];
    }
    const v = forZone(S, z);
    return v === undefined ? [...ALL] : seasons(v).length ? seasons(v) : [...ALL];
  };
  const out: ZoneCond[] = [];
  for (const g of groups) {
    for (const z of g.zones) {
      // Saisons : portée du champ « location » si elle existe (le champ « season » n'en est alors qu'un résumé),
      // sinon champ « season » (éventuellement porté Surface/Mine), sinon toute l'année.
      const sv = forZone(S, z);
      let saisons = g.saisons ?? baseSeasons(z);
      // Colonnes par saison « ✓ (Mine only) » / « ✓ (Savannah/Deep Forest only) » : précisent les zones
      // quand les saisons viennent du champ « season » (pas d'une portée du champ « location »).
      if (!g.saisons)
        for (const s of ALL) {
          const f = clean(P[s]);
          const only = /✓\s*\(([^)]*(?:\([^)]*\))?[^)]*)\s+only\)/i.exec(f)?.[1];
          if (!only || /\d/.test(only)) continue;
          const names = only.split(/\s*\/\s*|,\s*(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
          const match = names.some((n) => scopeMatches(n, z));
          if (match && !saisons.includes(s)) saisons = ALL.filter((x) => saisons.includes(x) || x === s);
          if (!match && saisons.includes(s)) saisons = saisons.filter((x) => x !== s);
        }
      const jours = g.saisons ? g.jours ?? [] : sv ? dayWindows(sv) : [];
      const ot = onlyT.only.find((x) => scopeMatches(x.names, z));
      const tv = ot ? ot.value : onlyT.only.length ? onlyT.main : forZone(T, z);
      const ws = weatherByZone.get(norm(z));
      const wv = ws ? null : W.some((p) => p.scope && weatherScope(p.scope)) ? undefined : forZone(W, z);
      out.push({
        zone: z || null,
        saisons,
        horaires: tv ? times(tv) : [],
        meteo: ws ?? (wv ? weather(wv) : []),
        ...(jours.length ? { jours } : {}),
      });
    }
  }
  // Même zone citée sous plusieurs saisons (« Spring 15-28 / Summer 15-28 ») : fusion
  const byZone = new Map<string, ZoneCond>();
  for (const c of out) {
    const k = JSON.stringify([c.zone, c.horaires, c.meteo]);
    const m = byZone.get(k);
    if (!m) byZone.set(k, { ...c });
    else {
      m.saisons = ALL.filter((x) => m.saisons.includes(x) || c.saisons.includes(x));
      if (m.jours || c.jours) m.jours = [...(m.jours ?? []), ...(c.jours ?? [])];
    }
  }
  out.length = 0;
  out.push(...byZone.values());

  // Zones aux conditions identiques regroupées (« Pond, Lake »)
  const merged = new Map<string, ZoneCond>();
  for (const c of out) {
    const k = JSON.stringify([c.saisons, c.horaires, c.meteo, c.jours ?? []]);
    const m = merged.get(k);
    if (m) m.zones = [...(m.zones ?? []), ...(c.zone ? [c.zone] : [])];
    else merged.set(k, { ...c, zones: c.zone ? [c.zone] : [] });
  }
  const res = [...merged.values()];
  for (const c of res) c.zone = c.zones?.length ? c.zones.join(', ') : null;
  if (res.length === 1 && !res[0].jours && !L.some((p) => p.scope && seasonScope(p.scope))) {
    res[0].zone = null;
    delete res[0].zones;
  }
  return res;
}
