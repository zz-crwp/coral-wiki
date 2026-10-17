// Relations entre entités : recettes, cadeaux, magasins, butins, artisanat, graines.
import type { Page } from '../lib/load.ts';
import { findTemplates, links, plain, sections, subsections, templates, type Template } from '../lib/wikitext.ts';
import { Ctx, type Draft } from './ctx.ts';
import { clean, list, num, rank, seasons } from './norm.ts';

export type Qty = { id: string; n: number; qualite?: number };

/** « Wood*10;Stone*10 ; Koi*1/2 » → [{id, n, qualite}] (non résolus → rapportés). */
export function parseItemList(ctx: Ctx, raw: string | undefined, delim = /\s*;\s*/): { items: Qty[]; unresolved: string[] } {
  const items: Qty[] = [];
  const unresolved: string[] = [];
  if (!raw) return { items, unresolved };
  // {{Icon list|A*1;B*2}} → contenu
  const inner = raw.replace(/\{\{\s*icon list\s*\|([^}]*)\}\}/gi, '$1').replace(/\{\{\s*icon\s*\|([^}|]*)(?:\|(\d+))?[^}]*\}\}/gi, (_, a, n) => (n ? `${a}*${n}` : a));
  for (const part of inner.split(delim)) {
    const s = plain(part).trim();
    if (!s) continue;
    const m = /^(.*?)\s*(?:\*\s*([\d.,]+))?\s*(?:\/\s*(\d))?\s*$/.exec(s)!;
    const name = m[1].trim();
    const id = ctx.ref(name);
    if (id) items.push({ id, n: m[2] ? Number(m[2].replace(',', '')) : 1, ...(m[3] ? { qualite: Number(m[3]) } : {}) });
    else unresolved.push(name);
  }
  return { items, unresolved };
}

/** {{Recipe|items=…|medium=…|time=…|yield=…}} sur la page du produit. */
export function recipes(ctx: Ctx, d: Draft) {
  for (const t of findTemplates(d.page.content, 'Recipe')) {
    const { items, unresolved } = parseItemList(ctx, t.params.items);
    if (!items.length && !unresolved.length) continue;
    const medium = clean(t.params.medium) || clean(d.infobox?.params.utensil);
    const rec = {
      ingredients: items,
      non_resolus: unresolved.length ? unresolved : undefined,
      outil: medium ? (ctx.ref(medium, false) ?? medium) : undefined,
      duree: clean(t.params.time) || undefined,
      rendement: num(t.params.yield) ?? undefined,
    };
    (d.extra.recettes ??= []).push(rec);
    for (const i of items) ctx.usedIn(i.id, d.id);
    const u = typeof rec.outil === 'string' ? ctx.drafts.get(rec.outil) : undefined;
    if (u && !(u.extra.recettes_associees ??= []).includes(d.id)) u.extra.recettes_associees.push(d.id);
  }
  // Infobox equipment « craft = {{Icon|Stone|199}} »
  const craft = d.infobox?.params.craft;
  if (craft && !d.extra.recettes) {
    const { items, unresolved } = parseItemList(ctx, craft, /\s*(?:;|<br\s*\/?>|\n)\s*/i);
    if (items.length) {
      d.extra.recettes = [{ ingredients: items, non_resolus: unresolved.length ? unresolved : undefined }];
      for (const i of items) ctx.usedIn(i.id, d.id);
    }
  }
}

const ORDER = ['love', 'like', 'neutral', 'dislike', 'hate'] as const;

/** {{Gifted item}} : préférences de cadeaux, logique identique au Module:Gifted item. */
export function gifts(ctx: Ctx, d: Draft, characters: string[]) {
  const t = findTemplates(d.page.content, 'Gifted item')[0];
  if (!t) return;
  const seen = new Map<string, string>();
  const levels: Record<string, Set<string>> = {};
  const universal: string[] = [];
  for (const lvl of ORDER) {
    const v = clean(t.params[lvl]);
    if (!v) continue;
    if (v.toLowerCase() === 'universal') {
      universal.push(lvl);
      continue;
    }
    for (const name of v.split(/\s*[;,]\s*/)) {
      const n = name.trim();
      if (!n) continue;
      if (seen.has(n) && seen.get(n) !== lvl) {
        ctx.conflict({ id: d.id, champ: `cadeau:${n}`, valeurs: [{ source: 'Fandom', valeur: seen.get(n) }, { source: 'Fandom', valeur: lvl }], retenu: seen.get(n), raison: 'Personnage listé à deux niveaux sur la même page ; premier niveau retenu (comportement du module du wiki).' });
        continue;
      }
      seen.set(n, lvl);
      const id = ctx.ref(n);
      if (id) (levels[lvl] ??= new Set()).add(id);
    }
  }
  // Niveau « universel » : s'applique à tous les personnages non listés explicitement (calculé côté app).
  if (universal.length) d.extra.cadeau_universel = universal[0];
  for (const [lvl, ids] of Object.entries(levels)) {
    d.aime_par[lvl] = ids;
    for (const npc of ids) {
      const n = ctx.drafts.get(npc);
      if (!n) continue;
      ((n.extra.cadeaux ??= {})[lvl] ??= []).push(d.id);
    }
  }
}

/**
 * {{Shop|cols=Town rank;Season|Item; prix; rang; saison}} sur une page de lieu.
 * Ajoute au lieu `extra.stock` et à l'objet `extra.vendu_par`.
 */
export function shops(ctx: Ctx, d: Draft) {
  const secs = sections(d.page.content);
  const out: any[] = [];
  for (const [secTitle, body] of Object.entries(secs)) {
    for (const [subTitle, sub] of Object.entries(subsections(body))) {
      for (const t of findTemplates(sub, 'Shop')) {
        const cols = ['item', 'prix', ...(t.params.cols ? t.params.cols.split(/\s*;\s*/).map((c) => c.toLowerCase()) : [])];
        const currency = clean(t.params.currency) || 'Coin';
        for (const [k, raw] of Object.entries(t.params)) {
          if (!/^\d+$/.test(k)) continue;
          const cells = raw.split(/\s*;\s*/);
          const name = plain(cells[0].replace(/\{.*?\}/g, '')).replace(/\*\s*\d+$/, '').trim();
          if (!name) continue;
          const id = ctx.ref(name);
          const row: any = { item: id ?? null, nom: id ? undefined : name, prix: num(cells[1]), devise: currency === 'Coin' ? 'or' : currency, rayon: subTitle || secTitle || undefined };
          cols.slice(2).forEach((c, i) => {
            const v = cells[i + 2];
            if (!v) return;
            if (/town rank|rank/.test(c)) row.rang = rank(v);
            else if (/season/.test(c)) {
              row.saisons = seasons(v);
              const y = /year\s*(\d+)/i.exec(v);
              if (y) row.annee_min = Number(y[1]);
            } else (row.conditions ??= []).push(`${c}: ${clean(v)}`);
          });
          out.push(row);
          if (id) {
            const it = ctx.drafts.get(id);
            if (it) {
              (it.extra.vendu_par ??= []).push({ lieu: d.id, prix: row.prix, devise: row.devise, rang: row.rang, saisons: row.saisons });
              d.liens.add(id);
            }
          }
        }
      }
    }
  }
  if (out.length) d.extra.stock = out;
}

/** {{Loot|Item;20%}} (monstres) et {{Chest|Item;9.68%;10}} (géodes, coffres, poubelles). */
export function drops(ctx: Ctx, d: Draft) {
  for (const name of ['Loot', 'Chest']) {
    for (const t of findTemplates(d.page.content, name)) {
      const cols = ['item', 'chance', ...(t.params.cols ? t.params.cols.split(/\s*;\s*/).map((c) => c.toLowerCase()) : [])];
      const rows: any[] = [];
      for (const [k, raw] of Object.entries(t.params)) {
        if (!/^\d+$/.test(k)) continue;
        const cells = raw.split(/\s*;\s*/);
        const id = ctx.ref(plain(cells[0]));
        const row: any = { item: id, nom: id ? undefined : plain(cells[0]).trim(), chance: clean(cells[1]) };
        cols.slice(2).forEach((c, i) => {
          if (cells[i + 2] == null) return;
          if (/amount/.test(c)) row.quantite = clean(cells[i + 2]);
          else if (/rank/.test(c)) row.rang = rank(cells[i + 2]);
          else (row.conditions ??= []).push(`${c}: ${clean(cells[i + 2])}`);
        });
        rows.push(row);
        if (id) {
          const it = ctx.drafts.get(id);
          if (it) (it.extra.obtenu_de ??= []).push({ source: d.id, chance: row.chance, rang: row.rang });
          d.liens.add(id);
        }
      }
      if (rows.length) (d.extra.butin ??= []).push(...rows);
    }
  }
}

/** Produits artisanaux : machine + intrants. Graines ↔ cultures. Animaux ↔ produits. */
export function production(ctx: Ctx, d: Draft) {
  if (d.extra.machine_brut) {
    const m = ctx.ref(d.extra.machine_brut);
    if (m) {
      d.extra.machine = m;
      const md = ctx.drafts.get(m);
      if (md && !(md.extra.produits ??= []).includes(d.id)) md.extra.produits.push(d.id);
    }
    const inputs = d.extra.entree_brut ? d.extra.entree_brut.split(/\s*(?:;|•|,| or )\s*/) : [];
    const ids = inputs.map((x: string) => ctx.ref(x.replace(/^\d+\s*x?\s*/i, ''))).filter(Boolean) as string[];
    if (ids.length) {
      d.extra.intrants = ids;
      for (const i of ids) ctx.usedIn(i, d.id);
    }
  }
  if (d.extra.graine_brut) {
    const s = ctx.ref(d.extra.graine_brut);
    if (s) {
      d.extra.graine = s;
      const sd = ctx.drafts.get(s);
      if (sd) {
        sd.extra.donne = d.id;
        sd.utilise_dans.add(d.id);
        if (!sd.saisons.length) sd.saisons = [...d.saisons];
      }
    }
  }
  if (d.extra.produit_brut && d.categorie === 'Animal') {
    const ids = (d.extra.produit_brut as string[]).flatMap((x) => x.split(/\s*(?:,|•| or )\s*/)).map((x) => ctx.ref(x)).filter(Boolean) as string[];
    d.extra.produits = ids;
    for (const i of ids) {
      const p = ctx.drafts.get(i);
      if (p) p.extra.produit_par = [...new Set([...(p.extra.produit_par ?? []), d.id])];
    }
  }
  if (d.extra.butin_brut) {
    const ids = (d.extra.butin_brut as string[]).map((x) => ctx.ref(x)).filter(Boolean) as string[];
    if (!d.extra.butin) d.extra.butin = ids.map((id) => ({ item: id }));
    for (const id of ids) {
      const it = ctx.drafts.get(id);
      if (it && !(it.extra.obtenu_de ?? []).some((o: any) => o.source === d.id)) (it.extra.obtenu_de ??= []).push({ source: d.id });
    }
  }
  delete d.extra.butin_brut;
}

/** Groupes d'objets (« Any fish ») : membres via `item_group` des infobox. */
export function groups(ctx: Ctx, d: Draft) {
  for (const g of d.extra.groupes_bruts ?? []) {
    const id = ctx.ref(`${g} (group)`, false) ?? ctx.ref(`Any ${g}`, false) ?? ctx.ref(g, false);
    if (!id || id === d.id) continue;
    const gd = ctx.drafts.get(id);
    if (!gd || gd.domain !== 'groupes') continue;
    (d.extra.groupes ??= []).push(id);
    (gd.extra.membres ??= []).push(d.id);
  }
  delete d.extra.groupes_bruts;
}

export function linksFromText(ctx: Ctx, d: Draft) {
  for (const l of links(d.page.content)) {
    const id = ctx.ref(l, false);
    if (id && id !== d.id) d.liens.add(id);
  }
}

export { templates, type Template, type Page };
