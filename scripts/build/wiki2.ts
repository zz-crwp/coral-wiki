// Recoupement avec la seconde source : coralisland.wiki (CC0), extrait dans scripts/sources/coralisland-wiki.json.
// Règle : en cas de désaccord, la valeur la plus récente l'emporte (Fandom, mis à jour pour la 1.3, sauf preuve contraire) ;
// la seconde source confirme (confiance haute) ou complète un champ absent ; chaque écart va dans conflits.json.
import { existsSync, readFileSync } from 'node:fs';
import { Ctx } from './ctx.ts';
import { num, seasons, times, weather } from './norm.ts';

const FILE = 'scripts/sources/coralisland-wiki.json';
const ALIAS: Record<string, string> = {
  "Sam's General Store": 'sams-general-store',
  "Sunny's Beach Shack": 'beach-shack',
  "Ben's Caravan": 'caravan',
  Clinics: 'clinic',
  'Fishensips (Tavern)': 'fishensips',
  'Furniture (Shop)': 'furniture-store',
  'Lings Lab': 'laboratory',
  'Raja Coffee Corner': 'rajas-coffee-corner',
  'Socket Electronics': 'socket-and-pan',
  Blacksmith: 'sanchez-brothers-blacksmith',
  'B.O.S Guild': 'band-of-smiles',
  'General Shop': 'merfolk-general-store',
  'Underwater Furniture Store': 'sales-cart-stall',
  'Lady Lavanna store': 'savannah-ranch',
  'Princess Miranjani': 'miranjani',
  'King Krakatoa': 'krakatoa',
  'Queen Nanda Devi': 'nanda-devi',
};

export type Wiki2Report = {
  source: any;
  compares: number;
  concordants: number;
  divergents: number;
  completes: number;
  parDomaine: Record<string, { entites: number; champs: number; ok: number; ecarts: number; completes: number }>;
  nonApparies: string[];
};

const norm = (v: string) => v.toLowerCase().replace(/\s*(&|and|,)\s*/g, ' + ').replace(/\s+/g, ' ').trim();
const eqSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function crossCheckWiki2(ctx: Ctx): Wiki2Report | null {
  if (!existsSync(FILE)) return null;
  const w = JSON.parse(readFileSync(FILE, 'utf8'));
  const src = (rev: string) => ({ name: 'Coral Island Wiki (coralisland.wiki, CC0)', url: w.source.url, date: rev.slice(0, 10) });
  const rep: Wiki2Report = { source: w.source, compares: 0, concordants: 0, divergents: 0, completes: 0, parDomaine: {}, nonApparies: [] };
  const stat = (dom: string) => (rep.parDomaine[dom] ??= { entites: 0, champs: 0, ok: 0, ecarts: 0, completes: 0 });
  const id = (titre: string) => ALIAS[titre] ?? ctx.ref(titre, false);

  /** Compare un champ : concordant → confirmé ; absent chez nous → complété ; sinon écart (Fandom retenu, plus récent). */
  function check(dom: string, eid: string, champ: string, ours: unknown, theirs: unknown, rev: string, fill?: (v: any) => void, same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)) {
    if (theirs == null || (Array.isArray(theirs) && !theirs.length) || theirs === '') return;
    const d = ctx.drafts.get(eid)!;
    const s = stat(dom);
    s.champs++;
    rep.compares++;
    if (ours == null || (Array.isArray(ours) && !ours.length)) {
      if (fill) {
        fill(theirs);
        d.a_verifier.delete(champ);
        s.completes++;
        rep.completes++;
        ctx.conflict({ id: eid, champ, valeurs: [{ source: 'Fandom', valeur: null }, { source: `coralisland.wiki (rév. ${rev.slice(0, 10)})`, valeur: theirs }], retenu: theirs, raison: 'Absent du wiki Fandom : valeur de la seconde source reprise (CC0).' });
      }
      return;
    }
    if (same(ours, theirs)) {
      s.ok++;
      rep.concordants++;
      (d.extra._confirme ??= []).push(`${champ} (coralisland.wiki)`);
      return;
    }
    s.ecarts++;
    rep.divergents++;
    const fandomDate = d.page.timestamp?.slice(0, 10) ?? '';
    const newer = rev.slice(0, 10) > fandomDate;
    ctx.conflict({
      id: eid,
      champ,
      valeurs: [
        { source: `Fandom (rév. ${fandomDate})`, valeur: ours },
        { source: `coralisland.wiki (rév. ${rev.slice(0, 10)})`, valeur: theirs },
      ],
      retenu: ours,
      raison: newer
        ? 'Seconde source plus récente mais isolée : valeur Fandom conservée, à vérifier en jeu.'
        : 'Valeur Fandom retenue (page plus récente, à jour de la version 1.3).',
    });
    if (newer) d.a_verifier.add(champ);
  }
  const addSource = (eid: string, rev: string) => {
    const d = ctx.drafts.get(eid)!;
    if (!d.sources.some((s) => s.url === w.source.url)) d.sources.push(src(rev));
    stat(String(d.domain)).entites++;
  };

  // Personnages : anniversaire, cadeaux adorés et détestés
  for (const p of w.personnages) {
    const eid = id(p.titre);
    const d = eid && ctx.drafts.get(eid);
    if (!d || d.domain !== 'pnj') {
      rep.nonApparies.push(p.titre);
      continue;
    }
    addSource(eid, p.rev);
    const bd = d.extra.anniversaire;
    check('pnj', eid, 'anniversaire', bd ? `${bd.saison} ${bd.jour}` : null, p.anniversaire ? `${p.anniversaire.saison} ${p.anniversaire.jour}` : null, p.rev, () => (d.extra.anniversaire = p.anniversaire));
    for (const lv of ['love', 'hate'] as const) {
      const ours = new Set((d.extra.cadeaux?.[lv] ?? []) as string[]);
      const names: string[] = (p.cadeaux?.[lv] ?? []).filter((n: string) => !/^(all|any) |^nodes$|except/i.test(n));
      if (!names.length) continue;
      // Groupes (« Wine », « Kimchi », « Juice ») : couverts si Fandom liste au moins un membre de la famille
      const covered = (tid: string) => {
        if (ours.has(tid)) return true;
        const g = ctx.drafts.get(tid);
        // Cadeau universel (ex. « Trash », détesté par tous) : Fandom le note au niveau universel, pas par habitant
        if (g?.extra.cadeau_universel === lv) return true;
        if (g?.domain === 'groupes' && (g.extra.membres ?? []).some((m: string) => ours.has(m))) return true;
        return [...ours].some((o) => o.endsWith(`-${tid}`) || o.startsWith(`${tid}-`));
      };
      const ids = [...new Set(names.map((n) => ctx.ref(n, false)).filter(Boolean))] as string[];
      if (!ids.length) continue;
      const champ = `cadeaux ${lv === 'love' ? 'adorés' : 'détestés'}`;
      const extra = ids.filter((x) => !covered(x));
      const st = stat('pnj');
      st.champs++;
      rep.compares++;
      if (!extra.length) {
        st.ok++;
        rep.concordants++;
        (d.extra._confirme ??= []).push(`${champ} (coralisland.wiki)`);
        continue;
      }
      st.ecarts++;
      rep.divergents++;
      const fandomDate = d.page.timestamp?.slice(0, 10) ?? '';
      const newer = p.rev.slice(0, 10) > fandomDate;
      ctx.conflict({
        id: eid,
        champ,
        valeurs: [
          { source: `Fandom (rév. ${fandomDate})`, valeur: 'non listés' },
          { source: `coralisland.wiki (rév. ${p.rev.slice(0, 10)})`, valeur: extra },
        ],
        retenu: 'liste Fandom',
        raison: newer ? 'Objets cités seulement par la seconde source, plus récente : liste Fandom conservée, à vérifier en jeu.' : 'Objets cités seulement par la seconde source, plus ancienne : liste Fandom conservée.',
      });
      if (newer) d.a_verifier.add(champ);
    }
  }

  // Poissons : saisons, prix, météo, heures
  for (const c of w.captures) {
    const eid = id(c.titre);
    const d = eid && ctx.drafts.get(eid);
    if (!d || !['poissons', 'insectes', 'creatures-marines'].includes(String(d.domain))) {
      rep.nonApparies.push(c.titre);
      continue;
    }
    addSource(eid, c.rev);
    const dom = String(d.domain);
    const ss = Object.entries(c.saisons ?? {})
      .filter(([, v]) => /^1/.test(String(v)))
      .map(([k]) => k);
    check(dom, eid, 'saisons', d.saisons, ss, c.rev, undefined, (a, b) => eqSet(a, b));
    check(dom, eid, 'prix', d.prix?.base ?? null, num(c.prix), c.rev);
    // Météo et heures : la seconde source donne un résumé ; concordant si elle est incluse dans nos conditions
    if (c.meteo) check(dom, eid, 'météo', d.meteo, weather(c.meteo), c.rev, undefined, (a, b) => b.every((x: string) => a.includes(x)));
    if (c.heures) {
      const h = times(c.heures);
      check(dom, eid, 'heures', d.horaires, h, c.rev, undefined, (a, b) => b.every((r: any) => a.some((x: any) => x.from <= r.from && r.to <= x.to)));
    }
  }

  // Cultures : croissance, repousse, prix, graine, saison, rang
  for (const o of w.objets) {
    const eid = id(o.titre);
    const d = eid && ctx.drafts.get(eid);
    if (!d || !['cultures', 'arbres'].includes(String(d.domain)) || !o.croissance) {
      if (!d) rep.nonApparies.push(o.titre);
      continue;
    }
    addSource(eid, o.rev);
    const x = d.extra;
    check('cultures', eid, 'croissance', x.croissance ?? null, num(o.croissance), o.rev, (v) => (x.croissance = v));
    if (o.repousse) check('cultures', eid, 'repousse', x.repousse ?? null, num(o.repousse), o.rev, (v) => (x.repousse = v));
    check('cultures', eid, 'prix', d.prix?.base ?? null, num(o.prix), o.rev);
    if (o.prix_graine) check('cultures', eid, 'prix de la graine', x.prix_graine ?? null, num(o.prix_graine), o.rev, (v) => (x.prix_graine = v));
    if (o.saison) check('cultures', eid, 'saisons', d.saisons, seasons(o.saison), o.rev, undefined, (a, b) => eqSet(a, b));
    if (o.rang) check('cultures', eid, 'rang de la ville', x.rang_ville ?? null, o.rang.trim().toUpperCase(), o.rev);
  }

  // Magasins : jour de fermeture et prix des articles vendus contre de l'or
  for (const l of w.lieux) {
    const eid = id(l.titre);
    const d = eid && ctx.drafts.get(eid);
    if (!d || d.domain !== 'lieux') {
      rep.nonApparies.push(l.titre);
      continue;
    }
    addSource(eid, l.rev);
    // Fandom sans jour de fermeture mais ouvert les 7 jours : « aucun » (comparable)
    const allWeek = (d.extra.ouverture ?? []).some((o: any) => o.j?.length === 7);
    const oursClosed = (d.extra.ferme_le ?? '').toLowerCase() || (allWeek ? 'aucun' : null);
    if (l.ferme) check('lieux', eid, 'jour de fermeture', oursClosed, l.ferme.toLowerCase(), l.rev, undefined, (a, b) => norm(a) === norm(b) || norm(a).includes(norm(b).replace(/s$/, '')));
    const stock = (d.extra.stock ?? []) as any[];
    for (const r of l.stock) {
      const iid = ctx.ref(r.nom, false);
      const prix = num(r.cout);
      if (!iid || prix == null || /\*/.test(r.cout)) continue;
      const mine = stock.find((s) => s.item === iid && s.prix != null && !s.materiaux);
      if (!mine) continue;
      check('lieux', eid, `prix ${r.nom}`, mine.prix, prix, l.rev);
    }
  }
  return rep;
}
