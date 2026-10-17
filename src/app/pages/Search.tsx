import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DOMAINS } from '../data.ts';
import { EntryRow, Empty, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, route } from '../router.ts';
import { groupHits, search, engine, type Hit } from '../search.ts';

const PER_GROUP = 5;
const SUGGESTIONS = ['Myrtille', 'Tuna', 'Scott', 'Bocal Mason', 'Truffe', 'Autel', 'Coffee', 'Diamant rose'];

export function SearchPage() {
  const initial = route.value.query.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);
  const written = useRef(initial);
  const urlQ = route.value.query.get('q') ?? '';

  // URL modifiée de l'extérieur (lien, retour arrière) → resynchronise le champ
  useEffect(() => {
    if (urlQ !== written.current) {
      written.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  useEffect(() => {
    engine(); // préchauffe l'index
    if (!initial) input.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      written.current = q.trim();
      go('/recherche', { q: q.trim() || undefined }, true);
      search(q).then((h) => alive && setHits(h));
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const groups = useMemo(() => (hits ? groupHits(hits) : []), [hits]);

  return (
    <>
      <TopBar title="Recherche" />
      <main class="page" id="main">
        <form class="searchbox" role="search" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }}>
          <label>
            <Icon name="search" />
            <span class="sr-only">Rechercher dans le wiki (français ou anglais)</span>
            <input
              ref={input}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              placeholder="Objet, PNJ, lieu… (FR ou EN)"
              value={q}
              onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            />
            {q && (
              <button type="button" class="icon-btn" aria-label="Effacer" onClick={() => { setQ(''); input.current?.focus(); }}>
                <Icon name="close" />
              </button>
            )}
          </label>
        </form>

        {!q.trim() && (
          <section>
            <h2 class="section-title">Exemples</h2>
            <div class="chips" style={{ flexWrap: 'wrap' }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} class="chip" onClick={() => setQ(s)}>
                  {s}
                </button>
              ))}
            </div>
            <p class="note" style={{ marginTop: 12 }}>
              Recherche en français ou en anglais, sans se soucier des accents ni des fautes de frappe.
            </p>
          </section>
        )}

        {q.trim() && hits && (
          <p class="note" aria-live="polite" style={{ margin: '4px 4px 0' }}>
            {hits.length ? `${hits.length} résultat${hits.length > 1 ? 's' : ''}` : ''}
          </p>
        )}
        {q.trim() && hits && !hits.length && <Empty icon="search">Aucun résultat pour « {q} ».</Empty>}

        {groups.map(([dom, list]) => {
          const expanded = open.has(dom);
          const shown = expanded ? list : list.slice(0, PER_GROUP);
          return (
            <section key={dom} aria-labelledby={`g-${dom}`}>
              <div class="group-head">
                <h2 id={`g-${dom}`}>{DOMAINS[dom] ?? dom}</h2>
                <span>{list.length}</span>
              </div>
              <div class="list">
                {shown.map((h) => (
                  <EntryRow key={h.e.id} e={h.e} highlight={q} />
                ))}
                {list.length > PER_GROUP && (
                  <button class="more-btn" onClick={() => setOpen((s) => new Set(expanded ? [...s].filter((x) => x !== dom) : [...s, dom]))}>
                    {expanded ? 'Réduire' : `Voir les ${list.length} résultats`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
