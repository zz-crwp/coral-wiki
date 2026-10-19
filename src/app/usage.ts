// « Je le garde ou je le vends ? » : usages d'un objet croisés avec la progression commune.
// Verdict À GARDER si l'objet manque au musée, au temple, ou sert à une quête ; sinon VENDABLE s'il a un prix.
import type { Entry } from './data.ts';

export type Verdict = { keep: boolean; sell: boolean; why: string[] };

export function verdictOf(e: Entry | undefined, checks: Record<string, number>): Verdict | null {
  const u = e?.use;
  if (!e || !u) return null;
  const why: string[] = [];
  if (u.m && !checks[`musee:${e.id}`]) why.push('musée');
  if (u.t?.some((o) => !checks[`temple:${o}:${e.id}`])) why.push('temple');
  if (u.q) why.push(u.q > 1 ? `${u.q} quêtes` : 'quête');
  if (why.length) return { keep: true, sell: false, why };
  return u.p ? { keep: false, sell: true, why: [] } : null;
}
