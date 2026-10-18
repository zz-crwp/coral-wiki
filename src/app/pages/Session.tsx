// Onglet Session : ce que je cherche pendant cette journée de jeu. Fiches épinglées, avec leur état
// en direct (disponible, ouvert, rentable) et les mêmes lignes repliables que dans Explorer.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Entity } from '../../data/schema.ts';
import { entry, loadEntries, loadDomain, type Entry } from '../data.ts';
import { Empty, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active, isChecked, setCheck, setSession, togglePin } from '../store.ts';
import { loadToday, type TodayData } from '../game.ts';
import { kindOf, rowCtx, rowFor } from '../rows.tsx';
import { XRow } from '../../ui/XRow.tsx';
import { openMenu, toast } from '../../ui/feedback.tsx';
import { ClockChip } from '../../ui/Clock.tsx';
import { openFiche } from '../router.ts';

export function SessionPage() {
  const p = active.value!;
  const ids = p.session ?? [];
  const [ents, setEnts] = useState<Map<string, Entity>>(new Map());
  const [t, setT] = useState<TodayData | null>(null);
  const [ok, setOk] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEntries().then(async () => {
      const doms = [...new Set(ids.map((id) => entry(id)?.dom).filter(Boolean))] as string[];
      const maps = await Promise.all(doms.map((d) => loadDomain(d)));
      const m = new Map<string, Entity>();
      for (const x of maps) for (const [k, v] of x) if (ids.includes(k)) m.set(k, v);
      setEnts(m);
      setT(await loadToday());
      setOk(true);
    });
  }, [ids.join('|')]);

  const ctx = useMemo(() => (t ? rowCtx(t, p, ents) : null), [t, p, ents]);
  const list = ids.map((id) => entry(id)).filter(Boolean) as Entry[];
  const clear = () => {
    const before = [...ids];
    setSession([]);
    toast('Session vidée', () => setSession(before));
  };

  return (
    <>
      <TopBar
        title="Ma session"
        large
        subtitle={list.length ? `${list.length} épinglé${list.length > 1 ? 's' : ''}` : 'Rien d’épinglé pour l’instant'}
        actions={
          <>
            <ClockChip />
            {list.length > 0 && (
              <button class="icon-btn" aria-label="Vider la session" onClick={clear}>
                <Icon name="trash" />
              </button>
            )}
          </>
        }
      />
      <main class="page" id="main">
        {!list.length ? (
          <Empty icon="session">
            Épinglez ce que vous cherchez pendant cette journée de jeu : appui long sur une ligne, ou l'épingle en haut d'une fiche. Vous le retrouvez ici avec son état en direct.
          </Empty>
        ) : !ok || !ctx ? (
          <div class="skeleton-list" aria-busy="true" />
        ) : (
          <div class="group xlist">
            {list.map((e) => {
              const ent = ents.get(e.id);
              const spec = rowFor(kindOf(e.dom, ent), e, ent, ctx);
              return (
                <XRow
                  key={e.id}
                  id={e.id}
                  open={open.has(e.id)}
                  onToggle={() => setOpen((s) => new Set(s.has(e.id) ? [...s].filter((x) => x !== e.id) : [...s, e.id]))}
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
                            toast(`${e.fr} : ${was ? 'décoché' : 'coché'}`, () => setCheck(k, was));
                          },
                        }
                      : undefined
                  }
                  onLongPress={() =>
                    openMenu({
                      title: e.fr,
                      items: [
                        { icon: 'unpin', label: 'Retirer de la session', onClick: () => { togglePin(e.id); toast('Retiré de la session', () => togglePin(e.id)); } },
                        { icon: 'book', label: 'Ouvrir la fiche', onClick: () => openFiche(e.id) },
                      ],
                    })
                  }
                >
                  {spec.detail()}
                </XRow>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
