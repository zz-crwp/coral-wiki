// Trackers : vue d'ensemble (progression par collection) et listes à cocher filtrables.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, SEASON_FR } from '../data.ts';
import { CheckBtn, Empty, GameImg, Progress, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, isChecked, setChecks, toggle } from '../store.ts';
import { inSeason, loadTracker, name, progress, seasonBit, TRACKERS, type Tracker, type TItem } from '../trackers.ts';
import { go, route } from '../router.ts';

export function TrackersPage() {
  const [all, setAll] = useState<Tracker[] | null>(null);
  useEffect(() => {
    Promise.all(TRACKERS.map((t) => loadTracker(t.id))).then(setAll);
  }, []);
  const p = active.value;
  const checks = p?.checks ?? {};
  const bit = seasonBit(p?.date.season ?? 'spring');
  return (
    <>
      <TopBar title="Trackers" />
      <main class="page" id="main">
        {p && <p class="note" style={{ margin: '0 4px 10px' }}>Progression de « {p.name} » · {SEASON_FR[p.date.season]}, an {p.date.year}</p>}
        {!all ? (
          <Empty>Chargement…</Empty>
        ) : (
          <div class="card list">
            {all.map((t) => {
              const pr = progress(t.items, checks);
              const missSeason = t.items.some((i) => i.seasons) ? t.items.filter((i) => inSeason(i, bit) && !checks[i.key]).length : 0;
              return (
                <a key={t.id} class="row tracker-row" href={`#/trackers/${t.id}`}>
                  <span class="t-ic"><Icon name={t.icon} /></span>
                  <span class="txt">
                    <span class="name">
                      {t.titre} <span class="pct">{pr.pct} %</span>
                    </span>
                    <Progress done={pr.done} total={pr.total} label={t.titre} />
                    <span class="sub">
                      {pr.done} / {pr.total} {t.unite}
                      {missSeason ? ` · ${missSeason} obtenable${missSeason > 1 ? 's' : ''} cette saison` : ''}
                    </span>
                  </span>
                  <Icon name="chevron" class="chev" />
                </a>
              );
            })}
          </div>
        )}
        <p class="note fine">Les coches sont enregistrées sur cet appareil (IndexedDB), par profil. Export, import et synchronisation : menu Plus (jalon 5).</p>
      </main>
    </>
  );
}

const GRID = ['poissons', 'insectes', 'creatures', 'musee', 'cuisine', 'temple'];
const viewKey = (id: string) => `cw-vue-${id}`;
function readView(id: string) {
  try {
    return localStorage.getItem(viewKey(id)) ?? 'grille';
  } catch {
    return 'grille';
  }
}

export function TrackerPage({ id }: { id: string }) {
  const [t, setT] = useState<Tracker | null>(null);
  const [view, setViewState] = useState(readView(id));
  const setView = (v: string) => {
    setViewState(v);
    try {
      localStorage.setItem(viewKey(id), v);
    } catch {}
  };
  useEffect(() => {
    loadTracker(id).then(setT);
  }, [id]);
  const p = active.value;
  const checks = p?.checks ?? {};
  const q = route.value.query;
  const missing = q.get('manquants') === '1';
  const season = q.get('saison') === '1';
  const group = q.get('groupe') ?? '';
  const lieu = q.get('lieu') ?? '';
  const set = (k: string, v: string | undefined) => {
    const cur: Record<string, string | undefined> = { manquants: missing ? '1' : undefined, saison: season ? '1' : undefined, groupe: group || undefined, lieu: lieu || undefined };
    cur[k] = v || undefined;
    go(`/trackers/${id}`, cur, true);
  };
  const bit = seasonBit(p?.date.season ?? 'spring');
  const lieux = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of t?.items ?? []) for (const l of it.lieux) m.set(l, (m.get(l) ?? 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [t]);
  const hasSeasons = t?.items.some((i) => i.seasons) ?? false;
  const items = (t?.items ?? []).filter((i) => (!missing || !checks[i.key]) && (!season || inSeason(i, bit)) && (!group || i.group === group) && (!lieu || i.lieux.includes(lieu)));
  const pr = progress(t?.items ?? [], checks);

  // Regroupement à l'affichage (groupe, puis sous-groupe pour le temple)
  const sections = useMemo(() => {
    const out: { title: string; all: TItem[]; items: TItem[] }[] = [];
    const idx = new Map<string, number>();
    for (const it of t?.items ?? []) {
      const k = it.sg ? `${it.group} · ${it.sg}` : it.group;
      if (!idx.has(k)) idx.set(k, out.push({ title: it.sg ?? it.group, all: [], items: [] }) - 1);
      out[idx.get(k)!].all.push(it);
    }
    const shown = new Set(items.map((i) => i.key));
    for (const s of out) s.items = s.all.filter((i) => shown.has(i.key));
    return out.filter((s) => s.items.length);
  }, [t, items.length, missing, season, group, lieu, checks]);

  if (!TRACKERS.some((x) => x.id === id)) return <Empty>Tracker inconnu.</Empty>;
  const titre = TRACKERS.find((x) => x.id === id)!.titre;
  const canGrid = GRID.includes(id);
  const grid = canGrid && view === 'grille';
  return (
    <>
      <TopBar
        title={titre}
        backTo="/trackers"
        actions={
          canGrid ? (
            <button class="icon-btn" aria-label={grid ? 'Afficher en liste' : 'Afficher en grille (journal)'} onClick={() => setView(grid ? 'liste' : 'grille')}>
              <Icon name={grid ? 'list' : 'grid'} />
            </button>
          ) : undefined
        }
      />
      <main class="page" id="main">
        {!t ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <div class="card tracker-head">
              <div class="big-pct">{pr.pct} %</div>
              <div class="txt">
                <Progress done={pr.done} total={pr.total} label={titre} />
                <span class="sub">
                  {pr.done} / {pr.total} {t.unite}
                  {id === 'temple' && ` · ${countComplete(t, checks)} / ${new Set(t.items.map((i) => i.sg)).size} offrandes complètes`}
                </span>
              </div>
            </div>
            <div class="chips" role="group" aria-label="Filtres">
              <button class="chip" aria-pressed={missing} onClick={() => set('manquants', missing ? '' : '1')}>
                Manquants
              </button>
              {hasSeasons && (
                <button class="chip" aria-pressed={season} onClick={() => set('saison', season ? '' : '1')}>
                  <span class="season-dot" style={{ background: `var(--s-${p?.date.season})` }} />
                  Obtenables en {SEASON_FR[p?.date.season ?? 'spring'].toLowerCase()}
                </button>
              )}
              {lieux.length > 1 && (
                <label class="chip select-chip">
                  <span class="sr-only">Lieu</span>
                  <select value={lieu} onChange={(e) => set('lieu', (e.target as HTMLSelectElement).value)} aria-label="Filtrer par lieu">
                    <option value="">Tous les lieux</option>
                    {lieux.map(([l, n]) => (
                      <option key={l} value={l}>
                        {l} ({n})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {t.groups.length > 1 && t.groups.length < 40 && (
              <div class="chips" role="group" aria-label="Groupe">
                <button class="chip" aria-pressed={!group} onClick={() => set('groupe', '')}>
                  Tout
                </button>
                {t.groups.map((g) => {
                  const gp = progress(t.items.filter((i) => i.group === g), checks);
                  return (
                    <button key={g} class="chip" aria-pressed={group === g} onClick={() => set('groupe', group === g ? '' : g)}>
                      {g} <span class="note">{gp.done}/{gp.total}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {t.groups.length >= 40 && (
              <label class="field">
                <span>Habitant</span>
                <select value={group} onChange={(e) => set('groupe', (e.target as HTMLSelectElement).value)}>
                  <option value="">Tous ({t.groups.length})</option>
                  {t.groups.map((g) => {
                    const gp = progress(t.items.filter((i) => i.group === g), checks);
                    return (
                      <option key={g} value={g}>
                        {g} — {gp.done}/{gp.total}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            <p class="note" style={{ margin: '0 4px 8px' }} aria-live="polite">
              {items.length} élément{items.length > 1 ? 's' : ''} affiché{items.length > 1 ? 's' : ''}
            </p>
            {!items.length && <Empty icon="check">{missing ? 'Tout est coché avec ces filtres.' : 'Aucun élément avec ces filtres.'}</Empty>}
            {sections.map((s) => {
              const sp = progress(s.all, checks);
              const allOn = sp.done === sp.total;
              return (
                <section key={s.title} class="tsec">
                  <div class="group-head">
                    <h2>{s.title}</h2>
                    <span>
                      {sp.done}/{sp.total}
                    </span>
                    {s.all.length > 1 && s.all.length <= 30 && (
                      <button class="linkbtn" onClick={() => setChecks(s.all.map((i) => i.key), !allOn)}>
                        {allOn ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    )}
                  </div>
                  {grid ? (
                    <div class="jgrid" role="list">
                      {s.items.map((it) => (
                        <JournalTile key={it.key} it={it} />
                      ))}
                    </div>
                  ) : (
                    <div class="card list">
                      {s.items.map((it) => (
                        <TrackRow key={it.key} it={it} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}

function countComplete(t: Tracker, checks: Record<string, number>) {
  const by = new Map<string, boolean>();
  for (const i of t.items) by.set(i.sg ?? '', (by.get(i.sg ?? '') ?? true) && !!checks[i.key]);
  return [...by.values()].filter(Boolean).length;
}

export function TrackRow({ it }: { it: TItem }) {
  const e = entry(it.id);
  const label = name(it);
  const on = isChecked(it.key);
  return (
    <div class={`row trow${on ? ' done' : ''}`}>
      <CheckBtn on={on} label={`${label} : fait`} onToggle={() => toggle(it.key)} />
      <a class="trow-link" href={`#/fiche/${it.id}`}>
        <GameImg src={e?.img ?? ''} dom={e?.dom ?? 'objets'} size={40} />
        <span class="txt">
          <span class="name">{label}</span>
          {(it.sub || it.lieux.length > 0) && <span class="sub">{it.sub ?? it.lieux.slice(0, 3).join(', ')}</span>}
        </span>
      </a>
    </div>
  );
}

/** Vignette du journal : toucher coche / décoche ; le nom mène à la fiche. Non coché = estompé. */
function JournalTile({ it }: { it: TItem }) {
  const e = entry(it.id);
  const label = name(it);
  const on = isChecked(it.key);
  return (
    <div class={`jtile${on ? ' done' : ''}`} role="listitem">
      <button class="jtile-btn" aria-pressed={on} aria-label={`${label}${it.sub ? ` (${it.sub})` : ''} : ${on ? 'fait' : 'à faire'}`} onClick={() => toggle(it.key)}>
        <GameImg src={e?.img ?? ''} dom={e?.dom ?? 'objets'} size={52} />
        {on && (
          <svg class="jtile-ok" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" />
            <path d="m7 12.5 3.2 3.2L17 9" />
          </svg>
        )}
      </button>
      <a class="jtile-name" href={`#/fiche/${it.id}`}>
        {label}
      </a>
      {it.sub && <span class="jtile-sub">{it.sub}</span>}
    </div>
  );
}
