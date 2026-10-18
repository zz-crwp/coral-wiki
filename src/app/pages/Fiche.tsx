// Fiche détaillée : identité, données clés, relations croisées (dans les deux sens), article, sources.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Entity } from '../../data/schema.ts';
import { DOMAINS, entry, loadArticle, loadEntity, loadEntries, SEASON_FR, type Block, type Entry, type Season } from '../data.ts';
import { CheckBtn, Empty, GameImg, GIcon, Gold, RichText, TopBar } from '../components.tsx';
import { entityChecks, heartKeys } from '../trackers.ts';
import { isUpgrade, QualityUpgrades, UpgradeList } from '../fiche/upgrades.tsx';
import { NeededFor, NowCard, SpeciesHere, UpgradeSection, Vendors } from '../fiche/context.tsx';
import { active, isChecked, pinned, toggle, togglePin } from '../store.ts';
import { Icon } from '../icons.tsx';
import { Chip, ChipList, Hearts, KV, Prices, Section, SectionOpen, SeasonChips, Timeline } from '../fiche/parts.tsx';
import { EXTRA_FIELDS, GIFT_LEVELS, QUALITY_BY_INDEX, UNIVERSAL_CODE, WEATHER_FR, hours, ranges } from '../fiche/labels.ts';

type X = Record<string, any>;
const CATCH = ['poissons', 'insectes', 'creatures-marines'];
const WEATHERS = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'];

/** Météo : les 6 temps du jeu, actifs en couleur, inactifs estompés (comme le journal du jeu). */
export function WeatherRow({ meteo }: { meteo: string[] }) {
  if (!meteo.length) return <span class="note">à vérifier</span>;
  return (
    <span class="wrow" role="img" aria-label={meteo.length >= 6 ? 'Tous les temps' : meteo.map((w) => WEATHER_FR[w]).join(', ')}>
      {WEATHERS.map((w) => (
        <span key={w} class={`wcell${meteo.includes(w) ? ' on' : ''}`} title={WEATHER_FR[w]}>
          <GIcon k={w === 'blizzard' ? 'snow' : w} size={20} />
          {w === 'blizzard' && <span class="wplus" aria-hidden="true">+</span>}
        </span>
      ))}
    </span>
  );
}

function Spawn({ e }: { e: Entity }) {
  const x = e.extra as X;
  const conds: X[] = Array.isArray(x.conditions) && x.conditions.length ? x.conditions : [{ zone: null, saisons: e.saisons, horaires: e.horaires, meteo: e.meteo, jours: x.jours_saison }];
  return (
    <Section title="Où et quand" count={conds.length > 1 ? conds.length : undefined}>
      {x.profondeur && <p class="note" style={{ margin: '0 0 8px' }}>Profondeur : {x.profondeur}</p>}
      <div class="spawn">
        {conds.map((c, i) => (
          <div key={i} class="spawn-card">
            <h4>{c.zone ?? (e.lieux.length ? e.lieux.join(', ') : 'Lieu à vérifier')}</h4>
            <div class="spawn-row">
              <span class="spawn-k">Saisons</span>
              <SeasonChips seasons={c.saisons} />
              {c.jours?.length > 0 && <span class="badge days">jours {[...new Set(c.jours.map((j: X) => `${j.de}–${j.a}`))].join(', ')}</span>}
            </div>
            <div class="spawn-row">
              <span class="spawn-k">Heures</span>
              <span class="spawn-v">
                {c.horaires.length ? ranges(c.horaires) : <span class="note">à vérifier</span>}
                <Timeline ranges={c.horaires} />
              </span>
            </div>
            {e.meteo.length > 0 || c.meteo?.length > 0 ? (
              <div class="spawn-row">
                <span class="spawn-k">Météo</span>
                <WeatherRow meteo={c.meteo ?? []} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p class="note fine">Heures dérivées des créneaux du wiki (matin, après-midi, soir, nuit) : fiabilité moyenne.</p>
    </Section>
  );
}

/** Contenu d'une fiche (modèle unique pour tous les domaines), affiché dans une sheet ou une page. */
export function FicheView({ id }: { id: string }) {
  const [e, setE] = useState<Entity | null | undefined>(undefined);
  const [art, setArt] = useState<Block[] | undefined>();
  const [all, setAll] = useState<Entry[]>([]);
  useEffect(() => {
    setE(undefined);
    setArt(undefined);
    loadEntries().then(setAll);
    loadEntity(id).then((x) => {
      setE(x ?? null);
      const en = entry(id);
      if (en) loadArticle(en.dom, id).then(setArt);
    });
  }, [id]);

  if (e === undefined) return <div class="fiche-loading" aria-busy="true" />;
  if (e === null) return <Empty icon="search">Cette fiche n'existe pas.</Empty>;
  const dom = entry(id)?.dom ?? 'objets';
  const primary = PRIMARY[dom] ?? PRIMARY_DEFAULT;
  return (
    <SectionOpen.Provider value={(t) => primary.includes(t)}>
    <article class="fiche" data-id={id}>
      <Hero e={e} dom={dom} />
      <NowCard e={e} dom={dom} />
      <TrackCard e={e} dom={dom} />
      <UpgradeSection e={e} />
      {dom === 'lieux' && <SpeciesHere e={e} />}
      <DomainSections e={e} dom={dom} all={all} />
      <KeyFacts e={e} dom={dom} />
      <Relations e={e} dom={dom} all={all} />
      {art && art.length > 0 && (
        <Section title="Article du wiki (anglais)" open={dom === 'guides'}>
          <Article blocks={art} />
        </Section>
      )}
      <Sources e={e} />
    </article>
    </SectionOpen.Provider>
  );
}

/** Section(s) dépliée(s) d'office, par domaine : celle qui répond à la question qu'on se pose en jeu. */
const CATCH_SEC = ['Où et quand'];
const PRIMARY_DEFAULT = ['En bref', 'Obtention', 'Fabrication', 'Recette', 'Améliorer', 'Obtenir'];
const PRIMARY: Record<string, string[]> = {
  poissons: CATCH_SEC,
  insectes: CATCH_SEC,
  'creatures-marines': CATCH_SEC,
  cueillette: [...CATCH_SEC, 'En bref'],
  pnj: ['Cadeaux'],
  lieux: ['Ouverture', 'Articles en vente', 'À trouver ici'],
  outils: ['Améliorer', 'Obtenir'],
  armes: ['Améliorer', 'Obtenir', 'En bref'],
  cultures: ['En bref'],
  arbres: ['En bref'],
  elevage: ['En bref', 'Produits'],
  cuisine: ['Recette'],
  artisanat: ['Fabrication', 'Production'],
  festivals: ['En bref'],
  quetes: ['Quête'],
  maitrises: ['Compétences'],
  guides: ['Article du wiki (anglais)'],
};

/** Ancienne route #/fiche/<id> : page autonome (liens externes, favoris du navigateur). */
export function FichePage({ id }: { id: string }) {
  const e = entry(id);
  return (
    <>
      <TopBar
        title={e?.fr ?? ''}
        backTo={e ? `/explorer/${e.dom}` : '/explorer'}
        actions={
          <button class="icon-btn" aria-pressed={pinned(id)} aria-label={pinned(id) ? 'Retirer de la session' : 'Épingler à la session'} onClick={() => togglePin(id)}>
            <Icon name={pinned(id) ? 'unpin' : 'pin'} />
          </button>
        }
      />
      <main class="page" id="main">
        <FicheView id={id} />
      </main>
    </>
  );
}

function Hero({ e, dom }: { e: Entity; dom: string }) {
  const [showEn, setShowEn] = useState(false);
  return (
    <div class="card">
      <div class="hero">
        <GameImg src={e.image?.url ?? ''} dom={dom} size={96} alt={e.nom_fr} eager />
        <div style={{ minWidth: 0 }}>
          <h2>{e.nom_fr}</h2>
          {e.nom_en !== e.nom_fr && <div class="en" lang="en">{e.nom_en}</div>}
          {e.nom_fr_alias && (
            <div class="en">
              ≈ {e.nom_fr_alias} <span class="note">(nom FR non officiel)</span>
            </div>
          )}
          <div class="badges" style={{ marginTop: 8 }}>
            <a class="badge" href={`#/explorer/${dom}`}>{DOMAINS[dom]}</a>
            {e.categorie && e.categorie !== DOMAINS[dom] && <span class="badge">{e.categorie}</span>}
            {e.sous_categorie && e.sous_categorie !== e.categorie && <span class="badge">{e.sous_categorie}</span>}
          </div>
        </div>
      </div>
      {e.description && (
        <div class="prose">
          <p lang={showEn ? 'en' : 'fr'} style={{ margin: 0 }}>
            {showEn ? e.description_en : e.description}
          </p>
          {e.description_lang === 'fr-trad' && (
            <button class="linkbtn" onClick={() => setShowEn(!showEn)}>
              {showEn ? 'Voir la traduction' : 'Traduction non officielle · voir le texte original'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Cases de suivi de la fiche (même clé que les trackers). */
function TrackCard({ e, dom }: { e: Entity; dom: string }) {
  const items = entityChecks(e as any, dom);
  if (!items.length) return null;
  return (
    <div class="card list track-card" aria-label="Suivi">
      {items.map((it) => (
        <div key={it.key} class={`row trow${isChecked(it.key) ? ' done' : ''}`}>
          <CheckBtn on={isChecked(it.key)} label={it.label} onToggle={() => toggle(it.key)} />
          <a class="trow-link" href={it.href}>
            <span class="txt">
              <span class="name">{it.label}</span>
            </span>
            <Icon name="chevron" class="chev" />
          </a>
        </div>
      ))}
    </div>
  );
}

function KeyFacts({ e, dom }: { e: Entity; dom: string }) {
  const x = e.extra as X;
  const rows: [string, ComponentChildren][] = [];
  const catchDom = CATCH_SEC.includes(dom);
  if (e.saisons.length && !catchDom) rows.push(['Saisons', <SeasonChips seasons={e.saisons} />]);
  if (e.meteo.length && !catchDom) rows.push(['Météo', e.meteo.length >= 6 ? 'Toutes' : e.meteo.map((w) => WEATHER_FR[w] ?? w).join(', ')]);
  if (e.horaires.length && dom !== 'lieux' && !catchDom)
    rows.push([
      'Horaires',
      <>
        {ranges(e.horaires)}
        <Timeline ranges={e.horaires} />
      </>,
    ]);
  if (e.lieux.length && !catchDom) rows.push(['Lieux', e.lieux.join(' · ')]);
  if (x.anniversaire) rows.push(['Anniversaire', `${x.anniversaire.jour} ${SEASON_FR[x.anniversaire.saison as Season]?.toLowerCase()}`]);
  if (x.mariable) rows.push(['Mariable', 'Oui']);
  if (x.date) rows.push(['Date', `${x.date.jour}${x.date.fin ? `–${x.date.fin}` : ''} ${SEASON_FR[x.date.saison as Season]?.toLowerCase()}`]);
  if (e.horaires_texte && dom === 'festivals') rows.push(['Horaires', e.horaires_texte]);
  for (const [k, label, fmt] of EXTRA_FIELDS) {
    const v = x[k];
    if (v === undefined || v === null || v === '' || typeof v === 'object') continue;
    if (k === 'sante' && x.pv != null) continue; // monstres : « pv » et « santé » sont la même valeur
    if (k === 'famille' && dom === 'pnj') rows.push(['Famille', String(v).replace(/\s*\n\s*/g, ', ')]);
    else rows.push([label, typeof v === 'number' && fmt ? fmt(v) : String(v).replace(/\s*\n\s*/g, ', ')]);
  }
  if (x.debloque_par) rows.push(['Débloqué par', <Chip id={x.debloque_par.maitrise} note={`niveau ${x.debloque_par.niveau}`} />]);
  if (x.don_musee) rows.push(['Musée', <a href="#/progression/musee">Peut être donné au musée</a>]);
  if (x.image_de) rows.push(['Image', <span class="note">portrait du propriétaire (pas de photo du lieu)</span>]);
  const hasPrice = e.prix && e.prix.base;
  if (!rows.length && !hasPrice) return null;
  return (
    <Section title="En bref">
      {hasPrice && (
        <>
          <p class="note" style={{ margin: '0 0 6px' }}>Prix de vente par qualité (or)</p>
          <Prices prix={e.prix as any} />
        </>
      )}
      <KV rows={rows} />
    </Section>
  );
}

function DomainSections({ e, dom, all }: { e: Entity; dom: string; all: Entry[] }) {
  const x = e.extra as X;
  const out: ComponentChildren[] = [];

  // Poissons, insectes, créatures : où et quand (une carte par zone)
  if (CATCH_SEC.includes(dom)) out.push(<Spawn e={e} />);

  // Lieux : horaires d'ouverture + stock
  if (Array.isArray(x.ouverture) && x.ouverture.length)
    out.push(
      <Section title="Ouverture">
        <KV rows={[...x.ouverture.map((o: X) => [o.jours, ranges(o.plages)] as [string, string]), ...(x.ferme_le ? [['Fermé', x.ferme_le] as [string, string]] : [])]} />
      </Section>,
    );
  if (Array.isArray(x.stock) && x.stock.length) {
    const ups = x.stock.filter(isUpgrade);
    const sale = x.stock.filter((r: X) => !isUpgrade(r));
    if (ups.length)
      out.push(
        <Section title="Améliorations" count={ups.length}>
          <UpgradeList rows={ups} />
        </Section>,
      );
    if (x.ameliorations_qualite)
      out.push(
      <Section title="Amélioration de la qualité des produits">
        <QualityUpgrades data={x.ameliorations_qualite} />
      </Section>,
    );
    if (sale.length) out.push(<Stock rows={sale} />);
  }

  // PNJ
  if (dom === 'pnj') {
    out.push(<NpcGifts e={e} all={all} />);
    if (Array.isArray(x.emploi_du_temps)) out.push(<Schedule data={x.emploi_du_temps} />);
    if (Array.isArray(x.evenements_coeur))
      out.push(
        <Section title="Événements de cœur" count={x.evenements_coeur.length}>
          <ol class="events">
            {x.evenements_coeur.map((h: X, i: number, arr: X[]) => {
              const key = heartKeys(e.id, arr.map((v) => v.coeurs))[i];
              return (
              <li key={i} class="event">
                <CheckBtn on={isChecked(key)} label={`Scène ${h.coeurs ? `${h.coeurs} cœurs ` : ''}vue`} onToggle={() => toggle(key)} />
                <Hearts n={h.coeurs} />
                <div>
                  <p>{h.resume ?? h.resume_en ?? <span class="note">Résumé à vérifier</span>}</p>
                  <p class="note">
                    {[h.condition && h.condition !== 'Any' ? h.condition : null, ranges(h.horaires ?? []), h.lieu].filter(Boolean).join(' · ')}
                    {h.lieu_id && <> · <a href={`#/fiche/${h.lieu_id}`}>voir le lieu</a></>}
                  </p>
                </div>
              </li>
              );
            })}
          </ol>
        </Section>,
      );
    if (Array.isArray(x.sorties))
      out.push(
        <Section title="Sorties (hangouts)" count={x.sorties.length} open={false}>
          <ol class="events">
            {x.sorties.map((h: X, i: number) => (
              <li key={i} class="event">
                <Hearts n={h.coeurs} />
                <div>
                  <p>{h.resume ?? h.resume_en}</p>
                  {h.prerequis && h.prerequis !== 'Aucune' && <p class="note">Prérequis : {h.prerequis}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>,
      );
    if (x.mariage || x.romance)
      out.push(
        <Section title="Mariage" open={false}>
          <p class="prose">{x.mariage ?? x.romance}</p>
        </Section>,
      );
    if (Array.isArray(x.lettres))
      out.push(
        <Section title="Lettres" count={x.lettres.length} open={false}>
          <ul class="letters">
            {x.lettres.map((l: X, i: number) => (
              <li key={i}>
                <p>{l.texte ?? l.texte_en}</p>
                {l.pieces_jointes && <ChipList ids={l.pieces_jointes.map((p: X) => p.id)} notes={Object.fromEntries(l.pieces_jointes.map((p: X) => [p.id, `×${p.n}`]))} />}
              </li>
            ))}
          </ul>
        </Section>,
      );
  }

  // Maîtrises
  if (dom === 'maitrises') {
    if (Array.isArray(x.competences) && x.competences.length)
      out.push(
        <Section title="Compétences" count={x.competences.length}>
          <ul class="skills">
            {x.competences.map((c: X) => (
              <li key={c.nom_en}>
                <strong>{c.nom ?? c.nom_en}</strong> <span class="note" lang="en">({c.nom_en})</span>
                <p>{c.effet ?? c.effet_en}</p>
              </li>
            ))}
          </ul>
        </Section>,
      );
    if (Array.isArray(x.niveaux))
      out.push(
        <Section title="Recettes débloquées par niveau">
          {x.niveaux.map((n: X) => (
            <div key={n.niveau} class="lvl">
              <span class="lvl-n">Niv. {n.niveau}</span>
              {n.recettes.length ? <ChipList ids={n.recettes.filter((r: string) => entry(r))} /> : <span class="note">—</span>}
            </div>
          ))}
        </Section>,
      );
    if (Array.isArray(x.experience) && x.experience.length)
      out.push(
        <Section title="Expérience" open={false}>
          <KV rows={x.experience.map((r: X) => [r.action, r.points] as [string, string])} />
        </Section>,
      );
  }

  // Quêtes
  if (dom === 'quetes') {
    out.push(
      <Section title="Quête">
        <KV
          rows={[
            ['Donnée par', x.donneur],
            ['Objectifs', e.prerequis.length ? <ul class="plain">{e.prerequis.map((p) => <li key={p}><RichText text={p} /></li>)}</ul> : undefined],
            ['Récompenses', x.recompenses],
            ['Catégorie', e.sous_categorie],
          ]}
        />
      </Section>,
    );
  }

  // Monstres et contenants : butin
  if (Array.isArray(x.butin) && x.butin.length)
    out.push(
      <Section title={dom === 'monstres' ? 'Butin' : 'Contenu possible'} count={x.butin.length}>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Objet</th><th>Chance</th>{x.butin.some((b: X) => b.quantite) && <th>Qté</th>}{x.butin.some((b: X) => b.rang) && <th>Rang</th>}</tr></thead>
            <tbody>
              {x.butin.map((b: X, i: number) => (
                <tr key={i}>
                  <td>{b.item ? <Chip id={b.item} size={24} /> : b.nom}</td>
                  <td>{b.chance ?? '—'}</td>
                  {x.butin.some((bb: X) => bb.quantite) && <td>{b.quantite ?? ''}</td>}
                  {x.butin.some((bb: X) => bb.rang) && <td>{b.rang ?? ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>,
    );

  // Groupes : membres
  if (Array.isArray(x.membres) && x.membres.length) out.push(<Section title="Objets du groupe" count={x.membres.length}><ChipList ids={x.membres} limit={60} /></Section>);

  return <>{out}</>;
}

function Relations({ e, dom, all }: { e: Entity; dom: string; all: Entry[] }) {
  const x = e.extra as X;
  const out: ComponentChildren[] = [];
  // La ligne « voir Améliorations » est inutile quand la section Améliorer est affichée sur la même fiche
  const obt = x.ameliorations?.length ? e.obtention.filter((o) => !o.includes('(voir Améliorations)')) : e.obtention;
  if (obt.length)
    out.push(
      <Section title="Obtention">
        <ul class="plain">
          {obt.map((o) => (
            <li key={o}>
              <RichText text={o} />
            </li>
          ))}
        </ul>
      </Section>,
    );
  if (Array.isArray(x.recettes) && x.recettes.length)
    out.push(
      <Section title={dom === 'cuisine' ? 'Recette' : 'Fabrication'}>
        {x.recettes.map((r: X, i: number) => (
          <div key={i} class="recipe">
            <ChipList ids={r.ingredients.map((g: X) => g.id)} notes={Object.fromEntries(r.ingredients.map((g: X) => [g.id, `×${g.n}${g.qualite ? ` · ${QUALITY_BY_INDEX[g.qualite]}` : ''}`]))} limit={30} />
            <p class="note">
              {[r.outil && (entry(r.outil) ? `Ustensile : ${entry(r.outil)!.fr}` : `Ustensile : ${r.outil}`), r.duree && `Durée : ${r.duree}`, r.rendement && `Rendement : ${r.rendement}`, r.non_resolus && `Aussi : ${r.non_resolus.join(', ')}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        ))}
      </Section>,
    );
  if (Array.isArray(x.vendu_par) && x.vendu_par.length) out.push(<Vendors rows={x.vendu_par} />);
  if (Array.isArray(x.obtenu_de) && x.obtenu_de.length)
    out.push(<Section title="Obtenu de" count={x.obtenu_de.length} open={x.obtenu_de.length <= 8}><ChipList ids={x.obtenu_de.map((o: X) => o.source)} notes={Object.fromEntries(x.obtenu_de.filter((o: X) => o.chance).map((o: X) => [o.source, o.chance]))} /></Section>);
  if (x.graine) out.push(<Section title="Graine"><Chip id={x.graine} /></Section>);
  if (x.donne) out.push(<Section title="Donne"><Chip id={x.donne} /></Section>);
  if (x.machine) out.push(<Section title="Production"><KV rows={[['Machine', <Chip id={x.machine} />], ['À partir de', x.intrants ? <ChipList ids={x.intrants} /> : undefined]]} /></Section>);
  if (Array.isArray(x.produits) && x.produits.length) out.push(<Section title={dom === 'elevage' ? 'Produits' : 'Produit'} count={x.produits.length}><ChipList ids={x.produits} limit={30} /></Section>);
  if (Array.isArray(x.produit_par) && x.produit_par.length) out.push(<Section title="Produit par"><ChipList ids={x.produit_par} /></Section>);
  if (Array.isArray(x.recettes_associees) && x.recettes_associees.length) out.push(<Section title="Recettes avec cet ustensile" count={x.recettes_associees.length}><ChipList ids={x.recettes_associees} limit={30} /></Section>);
  if (Array.isArray(x.utilise_pour) && x.utilise_pour.length) out.push(<NeededFor e={e} />);
  if (e.utilise_dans.length) out.push(<Section title="Utilisé dans" count={e.utilise_dans.length}><ChipList ids={e.utilise_dans} limit={24} /></Section>);
  if (Array.isArray(x.offrandes) && x.offrandes.length)
    out.push(
      <Section title="Offrande du temple">
        <ul class="plain">
          {x.offrandes.map((o: X, i: number) => (
            <li key={i}>
              <a href={`#/progression/temple?open=${o.offrande}`}>{o.nom ?? o.offrande}</a> <span class="note">({o.autel_nom})</span> — ×{o.n}
              {o.qualite ? ` (qualité ${QUALITY_BY_INDEX[o.qualite]} minimum)` : ''}
            </li>
          ))}
        </ul>
      </Section>,
    );
  if (Array.isArray(x.requis_pour) && x.requis_pour.length) out.push(<Section title="Requis pour"><ChipList ids={x.requis_pour.map((r: X) => r.id)} /></Section>);
  if (Array.isArray(x.groupes) && x.groupes.length) out.push(<Section title="Fait partie de"><ChipList ids={x.groupes} /></Section>);
  if (dom !== 'pnj') out.push(<LikedBy e={e} all={all} />);
  const seeAlso = e.liens.filter((l) => entry(l) && !['guides'].includes(entry(l)!.dom)).slice(0, 40);
  if (seeAlso.length) out.push(<Section title="Voir aussi" open={false}><ChipList ids={seeAlso} limit={12} /></Section>);
  return <>{out}</>;
}

/** « Aimé par » : niveaux explicites + niveau universel pour les autres personnages. */
function LikedBy({ e, all }: { e: Entity; all: Entry[] }) {
  const x = e.extra as X;
  const levels = GIFT_LEVELS.filter((l) => (e.aime_par as X)[l.key]?.length);
  if (!levels.length && !x.cadeau_universel) return null;
  const uni = GIFT_LEVELS.find((l) => l.key === x.cadeau_universel);
  return (
    <Section title="Aimé par">
      {levels.map((l) => (
        <div key={l.key} class={`gift gift-${l.key}`}>
          <span class="gift-l">{l.label}</span>
          <ChipList ids={(e.aime_par as X)[l.key]} limit={12} />
        </div>
      ))}
      {uni && <p class="note">Tous les autres personnages : <strong>{uni.label.toLowerCase()}</strong> (préférence universelle).</p>}
      {!uni && all.length > 0 && <p class="note">Autres personnages : neutre ou non renseigné.</p>}
    </Section>
  );
}

/** Cadeaux d'un PNJ : préférences explicites + objets universels non contredits. */
function NpcGifts({ e, all }: { e: Entity; all: Entry[] }) {
  const x = e.extra as X;
  const explicit: Record<string, string[]> = x.cadeaux ?? {};
  const listed = useMemo(() => new Set(Object.values(explicit).flat()), [e.id]);
  const universal = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const it of all) if (it.universal && !listed.has(it.id)) (m[UNIVERSAL_CODE[it.universal]] ??= []).push(it.id);
    return m;
  }, [all, e.id]);
  if (!Object.keys(explicit).length) return null;
  return (
    <Section title="Cadeaux">
      {GIFT_LEVELS.map((l) =>
        explicit[l.key]?.length || universal[l.key]?.length ? (
          <div key={l.key} class={`gift gift-${l.key}`}>
            <span class="gift-l">{l.label}</span>
            {explicit[l.key]?.length ? <ChipList ids={explicit[l.key]} limit={l.key === 'love' ? 30 : 12} /> : null}
            {universal[l.key]?.length ? (
              <details class="uni">
                <summary>+ {universal[l.key].length} objets « {l.label.toLowerCase()} » universels</summary>
                <ChipList ids={universal[l.key]} limit={30} />
              </details>
            ) : null}
          </div>
        ) : null,
      )}
    </Section>
  );
}

function Schedule({ data }: { data: X[] }) {
  const [tab, setTab] = useState(0);
  const cur = data[tab];
  return (
    <Section title="Emploi du temps">
      {data.length > 1 && (
        <div class="chips" role="tablist">
          {data.map((s, i) => (
            <button key={i} role="tab" class="chip" aria-selected={tab === i} onClick={() => setTab(i)}>
              {s.condition}
            </button>
          ))}
        </div>
      )}
      {cur.groupes.map((g: X, i: number) => (
        <div key={i} class="sched">
          <h4>{g.jours}</h4>
          <ol>
            {g.etapes.map((st: X, k: number) => (
              <li key={k}>
                <time>{hours(st.heure)}</time>
                <span>{st.texte}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </Section>
  );
}

function Stock({ rows }: { rows: X[] }) {
  const rayons = [...new Set(rows.map((r) => r.rayon ?? ''))];
  const [season, setSeason] = useState('');
  const filtered = season ? rows.filter((r) => !r.saisons || r.saisons.includes(season)) : rows;
  return (
    <Section title="Articles en vente" count={rows.length}>
      {rows.some((r) => r.saisons && r.saisons.length < 4) && (
        <div class="chips" role="group" aria-label="Saison">
          {(['', 'spring', 'summer', 'fall', 'winter'] as const).map((s) => (
            <button key={s} class="chip" aria-pressed={season === s} onClick={() => setSeason(s)}>
              {s ? SEASON_FR[s] : 'Toutes'}
            </button>
          ))}
        </div>
      )}
      {rayons.map((ray) => {
        const list = filtered.filter((r) => (r.rayon ?? '') === ray);
        if (!list.length) return null;
        return (
          <div key={ray}>
            {rayons.length > 1 && <h4 class="art-h">{ray}</h4>}
            <div class="table-wrap">
              <table>
                <thead><tr><th>Article</th><th>Prix</th>{list.some((r) => r.rang) && <th>Rang</th>}{list.some((r) => r.saisons) && <th>Saisons</th>}</tr></thead>
                <tbody>
                  {list.map((r, i) => (
                    <tr key={i}>
                      <td>{r.item ? <Chip id={r.item} size={24} /> : r.nom}</td>
                      <td>{r.prix == null ? '—' : r.devise === 'or' ? <Gold n={r.prix} /> : `${r.prix} ${r.devise}`}</td>
                      {list.some((rr) => rr.rang) && <td>{r.rang ?? ''}</td>}
                      {list.some((rr) => rr.saisons) && <td>{r.saisons ? (r.saisons.length === 4 ? 'Toutes' : r.saisons.map((s: Season) => SEASON_FR[s]).join(', ')) : ''}{r.annee_min ? ` (an ${r.annee_min}+)` : ''}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </Section>
  );
}

function Sources({ e }: { e: Entity }) {
  return (
    <Section title="Sources et fiabilité" open={false}>
      {e.sources.map((s) => (
        <p key={s.url} style={{ margin: '4px 0' }}>
          <a href={s.url} target="_blank" rel="noopener">
            {s.name} <Icon name="external" style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px' }} />
          </a>
          {s.date && <span class="note"> · rév. {s.date}</span>}
        </p>
      ))}
      <p class="note">
        Confiance : <strong>{e.confiance}</strong>
        {e.a_verifier.length ? ` · à vérifier : ${e.a_verifier.join(', ')}` : ''}. Contenu sous licence CC BY-SA ; images © Stairway Games.
      </p>
    </Section>
  );
}

/** Rendu des blocs d'article (titres, paragraphes, listes, tableaux défilants). */
export function Article({ blocks }: { blocks: Block[] }) {
  return (
    <section class="article" aria-label="Article du wiki" lang="en">
      {blocks.map((b, i) => {
        if (b.t === 'h') return b.l <= 2 ? <h3 key={i} class="section-title">{b.x}</h3> : <h4 key={i} class="art-h">{b.x}</h4>;
        if (b.t === 'p') return <p key={i} class="art-p"><RichText text={b.x} /></p>;
        if (b.t === 'ul')
          return (
            <ul key={i} class="art-ul">
              {b.i.map((x, k) => <li key={k}><RichText text={x} /></li>)}
            </ul>
          );
        return (
          <div key={i} class="table-wrap" tabIndex={0} role="region" aria-label={b.c ?? 'Tableau'}>
            <table>
              {b.c && b.c !== 'shop' && b.c !== 'offering' && <caption>{b.c}</caption>}
              {b.h.length > 0 && (
                <thead>
                  <tr>{b.h.map((h, k) => <th key={k} scope="col"><RichText text={h} /></th>)}</tr>
                </thead>
              )}
              <tbody>
                {b.r.map((r, k) => (
                  <tr key={k}>{r.map((c, j) => <td key={j}><RichText text={c} /></td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
