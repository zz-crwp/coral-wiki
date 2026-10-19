// Onglet Chercher : point d'entrée principal. Champ ancré en bas (au pouce), résultats dès la 1re lettre,
// FR et EN, accents et fautes tolérés, verdict « À garder / Vendable » sur chaque résultat.
// Champ vide : fiches consultées récemment, puis le catalogue rangé par intention de jeu.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DOMAINS, entry, loadEntries, meta, type Entry } from '../data.ts';
import { GameImg, Highlight, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, openFiche, recent, route } from '../router.ts';
import { engine, groupHits, search, type Hit } from '../search.ts';
import { checks } from '../store.ts';
import { verdictOf } from '../usage.ts';

const PER_GROUP = 5;
type Tile = { href: string; label: string; sub?: string; img?: string; icon: string };
const counts = meta.counts as Record<string, number>;
const dom = (d: string, img: string): Tile => ({ href: `#/chercher/${d}`, label: DOMAINS[d] ?? d, sub: `${counts[d] ?? 0}`, img, icon: d });
const GROUPS: { titre: string; tiles: Tile[] }[] = [
  { titre: 'Capturer', tiles: [dom('poissons', 'tuna'), dom('insectes', 'atlas-moth'), dom('creatures-marines', 'blue-lobster')] },
  { titre: 'Cultiver et élever', tiles: [dom('cultures', 'strawberry'), dom('arbres', 'orange'), dom('cueillette', 'daffodil'), dom('elevage', 'chicken')] },
  { titre: "L'île", tiles: [dom('lieux', 'sams-general-store'), dom('festivals', 'cherry-blossom-potluck'), { href: '#/chercher/mines', label: 'Mines', sub: '4 mines', img: 'earth-geode', icon: 'mines' }, dom('monstres', 'water-slime')] },
  { titre: 'Fabriquer', tiles: [dom('cuisine', 'pizza'), dom('artisanat', 'olive-jam'), dom('outils', 'pickaxe'), dom('mineraux', 'diamond')] },
];
const CATALOGUE = ['ressources', 'quetes', 'vetements', 'mobilier', 'objets', 'armes', 'batiments', 'maitrises', 'succes', 'groupes', 'guides'];

/** Pastille de verdict (Q4) : À garder (raison) ou Vendable. */
export function VerdictPill({ e }: { e: Entry }) {
  const v = verdictOf(e, checks.value);
  if (!v) return null;
  return v.keep ? (
    <span class="pill warn verdict" title={`Utile pour : ${v.why.join(', ')}`}>
      À garder · {v.why[0]}
    </span>
  ) : (
    <span class="pill verdict">Vendable</span>
  );
}

export function SearchPage() {
  const q = route.value.query.get('q') ?? '';
  const [text, setText] = useState(q);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [more, setMore] = useState<Set<string>>(new Set());
  const [, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    engine();
    loadEntries().then(() => setReady(true));
  }, []);
  // La requête vit dans l'adresse (retour arrière, lien direct) ; remplacée sans empiler l'historique
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      search(text).then((h) => alive && setHits(h));
      if (text !== q) go('/chercher', text ? { q: text } : undefined, true);
    }, 60);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text]);
  const groups = useMemo(() => (hits ? groupHits(hits) : []), [hits]);
  const rec = recent()
    .map((id) => entry(id))
    .filter(Boolean)
    .slice(0, 6) as Entry[];
  const empty = !text.trim();

  return (
    <>
      <TopBar title="Chercher" large subtitle={`${Object.values(counts).reduce((a, b) => a + b, 0)} fiches · jeu ${meta.game_version}`} />
      <main class="page search-page" id="main">
        <div aria-live="polite">
          {!empty && hits && !hits.length && <p class="t-subhead c-2 search-hint">Aucun résultat pour « {text} ».</p>}
          {!empty &&
            groups.map(([d, list]) => {
              const all = more.has(d);
              return (
                <section key={d}>
                  <div class="group-label split">
                    <span>{DOMAINS[d] ?? d}</span>
                    <span class="tabular">{list.length}</span>
                  </div>
                  <div class="group">
                    {(all ? list : list.slice(0, PER_GROUP)).map((h) => (
                      <a key={h.e.id} class="row" href={`#/fiche/${h.e.id}`} onClick={(ev) => (ev.preventDefault(), openFiche(h.e.id))}>
                        <GameImg src={h.e.img} dom={h.e.dom} size={40} />
                        <span class="txt">
                          <span class="name">
                            <Highlight text={h.e.fr} q={text} />
                          </span>
                          <span class="sub">{h.e.fr !== h.e.en ? `${h.e.en} · ${h.e.cat}` : h.e.cat}</span>
                        </span>
                        <VerdictPill e={h.e} />
                      </a>
                    ))}
                    {list.length > PER_GROUP && (
                      <button class="more-btn" onClick={() => setMore((s) => new Set(all ? [...s].filter((x) => x !== d) : [...s, d]))}>
                        {all ? 'Réduire' : `Voir les ${list.length}`}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
        {empty && (
          <>
            {rec.length > 0 && (
              <section>
                <div class="group-label">Consultés récemment</div>
                <div class="group">
                  {rec.map((e) => (
                    <a key={e.id} class="row" href={`#/fiche/${e.id}`} onClick={(ev) => (ev.preventDefault(), openFiche(e.id))}>
                      <GameImg src={e.img} dom={e.dom} size={40} />
                      <span class="txt">
                        <span class="name">{e.fr}</span>
                        <span class="sub">{e.cat}</span>
                      </span>
                      <VerdictPill e={e} />
                    </a>
                  ))}
                </div>
              </section>
            )}
            {GROUPS.map((g) => (
              <section key={g.titre}>
                <div class="section-head">
                  <h2>{g.titre}</h2>
                </div>
                <div class="tiles">
                  {g.tiles.map((t) => {
                    const e = t.img ? entry(t.img) : undefined;
                    return (
                      <a key={t.href} class="tile2" href={t.href}>
                        {e?.img ? <GameImg src={e.img} dom={t.icon} size={44} /> : <span class="tile2-ic"><Icon name={t.icon} /></span>}
                        <span class="tile2-t">
                          <strong>{t.label}</strong>
                          {t.sub && <small class="tabular">{t.sub}</small>}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
            <section>
              <div class="section-head">
                <h2>Tout le catalogue</h2>
              </div>
              <div class="group">
                {CATALOGUE.filter((d) => counts[d]).map((d) => (
                  <a key={d} class="row cat-row" href={`#/chercher/${d}`}>
                    <span class="cat-ic">
                      <Icon name={d} />
                    </span>
                    <span class="txt">
                      <span class="name">{DOMAINS[d]}</span>
                    </span>
                    <span class="c-2 tabular">{counts[d]}</span>
                    <Icon name="chevron" class="chev" />
                  </a>
                ))}
                <a class="row cat-row" href="#/chercher/rang">
                  <span class="cat-ic">
                    <Icon name="succes" />
                  </span>
                  <span class="txt">
                    <span class="name">Rang de la ville</span>
                  </span>
                  <Icon name="chevron" class="chev" />
                </a>
              </div>
            </section>
          </>
        )}
      </main>
      <form class="search-dock in-page" role="search" onSubmit={(e) => (e.preventDefault(), input.current?.blur())}>
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
            placeholder="Objet, habitant, lieu…"
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
          {text && (
            <button type="button" class="clear" aria-label="Effacer" onClick={() => (setText(''), input.current?.focus())}>
              <Icon name="close" />
            </button>
          )}
        </label>
      </form>
    </>
  );
}
