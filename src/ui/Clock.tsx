// Jour de jeu persistant : puce compacte (saison, jour, météo) en haut de chaque écran.
// Toucher → sheet de réglage rapide (jour précédent / suivant, saison, jour, météo). Pas d'heure à régler :
// l'app raisonne à la journée et affiche les plages horaires de chaque chose.
import { signal } from '@preact/signals';
import { SEASONS, SEASON_FR, type Season } from '../app/data.ts';
import { GIcon } from '../app/components.tsx';
import { Icon } from '../app/icons.tsx';
import { active, setDate, setWeather, weekday, WEEKDAYS, type GameDate } from '../app/store.ts';
import { Sheet } from './Sheet.tsx';
import { Segmented } from './controls.tsx';

export const clockOpen = signal(false);
export const WEATHERS: [string, string][] = [
  ['sunny', 'Soleil'],
  ['rain', 'Pluie'],
  ['storm', 'Orage'],
  ['snow', 'Neige'],
  ['windy', 'Vent'],
  ['blizzard', 'Blizzard'],
];
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


const weatherIcon = (w: string) => (w === 'blizzard' ? <Icon name="blizzard" /> : <GIcon k={w} size={18} />);

export function ClockChip() {
  const p = active.value;
  if (!p) return null;
  const d = p.date;
  return (
    <button class="clock-chip" onClick={() => (clockOpen.value = true)} aria-label={`Jour de jeu : ${WEEKDAYS[weekday(d.day)]} ${d.day} ${SEASON_FR[d.season]}, ${WEATHERS.find((w) => w[0] === p.weather)?.[1]}. Modifier`}>
      <span class="dot" style={{ background: `var(--${d.season})` }} aria-hidden="true" />
      <span aria-hidden="true">
        {WEEKDAYS[weekday(d.day)].slice(0, 3)}. {d.day} {SEASON_FR[d.season].slice(0, 3).toLowerCase()}.
      </span>
      <span aria-hidden="true">{weatherIcon(p.weather)}</span>
    </button>
  );
}

export function ClockSheet() {
  const p = active.value;
  const close = () => (clockOpen.value = false);
  return (
    <Sheet open={clockOpen.value} onClose={close} title="Jour de jeu" detent="fit">
      {p && (
        <div class="clock-panel">
          <div class="clock-now">
            <strong>
              {WEEKDAYS[weekday(p.date.day)]} {p.date.day} {SEASON_FR[p.date.season].toLowerCase()}
              <span class="t-subhead c-2"> · an {p.date.year}</span>
            </strong>
          </div>
          <div class="stepper two">
            <button onClick={() => setDate(shiftDate(p.date, -1))}>Jour précédent</button>
            <button onClick={() => setDate(shiftDate(p.date, 1))}>Jour suivant</button>
          </div>
          <Segmented<Season> label="Saison" value={p.date.season} onChange={(s) => setDate({ ...p.date, season: s })} options={SEASONS.map((s) => [s, SEASON_FR[s]])} />
          <div class="day-grid" role="group" aria-label="Jour de la saison">
            {Array.from({ length: DAYS }, (_, i) => (
              <button key={i} aria-pressed={p.date.day === i + 1} onClick={() => setDate({ ...p.date, day: i + 1 })} aria-label={`${WEEKDAYS[i % 7]} ${i + 1}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div class="weather-pick" role="group" aria-label="Météo">
            {WEATHERS.map(([k, l]) => (
              <button key={k} aria-pressed={p.weather === k} onClick={() => setWeather(k)}>
                {weatherIcon(k)}
                {l}
              </button>
            ))}
          </div>
          <div class="clock-foot">
            <label class="year">
              An
              <input type="number" inputMode="numeric" min={1} max={99} value={p.date.year} onChange={(e) => setDate({ ...p.date, year: Math.max(1, +(e.target as HTMLInputElement).value || 1) })} />
            </label>
            <a class="btn ghost" href="#/calendrier" onClick={close}>
              <Icon name="calendar-days" /> Calendrier
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}
