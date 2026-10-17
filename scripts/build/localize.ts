// Application de la mémoire de traduction (FR non officiel) aux brouillons d'entités.
// Les noms ne sont jamais remplacés : un nom traduit devient un alias (`nom_fr_alias`) de recherche.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { I18N_DIR, TM } from '../i18n/tm.ts';
import type { Ctx, Draft } from './ctx.ts';
import { list } from './norm.ts';

const LINKED = /^(Acheté chez|Produit par|Fabriqué|Cuisiné|Obtenu de|Pousse à partir|Pêche à la canne|Capture|Cueillette)/;

export function localize(ctx: Ctx, tm = new TM()) {
  const stats = { noms_alias: 0, descriptions: 0 };
  for (const d of ctx.drafts.values()) {
    const lot = (x: string) => (d.domain === 'quetes' ? 'quetes' : d.domain === 'maitrises' ? 'maitrises' : x);
    // Nom : alias FR non officiel si pas de nom officiel
    if (!d.nom_fr_source || d.nom_fr_source === 'en') {
      const fr = tm.get(d.nom_en, lot('noms'));
      if (fr && fr.toLowerCase() !== d.nom_en.toLowerCase()) { d.extra._alias_fr = fr; stats.noms_alias++; }
    }
    // Description
    if (!d.description_fr && d.description_en) {
      const fr = tm.get(d.description_en, lot('descriptions'));
      if (fr) { d.description_fr = fr; d.extra._desc_trad = true; stats.descriptions++; }
    }
    d.categorie = tm.t(d.categorie, 'libelles');
    if (d.sous_categorie) d.sous_categorie = tm.t(d.sous_categorie, 'libelles');
    d.lieux = d.lieux.map((l) => tm.t(l, 'libelles'));
    d.obtention = d.obtention.map((o) => (LINKED.test(o) ? localizeTail(o, tm) : tm.t(o, 'libelles')));
    if (d.horaires_texte) d.horaires_texte = tm.t(d.horaires_texte, 'libelles');
    localizeExtra(d, tm);
  }
  return stats;
}

/** « Pêche à la canne — Ocean (Dock, Lookout) » : traduit la liste de lieux après le tiret. */
function localizeTail(o: string, tm: TM) {
  const i = o.indexOf(' — ');
  if (i < 0) return o;
  return o.slice(0, i + 3) + list(o.slice(i + 3)).map((x) => tm.t(x, 'libelles')).join(', ');
}

const EXTRA_LABELS = ['rarete', 'rarete_mine', 'difficulte', 'taille_ombre', 'motif', 'genre', 'situation', 'espece', 'effet', 'effet_negatif', 'duree', 'frequence', 'logement', 'variante', 'duree_construction', 'duree_effet', 'source_recette', 'deblocage', 'ferme_le', 'horaires_ouverture', 'entrees_texte', 'produits_texte', 'type', 'famille_monstre', 'situe', 'adresse'];
const EXTRA_SKILL = ['competence_prix'];
const POUR: Record<string, string> = { Seeds: 'Graines', Seedling: 'Plants', Sapling: 'Jeunes arbres', Hay: 'Foin', Seaweed: 'Algues' };
/** « 2 days » / « 1 Day » / « 6 hours » → français. */
const frDuration = (v: string) =>
  v.replace(/(\d+)\s*days?/gi, (_, n) => `${n} jour${+n > 1 ? 's' : ''}`).replace(/(\d+)\s*hours?/gi, (_, n) => `${n} heure${+n > 1 ? 's' : ''}`).replace(/\binstant(ly)?\b/i, 'immédiat');
const EXTRA_PNJ = ['emploi', 'famille', 'loisirs'];
const GENRE: { emploi: Record<string, string> } = JSON.parse(readFileSync(new URL('../i18n/genre-fr.json', import.meta.url), 'utf8'));

function localizeExtra(d: Draft, tm: TM) {
  const x = d.extra;
  for (const k of EXTRA_LABELS) if (typeof x[k] === 'string' && x[k]) x[k] = tm.t(x[k], 'libelles');
  for (const k of EXTRA_SKILL) if (typeof x[k] === 'string' && x[k]) x[k] = tm.t(x[k], 'maitrises');
  if (d.domain === 'pnj') {
    for (const k of EXTRA_PNJ) if (typeof x[k] === 'string' && x[k]) x[k] = tm.t(x[k], 'pnj');
    // Accord au genre : « Marié(e) » → Marié / Mariée ; libellés partagés corrigés par habitant.
    const g = x.genre;
    if (typeof x.situation === 'string' && (g === 'Homme' || g === 'Femme'))
      x.situation = x.situation.replace(/\(e\)/, g === 'Femme' ? 'e' : '').replace('Veuf/veuve', g === 'Femme' ? 'Veuve' : 'Veuf');
    const over = GENRE.emploi[d.id];
    if (over) x.emploi = over;
  }
  if (d.domain === 'monstres' && typeof x.famille === 'string') x.famille = tm.t(x.famille, 'libelles');
  if (d.domain === 'insectes' || d.domain === 'creatures-marines') if (typeof x.famille === 'string') x.famille = tm.t(x.famille, 'libelles');
  for (const c of x.conditions ?? []) {
    if (c.zones?.length) {
      c.zones = c.zones.map((z: string) => tm.t(z, 'libelles'));
      c.zone = c.zones.join(', ');
    } else if (c.zone) c.zone = tm.t(c.zone, 'libelles');
  }
  for (const o of x.ouverture ?? []) o.jours = tm.t(o.jours, 'libelles');
  for (const r of x.stock ?? []) {
    if (r.rayon) r.rayon = tm.t(r.rayon, 'libelles');
    if (r.duree) r.duree = frDuration(r.duree);
    for (const k of ['description', 'autre', 'mode']) if (typeof r[k] === 'string' && r[k]) r[k] = tm.t(r[k], 'magasins');
    // Les noms d'objets restent en anglais (règle du projet) ; seuls les libellés génériques sont traduits.
    if (!r.item && /^Upgrade\s+[IVX]+$/.test(r.nom ?? '')) r.nom = r.nom.replace('Upgrade', 'Amélioration');
  }
  if (x.ameliorations_qualite)
    for (const n of x.ameliorations_qualite.niveaux)
      for (const c of n.couts) {
        c.pour = POUR[c.pour] ?? tm.t(c.pour, 'magasins');
        if (c.texte) c.texte = tm.t(c.texte, 'magasins');
      }
  for (const e of x.evenements_coeur ?? []) {
    if (e.condition) e.condition = tm.t(e.condition, 'pnj');
    if (e.lieu) e.lieu = tm.t(e.lieu, 'pnj');
    const r = tm.get(e.resume_en, 'coeur');
    if (r) e.resume = r;
  }
  for (const e of x.sorties ?? []) {
    if (e.prerequis) e.prerequis = tm.t(e.prerequis, 'pnj');
    const r = tm.get(e.resume_en, 'sorties');
    if (r) e.resume = r;
  }
  for (const s of x.emploi_du_temps ?? []) {
    s.condition = tm.t(s.condition, 'edt');
    for (const g of s.groupes) {
      g.jours = tm.t(g.jours, 'edt');
      for (const st of g.etapes) st.texte = tm.t(st.texte, 'edt');
    }
  }
  for (const l of x.lettres ?? []) {
    const r = tm.get(l.texte_en, 'lettres');
    if (r) l.texte = r;
  }
  for (const c of x.competences ?? []) {
    c.nom = tm.t(c.nom_en, 'maitrises');
    c.effet = tm.t(c.effet_en, 'maitrises');
  }
  for (const c of x.experience ?? []) c.action = tm.t(c.action, 'maitrises');
  if (Array.isArray(x.activites)) x.activites = x.activites.map((a: string) => tm.t(a, 'libelles'));
  if (d.domain === 'quetes') {
    for (const k of ['objectifs', 'recompenses', 'donneur']) if (x[k]) x[k] = tm.t(x[k], 'quetes');
    d.prerequis = d.prerequis.map((p) => tm.t(p, 'quetes'));
  }
  for (const k of ['mariage_en', 'romance_en']) if (x[k]) { const r = tm.get(x[k], 'pnj'); if (r) x[k.replace('_en', '')] = r; }
}

/** Écrit les textes restant à traduire : scripts/i18n/todo/<lot>.tsv (hash \t EN). */
export function writeTodo(tm: TM) {
  const dir = join(I18N_DIR, 'todo');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const counts: Record<string, number> = {};
  for (const [lot, m] of tm.missing) {
    counts[lot] = m.size;
    writeFileSync(join(dir, `${lot}.tsv`), [...m].map(([k, v]) => `${k}\t${v.replace(/\t|\n/g, ' ')}`).join('\n') + '\n');
  }
  return counts;
}
