// Personnages : emploi du temps, événements de cœur, sorties (hangouts), lettres.
import { findTemplates, links, plain, templates } from '../lib/wikitext.ts';
import { Ctx, fandomSource, type Draft } from './ctx.ts';
import { clean, num, timeTpl } from './norm.ts';
import { parseItemList } from './relations.ts';

function hour(v: string | undefined): number | null {
  const s = clean(v);
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]) + Number(m[2] ?? 0) / 60;
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  return h;
}

/** {{Schedule}} regroupés par titre de section (« Regular schedule », « Summer », « Rainy or stormy »…). */
export function schedule(ctx: Ctx, d: Draft) {
  const c = d.page.content;
  const heads = [...c.matchAll(/^(=+)\s*([^=].*?)\s*\1\s*$/gm)].map((m) => ({ level: m[1].length, title: m[2], index: m.index! }));
  const out: any[] = [];
  for (const t of findTemplates(c, 'Schedule')) {
    const path: string[] = [];
    for (const h of heads) {
      if (h.index > t.start) break;
      path.length = Math.max(0, h.level - 2);
      path[h.level - 2] = h.title;
    }
    const cond = path.filter((x) => x && !/^schedule$/i.test(x)).join(' › ') || 'Habituel';
    const groups: any[] = [];
    for (let g = 1; t.params[`${g}_name`] !== undefined || t.params[`${g}_1_time`] !== undefined; g++) {
      const steps: any[] = [];
      for (let s = 1; t.params[`${g}_${s}_time`] !== undefined; s++) {
        steps.push({ heure: hour(t.params[`${g}_${s}_time`]), texte: clean(t.params[`${g}_${s}_info`]) });
        for (const l of links(t.params[`${g}_${s}_info`] ?? '')) { const id = ctx.ref(l, false); if (id) d.liens.add(id); }
      }
      groups.push({ jours: clean(t.params[`${g}_name`]) || 'Tous les jours', etapes: steps });
    }
    if (groups.length) out.push({ condition: cond, groupes: groups });
  }
  if (out.length) d.extra.emploi_du_temps = out;
  else if (d.categorie === 'Habitant') d.a_verifier.add('emploi_du_temps');
}

/** Sous-pages « X/Events », « X/Letters », « Hangout Events/X ». */
export function subpages(ctx: Ctx, d: Draft) {
  const name = d.page.title;
  const ev = ctx.pages.get(`${name}/Events`);
  if (ev) {
    d.sources.push({ ...fandomSource(ev), name: 'Coral Island Wiki (Fandom) — événements' });
    const hearts: any[] = [];
    for (const t of findTemplates(ev.content, 'Heart event')) {
      hearts.push({
        coeurs: num(t.params.hearts),
        condition: clean(t.params.day) || undefined,
        horaires: timeTpl(t.params.time),
        lieu: clean(t.params.location) || undefined,
        lieu_id: links(t.params.location ?? '').map((l) => ctx.ref(l, false)).find(Boolean) ?? undefined,
        resume_en: clean(t.params.summary) || undefined,
      });
    }
    hearts.sort((a, b) => (a.coeurs ?? 0) - (b.coeurs ?? 0));
    if (hearts.length) d.extra.evenements_coeur = hearts;
    const hang: any[] = [];
    for (const t of findTemplates(ev.content, 'Hangout event')) hang.push({ coeurs: num(t.params.heart), prerequis: clean(t.params.requirement) || undefined, resume_en: clean(t.params.summary) || undefined });
    if (hang.length) d.extra.sorties = hang;
    // Mariage / rendez-vous mentionnés dans des sections dédiées
    const wed = /==+\s*(Wedding|Marriage|Proposal)[^=]*==+([\s\S]*?)(?=\n==[^=]|$)/i.exec(ev.content);
    const wedTxt = wed ? plain(wed[2].replace(/\{\{Dialogue start[\s\S]*?\{\{Dialogue end\}\}/g, '')).split('\n').filter((l) => l.trim().length > 20 && !/^[:;=]/.test(l.trim())).join(' ').slice(0, 800) : '';
    if (wedTxt && !/(:\s*){3}/.test(wedTxt)) d.extra.mariage_en = wedTxt;
  }
  const hp = ctx.pages.get(`Hangout Events/${name}`);
  if (hp && !d.extra.sorties) {
    const hang: any[] = [];
    for (const t of findTemplates(hp.content, 'Hangout event')) hang.push({ coeurs: num(t.params.heart), prerequis: clean(t.params.requirement) || undefined, resume_en: clean(t.params.summary) || undefined });
    if (hang.length) d.extra.sorties = hang;
  }
  const lp = ctx.pages.get(`${name}/Letters`);
  if (lp) {
    const letters: any[] = [];
    for (const t of findTemplates(lp.content, 'Letter')) {
      const att = parseItemList(ctx, t.params.attachment).items;
      letters.push({ titre: clean(t.params.title) || undefined, texte_en: clean(t.params.content), pieces_jointes: att.length ? att : undefined });
    }
    if (letters.length) d.extra.lettres = letters;
  }
  if (ctx.pages.get(`${name}/Dialogue`)) d.extra.a_des_dialogues = true;

  // Mariage : section du personnage (mariables)
  if (d.extra.mariable) {
    const m = /==+\s*(Marriage|Romance|Dating)[^=]*==+([\s\S]*?)(?=\n==[^=]|$)/i.exec(d.page.content);
    if (m) d.extra.romance_en = plain(m[2]).slice(0, 1200);
  }
}

export { templates };
