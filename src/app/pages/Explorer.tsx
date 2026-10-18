// Onglet Explorer : l'encyclopédie rangée par intention de jeu, tuiles illustrées par le jeu.
import { useEffect, useState } from 'preact/hooks';
import { DOMAINS, entry, loadEntries, meta } from '../data.ts';
import { GameImg, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { ClockChip } from '../../ui/Clock.tsx';

type Tile = { href: string; label: string; sub?: string; img?: string; icon: string };
const counts = meta.counts as Record<string, number>;
const dom = (d: string, img: string): Tile => ({ href: `#/explorer/${d}`, label: DOMAINS[d] ?? d, sub: `${counts[d] ?? 0}`, img, icon: d });

const GROUPS: { titre: string; tiles: Tile[] }[] = [
  { titre: 'Capturer', tiles: [dom('poissons', 'tuna'), dom('insectes', 'atlas-moth'), dom('creatures-marines', 'blue-lobster')] },
  { titre: 'Cultiver et élever', tiles: [dom('cultures', 'strawberry'), dom('arbres', 'orange'), dom('cueillette', 'daffodil'), dom('elevage', 'chicken')] },
  { titre: 'Habitants', tiles: [dom('pnj', 'scott'), dom('festivals', 'cherry-blossom-potluck'), dom('lieux', 'sams-general-store')] },
  {
    titre: 'Fabriquer',
    tiles: [dom('cuisine', 'pizza'), dom('artisanat', 'olive-jam'), dom('outils', 'pickaxe'), { href: '#/explorer/ameliorations', label: 'Améliorations', sub: 'Forge, labo…', img: 'bronze-bar', icon: 'outils' }],
  },
  {
    titre: "Explorer l'île",
    tiles: [{ href: '#/explorer/mines', label: 'Mines', sub: '4 mines', img: 'earth-geode', icon: 'mines' }, dom('monstres', 'water-slime'), dom('mineraux', 'diamond'), dom('quetes', ''), { href: '#/explorer/rang', label: 'Rang de la ville', sub: 'F → S', icon: 'succes' }],
  },
];
const CATALOGUE = ['ressources', 'vetements', 'mobilier', 'objets', 'armes', 'batiments', 'maitrises', 'succes', 'groupes', 'guides'];

export function ExplorerPage() {
  const [, setReady] = useState(false);
  useEffect(() => {
    loadEntries().then(() => setReady(true));
  }, []);
  return (
    <>
      <TopBar title="Explorer" large subtitle={`${Object.values(counts).reduce((a, b) => a + b, 0)} fiches · version ${meta.game_version}`} actions={<ClockChip />} />
      <main class="page" id="main">
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
                    {e?.img ? <GameImg src={e.img} dom={t.icon} size={52} /> : <span class="tile2-ic"><Icon name={t.icon} /></span>}
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
              <a key={d} class="row cat-row" href={`#/explorer/${d}`}>
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
          </div>
        </section>
      </main>
    </>
  );
}
