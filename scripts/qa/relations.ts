// Audit des relations entre fiches (données seules, sans navigateur) :
// 1. chaque identifiant cité par une fiche existe ; 2. les relations à double sens sont présentes des deux côtés.
// Usage : node scripts/qa/relations.ts [--list]  (code de sortie 1 s'il reste des liens cassés)
import { readdirSync, readFileSync } from 'node:fs';

type X = Record<string, any>;
const DIR = new URL('../../src/data/', import.meta.url);
const all = new Map<string, X>();
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const j = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  if (!Array.isArray(j) || !j[0]?.id || !j[0]?.extra) continue;
  for (const e of j) all.set(e.id, { ...e, dom: f.replace('.json', '') });
}

const list = process.argv.includes('--list');
const broken = new Map<string, string[]>(); // champ → « fiche → id »
const oneWay = new Map<string, string[]>();
const add = (m: Map<string, string[]>, k: string, v: string) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);

/** Tous les identifiants cités par une fiche, avec le champ d'origine. */
function refs(e: X): [string, string][] {
  const x = e.extra ?? {};
  const out: [string, string][] = [];
  const push = (field: string, v: unknown) => typeof v === 'string' && v && out.push([field, v]);
  for (const id of e.utilise_dans ?? []) push('utilise_dans', id);
  for (const [lvl, ids] of Object.entries<string[]>(e.aime_par ?? {})) for (const id of ids) push(`aime_par.${lvl}`, id);
  for (const [lvl, ids] of Object.entries<string[]>(x.cadeaux ?? {})) for (const id of ids ?? []) push(`cadeaux.${lvl}`, id);
  for (const r of x.recettes ?? []) {
    for (const g of r.ingredients ?? []) push('recettes.ingredients', g.id);
    if (r.outil && /^[a-z0-9-]+$/.test(r.outil)) push('recettes.outil', r.outil);
  }
  for (const v of x.vendu_par ?? []) push('vendu_par', v.lieu);
  for (const o of x.obtenu_de ?? []) push('obtenu_de', o.source);
  for (const k of ['graine', 'donne', 'machine']) push(k, x[k]);
  for (const k of ['intrants', 'produits', 'produit_par', 'recettes_associees', 'groupes', 'membres']) for (const id of x[k] ?? []) push(k, id);
  for (const r of x.requis_pour ?? []) push('requis_pour', r.id);
  for (const id of x.lieux_id ?? []) push('lieux_id', id);
  for (const c of x.conditions ?? []) for (const id of c.lieux_id ?? []) push('conditions.lieux_id', id);
  for (const b of x.butin ?? []) push('butin', b.item);
  for (const s of x.stock ?? []) push('stock', s.item);
  if (x.debloque_par) push('debloque_par', x.debloque_par.maitrise);
  for (const h of x.evenements_coeur ?? []) push('evenements_coeur.lieu_id', h.lieu_id);
  for (const l of x.lettres ?? []) for (const p of l.pieces_jointes ?? []) push('lettres', p.id);
  for (const n of x.niveaux ?? []) for (const id of n.recettes ?? []) push('niveaux.recettes', id);
  return out;
}

for (const e of all.values()) for (const [field, id] of refs(e)) if (!all.has(id)) add(broken, field, `${e.id} → ${id}`);

// Relations à double sens : [champ de A, test « B pointe-t-il vers A ? »]
const has = (arr: unknown, id: string) => Array.isArray(arr) && arr.some((v) => (typeof v === 'string' ? v : v?.id ?? v?.item ?? v?.lieu ?? v?.source) === id);
for (const a of all.values()) {
  const x = a.extra ?? {};
  for (const b of a.utilise_dans ?? []) {
    const B = all.get(b);
    if (B && b !== a.id && !(B.extra?.intrants ?? []).includes(a.id) && !(B.extra?.recettes ?? []).some((r: X) => has(r.ingredients, a.id))) add(oneWay, 'utilise_dans ↔ recettes', `${a.id} → ${b}`);
  }
  for (const r of x.recettes ?? [])
    for (const g of r.ingredients ?? []) {
      const G = all.get(g.id);
      // Les ingrédients génériques (groupes « n'importe quel poisson ») listent leurs recettes côté groupe
      if (G && G.id !== a.id && G.dom !== 'groupes' && !(G.utilise_dans ?? []).includes(a.id)) add(oneWay, 'recettes ↔ utilise_dans', `${a.id} ← ${g.id}`);
    }
  for (const [lvl, ids] of Object.entries<string[]>(x.cadeaux ?? {}))
    for (const id of ids ?? []) {
      const I = all.get(id);
      if (I && I.dom !== 'groupes' && !(I.aime_par?.[lvl] ?? []).includes(a.id)) add(oneWay, `cadeaux.${lvl} ↔ aime_par`, `${a.id} → ${id}`);
    }
  for (const [lvl, ids] of Object.entries<string[]>(a.aime_par ?? {}))
    for (const id of ids) {
      const P = all.get(id);
      if (P && !(P.extra?.cadeaux?.[lvl] ?? []).includes(a.id)) add(oneWay, `aime_par.${lvl} ↔ cadeaux`, `${a.id} ← ${id}`);
    }
  for (const id of x.produits ?? []) {
    const P = all.get(id);
    if (P && !has(P.extra?.produit_par, a.id) && P.extra?.machine !== a.id) add(oneWay, 'produits ↔ produit_par', `${a.id} → ${id}`);
  }
  for (const v of x.vendu_par ?? []) {
    const L = all.get(v.lieu);
    if (L && Array.isArray(L.extra?.stock) && !has(L.extra.stock, a.id)) add(oneWay, 'vendu_par ↔ stock', `${a.id} ← ${v.lieu}`);
  }
  for (const s of Array.isArray(x.stock) ? x.stock : []) {
    const I = s.item && all.get(s.item);
    if (I && !has(I.extra?.vendu_par, a.id) && !has(I.extra?.ameliorations, a.id)) add(oneWay, 'stock ↔ vendu_par', `${a.id} → ${s.item}`);
  }
  for (const id of x.membres ?? []) {
    const M = all.get(id);
    if (M && !(M.extra?.groupes ?? []).includes(a.id)) add(oneWay, 'membres ↔ groupes', `${a.id} → ${id}`);
  }
  for (const b of x.butin ?? []) {
    const I = b.item && all.get(b.item);
    if (I && !has(I.extra?.obtenu_de, a.id)) add(oneWay, 'butin ↔ obtenu_de', `${a.id} → ${b.item}`);
  }
  if (x.graine) {
    const G = all.get(x.graine);
    if (G && G.extra?.donne !== a.id) add(oneWay, 'graine ↔ donne', `${a.id} → ${x.graine}`);
  }
}

const show = (title: string, m: Map<string, string[]>) => {
  const n = [...m.values()].reduce((s, l) => s + l.length, 0);
  console.log(`\n${title} : ${n}`);
  for (const [k, l] of [...m].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(l.length).padStart(5)}  ${k}${list ? '' : `   ex. ${l.slice(0, 3).join(' ; ')}`}`);
    if (list) for (const v of l) console.log(`         ${v}`);
  }
  return n;
};
console.log(`${all.size} fiches`);
const nb = show('Liens vers une fiche inexistante', broken);
show('Relations à sens unique', oneWay);
if (nb) process.exitCode = 1;
