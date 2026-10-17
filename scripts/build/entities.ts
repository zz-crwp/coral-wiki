// Infobox → brouillon d'entité (champs communs + extra par domaine).
import type { Page } from '../lib/load.ts';
import { files, findTemplates, links, plain, sections, type Template } from '../lib/wikitext.ts';
import type { Domain } from './classify.ts';
import { Ctx, fandomSource, type Draft } from './ctx.ts';
import { clean, list, num, qualityPrices, rank, scoped, seasons, times, weather, merge, ALL_SEASONS, WEATHER_ALL } from './norm.ts';
import { spawnConditions } from './spawn.ts';

function firstImage(ctx: Ctx, p: Page, ib: Template | null) {
  const cands: string[] = [];
  const v = ib?.params.image ?? ib?.params.image1 ?? '';
  if (v) {
    const fromGallery = files(v);
    if (fromGallery.length) cands.push(...fromGallery);
    else cands.push(clean(v.replace(/\[\[(?:File|Image):([^|\]]+).*?\]\]/i, '$1')));
  }
  if (p.pageimage) cands.push(p.pageimage);
  cands.push(`${p.title}.png`, `${p.title} portrait.png`, `${p.title} icon.png`, `${p.title} map icon.png`, `${p.title} Location.png`);
  for (const c of cands) {
    const img = ctx.image(c);
    if (img) return img;
  }
  return null;
}

function description(p: Page, ib: Template | null): string {
  const d = ib?.params.description ?? ib?.params.Description ?? ib?.params.tooldescription ?? ib?.params.bio ?? '';
  const txt = clean(d);
  if (txt) return txt;
  // Repli : citation {{Quote}} ou premier paragraphe de l'article
  const q = findTemplates(p.content, 'Quote')[0];
  if (q?.params['1']) return clean(q.params['1']);
  const intro = (sections(p.content)[''] ?? '').replace(/\{\{\s*PAGENAME\s*\}\}/g, p.title);
  const para = plain(intro.replace(/^\s*\{\{[\s\S]*?\}\}\s*$/gm, ''))
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s.length > 30 && !/^[|:{!]/.test(s) && !/^\w+\s*=/.test(s));
  return para ?? '';
}

/** « source = [[Large node]];[[Black Market]] » → libellés + liens résolus. */
function sources(ctx: Ctx, d: Draft, v: string | undefined): string[] {
  const out: string[] = [];
  for (const it of list(v)) {
    const txt = clean(it);
    if (!txt) continue;
    out.push(txt);
    for (const l of links(it)) {
      const id = ctx.ref(l, false);
      if (id) d.liens.add(id);
    }
  }
  return out;
}

function locations(ctx: Ctx, d: Draft, v: string | undefined): string[] {
  const out: string[] = [];
  for (const { scope, value } of scoped(v)) {
    for (const it of list(value)) {
      const txt = clean(it).replace(/^\s*(and|or)\s+/i, '');
      if (!txt) continue;
      out.push(scope ? `${txt}` : txt);
      for (const l of links(it)) {
        const id = ctx.ref(l, false);
        if (id) d.liens.add(id);
      }
    }
  }
  return [...new Set(out)];
}

export function newDraft(ctx: Ctx, id: string, domain: Domain, categorie: string, p: Page, ib: Template | null): Draft {
  const d: Draft = {
    id,
    domain,
    page: p,
    infobox: ib,
    nom_en: clean(ib?.params.title) || clean(ib?.params.name) || p.title.replace(/\s*\((item|character|artisan product)\)$/i, ''),
    categorie,
    image: firstImage(ctx, p, ib),
    description_en: description(p, ib),
    obtention: [],
    lieux: [],
    saisons: [],
    meteo: [],
    horaires: [],
    prix: null,
    prerequis: [],
    utilise_dans: new Set(),
    aime_par: {},
    extra: {},
    liens: new Set(),
    a_verifier: new Set(),
    sources: [fandomSource(p)],
  };
  if (/\{\{\s*stub/i.test(p.content)) d.extra.ebauche = true;
  if (/\{\{\s*(upcoming|unsynced|bugged)/i.test(p.content)) d.extra.statut_wiki = /upcoming/i.test(p.content) ? 'à venir' : 'à vérifier (signalé par le wiki)';
  return d;
}

/** Remplit les champs à partir de l'infobox, selon le domaine. */
export function fillFromInfobox(ctx: Ctx, d: Draft) {
  const ib = d.infobox;
  const P = ib?.params ?? {};
  const sell = num(P.sell ?? P.sell_base);
  const q = { bronze: num(P.bronze), silver: num(P.silver), gold: num(P.gold), osmium: num(P.osmium) };
  if (sell != null && sell > 0) d.prix = qualityPrices(sell, q);
  if (P.source) d.obtention.push(...sources(ctx, d, P.source));
  if (P.buy) d.extra.prix_achat = num(P.buy);
  if (P.journalid && num(P.journalid) != null) d.extra.journal_id = num(P.journalid);
  if (P.income) d.extra.competence_prix = clean(P.income);
  if (P.health || P.energy) {
    d.extra.sante = num(P.health);
    d.extra.energie = num(P.energy);
  }
  if (P.size && d.domain !== 'poissons') d.extra.taille = clean(P.size);
  if (P.rank) d.extra.rang_ville = rank(P.rank);
  if (P.effect || P.buff) d.extra.effet = clean(P.effect ?? P.buff);
  if (P.debuff) d.extra.effet_negatif = clean(P.debuff);
  if (P.item_group) d.extra.groupes_bruts = list(P.item_group).map(clean).filter(Boolean);

  switch (d.domain) {
    case 'cultures':
      if (/^Graines|Plant|Jeune arbre$/.test(d.categorie)) {
        d.saisons = seasons(P.season);
        d.extra.croissance = num(P.growth);
        d.extra.repousse = num(P.regrowth);
        d.extra.donne_brut = clean(P.crop ?? '');
      } else {
        d.saisons = seasons(P.season);
        d.extra.graine_brut = clean(P.seed);
        d.extra.prix_graine = num(P.seed_price);
        d.extra.croissance = num(P.growth);
        d.extra.repousse = num(P.regrowth);
        d.extra.type = clean(P.type);
        if (P.giant_crop) d.extra.culture_geante = clean(P.giant_crop);
        if (/ocean/i.test(P.item_group ?? '')) d.extra.culture_oceanique = true;
      }
      break;
    case 'arbres':
      d.saisons = seasons(P.season);
      d.extra.graine_brut = clean(P.seed);
      d.extra.croissance = num(P.growth);
      break;
    case 'cueillette':
      d.saisons = seasons(P.season);
      d.lieux = locations(ctx, d, P.location);
      break;
    case 'poissons': {
      // Conditions par zone (saisons, jours, heures, météo) : voir spawn.ts
      const conditions = spawnConditions(P);
      d.saisons = ALL_SEASONS.filter((s) => conditions.some((c) => c.saisons.includes(s)));
      d.horaires = merge(conditions.flatMap((c) => c.horaires));
      d.meteo = WEATHER_ALL.filter((w) => conditions.some((c) => c.meteo.includes(w)));
      d.horaires_texte = clean(P.time);
      d.lieux = locations(ctx, d, P.location);
      d.extra.conditions = conditions;
      d.extra.rarete = clean(P.rarity);
      if (P.cave_rarity) d.extra.rarete_mine = clean(P.cave_rarity);
      d.extra.difficulte = clean(P.difficulty);
      d.extra.taille_ombre = clean(P.size);
      d.extra.motif = clean(P.pattern);
      const jw = conditions.flatMap((c) => c.jours ?? []);
      if (jw.length) d.extra.jours_saison = jw;
      break;
    }
    case 'insectes':
    case 'creatures-marines': {
      const conditions = spawnConditions(P);
      d.saisons = ALL_SEASONS.filter((s) => conditions.some((c) => c.saisons.includes(s)));
      d.horaires = merge(conditions.flatMap((c) => c.horaires));
      d.horaires_texte = clean(P.time);
      d.meteo = WEATHER_ALL.filter((w) => conditions.some((c) => c.meteo.includes(w)));
      if (conditions.length > 1) d.extra.conditions = conditions;
      if (!P.weather && d.domain === 'insectes') d.a_verifier.add('meteo');
      d.lieux = locations(ctx, d, P.location);
      d.extra.rarete = clean(P.rarity);
      d.extra.difficulte = clean(P.difficulty);
      if (P.category) d.extra.famille = clean(P.category);
      if (d.domain === 'creatures-marines') {
        const depth = /(\d+)\s*-\s*(\d+)\s*m/.exec(P.location ?? '');
        if (depth) d.extra.profondeur = `${depth[1]}–${depth[2]} m`;
      }
      break;
    }
    case 'pnj': {
      const bd = /(spring|summer|fall|winter)\]*\s*(\d{1,2})/i.exec(clean(P.birthday));
      if (bd) d.extra.anniversaire = { saison: bd[1].toLowerCase(), jour: Number(bd[2]) };
      else if (/townie/i.test(P.type ?? '')) d.a_verifier.add('anniversaire');
      d.extra.genre = clean(P.gender) || undefined;
      d.extra.emploi = clean(P.occupation) || undefined;
      d.extra.situation = clean(P.marital) || undefined;
      d.extra.type = clean(P.type) || undefined;
      d.extra.espece = clean(P.species).replace(/<!--.*?-->/g, '') || undefined;
      d.extra.mariable = P.romance === '1' || /marriage candidates/i.test(d.page.categories.map((c) => c.title).join('|'));
      d.extra.famille = clean(P.family) || undefined;
      d.extra.loisirs = clean(P.hobbies) || undefined;
      d.lieux = locations(ctx, d, P.residency);
      if (/merfolk/i.test(P.species ?? '') && d.categorie === 'Habitant') d.categorie = 'Merfolk';
      if (P.family) for (const l of links(P.family)) { const id = ctx.ref(l, false); if (id) d.liens.add(id); }
      break;
    }
    case 'lieux':
      d.extra.horaires_ouverture = clean(P.hours) || undefined;
      d.extra.ferme_le = clean(P.closed) || undefined;
      if (P.closed && !/always open|except/i.test(P.closed)) d.extra.ferme_j = parseDays(clean(P.closed));
      d.extra.adresse = clean(P.address) || undefined;
      d.extra.situe = clean(P.location) || undefined;
      d.extra.proprietaire = clean(P.owner) || undefined;
      d.extra.employes = clean(P.employee) || undefined;
      d.extra.residents = clean(P.resident) || undefined;
      d.horaires = parseOpening(P.hours).flatMap((o) => o.plages);
      d.extra.ouverture = parseOpening(P.hours);
      for (const k of ['owner', 'employee', 'resident', 'location']) for (const l of links(P[k] ?? '')) { const id = ctx.ref(l, false); if (id) d.liens.add(id); }
      break;
    case 'monstres':
      d.extra.pv = num(P.health);
      d.extra.attaque = num(P.attack);
      d.extra.defense = num(P.defense);
      d.extra.xp = num(P.exp);
      d.extra.variante = clean(P.variant) || undefined;
      d.extra.famille = clean(P.type);
      d.lieux = list(P.location).map(clean).filter(Boolean);
      d.extra.butin_brut = list(P.loot).map(clean).filter(Boolean);
      break;
    case 'festivals': {
      const m = /(spring|summer|fall|winter)\]*\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/i.exec(clean(P.date));
      if (m) {
        d.saisons = [m[1].toLowerCase()];
        d.extra.date = { saison: m[1].toLowerCase(), jour: Number(m[2]), fin: m[3] ? Number(m[3]) : undefined };
      } else d.a_verifier.add('date');
      d.lieux = locations(ctx, d, P.location);
      d.horaires = times(`${clean(P.start).split('-')[0]} - ${clean(P.end) || '24:00'}`);
      d.horaires_texte = [clean(P.start) && `Début ${clean(P.start)}`, clean(P.end) && `fin ${clean(P.end)}`].filter(Boolean).join(', ');
      d.extra.activites = [clean(P.main), clean(P.side)].filter(Boolean);
      break;
    }
    case 'elevage':
      if (d.categorie === 'Animal') {
        d.extra.logement = clean(P.housing);
        d.extra.produit_brut = list(P.produces).map(clean);
        d.extra.frequence = clean(P.day) || undefined;
        d.extra.outil = clean(P.tool) || undefined;
        d.extra.prix_achat = num(P.buy);
        d.extra.vendu_par_brut = clean(P.purchased_from) || undefined;
        if (P.rank) d.extra.rang_ville = rank(P.rank);
        d.extra.croissance = clean(P.growth) || undefined;
      }
      break;
    case 'artisanat':
      if (d.categorie === 'Produit artisanal') {
        d.extra.machine_brut = clean(P.machine);
        d.extra.entree_brut = clean(P.input);
        d.extra.duree = clean(P.time);
        if (P.input_amount) d.extra.quantite_entree = num(P.input_amount);
      } else {
        d.extra.fabrication_brut = P.craft ?? '';
        d.extra.deblocage = clean(P.unlock) || undefined;
        if (P.input) d.extra.entrees_texte = clean(P.input.replace(/\{\{\s*icon list\s*\|([^}]*)\}\}/gi, (_, a) => a.replace(/;/g, ', ')));
        if (P.produces) d.extra.produits_texte = clean(P.produces.replace(/\{\{\s*icon list\s*\|([^}]*)\}\}/gi, (_, a) => a.replace(/;/g, ', ')));
        d.extra.duree = clean(P.time) || undefined;
        d.extra.automatique = clean(P.auto) || undefined;
      }
      break;
    case 'outils':
      d.extra.deblocage = clean(P.unlock) || undefined;
      break;
    case 'cuisine':
      if (d.categorie === 'Plat cuisiné') {
        d.extra.source_recette = clean(P.recipe_source) || undefined;
        d.extra.duree_effet = clean(P.duration) || undefined;
        if (P.health_bronze) d.extra.sante_qualite = { bronze: num(P.health_bronze), silver: num(P.health_silver), gold: num(P.health_gold), osmium: num(P.health_osmium) };
      }
      break;
    case 'mineraux':
    case 'ressources':
      if (P.category) d.sous_categorie = clean(P.category);
      if (P.open) d.extra.prix_ouverture = num(P.open);
      d.lieux = locations(ctx, d, P.location);
      break;
    case 'vetements':
      d.sous_categorie = clean(P.category).replace(/;\s*Unique/i, '');
      if (/unique/i.test(P.category ?? '')) d.extra.unique = true;
      break;
    case 'mobilier':
      if (P.category) d.sous_categorie = clean(P.category);
      break;
    case 'batiments':
      d.extra.duree_construction = clean(P.buildtime) || undefined;
      break;
    case 'groupes':
      break;
  }
  if (d.domain !== 'pnj' && d.domain !== 'lieux' && !d.saisons.length && P.season) d.saisons = seasons(P.season);
}

const DAY_IDX: Record<string, number> = { mon: 0, m: 0, tue: 1, tues: 1, wed: 2, thu: 3, thur: 3, thurs: 3, fri: 4, f: 4, sat: 5, sun: 6, monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

/** « Mon - Sat », « Tue-Fri », « Sun-Thu », « Monday and Saturday », « everyday » → indices (0 = lundi). */
export function parseDays(t: string | undefined): number[] {
  const s = (t ?? '').toLowerCase();
  if (!s || /every ?day|all days|daily|tous les jours|always/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const m of s.matchAll(/([a-z]+)\.?\s*(?:-|–|&ndash;|to|through)\s*([a-z]+)/g)) {
    const a = DAY_IDX[m[1]];
    const b = DAY_IDX[m[2]];
    if (a == null || b == null) continue;
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === b) break;
    }
  }
  for (const w of s.split(/[^a-z]+/)) if (DAY_IDX[w] != null && w.length > 1) out.add(DAY_IDX[w]);
  return [...out].sort();
}

/** « 9:00 - 17:00 (Mon - Sat) <br /> 12:00 - 17:00 (Sun) » → [{jours, j, plages}] */
export function parseOpening(v: string | undefined): { jours: string; j: number[]; plages: { from: number; to: number }[] }[] {
  if (!v) return [];
  const out: { jours: string; j: number[]; plages: { from: number; to: number }[] }[] = [];
  for (const part of v.split(/<br\s*\/?>|\n|;/i)) {
    const txt = clean(part);
    if (!txt) continue;
    const plages = times(txt.replace(/\(.*?\)/g, ''));
    const jours = /\(([^)]+)\)/.exec(txt)?.[1] ?? 'Tous les jours';
    if (plages.length) out.push({ jours, j: parseDays(jours), plages });
  }
  return out;
}
