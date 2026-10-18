// Calendrier : festivals et anniversaires par saison (grille de 4 semaines, lundi en premier).
import { useEffect, useState } from 'preact/hooks';
import { entry, loadEntries, SEASONS, SEASON_FR, type Season } from '../data.ts';
import { Empty, GameImg, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, setDate, WEEKDAYS } from '../store.ts';
import { loadToday, type TodayData } from './Today.tsx';
import { go, route } from '../router.ts';

export function CalendarPage() {
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => {
    Promise.all([loadToday(), loadEntries()]).then(([t]) => setData(t));
  }, []);
  const p = active.value;
  const q = route.value.query;
  const season = (SEASONS.includes(q.get('saison') as Season) ? q.get('saison') : p?.date.season ?? 'spring') as Season;
  const [sel, setSel] = useState<number>(p && p.date.season === season ? p.date.day : 1);
  const setSeason = (s: Season) => go('/calendrier', { saison: s }, true);

  const evOf = (day: number) => {
    if (!data) return { f: [], b: [] };
    return {
      f: data.festivals.filter((f) => f.s === season && f.j <= day && day <= f.f),
      b: data.anniversaires.filter((b) => b.s === season && b.j === day),
    };
  };
  const cur = evOf(sel);
  return (
    <>
      <TopBar title="Calendrier" large backTo="/" />
      <main class="page" id="main">
        <div class="seg seg-full" role="group" aria-label="Saison">
          {SEASONS.map((s) => (
            <button key={s} aria-pressed={season === s} onClick={() => setSeason(s)}>
              {SEASON_FR[s]}
            </button>
          ))}
        </div>
        {!data ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <div class="cal" role="grid" aria-label={`Calendrier ${SEASON_FR[season]}`}>
              <div class="cal-row" role="row">
                {WEEKDAYS.map((w) => (
                  <span key={w} class="cal-h" role="columnheader" aria-label={w}>
                    {w.slice(0, 3)}
                  </span>
                ))}
              </div>
              {[0, 1, 2, 3].map((wk) => (
                <div key={wk} class="cal-row" role="row">
                  {Array.from({ length: 7 }, (_, i) => {
                    const day = wk * 7 + i + 1;
                    const ev = evOf(day);
                    const today = p && p.date.season === season && p.date.day === day;
                    const label = [`${WEEKDAYS[i]} ${day}`, ...ev.f.map((f) => entry(f.id)?.fr ?? f.id), ...ev.b.map((b) => `anniversaire de ${entry(b.id)?.fr ?? b.id}`)].join(', ');
                    return (
                      <button key={day} role="gridcell" class={`cal-d${today ? ' today' : ''}${ev.f.length ? ' fest' : ''}`} aria-selected={sel === day} aria-label={label} onClick={() => setSel(day)}>
                        <span class="cal-n">{day}</span>
                        <span class="cal-dots" aria-hidden="true">
                          {ev.b.slice(0, 2).map((b) => (
                            <GameImg key={b.id} src={entry(b.id)?.img ?? ''} dom="pnj" size={20} />
                          ))}
                          {ev.f.length > 0 && <Icon name="festivals" class="cal-f" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <section>
              <h2 class="section-title">
                {WEEKDAYS[(sel - 1) % 7]} {sel} {SEASON_FR[season].toLowerCase()}
              </h2>
              <div class="card list">
                {cur.f.map((f) => (
                  <a key={f.id} class="row" href={`#/fiche/${f.id}`}>
                    <GameImg src={entry(f.id)?.img ?? ''} dom="festivals" size={44} />
                    <span class="txt">
                      <span class="name">{entry(f.id)?.fr ?? f.id}</span>
                      <span class="sub">Festival{f.h ? ` · ${f.h}` : ''}</span>
                    </span>
                    <Icon name="chevron" class="chev" />
                  </a>
                ))}
                {cur.b.map((b) => (
                  <a key={b.id} class="row" href={`#/fiche/${b.id}`}>
                    <GameImg src={entry(b.id)?.img ?? ''} dom="pnj" size={44} />
                    <span class="txt">
                      <span class="name">{entry(b.id)?.fr ?? b.id}</span>
                      <span class="sub">Anniversaire · voir les cadeaux aimés</span>
                    </span>
                    <Icon name="chevron" class="chev" />
                  </a>
                ))}
                {!cur.f.length && !cur.b.length && <p class="note pad">Aucun événement ce jour-là.</p>}
              </div>
              {p && (
                <button class="btn ghost wide" onClick={() => { setDate({ ...p.date, season, day: sel }); go('/'); }}>
                  Définir comme date du jour
                </button>
              )}
            </section>
            <section>
              <h2 class="section-title">Toute la saison</h2>
              <div class="card list">
                {[...data.festivals.filter((f) => f.s === season).map((f) => ({ id: f.id, j: f.j, t: `Festival · ${f.j === f.f ? f.j : `${f.j}–${f.f}`}` })), ...data.anniversaires.filter((b) => b.s === season).map((b) => ({ id: b.id, j: b.j, t: `Anniversaire · ${b.j}` }))]
                  .sort((a, b) => a.j - b.j)
                  .map((x) => (
                    <a key={x.id} class="row" href={`#/fiche/${x.id}`}>
                      <GameImg src={entry(x.id)?.img ?? ''} dom={entry(x.id)?.dom ?? 'pnj'} size={40} />
                      <span class="txt">
                        <span class="name">{entry(x.id)?.fr ?? x.id}</span>
                        <span class="sub">{x.t} {SEASON_FR[season].toLowerCase()}</span>
                      </span>
                      <Icon name="chevron" class="chev" />
                    </a>
                  ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
