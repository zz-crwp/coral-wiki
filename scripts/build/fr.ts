// Noms et descriptions FR à partir du wiki Fandom FR (pas de liens interlangues :
// appariement par empreinte de données, puis propagation via les recettes alignées).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, WIKI_FR } from '../lib/api.ts';
import { key } from '../lib/load.ts';
import { findTemplates, templates, type Template } from '../lib/wikitext.ts';
import type { Ctx, Draft } from './ctx.ts';
import { clean, num, seasons } from './norm.ts';

type FrPage = { title: string; content: string; categories: string[]; tpl: Template | null };

const FR_SEASON: Record<string, string> = { printemps: 'spring', ete: 'summer', automne: 'fall', hiver: 'winter' };

export function frUrl(title: string) {
  return `${WIKI_FR}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function frSeasons(v: string | undefined) {
  const s = clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Object.entries(FR_SEASON).filter(([w]) => s.includes(w)).map(([, x]) => x);
}

export type FrMatch = { id: string; fr: string; how: string; page: string; description?: string };

export function matchFr(ctx: Ctx): { matches: Map<string, FrMatch>; stats: Record<string, number>; frPages: number; unmatched: string[] } {
  const file = join(CACHE_DIR, 'fr', 'pages.json');
  if (!existsSync(file)) return { matches: new Map(), stats: {}, frPages: 0, unmatched: [] };
  const raw: Record<string, { content: string; categories: string[] }> = JSON.parse(readFileSync(file, 'utf8'));
  const fr: FrPage[] = Object.entries(raw).map(([title, p]) => ({ title, content: p.content, categories: p.categories, tpl: templates(p.content).find((t) => !/navbox|clr|quote|header/i.test(t.name)) ?? null }));
  const matches = new Map<string, FrMatch>();
  const stats: Record<string, number> = {};
  const add = (d: Draft, f: FrPage, how: string, name = f.title) => {
    if (matches.has(d.id)) return;
    const desc = clean(f.tpl?.params.description);
    matches.set(d.id, { id: d.id, fr: name.replace(/\s*\(.*\)$/, ''), how, page: f.title, description: desc || undefined });
    stats[how] = (stats[how] ?? 0) + 1;
  };
  const drafts = [...ctx.drafts.values()];
  const byDomain = (dom: string, cat?: RegExp) => drafts.filter((d) => d.domain === dom && (!cat || cat.test(d.categorie)));
  const matchedFr = new Set<string>();

  /** Appariement par clé : unique des deux côtés. */
  const byKey = (frs: FrPage[], frKey: (f: FrPage) => string | null, ens: Draft[], enKey: (d: Draft) => string | null, how: string) => {
    const E = new Map<string, Draft[]>();
    for (const d of ens) { const k = enKey(d); if (k) E.set(k, [...(E.get(k) ?? []), d]); }
    const F = new Map<string, FrPage[]>();
    for (const f of frs) { if (matchedFr.has(f.title)) continue; const k = frKey(f); if (k) F.set(k, [...(F.get(k) ?? []), f]); }
    for (const [k, fs] of F) {
      const es = E.get(k);
      if (fs.length === 1 && es?.length === 1 && !matches.has(es[0].id)) { add(es[0], fs[0], how); matchedFr.add(fs[0].title); }
    }
  };
  const tplIs = (f: FrPage, re: RegExp) => !!f.tpl && re.test(f.tpl.name);

  // 0. Titre identique (noms propres : personnages, lieux)
  const enByKey = new Map(drafts.map((d) => [key(d.nom_en), d]));
  for (const f of fr) {
    const d = enByKey.get(key(f.title));
    if (d && !matches.has(d.id)) { add(d, f, 'titre identique'); matchedFr.add(f.title); }
  }
  // 0b. Alignement manuel des titres (scripts/i18n/fr-alignement.json)
  const manual: Record<string, string> = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'i18n', 'fr-alignement.json'), 'utf8'));
  const exact = new Map<string, Draft>();
  for (const d of drafts) { exact.set(key(d.page.title), d); if (!exact.has(key(d.nom_en))) exact.set(key(d.nom_en), d); }
  for (const f of fr) {
    const en = manual[f.title];
    const d = en ? exact.get(key(en)) : undefined;
    if (d && !matches.has(d.id)) { add(d, f, 'alignement manuel des titres'); matchedFr.add(f.title); }
    else if (en && !d) ctx.warnings.push(`Alignement FR sans fiche EN : ${f.title} → ${en}`);
  }
  // 1. Plats : vente|santé|énergie
  byKey(fr.filter((f) => tplIs(f, /^infobox food$/i)), (f) => `${num(f.tpl!.params.sell)}|${num(f.tpl!.params.health)}|${num(f.tpl!.params.energy)}`, byDomain('cuisine', /Plat/), (d) => `${d.prix?.base}|${d.extra.sante}|${d.extra.energie}`, 'empreinte plat (prix, santé, énergie)');
  // 2. Cultures : vente|prix graine, puis vente|saisons
  byKey(fr.filter((f) => tplIs(f, /^culture$/i)), (f) => `${num(f.tpl!.params.vente)}|${num(f.tpl!.params.prix_graine)}`, byDomain('cultures').filter((d) => d.extra.prix_graine != null), (d) => `${d.prix?.base}|${d.extra.prix_graine}`, 'empreinte culture (prix, prix graine)');
  byKey(fr.filter((f) => tplIs(f, /^culture$/i)), (f) => `${num(f.tpl!.params.vente)}|${frSeasons(f.tpl!.params.saison).join(',')}`, [...byDomain('cultures'), ...byDomain('arbres'), ...byDomain('cueillette')], (d) => `${d.prix?.base}|${d.saisons.join(',')}`, 'empreinte culture (prix, saisons)');
  // 3. Produits artisanaux : vente|bronze|argent|or|osmium
  byKey(fr.filter((f) => tplIs(f, /^infobox artisan product$/i)), (f) => ['sell', 'bronze', 'silver', 'gold', 'osmium'].map((k) => num(f.tpl!.params[k])).join('|'), byDomain('artisanat', /Produit/), (d) => [d.prix?.base, d.prix?.bronze, d.prix?.silver, d.prix?.gold, d.prix?.osmium].join('|'), 'empreinte produit artisanal (prix par qualité)');
  // 4. Équipements / objets : vente|taille|description courte numérique
  byKey(fr.filter((f) => tplIs(f, /^infobox (equipment|item|building)$/i)), (f) => `${num(f.tpl!.params.sell)}|${clean(f.tpl!.params.size)}|${clean(f.tpl!.params.inputslot)}`, drafts.filter((d) => d.infobox && /equipment|item|building/i.test(d.infobox.name)), (d) => `${num(d.infobox!.params.sell)}|${clean(d.infobox!.params.size)}|${clean(d.infobox!.params.inputslot)}`, 'empreinte équipement (prix, taille, emplacements)');
  // 5. Personnages : anniversaire
  byKey(fr.filter((f) => tplIs(f, /^fiche personnage$/i)), (f) => { const a = clean(f.tpl!.params.anniversaire).toLowerCase(); const day = /(\d{1,2})/.exec(a)?.[1]; const s = frSeasons(a)[0]; return day && s ? `${s}|${Number(day)}` : null; }, byDomain('pnj'), (d) => (d.extra.anniversaire ? `${d.extra.anniversaire.saison}|${d.extra.anniversaire.jour}` : null), 'anniversaire identique');

  // 6. Propagation : ingrédients des recettes alignées (même nombre, mêmes quantités)
  const learned = new Map<string, Map<string, number>>();
  for (const m of [...matches.values()]) {
    const f = fr.find((x) => x.title === m.page)!;
    const d = ctx.drafts.get(m.id)!;
    const frLists = [...findTemplates(f.content, 'Recipe').map((t) => t.params.items ?? ''), f.tpl?.params.craft ?? ''].filter(Boolean);
    const enLists = [...findTemplates(d.page.content, 'Recipe').map((t) => t.params.items ?? ''), d.infobox?.params.craft ?? ''].filter(Boolean);
    const parse = (s: string) => s.replace(/\{\{\s*icon list\s*\|([^}]*)\}\}/gi, '$1').replace(/\{\{\s*icon\s*\|([^}|]*)\|?(\d*)[^}]*\}\}/gi, (_, a, n) => (n ? `${a}*${n}` : a)).split(/\s*[;\n]\s*/).map((x) => x.trim()).filter(Boolean).map((x) => { const [n, q] = x.split('*'); return { n: clean(n), q: (q ?? '1').trim() }; });
    for (let i = 0; i < Math.min(frLists.length, enLists.length); i++) {
      const a = parse(frLists[i]);
      const b = parse(enLists[i]);
      if (a.length !== b.length || a.some((x, k) => x.q !== b[k].q)) continue;
      a.forEach((x, k) => {
        const id = ctx.ref(b[k].n, false);
        if (!id || /^(tout|toute|tous|n'importe)/i.test(x.n)) return;
        const mm = learned.get(id) ?? new Map();
        mm.set(x.n, (mm.get(x.n) ?? 0) + 1);
        learned.set(id, mm);
      });
    }
  }
  for (const [id, mm] of learned) {
    if (matches.has(id)) continue;
    const best = [...mm].sort((a, b) => b[1] - a[1]);
    if (best.length > 1 && best[0][1] === best[1][1]) continue; // ambigu
    const name = best[0][0];
    if (name.includes('//') || ctx.drafts.get(id)?.domain === 'groupes') continue;
    matches.set(id, { id, fr: name.charAt(0).toUpperCase() + name.slice(1), how: 'recette alignée', page: '' });
    stats['recette alignée'] = (stats['recette alignée'] ?? 0) + 1;
  }
  const unmatched = fr.filter((f) => !matchedFr.has(f.title) && f.tpl && !/navbox/i.test(f.tpl.name)).map((f) => f.title);
  return { matches, stats, frPages: fr.length, unmatched };
}

/** Données chiffrées FR vs EN pour les fiches appariées : signale les écarts (conflits). */
export function crossCheck(ctx: Ctx, matches: Map<string, FrMatch>) {
  const file = join(CACHE_DIR, 'fr', 'pages.json');
  const raw: Record<string, { content: string }> = JSON.parse(readFileSync(file, 'utf8'));
  let checked = 0;
  let agree = 0;
  const verif: any[] = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'i18n', 'verifications.json'), 'utf8')).verifications;
  for (const m of matches.values()) {
    if (!m.page) continue;
    const d = ctx.drafts.get(m.id)!;
    const t = templates(raw[m.page].content).find((x) => !/navbox/i.test(x.name));
    if (!t) continue;
    const P = t.params;
    const checks: [string, unknown, unknown][] = [];
    if (/culture/i.test(t.name)) {
      checks.push(['prix.base', d.prix?.base, num(P.vente)]);
      checks.push(['saisons', d.saisons.join(','), frSeasons(P.saison).join(',')]);
      const pousse = num(P.pousse);
      if (pousse != null) checks.push(['croissance', d.extra.croissance, pousse]);
      checks.push(['rang_ville', d.extra.rang_ville, clean(P.rang) || null]);
    } else if (/fiche personnage/i.test(t.name)) {
      const a = clean(P.anniversaire);
      if (a && d.extra.anniversaire) checks.push(['anniversaire', `${d.extra.anniversaire.saison} ${d.extra.anniversaire.jour}`, `${frSeasons(a)[0]} ${num(a)}`]);
    } else if (P.sell) checks.push(['prix.base', d.prix?.base, num(P.sell)]);
    for (const [champ, en, frv] of checks) {
      if (frv == null || frv === '' || en == null) continue;
      checked++;
      if (String(en) === String(frv)) { agree++; d.extra._confirme = [...(d.extra._confirme ?? []), champ]; continue; }
      const v = verif.find((x) => x.id === d.id && x.champ === champ);
      if (v) {
        ctx.conflict({ id: d.id, champ, valeurs: [{ source: 'Fandom EN', valeur: en }, { source: 'Fandom FR', valeur: frv }, ...v.sources.map((u: string) => ({ source: u, valeur: v.valeur }))], retenu: v.valeur, raison: v.note });
        if (v.confiance === 'basse') d.a_verifier.add(champ);
        else d.extra._confirme = [...(d.extra._confirme ?? []), champ];
        for (const u of v.sources) if (!d.sources.some((s) => s.url === u)) d.sources.push({ name: new URL(u).hostname.replace(/^www\./, ''), url: u });
        continue;
      }
      ctx.conflict({ id: d.id, champ, valeurs: [{ source: 'Fandom EN', valeur: en }, { source: 'Fandom FR', valeur: frv }], retenu: en, raison: 'Wiki EN plus actif et plus récent (révisions 2024-2026) ; wiki FR peu maintenu (valeurs souvent antérieures aux rééquilibrages de prix).' });
    }
    d.sources.push({ name: 'Wiki Coral Island (Fandom FR)', url: frUrl(m.page) });
  }
  return { checked, agree };
}

export { seasons };
