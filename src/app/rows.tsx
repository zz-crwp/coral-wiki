// Lignes repliables par domaine. Règle : la ligne repliée répond en un coup d'œil à LA question du joueur
// dans ce contexte ; le dépliage donne le reste et mène à la fiche complète (sheet).
import type { ComponentChildren } from 'preact';
import type { Entity } from '../data/schema.ts';
import { entry, SEASONS, SEASON_FR, seasonsOf, type Entry, type Season } from './data.ts';
import { GameImg, GIcon, Gold, RichText } from './components.tsx';
import { Icon } from './icons.tsx';
import { coeurs, isChecked, palier, setCoeurs, setPalier, setCheck, weekday, WEEKDAYS, type Profile } from './store.ts';
import { catchState, cropCalc, daysUntil, dayWindows, inDays, SBIT, shopState, whereNow, type Capture, type Crop, type Shop, type TodayData } from './game.ts';
import { hours, ranges, WEATHER_FR } from './fiche/labels.ts';
import { Chip, ChipList, Prices, ZoneLinks } from './fiche/parts.tsx';
import { UpgradeList } from './fiche/upgrades.tsx';
import { Pill, SeasonPills } from '../ui/controls.tsx';
import { toast } from '../ui/feedback.tsx';
import { openFiche } from './router.ts';

type X = Record<string, any>;

/** Contexte commun : données du jour, profil, index par id. */
export type RowCtx = {
  t: TodayData;
  p: Profile;
  ents: Map<string, Entity>;
  cap: Map<string, Capture>;
  crop: Map<string, Crop>;
  shop: Map<string, Shop>;
  bday: Map<string, { s: Season; j: number }>;
  fest: Map<string, { s: Season; j: number; f: number; h: string }>;
};
export function rowCtx(t: TodayData, p: Profile, ents: Map<string, Entity>): RowCtx {
  const crop = new Map<string, Crop>();
  for (const c of t.cultures) {
    crop.set(c.id, c);
    if (c.gr && !crop.has(c.gr)) crop.set(c.gr, c);
  }
  return {
    t,
    p,
    ents,
    cap: new Map(t.captures.map((c) => [c.id, c])),
    crop,
    shop: new Map(t.boutiques.map((b) => [b.id, b])),
    bday: new Map(t.anniversaires.map((b) => [b.id, b])),
    fest: new Map(t.festivals.map((f) => [f.id, f])),
  };
}

/** Une ligne : contenu replié (sous-titre, fin), coche par glissement, détail. */
export type RowSpec = {
  sub?: ComponentChildren;
  end?: ComponentChildren;
  done?: boolean;
  check?: { key: string; label: string; off: string };
  detail: () => ComponentChildren;
  sortKey?: number; // pour « trier par pertinence » (plus petit = plus haut)
};
export type Kind = 'catch' | 'crop' | 'npc' | 'tool' | 'place' | 'recipe' | 'festival' | 'material' | 'forage' | 'generic';

/** Domaine → modèle de ligne (justification dans la page /design). */
export function kindOf(dom: string, e?: Entity): Kind {
  if (['poissons', 'insectes', 'creatures-marines'].includes(dom)) return 'catch';
  if (dom === 'cultures' || dom === 'arbres') return 'crop';
  if (dom === 'pnj') return 'npc';
  if (dom === 'outils' || (e && (e.extra as X).ameliorations?.length)) return 'tool';
  if (dom === 'lieux') return 'place';
  if (dom === 'cuisine') return 'recipe';
  if (dom === 'festivals') return 'festival';
  if (dom === 'ressources' || dom === 'mineraux') return 'material';
  if (dom === 'cueillette') return 'forage';
  return 'generic';
}

const seasonList = (mask: number): Season[] => seasonsOf(mask);
const weatherLine = (meteo: string[]) =>
  meteo.length && meteo.length < 6 ? (
    <span class="wmini" title={meteo.map((w) => WEATHER_FR[w]).join(', ')}>
      {meteo.map((w) => (w === 'blizzard' ? <Icon key={w} name="blizzard" /> : <GIcon key={w} k={w} size={14} />))}
    </span>
  ) : null;
const more = (id: string) => (
  <button class="btn plain more-fiche" onClick={() => openFiche(id)}>
    Fiche complète
  </button>
);
const kv = (rows: [string, ComponentChildren][]) => (
  <dl class="kv compact">
    {rows
      .filter(([, v]) => v != null && v !== '' && v !== false)
      .map(([k, v]) => (
        <>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </>
      ))}
  </dl>
);

/** Où et quand, zone par zone : chaque lieu (lié à sa fiche) avec ses saisons, ses jours, ses heures et sa météo. */
function WhereWhen({ e }: { e: Entity | undefined }) {
  if (!e) return null;
  const x = e.extra as X;
  const conds: X[] = x.conditions?.length ? x.conditions : [{ zones: e.lieux, lieux_id: x.lieux_id, saisons: e.saisons, horaires: e.horaires, meteo: e.meteo, jours: x.jours_saison }];
  return (
    <ul class="where-list">
      {conds.map((c, i) => {
        const names: string[] = c.zones?.length ? c.zones : c.zone ? [c.zone] : e.lieux;
        const ids = c.zones?.length || c.zone ? c.lieux_id : x.lieux_id;
        const days = [...new Set(((c.jours ?? []) as X[]).map((j) => `${j.de}–${j.a} ${SEASON_FR[j.saison as Season].toLowerCase()}`))];
        const multi = conds.length > 1;
        return (
          <li key={i}>
            <strong>
              <ZoneLinks names={names} ids={ids} />
            </strong>
            <span class="where-when">
              {days.length ? <span>{days.join(', ')}</span> : <SeasonPills seasons={c.saisons ?? []} short />}
              {c.horaires?.length > 0 && <span class="tabular">{ranges(c.horaires)}</span>}
              {multi && c.meteo?.length > 0 && c.meteo.length < 6 && <span>{c.meteo.map((w: string) => WEATHER_FR[w]).join(', ')}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Poissons, insectes, créatures ----------
function catchRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const cap = c.cap.get(en.id);
  const key = `pris:${en.id}`;
  const st = cap ? catchState(cap, c.p.date, c.p.weather, c.p.hour) : null;
  const zone = st?.zones[0] ?? e?.lieux[0] ?? '';
  const dj = cap ? dayWindows(cap, SBIT[c.p.date.season]) : [];
  return {
    done: isChecked(key),
    check: { key, label: 'Attrapé', off: 'Pas attrapé' },
    sortKey: st?.now ? 0 : st?.today ? 1 : st?.season ? 2 : 3,
    // L'état « maintenant » ouvre la ligne d'infos (statut d'abord, comme Flighty) : le nom garde toute la largeur.
    sub: (
      <>
        {st?.now ? (
          <Pill kind="live">Maintenant</Pill>
        ) : st?.today ? (
          <Pill kind="tint">{st.next != null ? `dès ${hours(st.next)}` : "aujourd'hui"}</Pill>
        ) : st && !st.season ? (
          <span class="c-3">Hors saison ·</span>
        ) : null}
        {cap && <SeasonPills seasons={seasonList(cap.s)} short />}
        {cap && <span class="tabular">{ranges(st?.today ? st.h : cap.h) || ''}</span>}
        {e && weatherLine(e.meteo)}
        {zone && <span class="zone">{zone}</span>}
      </>
    ),
    detail: () => {
      const x = (e?.extra ?? {}) as X;
      return (
        <>
          {e?.prix && <Prices prix={e.prix as any} />}
          <WhereWhen e={e} />
          {kv([
            ['Météo', e && !(x.conditions?.length > 1) && (e.meteo.length >= 6 ? 'Tous les temps' : e.meteo.map((w) => WEATHER_FR[w]).join(', '))],
            ['Difficulté', x.difficulte],
            ['Rareté', x.rarete],
            ['Profondeur', x.profondeur],
          ])}
          <div class="row-actions">
            {x.don_musee && <CheckToggle k={`musee:${en.id}`} label="Donné au musée" />}
            {(x.offrandes ?? []).map((o: X) => (
              <CheckToggle key={o.offrande} k={`temple:${o.offrande}:${en.id}`} label={`Temple · ${o.nom ?? ''}`} />
            ))}
          </div>
          {e && Object.keys(e.aime_par ?? {}).length > 0 && (e.aime_par as X).love?.length > 0 && (
            <div>
              <div class="mini-h">Adoré par</div>
              <ChipList ids={(e.aime_par as X).love} limit={8} />
            </div>
          )}
          {e && e.utilise_dans.length > 0 && (
            <div>
              <div class="mini-h">Recettes</div>
              <ChipList ids={e.utilise_dans} limit={6} />
            </div>
          )}
          {more(en.id)}
        </>
      );
    },
  };
}

// ---------- Cultures ----------
function cropRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const cr = c.crop.get(en.id);
  const x = (e?.extra ?? {}) as X;
  const g = cr?.g ?? x.croissance;
  const r = cr?.r ?? x.repousse;
  const calc = cr ? cropCalc(cr, c.p.date.season, c.p.date.day, 1, 1) : null;
  const perDay = calc && calc.harvests > 0 ? Math.round(calc.profit / calc.rem) : null;
  return {
    sortKey: perDay != null ? -perDay : 9999,
    sub: (
      <>
        {g != null && <span class="tabular">Pousse {g} j</span>}
        {r ? <span class="tabular">· repousse {r} j</span> : null}
        <SeasonPills seasons={cr ? seasonList(cr.s) : ((e?.saisons ?? []) as Season[])} short />
      </>
    ),
    end:
      perDay != null ? (
        <span class={perDay > 0 ? 'gain' : 'loss'}>
          {perDay > 0 ? '+' : ''}
          {perDay} PO/j
        </span>
      ) : calc && calc.harvests === 0 ? (
        <span class="c-3">trop tard</span>
      ) : null,
    detail: () => (
      <>
        {Array.isArray(x.stades) && x.stades.length > 0 && (
          <div class="stages" role="img" aria-label={`Stades de pousse : ${x.stades.length}`}>
            {x.stades.map((s: X) => (
              <figure key={s.n}>
                <img src={`https://static.wikia.nocookie.net/coralisland/images/${s.url}/revision/latest/scale-to-width-down/80`} alt="" loading="lazy" referrerpolicy="no-referrer" width={40} height={40} />
                <figcaption>{s.n === 'R' ? 'Repousse' : s.n}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {calc && calc.harvests > 0 && (
          <p class="t-subhead">
            Plantée aujourd'hui : <strong>{calc.harvests} récolte{calc.harvests > 1 ? 's' : ''}</strong>, <strong class={calc.profit > 0 ? 'gain' : 'loss'}>{calc.profit > 0 ? '+' : ''}{calc.profit} PO</strong> par plant · dernier jour pour planter : {calc.lastDay}
          </p>
        )}
        {e?.prix && <Prices prix={e.prix as any} />}
        <SeedShops seed={cr?.gr ?? (x.graine as string) ?? en.id} c={c} />
        {more(en.id)}
      </>
    ),
  };
}
function SeedShops({ seed, c }: { seed: string; c: RowCtx }) {
  const s = c.ents.get(seed);
  const vend = ((s?.extra as X)?.vendu_par ?? []).filter((v: X) => !v.materiaux) as X[];
  if (!vend.length) return null;
  return (
    <div>
      <div class="mini-h">Graines</div>
      <ul class="plain-list">
        {vend.map((v, i) => {
          const b = c.shop.get(v.lieu);
          const st = b ? shopState(b, c.p.date, c.p.hour) : null;
          return (
            <li key={i}>
              <Chip id={v.lieu} size={24} /> <Gold n={v.prix} /> {v.rang && <Pill>rang {v.rang}</Pill>} {st && <Pill kind={st.open ? 'ok' : 'ko'}>{st.open ? 'ouvert' : 'fermé'}</Pill>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Habitants ----------
function npcRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const bd = c.bday.get(en.id);
  const n = bd ? daysUntil(c.p.date, bd.s, bd.j) : null;
  const x = (e?.extra ?? {}) as X;
  const where = Array.isArray(x.emploi_du_temps) ? whereNow(x.emploi_du_temps, c.p.date, c.p.weather, c.p.hour) : null;
  const h = coeurs(en.id);
  const wk = `${c.p.date.year}-${c.p.date.season}-${Math.floor((c.p.date.day - 1) / 7)}`;
  const g1 = `cadeau:${en.id}:${wk}:1`;
  const g2 = `cadeau:${en.id}:${wk}:2`;
  const given = +isChecked(g1) + +isChecked(g2);
  return {
    sortKey: n ?? 999,
    sub: (
      <>
        {bd && (
          <span class={n === 0 ? 'bday now' : 'bday'}>
            <Icon name="cake" /> {bd.j} {SEASON_FR[bd.s].toLowerCase()}
            {n != null && n <= 14 ? ` · ${inDays(n)}` : ''}
          </span>
        )}
        {h > 0 && (
          <span class="hearts-mini" aria-label={`${h} cœurs`}>
            <Icon name="heart" /> {h}
          </span>
        )}
        {where && <span class="zone">{where.texte.replace(/\.$/, '')}</span>}
      </>
    ),
    end: x.cadeaux ? <span class="tabular" title="Cadeaux offerts cette semaine">{given}/2 <Icon name="gift" class="ic-s" /></span> : null,
    detail: () => {
      const loves: string[] = x.cadeaux?.love ?? [];
      const bit = SBIT[c.p.date.season];
      const avail = (id: string) => {
        const s = entry(id)?.seasons ?? 0;
        return !s || !!(s & bit);
      };
      const events = (x.evenements_coeur ?? []) as X[];
      return (
        <>
          <HeartPicker id={en.id} value={h} />
          {x.cadeaux && (
            <div class="row-actions">
              <CheckToggle k={g1} label="1er cadeau de la semaine" />
              <CheckToggle k={g2} label="2e cadeau de la semaine" />
            </div>
          )}
          {loves.length > 0 && (
            <div>
              <div class="mini-h">Adore · dispo en {SEASON_FR[c.p.date.season].toLowerCase()} d'abord</div>
              <ChipList ids={[...loves.filter(avail), ...loves.filter((i) => !avail(i))]} limit={10} />
            </div>
          )}
          {where && (
            <p class="t-subhead">
              <strong>Maintenant :</strong> {where.texte}
              {where.depuis != null && <span class="c-2"> (depuis {hours(where.depuis)})</span>}
            </p>
          )}
          {events.length > 0 && (
            <div>
              <div class="mini-h">Prochains événements de cœur</div>
              <ul class="plain-list">
                {events
                  .filter((v) => (v.coeurs ?? 0) > h)
                  .slice(0, 3)
                  .map((v, i) => (
                    <li key={i}>
                      <strong>{v.coeurs} ♥</strong> {v.resume ?? v.resume_en} <span class="c-2">{[v.lieu, v.condition && v.condition !== 'Tous' ? v.condition : ''].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {more(en.id)}
        </>
      );
    },
  };
}
function HeartPicker({ id, value }: { id: string; value: number }) {
  return (
    <div class="heart-pick" role="group" aria-label="Niveau de cœurs">
      {Array.from({ length: 10 }, (_, i) => (
        <button key={i} aria-pressed={i < value} aria-label={`${i + 1} cœur${i ? 's' : ''}`} onClick={() => setCoeurs(id, value === i + 1 ? i : i + 1)}>
          <Icon name="heart" />
        </button>
      ))}
    </div>
  );
}

// ---------- Outils ----------
const TIERS = ['base', 'bronze', 'silver', 'gold', 'osmium'];
const TIER_FR = ['De base', 'Bronze', 'Argent', 'Or', 'Osmium'];
function toolRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const ups = ((e?.extra as X)?.ameliorations ?? []) as X[];
  const tiered = ups.filter((u) => /^(bronze|silver|gold|osmium)\b/i.test(u.nom));
  if (!tiered.length) return genericRow(en, e, c);
  const own = palier(en.id);
  const next = tiered[own];
  return {
    sortKey: own,
    sub: (
      <span class="tiers" aria-label={`Palier possédé : ${TIER_FR[own]}`}>
        {TIERS.map((t, i) => (
          <span key={t} class={`tier${i <= own ? ' have' : ''}${i === own + 1 ? ' next' : ''}`} title={TIER_FR[i]}>
            {i === 0 ? <span class="tier-dot" /> : <GIcon k={t} size={16} />}
          </span>
        ))}
      </span>
    ),
    end: next ? (
      <span class="cost">
        <Gold n={next.prix} />
        <span class="mats">
          {(next.materiaux ?? [])
            .filter((m: X) => m.item !== en.id)
            .slice(0, 2)
            .map((m: X) => (
              <span key={m.item} class="mat" title={entry(m.item)?.fr}>
                <GameImg src={entry(m.item)?.img ?? ''} dom="ressources" size={18} />×{m.n}
              </span>
            ))}
        </span>
      </span>
    ) : (
      <Pill kind="ok">Au maximum</Pill>
    ),
    detail: () => (
      <>
        <div class="segmented tiers-pick" role="group" aria-label="Palier possédé">
          {TIER_FR.map((t, i) => (
            <button key={t} aria-pressed={own === i} onClick={() => setPalier(en.id, i)}>
              {t}
            </button>
          ))}
        </div>
        <UpgradeList rows={tiered.map((u) => ({ ...u, item: en.id }))} compact />
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Lieux et magasins ----------
function placeRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const b = c.shop.get(en.id);
  const x = (e?.extra ?? {}) as X;
  if (b) {
    const st = shopState(b, c.p.date, c.p.hour);
    const season = c.p.date.season;
    const stock = ((x.stock ?? []) as X[]).filter((r) => !r.materiaux && (!r.saisons || r.saisons.includes(season)));
    return {
      sortKey: st.open ? 0 : 1,
      sub: <span class="tabular">{!st.known ? 'horaires à vérifier' : st.today.length ? `Aujourd'hui ${ranges(st.today)}` : `Fermé le ${WEEKDAYS[weekday(c.p.date.day)].toLowerCase()}`}</span>,
      end: <Pill kind={st.open ? 'ok' : 'ko'}>{st.open ? `Ouvert · ${hours(st.close)}` : st.next ? `${st.next.k === 0 ? '' : st.next.k === 1 ? 'Demain ' : WEEKDAYS[st.next.wd].slice(0, 3) + '. '}${hours(st.next.from)}` : 'Fermé'}</Pill>,
      detail: () => (
        <>
          {stock.length > 0 && (
            <div>
              <div class="mini-h">En stock en {SEASON_FR[season].toLowerCase()} · {stock.length}</div>
              <ChipList ids={stock.filter((r) => r.item).map((r) => r.item)} notes={Object.fromEntries(stock.filter((r) => r.item && r.prix != null).map((r) => [r.item, `${r.prix} ${r.devise}`]))} limit={12} />
            </div>
          )}
          {((x.stock ?? []) as X[]).some((r) => r.materiaux) && (
            <a class="btn ghost" href={`#/explorer/ameliorations?magasin=${en.id}`}>
              Améliorations proposées
            </a>
          )}
          {more(en.id)}
        </>
      ),
    };
  }
  const here = (x.especes_ici ?? []) as X[];
  const season = c.p.date.season;
  const now = new Set(here.filter((s) => !s.saisons?.length || s.saisons.includes(season)).map((s) => s.id));
  return {
    sortKey: -now.size,
    sub: here.length ? <span>{now.size} espèce{now.size > 1 ? 's' : ''} en {SEASON_FR[season].toLowerCase()}</span> : <span class="c-2">{en.cat}</span>,
    detail: () => (
      <>
        {now.size > 0 && <ChipList ids={[...now]} limit={14} />}
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Recettes ----------
function recipeRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const x = (e?.extra ?? {}) as X;
  const rec = (x.recettes ?? [])[0] as X | undefined;
  const key = `cuisine:${en.id}`;
  const bit = SBIT[c.p.date.season];
  const ok = (id: string) => {
    const s = entry(id)?.seasons ?? 0;
    return !s || !!(s & bit);
  };
  if (en.cat === 'Ustensile') return genericRow(en, e, c);
  return {
    done: isChecked(key),
    check: { key, label: 'Cuisiné', off: 'Pas cuisiné' },
    sub: rec ? (
      <span class="ingr" aria-label={`Ingrédients : ${rec.ingredients.map((g: X) => entry(g.id)?.fr ?? g.id).join(', ')}`}>
        {rec.ingredients.slice(0, 5).map((g: X) => (
          <span key={g.id} class={ok(g.id) ? '' : 'off'} title={`${entry(g.id)?.fr ?? g.id}${ok(g.id) ? '' : ' (hors saison)'}`}>
            <GameImg src={entry(g.id)?.img ?? ''} dom={entry(g.id)?.dom ?? 'objets'} size={20} />
          </span>
        ))}
        {rec.outil && <span class="c-2">· {entry(rec.outil)?.fr ?? rec.outil}</span>}
      </span>
    ) : undefined,
    end: e?.prix?.base != null ? <Gold n={e.prix.base} /> : null,
    detail: () => (
      <>
        {rec && <ChipList ids={rec.ingredients.map((g: X) => g.id)} notes={Object.fromEntries(rec.ingredients.map((g: X) => [g.id, `×${g.n}`]))} limit={10} />}
        {kv([
          ['Effet', x.effet],
          ['Santé', x.sante != null ? `+${x.sante}` : ''],
          ['Énergie', x.energie != null ? `+${x.energie}` : ''],
          ['Déblocage', x.source_recette ?? x.deblocage],
        ])}
        {e?.prix && <Prices prix={e.prix as any} />}
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Festivals ----------
function festivalRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const f = c.fest.get(en.id);
  const d = c.p.date;
  const now = f && f.s === d.season && f.j <= d.day && d.day <= f.f;
  const n = f ? daysUntil(d, f.s, f.j) : null;
  return {
    sortKey: now ? -1 : n ?? 999,
    sub: f ? <span>{f.j === f.f ? f.j : `${f.j}–${f.f}`} {SEASON_FR[f.s].toLowerCase()}</span> : undefined,
    end: now ? <Pill kind="live">En cours</Pill> : n != null ? <span class="tabular">{inDays(n)}</span> : null,
    detail: () => (
      <>
        {kv([
          ['Horaires', e?.horaires_texte],
          ['Lieu', e?.lieux.join(', ')],
        ])}
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Matériaux ----------
function materialRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const x = (e?.extra ?? {}) as X;
  const first = e?.obtention[0];
  const uses = (x.utilise_pour ?? []) as X[];
  return {
    sub: first ? <span class="zone"><RichText text={first.replace(/\s*\(voir.*\)$/, '')} /></span> : <span class="c-2">{en.cat}</span>,
    end: e?.prix?.base != null ? <Gold n={e.prix.base} /> : null,
    detail: () => (
      <>
        {e && e.obtention.length > 1 && (
          <ul class="plain-list">
            {e.obtention.slice(0, 6).map((o) => (
              <li key={o}>
                <RichText text={o} />
              </li>
            ))}
          </ul>
        )}
        {uses.length > 0 && (
          <div>
            <div class="mini-h">Nécessaire pour · {uses.length}</div>
            <ChipList ids={[...new Set(uses.filter((u) => u.item).map((u) => u.item as string))]} limit={8} />
          </div>
        )}
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Cueillette ----------
function forageRow(en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  const ss = (e?.saisons ?? []) as Season[];
  const inSeason = !ss.length || ss.includes(c.p.date.season);
  return {
    sortKey: inSeason ? 0 : 1,
    sub: (
      <>
        <SeasonPills seasons={ss} short />
        {e?.lieux[0] && <span class="zone">{e.lieux.slice(0, 2).join(', ')}</span>}
      </>
    ),
    end: inSeason && ss.length && ss.length < 4 ? <Pill kind="tint">de saison</Pill> : null,
    detail: () => (
      <>
        {e?.prix && <Prices prix={e.prix as any} />}
        {kv([['Lieux', e?.lieux.join(' · ')]])}
        {(e?.aime_par as X)?.love?.length > 0 && (
          <div>
            <div class="mini-h">Adoré par</div>
            <ChipList ids={(e!.aime_par as X).love} limit={8} />
          </div>
        )}
        {more(en.id)}
      </>
    ),
  };
}

// ---------- Générique (catalogues : on identifie un objet plus qu'on ne planifie) ----------
function genericRow(en: Entry, e: Entity | undefined, _c: RowCtx): RowSpec {
  return {
    sub: <span class="c-2">{en.fr !== en.en ? en.en : en.cat}</span>,
    end: e?.prix?.base != null ? <Gold n={e.prix.base} /> : null,
    detail: () => (
      <>
        {e?.description && <p class="t-subhead">{e.description}</p>}
        {e && e.obtention.length > 0 && (
          <ul class="plain-list">
            {e.obtention.slice(0, 4).map((o) => (
              <li key={o}>
                <RichText text={o} />
              </li>
            ))}
          </ul>
        )}
        {more(en.id)}
      </>
    ),
  };
}

export function rowFor(kind: Kind, en: Entry, e: Entity | undefined, c: RowCtx): RowSpec {
  switch (kind) {
    case 'catch':
      return catchRow(en, e, c);
    case 'crop':
      return cropRow(en, e, c);
    case 'npc':
      return npcRow(en, e, c);
    case 'tool':
      return toolRow(en, e, c);
    case 'place':
      return placeRow(en, e, c);
    case 'recipe':
      return recipeRow(en, e, c);
    case 'festival':
      return festivalRow(en, e, c);
    case 'material':
      return materialRow(en, e, c);
    case 'forage':
      return forageRow(en, e, c);
    default:
      return genericRow(en, e, c);
  }
}

/** Coche secondaire dans une ligne dépliée (musée, temple, cadeaux), avec « Annuler ». */
export function CheckToggle({ k, label }: { k: string; label: string }) {
  const on = isChecked(k);
  return (
    <button
      class={`toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={() => {
        setCheck(k, !on);
        toast(`${label} : ${on ? 'décoché' : 'coché'}`, () => setCheck(k, on));
      }}
    >
      <span class="box" aria-hidden="true">
        {on && <Icon name="check" />}
      </span>
      {label}
    </button>
  );
}

export { SEASONS };
