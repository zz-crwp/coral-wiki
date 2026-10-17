// Seconde source : guide Steam « NPC Birthdays & Loved Gifts » (mis à jour le 02/05/2026).
// Contrôle les anniversaires et les cadeaux adorés des PNJ.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR } from '../lib/api.ts';
import { key } from '../lib/load.ts';
import type { Ctx } from './ctx.ts';

export const GUIDE_URL = 'https://steamcommunity.com/sharedfiles/filedetails/?id=2878989571';

type Row = { name: string; birthday: { saison: string; jour: number } | null; loves: string[] };

export function parseGuide(): Row[] {
  const f = join(CACHE_DIR, 'steam', 'guide-birthdays.html');
  if (!existsSync(f)) return [];
  const html = readFileSync(f, 'utf8');
  const start = html.indexOf('subSectionDesc');
  const text = html
    .slice(start)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?(div|li|tr|td|th|ul|table|b|h\d)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  let cur: Row | null = null;
  let inLoves = false;
  for (const l of lines) {
    const head = /^[^\p{L}\d]*([A-Z][A-Z .'\-]{1,30}[A-Z])[^\p{L}\d]*$/u.exec(l);
    if (head && /\p{Extended_Pictographic}/u.test(l)) {
      if (cur) rows.push(cur);
      cur = { name: head[1].trim(), birthday: null, loves: [] };
      inLoves = false;
      continue;
    }
    if (!cur) continue;
    if (/^Suggested Gifts|^Unknown Birthdays/i.test(l) || /Suggested Gifts/.test(l)) { rows.push(cur); cur = null; continue; }
    if (/^https?:/.test(l) || /^(Birthday|Profile)$/i.test(l)) continue;
    if (/^Loves$/i.test(l)) { inLoves = true; continue; }
    const b = /^(Spring|Summer|Fall|Winter)\s+(\d{1,2})$/i.exec(l);
    if (b) { cur.birthday = { saison: b[1].toLowerCase(), jour: Number(b[2]) }; continue; }
    if (inLoves && l.length < 40) cur.loves.push(l);
  }
  if (cur) rows.push(cur);
  return rows.filter((r) => r.birthday || r.loves.length);
}

/** Compare au wiki : anniversaire exact ; cadeaux adorés (objets nommés) présents chez nous en « love ». */
export function crossCheckGuide(ctx: Ctx) {
  const rows = parseGuide();
  const stats = { pnj: 0, anniversaires_ok: 0, anniversaires_ko: 0, cadeaux_ok: 0, cadeaux_ko: 0, cadeaux_non_resolus: 0 };
  for (const r of rows) {
    const id = ctx.ref(r.name.charAt(0) + r.name.slice(1).toLowerCase(), false) ?? ctx.ref(r.name, false);
    const d = id ? ctx.drafts.get(id) : undefined;
    if (!d || d.domain !== 'pnj') continue;
    stats.pnj++;
    if (!d.sources.some((s) => s.url === GUIDE_URL)) d.sources.push({ name: 'Guide Steam « NPC Birthdays & Loved Gifts » (02/05/2026)', url: GUIDE_URL });
    const ours = d.extra.anniversaire;
    if (r.birthday && ours) {
      if (ours.saison === r.birthday.saison && ours.jour === r.birthday.jour) { stats.anniversaires_ok++; d.extra._confirme = [...(d.extra._confirme ?? []), 'anniversaire']; }
      else {
        stats.anniversaires_ko++;
        ctx.conflict({ id: d.id, champ: 'anniversaire', valeurs: [{ source: 'Fandom EN', valeur: `${ours.saison} ${ours.jour}` }, { source: GUIDE_URL, valeur: `${r.birthday.saison} ${r.birthday.jour}` }], retenu: `${ours.saison} ${ours.jour}`, raison: 'Wiki EN retenu par défaut ; à confirmer en jeu (calendrier du Community Center).' });
        d.a_verifier.add('anniversaire');
      }
    } else if (r.birthday && !ours) {
      d.extra.anniversaire = r.birthday;
      d.extra.anniversaire_source = GUIDE_URL;
      d.a_verifier.delete('anniversaire');
    }
    const loves = new Set(d.extra.cadeaux?.love ?? []);
    for (const g of r.loves) {
      if (/^(any|all)\b/i.test(g)) continue; // groupes : formulations non comparables 1:1
      const item = ctx.ref(g, false);
      if (!item) { stats.cadeaux_non_resolus++; continue; }
      const it = ctx.drafts.get(item);
      const universalLove = it?.extra.cadeau_universel === 'love' && !Object.values(it.aime_par).some((s) => s.has(d.id));
      if (loves.has(item) || universalLove) stats.cadeaux_ok++;
      else {
        stats.cadeaux_ko++;
        const lvl = Object.entries(it?.aime_par ?? {}).find(([, s]) => s.has(d.id))?.[0] ?? (it?.extra.cadeau_universel ? `${it.extra.cadeau_universel} (universel)` : 'non renseigné');
        ctx.conflict({ id: d.id, champ: `cadeau:${item}`, valeurs: [{ source: 'Fandom EN', valeur: lvl }, { source: GUIDE_URL, valeur: 'love' }], retenu: lvl, raison: 'Divergence sur un cadeau adoré ; wiki EN retenu (fiche objet), à confirmer en jeu.' });
      }
    }
  }
  return stats;
}

export { key };
