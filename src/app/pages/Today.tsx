// Écran d'accueil « Aujourd'hui » : date et météo en jeu → anniversaires, festivals,
// captures possibles maintenant, cultures encore rentables, boutiques ouvertes.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, loadEntries, SEASONS, SEASON_FR, type Season } from '../data.ts';
import { CheckBtn, Empty, GameImg, GIcon, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, isChecked, setDate, setHour, setWeather, toggle, weekday, WEEKDAYS, type GameDate } from '../store.ts';
import { hours, ranges, WEATHER_FR } from '../fiche/labels.ts';
import { Chip } from '../fiche/parts.tsx';

type Range = { from: number; to: number };
type Cond = { s: number; w: number; h: Range[]; dj?: [number, number, number][] };
export type TodayData = {
  anniversaires: { id: string; s: Season; j: number }[];
  festivals: { id: string; s: Season; j: number; f: number; h: string }[];
  captures: (Cond & { id: string; d: string; l: string; r?: string; c?: (Cond & { z: string })[] })[];
  cultures: { id: string; s: number; g: number; r: number; pg: number; v: number; gr: string; o: number; rg: string | null }[];
  boutiques: { id: string; o: { j: number[]; p: Range[] }[]; f: number[]; m: number }[];
};

let todayP: Promise<TodayData> | null = null;
export const loadToday = () => (todayP ??= import('../../data/aujourdhui.json').then((m) => (m.default ?? m) as unknown as TodayData));

export const WEATHERS = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];
const SBIT: Record<Season, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
const DAYS = 28;

export function shiftDate(d: GameDate, n: number): GameDate {
  let idx = SEASONS.indexOf(d.season) * DAYS + d.day - 1 + n;
  let year = d.year;
  while (idx < 0) {
    idx += DAYS * 4;
    year = Math.max(1, year - 1);
  }
  year += Math.floor(idx / (DAYS * 4));
  idx %= DAYS * 4;
  return { season: SEASONS[Math.floor(idx / DAYS)], day: (idx % DAYS) + 1, year };
}
/** Nombre de jours de d jusqu'à (s, j), dans les 112 jours à venir. */
const daysUntil = (d: GameDate, s: Season, j: number) => (SEASONS.indexOf(s) * DAYS + j - (SEASONS.indexOf(d.season) * DAYS + d.day) + DAYS * 4) % (DAYS * 4);

const inRanges = (h: Range[], hr: number) => !h.length || h.some((r) => r.from <= hr && hr < r.to);

/** « jours 15–28 · » quand une fenêtre de jours s'applique cette saison. */
function daysNote(c: TodayData['captures'][number], bit: number) {
  const dj = [...(c.dj ?? []), ...(c.c ?? []).flatMap((x) => x.dj ?? [])].filter(([b]) => b & bit);
  return dj.length ? `jours ${[...new Set(dj.map(([, a, z]) => `${a}–${z}`))].join(', ')} · ` : '';
}

const uniqRanges = (h: Range[]) => [...new Map(h.map((r) => [`${r.from}-${r.to}`, r])).values()].sort((a, b) => a.from - b.from);

/** Zones où la capture est possible (vide = indisponible). `hr` null = n'importe quand dans la journée. */
export function catchZones(c: TodayData['captures'][number], bit: number, w: number, hr: number | null, day?: number): { zones: string[]; h: Range[] } {
  // Fenêtre de jours (poissons légendaires : « Été 1–14 »), propre à chaque zone
  const inDays = (x: Cond) => !x.dj || day == null || x.dj.some(([b, a, z]) => b & bit && a <= day && day <= z);
  const ok = (x: Cond) => !!(x.s & bit) && !!(x.w & (1 << w)) && (hr == null || inRanges(x.h, hr)) && inDays(x);
  if (c.c) {
    const m = c.c.filter(ok);
    return { zones: m.map((x) => x.z), h: uniqRanges(m.flatMap((x) => x.h)) };
  }
  return ok(c) ? { zones: [c.l], h: uniqRanges(c.h) } : { zones: [], h: [] };
}

/** Rentabilité d'une culture plantée aujourd'hui (prix de base, 1 récolte par plant). */
export function cropPlan(c: TodayData['cultures'][number], d: GameDate) {
  let rem = DAYS - d.day;
  for (let k = 1, s = SEASONS.indexOf(d.season); k < 4; k++) {
    if (!(c.s & (1 << ((s + k) % 4)))) break;
    rem += DAYS;
  }
  if (!(c.s & SBIT[d.season]) || rem < c.g) return null;
  const harvests = c.r > 0 ? 1 + Math.floor((rem - c.g) / c.r) : Math.floor(rem / c.g);
  const seeds = c.r > 0 ? 1 : harvests;
  const profit = harvests * c.v - seeds * c.pg;
  return { harvests, seeds, profit, rem };
}

export function openNow(b: TodayData['boutiques'][number], wd: number, hr: number) {
  if (b.f.includes(wd)) return { open: false, today: [] as Range[], known: true };
  const today = b.o.filter((o) => o.j.includes(wd)).flatMap((o) => o.p);
  const known = b.o.some((o) => o.j.length);
  return { open: today.some((r) => r.from <= hr && hr < r.to), today, known };
}

const fmtDate = (d: GameDate) => `${WEEKDAYS[weekday(d.day)]} ${d.day} ${SEASON_FR[d.season].toLowerCase()}`;
const CAP_TABS = [
  { d: 'poissons', label: 'Poissons', key: 'pris' },
  { d: 'insectes', label: 'Insectes', key: 'pris' },
  { d: 'creatures-marines', label: 'Créatures', key: 'pris' },
];

export function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => {
    Promise.all([loadToday(), loadEntries()]).then(([t]) => setData(t));
  }, []);
  const p = active.value;
  if (!p) return null;
  const d = p.date;
  return (
    <>
      <TopBar title="Aujourd'hui" actions={<a class="icon-btn" href="#/calendrier" aria-label="Calendrier des saisons"><Icon name="festivals" /></a>} />
      <main class="page" id="main">
        <DateCard />
        {p.favs.length > 0 && data && (
          <section>
            <h2 class="section-title">Favoris</h2>
            <div class="xchips fav-strip">
              {p.favs.map((id) => (
                <Chip key={id} id={id} />
              ))}
            </div>
          </section>
        )}
        {!data ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <Events data={data} d={d} />
            <Catchables data={data} />
            <Crops data={data} d={d} />
            <Shops data={data} />
          </>
        )}
      </main>
    </>
  );
}

function DateCard() {
  const p = active.value!;
  const d = p.date;
  const [edit, setEdit] = useState(false);
  const w = WEATHERS.indexOf(p.weather);
  return (
    <section class="hero-today date-card" aria-label="Date en jeu">
      <div class="date-row">
        <button class="icon-btn on-dark" aria-label="Jour précédent" onClick={() => setDate(shiftDate(d, -1))}>
          <Icon name="back" />
        </button>
        <button class="date-label" aria-expanded={edit} onClick={() => setEdit(!edit)}>
          <span class="date-main">{fmtDate(d)}</span>
          <span class="date-sub">
            An {d.year} · {WEATHER_FR[p.weather]} · {hours(p.hour)}
            {p.hour >= 24 ? ' (nuit)' : ''} · <u>modifier</u>
          </span>
        </button>
        <button class="icon-btn on-dark" aria-label="Jour suivant" onClick={() => setDate(shiftDate(d, 1))}>
          <Icon name="chevron" />
        </button>
      </div>
      {edit && (
        <div class="date-edit">
          <div class="seg seg-dark" role="group" aria-label="Saison">
            {SEASONS.map((s) => (
              <button key={s} aria-pressed={d.season === s} onClick={() => setDate({ ...d, season: s })}>
                {SEASON_FR[s]}
              </button>
            ))}
          </div>
          <div class="date-fields">
            <label>
              Jour
              <select value={d.day} onChange={(e) => setDate({ ...d, day: +(e.target as HTMLSelectElement).value })}>
                {Array.from({ length: DAYS }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} ({WEEKDAYS[i % 7].slice(0, 3)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Année
              <input type="number" inputMode="numeric" min={1} max={99} value={d.year} onChange={(e) => setDate({ ...d, year: Math.max(1, +(e.target as HTMLInputElement).value || 1) })} />
            </label>
          </div>
        </div>
      )}
      <div class="weather" role="group" aria-label="Météo">
        {WEATHERS.map((k, i) => (
          <button key={k} aria-pressed={w === i} aria-label={WEATHER_FR[k]} title={WEATHER_FR[k]} onClick={() => setWeather(k)}>
            {k === 'blizzard' ? <Icon name="blizzard" /> : <GIcon k={k} size={26} />}
          </button>
        ))}
      </div>
      <label class="hour">
        <Icon name="clock" />
        <span class="sr-only">Heure en jeu</span>
        <input type="range" min={6} max={25.5} step={0.5} value={p.hour} onInput={(e) => setHour(+(e.target as HTMLInputElement).value)} aria-valuetext={hours(p.hour)} />
        <output>{hours(p.hour)}</output>
      </label>
    </section>
  );
}

function Events({ data, d }: { data: TodayData; d: GameDate }) {
  const bdays = data.anniversaires
    .map((b) => ({ ...b, n: daysUntil(d, b.s, b.j) }))
    .filter((b) => b.n <= 7)
    .sort((a, b) => a.n - b.n);
  const fests = data.festivals
    .map((f) => ({ ...f, n: f.s === d.season && f.j <= d.day && d.day <= f.f ? 0 : daysUntil(d, f.s, f.j) }))
    .filter((f) => f.n <= 14)
    .sort((a, b) => a.n - b.n);
  const when = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`);
  return (
    <section>
      <h2 class="section-title">Événements</h2>
      <div class="card list">
        {fests.map((f) => {
          const e = entry(f.id);
          return (
            <a key={f.id} class={`row${f.n === 0 ? ' now' : ''}`} href={`#/fiche/${f.id}`}>
              <GameImg src={e?.img ?? ''} dom="festivals" size={44} />
              <span class="txt">
                <span class="name">{e?.fr ?? f.id}</span>
                <span class="sub">
                  Festival {when(f.n)} · {f.j === f.f ? `${f.j}` : `${f.j}–${f.f}`} {SEASON_FR[f.s].toLowerCase()}
                  {f.h ? ` · ${f.h}` : ''}
                </span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          );
        })}
        {bdays.map((b) => {
          const e = entry(b.id);
          return (
            <a key={b.id} class={`row${b.n === 0 ? ' now' : ''}`} href={`#/fiche/${b.id}`}>
              <GameImg src={e?.img ?? ''} dom="pnj" size={44} />
              <span class="txt">
                <span class="name">{e?.fr ?? b.id}</span>
                <span class="sub">
                  <Icon name="cake" class="inline-ic" /> Anniversaire {when(b.n)} · {b.j} {SEASON_FR[b.s].toLowerCase()}
                </span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          );
        })}
        {!fests.length && !bdays.length && <p class="note pad">Aucun anniversaire ni festival dans les 7 prochains jours.</p>}
      </div>
    </section>
  );
}

function Catchables({ data }: { data: TodayData }) {
  const p = active.value!;
  const [tab, setTab] = useState(0);
  const [allDay, setAllDay] = useState(false);
  const [hide, setHide] = useState(false);
  const [more, setMore] = useState(false);
  const bit = SBIT[p.date.season];
  const w = Math.max(0, WEATHERS.indexOf(p.weather));
  const lists = useMemo(
    () =>
      CAP_TABS.map((t) =>
        data.captures
          .filter((c) => c.d === t.d)
          .map((c) => ({ c, ...catchZones(c, bit, w, allDay ? null : p.hour, p.date.day) }))
          .filter((x) => x.zones.length)
          .sort((a, b) => (entry(a.c.id)?.fr ?? '').localeCompare(entry(b.c.id)?.fr ?? '', 'fr'))
          .sort((a, b) => +isChecked(`pris:${a.c.id}`) - +isChecked(`pris:${b.c.id}`)),
      ),
    [data, bit, w, allDay, p.hour, p.date.day],
  );
  const t = CAP_TABS[tab];
  const full = lists[tab].filter((x) => !hide || !isChecked(`pris:${x.c.id}`));
  const list = more ? full : full.slice(0, 8);
  const missing = lists[tab].filter((x) => !isChecked(`pris:${x.c.id}`)).length;
  return (
    <section>
      <h2 class="section-title">{allDay ? "Capturable aujourd'hui" : `Capturable à ${hours(p.hour)}`}</h2>
      <div class="chips" role="tablist" aria-label="Type de capture">
        {CAP_TABS.map((x, i) => (
          <button key={x.d} role="tab" class="chip" aria-selected={tab === i} onClick={() => setTab(i)}>
            {x.label} <span class="note">{lists[i].length}</span>
          </button>
        ))}
      </div>
      <div class="chips" role="group" aria-label="Options">
        <button class="chip" aria-pressed={allDay} onClick={() => setAllDay(!allDay)}>
          Toute la journée
        </button>
        <button class="chip" aria-pressed={hide} onClick={() => setHide(!hide)}>
          Pas encore attrapés <span class="note">{missing}</span>
        </button>
      </div>
      <div class="card list" role="tabpanel" aria-label={t.label}>
        {list.map(({ c, zones, h }) => {
          const e = entry(c.id);
          const key = `pris:${c.id}`;
          return (
            <div key={c.id} class="row trow">
              <CheckBtn on={isChecked(key)} label={`${e?.fr ?? c.id} : attrapé`} onToggle={() => toggle(key)} />
              <a class="trow-link" href={`#/fiche/${c.id}`}>
                <GameImg src={e?.img ?? ''} dom={c.d} size={40} />
                <span class="txt">
                  <span class="name">{e?.fr ?? c.id}</span>
                  <span class="sub">
                    {daysNote(c, bit)}
                    {ranges(h)} · {zones.join(', ')}
                    {c.r ? ` · ${c.r}` : ''}
                  </span>
                </span>
              </a>
            </div>
          );
        })}
        {!list.length && <p class="note pad">Rien à attraper avec ces conditions.</p>}
        {full.length > 8 && (
          <button class="more-btn" onClick={() => setMore(!more)}>
            {more ? 'Réduire' : `Voir les ${full.length}`}
          </button>
        )}
      </div>
      <p class="note fine">Créneaux du wiki (matin 6h–12h, après-midi 12h–16h, soir 16h–19h, nuit 19h–2h ; insectes jour 6h–18h, nuit 18h–2h) : fiabilité moyenne, à confirmer en jeu.</p>
    </section>
  );
}

function Crops({ data, d }: { data: TodayData; d: GameDate }) {
  const [all, setAll] = useState(false);
  const [ocean, setOcean] = useState(0);
  const list = useMemo(
    () =>
      data.cultures
        .filter((c) => {
          const e = entry(c.id);
          return e && e.dom === 'cultures' && e.cat !== 'Fruit (plante fruitière)' && c.o === ocean;
        })
        .map((c) => ({ c, plan: cropPlan(c, d) }))
        .filter((x) => x.plan && x.plan.profit > 0)
        .sort((a, b) => b.plan!.profit - a.plan!.profit),
    [data, d.season, d.day, ocean],
  );
  const shown = all ? list : list.slice(0, 8);
  return (
    <section>
      <h2 class="section-title">Encore rentable à planter</h2>
      <div class="chips" role="group" aria-label="Type de culture">
        <button class="chip" aria-pressed={ocean === 0} onClick={() => setOcean(0)}>
          Ferme
        </button>
        <button class="chip" aria-pressed={ocean === 1} onClick={() => setOcean(1)}>
          Ferme océanique
        </button>
      </div>
      <div class="card list">
        {shown.map(({ c, plan }) => {
          const e = entry(c.id)!;
          return (
            <a key={c.id} class="row" href={`#/fiche/${c.id}`}>
              <GameImg src={e.img} dom="cultures" size={44} />
              <span class="txt">
                <span class="name">
                  {e.fr} <strong class="gain">+{plan!.profit} PO</strong>
                </span>
                <span class="sub">
                  {plan!.harvests} récolte{plan!.harvests > 1 ? 's' : ''} en {plan!.rem} j · graine {c.pg} PO{c.r ? ` · repousse ${c.r} j` : ''}
                                    {c.rg ? ` · rang ${c.rg}` : ''}
                </span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          );
        })}
        {!list.length && <p class="note pad">Plus aucune culture rentable avant la fin de la saison.</p>}
        {list.length > 8 && (
          <button class="more-btn" onClick={() => setAll(!all)}>
            {all ? 'Réduire' : `Voir les ${list.length} cultures`}
          </button>
        )}
      </div>
      <p class="note fine">Bénéfice au prix de base, une récolte par plant, plantée et arrosée aujourd'hui. Plantes fruitières pérennes et arbres exclus.</p>
    </section>
  );
}

function Shops({ data }: { data: TodayData }) {
  const p = active.value!;
  const wd = weekday(p.date.day);
  const list = data.boutiques
    .filter((b) => b.m)
    .map((b) => ({ b, ...openNow(b, wd, p.hour) }))
    .sort((a, b) => +b.open - +a.open || (entry(a.b.id)?.fr ?? '').localeCompare(entry(b.b.id)?.fr ?? '', 'fr'));
  const nOpen = list.filter((x) => x.open).length;
  return (
    <section>
      <h2 class="section-title">
        Boutiques · {nOpen} ouverte{nOpen > 1 ? 's' : ''} à {hours(p.hour)}
      </h2>
      <div class="card list">
        {list.map(({ b, open, today, known }) => {
          const e = entry(b.id);
          return (
            <a key={b.id} class="row" href={`#/fiche/${b.id}`}>
              <GameImg src={e?.img ?? ''} dom="lieux" size={44} />
              <span class="txt">
                <span class="name">{e?.fr ?? b.id}</span>
                <span class="sub">
                  <span class={`state ${open ? 'ok' : 'ko'}`}>{open ? 'Ouvert' : 'Fermé'}</span>{' '}
                  {!known ? 'horaires à vérifier' : today.length ? `aujourd'hui ${ranges(today)}` : `fermé le ${WEEKDAYS[wd].toLowerCase()}`}
                </span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          );
        })}
      </div>
      <p class="note fine">Horaires du wiki. Fermetures exceptionnelles (festivals, événements) : voir la fiche du lieu.</p>
    </section>
  );
}
