// Informations contextuelles d'une fiche : ce qui sert en jouant, sans changer de page.
//  - « En ce moment » : boutique ouverte ?, espèce disponible ?, culture encore rentable ?, anniversaire, festival ;
//  - « Améliorer » : niveaux d'un outil, d'un bâtiment, d'un équipement (or, matériaux, durée) ;
//  - « Nécessaire pour » : améliorations et constructions qui consomment ce matériau ;
//  - « À trouver ici » : espèces d'un lieu, filtrées par saison.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Entity } from '../../data/schema.ts';
import { entry, SEASONS, SEASON_FR, type Season } from '../data.ts';
import { CheckBtn, GameImg, GIcon, Gold } from '../components.tsx';
import { active, isChecked, toggle, weekday, WEEKDAYS, type GameDate } from '../store.ts';
import { catchZones, cropCalc, loadToday, nextOpening, openNow, whereNow, type TodayData } from '../game.ts';
import { hours, ranges } from './labels.ts';
import { Chip, Section } from './parts.tsx';
import { UpgradeList } from './upgrades.tsx';

type X = Record<string, any>;
const SBIT: Record<Season, number> = { spring: 1, summer: 2, fall: 4, winter: 8 };
const W = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];
const DAYS = 28;
const dayIndex = (d: GameDate) => SEASONS.indexOf(d.season) * DAYS + d.day - 1;
const until = (d: GameDate, s: Season, j: number) => (SEASONS.indexOf(s) * DAYS + j - 1 - dayIndex(d) + DAYS * 4) % (DAYS * 4);
const inDays = (n: number) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`);

function useToday() {
  const [t, setT] = useState<TodayData | null>(null);
  useEffect(() => {
    loadToday().then(setT);
  }, []);
  return t;
}

function ShopNow({ b, d, hr, label }: { b: TodayData['boutiques'][number]; d: GameDate; hr: number; label?: ComponentChildren }) {
  const st = openNow(b, weekday(d.day), hr);
  const close = st.today.find((r) => r.from <= hr && hr < r.to)?.to;
  const next = st.open ? null : nextOpening(b, d, hr);
  return (
    <li>
      {label}
      <span class={`state ${st.open ? 'ok' : 'ko'}`}>{st.open ? 'Ouvert' : 'Fermé'}</span>{' '}
      {st.open ? `· jusqu'à ${hours(close)}` : next ? `· ouvre ${next.k === 0 ? "aujourd'hui" : next.k === 1 ? 'demain' : WEEKDAYS[next.wd].toLowerCase()} à ${hours(next.from)}` : 'horaires à vérifier'}
    </li>
  );
}

/** Carte « En ce moment » selon la date, la météo et l'heure du profil (masquée si rien d'utile). */
export function NowCard({ e, dom }: { e: Entity; dom: string }) {
  const t = useToday();
  const p = active.value;
  if (!t || !p) return null;
  const d = p.date;
  const hr = p.hour;
  const lines: ComponentChildren[] = [];

  // Boutique
  const shop = t.boutiques.find((b) => b.id === e.id);
  if (shop) lines.push(<ShopNow key="shop" b={shop} d={d} hr={hr} />);

  // Habitant : où il est maintenant, sa boutique, son anniversaire
  if (dom === 'pnj') {
    const sched = (e.extra as X).emploi_du_temps;
    const w = Array.isArray(sched) ? whereNow(sched, d, p.weather, hr) : null;
    if (w)
      lines.push(
        <li key="where">
          <strong>{w.texte.replace(/\.$/, '')}</strong>
          {w.depuis != null && <span class="note"> · depuis {hours(w.depuis)}</span>}
        </li>,
      );
    for (const b of t.boutiques.filter((b) => b.own?.includes(e.id)))
      lines.push(<ShopNow key={b.id} b={b} d={d} hr={hr} label={<>{entry(b.id)?.fr ?? b.id} : </>} />);
    const bd = t.anniversaires.find((a) => a.id === e.id);
    if (bd) {
      const n = until(d, bd.s, bd.j);
      if (n <= 14) lines.push(<li key="bd">Anniversaire {inDays(n)}</li>);
    }
  }

  // Festival
  const fest = t.festivals.find((f) => f.id === e.id);
  if (fest) {
    const now = fest.s === d.season && fest.j <= d.day && d.day <= fest.f;
    lines.push(<li key="fest">{now ? <strong>En cours aujourd'hui</strong> : `Dans ${until(d, fest.s, fest.j)} jours`}</li>);
  }

  // Poisson, insecte, créature : disponible maintenant ?
  const cap = t.captures.find((c) => c.id === e.id);
  if (cap) {
    const w = Math.max(0, W.indexOf(p.weather));
    const now = catchZones(cap, SBIT[d.season], w, hr, d.day);
    const day = catchZones(cap, SBIT[d.season], w, null, d.day);
    lines.push(
      <li key="cap">
        {now.zones.length ? (
          <>
            <span class="state ok">Disponible maintenant</span> · {now.zones.join(', ')}
          </>
        ) : day.zones.length ? (
          <>
            <span class="state ko">Pas à {hours(hr)}</span> · aujourd'hui {ranges(day.h)}
          </>
        ) : (
          <>
            <span class="state ko">Pas aujourd'hui</span> · {cap.s & SBIT[d.season] ? 'météo ou jour défavorable' : `hors saison (${SEASON_FR[d.season].toLowerCase()})`}
          </>
        )}
      </li>,
    );
  }

  // Culture : encore rentable si plantée aujourd'hui ?
  const crop = t.cultures.find((c) => c.id === e.id || c.gr === e.id);
  if (crop && dom !== 'arbres') {
    const r = cropCalc(crop, d.season, d.day, 1, 1);
    lines.push(
      <li key="crop">
        {!r ? (
          <>Ne pousse pas en {SEASON_FR[d.season].toLowerCase()}</>
        ) : r.harvests === 0 ? (
          <>Trop tard pour planter (il faut {crop.g} jours)</>
        ) : (
          <>
            Plantée aujourd'hui : {r.harvests} récolte{r.harvests > 1 ? 's' : ''} ·{' '}
            <strong class={r.profit > 0 ? 'gain' : 'loss'}>
              {r.profit > 0 ? '+' : ''}
              {r.profit} PO
            </strong>{' '}
            par plant · dernier jour : {r.lastDay}
          </>
        )}
      </li>,
    );
  }
  if (!lines.length) return null;
  return (
    <div class="card now-card" aria-label="En ce moment">
      <div class="now-h">
        {WEEKDAYS[weekday(d.day)]} {d.day} {SEASON_FR[d.season].toLowerCase()} · {hours(hr)}
      </div>
      <ul class="now-l">{lines}</ul>
    </div>
  );
}

/** Améliorations d'un outil, d'un bâtiment ou d'un équipement, regroupées par magasin. */
export function UpgradeSection({ e }: { e: Entity }) {
  const rows = ((e.extra as X).ameliorations ?? []) as X[];
  const t = useToday();
  const p = active.value;
  if (!rows.length) return null;
  const shops = [...new Set(rows.map((r) => r.lieu))];
  const title = rows.length === 1 && !/^(bronze|silver|gold|osmium)\b|level|stage/i.test(rows[0].nom) ? 'Obtenir' : 'Améliorer';
  return (
    <Section title={title} count={rows.length > 1 ? rows.length : undefined}>
      {shops.map((s) => {
        const b = t?.boutiques.find((x) => x.id === s);
        return (
          <div key={s} class="up-at">
            <p class="up-shopline">
              Chez <Chip id={s} size={24} />
              {b && p && (
                <span class="note">
                  <ul class="now-l inline">
                    <ShopNow b={b} d={p.date} hr={p.hour} />
                  </ul>
                </span>
              )}
            </p>
            <UpgradeList rows={rows.filter((r) => r.lieu === s)} compact />
          </div>
        );
      })}
    </Section>
  );
}

const LV: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', osmium: 'Osmium' };
const levelOf = (nom: string) => /^(bronze|silver|gold|osmium)\b/i.exec(nom)?.[1].toLowerCase();

/** Matériau : ce qu'il permet d'améliorer ou de construire, avec la quantité et le total. */
export function NeededFor({ e }: { e: Entity }) {
  const rows = ((e.extra as X).utilise_pour ?? []) as X[];
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; item?: string; lieu: string; label?: string; parts: { lv?: string; nom: string; n: number }[] }>();
    for (const r of rows) {
      const key = r.item ? `${r.lieu}|${r.item}` : `${r.lieu}|qualite`;
      const g = m.get(key) ?? { key, item: r.item, lieu: r.lieu, label: r.item ? undefined : 'Amélioration de la qualité', parts: [] as { lv?: string; nom: string; n: number }[] };
      g.parts.push({ lv: r.niveau ?? levelOf(r.nom), nom: r.nom, n: r.n });
      m.set(key, g);
    }
    return [...m.values()];
  }, [rows]);
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.n, 0);
  return (
    <Section title="Nécessaire pour" count={groups.length}>
      <ul class="need">
        {groups.map((g) => (
          <li key={g.key}>
            <div class="need-h">
              {g.item ? <Chip id={g.item} size={28} /> : <strong>{g.label}</strong>}
              <span class="note">chez {entry(g.lieu)?.fr ?? g.lieu}</span>
            </div>
            <div class="need-p">
              {g.parts.map((pt, i) => (
                <span key={i} class="need-chip">
                  {pt.lv && <GIcon k={pt.lv} size={16} />}
                  {pt.lv ? `${LV[pt.lv]}${pt.nom.includes('·') ? ` · ${pt.nom.split('· ')[1]}` : ''}` : g.parts.length > 1 ? pt.nom : ''} <strong>×{pt.n}</strong>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p class="note fine">Total pour tout réaliser : ×{total.toLocaleString('fr-FR')}</p>
    </Section>
  );
}

const SP_TABS: [string, string][] = [
  ['poissons', 'Poissons'],
  ['insectes', 'Insectes'],
  ['creatures-marines', 'Créatures'],
  ['cueillette', 'Cueillette'],
];
const CHECKABLE: Record<string, string> = { poissons: 'pris', insectes: 'pris', 'creatures-marines': 'pris' };

/** Lieu : ce qu'on peut y pêcher, attraper ou ramasser, saison du profil par défaut. */
export function SpeciesHere({ e }: { e: Entity }) {
  const all = ((e.extra as X).especes_ici ?? []) as X[];
  const p = active.value;
  const [season, setSeason] = useState<Season | ''>(p?.date.season ?? '');
  const tabs = SP_TABS.filter(([d]) => all.some((s) => entry(s.id)?.dom === d));
  const [tab, setTab] = useState(tabs[0]?.[0] ?? '');
  if (!all.length) return null;
  const list = all
    .filter((s) => entry(s.id)?.dom === tab && (!season || !s.saisons?.length || s.saisons.includes(season)))
    .sort((a, b) => (entry(a.id)?.fr ?? '').localeCompare(entry(b.id)?.fr ?? '', 'fr'));
  const uniq = [...new Map(list.map((s) => [s.id, s])).values()];
  return (
    <Section title="À trouver ici" count={new Set(all.map((s) => s.id)).size}>
      {tabs.length > 1 && (
        <div class="chips" role="tablist" aria-label="Type">
          {tabs.map(([d, l]) => (
            <button key={d} role="tab" class="chip" aria-selected={tab === d} onClick={() => setTab(d)}>
              {l} <span class="note">{new Set(all.filter((s) => entry(s.id)?.dom === d).map((s) => s.id)).size}</span>
            </button>
          ))}
        </div>
      )}
      <div class="chips" role="group" aria-label="Saison">
        <button class="chip" aria-pressed={!season} onClick={() => setSeason('')}>
          Toute l'année
        </button>
        {SEASONS.map((s) => (
          <button key={s} class="chip" aria-pressed={season === s} onClick={() => setSeason(s)}>
            <span class="season-dot" style={{ background: `var(--s-${s})` }} />
            {SEASON_FR[s]}
          </button>
        ))}
      </div>
      <div class="list here-list">
        {uniq.map((s) => {
          const en = entry(s.id);
          const key = CHECKABLE[tab] ? `${CHECKABLE[tab]}:${s.id}` : '';
          const zones = [...new Set(list.filter((x) => x.id === s.id).map((x) => x.zone))].join(', ');
          return (
            <div key={s.id} class={`row trow${key && isChecked(key) ? ' done' : ''}`}>
              {key && <CheckBtn on={isChecked(key)} label={`${en?.fr ?? s.id} : attrapé`} onToggle={() => toggle(key)} />}
              <a class="trow-link" href={`#/fiche/${s.id}`}>
                <GameImg src={en?.img ?? ''} dom={en?.dom ?? 'objets'} size={36} />
                <span class="txt">
                  <span class="name">{en?.fr ?? s.id}</span>
                  <span class="sub">{zones}</span>
                </span>
              </a>
            </div>
          );
        })}
        {!uniq.length && <p class="note pad">Rien ici pour cette saison.</p>}
      </div>
    </Section>
  );
}


/** Où l'acheter : prix, rang requis, saisons, et si la boutique est ouverte en ce moment. */
export function Vendors({ rows }: { rows: X[] }) {
  const t = useToday();
  const p = active.value;
  const list = rows.filter((v) => !v.materiaux);
  if (!list.length) return null;
  return (
    <Section title="Vendu par" count={list.length}>
      <ul class="vendors">
        {list.map((v, i) => {
          const b = t?.boutiques.find((x) => x.id === v.lieu);
          const st = b && p ? openNow(b, weekday(p.date.day), p.hour) : null;
          const offSeason = p && v.saisons && v.saisons.length < 4 && !v.saisons.includes(p.date.season);
          return (
            <li key={i}>
              <Chip id={v.lieu} size={28} />
              <span class="v-meta">
                {v.prix != null && (v.devise === 'or' ? <Gold n={v.prix} /> : <span>{v.prix} {v.devise}</span>)}
                {v.rang && <span class="badge">rang {v.rang}</span>}
                {v.saisons && v.saisons.length < 4 && <span class={offSeason ? 'ko-txt' : ''}>{v.saisons.map((s: Season) => SEASON_FR[s]).join(', ')}</span>}
                {st && <span class={`state ${st.open ? 'ok' : 'ko'}`}>{st.open ? 'ouvert' : 'fermé'}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

