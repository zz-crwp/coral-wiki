// Liens contextuels : rendre chaque fiche autosuffisante pour jouer.
//  - outil, bâtiment, équipement → ses améliorations / sa construction (magasin, or, matériaux, durée) ;
//  - matériau → les améliorations et constructions qui le consomment ;
//  - lieu → les poissons, insectes, créatures et cueillettes qu'on y trouve.
import { Ctx } from './ctx.ts';

/** Après traduction des lignes de stock : copie les lignes d'amélioration sur la fiche ciblée et sur les matériaux. */
export function upgradeLinks(ctx: Ctx) {
  for (const shop of ctx.drafts.values()) {
    if (shop.domain !== 'lieux') continue;
    for (const r of (shop.extra.stock ?? []) as any[]) {
      if (!r.materiaux?.length || !r.item) continue;
      const target = ctx.drafts.get(r.item);
      if (!target) continue;
      const { item, ...row } = r;
      (target.extra.ameliorations ??= []).push({ ...row, item, lieu: shop.id });
      for (const m of r.materiaux) {
        if (!m.item || m.item === r.item) continue; // l'outil remis lui-même n'est pas un « matériau »
        const mat = ctx.drafts.get(m.item);
        if (mat) (mat.extra.utilise_pour ??= []).push({ lieu: shop.id, item: r.item, nom: r.nom, n: m.n });
      }
    }
    // Amélioration de qualité des graines / du foin (Labo, Chambre de l'Oracle)
    const LV: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', osmium: 'Osmium' };
    for (const n of shop.extra.ameliorations_qualite?.niveaux ?? [])
      for (const c of n.couts)
        if (c.item) {
          const mat = ctx.drafts.get(c.item);
          if (mat) (mat.extra.utilise_pour ??= []).push({ lieu: shop.id, nom: `Qualité ${LV[n.niveau] ?? n.niveau} · ${c.pour}`, niveau: n.niveau, n: c.n });
        }
  }
}

const ZONE_ALIAS: Record<string, string> = { town: 'starlet-town', 'starlet town': 'starlet-town', 'deep forest': 'deep-forest', 'mid forest': 'mid-forest', vineyard: 'hillside-brewery-and-vineyard', fishensips: 'fishensips', 'trash cans': 'trash-can', 'royaume des ondins': 'merfolk-kingdom', "mayor's house": 'mayors-house' };
/** Zones dont le nom complet (avec parenthèses) désigne un lieu précis. */
const ZONE_FULL: Record<string, string> = { 'river (farm)': 'farm', 'river (forest)': 'forest', 'river (town)': 'starlet-town', 'ocean (beach)': 'ocean', 'ocean (dock)': 'ocean', 'ocean (lookout)': 'ocean' };
const CATCH = ['poissons', 'insectes', 'creatures-marines', 'cueillette'];

/** Avant traduction (noms anglais) : espèces trouvables dans chaque lieu, avec la sous-zone et les saisons. */
export function speciesByPlace(ctx: Ctx) {
  const places = new Map<string, string>();
  for (const d of ctx.drafts.values()) if (d.domain === 'lieux') places.set(d.nom_en.toLowerCase(), d.id);
  const placeOf = (zone: string) => {
    const full = zone.trim().toLowerCase().replace(/’/g, "'");
    const base = full.replace(/\s*\(.*\)\s*$/, '').trim();
    const pick = (id: string) => (ctx.drafts.has(id) ? id : null);
    if (ZONE_FULL[full]) return pick(ZONE_FULL[full]);
    if (/^(wind|water|earth|fire) mine\b|^cavern\b|^mines?$/.test(full)) return pick('cavern'); // les 4 mines : fiche « La mine »
    if (/^zone \d$|\barea$/.test(full)) return pick('diving-pier'); // zones de plongée, depuis le ponton
    if (/^giant .*house$/.test(full)) return pick('giant-village');
    return ZONE_ALIAS[base] ?? places.get(base) ?? places.get(base.replace(/'/g, '’')) ?? null;
  };
  // Lien vers la fiche du lieu, aligné sur chaque liste de zones (les noms sont traduits plus tard, un pour un)
  const unmatched = new Map<string, number>();
  const ids = (zones: string[]) =>
    zones.map((z) => {
      const pid = placeOf(z);
      if (!pid) unmatched.set(z, (unmatched.get(z) ?? 0) + 1);
      return pid;
    });
  for (const d of ctx.drafts.values()) {
    if (d.domain === 'lieux') continue;
    if (d.lieux.length) d.extra.lieux_id = ids(d.lieux);
    for (const c of (d.extra.conditions ?? []) as any[]) if (c.zones?.length) c.lieux_id = ids(c.zones);
  }
  if (unmatched.size) console.log('zones sans fiche lieu :', [...unmatched].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z} (${n})`).join(', '));
  for (const d of ctx.drafts.values()) {
    if (!CATCH.includes(String(d.domain))) continue;
    const conds: { zones: string[]; saisons: string[] }[] = Array.isArray(d.extra.conditions) && d.extra.conditions.length
      ? d.extra.conditions.map((c: any) => ({ zones: c.zones ?? (c.zone ? [c.zone] : d.lieux), saisons: c.saisons }))
      : [{ zones: d.lieux, saisons: d.saisons }];
    const seen = new Set<string>();
    for (const c of conds)
      for (const z of c.zones) {
        const pid = placeOf(z);
        if (!pid || pid === d.id || seen.has(`${pid}|${z}`)) continue;
        seen.add(`${pid}|${z}`);
        (ctx.drafts.get(pid)!.extra.especes_ici ??= []).push({ id: d.id, zone: z, saisons: c.saisons });
      }
  }
}
