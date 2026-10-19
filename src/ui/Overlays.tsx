// Sheets globales : fiche (au-dessus de l'écran courant) et recherche (champ en bas, dans la zone du pouce).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DOMAINS, entry, loadEntries } from '../app/data.ts';
import { EntryRow, GameImg, Highlight } from '../app/components.tsx';
import { Icon } from '../app/icons.tsx';
import { closeFiche, openFiche, recent, route, searchOpen, searchSeed } from '../app/router.ts';
import { groupHits, search, engine, type Hit } from '../app/search.ts';
import { pinned, togglePin } from '../app/store.ts';
import { FicheView } from '../app/pages/Fiche.tsx';
import { Sheet } from './Sheet.tsx';
import { toast } from './feedback.tsx';

export function FicheSheet() {
  const id = route.value.query.get('f');
  const [shown, setShown] = useState(id);
  useEffect(() => {
    if (id) setShown(id);
  }, [id]);
  const e = shown ? entry(shown) : undefined;
  const pin = shown ? pinned(shown) : false;
  return (
    <Sheet
      open={!!id}
      onClose={closeFiche}
      label={e?.fr ?? 'Fiche'}
      detent="medium"
      dock
      actions={
        shown && (
          <button
            class="icon-btn"
            aria-pressed={pin}
            aria-label={pin ? 'Retirer de la session' : 'Épingler à la session'}
            onClick={() => {
              togglePin(shown);
              toast(pin ? 'Retiré de la session' : 'Épinglé à la session', () => togglePin(shown));
            }}
          >
            <Icon name={pin ? 'unpin' : 'pin'} />
          </button>
        )
      }
    >
      {shown && <FicheView key={shown} id={shown} />}
    </Sheet>
  );
}

const PER_GROUP = 4;

export function SearchSheet() {
  const open = searchOpen.value;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [more, setMore] = useState<Set<string>>(new Set());
  const [, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (searchSeed.value) {
      setQ(searchSeed.value);
      searchSeed.value = '';
    }
    engine();
    loadEntries().then(() => setReady(true));
    setTimeout(() => input.current?.focus({ preventScroll: true }), 120);
  }, [open]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => search(q).then((h) => alive && setHits(h)), 40);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  const groups = useMemo(() => (hits ? groupHits(hits) : []), [hits]);
  const rec = open ? recent().map((id) => entry(id)).filter(Boolean) : [];

  return (
    <Sheet open={open} onClose={() => (searchOpen.value = false)} title="Rechercher" detent="large" label="Recherche">
      <div class="search-results" aria-live="polite">
        {!q.trim() &&
          (rec.length ? (
            <>
              <div class="group-label">Consultés récemment</div>
              <div class="group">
                {rec.map((e) => (
                  <EntryRow key={e!.id} e={e!} />
                ))}
              </div>
            </>
          ) : (
            <p class="t-subhead c-2 search-hint">Objet, habitant, lieu… en français ou en anglais, sans se soucier des accents ni des fautes de frappe.</p>
          ))}
        {q.trim() && hits && !hits.length && <p class="t-subhead c-2 search-hint">Aucun résultat pour « {q} ».</p>}
        {groups.map(([dom, list]) => {
          const all = more.has(dom);
          return (
            <section key={dom}>
              <div class="group-label">
                {DOMAINS[dom] ?? dom}
                <span class="tabular">{list.length}</span>
              </div>
              <div class="group">
                {(all ? list : list.slice(0, PER_GROUP)).map((h) => (
                  <a key={h.e.id} class="row" href={`#/fiche/${h.e.id}`} onClick={(ev) => { ev.preventDefault(); openFiche(h.e.id); }}>
                    <EntryRowInner e={h.e} q={q} />
                  </a>
                ))}
                {list.length > PER_GROUP && (
                  <button class="more-btn" onClick={() => setMore((s) => new Set(all ? [...s].filter((x) => x !== dom) : [...s, dom]))}>
                    {all ? 'Réduire' : `Voir les ${list.length}`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <form class="search-dock" role="search" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }}>
        <label>
          <Icon name="search" />
          <span class="sr-only">Rechercher dans le wiki</span>
          <input
            ref={input}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder="Rechercher"
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          />
          {q && (
            <button type="button" class="clear" aria-label="Effacer" onClick={() => { setQ(''); input.current?.focus(); }}>
              <Icon name="close" />
            </button>
          )}
        </label>
      </form>
    </Sheet>
  );
}

function EntryRowInner({ e, q }: { e: NonNullable<ReturnType<typeof entry>>; q: string }) {
  return (
    <>
      <GameImg src={e.img} dom={e.dom} size={40} />
      <span class="txt">
        <span class="name">
          <Highlight text={e.fr} q={q} />
        </span>
        <span class="sub">{e.fr !== e.en ? `${e.en} · ${e.cat}` : e.cat}</span>
      </span>
      <Icon name="chevron" class="chev" />
    </>
  );
}
