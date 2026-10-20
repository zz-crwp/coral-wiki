// Liste d'un domaine : lignes repliables propres au domaine, filtres utiles en jeu, tri par pertinence.
// État ouvert mémorisé par liste ; « ?open=<id> » ouvre la ligne et fait défiler jusqu'à elle.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Entity } from '../../data/schema.ts';
import { DOMAINS, loadDomain, loadEntries, SEASON_FR, type Entry } from '../data.ts';
import { Empty, EntryRow, TopBar, VirtualList } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, openFiche, route } from '../router.ts';
import { active, checks, isChecked, pinned, setCheck, togglePin } from '../store.ts';
import { loadToday, SBIT, type TodayData } from '../game.ts';
import { kindOf, rowCtx, rowFor, type Kind } from '../rows.tsx';
import { XRow } from '../../ui/XRow.tsx';
import { FChip, Filters } from '../../ui/controls.tsx';
import { openMenu, toast } from '../../ui/feedback.tsx';
import { ClockChip } from '../../ui/Clock.tsx';

const LIVE: Kind[] = ['catch', 'crop', 'npc', 'place', 'festival', 'forage', 'recipe', 'tool'];
const openKey = (dom: string) => `cw-open-${dom}`;
function readOpen(dom: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(openKey(dom)) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveOpen(dom: string, s: Set<string>) {
  try {
    localStorage.setItem(openKey(dom), JSON.stringify([...s].slice(-40)));
  } catch {}
}

type Filter = { id: string; label: string; test: (e: Entry, ent: Entity | undefined, spec: ReturnType<typeof rowFor>) => boolean };

function filtersFor(kind: Kind): Filter[] {
  switch (kind) {
    case 'catch':
      return [
        { id: 'aujourdhui', label: "Aujourd'hui", test: (_e, _x, s) => s.sortKey === 0 },
        { id: 'saison', label: 'Cette saison', test: (_e, _x, s) => (s.sortKey ?? 9) <= 1 },
        { id: 'manquants', label: 'Pas attrapés', test: (_e, _x, s) => !s.done },
      ];
    case 'crop':
      return [
        { id: 'plantable', label: "À planter aujourd'hui", test: (_e, _x, s) => (s.sortKey ?? 9999) < 9999 && (s.sortKey ?? 0) < 0 },
        { id: 'graines', label: 'Graines', test: (e) => /graine|plant|jeune arbre/i.test(e.cat) },
      ];
    case 'npc':
      return [
        { id: 'anniv', label: 'Anniversaire proche', test: (_e, _x, s) => (s.sortKey ?? 999) <= 7 },
        { id: 'mariables', label: 'Mariables', test: (_e, x) => !!(x?.extra as any)?.mariable },
        { id: 'habitants', label: 'Habitants', test: (e) => e.cat === 'Habitant' },
        { id: 'ondins', label: 'Ondins', test: (e) => e.cat === 'Ondin' },
      ];
    case 'place':
      return [
        { id: 'ouverts', label: "Ouverts aujourd'hui", test: (_e, _x, s) => s.sortKey === 0 && !!s.end },
        { id: 'magasins', label: 'Magasins', test: (e) => e.cat === 'Magasin' },
        { id: 'especes', label: 'Où pêcher et chercher', test: (_e, x) => !!(x?.extra as any)?.especes_ici?.length },
      ];
    case 'recipe':
      return [{ id: 'manquants', label: 'Pas cuisinées', test: (_e, _x, s) => !!s.check && !s.done }];
    case 'forage':
      return [{ id: 'saison', label: 'De saison', test: (_e, _x, s) => s.sortKey === 0 }];
    default:
      return [];
  }
}

/** Liste d'un domaine ; `root` : affichée comme onglet (Habitants), sans retour. */
export function DomainPage({ dom, root = false }: { dom: string; root?: boolean }) {
  const [list, setList] = useState<Entry[] | null>(null);
  const [ents, setEnts] = useState<Map<string, Entity>>(new Map());
  const [t, setT] = useState<TodayData | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => readOpen(dom));
  const q = route.value.query;
  const filter = (q.get('filtre') ?? '').replace(/^maintenant$/, 'aujourdhui'); // ancien filtre « maintenant » → « aujourd'hui »
  const cat = q.get('cat') ?? '';
  const target = q.get('open');
  const p = active.value!;

  useEffect(() => {
    Promise.all([loadEntries(), loadDomain(dom), loadToday()]).then(([all, m, td]) => {
      setList(all.filter((e) => e.dom === dom));
      setEnts(m);
      setT(td);
    });
  }, [dom]);
  // Lien profond : ouvre la ligne ciblée et la fait défiler à l'écran
  useEffect(() => {
    if (!target || !list) return;
    setOpen((s) => new Set([...s, target]));
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`row-${target}`)?.scrollIntoView({ block: 'center' })));
  }, [target, list]);

  const kind: Kind = kindOf(dom);
  const ctx = useMemo(() => (t ? rowCtx(t, p, ents) : null), [t, p, ents]);
  const filters = filtersFor(kind);
  const rows = useMemo(() => {
    if (!list || !ctx) return [];
    const r = list.map((e) => ({ e, ent: ents.get(e.id), spec: rowFor(kindOf(dom, ents.get(e.id)), e, ents.get(e.id), ctx) }));
    const f = filters.find((x) => x.id === filter);
    return r
      .filter((x) => (!cat || x.e.cat === cat) && (!f || f.test(x.e, x.ent, x.spec)))
      .sort((a, b) => (LIVE.includes(kind) ? (a.spec.sortKey ?? 0) - (b.spec.sortKey ?? 0) : 0) || a.e.fr.localeCompare(b.e.fr, 'fr'));
  }, [list, ents, ctx, filter, cat, checks.value, p.coeurs, p.paliers]);

  // Rendu progressif : les 24 premières lignes tout de suite, le reste par tranches quand le navigateur est libre
  const [limit, setLimit] = useState(24);
  const idx = target ? rows.findIndex((r) => r.e.id === target) : -1;
  const shown = Math.max(limit, idx + 10);
  useEffect(() => {
    if (shown >= rows.length) return;
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 16));
    const h = idle(() => setLimit((l) => l + 30));
    return () => (window.cancelIdleCallback ?? clearTimeout)(h as number);
  }, [shown, rows.length]);

  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list ?? []) m.set(e.cat, (m.get(e.cat) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const setQ = (k: string, v: string) => go(root ? '/habitants' : `/chercher/${dom}`, { filtre: k === 'filtre' ? v || undefined : filter || undefined, cat: k === 'cat' ? v || undefined : cat || undefined }, true);
  const toggleRow = (id: string) => {
    const n = new Set(open);
    n.has(id) ? n.delete(id) : n.add(id);
    setOpen(n);
    saveOpen(dom, n);
  };
  const allOpen = rows.length > 0 && rows.slice(0, 60).every((r) => open.has(r.e.id));
  const toggleAll = () => {
    const n = allOpen ? new Set<string>() : new Set(rows.slice(0, 60).map((r) => r.e.id));
    setOpen(n);
    saveOpen(dom, n);
  };
  const big = kind === 'generic' && rows.length > 120;
  const title = root ? 'Habitants' : DOMAINS[dom] ?? dom;

  return (
    <>
      <TopBar
        title={title}
        backTo={root ? undefined : '/chercher'}
        large
        subtitle={list ? `${rows.length} sur ${list.length}${filter || cat ? ' · filtré' : ''}` : ' '}
        actions={
          <>
            {LIVE.includes(kind) && <ClockChip />}
            {!big && rows.length > 1 && (
              <button class="icon-btn" aria-label={allOpen ? 'Tout replier' : 'Tout déplier'} onClick={toggleAll}>
                <Icon name={allOpen ? 'list' : 'grid'} />
              </button>
            )}
          </>
        }
      />
      <main class="page" id="main">
        {(filters.length > 0 || cats.length > 1) && (
          <Filters label="Filtres">
            {filters.map((f) => (
              <FChip key={f.id} on={filter === f.id} onClick={() => setQ('filtre', filter === f.id ? '' : f.id)}>
                {f.label}
              </FChip>
            ))}
            {(filters.length === 0 || kind === 'generic' || kind === 'material') &&
              cats.length > 1 &&
              cats.map(([c, n]) => (
                <FChip key={c} on={cat === c} n={n} onClick={() => setQ('cat', cat === c ? '' : c)}>
                  {c}
                </FChip>
              ))}
          </Filters>
        )}
        {kind === 'crop' && (
          <p class="t-footnote c-2 hint">
            Triées par bénéfice par jour si plantées aujourd'hui ({p.date.day} {SEASON_FR[p.date.season].toLowerCase()}).
          </p>
        )}
        {!list || !ctx ? (
          <div class="skeleton-list" aria-busy="true" />
        ) : !rows.length ? (
          <Empty icon={dom}>Rien avec ces filtres.</Empty>
        ) : big ? (
          <div class="group">
            <VirtualList items={rows.map((r) => r.e)} rowHeight={64} render={(e) => <EntryRow e={e} />} />
          </div>
        ) : (
          <div class="group xlist">
            {rows.slice(0, shown).map(({ e, spec }) => (
              <XRow
                key={e.id}
                id={e.id}
                open={open.has(e.id)}
                onToggle={() => toggleRow(e.id)}
                img={e.img}
                dom={e.dom}
                name={e.fr}
                sub={spec.sub}
                end={spec.end}
                done={spec.done}
                swipe={
                  spec.check
                    ? {
                        on: isChecked(spec.check.key),
                        label: spec.check.label,
                        offLabel: spec.check.off,
                        act: () => {
                          const k = spec.check!.key;
                          const was = isChecked(k);
                          setCheck(k, !was);
                          toast(`${e.fr} : ${was ? spec.check!.off.toLowerCase() : spec.check!.label.toLowerCase()}`, () => setCheck(k, was));
                        },
                      }
                    : undefined
                }
                onLongPress={() =>
                  openMenu({
                    title: e.fr,
                    items: [
                      { icon: pinned(e.id) ? 'unpin' : 'pin', label: pinned(e.id) ? 'Retirer de la session' : 'Épingler à la session', onClick: () => { togglePin(e.id); toast(pinned(e.id) ? 'Épinglé à la session' : 'Retiré de la session', () => togglePin(e.id)); } },
                      { icon: 'book', label: 'Ouvrir la fiche', onClick: () => openFiche(e.id) },
                      ...(spec.check ? [{ icon: 'check', label: isChecked(spec.check.key) ? spec.check.off : spec.check.label, onClick: () => { const k = spec.check!.key; const was = isChecked(k); setCheck(k, !was); toast(`${e.fr} : ${was ? 'décoché' : 'coché'}`, () => setCheck(k, was)); } }] : []),
                      ...(ents.get(e.id)?.sources[0] ? [{ icon: 'external', label: 'Voir la source (wiki)', href: ents.get(e.id)!.sources[0].url }] : []),
                    ],
                  })
                }
              >
                {spec.detail()}
              </XRow>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export { SBIT };
