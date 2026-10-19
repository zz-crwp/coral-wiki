// Progression v2 : une marque par clé de suivi, avec son état, son horodatage et son auteur.
// Module pur (aucune dépendance au navigateur) : fusion et migration sont testées en Node
// (scripts/qa/progress-merge.test.ts, scripts/qa/migration.test.ts).

/** État d'une clé : s = 1 coché, 0 décoché (la suppression est une marque datée), t = ms UTC, par = joueur. */
export type Mark = { s: 0 | 1; t: number; par: string };
export type Progress = Record<string, Mark>;

/** Clés communes aux deux joueurs (musée, temple, journal, recettes) ; les autres restent personnelles. */
export const SHARED = ['musee:', 'temple:', 'pris:', 'cuisine:'];
export const isShared = (key: string) => SHARED.some((p) => key.startsWith(p));

/** La marque qui l'emporte : la plus récente ; à égalité, ordre stable (auteur, puis état) pour un résultat déterministe. */
export function winner(a: Mark | undefined, b: Mark | undefined): Mark | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.t !== b.t) return a.t > b.t ? a : b;
  if (a.par !== b.par) return a.par > b.par ? a : b;
  return a.s >= b.s ? a : b;
}

/** Fusion clé par clé : commutative, associative et idempotente (même résultat quel que soit l'ordre d'arrivée). */
export function merge(...all: (Progress | undefined)[]): Progress {
  const out: Progress = {};
  for (const p of all) {
    if (!p) continue;
    for (const k in p) {
      const m = sane(p[k]);
      if (m) out[k] = winner(out[k], m)!;
    }
  }
  return out;
}

/** Vue effective d'un joueur : ses marques, plus celles du partenaire pour les clés communes. */
export function effective(mine: Progress, partner?: Progress): Progress {
  if (!partner) return mine;
  const shared: Progress = {};
  for (const k in partner) if (isShared(k)) shared[k] = partner[k];
  return merge(mine, shared);
}

/** Clés cochées → horodatage de la coche (forme attendue par l'interface). */
export function onKeys(p: Progress): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k in p) if (p[k].s === 1) out[k] = p[k].t;
  return out;
}

/** Nouvelle marque locale. `now` est forcé strictement croissant pour qu'une annulation gagne toujours. */
export function mark(prev: Mark | undefined, on: boolean, par: string, now = Date.now()): Mark {
  return { s: on ? 1 : 0, t: Math.max(now, (prev?.t ?? 0) + 1), par };
}

/** v1 → v2 : `checks: { clé: horodatage }` devient une marque cochée par le joueur local. Aucune clé perdue. */
export function migrateChecks(checks: Record<string, unknown> | undefined, par: string, fallbackT: number): Progress {
  const out: Progress = {};
  for (const [k, v] of Object.entries(checks ?? {})) {
    if (!v) continue;
    const t = typeof v === 'number' && v > 0 ? v : fallbackT;
    out[k] = { s: 1, t, par };
  }
  return out;
}

function sane(m: unknown): Mark | null {
  const x = m as Mark;
  if (!x || (x.s !== 0 && x.s !== 1) || typeof x.t !== 'number' || !isFinite(x.t) || typeof x.par !== 'string') return null;
  return { s: x.s, t: x.t, par: x.par };
}

/** Dernières marques (fil « Récemment »), toutes origines confondues. */
export function recent(p: Progress, n = 15): { key: string; m: Mark }[] {
  return Object.entries(p)
    .map(([key, m]) => ({ key, m }))
    .sort((a, b) => b.m.t - a.m.t || (a.key < b.key ? -1 : 1))
    .slice(0, n);
}

/** Profil lu (v1 ou v2, base ou fichier) → forme v2 complète, sans perdre de coche. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProfile(p: any, par: string): any {
  // Profil v2 : ses marques font foi (le champ `checks` d'un export v2 n'est qu'une copie pour la v1)
  const prog = p.prog && typeof p.prog === 'object' ? merge(p.prog) : migrateChecks(p.checks, par, p.updated || p.created || Date.now());
  const { checks: _v1, ...rest } = p;
  return { favs: [], session: [...(p.favs ?? [])], paliers: {}, coeurs: {}, weather: 'sunny', hour: 9, ...rest, prog };
}
