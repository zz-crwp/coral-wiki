import { useEffect, useMemo, useState } from 'preact/hooks';
import { DOMAINS, loadEntries, meta, SEASONS, SEASON_FR, type Entry } from '../data.ts';
import { EntryRow, Empty, SeasonBadges, TopBar, VirtualList } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { go, route } from '../router.ts';

/** Ordre d'affichage des domaines, groupés par thème. */
export const DOMAIN_GROUPS: { titre: string; doms: string[] }[] = [
  { titre: 'Ferme & nature', doms: ['cultures', 'arbres', 'cueillette', 'elevage'] },
  { titre: 'Pêche & capture', doms: ['poissons', 'insectes', 'creatures-marines'] },
  { titre: 'Mines & ressources', doms: ['mineraux', 'ressources', 'monstres'] },
  { titre: 'Fabrication', doms: ['artisanat', 'cuisine', 'outils', 'armes'] },
  { titre: 'Habitants & lieux', doms: ['pnj', 'lieux', 'festivals', 'batiments'] },
  { titre: 'Progression', doms: ['quetes', 'maitrises', 'succes'] },
  { titre: 'Maison & style', doms: ['vetements', 'mobilier', 'objets'] },
  { titre: 'Références', doms: ['groupes', 'guides'] },
];

const SPECIAL = [
  { href: '#/temple', icon: 'guides', titre: 'Temple du lac', sous: '4 autels, 24 offrandes' },
  { href: '#/musee', icon: 'mineraux', titre: 'Musée', sous: 'Collections et paliers' },
  { href: '#/rang', icon: 'succes', titre: 'Rang de la ville', sous: 'F → S, déblocages' },
  { href: '#/mines', icon: 'monstres', titre: 'Mines', sous: '4 mines, 160 étages' },
  { href: '#/ameliorations', icon: 'outils', titre: 'Améliorations', sous: 'Forge, labo, charpentier…' },
];

export function EncycloPage() {
  const counts = meta.counts as Record<string, number>;
  return (
    <>
      <TopBar title="Encyclopédie" />
      <main class="page" id="main">
        <section>
          <h2 class="section-title">Progression de l'île</h2>
          <div class="grid">
            {SPECIAL.map((s) => (
              <a key={s.href} class="tile" href={s.href}>
                <Icon name={s.icon} class="pic" />
                <strong>{s.titre}</strong>
                <small>{s.sous}</small>
              </a>
            ))}
          </div>
        </section>
        {DOMAIN_GROUPS.map((g) => (
          <section key={g.titre}>
            <h2 class="section-title">{g.titre}</h2>
            <div class="grid">
              {g.doms.filter((d) => counts[d]).map((d) => (
                <a key={d} class="tile" href={`#/encyclo/${d}`}>
                  <Icon name={d} class="pic" />
                  <strong>{DOMAINS[d]}</strong>
                  <small>{counts[d]} fiches</small>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

const SB = [1, 2, 4, 8];

export function DomainListPage({ dom }: { dom: string }) {
  const [all, setAll] = useState<Entry[] | null>(null);
  const q = route.value.query;
  const cat = q.get('cat') ?? '';
  const season = q.get('saison') ?? '';
  useEffect(() => {
    loadEntries().then((l) => setAll(l.filter((e) => e.dom === dom).sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))));
  }, [dom]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all ?? []) m.set(e.cat, (m.get(e.cat) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const hasSeasons = useMemo(() => (all ?? []).some((e) => e.seasons), [all]);
  const items = useMemo(() => {
    const si = SEASONS.indexOf(season as any);
    return (all ?? []).filter((e) => (!cat || e.cat === cat) && (si < 0 || !e.seasons || e.seasons & SB[si]));
  }, [all, cat, season]);
  const set = (k: string, v: string) => go(`/encyclo/${dom}`, { cat: k === 'cat' ? v : cat || undefined, saison: k === 'saison' ? v : season || undefined }, true);

  return (
    <>
      <TopBar title={DOMAINS[dom] ?? dom} backTo="/encyclo" />
      <main class="page" id="main">
        {cats.length > 1 && (
          <div class="chips" role="group" aria-label="Catégorie">
            <button class="chip" aria-pressed={!cat} onClick={() => set('cat', '')}>
              Tout
            </button>
            {cats.map(([c, n]) => (
              <button key={c} class="chip" aria-pressed={cat === c} onClick={() => set('cat', cat === c ? '' : c)}>
                {c} <span class="note">{n}</span>
              </button>
            ))}
          </div>
        )}
        {hasSeasons && (
          <div class="chips" role="group" aria-label="Saison">
            {SEASONS.map((s) => (
              <button key={s} class="chip" aria-pressed={season === s} onClick={() => set('saison', season === s ? '' : s)}>
                <span class="season-dot" style={{ background: `var(--s-${s})` }} />
                {SEASON_FR[s]}
              </button>
            ))}
          </div>
        )}
        <p class="note" style={{ margin: '0 4px 8px' }} aria-live="polite">
          {all ? `${items.length} fiche${items.length > 1 ? 's' : ''}` : 'Chargement…'}
        </p>
        {all && !items.length && <Empty>Aucune fiche avec ces filtres.</Empty>}
        {items.length > 0 && (
          <VirtualList
            items={items}
            rowHeight={64}
            render={(e) => <EntryRow e={e} sub={<>{e.hasFr ? `${e.en} · ` : ''}{e.cat} <SeasonBadges mask={e.seasons} /></>} />}
          />
        )}
      </main>
    </>
  );
}
