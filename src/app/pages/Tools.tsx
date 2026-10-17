// Outils : calculateur de rentabilité des cultures, planificateur de cadeaux.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, loadEntries, SEASONS, SEASON_FR, type Entry, type Season } from '../data.ts';
import { CheckBtn, Empty, GameImg, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, isChecked, toggle, weekday, WEEKDAYS, type GameDate } from '../store.ts';
import { Chip } from '../fiche/parts.tsx';
import { loadToday, type TodayData } from './Today.tsx';
import { go, route } from '../router.ts';

const DAYS = 28;
const SBIT: Record<Season, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
// Multiplicateurs de prix par qualité (formule du wiki : ×1,15 / ×1,3 / ×1,5 / ×2)
const QUALITIES = [
  { label: 'Base', m: 1 },
  { label: 'Bronze', m: 1.15 },
  { label: 'Argent', m: 1.3 },
  { label: 'Or', m: 1.5 },
  { label: 'Osmium', m: 2 },
];

type Crop = TodayData['cultures'][number];

/**
 * Plantation le jour `day` : jours restants jusqu'à la fin de la dernière saison consécutive de la culture,
 * nombre de récoltes (repousse ou replantation), coût en graines, dernier jour utile pour planter.
 */
export function cropCalc(c: Crop, season: Season, day: number, plants: number, mult: number) {
  if (!(c.s & SBIT[season])) return null;
  let extra = 0;
  for (let k = 1, s = SEASONS.indexOf(season); k < 4; k++) {
    if (!(c.s & (1 << ((s + k) % 4)))) break;
    extra += DAYS;
  }
  const rem = DAYS - day + extra;
  const lastDay = Math.min(DAYS, DAYS + extra - c.g);
  if (rem < c.g) return { harvests: 0, seeds: 0, cost: 0, revenue: 0, profit: 0, perDay: 0, roi: 0, rem, lastDay, cycles: 0 };
  const cycles = c.r > 0 ? 1 : Math.floor(rem / c.g);
  const harvests = c.r > 0 ? 1 + Math.floor((rem - c.g) / c.r) : cycles;
  const price = Math.floor(c.v * mult);
  const cost = cycles * c.pg * plants;
  const revenue = harvests * price * plants;
  const profit = revenue - cost;
  return { harvests, seeds: cycles * plants, cost, revenue, profit, perDay: profit / rem, roi: cost ? profit / cost : 0, rem, lastDay, cycles };
}

type Sort = 'profit' | 'perDay' | 'roi';
type Kind = 'ferme' | 'ocean' | 'fruit';

export function CropCalcPage() {
  const p = active.value;
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => {
    Promise.all([loadToday(), loadEntries()]).then(([t]) => setData(t));
  }, []);
  const [season, setSeason] = useState<Season>(p?.date.season ?? 'spring');
  const [day, setDay] = useState(p?.date.day ?? 1);
  const [plants, setPlants] = useState(20);
  const [q, setQ] = useState(0);
  const [kind, setKind] = useState<Kind>('ferme');
  const [sort, setSort] = useState<Sort>('profit');
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.cultures
      .map((c) => ({ c, e: entry(c.id) }))
      .filter(({ c, e }) => e && e.dom === 'cultures' && (kind === 'ocean' ? c.o === 1 : kind === 'fruit' ? c.o === 0 && e.cat === 'Fruit (plante fruitière)' : c.o === 0 && e.cat !== 'Fruit (plante fruitière)'))
      .map(({ c, e }) => ({ c, e: e!, r: cropCalc(c, season, day, plants, QUALITIES[q].m) }))
      .filter((x) => x.r)
      .sort((a, b) => b.r![sort] - a.r![sort]);
  }, [data, season, day, plants, q, kind, sort]);
  const ok = rows.filter((x) => x.r!.harvests > 0);
  const late = rows.filter((x) => x.r!.harvests === 0);

  return (
    <>
      <TopBar title="Rentabilité des cultures" backTo="/plus" />
      <main class="page" id="main">
        <div class="card form">
          <div class="seg seg-full" role="group" aria-label="Saison">
            {SEASONS.map((s) => (
              <button key={s} aria-pressed={season === s} onClick={() => setSeason(s)}>
                {SEASON_FR[s]}
              </button>
            ))}
          </div>
          <div class="form-row">
            <label>
              Jour de plantation
              <select value={day} onChange={(e) => setDay(+(e.target as HTMLSelectElement).value)}>
                {Array.from({ length: DAYS }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} ({WEEKDAYS[i % 7].slice(0, 3)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre de plants
              <input type="number" inputMode="numeric" min={1} max={9999} value={plants} onChange={(e) => setPlants(Math.max(1, Math.min(9999, +(e.target as HTMLInputElement).value || 1)))} />
            </label>
          </div>
          <div class="form-label" id="q-l">Qualité de vente</div>
          <div class="seg seg-full seg-5" role="group" aria-labelledby="q-l">
            {QUALITIES.map((x, i) => (
              <button key={x.label} aria-pressed={q === i} onClick={() => setQ(i)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div class="chips" role="group" aria-label="Type">
          {(
            [
              ['ferme', 'Ferme'],
              ['ocean', 'Ferme océanique'],
              ['fruit', 'Plantes fruitières'],
            ] as [Kind, string][]
          ).map(([k, l]) => (
            <button key={k} class="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {l}
            </button>
          ))}
        </div>
        <div class="chips" role="group" aria-label="Trier par">
          {(
            [
              ['profit', 'Bénéfice total'],
              ['perDay', 'Par jour'],
              ['roi', 'Retour sur graines'],
            ] as [Sort, string][]
          ).map(([k, l]) => (
            <button key={k} class="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
        {!data ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <p class="note" style={{ margin: '0 4px 8px' }} aria-live="polite">
              {ok.length} culture{ok.length > 1 ? 's' : ''} récoltable{ok.length > 1 ? 's' : ''} avant la fin de saison · {plants} plant{plants > 1 ? 's' : ''}
            </p>
            <div class="card list">
              {(showAll ? ok : ok.slice(0, 15)).map(({ c, e, r }) => (
                <a key={c.id} class="row calc-row" href={`#/fiche/${c.id}`}>
                  <GameImg src={e.img} dom="cultures" size={44} />
                  <span class="txt">
                    <span class="name">
                      {e.fr}
                      <strong class={r!.profit > 0 ? 'gain' : 'loss'}>
                        {r!.profit > 0 ? '+' : ''}
                        {fmt(r!.profit)} PO
                      </strong>
                    </span>
                    <span class="sub">
                      {r!.harvests} récolte{r!.harvests > 1 ? 's' : ''} × {Math.floor(c.v * QUALITIES[q].m)} PO · {r!.cycles > 1 ? `${r!.cycles} cycles · ` : ''}graines {fmt(r!.cost)} PO · {fmt(Math.round(r!.perDay))} PO/j
                      {c.r ? ` · repousse ${c.r} j` : ''} · croissance {c.g} j · planter au plus tard le {r!.lastDay >= DAYS && r!.rem > DAYS ? `${DAYS} (passe la saison)` : r!.lastDay}
                      {c.rg ? ` · rang ${c.rg}` : ''}
                    </span>
                  </span>
                </a>
              ))}
              {ok.length > 15 && (
                <button class="more-btn" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Réduire' : `Voir les ${ok.length} cultures`}
                </button>
              )}
              {!ok.length && <p class="note pad">Aucune culture de ce type ne peut être récoltée d'ici la fin de la saison.</p>}
            </div>
            {late.length > 0 && (
              <p class="note fine">
                Trop tard pour : {late.map((x) => x.e.fr).join(', ')}.
              </p>
            )}
            <p class="note fine">
              Calcul : récoltes possibles jusqu'à la fin de la dernière saison consécutive de la culture, une récolte par plant, prix de vente de base × multiplicateur de qualité (arrondi inférieur), graines au prix de la fiche. Hors engrais, compétences et produits multiples par récolte.
            </p>
          </>
        )}
      </main>
    </>
  );
}

const fmt = (n: number) => n.toLocaleString('fr-FR');

// ---------- Planificateur de cadeaux ----------

type Prefs = Record<string, { L: string[]; l: string[]; d: string[]; h: string[]; m?: 1 }>;
let prefsP: Promise<Prefs> | null = null;
const loadPrefs = () => (prefsP ??= import('../../data/cadeaux.json').then((m) => (m.default ?? m) as unknown as Prefs));

/** Semaine en cours (2 cadeaux par semaine et par habitant, plus le cadeau d'anniversaire). */
const weekKey = (d: GameDate) => `${d.year}-${d.season}-${Math.floor((d.day - 1) / 7)}`;
export const giftKeys = (npc: string, d: GameDate) => [`cadeau:${npc}:${weekKey(d)}:1`, `cadeau:${npc}:${weekKey(d)}:2`];
const daysUntil = (d: GameDate, s: Season, j: number) => (SEASONS.indexOf(s) * DAYS + j - (SEASONS.indexOf(d.season) * DAYS + d.day) + DAYS * 4) % (DAYS * 4);

function useGiftData() {
  const [d, setD] = useState<{ prefs: Prefs; today: TodayData; entries: Entry[] } | null>(null);
  useEffect(() => {
    Promise.all([loadPrefs(), loadToday(), loadEntries()]).then(([prefs, today, entries]) => setD({ prefs, today, entries }));
  }, []);
  return d;
}

export function GiftPlannerPage() {
  const data = useGiftData();
  const p = active.value;
  const q = route.value.query;
  const filter = q.get('f') ?? '';
  const [text, setText] = useState('');
  if (!p) return null;
  const d = p.date;
  const rows = !data
    ? []
    : Object.keys(data.prefs)
        .map((id) => {
          const e = entry(id);
          const b = data.today.anniversaires.find((x) => x.id === id);
          return { id, e, m: data.prefs[id].m, n: b ? daysUntil(d, b.s, b.j) : 999 };
        })
        .filter((r) => r.e)
        .filter((r) => (!filter || (filter === 'mariables' ? r.m : filter === 'ondins' ? r.e!.cat === 'Ondin' : giftKeys(r.id, d).some((k) => !isChecked(k)))))
        .filter((r) => !text || fold(r.e!.fr).includes(fold(text)))
        .sort((a, b) => a.n - b.n || a.e!.fr.localeCompare(b.e!.fr, 'fr'));
  const setF = (f: string) => go('/outils/cadeaux', { f: f || undefined }, true);
  return (
    <>
      <TopBar title="Cadeaux" backTo="/plus" />
      <main class="page" id="main">
        <p class="note" style={{ margin: '0 4px 10px' }}>
          Semaine {Math.floor((d.day - 1) / 7) + 1} de {SEASON_FR[d.season].toLowerCase()}, an {d.year} · 2 cadeaux par habitant et par semaine (la semaine commence le lundi).
        </p>
        <label class="field">
          <Icon name="search" style={{ width: 20, height: 20, color: 'var(--muted)' }} />
          <span class="sr-only">Filtrer par nom</span>
          <input type="search" placeholder="Nom de l'habitant" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        </label>
        <div class="chips" role="group" aria-label="Filtre">
          {[
            ['', 'Tous'],
            ['a-offrir', 'Reste à offrir'],
            ['mariables', 'Mariables'],
            ['ondins', 'Ondins'],
          ].map(([k, l]) => (
            <button key={k} class="chip" aria-pressed={filter === k} onClick={() => setF(k)}>
              {l}
            </button>
          ))}
        </div>
        {!data ? (
          <Empty>Chargement…</Empty>
        ) : (
          <div class="card list">
            {rows.map((r) => {
              const [k1, k2] = giftKeys(r.id, d);
              return (
                <div key={r.id} class={`row trow gift-row${r.n === 0 ? ' now' : ''}`}>
                  <a class="trow-link" href={`#/outils/cadeaux/${r.id}`}>
                    <GameImg src={r.e!.img} dom="pnj" size={40} />
                    <span class="txt">
                      <span class="name">{r.e!.fr}</span>
                      <span class="sub">
                        {r.n === 0 ? (
                          <strong>
                            <Icon name="cake" class="inline-ic" /> Anniversaire aujourd'hui
                          </strong>
                        ) : r.n < 999 ? (
                          `Anniversaire dans ${r.n} j`
                        ) : (
                          'Anniversaire à vérifier'
                        )}
                        {r.m ? ' · mariable' : ''}
                      </span>
                    </span>
                  </a>
                  <CheckBtn on={isChecked(k1)} label={`${r.e!.fr} : 1er cadeau de la semaine`} onToggle={() => toggle(k1)} />
                  <CheckBtn on={isChecked(k2)} label={`${r.e!.fr} : 2e cadeau de la semaine`} onToggle={() => toggle(k2)} />
                </div>
              );
            })}
            {!rows.length && <p class="note pad">Aucun habitant avec ce filtre.</p>}
          </div>
        )}
      </main>
    </>
  );
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function GiftNpcPage({ id }: { id: string }) {
  const data = useGiftData();
  const p = active.value;
  const [seasonOnly, setSeasonOnly] = useState(false);
  if (!p) return null;
  const d = p.date;
  const e = entry(id);
  const pr = data?.prefs[id];
  const bit = SBIT[d.season];
  const okSeason = (gid: string) => {
    const s = entry(gid)?.seasons ?? 0;
    return !s || !!(s & bit);
  };
  // Universels : appliqués sauf si l'habitant a une préférence explicite contraire.
  const explicit = new Set(pr ? [...pr.L, ...pr.l, ...pr.d, ...pr.h] : []);
  const uni = (code: string) => (data?.entries ?? []).filter((x) => x.universal === code && !explicit.has(x.id)).map((x) => x.id);
  const loves = pr ? [...pr.L, ...uni('L')] : [];
  const likes = pr?.l ?? [];
  const show = (ids: string[]) => (seasonOnly ? ids.filter(okSeason) : ids);
  const b = data?.today.anniversaires.find((x) => x.id === id);
  const [k1, k2] = giftKeys(id, d);
  return (
    <>
      <TopBar title={e ? `Cadeaux · ${e.fr}` : 'Cadeaux'} backTo="/outils/cadeaux" />
      <main class="page fiche" id="main">
        {!data ? (
          <Empty>Chargement…</Empty>
        ) : !pr || !e ? (
          <Empty>Préférences inconnues pour cet habitant.</Empty>
        ) : (
          <>
            <div class="card">
              <div class="hero">
                <GameImg src={e.img} dom="pnj" size={72} />
                <div style={{ minWidth: 0 }}>
                  <h2>{e.fr}</h2>
                  <div class="en">
                    {b ? `Anniversaire : ${b.j} ${SEASON_FR[b.s].toLowerCase()}` : 'Anniversaire à vérifier'}
                    {pr.m ? ' · mariable' : ''}
                  </div>
                  <a class="linkbtn" href={`#/fiche/${id}`}>
                    Voir la fiche complète
                  </a>
                </div>
              </div>
            </div>
            <div class="card list track-card" aria-label="Cadeaux de la semaine">
              {[k1, k2].map((k, i) => (
                <div key={k} class={`row trow${isChecked(k) ? ' done' : ''}`}>
                  <CheckBtn on={isChecked(k)} label={`${i + 1}${i ? 'e' : 'er'} cadeau de la semaine offert`} onToggle={() => toggle(k)} />
                  <span class="txt">
                    <span class="name">
                      {i + 1}
                      {i ? 'e' : 'er'} cadeau de la semaine ({WEEKDAYS[weekday(d.day)].toLowerCase()} {d.day})
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div class="chips" role="group" aria-label="Filtre">
              <button class="chip" aria-pressed={seasonOnly} onClick={() => setSeasonOnly(!seasonOnly)}>
                <span class="season-dot" style={{ background: `var(--s-${d.season})` }} />
                Obtenables en {SEASON_FR[d.season].toLowerCase()}
              </button>
            </div>
            <GiftBlock title="Adore" cls="gift-love" ids={show(loves)} />
            <GiftBlock title="Aime" cls="gift-like" ids={show(likes)} />
            <GiftBlock title="À éviter (déteste)" cls="gift-hate" ids={pr.h} />
            <GiftBlock title="N'aime pas" cls="gift-hate" ids={pr.d} closed />
            <p class="note fine">
              « Adore » inclut les cadeaux universels adorés. {uni('l').length} cadeaux universellement aimés s'ajoutent à « Aime » (voir la fiche de l'habitant). Saisons : celles de l'objet dans le wiki ; les objets sans saison sont comptés comme disponibles toute l'année.
            </p>
          </>
        )}
      </main>
    </>
  );
}

function GiftBlock({ title, ids, cls, closed }: { title: string; ids: string[]; cls: string; closed?: boolean }) {
  if (!ids.length) return null;
  return (
    <details class={`fsec ${cls}`} open={!closed}>
      <summary>
        <h3>
          {title} <span class="note">{ids.length}</span>
        </h3>
      </summary>
      <div class="fsec-body xchips">
        {ids.map((g) => (
          <Chip key={g} id={g} />
        ))}
      </div>
    </details>
  );
}
