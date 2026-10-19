// Trackers : vue d'ensemble (progression par collection) et listes à cocher filtrables.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { entry, SEASON_FR } from '../data.ts';
import { CheckBtn, Empty, GameImg, RichText, TopBar } from '../components.tsx';
import { toast } from '../../ui/feedback.tsx';
import { loadDomain } from '../data.ts';
import { FChip, Filters, Ring } from '../../ui/controls.tsx';
import { Icon } from '../icons.tsx';
import { active, checks as checksSig, isChecked, palier, setChecks, toggleWithUndo } from '../store.ts';
import { inSeason, loadMusee, loadTracker, name, progress, seasonBit, TRACKERS, type Tracker, type TItem } from '../trackers.ts';
import { go, route } from '../router.ts';

const ICON: Record<string, string> = { temple: 'temple', musee: 'musee', coeur: 'heart' };
const RING_COLORS: Record<string, string> = { temple: 'var(--palm)', musee: 'var(--sunset)', poissons: 'var(--lagon)', insectes: 'var(--jungle)', creatures: 'var(--abyss)', cuisine: 'var(--hibiscus)', coeur: 'var(--coral)', succes: 'var(--sand)' };

export function TrackersPage() {
  const [all, setAll] = useState<Tracker[] | null>(null);
  const [tools, setTools] = useState<{ id: string; max: number }[]>([]);
  useEffect(() => {
    Promise.all(TRACKERS.map((t) => loadTracker(t.id))).then(setAll);
    loadDomain('outils').then((m) =>
      setTools([...m.values()].map((e) => ({ id: e.id, max: ((e.extra as any).ameliorations ?? []).filter((u: any) => /^(bronze|silver|gold|osmium)\b/i.test(u.nom)).length })).filter((x) => x.max > 0)),
    );
  }, []);
  const p = active.value;
  const checks = checksSig.value;
  const bit = seasonBit(p?.date.season ?? 'spring');
  const byId = new Map((all ?? []).map((t) => [t.id, t]));
  const pr = (id: string) => progress(byId.get(id)?.items ?? [], checks);
  const catches = ['poissons', 'insectes', 'creatures'].map(pr).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total, pct: 0 }), { done: 0, total: 0, pct: 0 });
  const toolDone = tools.reduce((a, t) => a + Math.min(palier(t.id), t.max), 0);
  const toolTotal = tools.reduce((a, t) => a + t.max, 0);
  return (
    <>
      <TopBar title="Progression" large subtitle={p ? `${p.name} · ${SEASON_FR[p.date.season]}, an ${p.date.year}` : undefined} />
      <main class="page" id="main">
        {!all ? (
          <div class="skeleton-list" aria-busy="true" />
        ) : (
          <>
            <section class="rings-hero card" aria-label="Résumé">
              {[
                { id: 'temple', label: 'Temple', v: pr('temple') },
                { id: 'musee', label: 'Musée', v: pr('musee') },
                { id: 'poissons', label: 'Prises', v: catches, href: '#/progression/poissons' },
              ].map((r) => (
                <a key={r.id} href={r.href ?? `#/progression/${r.id}`} class="ring-cell">
                  <Ring value={r.v.done} total={r.v.total} size={96} stroke={11} color={RING_COLORS[r.id]} label={r.label} />
                  <strong>{r.label}</strong>
                  <span class="tabular c-2">
                    {r.v.done}/{r.v.total}
                  </span>
                </a>
              ))}
            </section>
            <div class="group-label">Collections</div>
            <div class="group">
              {all.map((t) => {
                const v = progress(t.items, checks);
                const missSeason = t.items.some((i) => i.seasons) ? t.items.filter((i) => inSeason(i, bit) && !checks[i.key]).length : 0;
                return (
                  <a key={t.id} class="row prog-row" href={`#/progression/${t.id}`}>
                    <Ring value={v.done} total={v.total} size={44} stroke={5} color={RING_COLORS[t.id]} label={t.titre}>
                      <span class="ring-ic" style={{ color: RING_COLORS[t.id] }}>
                        <Icon name={ICON[t.id] ?? t.icon} />
                      </span>
                    </Ring>
                    <span class="txt">
                      <span class="name">{t.titre}</span>
                      <span class="sub tabular">
                        {v.done} / {v.total} {t.unite}
                        {missSeason ? ` · ${missSeason} de saison` : ''}
                      </span>
                    </span>
                    <span class="pct tabular">{v.pct} %</span>
                    <Icon name="chevron" class="chev" />
                  </a>
                );
              })}
              <a class="row prog-row" href="#/explorer/outils">
                <Ring value={toolDone} total={toolTotal || 1} size={44} stroke={5} color="var(--ink-logo)" label="Paliers d'outils">
                  <span class="ring-ic" style={{ color: 'var(--ink-logo)' }}>
                    <Icon name="outils" />
                  </span>
                </Ring>
                <span class="txt">
                  <span class="name">Paliers d'outils</span>
                  <span class="sub tabular">
                    {toolDone} / {toolTotal} paliers
                  </span>
                </span>
                <span class="pct tabular">{toolTotal ? Math.round((toolDone * 100) / toolTotal) : 0} %</span>
                <Icon name="chevron" class="chev" />
              </a>
            </div>
            <p class="t-footnote c-2 hint" style={{ marginTop: 12 }}>
              Enregistré sur cet appareil, par profil. Sauvegarde et synchronisation : Réglages, depuis l'onglet Aujourd'hui.
            </p>
          </>
        )}
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
  const [musee, setMusee] = useState<any>(null);
  useEffect(() => {
    loadTracker(id).then(setT);
    if (id === 'musee') loadMusee().then(setMusee);
  }, [id]);
  const p = active.value;
  const checks = checksSig.value;
  const q = route.value.query;
  const missing = q.get('manquants') === '1';
  const season = q.get('saison') === '1';
  const group = q.get('groupe') ?? '';
  const lieu = q.get('lieu') ?? '';
  const set = (k: string, v: string | undefined) => {
    const cur: Record<string, string | undefined> = { manquants: missing ? '1' : undefined, saison: season ? '1' : undefined, groupe: group || undefined, lieu: lieu || undefined };
    cur[k] = v || undefined;
    go(`/progression/${id}`, cur, true);
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
  const nextTier = musee?.paliers_dons.find((x: any) => x.dons > pr.done);
  return (
    <>
      <TopBar
        title={titre}
        large
        backTo="/progression"
        subtitle={t ? `${pr.done} / ${pr.total} ${t.unite}` : ' '}
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
          <div class="skeleton-list" aria-busy="true" />
        ) : (
          <>
            <section class="card tracker-hero">
              <Ring value={pr.done} total={pr.total} size={76} stroke={9} color={RING_COLORS[id] ?? 'var(--tint)'} label={titre}>
                <b class="tabular">{pr.pct}%</b>
              </Ring>
              <div class="txt">
                <strong class="t-title3">
                  {pr.total - pr.done ? `${pr.total - pr.done} à faire` : 'Collection complète'}
                </strong>
                {hasSeasons && (
                  <span class="t-subhead c-2">
                    dont {t.items.filter((i) => inSeason(i, bit) && !checks[i.key]).length} obtenables en {SEASON_FR[p?.date.season ?? 'spring'].toLowerCase()}
                  </span>
                )}
                {nextTier && (
                  <span class="t-subhead c-2">
                    Prochain palier : <strong class="c-1 tabular">{nextTier.dons} don{nextTier.dons > 1 ? 's' : ''}</strong> · <RichText text={nextTier.recompense || nextTier.autre || ''} />
                  </span>
                )}
              </div>
            </section>
            <Filters label="Filtres">
              <FChip on={missing} onClick={() => set('manquants', missing ? '' : '1')}>
                Manquants
              </FChip>
              {hasSeasons && (
                <FChip on={season} onClick={() => set('saison', season ? '' : '1')}>
                  <span class="season-dot" style={{ background: `var(--${p?.date.season})` }} />
                  En {SEASON_FR[p?.date.season ?? 'spring'].toLowerCase()}
                </FChip>
              )}
              {t.groups.length > 1 &&
                t.groups.length < 40 &&
                t.groups.map((g) => {
                  const gp = progress(t.items.filter((i) => i.group === g), checks);
                  return (
                    <FChip key={g} on={group === g} onClick={() => set('groupe', group === g ? '' : g)} n={gp.total - gp.done}>
                      {g}
                    </FChip>
                  );
                })}
              {lieux.length > 1 && (
                <label class="fchip select-chip">
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
              {t.groups.length >= 40 && (
                <label class="fchip select-chip">
                  <span class="sr-only">Habitant</span>
                  <select value={group} onChange={(e) => set('groupe', (e.target as HTMLSelectElement).value)} aria-label="Filtrer par habitant">
                    <option value="">Tous les habitants ({t.groups.length})</option>
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
            </Filters>
            <p class="sr-only" aria-live="polite">
              {items.length} élément{items.length > 1 ? 's' : ''} affiché{items.length > 1 ? 's' : ''}
            </p>
            {!items.length && <Empty icon="check">{missing ? 'Tout est coché avec ces filtres.' : 'Aucun élément avec ces filtres.'}</Empty>}
            {sections.map((s) => {
              const sp = progress(s.all, checks);
              const allOn = sp.done === sp.total;
              return (
                <section key={s.title} class="tsec">
                  <div class="group-label split">
                    <span>
                      {s.title} <span class="tabular c-3">{sp.done}/{sp.total}</span>
                    </span>
                    {s.all.length > 1 && s.all.length <= 30 && (
                      <button
                        class="linkbtn"
                        onClick={() => {
                          const keys = s.all.map((i) => i.key);
                          const before = keys.filter((k) => checks[k]);
                          setChecks(keys, !allOn);
                          toast(`${s.title} : ${allOn ? 'tout décoché' : 'tout coché'}`, () => {
                            setChecks(keys, false);
                            setChecks(before, true);
                          });
                        }}
                      >
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
                    <div class="group">
                      {s.items.map((it) => (
                        <TrackRow key={it.key} it={it} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {musee && (
              <details class="fsec" style={{ marginTop: 24 }}>
                <summary>
                  <h2 class="fsec-h">Paliers de dons</h2>
                </summary>
                <ol class="plain-list tiers-list">
                  {musee.paliers_dons.map((x: any) => (
                    <li key={x.dons} class={x.dons <= pr.done ? 'reached' : x === nextTier ? 'next' : ''}>
                      <strong class="tabular">{x.dons} dons</strong>
                      <span>
                        <RichText text={[x.recompense, x.autre].filter(Boolean).join(' · ')} />
                      </span>
                    </li>
                  ))}
                </ol>
                <p class="t-footnote c-2">Chaque don rapporte 3 points Musée ; chaque collection complète en rapporte 40.</p>
              </details>
            )}
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
      <CheckBtn on={on} label={`${label} : fait`} onToggle={() => toggleWithUndo(it.key, label, toast)} />
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
      <button class="jtile-btn" aria-pressed={on} aria-label={`${label}${it.sub ? ` (${it.sub})` : ''} : ${on ? 'fait' : 'à faire'}`} onClick={() => toggleWithUndo(it.key, label, toast)}>
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
