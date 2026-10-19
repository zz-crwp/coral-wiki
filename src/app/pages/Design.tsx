// Page interne /design : le système de design en un seul endroit — couleurs (valeurs lues dans les jetons),
// typographie, icônes, contrôles, tuiles d'images et un exemple de ligne repliable par domaine, avec ses états.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Entity } from '../../data/schema.ts';
import { entry, loadDomain, loadEntries, type Entry } from '../data.ts';
import { GameImg, TopBar } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { active } from '../store.ts';
import { loadToday, type TodayData } from '../game.ts';
import { kindOf, rowCtx, rowFor, type Kind } from '../rows.tsx';
import { XRow } from '../../ui/XRow.tsx';
import { FChip, Filters, Pill, Ring, Segmented, SeasonPills } from '../../ui/controls.tsx';
import { openMenu, toast } from '../../ui/feedback.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { ClockChip } from '../../ui/Clock.tsx';

const PALETTE: [string, string][] = [
  ['lagon', 'Lagon — eau peu profonde, couleur du logo'],
  ['lagon-deep', 'Lagon profond'],
  ['foam', 'Écume'],
  ['abyss', 'Abysses'],
  ['palm', 'Palme'],
  ['jungle', 'Jungle'],
  ['sand', 'Sable mouillé'],
  ['sand-light', 'Sable sec'],
  ['coral', 'Corail'],
  ['hibiscus', 'Hibiscus'],
  ['sunset', 'Couchant'],
  ['ink-logo', 'Encre du logo'],
];
const SEASONS: [string, string][] = [
  ['spring', 'Printemps'],
  ['summer', 'Été'],
  ['fall', 'Automne'],
  ['winter', 'Hiver'],
];
const SYSTEM = ['bg', 'surface', 'surface-2', 'fill', 'separator', 'label', 'label-2', 'label-3', 'tint', 'ok', 'warn', 'ko'];
const TYPE: [string, string][] = [
  ['t-large', 'Grand titre — Fredoka'],
  ['t-title1', 'Titre 1'],
  ['t-title2', 'Titre 2'],
  ['t-title3', 'Titre 3'],
  ['t-headline', 'Titre de ligne'],
  ['t-callout', 'Accroche'],
  ['t-subhead', 'Sous-titre'],
  ['t-footnote', 'Note'],
  ['t-caption', 'Légende'],
];
const ICONS = ['today', 'explore', 'progress', 'session', 'search', 'pin', 'undo', 'settings', 'heart', 'gift', 'clock', 'shop', 'coin', 'calendar-days', 'poissons', 'insectes', 'creatures-marines', 'cultures', 'arbres', 'cueillette', 'elevage', 'pnj', 'lieux', 'cuisine', 'artisanat', 'outils', 'mineraux', 'monstres', 'temple', 'mines', 'sun', 'rain', 'storm', 'snow', 'windy'];

/** Un exemple réel par modèle de ligne, et pourquoi la ligne repliée affiche ce qu'elle affiche. */
const MODELS: { kind: Kind; dom: string; id: string; why: string }[] = [
  { kind: 'catch', dom: 'poissons', id: 'arapaima', why: 'Pêche et chasse : « est-ce que je peux l’attraper là, maintenant ? » → saisons, heures, météo, lieu et pastille « Maintenant ».' },
  { kind: 'crop', dom: 'cultures', id: 'strawberry', why: 'Cultures : « est-ce que ça vaut le coup de planter aujourd’hui ? » → jours de pousse, repousse, bénéfice par jour restant.' },
  { kind: 'npc', dom: 'pnj', id: 'scott', why: 'Habitants : « où est-il et qu’est-ce que je lui offre ? » → lieu actuel, anniversaire, cœurs.' },
  { kind: 'tool', dom: 'outils', id: 'pickaxe', why: 'Outils : « que me faut-il pour le prochain palier ? » → chaîne de paliers et coût du suivant en matériaux.' },
  { kind: 'place', dom: 'lieux', id: 'sams-general-store', why: 'Boutiques : « est-ce ouvert là, tout de suite ? » → ouvert / fermé, heure de fermeture ou prochaine ouverture.' },
  { kind: 'recipe', dom: 'cuisine', id: 'pizza', why: 'Recettes : « ai-je de quoi la cuisiner ? » → ingrédients en mini-icônes, ustensile.' },
  { kind: 'festival', dom: 'festivals', id: 'cherry-blossom-potluck', why: 'Festivals : « c’est quand ? » → date, compte à rebours, en cours.' },
  { kind: 'forage', dom: 'cueillette', id: 'daffodil', why: 'Cueillette : « ça pousse en ce moment ? » → saisons et lieux.' },
  { kind: 'material', dom: 'mineraux', id: 'diamond', why: 'Matériaux : « où le trouver et à quoi il sert ? » → source principale et utilisations.' },
];

function useTokens(names: string[], themeKey: string) {
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setV(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])));
  }, [themeKey]);
  return v;
}

function Swatches({ list, themeKey }: { list: [string, string][]; themeKey: string }) {
  const v = useTokens(list.map(([n]) => n), themeKey);
  return (
    <div class="swatches">
      {list.map(([n, l]) => (
        <div key={n} class="swatch">
          <span class="chip" style={{ background: `var(--${n})` }} />
          <span class="txt">
            <strong>--{n}</strong>
            <small class="tabular">{v[n]}</small>
            <small>{l}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function DesignPage() {
  const [t, setT] = useState<TodayData | null>(null);
  const [ents, setEnts] = useState<Map<string, Entity>>(new Map());
  const [open, setOpen] = useState<Set<string>>(new Set(['arapaima']));
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chips, setChips] = useState<Set<string>>(new Set(['maintenant']));
  const [sheet, setSheet] = useState<'' | 'medium' | 'large' | 'fit'>('');
  const [mock, setMock] = useState<'light' | 'dark'>('light');
  const themeKey = document.documentElement.dataset.theme ?? 'system';
  const p = active.value!;

  useEffect(() => {
    loadEntries().then(async () => {
      const maps = await Promise.all([...new Set(MODELS.map((m) => m.dom))].map((d) => loadDomain(d)));
      const m = new Map<string, Entity>();
      for (const x of maps) for (const [k, e] of x) if (MODELS.some((mm) => mm.id === k)) m.set(k, e);
      setEnts(m);
      setT(await loadToday());
    });
  }, []);
  const ctx = useMemo(() => (t ? rowCtx(t, p, ents) : null), [t, p, ents]);
  const toggle = (id: string) => setOpen((s) => new Set(s.has(id) ? [...s].filter((x) => x !== id) : [...s, id]));
  const sys = SYSTEM.map((n) => [n, ''] as [string, string]);

  return (
    <>
      <TopBar title="Système de design" large backTo="/reglages" subtitle="Jetons, composants et états — page interne" actions={<ClockChip />} />
      <main class="page design-page" id="main">
        <h2 class="group-label">Palette du jeu</h2>
        <p class="t-footnote c-2 hint">Extraite par k-means des visuels officiels (logo, ciel, lagon, plage, jungle). Elle sert d’accent : pastilles, anneaux, emblèmes. Le contenu reste sur les gris système.</p>
        <Swatches list={PALETTE} themeKey={themeKey} />
        <h2 class="group-label">Saisons</h2>
        <Swatches list={SEASONS} themeKey={themeKey} />
        <div class="demo-row">
          <SeasonPills seasons={['spring', 'summer', 'fall', 'winter'].slice(0, 3) as any} />
          <SeasonPills seasons={['winter'] as any} />
        </div>
        <h2 class="group-label">Neutres système (thème courant)</h2>
        <Swatches list={sys} themeKey={themeKey} />

        <h2 class="group-label">Typographie</h2>
        <div class="group pad">
          {TYPE.map(([c, l]) => (
            <div key={c} class={`type-row ${c}`}>
              {l}
              <small class="c-3"> .{c}</small>
            </div>
          ))}
          <div class="type-row t-body tabular">Chiffres tabulaires : 1 250 PO · 09:40 · 12/28</div>
        </div>

        <h2 class="group-label">Icônes (Lucide, trait 1,75)</h2>
        <div class="group pad icon-grid">
          {ICONS.map((n) => (
            <span key={n} class="ic-cell" title={n}>
              <Icon name={n} />
              <small>{n}</small>
            </span>
          ))}
        </div>

        <h2 class="group-label">Contrôles</h2>
        <div class="group pad demo-stack">
          <Segmented label="Exemple" value={seg} onChange={setSeg} options={[['a', 'Liste'], ['b', 'Grille'], ['c', 'Carte']]} />
          <Filters label="Filtres d'exemple">
            {['maintenant', 'aujourdhui', 'manquants'].map((k) => (
              <FChip key={k} on={chips.has(k)} n={k === 'manquants' ? 12 : undefined} onClick={() => setChips((s) => new Set(s.has(k) ? [...s].filter((x) => x !== k) : [...s, k]))}>
                {{ maintenant: 'Maintenant', aujourdhui: "Aujourd'hui", manquants: 'Pas attrapés' }[k]}
              </FChip>
            ))}
          </Filters>
          <div class="demo-row">
            <Pill kind="live">Maintenant</Pill>
            <Pill kind="ok" icon="check">Ouvert</Pill>
            <Pill kind="ko">Fermé</Pill>
            <Pill kind="warn">Ferme bientôt</Pill>
            <Pill kind="tint">Palier suivant</Pill>
            <Pill gicon="rain">Pluie</Pill>
          </div>
          <div class="demo-row">
            <button class="btn">Bouton principal</button>
            <button class="btn ghost">Secondaire</button>
            <button class="btn plain">Texte</button>
            <button class="icon-btn" aria-label="Épingler">
              <Icon name="pin" />
            </button>
          </div>
          <div class="demo-row">
            <ClockChip />
            <span class="t-footnote c-2">Puce horloge : toucher ouvre les réglages rapides (+1 h, +1 jour).</span>
          </div>
        </div>

        <h2 class="group-label">Anneaux de progression</h2>
        <div class="group pad demo-row rings">
          <Ring value={41} total={60} size={96} stroke={11} color="var(--palm)" label="Temple">
            <b>68%</b>
          </Ring>
          <Ring value={12} total={60} size={68} stroke={8} color="var(--lagon)" label="Poissons">
            <b>20%</b>
          </Ring>
          <Ring value={60} total={60} size={44} stroke={6} color="var(--sunset)" label="Musée" />
          <Ring value={0} total={60} size={44} stroke={6} color="var(--hibiscus)" label="Cuisine" />
        </div>

        <h2 class="group-label">Tuiles d'images</h2>
        <p class="t-footnote c-2 hint">Proportions natives, aucun filtre ni recadrage : la tuile prend la couleur dominante de l’image (calculée sur 8 × 8 px, pondérée par la saturation), avec une ombre douce.</p>
        <div class="group pad demo-row">
          {['tuna', 'atlas-moth', 'strawberry', 'diamond', 'scott'].map((id) => {
            const e = entry(id);
            return <GameImg key={id} src={e?.img ?? ''} dom={e?.dom ?? 'objets'} size={64} />;
          })}
          <GameImg src={entry('tuna')?.img ?? ''} dom="poissons" size={64} done />
          <GameImg src="" dom="poissons" size={64} />
        </div>
        <p class="t-caption c-3 hint">Dans l’ordre : teintes calculées, état « fait » (pastille), image indisponible (pictogramme du domaine).</p>

        <h2 class="group-label">Lignes repliables par domaine</h2>
        <p class="t-footnote c-2 hint">Règle : repliée, la ligne répond à la question du joueur dans ce contexte ; dépliée, elle donne le reste. Glisser vers la droite coche (toast « Annuler »), appui long ouvre le menu contextuel.</p>
        {!ctx ? (
          <div class="skeleton-list" aria-busy="true" />
        ) : (
          MODELS.map((m) => {
            const en = entry(m.id) as Entry | undefined;
            if (!en) return null;
            const ent = ents.get(m.id);
            const spec = rowFor(kindOf(en.dom, ent), en, ent, ctx);
            return (
              <section key={m.id} class="model">
                <p class="t-footnote c-2 hint">
                  <strong class="c-1">{m.kind}</strong> · {m.why}
                </p>
                <div class="group xlist">
                  <XRow
                    id={`demo-${m.id}`}
                    open={open.has(m.id)}
                    onToggle={() => toggle(m.id)}
                    img={en.img}
                    dom={en.dom}
                    name={en.fr}
                    sub={spec.sub}
                    end={spec.end}
                    done={spec.done}
                    swipe={spec.check ? { on: false, label: spec.check.label, offLabel: spec.check.off, act: () => toast(`${en.fr} : coché (démo)`, () => {}) } : undefined}
                    onLongPress={() => openMenu({ title: en.fr, items: [{ icon: 'pin', label: 'Épingler à la session', onClick: () => toast('Démo : rien n’est modifié') }, { icon: 'book', label: 'Ouvrir la fiche', onClick: () => {} }] })}
                  >
                    {spec.detail()}
                  </XRow>
                </div>
              </section>
            );
          })
        )}
        <section class="model">
          <p class="t-footnote c-2 hint">
            <strong class="c-1">temple</strong> · Offrandes : « que me manque-t-il pour cette offrande ? » → emblème de l’autel, emplacements pleins ou vides comme en jeu, récompense.
          </p>
          <div class="group">
            <a class="row" href="#/collections/temple">
              <span class="txt">
                <span class="name">Voir le Temple du lac</span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          </div>
        </section>

        <h2 class="group-label">Sheets, toasts et menus</h2>
        <div class="group pad demo-row">
          <button class="btn ghost" onClick={() => setSheet('medium')}>Sheet moyenne</button>
          <button class="btn ghost" onClick={() => setSheet('large')}>Sheet grande</button>
          <button class="btn ghost" onClick={() => setSheet('fit')}>Sheet ajustée</button>
          <button class="btn ghost" onClick={() => toast('Poisson-clown : coché', () => toast('Annulé'))}>Toast avec Annuler</button>
          <button class="btn ghost" onClick={() => openMenu({ title: 'Arapaïma', items: [{ icon: 'pin', label: 'Épingler', onClick: () => {} }, { icon: 'check', label: 'Marquer comme attrapé', onClick: () => {} }, { icon: 'external', label: 'Voir la source', onClick: () => {} }] })}>
            Menu contextuel
          </button>
        </div>
        <Sheet open={!!sheet} onClose={() => setSheet('')} title={`Sheet ${sheet === 'medium' ? 'moyenne' : sheet === 'large' ? 'grande' : 'ajustée'}`} detent={sheet || 'large'}>
          <p class="t-body">Glisser la poignée vers le bas pour fermer, vers le haut pour agrandir. Échap ferme aussi. Sur tablette en paysage, la fiche s’ancre à droite de la liste.</p>
        </Sheet>

        <h2 class="group-label">Mouvement</h2>
        <div class="group pad">
          <p class="t-subhead">
            Ressorts de 200 à 350 ms (<code>--dur-fast</code>, <code>--dur</code>, <code>--dur-slow</code>, courbe <code>--ease-spring</code>). Les lignes s’ouvrent sur place (grille 0fr → 1fr). Avec « Réduire les animations », tout devient instantané. Le flou (<code>backdrop-filter</code>) est réservé aux barres et aux sheets.
          </p>
          <Segmented label="Aperçu du fond" value={mock} onChange={setMock} options={[['light', 'Matériau clair'], ['dark', 'Matériau sombre']]} />
          <div class={`material-demo ${mock}`}>
            <div class="bar-sample">Barre en verre</div>
          </div>
        </div>
      </main>
    </>
  );
}
