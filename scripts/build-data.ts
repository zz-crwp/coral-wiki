// Phase 1.2–1.6 — Normalisation : cache brut → /src/data/*.json validés (zod).
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Entity, IndexEntry, Meta } from '../src/data/schema.ts';
import { loadJson, loadNs, Resolver, slug } from './lib/load.ts';
import { ArticleRenderer, type Block } from './build/article.ts';
import { classify, DOMAIN_LABELS, type Domain } from './build/classify.ts';
import { Ctx, type Draft } from './build/ctx.ts';
import { fillFromInfobox, newDraft } from './build/entities.ts';
import { crossCheck, matchFr } from './build/fr.ts';
import { schedule, subpages } from './build/npc.ts';
import { drops, gifts, groups, linksFromText, production, recipes, shops } from './build/relations.ts';
import { achievements, masteries, mines, museum, quests, temple, townRank } from './build/special.ts';
import { MAP_ICONS, UI_ICONS } from './build/icons.ts';
import { coverage } from './coverage.ts';
import { crossCheckGuide } from './build/steam-guide.ts';
import { crossCheckWiki2 } from './build/wiki2.ts';
import { speciesByPlace, upgradeLinks } from './build/context.ts';
import { mapData } from './build/map.ts';
import { localize, writeTodo } from './build/localize.ts';
import { TM } from './i18n/tm.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'src', 'data');
const t0 = Date.now();

// ---------- 1. Chargement ----------
const pages = loadNs(0);
const templatesNs = loadNs(828);
const redirects = loadJson<Record<string, string>>('redirects.json', {});
const images = loadJson<Record<string, any>>('images.json', {});
// Inventaire complet des fichiers du wiki : icônes de carte et d'interface
for (const im of loadJson<{ name: string; url: string; width: number; height: number }[]>('allimages.json', [])) {
  const k = im.name.replace(/_/g, ' ');
  images[k] ??= { url: im.url, width: im.width, height: im.height };
}
const fetchedAt = loadJson<{ at: string }>('fetched-at.json', { at: new Date().toISOString() }).at;
const giftCharacters = [...(templatesNs.get('Module:Gifted item/data')?.content ?? '').matchAll(/^\s*'([^']+)',/gm)].map((m) => m[1]);
console.log(`pages: ${pages.size}, images: ${Object.keys(images).length}, personnages cadeaux: ${giftCharacters.length}`);

const resolver = new Resolver(redirects);
const ctx = new Ctx(pages, resolver, images);

// ---------- 2. Classification + ids ----------
const excluded: { title: string; reason: string }[] = [];
const classified: { page: (typeof pages extends Map<any, infer P> ? P : never); domain: Domain; categorie: string; infobox: any }[] = [];
const usedIds = new Set<string>();
for (const p of pages.values()) {
  const c = classify(p);
  if ('excluded' in c) { excluded.push({ title: p.title, reason: c.excluded }); continue; }
  classified.push({ page: p, ...c });
}
for (const c of classified) {
  let id = slug(c.page.title);
  if (usedIds.has(id)) id = `${id}-${c.domain}`;
  usedIds.add(id);
  resolver.add(c.page.title, id);
  const d = newDraft(ctx, id, c.domain, c.categorie, c.page, c.infobox);
  ctx.drafts.set(id, d);
}
// Noms d'infobox génériques partagés par plusieurs pages (« Fossil node ») → titre de la page
const nameCount = new Map<string, number>();
for (const d of ctx.drafts.values()) nameCount.set(d.nom_en.toLowerCase(), (nameCount.get(d.nom_en.toLowerCase()) ?? 0) + 1);
for (const d of ctx.drafts.values()) if ((nameCount.get(d.nom_en.toLowerCase()) ?? 0) > 1 && d.page.title.toLowerCase() !== d.nom_en.toLowerCase()) d.nom_en = d.page.title.replace(/\s*\((item|character)\)$/i, '');
// Alias : noms d'infobox (title/name) et titres sans désambiguïsation
for (const d of ctx.drafts.values()) {
  resolver.alias(d.nom_en, d.id);
  resolver.alias(d.page.title.replace(/\s*\(.*\)$/, ''), d.id);
}

// ---------- 2b. Compléments sourcés hors Fandom ----------
const supplements: any[] = JSON.parse(readFileSync(join(ROOT, 'scripts', 'supplements', 'entities.json'), 'utf8')).entites;

// ---------- 3. Champs d'infobox ----------
for (const d of ctx.drafts.values()) fillFromInfobox(ctx, d);
for (const s of supplements) {
  const page = { pageid: 0, ns: 0, title: s.nom_en, revid: 0, timestamp: '', content: '', categories: [], pageimage: null, original: null, categoryinfo: null };
  const d = newDraft(ctx, s.id, s.domain, s.categorie, page as any, null);
  Object.assign(d, { nom_en: s.nom_en, description_en: s.description_en, description_fr: s.description_fr, saisons: s.saisons ?? [], lieux: s.lieux ?? [], sources: s.sources });
  Object.assign(d.extra, s.extra ?? {});
  if (s.nom_fr_alias) d.extra._alias_fr = s.nom_fr_alias;
  d.extra._desc_trad = true;
  for (const k of s.a_verifier ?? []) d.a_verifier.add(k);
  ctx.drafts.set(d.id, d);
  resolver.add(s.nom_en, d.id);
}

// ---------- 4. Relations ----------
for (const d of ctx.drafts.values()) {
  recipes(ctx, d);
  gifts(ctx, d, giftCharacters);
  if (d.domain === 'lieux' || d.domain === 'festivals' || d.domain === 'pnj') shops(ctx, d);
  drops(ctx, d);
  production(ctx, d);
  groups(ctx, d);
  linksFromText(ctx, d);
  if (d.domain === 'pnj') { schedule(ctx, d); subpages(ctx, d); }
}
// Fruits d'arbres fruitiers : la culture dont la graine est un jeune arbre bascule dans « arbres »
for (const d of ctx.drafts.values()) {
  const seed = d.extra.graine ? ctx.drafts.get(d.extra.graine) : null;
  if (d.domain === 'cultures' && seed?.categorie === 'Jeune arbre') { d.domain = 'arbres'; d.categorie = 'Fruit d’arbre fruitier'; seed.domain = 'arbres'; }
  if (d.domain === 'cultures' && seed?.categorie === 'Plant') d.categorie = `${d.categorie} (plante fruitière)`;
}

// ---------- 5. Domaines dérivés ----------
const templeData = temple(ctx);
const museumData = museum(ctx);
const rankData = townRank(ctx);
const minesData = mines(ctx);
for (const d of [...quests(ctx), ...masteries(ctx), ...achievements(ctx)]) {
  if (ctx.drafts.has(d.id)) d.id = `${d.id}-2`;
  ctx.drafts.set(d.id, d);
  resolver.alias(d.nom_en, d.id);
}

// ---------- 6. Noms FR ----------
const fr = matchFr(ctx);
const xcheck = crossCheck(ctx, fr.matches);
const guideCheck = crossCheckGuide(ctx);
console.log('guide Steam :', guideCheck);
const wiki2 = crossCheckWiki2(ctx);
if (wiki2) console.log(`coralisland.wiki : ${wiki2.compares} valeurs comparées, ${wiki2.concordants} concordantes, ${wiki2.divergents} écarts, ${wiki2.completes} complétées`);
for (const m of fr.matches.values()) {
  const d = ctx.drafts.get(m.id)!;
  d.nom_fr = m.fr;
  d.nom_fr_source = 'wiki-fr';
  if (m.description) d.description_fr = m.description;
  d.extra.nom_fr_methode = m.how;
}

// ---------- 6a. Stades de pousse illustrés (fichiers « <Culture>_stage_N.png » du wiki) ----------
{
  const stages = new Map<string, { n: string; url: string }[]>();
  for (const im of loadJson<{ name: string; url: string }[]>('allimages.json', [])) {
    const m = /^(.+)_stage_(\d+|R)\.png$/i.exec(im.name);
    if (!m) continue;
    const k = m[1].replace(/_/g, ' ').toLowerCase();
    (stages.get(k) ?? stages.set(k, []).get(k)!).push({ n: m[2].toUpperCase(), url: im.url.replace('https://static.wikia.nocookie.net/coralisland/images/', '').replace(/\/revision\/.*$/, '') });
  }
  for (const d of ctx.drafts.values()) {
    if (!['cultures', 'arbres'].includes(String(d.domain))) continue;
    const st = stages.get(d.nom_en.toLowerCase());
    if (st) d.extra.stades = st.sort((a, b) => (a.n === 'R' ? 99 : +a.n) - (b.n === 'R' ? 99 : +b.n));
  }
}

// ---------- 6b. Groupes sans image : image du premier membre ----------
for (const d of ctx.drafts.values()) {
  if (d.domain !== 'groupes' || d.image) continue;
  // Membres déclarés, sinon premier objet lié depuis la page du groupe
  const ids = [...(d.extra.membres ?? []), ...d.liens];
  const ok = (x: any) => x?.image && !['guides', 'lieux', 'pnj', 'groupes', 'quetes'].includes(x.domain);
  const cands = ids.map((id) => ctx.drafts.get(id)).filter(ok);
  const m = cands.find((x) => x!.liens.has(d.id)) ?? cands[0]; // un membre renvoie vers son groupe
  if (m) {
    d.image = m.image;
    d.extra.image_de = m.id;
  }
}

// ---------- 6c. Espèces trouvables par lieu ----------
speciesByPlace(ctx);
const carte = mapData(ctx); // repères sur la carte de l'île / de la plongée

// ---------- 7. Obtention dérivée + contrôles ----------
const lbl = (id: string) => { const x = ctx.drafts.get(id); return x ? `[[${id}|${x.nom_fr ?? x.nom_en}]]` : id; };
for (const d of ctx.drafts.values()) {
  // Auto-références (« Pine cone » redirige vers « Pine tree ») : sans intérêt sur la fiche.
  if (d.extra.graine === d.id) delete d.extra.graine;
  if (d.extra.donne === d.id) delete d.extra.donne;
  const plain = d.obtention;
  const o: string[] = [];
  // Lignes d'amélioration (coût en matériaux) : une seule mention, le détail est dans « Améliorations »
  const upShops = new Set<string>();
  for (const v of d.extra.vendu_par ?? []) {
    if (v.materiaux) upShops.add(v.lieu);
    else o.push(`Acheté chez ${lbl(v.lieu)}${v.prix != null ? ` (${v.prix} ${v.devise})` : ''}`);
  }
  for (const l of upShops) o.push(`Amélioré ou construit chez ${lbl(l)} (voir Améliorations)`);
  if (d.extra.machine) o.push(`Produit par ${lbl(d.extra.machine)}${d.extra.intrants?.length ? ` à partir de ${d.extra.intrants.map(lbl).join(', ')}` : ''}`);
  const rec = (d.extra.recettes ?? []) as { outil?: string }[];
  if (rec.length && d.domain !== 'pnj') {
    if (rec.every((r) => r.outil === 'slime-of-replication')) o.push(`Dupliqué avec ${lbl('slime-of-replication')}`);
    else if (!(d.extra.machine && rec.every((r) => r.outil === d.extra.machine))) o.push(d.domain === 'cuisine' ? 'Cuisiné (voir recette)' : 'Fabriqué (voir recette)');
  }
  for (const s of d.extra.obtenu_de ?? []) o.push(`Obtenu de ${lbl(s.source)}${s.chance ? ` (${s.chance})` : ''}`);
  for (const a of d.extra.produit_par ?? []) o.push(`Produit par ${lbl(a)}`);
  if (d.extra.graine) o.push(`Pousse à partir de ${lbl(d.extra.graine)}`);
  const where = d.lieux.length ? ` — ${d.lieux.slice(0, 6).join(', ')}` : '';
  if (d.domain === 'poissons') o.push(`Pêche à la canne${where}`);
  if (d.domain === 'insectes') o.push(`Capture au filet à insectes${where}`);
  if (d.domain === 'creatures-marines') o.push(`Capture au filet en plongée${where}`);
  if (d.domain === 'cueillette' && !o.length) o.push(`Cueillette${where}`);
  // Lieux sans photo : portrait du propriétaire / résident (signalé comme tel)
  if (!d.image && d.domain === 'lieux') {
    for (const l of d.liens) { const n = ctx.drafts.get(l); if (n?.domain === 'pnj' && n.image && d.extra.proprietaire?.includes(n.nom_en)) { d.image = n.image; d.extra.image_de = l; break; } }
  }
  // Sources brutes de l'infobox (« Coffer », « Mason jar », « Kitchen »…) déjà couvertes par une ligne liée : retirées.
  const linked = new Set([...o.join(' ').matchAll(/\[\[([a-z0-9-]+)\|/g)].map((m) => m[1]));
  const kept = plain.filter((t) => {
    if (/^kitchen$/i.test(t.trim()) && d.extra.recettes?.length) return false;
    const id = t.includes('[[') ? null : ctx.ref(t, false);
    return !(id && linked.has(id));
  });
  d.obtention = [...new Set([...kept, ...o])];
  // Pas de photo du lieu : icône de la carte du jeu (signalée comme telle)
  if (!d.image && MAP_ICONS[d.id]) {
    d.image = ctx.image(MAP_ICONS[d.id]);
    if (d.image) d.extra.image_de = 'icone-carte';
  }
  if (!d.image && !['guides', 'quetes'].includes(d.domain)) d.a_verifier.add('image');
  const needsObtain = !['pnj', 'lieux', 'festivals', 'guides', 'quetes', 'maitrises', 'succes', 'groupes', 'monstres'].includes(d.domain);
  if (needsObtain && !d.obtention.length) d.a_verifier.add('obtention');
  if (!d.description_en && !d.description_fr) d.a_verifier.add('description');
}

// ---------- 7b. Traductions FR non officielles ----------
const tm = new TM();
const loc = localize(ctx, tm);
// Données spéciales (temple, musée, rang, mines)
if (templeData) for (const a of templeData.autels) {
  a.effet = tm.get(a.effet_en, 'special') ?? a.effet_en;
  for (const o of a.offrandes) o.nom = tm.get(o.nom_en, 'special') ?? o.nom_en;
}
if (templeData) {
  const names = new Map<string, { nom: string; autel: string }>();
  for (const a of templeData.autels) for (const o of a.offrandes) names.set(o.id, { nom: o.nom, autel: a.nom_fr });
  for (const d of ctx.drafts.values()) for (const o of d.extra.offrandes ?? []) { o.nom = names.get(o.offrande)?.nom; o.autel_nom = names.get(o.offrande)?.autel; }
}
if (templeData) for (const t of templeData.paliers) t.recompenses = t.recompenses.map((r: string) => tm.t(r, 'special'));
if (museumData) for (const m of museumData.paliers_dons) if (m.autre) m.autre = tm.t(m.autre, 'special');
if (rankData) for (const r of rankData.rangs) { r.deblocages = tm.t(r.deblocages, 'special'); r.autres = tm.t(r.autres, 'special'); }
if (minesData) for (const m of minesData.mines) for (const r of m.recompenses) { r.condition = tm.t(r.condition, 'special'); if (r.autre) r.autre = tm.t(r.autre, 'special'); }
upgradeLinks(ctx);
const todo = writeTodo(tm);
console.log('traductions :', loc, 'à traduire :', todo);

// ---------- 8. Articles (contenu complet des pages) ----------
const renderer = new ArticleRenderer(ctx);
const articles = new Map<string, Record<string, Block[]>>();
for (const d of ctx.drafts.values()) {
  if (!d.page.content || d.domain === 'quetes') continue;
  const blocks = renderer.render(d.page.content);
  if (!blocks.length) continue;
  const dom = String(d.domain);
  (articles.get(dom) ?? articles.set(dom, {}).get(dom)!)[d.id] = blocks;
}
// Liens d'articles → ids vérifiés
const allIds = new Set(ctx.drafts.keys());

// ---------- 9. Finalisation + validation ----------
const final = new Map<string, z.infer<typeof Entity>[]>();
const errors: string[] = [];
for (const d of ctx.drafts.values()) {
  const confirmed = (d.extra._confirme ?? []).length > 0 || d.sources.some((s) => /Steam/.test(s.name));
  const weak = !!d.extra.statut_wiki || d.a_verifier.size >= 2 || (d.extra.ebauche && d.a_verifier.size >= 1);
  delete d.extra._confirme;
  const aliasFr = d.extra._alias_fr;
  delete d.extra._alias_fr;
  const descTrad = d.extra._desc_trad;
  delete d.extra._desc_trad;
  const e = {
    id: d.id,
    nom_fr: d.nom_fr ?? d.nom_en,
    nom_en: d.nom_en,
    nom_fr_source: d.nom_fr_source ?? 'en',
    ...(aliasFr ? { nom_fr_alias: aliasFr } : {}),
    categorie: d.categorie,
    ...(d.sous_categorie ? { sous_categorie: d.sous_categorie } : {}),
    image: d.image,
    description: d.description_fr ?? d.description_en,
    description_en: d.description_en,
    description_lang: d.description_fr ? (descTrad ? 'fr-trad' : 'fr') : 'en',
    obtention: d.obtention,
    lieux: d.lieux,
    saisons: d.saisons,
    meteo: d.meteo,
    horaires: d.horaires,
    ...(d.horaires_texte ? { horaires_texte: d.horaires_texte } : {}),
    prix: d.prix,
    prerequis: d.prerequis,
    utilise_dans: [...d.utilise_dans].filter((x) => allIds.has(x)).sort(),
    aime_par: Object.fromEntries(Object.entries(d.aime_par).map(([k, v]) => [k, [...v].filter((x) => allIds.has(x)).sort()])),
    extra: JSON.parse(JSON.stringify(d.extra)),
    liens: [...d.liens].filter((x) => allIds.has(x) && x !== d.id).sort(),
    sources: d.sources,
    confiance: weak ? 'basse' : confirmed && !d.extra.ebauche && !d.a_verifier.size ? 'haute' : 'moyenne',
    a_verifier: [...d.a_verifier],
  };
  const r = Entity.safeParse(e);
  if (!r.success) { errors.push(`${d.id}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`); continue; }
  const dom = String(d.domain);
  (final.get(dom) ?? final.set(dom, []).get(dom)!).push(r.data);
}
if (errors.length) {
  console.error(`${errors.length} entités invalides :\n${errors.slice(0, 30).join('\n')}`);
  process.exitCode = 1;
}

// Références cassées (extra.* et liens d'articles)
const broken: string[] = [];
const walk = (o: any, path: string) => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && /^(item|id|lieu|source|machine|graine|donne|autel|offrande|maitrise|lieu_id|outil)$/.test(k) && /^[a-z0-9-]+$/.test(v) && !allIds.has(v) && !/^(autel|offrande)-/.test(v)) broken.push(`${path}.${k}=${v}`);
    else if (Array.isArray(v) && /^(intrants|produits|recettes_associees|membres|groupes|produit_par|recettes|objets)$/.test(k)) v.forEach((x, i) => typeof x === 'string' && !allIds.has(x) ? broken.push(`${path}.${k}[${i}]=${x}`) : walk(x, `${path}.${k}[${i}]`));
    else walk(v, `${path}.${k}`);
  }
};
for (const list of final.values()) for (const e of list) walk(e.extra, e.id);
for (const [dom, arts] of articles) for (const [id, blocks] of Object.entries(arts)) for (const m of JSON.stringify(blocks).matchAll(/\[\[([a-z0-9-]+)\|/g)) if (!allIds.has(m[1])) broken.push(`article:${dom}/${id}→${m[1]}`);

// ---------- 10. Écriture ----------
for (const f of readdirSync(OUT)) if (f.endsWith('.json') || f === 'articles') rmSync(join(OUT, f), { recursive: true, force: true });
mkdirSync(join(OUT, 'articles'), { recursive: true });
const write = (rel: string, data: unknown) => writeFileSync(join(OUT, rel), JSON.stringify(data));
const index: z.infer<typeof IndexEntry>[] = [];
const counts: Record<string, number> = {};
const byIdFinal = new Map<string, any>();
for (const [dom, list] of final) {
  for (const e of list) byIdFinal.set(e.id, e);
  list.sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr'));
  write(`${dom}.json`, list);
  counts[dom] = list.length;
  for (const e of list) index.push({ id: e.id, fr: e.nom_fr, en: e.nom_en, c: e.categorie, d: dom, i: e.image?.url ?? null, ...(e.saisons.length && e.saisons.length < 4 ? { s: e.saisons } : {}), ...(e.nom_fr_alias ? { a: e.nom_fr_alias } : {}) } as any);
}
for (const [dom, arts] of articles) write(`articles/${dom}.json`, arts);
// Index de recherche compact : [id, nom_fr, nom_en, catégorie, domaine, image, saisons(bitmask), alias]
const IMG_PREFIX = 'https://static.wikia.nocookie.net/coralisland/images/';
const shortImg = (u: string | null) => (!u ? '' : u.startsWith(IMG_PREFIX) ? u.slice(IMG_PREFIX.length).replace(/\/revision\/latest.*$/, '') : u);
const aliases = new Map<string, Set<string>>();
for (const [from, to] of Object.entries(redirects)) {
  const id = resolver.resolve(to, false);
  if (id && !/\(|\//.test(from)) (aliases.get(id) ?? aliases.set(id, new Set()).get(id)!).add(from);
}
const SB: Record<string, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
write('search.json', {
  img: IMG_PREFIX,
  e: index.map((x) => {
    const al = [...(aliases.get(x.id) ?? [])].filter((a) => a.toLowerCase() !== x.en.toLowerCase() && a.toLowerCase() !== x.fr.toLowerCase());
    const row: (string | number)[] = [x.id, x.fr === x.en ? '' : x.fr, x.en, x.c, x.d, shortImg(x.i), (x.s ?? []).reduce((a, k) => a | SB[k], 0)];
    const ent = byIdFinal.get(x.id);
    const U: Record<string, string> = { love: 'L', like: 'l', neutral: 'n', dislike: 'd', hate: 'h' };
    row.push(al.join('|'), (x as any).a ?? '', U[(ent?.extra as any)?.cadeau_universel] ?? '');
    return row;
  }),
});
write('temple.json', templeData);
write('musee.json', museumData);
write('rang.json', rankData);
write('mines.json', minesData);
// Données compactes de l'écran « Aujourd'hui » (chargées seules au démarrage)
{
  const SB: Record<string, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
  const mask = (ss: string[]) => ss.reduce((a, k) => a | (SB[k] ?? 0), 0);
  const W = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];
  const wmask = (ws: string[]) => (ws.length ? ws.reduce((a, k) => a | (1 << W.indexOf(k)), 0) : 63);
  const all = [...final.values()].flat();
  const dom = (id: string) => [...final].find(([, l]) => l.some((e) => e.id === id))?.[0] ?? '';
  const domOf = new Map<string, string>();
  for (const [d, l] of final) for (const e of l) domOf.set(e.id, d);
  const x = (e: any) => e.extra as any;
  const today = {
    anniversaires: all.filter((e) => domOf.get(e.id) === 'pnj' && x(e).anniversaire).map((e) => ({ id: e.id, s: x(e).anniversaire.saison, j: x(e).anniversaire.jour })),
    festivals: all.filter((e) => domOf.get(e.id) === 'festivals' && x(e).date).map((e) => ({ id: e.id, s: x(e).date.saison, j: x(e).date.jour, f: x(e).date.fin ?? x(e).date.jour, h: e.horaires_texte ?? '' })),
    captures: all
      .filter((e) => ['poissons', 'insectes', 'creatures-marines'].includes(domOf.get(e.id)!))
      .map((e) => ({
        id: e.id,
        d: domOf.get(e.id),
        s: mask(e.saisons),
        w: wmask(e.meteo),
        h: e.horaires,
        l: e.lieux.join(', '),
        ...(Array.isArray(x(e).conditions) && x(e).conditions.length > 1
          ? { c: x(e).conditions.map((c: any) => ({ z: c.zone, s: mask(c.saisons), w: wmask(c.meteo), h: c.horaires, ...(c.jours ? { dj: c.jours.map((j: any) => [SB[j.saison], j.de, j.a]) } : {}) })) }
          : x(e).jours_saison
            ? { dj: x(e).jours_saison.map((j: any) => [SB[j.saison], j.de, j.a]) }
            : {}),
        ...(x(e).rarete ? { r: x(e).rarete } : {}),
      })),
    cultures: all
      .filter((e) => ['cultures', 'arbres'].includes(domOf.get(e.id)!) && x(e).croissance && e.prix?.base && !/Graines|Plant|Jeune arbre/.test(e.categorie))
      .map((e) => ({ id: e.id, s: mask(e.saisons), g: x(e).croissance, r: x(e).repousse ?? 0, pg: x(e).prix_graine ?? null, v: e.prix!.base, gr: x(e).graine ?? null, o: x(e).culture_oceanique ? 1 : 0, rg: x(e).rang_ville ?? null })),
    boutiques: all
      .filter((e) => domOf.get(e.id) === 'lieux' && Array.isArray(x(e).ouverture) && x(e).ouverture.length)
      .map((e) => {
          // Tenanciers : habitants cités comme propriétaires (fiche PNJ → « sa boutique est ouverte ? »)
          const own = all.filter((n) => domOf.get(n.id) === 'pnj' && x(e).proprietaire && new RegExp(`\\b${n.nom_en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(x(e).proprietaire)).map((n) => n.id);
          return { id: e.id, o: x(e).ouverture.map((o: any) => ({ j: o.j, p: o.plages })), f: x(e).ferme_j ?? [], m: e.categorie === 'Magasin' ? 1 : 0, ...(own.length ? { own } : {}) };
        }),
  };
  void dom;
  write('aujourdhui.json', today);
  if (carte) write('carte.json', carte);

  // Données compactes des trackers : événements de cœur et lieux des objets à cocher (filtre « par lieu »).
  const tracked = new Set<string>();
  for (const e of all) if (['poissons', 'insectes', 'creatures-marines', 'cuisine'].includes(domOf.get(e.id)!)) tracked.add(e.id);
  for (const c of museumData?.collections ?? []) for (const id of c.objets) tracked.add(id);
  for (const a of templeData?.autels ?? []) for (const o of a.offrandes) for (const it of o.objets) tracked.add(it.id);
  const suivi = {
    coeur: all
      .filter((e) => domOf.get(e.id) === 'pnj' && x(e).evenements_coeur?.length)
      .map((e) => ({ id: e.id, ev: x(e).evenements_coeur.map((v: any) => ({ c: v.coeurs, r: v.resume ?? v.resume_en ?? '', l: v.lieu ?? '', k: v.condition ?? '' })) })),
    lieux: Object.fromEntries(all.filter((e) => tracked.has(e.id) && e.lieux.length).map((e) => [e.id, e.lieux])),
  };
  write('suivi.json', suivi);

  // Planificateur de cadeaux : préférences explicites par habitant (les cadeaux universels sont dans search.json).
  const cadeaux = Object.fromEntries(
    all
      .filter((e) => domOf.get(e.id) === 'pnj' && x(e).cadeaux)
      .map((e) => {
        const c = x(e).cadeaux;
        return [e.id, { L: c.love ?? [], l: c.like ?? [], d: c.dislike ?? [], h: c.hate ?? [], ...(x(e).mariable ? { m: 1 } : {}) }];
      }),
  );
  write('cadeaux.json', cadeaux);
}
write(
  'icones.json',
  Object.fromEntries(
    Object.entries(UI_ICONS)
      .map(([k, f]) => [k, images[f]?.url?.replace('https://static.wikia.nocookie.net/coralisland/images/', '').replace(/\/revision\/.*$/, '')])
      .filter(([, u]) => u),
  ),
);
write('domaines.json', Object.fromEntries(Object.entries(DOMAIN_LABELS).filter(([k]) => counts[k])));
write('conflits.json', ctx.conflicts);
const meta = {
  game_version: '1.3',
  game_version_date: '2026-06-18',
  game_version_source: 'https://blog.stairwaygames.com/post/coral-island-1-3-update-available-now',
  upcoming: '1.4 « Kids Grow Up » annoncée le 16/10/2026 pour l’hiver (non publiée)',
  generated_at: new Date().toISOString(),
  fandom_fetched_at: fetchedAt,
  counts,
};
Meta.parse(meta);
write('meta.json', meta);

// ---------- 11. Rapport ----------
coverage({ pages, excluded, final, articles, ctx, fr, xcheck, guideCheck, wiki2, broken, errors, templeData, museumData, unresolved: resolver.unresolved });
console.log(`entités: ${index.length} en ${final.size} domaines, conflits: ${ctx.conflicts.length}, refs cassées: ${broken.length}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
