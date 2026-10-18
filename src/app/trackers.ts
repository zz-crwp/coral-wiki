// Définition des trackers : chaque objet à cocher a une clé stable dans le profil.
//   pris:<id>  musee:<id>  temple:<offrande>:<objet>  cuisine:<id>  coeur:<pnj>:<cœurs>-<n>  succes:<id>
import { loadEntries, entry, loadDomain, type Entry } from './data.ts';

export type TItem = {
  key: string;
  id: string; // entité affichée (image, lien vers la fiche)
  label?: string; // libellé spécifique (sinon nom de l'entité)
  sub?: string;
  group: string;
  sg?: string; // sous-groupe (offrande du temple)
  seasons: number; // masque saisons (0 = toute l'année / non saisonnier)
  lieux: string[];
};
export type Tracker = { id: string; titre: string; icon: string; unite: string; items: TItem[]; groups: string[] };

export const TRACKERS: { id: string; titre: string; icon: string; desc: string }[] = [
  { id: 'temple', titre: 'Temple du lac', icon: 'guides', desc: 'Objets offerts aux autels' },
  { id: 'musee', titre: 'Musée', icon: 'mineraux', desc: 'Dons par collection' },
  { id: 'poissons', titre: 'Poissons pêchés', icon: 'poissons', desc: 'Au moins une prise' },
  { id: 'insectes', titre: 'Insectes attrapés', icon: 'insectes', desc: 'Au moins une capture' },
  { id: 'creatures', titre: 'Créatures marines', icon: 'creatures-marines', desc: 'Au moins une capture' },
  { id: 'cuisine', titre: 'Recettes cuisinées', icon: 'cuisine', desc: 'Plats préparés au moins une fois' },
  { id: 'coeur', titre: 'Événements de cœur', icon: 'pnj', desc: 'Scènes vues, par habitant' },
  { id: 'succes', titre: 'Succès', icon: 'succes', desc: 'Succès Steam / PlayStation' },
];

const COLL_FR: Record<string, string> = { poissons: 'Poissons', insectes: 'Insectes', 'creatures-marines': 'Créatures marines', artefacts: 'Artefacts', fossiles: 'Fossiles', gemmes: 'Gemmes' };
const QUAL = ['', 'Bronze', 'Argent', 'Or', 'Osmium'];

type Suivi = { coeur: { id: string; ev: { c: number | null; r: string; l: string; k: string }[] }[]; lieux: Record<string, string[]> };
let suiviP: Promise<Suivi> | null = null;
export const loadSuivi = () => (suiviP ??= import('../data/suivi.json').then((m) => (m.default ?? m) as unknown as Suivi));
const special = import.meta.glob<{ default: any }>('../data/{temple,musee}.json');
export const loadTemple = () => special['../data/temple.json']().then((m) => m.default);
export const loadMusee = () => special['../data/musee.json']().then((m) => m.default);

const cache = new Map<string, Promise<Tracker>>();
export function loadTracker(id: string): Promise<Tracker> {
  let p = cache.get(id);
  if (!p) cache.set(id, (p = build(id)));
  return p;
}

const byName = (a: TItem, b: TItem) => name(a).localeCompare(name(b), 'fr');
export const name = (it: TItem) => it.label ?? entry(it.id)?.fr ?? it.id;

async function build(id: string): Promise<Tracker> {
  const [entries, suivi] = await Promise.all([loadEntries(), loadSuivi()]);
  const def = TRACKERS.find((t) => t.id === id)!;
  const L = (eid: string) => suivi.lieux[eid] ?? [];
  const S = (eid: string) => entry(eid)?.seasons ?? 0;
  const simple = (prefix: string, list: Entry[], group: (e: Entry) => string): TItem[] =>
    list.map((e) => ({ key: `${prefix}:${e.id}`, id: e.id, group: group(e), seasons: e.seasons, lieux: L(e.id) })).sort(byName);
  let items: TItem[] = [];
  let unite = 'objets';

  if (id === 'temple') {
    const t = (await special['../data/temple.json']()).default;
    unite = 'objets';
    for (const a of t.autels)
      for (const o of a.offrandes)
        for (const it of o.objets)
          items.push({
            key: `temple:${o.id}:${it.id}`,
            id: it.id,
            sub: `×${it.n}${it.qualite ? ` · qualité ${QUAL[it.qualite]} ou mieux` : ''}`,
            group: a.nom_fr,
            sg: o.nom ?? o.nom_en,
            seasons: S(it.id),
            lieux: L(it.id),
          });
  } else if (id === 'musee') {
    const m = (await special['../data/musee.json']()).default;
    unite = 'dons';
    for (const c of m.collections) for (const oid of c.objets as string[]) items.push({ key: `musee:${oid}`, id: oid, group: COLL_FR[c.id] ?? c.id, seasons: S(oid), lieux: L(oid) });
    items.sort((a, b) => a.group.localeCompare(b.group) || byName(a, b));
  } else if (id === 'poissons' || id === 'insectes' || id === 'creatures') {
    const dom = id === 'creatures' ? 'creatures-marines' : id;
    unite = 'espèces';
    items = simple('pris', entries.filter((e) => e.dom === dom), (e) => e.cat);
  } else if (id === 'cuisine') {
    unite = 'recettes';
    items = simple('cuisine', entries.filter((e) => e.dom === 'cuisine' && e.cat !== 'Ustensile'), () => 'Plats');
  } else if (id === 'coeur') {
    unite = 'scènes';
    for (const n of suivi.coeur) {
      const keys = heartKeys(n.id, n.ev.map((v) => v.c));
      for (const [i, v] of n.ev.entries()) {
        items.push({
          key: keys[i],
          id: n.id,
          label: [v.c ? `${v.c} cœur${v.c > 1 ? 's' : ''}` : 'Scène', v.l, v.k && v.k !== 'Tous' ? v.k : ''].filter(Boolean).join(' · '),
          sub: v.r,
          group: entry(n.id)?.fr ?? n.id,
          seasons: 0,
          lieux: v.l ? [v.l] : [],
        });
      }
    }
    items.sort((a, b) => a.group.localeCompare(b.group, 'fr'));
  } else if (id === 'succes') {
    unite = 'succès';
    const d = await loadDomain('succes');
    items = entries
      .filter((e) => e.dom === 'succes')
      .map((e) => ({ key: `succes:${e.id}`, id: e.id, sub: d.get(e.id)?.description ?? '', group: d.get(e.id)?.sous_categorie ?? 'Autres', seasons: 0, lieux: [] }))
      .sort(byName);
  }
  const groups = [...new Set(items.map((i) => i.group))];
  return { id, titre: def.titre, icon: def.icon, unite, items, groups };
}

export function progress(items: TItem[], checks: Record<string, number>) {
  let n = 0;
  for (const it of items) if (checks[it.key]) n++;
  return { done: n, total: items.length, pct: items.length ? Math.round((n * 100) / items.length) : 0 };
}

/** Saison courante → bit du masque (printemps 1, été 2, automne 4, hiver 8). */
export const seasonBit = (s: string) => ({ spring: 1, summer: 2, fall: 4, winter: 8 })[s] ?? 0;
/** Objet obtenable pendant la saison : saisons inconnues/non saisonnier comptent comme « toute l'année ». */
export const inSeason = (it: TItem, bit: number) => !it.seasons || !!(it.seasons & bit);

/** Clés des événements de cœur : niveau + rang parmi les scènes du même niveau (stable si l'ordre du wiki l'est). */
export function heartKeys(npc: string, levels: (number | null | undefined)[]): string[] {
  const seen = new Map<number, number>();
  return levels.map((l) => {
    const c = l ?? 0;
    const k = (seen.get(c) ?? 0) + 1;
    seen.set(c, k);
    return `coeur:${npc}:${c}-${k}`;
  });
}

/** Cases de suivi proposées sur la fiche d'une entité. */
export function entityChecks(e: { id: string; categorie: string; extra: Record<string, any> }, dom: string): { key: string; label: string; href: string }[] {
  const out: { key: string; label: string; href: string }[] = [];
  const x = e.extra;
  if (['poissons', 'insectes', 'creatures-marines'].includes(dom))
    out.push({ key: `pris:${e.id}`, label: dom === 'poissons' ? 'Pêché au moins une fois' : 'Attrapé au moins une fois', href: `#/progression/${dom === 'creatures-marines' ? 'creatures' : dom}` });
  if (x.don_musee) out.push({ key: `musee:${e.id}`, label: 'Donné au musée', href: '#/progression/musee' });
  for (const o of x.offrandes ?? []) out.push({ key: `temple:${o.offrande}:${e.id}`, label: `Offert au temple · ${o.nom ?? o.offrande} (×${o.n})`, href: '#/progression/temple' });
  if (dom === 'cuisine' && e.categorie !== 'Ustensile') out.push({ key: `cuisine:${e.id}`, label: 'Cuisiné au moins une fois', href: '#/progression/cuisine' });
  if (dom === 'succes') out.push({ key: `succes:${e.id}`, label: 'Succès obtenu', href: '#/progression/succes' });
  return out;
}
