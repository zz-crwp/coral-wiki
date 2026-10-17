// Améliorations proposées par un magasin (outils, bâtiments, équipement, sac) et amélioration de qualité des graines.
// Présentation proche des écrans du jeu : un bloc par outil ou bâtiment, ses niveaux, l'or et les matériaux.
import type { ComponentChildren } from 'preact';
import { entry } from '../data.ts';
import { GameImg, GIcon, Gold, RichText } from '../components.tsx';
import { Chip } from './parts.tsx';

type Row = Record<string, any>;
const LEVEL: Record<string, { k: string; fr: string }> = {
  bronze: { k: 'bronze', fr: 'Bronze' },
  silver: { k: 'silver', fr: 'Argent' },
  gold: { k: 'gold', fr: 'Or' },
  osmium: { k: 'osmium', fr: 'Osmium' },
};

/** Ligne d'amélioration : coûte des matériaux, ou fait partie d'un rayon d'améliorations. */
export const isUpgrade = (r: Row) => !!r.materiaux?.length || /amélior|agrandi|développer|modifier les bâtiments|charpentier|labo d'artisanat/i.test(r.rayon ?? '');

function level(r: Row) {
  const m = /^(bronze|silver|gold|osmium)\b/i.exec(r.nom ?? '');
  return m ? LEVEL[m[1].toLowerCase()] : null;
}

/** Regroupe les niveaux d'un même outil ou bâtiment (« Bronze axe », « Silver axe »… → Hache). */
function groups(rows: Row[]) {
  const out: { key: string; item: string | null; rows: Row[] }[] = [];
  for (const r of rows) {
    const key = r.item && (level(r) || /level \d|stage \d/i.test(r.nom ?? '')) ? r.item : `${r.item ?? ''}|${r.nom}`;
    const g = out.find((x) => x.key === key);
    if (g) g.rows.push(r);
    else out.push({ key, item: r.item, rows: [r] });
  }
  return out;
}

function title(r: Row): ComponentChildren {
  const lv = level(r);
  const e = r.item ? entry(r.item) : undefined;
  if (lv && e)
    return (
      <>
        <GIcon k={lv.k} size={18} label={lv.fr} /> {lv.fr}
      </>
    );
  const stage = /(level|stage)\s*(\d)/i.exec(r.nom ?? '');
  if (stage && e) return <>Niveau {stage[2]}</>;
  return e && e.en.toLowerCase() === String(r.nom).toLowerCase() ? e.fr : r.nom;
}

function Meta({ r }: { r: Row }) {
  const bits: ComponentChildren[] = [];
  if (r.prix != null) bits.push(<Gold n={r.prix} />);
  if (r.duree) bits.push(<span>{r.duree}</span>);
  if (r.capacite) bits.push(<span>{r.capacite} emplacements</span>);
  if (r.max_animaux) bits.push(<span>{r.max_animaux} animaux max</span>);
  if (r.dimensions) bits.push(<span>{r.dimensions} cases</span>);
  if (r.rang) bits.push(<span class="badge">rang {r.rang}</span>);
  if (r.limite === 1) bits.push(<span>achat unique</span>);
  return (
    <div class="up-meta">
      {bits.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
    </div>
  );
}

export function UpgradeList({ rows, compact }: { rows: Row[]; compact?: boolean }) {
  return (
    <div class="upgrades">
      {groups(rows).map((g) => {
        const e = g.item ? entry(g.item) : undefined;
        const bag = /bag level (\d)/i.exec(g.rows[0].icone ?? '')?.[1];
        return (
          <article key={g.key} class="up-card">
            {!compact && <header>
              {e ? <GameImg src={e.img} dom={e.dom} size={40} /> : bag ? <GIcon k={`bag${bag}`} size={40} /> : null}
              <h4>
                {e ? <a href={`#/fiche/${e.id}`}>{e.fr}</a> : g.rows.length === 1 ? title(g.rows[0]) : g.rows[0].nom}
                {e && !e.hasFr && e.frAlias && <small class="up-alias">≈ {e.frAlias}</small>}
              </h4>
            </header>}
            <ol class="up-levels">
              {g.rows.map((r, i) => (
                <li key={i}>
                  {(g.rows.length > 1 || level(r)) && <div class="up-title">{title(r)}</div>}
                  <Meta r={r} />
                  {r.materiaux?.length > 0 && (
                    <div class="xchips up-mats">
                      {r.materiaux.filter((m: Row) => !compact || m.item !== r.item).map((m: Row, j: number) => (m.item ? <Chip key={j} id={m.item} note={`×${m.n}`} size={24} /> : <span key={j} class="xchip muted">{m.nom} <small>×{m.n}</small></span>))}
                    </div>
                  )}
                  {r.description && (
                    <p class="up-desc">
                      <RichText text={r.description} />
                    </p>
                  )}
                  {r.autre && <p class="up-desc">{r.autre}</p>}
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}

/** Tableau « Amélioration de la qualité des produits » (Labo, Chambre de l'Oracle). */
export function QualityUpgrades({ data }: { data: Row }) {
  const lv = data.niveaux as Row[];
  const kinds: string[] = [...new Set(lv.flatMap((n) => n.couts.map((c: Row) => c.pour)))];
  return (
    <div class="table-wrap">
      <table class="qup">
        <thead>
          <tr>
            <th>Niveau</th>
            {lv.map((n) => (
              <th key={n.niveau}>
                <GIcon k={n.niveau} size={22} label={LEVEL[n.niveau]?.fr} />
                <span class="qup-l">{LEVEL[n.niveau]?.fr}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Prix</th>
            {lv.map((n) => (
              <td key={n.niveau}>
                <Gold n={n.prix} />
              </td>
            ))}
          </tr>
          <tr>
            <th>Durée</th>
            {lv.map((n) => (
              <td key={n.niveau}>{n.jours != null ? `${n.jours} j` : '—'}</td>
            ))}
          </tr>
          {kinds.map((k) => (
            <tr key={k}>
              <th>{k}</th>
              {lv.map((n) => {
                const c = n.couts.find((x: Row) => x.pour === k);
                return <td key={n.niveau}>{!c ? '—' : c.item ? <Chip id={c.item} note={`×${c.n}`} size={24} /> : c.texte}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.chances && (
        <table class="qup">
          <caption>Probabilité de qualité obtenue selon le niveau d'amélioration</caption>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Sans</th>
              {lv.map((n) => (
                <th key={n.niveau}>
                  <GIcon k={n.niveau} size={18} label={LEVEL[n.niveau]?.fr} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.chances.map((c: Row) => (
              <tr key={c.produit}>
                <th>{({ Basic: 'Base', Bronze: 'Bronze', Silver: 'Argent', Gold: 'Or', Osmium: 'Osmium' } as Record<string, string>)[c.produit] ?? c.produit}</th>
                {c.valeurs.map((v: string, i: number) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
