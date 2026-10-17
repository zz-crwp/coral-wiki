// Domaines dérivés de pages de mécanique : temple, musée, quêtes, maîtrises, rang, succès, mines.
import { findTemplates, links, plain, sections, subsections, tables } from '../lib/wikitext.ts';
import { slug, loadJson } from '../lib/load.ts';
import { Ctx, fandomSource, type Draft } from './ctx.ts';
import { clean, num, list } from './norm.ts';
import { parseItemList } from './relations.ts';
import { ArticleRenderer } from './article.ts';

const ALTAR_FR: Record<string, string> = { Crop: 'Autel des cultures', Catch: 'Autel des prises', Advanced: 'Autel avancé', Rare: 'Autel rare' };

export function temple(ctx: Ctx) {
  const p = ctx.pages.get('Lake Temple');
  if (!p) return null;
  const altars: any[] = [];
  const secs = subsections(sections(p.content)['Offerings'] ?? '');
  for (const [title, body] of Object.entries(secs)) {
    for (const t of findTemplates(body, 'Offering')) {
      const altarEn = clean(t.params.altar) || title.replace(/\s*Altar$/i, '');
      const offerings: any[] = [];
      for (let i = 1; t.params[`${i}_name`]; i++) {
        const items = parseItemList(ctx, t.params[`${i}_items`]);
        const reward = parseItemList(ctx, t.params[`${i}_reward`]);
        const id = `offrande-${slug(clean(t.params[`${i}_name`]))}`;
        offerings.push({
          id,
          nom_en: clean(t.params[`${i}_name`]),
          requis: num(t.params[`${i}_amount`]) ?? items.items.length,
          objets: items.items,
          non_resolus: items.unresolved.length ? items.unresolved : undefined,
          recompense: reward.items,
          recompense_texte: reward.unresolved.length ? reward.unresolved.join(', ') : undefined,
        });
        for (const it of items.items) {
          const d = ctx.drafts.get(it.id);
          if (d) (d.extra.offrandes ??= []).push({ autel: `autel-${slug(altarEn)}`, offrande: id, n: it.n, qualite: it.qualite });
        }
      }
      const intro = new ArticleRenderer(ctx).inline(body.slice(0, body.indexOf('{{Offering')).split('\n').find((x) => x.trim().length > 20) ?? '');
      altars.push({ id: `autel-${slug(altarEn)}`, nom_en: `${altarEn} Altar`, nom_fr: ALTAR_FR[altarEn] ?? `Autel ${altarEn}`, effet_en: intro, offrandes: offerings });
    }
  }
  // Paliers : « * Completing any N offerings: ** … »
  const tiers: any[] = [];
  const intro = sections(p.content)['Offerings'] ?? '';
  const r = new ArticleRenderer(ctx);
  for (const m of intro.matchAll(/^\*\s*Completing any (\d+) offerings?:?\s*\n((?:\*\*.*\n?)+)/gim)) {
    tiers.push({ offrandes: Number(m[1]), recompenses: m[2].split('\n').map((l) => r.inline(l.replace(/^\*+\s*/, ''))).filter(Boolean) });
  }
  return { source: fandomSource(p), autels: altars, paliers: tiers };
}

export function museum(ctx: Ctx) {
  const p = ctx.pages.get('Museum');
  if (!p) return null;
  const r = new ArticleRenderer(ctx);
  const secs = sections(p.content);
  const milestone = (k: string) => {
    const t = tables(secs[k] ?? '')[0];
    if (!t) return [];
    return t.slice(0).filter((row) => /^\d/.test(clean(row[0]))).map((row) => ({ dons: num(row[0]), recompense: r.inline(row[1] ?? ''), autre: r.inline(row[2] ?? '') || undefined }));
  };
  // Objets donnables : poissons, insectes, créatures marines, artefacts, fossiles, gemmes
  const sets: Record<string, string[]> = { poissons: [], insectes: [], 'creatures-marines': [], artefacts: [], fossiles: [], gemmes: [] };
  for (const d of ctx.drafts.values()) {
    let k: string | null = null;
    if (d.domain === 'poissons' || d.domain === 'insectes' || d.domain === 'creatures-marines') k = d.domain;
    else if (d.domain === 'mineraux' && d.categorie === 'Artefact') k = 'artefacts';
    else if (d.domain === 'mineraux' && d.categorie === 'Fossile') k = 'fossiles';
    else if (d.domain === 'mineraux' && d.categorie === 'Gemme') k = 'gemmes';
    if (!k || d.extra.statut_wiki === 'à venir') continue;
    sets[k].push(d.id);
    d.extra.don_musee = k;
  }
  const collKey = Object.keys(secs).find((k) => /collection milestone/i.test(k));
  return {
    source: fandomSource(p),
    paliers_dons: milestone(Object.keys(secs).find((k) => /donation milestone/i.test(k)) ?? ''),
    paliers_collections: collKey ? r.render(secs[collKey]) : [],
    collections: Object.entries(sets).map(([k, ids]) => ({ id: k, objets: ids.sort() })),
  };
}

/** Quêtes : lignes des tableaux de la page « Quest » (principales + secondaires). */
export function quests(ctx: Ctx): Draft[] {
  const p = ctx.pages.get('Quest');
  if (!p) return [];
  const r = new ArticleRenderer(ctx);
  const out: Draft[] = [];
  const secs = sections(p.content);
  for (const [sec, body] of Object.entries(secs)) {
    if (!/quests|challenge|letters/i.test(sec)) continue;
    for (const [sub, sb] of Object.entries(subsections(body))) {
      for (const t of [...sb.matchAll(/^\{\|[\s\S]*?^\|\}/gm)]) {
        const block = r.table(t[0]) as any;
        const head = block.h.map((h: string) => h.toLowerCase());
        const col = (re: RegExp) => head.findIndex((h: string) => re.test(h));
        const iName = Math.max(0, col(/name|quest|letter|challenge/));
        for (const row of block.r) {
          const nameRaw = row[iName] ?? '';
          const name = nameRaw.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1').trim();
          if (!name || name.length > 80) continue;
          const id = `quete-${slug(name)}`;
          if (ctx.drafts.has(id) || out.some((o) => o.id === id)) continue;
          const get = (re: RegExp) => { const i = col(re); return i >= 0 ? row[i] ?? '' : ''; };
          const d: Draft = {
            id, domain: 'guides' as any, page: p, infobox: null, nom_en: name,
            categorie: /side/i.test(sec) ? 'Quête secondaire' : /main/i.test(sec) ? 'Quête principale' : sec,
            sous_categorie: sub || undefined, image: null,
            description_en: (get(/text|description|content/) || '').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1'),
            obtention: [get(/provided|giver|from|sender/)].filter(Boolean), lieux: [], saisons: [], meteo: [], horaires: [], prix: null,
            prerequis: get(/requirement|objective|task/).split(/\s*·\s*/).map((x: string) => x.replace(/^•\s*/, '').trim()).filter(Boolean), utilise_dans: new Set(), aime_par: {},
            extra: { objectifs: get(/requirement|objective|task/) || undefined, recompenses: get(/reward/) || undefined, donneur: get(/provided|giver|from|sender/) || undefined, colonnes: block.h },
            liens: new Set(), a_verifier: new Set(), sources: [{ ...fandomSource(p), url: `${fandomSource(p).url}#${encodeURIComponent(name.replace(/ /g, '_'))}` }],
          };
          (d as any).domain = 'quetes';
          // Liens + objets requis (inverse « Requis pour »)
          for (const cell of row) for (const m of cell.matchAll(/\[\[([a-z0-9-]+)\|/g)) d.liens.add(m[1]);
          for (const m of (d.extra.objectifs ?? '').matchAll(/\[\[([a-z0-9-]+)\|/g)) {
            const it = ctx.drafts.get(m[1]);
            if (it) (it.extra.requis_pour ??= []).push({ type: 'quete', id });
          }
          if (!d.description_en) d.a_verifier.add('description');
          out.push(d);
        }
      }
    }
  }
  return out;
}

const MASTERIES = ['Farming', 'Ranching', 'Foraging', 'Mining', 'Diving', 'Catching', 'Fishing', 'Combat'];
const MASTERY_FR: Record<string, string> = { Farming: 'Agriculture', Ranching: 'Élevage', Foraging: 'Cueillette', Mining: 'Minage', Diving: 'Plongée', Catching: 'Capture', Fishing: 'Pêche', Combat: 'Combat' };

export function masteries(ctx: Ctx): Draft[] {
  const r = new ArticleRenderer(ctx);
  const out: Draft[] = [];
  for (const m of MASTERIES) {
    const p = ctx.pages.get(m) ?? ctx.pages.get(m === 'Catching' ? 'Bug catching' : m);
    if (!p) { ctx.warnings.push(`Maîtrise sans page : ${m}`); continue; }
    const unlock = findTemplates(p.content, 'Mastery unlocks')[0];
    const levels = unlock ? Object.entries(unlock.params).filter(([k]) => /^l\d+$/.test(k)).map(([k, v]) => ({ niveau: Number(k.slice(1)), recettes: list(v).map((x) => ctx.ref(x) ?? clean(x)).filter(Boolean) })) : [];
    const secs = sections(p.content);
    const mastSec = Object.entries(secs).find(([k]) => /mastery/i.test(k))?.[1] ?? p.content;
    const skillsSec = subsections(mastSec)['Skills'] ?? '';
    const skills = (tables(skillsSec)[0] ?? []).filter((row) => row.length >= 2 && !/^skill$/i.test(clean(row[0]))).map((row) => ({ nom_en: clean(row[0].replace(/\{\{icon[^}]*\}\}/gi, '')), effet_en: clean(row[1]) })).filter((s) => s.nom_en);
    const xp = (tables(subsections(mastSec)['Experience'] ?? '')[0] ?? []).filter((row) => row.length >= 2 && !/^(action|stone)$/i.test(clean(row[0]))).map((row) => ({ action: r.inline(row[0]), points: clean(row[row.length - 1]) }));
    const id = `maitrise-${slug(m)}`;
    out.push({
      id, domain: 'maitrises' as any, page: p, infobox: null, nom_en: m, nom_fr: MASTERY_FR[m], nom_fr_source: 'wiki-fr', categorie: 'Maîtrise', image: ctx.image(`${m} mastery.png`) ?? ctx.image(`${m.toLowerCase()} mastery.png`),
      description_en: clean(plain(subsections(mastSec)[''] ?? '').split('\n').find((x) => x.length > 30) ?? ''), obtention: [], lieux: [], saisons: [], meteo: [], horaires: [], prix: null, prerequis: [],
      utilise_dans: new Set(), aime_par: {}, extra: { niveaux: levels, competences: skills, experience: xp }, liens: new Set(), a_verifier: new Set(skills.length ? [] : ['competences']), sources: [fandomSource(p)],
    });
    for (const lv of levels) for (const rid of lv.recettes) { const d = ctx.drafts.get(rid); if (d) d.extra.debloque_par = { maitrise: id, niveau: lv.niveau }; }
  }
  return out;
}

export function townRank(ctx: Ctx) {
  const p = ctx.pages.get('Town rank');
  if (!p) return null;
  const r = new ArticleRenderer(ctx);
  const t = [...p.content.matchAll(/^\{\|[\s\S]*?^\|\}/gm)].map((m) => r.table(m[0]) as any);
  const main = t.find((x) => x.h.some((h: string) => /points required/i.test(h)));
  const rows = (main?.r ?? []).map((row: string[]) => ({ rang: row[0], points: num(row[1]), total: num(row[2]), deblocages: row[3] ?? '', autres: row[4] ?? '' }));
  const blocks = r.render(p.content);
  return { source: fandomSource(p), rangs: rows, article: blocks };
}

export function achievements(ctx: Ctx): Draft[] {
  const list: any[] = loadJson('steam/achievements.json', []);
  const pseudoPage = { pageid: 0, ns: 0, title: 'Steam achievements', revid: 0, timestamp: '', content: '', categories: [], pageimage: null, original: null, categoryinfo: null };
  return list.map((a) => ({
    id: `succes-${slug(a.name_en)}`, domain: 'succes' as any, page: pseudoPage, infobox: null, nom_en: a.name_en, nom_fr: a.name_fr ?? a.name_en, nom_fr_source: a.name_fr ? 'wiki-fr' : 'en',
    categorie: 'Succès', sous_categorie: a.api_name.split('_')[0], image: a.icon ? { url: a.icon, w: 64, h: 64, file: a.api_name } : null,
    description_en: a.desc_en, description_fr: a.desc_fr ?? undefined, obtention: [], lieux: [], saisons: [], meteo: [], horaires: [], prix: null, prerequis: [],
    utilise_dans: new Set(), aime_par: {}, extra: { api: a.api_name, pourcentage_joueurs: a.percent, cache: a.hidden }, liens: new Set(), a_verifier: new Set(),
    sources: [{ name: 'Steam (succès officiels, FR localisé)', url: `https://steamcommunity.com/stats/1158160/achievements/` }],
  })) as Draft[];
}

/** Mines : 4 mines de 40 étages, récompenses par étage, monstres par plage d'étages. */
export function mines(ctx: Ctx) {
  const p = ctx.pages.get('Cavern');
  if (!p) return null;
  const r = new ArticleRenderer(ctx);
  const secs = sections(p.content);
  const rewards = findTemplates(secs['All mines'] ?? '', 'Reward')[0];
  const rewardRows = rewards ? Object.entries(rewards.params).filter(([k]) => /^\d+$/.test(k)).map(([, v]) => v.split(/\s*;\s*/)) : [];
  const out: any[] = [];
  for (const mine of ['Earth', 'Water', 'Wind', 'Fire']) {
    const key = `${mine} mine`;
    const body = secs[key] ?? Object.entries(secs).find(([k]) => k.toLowerCase().startsWith(key.toLowerCase()))?.[1] ?? '';
    const monsters: any[] = [];
    for (const d of ctx.drafts.values()) {
      if (d.domain !== 'monstres') continue;
      for (const loc of d.lieux) {
        const m = new RegExp(`${mine}\\s+mine\\s*\\(floors?\\s*(\\d+)\\s*[-–]\\s*(\\d+)\\)`, 'i').exec(loc) ?? new RegExp(`${mine}\\s+mine`, 'i').exec(loc);
        if (m) monsters.push({ id: d.id, etages: m[1] ? [Number(m[1]), Number(m[2])] : undefined });
      }
    }
    out.push({
      id: `mine-${mine.toLowerCase()}`,
      nom_en: key,
      nom_fr: { Earth: 'Mine de terre', Water: "Mine d'eau", Wind: 'Mine de vent', Fire: 'Mine de feu' }[mine],
      etages: 40,
      recompenses: rewardRows.filter((row) => new RegExp(mine, 'i').test(row[1] ?? '')).map((row) => ({ objet: row[0] ? ctx.ref(row[0].trim()) ?? clean(row[0]) : null, condition: r.inline(row[1] ?? ''), quantite: num(row[2]) ?? undefined, autre: r.inline(row[3] ?? '') || undefined })),
      monstres: monsters,
      article: r.render(body),
    });
  }
  return { source: fandomSource(p), intro: r.render((secs['All mines'] ?? '').replace(/\{\{Reward[\s\S]*?\n\}\}/, '')), mines: out };
}

export { links };
