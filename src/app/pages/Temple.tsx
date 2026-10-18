// Temple du lac : une ligne par offrande, comme l'écran du jeu — emblème de l'autel, emplacements des objets
// (pleins quand offerts, vides sinon) et récompense. Dépliée : chaque objet avec où et quand le trouver.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, loadEntries, SEASON_FR, seasonsOf, type Season } from '../data.ts';
import { GameImg, RichText, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, isChecked, setCheck, setChecks } from '../store.ts';
import { loadTemple, loadTracker, type TItem } from '../trackers.ts';
import { catchState, loadToday, SBIT, type TodayData } from '../game.ts';
import { QUALITY_BY_INDEX } from '../fiche/labels.ts';
import { XRow } from '../../ui/XRow.tsx';
import { FChip, Filters, Pill, Ring, SeasonPills } from '../../ui/controls.tsx';
import { toast } from '../../ui/feedback.tsx';
import { ClockChip } from '../../ui/Clock.tsx';
import { route } from '../router.ts';

type X = Record<string, any>;
const ALTAR: Record<string, { color: string; label: string }> = {
  'autel-crop': { color: 'var(--palm)', label: 'Cultures' },
  'autel-catch': { color: 'var(--lagon-deep)', label: 'Prises' },
  'autel-advanced': { color: 'var(--sunset)', label: 'Avancé' },
  'autel-rare': { color: 'var(--winter)', label: 'Rare' },
};

function Emblem({ altar, done }: { altar: string; done: boolean }) {
  const a = ALTAR[altar];
  return (
    <span class={`emblem${done ? ' done' : ''}`} style={{ '--altar': a?.color }} aria-hidden="true">
      <Icon name="temple" />
    </span>
  );
}

export function TemplePage() {
  const [d, setD] = useState<X | null>(null);
  const [t, setT] = useState<TodayData | null>(null);
  const [lieux, setLieux] = useState<Map<string, TItem>>(new Map());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'' | 'manque' | 'saison'>('');
  const p = active.value!;
  const target = route.value.query.get('open');
  useEffect(() => {
    Promise.all([loadTemple(), loadToday(), loadEntries(), loadTracker('temple')]).then(([td, tt, , tr]) => {
      setD(td);
      setT(tt);
      setLieux(new Map(tr.items.map((i) => [i.key, i])));
    });
  }, []);
  useEffect(() => {
    if (!target || !d) return;
    setOpen((s) => new Set([...s, target]));
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`row-${target}`)?.scrollIntoView({ block: 'center' })));
  }, [target, d]);

  const bit = SBIT[p.date.season];
  const key = (o: X, it: X) => `temple:${o.id}:${it.id}`;
  const inSeason = (id: string) => {
    const s = entry(id)?.seasons ?? 0;
    return !s || !!(s & bit);
  };
  const stats = useMemo(() => {
    if (!d) return { items: 0, done: 0, offr: 0, offrDone: 0 };
    let items = 0, done = 0, offr = 0, offrDone = 0;
    for (const a of d.autels)
      for (const o of a.offrandes) {
        offr++;
        const n = o.objets.filter((it: X) => isChecked(key(o, it))).length;
        items += o.objets.length;
        done += n;
        if (n === o.objets.length) offrDone++;
      }
    return { items, done, offr, offrDone };
  }, [d, p.checks]);

  return (
    <>
      <TopBar title="Temple du lac" large backTo="/progression" subtitle={d ? `${stats.offrDone} offrandes sur ${stats.offr} · ${stats.done}/${stats.items} objets` : ' '} actions={<ClockChip />} />
      <main class="page" id="main">
        {d && (
          <section class="rings-hero card temple-hero" aria-label="Avancement des autels">
            {d.autels.map((a: X) => {
              const tot = a.offrandes.reduce((s: number, o: X) => s + o.objets.length, 0);
              const dn = a.offrandes.reduce((s: number, o: X) => s + o.objets.filter((it: X) => isChecked(key(o, it))).length, 0);
              return (
                <a key={a.id} class="ring-cell" href={`#autel-${a.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`autel-${a.id}`)?.scrollIntoView({ block: 'start' }); }}>
                  <Ring value={dn} total={tot} size={68} stroke={8} color={ALTAR[a.id]?.color} label={a.nom_fr} />
                  <strong>{ALTAR[a.id]?.label ?? a.nom_fr}</strong>
                </a>
              );
            })}
          </section>
        )}
        <Filters label="Filtres">
          <FChip on={filter === 'manque'} onClick={() => setFilter(filter === 'manque' ? '' : 'manque')}>
            À compléter
          </FChip>
          <FChip on={filter === 'saison'} onClick={() => setFilter(filter === 'saison' ? '' : 'saison')}>
            De saison
          </FChip>
        </Filters>
        {!d || !t ? (
          <div class="skeleton-list" aria-busy="true" />
        ) : (
          d.autels.map((a: X) => {
            const offs = (a.offrandes as X[]).filter((o) => {
              const missing = o.objets.filter((it: X) => !isChecked(key(o, it)));
              if (filter === 'manque') return missing.length > 0;
              if (filter === 'saison') return missing.some((it: X) => inSeason(it.id));
              return true;
            });
            if (!offs.length) return null;
            return (
              <section key={a.id} id={`autel-${a.id}`}>
                <div class="group-label">{a.nom_fr}</div>
                <div class="group xlist">
                  {offs.map((o) => {
                    const n = o.objets.filter((it: X) => isChecked(key(o, it))).length;
                    const complete = n === o.objets.length;
                    return (
                      <XRow
                        key={o.id}
                        id={o.id}
                        open={open.has(o.id)}
                        onToggle={() => setOpen((s) => new Set(s.has(o.id) ? [...s].filter((x) => x !== o.id) : [...s, o.id]))}
                        dom="temple"
                        leading={<Emblem altar={a.id} done={complete} />}
                        name={o.nom ?? o.nom_en}
                        done={complete}
                        sub={
                          <span class="slots" aria-label={`${n} objets offerts sur ${o.objets.length}`}>
                            {o.objets.map((it: X) => {
                              const on = isChecked(key(o, it));
                              return (
                                <span key={it.id} class={`slot${on ? ' on' : ''}${!on && inSeason(it.id) ? ' now' : ''}`} title={entry(it.id)?.fr}>
                                  <GameImg src={entry(it.id)?.img ?? ''} dom={entry(it.id)?.dom ?? 'objets'} size={22} />
                                </span>
                              );
                            })}
                          </span>
                        }
                        end={
                          o.recompense[0] && (
                            <span class="reward" title={`Récompense : ${entry(o.recompense[0].id)?.fr ?? ''}`}>
                              <GameImg src={entry(o.recompense[0].id)?.img ?? ''} dom="objets" size={28} />
                              {o.recompense[0].n > 1 && <small>×{o.recompense[0].n}</small>}
                            </span>
                          )
                        }
                        swipe={{
                          on: complete,
                          label: 'Tout offert',
                          offLabel: 'Tout retirer',
                          act: () => {
                            const keys = o.objets.map((it: X) => key(o, it));
                            const before = keys.filter((k: string) => isChecked(k));
                            setChecks(keys, !complete);
                            toast(`${o.nom ?? o.nom_en} : ${complete ? 'objets retirés' : 'offrande complète'}`, () => {
                              setChecks(keys, false);
                              setChecks(before, true);
                            });
                          },
                        }}
                      >
                        <ul class="offer-items">
                          {o.objets.map((it: X) => {
                            const e = entry(it.id);
                            const k = key(o, it);
                            const on = isChecked(k);
                            const cap = t.captures.find((c) => c.id === it.id);
                            const st = cap ? catchState(cap, p.date, p.weather, p.hour) : null;
                            return (
                              <li key={it.id}>
                                <button
                                  class={`offer-item${on ? ' on' : ''}`}
                                  aria-pressed={on}
                                  onClick={() => {
                                    setCheck(k, !on);
                                    toast(`${e?.fr ?? it.id} : ${on ? 'retiré' : 'offert'}`, () => setCheck(k, on));
                                  }}
                                >
                                  <span class="box" aria-hidden="true">{on && <Icon name="check" />}</span>
                                  <GameImg src={e?.img ?? ''} dom={e?.dom ?? 'objets'} size={36} />
                                  <span class="txt">
                                    <span class="name">
                                      {e?.fr ?? it.id} <span class="c-2 tabular">×{it.n}</span>
                                      {it.qualite ? <span class="c-2"> · {QUALITY_BY_INDEX[it.qualite]}+</span> : null}
                                    </span>
                                    <span class="sub">
                                      {st?.now ? <Pill kind="live">Maintenant</Pill> : null}
                                      <SeasonPills seasons={seasonsOf(e?.seasons ?? 0) as Season[]} short />
                                      {lieux.get(k)?.lieux.length ? <span class="t-footnote c-2">{lieux.get(k)!.lieux.slice(0, 2).join(', ')}</span> : null}
                                    </span>
                                  </span>
                                </button>
                                <a class="icon-btn" href={`#/fiche/${it.id}`} aria-label={`Fiche de ${e?.fr ?? it.id} : où et quand`}>
                                  <Icon name="info" />
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                        {o.recompense.length > 0 && (
                          <p class="t-subhead">
                            Récompense :{' '}
                            {o.recompense.map((r: X) => (
                              <a key={r.id} href={`#/fiche/${r.id}`}>
                                {entry(r.id)?.fr ?? r.id}
                                {r.n > 1 ? ` ×${r.n}` : ''}
                              </a>
                            ))}
                          </p>
                        )}
                      </XRow>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
        {d && (
          <details class="fsec" style={{ marginTop: 24 }}>
            <summary>
              <h2 class="fsec-h">Paliers de récompenses</h2>
            </summary>
            <ol class="plain-list tiers-list">
              {d.paliers.map((pl: X) => (
                <li key={pl.offrandes}>
                  <strong class="tabular">{pl.offrandes} offrandes</strong>
                  <span>
                    {pl.recompenses.map((r: string, i: number) => (
                      <RichText key={i} text={(i ? ' · ' : '') + r} />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </main>
    </>
  );
}
