// Onglet Aujourd'hui : ce qui compte maintenant, en modules empilés (façon Météo).
// Tout se recalcule quand l'horloge de jeu change (puce en haut, sheet de réglage).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, loadEntries, SEASON_FR, type Entry } from '../data.ts';
import { GameImg, GIcon, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, checks, setDate, setHour, toggleWithUndo, weekday, WEEKDAYS } from '../store.ts';
import { hours } from '../fiche/labels.ts';
import { catchState, cropPlan, daysUntil, inDays, loadToday, SBIT, shopState, type TodayData } from '../game.ts';
import { loadTemple } from '../trackers.ts';
import { toast } from '../../ui/feedback.tsx';
import { RecentFeed } from '../../ui/RecentFeed.tsx';
import { addHours, ClockChip, clockOpen, shiftDate } from '../../ui/Clock.tsx';
import { Pill } from '../../ui/controls.tsx';
import { openFiche } from '../router.ts';

// Compatibilité : anciens imports depuis cette page
export { loadToday, catchZones, openNow, type TodayData } from '../game.ts';
export { shiftDate };

/** Moment de la journée → teinte du module d'en-tête (matin, journée, soir, nuit). */
function moment(h: number) {
  if (h < 9) return { k: 'aube', label: 'Matin' };
  if (h < 16) return { k: 'jour', label: 'Journée' };
  if (h < 19) return { k: 'soir', label: 'Soir' };
  return { k: 'nuit', label: 'Nuit' };
}

export function TodayPage() {
  const [t, setT] = useState<TodayData | null>(null);
  useEffect(() => {
    Promise.all([loadToday(), loadEntries()]).then(([d]) => setT(d));
  }, []);
  const p = active.value;
  if (!p) return null;
  const d = p.date;
  const m = moment(p.hour);
  return (
    <>
      <TopBar
        title="Aujourd'hui"
        large
        subtitle={`${p.name} · an ${d.year}`}
        leading={
          <a class="icon-btn" href="#/reglages" aria-label="Réglages et profils">
            <Icon name="settings" />
          </a>
        }
        actions={<ClockChip />}
      />
      <main class="page today" id="main">
        <section class={`now-hero ${m.k} ${d.season}`} aria-label="Heure de jeu">
          <button class="now-hero-main" onClick={() => (clockOpen.value = true)} aria-label="Modifier l'heure de jeu">
            <span class="now-day">
              {WEEKDAYS[weekday(d.day)]} {d.day} {SEASON_FR[d.season].toLowerCase()}
            </span>
            <span class="now-time">{hours(p.hour)}</span>
            <span class="now-meta">
              {p.weather === 'blizzard' ? <Icon name="blizzard" /> : <GIcon k={p.weather} size={22} />} {m.label}
            </span>
          </button>
          <div class="now-steps">
            <button onClick={() => addHours(1)}>+1 h</button>
            <button
              onClick={() => {
                setDate(shiftDate(d, 1));
                setHour(6);
              }}
            >
              Jour suivant
            </button>
          </div>
        </section>
        {!t ? <div class="skeleton-list" aria-busy="true" /> : <Modules t={t} />}
      </main>
    </>
  );
}

function Modules({ t }: { t: TodayData }) {
  const p = active.value!;
  const d = p.date;
  const catches = useMemo(
    () =>
      t.captures
        .map((c) => ({ c, st: catchState(c, d, p.weather, p.hour), done: !!checks.value[`pris:${c.id}`] }))
        .filter((x) => x.st.now)
        .sort((a, b) => +a.done - +b.done || (entry(a.c.id)?.fr ?? '').localeCompare(entry(b.c.id)?.fr ?? '', 'fr')),
    [t, d.season, d.day, p.weather, p.hour, checks.value],
  );
  const missing = catches.filter((x) => !x.done);
  const [showAll, setShowAll] = useState(false);
  // Objets de saison (cueillette, cultures…) attendus par une offrande du temple pas encore faite
  const [temple, setTemple] = useState<any>(null);
  useEffect(() => {
    loadTemple().then(setTemple);
  }, []);
  const templeNow = useMemo(() => {
    if (!temple) return [];
    const bit = SBIT[d.season];
    const out = new Map<string, Entry>();
    for (const a of temple.autels)
      for (const o of a.offrandes)
        for (const it of o.objets) {
          const e = entry(it.id);
          if (!e || checks.value[`temple:${o.id}:${it.id}`] || t.captures.some((c) => c.id === it.id)) continue;
          if (e.seasons && e.seasons & bit && e.seasons !== 15) out.set(e.id, e);
        }
    return [...out.values()];
  }, [temple, d.season, checks.value]);
  const events = [
    ...t.festivals.map((f) => ({ id: f.id, n: f.s === d.season && f.j <= d.day && d.day <= f.f ? 0 : daysUntil(d, f.s, f.j), kind: 'fest' as const })),
    ...t.anniversaires.map((b) => ({ id: b.id, n: daysUntil(d, b.s, b.j), kind: 'bday' as const })),
  ]
    .filter((x) => x.n <= 7)
    .sort((a, b) => a.n - b.n);
  const open = t.boutiques
    .filter((b) => b.m)
    .map((b) => ({ b, st: shopState(b, d, p.hour) }))
    .filter((x) => x.st.open)
    .sort((a, b) => (a.st.close ?? 0) - (b.st.close ?? 0));
  const crops = t.cultures
    .filter((c) => entry(c.id)?.dom === 'cultures' && entry(c.id)?.cat !== 'Fruit (plante fruitière)' && !c.o)
    .map((c) => ({ c, plan: cropPlan(c, d) }))
    .filter((x) => x.plan && x.plan.profit > 0)
    .sort((a, b) => b.plan!.profit / b.plan!.rem - a.plan!.profit / a.plan!.rem)
    .slice(0, 4);
  const pins = (p.session ?? []).map((id) => entry(id)).filter(Boolean).slice(0, 8);

  return (
    <div class="modules">
      {pins.length > 0 && (
        <section class="module" aria-labelledby="m-session">
          <div class="module-head" id="m-session">
            <Icon name="session" /> Ma session
          </div>
          <div class="strip">
            {pins.map((e) => (
              <button key={e!.id} class="strip-item" onClick={() => openFiche(e!.id)}>
                <GameImg src={e!.img} dom={e!.dom} size={52} />
                <span>{e!.fr}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="module" aria-labelledby="m-catch">
        <div class="module-head" id="m-catch">
          <Icon name="poissons" /> Manquant et disponible maintenant
        </div>
        <div class="big-row">
          <span class="big-num">{missing.length}</span>
          <span class="t-subhead c-2">
            à attraper à {hours(p.hour)} que vous n'avez pas encore{catches.length > missing.length ? ` (${catches.length - missing.length} déjà pris)` : ''}
          </span>
        </div>
        {missing.length > 0 ? (
          <ul class="mod-list">
            {missing.slice(0, showAll ? 60 : 6).map(({ c, st }) => {
              const e = entry(c.id);
              const k = `pris:${c.id}`;
              return (
                <li key={c.id} class="with-check">
                  <button onClick={() => openFiche(c.id)}>
                    <GameImg src={e?.img ?? ''} dom={c.d} size={40} />
                    <span class="txt">
                      <span class="name">{e?.fr ?? c.id}</span>
                      <span class="sub">
                        {st.zones.slice(0, 2).join(', ')}
                        {e?.use?.m && !checks.value[`musee:${c.id}`] ? ' · musée' : ''}
                        {e?.use?.t?.some((o) => !checks.value[`temple:${o}:${c.id}`]) ? ' · temple' : ''}
                      </span>
                    </span>
                  </button>
                  <button class="check-mini" aria-label={`${e?.fr ?? c.id} : attrapé`} onClick={() => toggleWithUndo(k, e?.fr ?? c.id, toast)}>
                    <Icon name="check" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="t-subhead c-2">Tout ce qui est disponible maintenant est déjà dans votre journal.</p>
        )}
        {missing.length > 6 && (
          <button class="more-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Réduire' : `Voir les ${missing.length}`}
          </button>
        )}
        {templeNow.length > 0 && (
          <>
            <div class="mini-h" style={{ marginTop: 12 }}>
              De saison, attendu au temple
            </div>
            <div class="strip">
              {templeNow.slice(0, 14).map((e) => (
                <button key={e.id} class="strip-item" onClick={() => openFiche(e.id)}>
                  <GameImg src={e.img} dom={e.dom} size={52} />
                  <span>{e.fr}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section class="module" aria-labelledby="m-week">
        <div class="module-head" id="m-week">
          <Icon name="cake" /> Cette semaine
          <a class="more" href="#/calendrier">
            Calendrier
          </a>
        </div>
        {events.length ? (
          <ul class="mod-list">
            {events.map((x) => {
              const e = entry(x.id);
              return (
                <li key={x.kind + x.id}>
                  <button onClick={() => openFiche(x.id)}>
                    <GameImg src={e?.img ?? ''} dom={x.kind === 'fest' ? 'festivals' : 'pnj'} size={40} />
                    <span class="txt">
                      <span class="name">{e?.fr ?? x.id}</span>
                      <span class="sub">{x.kind === 'fest' ? 'Festival' : 'Anniversaire'}</span>
                    </span>
                    {x.n === 0 ? <Pill kind="live">{x.kind === 'fest' ? 'En cours' : "Aujourd'hui"}</Pill> : <span class="c-2 tabular">{inDays(x.n)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="t-subhead c-2">Aucun anniversaire ni festival dans les 7 jours.</p>
        )}
      </section>

      <section class="module" aria-labelledby="m-shops">
        <div class="module-head" id="m-shops">
          <Icon name="shop" /> Boutiques
          <a class="more" href="#/chercher/lieux?filtre=ouverts">
            Toutes
          </a>
        </div>
        <div class="big-row">
          <span class="big-num">{open.length}</span>
          <span class="t-subhead c-2">ouvertes à {hours(p.hour)}</span>
        </div>
        <ul class="mod-list dense">
          {open.slice(0, 5).map(({ b, st }) => (
            <li key={b.id}>
              <button onClick={() => openFiche(b.id)}>
                <span class="txt">
                  <span class="name">{entry(b.id)?.fr ?? b.id}</span>
                </span>
                <span class="c-2 tabular">jusqu'à {hours(st.close)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section class="module" aria-labelledby="m-crops">
        <div class="module-head" id="m-crops">
          <Icon name="cultures" /> À planter aujourd'hui
          <a class="more" href="#/chercher/cultures?filtre=plantable">
            Toutes
          </a>
        </div>
        {crops.length ? (
          <ul class="mod-list">
            {crops.map(({ c, plan }) => {
              const e = entry(c.id)!;
              return (
                <li key={c.id}>
                  <button onClick={() => openFiche(c.id)}>
                    <GameImg src={e.img} dom="cultures" size={40} />
                    <span class="txt">
                      <span class="name">{e.fr}</span>
                      <span class="sub tabular">
                        {plan!.harvests} récolte{plan!.harvests > 1 ? 's' : ''} · graine {c.pg} PO
                      </span>
                    </span>
                    <span class="gain">+{Math.round(plan!.profit / plan!.rem)} PO/j</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="t-subhead c-2">Plus rien de rentable avant la fin de la saison.</p>
        )}
      </section>

      <RecentFeed />
    </div>
  );
}
