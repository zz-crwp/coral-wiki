// Phase 1.6 — Rapport de couverture : pages Fandom par catégorie vs entrées importées.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slug } from './lib/load.ts';
import { DOMAIN_LABELS } from './build/classify.ts';

const ROOT = join(import.meta.dirname, '..');

/** Catégories de contenu jeu (sous « Category:Coral Island ») suivies dans le rapport. */
const CONTENT_CATEGORIES = [
  'Characters', 'Marriage candidates', 'Merfolk', 'Adoptable pet characters', 'Crops', 'Fruits', 'Vegetables', 'Flowers', 'Grains', 'Seeds', 'Seedlings', 'Saplings',
  'Scavengeables', 'Fish', 'Insects', 'Critters', 'Farm animals', 'Animal products', 'Artifacts', 'Fossils', 'Gems', 'Geodes', 'Resources', 'Loot', 'Kelp', 'Metal bars',
  'Artisan products', 'Artisan equipments', 'Crafted items', 'Cooked dishes', 'Cooking utensils', 'Consumables', 'Tools', 'Weapons', 'Rings', 'Clothing',
  'Decorations', 'Decor', 'Furniture', 'Scarecrows', 'Fertilizer', 'Locations', 'Buildings', 'Shops and services', 'Monsters', 'Festival', 'Festivals', 'Item groups',
  'Game mechanics', 'Coffers', 'Fossil nodes',
];

export function coverage(o: any) {
  const { pages, excluded, final, articles, ctx, fr, xcheck, guideCheck, broken, errors, templeData, museumData, unresolved } = o;
  const exclByTitle = new Map<string, string>(excluded.map((e: any) => [e.title, e.reason]));
  const entityByTitle = new Map<string, any>();
  for (const [dom, list] of final as Map<string, any[]>) for (const e of list) { const d = ctx.drafts.get(e.id); if (d?.page?.title) entityByTitle.set(d.page.title, { dom, id: e.id }); }

  const catRows: any[] = [];
  for (const cat of CONTENT_CATEGORIES) {
    const members = [...pages.values()].filter((p: any) => p.categories.some((c: any) => c.title === cat));
    if (!members.length) continue;
    const imported = members.filter((p: any) => entityByTitle.has(p.title));
    const excl = members.filter((p: any) => exclByTitle.has(p.title));
    const reasons = new Map<string, number>();
    for (const p of excl) reasons.set(exclByTitle.get(p.title)!, (reasons.get(exclByTitle.get(p.title)!) ?? 0) + 1);
    const domains = new Map<string, number>();
    for (const p of imported) { const d = entityByTitle.get(p.title).dom; domains.set(d, (domains.get(d) ?? 0) + 1); }
    catRows.push({ categorie: cat, pages: members.length, importees: imported.length, exclues: excl.length, ecart: members.length - imported.length - excl.length, raisons: Object.fromEntries(reasons), domaines: Object.fromEntries(domains) });
  }

  const totals = { pages_fandom: pages.size, entites: [...final.values()].reduce((a: number, l: any[]) => a + l.length, 0), exclues: excluded.length };
  const exclReasons = new Map<string, string[]>();
  for (const e of excluded) exclReasons.set(e.reason, [...(exclReasons.get(e.reason) ?? []), e.title]);
  const quality = { sans_image: 0, sans_obtention: 0, sans_description: 0, nom_fr: 0, desc_fr: 0, desc_trad: 0, alias_fr: 0, haute: 0, moyenne: 0, basse: 0 };
  const byDomain: any[] = [];
  for (const [dom, list] of final as Map<string, any[]>) {
    const q = { domaine: dom, libelle: (DOMAIN_LABELS as any)[dom] ?? dom, entites: list.length, sans_image: 0, sans_obtention: 0, nom_fr: 0, desc_fr: 0, haute: 0, moyenne: 0, basse: 0, article: Object.keys(articles.get(dom) ?? {}).length };
    for (const e of list) {
      if (!e.image) (q.sans_image++, quality.sans_image++);
      if (e.a_verifier.includes('obtention')) (q.sans_obtention++, quality.sans_obtention++);
      if (e.a_verifier.includes('description')) quality.sans_description++;
      if (e.nom_fr_source !== 'en') (q.nom_fr++, quality.nom_fr++);
      if (e.description_lang === 'fr') (q.desc_fr++, quality.desc_fr++);
      if (e.description_lang === 'fr-trad') quality.desc_trad++;
      if (e.nom_fr_alias) quality.alias_fr++;
      (q as any)[e.confiance]++; (quality as any)[e.confiance]++;
    }
    byDomain.push(q);
  }
  byDomain.sort((a, b) => b.entites - a.entites);
  const unres = [...(unresolved as Map<string, number>)].sort((a, b) => b[1] - a[1]);

  const report = { genere: new Date().toISOString(), totaux: totals, qualite: quality, domaines: byDomain, categories: catRows, exclusions: Object.fromEntries([...exclReasons].map(([k, v]) => [k, { n: v.length, pages: v }])), fr: { pages_wiki_fr: fr.frPages, apparies: fr.matches.size, methodes: fr.stats, non_apparies: fr.unmatched, controles_croises: xcheck }, guide_steam: guideCheck, refs_cassees: broken, erreurs_schema: errors, noms_non_resolus: unres.slice(0, 300), conflits: ctx.conflicts.length, avertissements: ctx.warnings, temple: { autels: templeData?.autels.length, offrandes: templeData?.autels.reduce((a: number, x: any) => a + x.offrandes.length, 0) }, musee: museumData?.collections.map((c: any) => ({ [c.id]: c.objets.length })) };
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'reports', 'coverage.json'), JSON.stringify(report, null, 1));

  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');
  const md: string[] = [];
  md.push(`# Rapport de couverture — Coral Wiki`, '', `Généré le ${report.genere.slice(0, 16).replace('T', ' ')} UTC. Version du jeu ciblée : **1.3** (18/06/2026).`, '');
  md.push(`## Totaux`, '', `| | |`, `|---|---|`, `| Pages de contenu Fandom (ns 0, hors redirections) | ${totals.pages_fandom} |`, `| Entités importées | ${totals.entites} |`, `| Pages exclues (justifiées ci-dessous) | ${totals.exclues} |`, `| Entités sans image | ${quality.sans_image} (${pct(quality.sans_image, totals.entites)}) |`, `| Entités sans méthode d'obtention (marquées « à vérifier ») | ${quality.sans_obtention} |`, `| Noms FR issus du wiki FR / Steam | ${quality.nom_fr} (${pct(quality.nom_fr, totals.entites)}) |`, `| Descriptions FR (texte du jeu) | ${quality.desc_fr} |`, `| Descriptions FR traduites (non officielles) | ${quality.desc_trad} |`, `| Noms FR non officiels (alias de recherche) | ${quality.alias_fr} |`, `| Confiance haute / moyenne / basse | ${quality.haute} / ${quality.moyenne} / ${quality.basse} |`, `| Conflits consignés (conflits.json) | ${ctx.conflicts.length} |`, `| Références d'id cassées | ${broken.length} |`, `| Erreurs de schéma zod | ${errors.length} |`, '');
  md.push(`## Par domaine`, '', `| Domaine | Entités | Sans image | Sans obtention | Nom FR | Desc. FR | Haute/Moy./Basse | Article |`, `|---|---:|---:|---:|---:|---:|---|---:|`);
  for (const q of byDomain) md.push(`| ${q.libelle} | ${q.entites} | ${q.sans_image} | ${q.sans_obtention} | ${q.nom_fr} | ${q.desc_fr} | ${q.haute}/${q.moyenne}/${q.basse} | ${q.article} |`);
  md.push('', `## Par catégorie Fandom`, '', `Pages membres de la catégorie vs pages importées comme entité. *Écart* = pages ni importées ni exclues (doit être 0).`, '', `| Catégorie | Pages | Importées | Exclues | Écart | Raisons d'exclusion |`, `|---|---:|---:|---:|---:|---|`);
  for (const r of catRows) md.push(`| ${r.categorie} | ${r.pages} | ${r.importees} | ${r.exclues} | ${r.ecart} | ${Object.entries(r.raisons).map(([k, v]) => `${k} (${v})`).join(' ; ')} |`);
  md.push('', `## Exclusions`, '');
  for (const [k, v] of exclReasons) md.push(`- **${k}** — ${v.length} page(s) : ${v.slice(0, 12).join(', ')}${v.length > 12 ? ', …' : ''}`);
  md.push('', `## Noms français`, '', `Le wiki FR (${fr.frPages} pages) n'a pas de liens interlangues : appariement par empreinte de données.`, '');
  for (const [k, v] of Object.entries(fr.stats)) md.push(`- ${k} : ${v}`);
  md.push(`- Contrôles croisés EN/FR : ${xcheck.checked} valeurs comparées, ${xcheck.agree} concordantes, ${xcheck.checked - xcheck.agree} écarts → conflits.json`, `- Pages FR non appariées : ${fr.unmatched.length} (${fr.unmatched.slice(0, 15).join(', ')}…)`);
  md.push('', `## Contrôle par seconde source`, '', `- Wiki FR : ${xcheck.checked} valeurs comparées (prix, saisons, croissance, rang, anniversaires), ${xcheck.agree} concordantes.`, `- Guide Steam « NPC Birthdays & Loved Gifts » (02/05/2026) : ${guideCheck.pnj} PNJ ; anniversaires ${guideCheck.anniversaires_ok} concordants / ${guideCheck.anniversaires_ko} divergents ; cadeaux adorés ${guideCheck.cadeaux_ok} concordants / ${guideCheck.cadeaux_ko} divergents (${guideCheck.cadeaux_non_resolus} non résolus).`, `- Succès : source officielle Steam (EN + FR).`, `- Divergences : voir \`src/data/conflits.json\` (source retenue + raison).`);
  md.push('', `## Noms non résolus (top 40)`, '', `Références textuelles qui ne correspondent à aucune page (objets sans page Fandom, fautes de frappe du wiki). Conservées en texte.`, '');
  md.push(unres.slice(0, 40).map(([n, c]) => `\`${n}\` ×${c}`).join(', '));
  if (broken.length) md.push('', `## Références cassées`, '', ...broken.slice(0, 50).map((b: string) => `- ${b}`));
  writeFileSync(join(ROOT, 'reports', 'coverage.md'), md.join('\n') + '\n');
  return report;
}

export { slug };
