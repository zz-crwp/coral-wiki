// Pages transversales : Temple du lac, Musée, Rang de la ville, Mines.
import { useEffect, useState } from 'preact/hooks';
import { GameImg, RichText, TopBar, Empty } from '../components.tsx';
import { Chip, ChipList, Section } from '../fiche/parts.tsx';
import { loadDomain, loadEntries, type Block } from '../data.ts';
import type { Entity } from '../../data/schema.ts';
import { isUpgrade, QualityUpgrades, UpgradeList } from '../fiche/upgrades.tsx';
import { ranges } from '../fiche/labels.ts';
import { go, route } from '../router.ts';
import { Article } from './Fiche.tsx';
import { QUALITY_BY_INDEX } from '../fiche/labels.ts';

const files = import.meta.glob<{ default: any }>('../../data/{temple,musee,rang,mines}.json');
function useData(name: string) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    Promise.all([loadEntries(), files[`../../data/${name}.json`]()]).then(([, m]) => setD(m.default));
  }, [name]);
  return d;
}

/** Fait défiler jusqu'à l'ancre « #/page#ancre » une fois la page rendue. */
function useAnchor(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const a = location.hash.split('#')[2];
    if (a) requestAnimationFrame(() => document.getElementById(a)?.scrollIntoView({ block: 'start' }));
  }, [ready]);
}

export function RankPage() {
  const d = useData('rang');
  return (
    <>
      <TopBar title="Rang de la ville" large backTo="/explorer" />
      <main class="page fiche" id="main">
        {!d ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <p class="lead">Le rang monte avec les dons au musée, les offrandes du temple et le nettoyage de l'océan. Il débloque graines, animaux et articles.</p>
            {d.rangs.map((r: any) => (
              <Section key={r.rang} title={`Rang ${r.rang}`} count={r.total ?? undefined}>
                <p class="note" style={{ margin: '0 0 6px' }}>{r.points != null ? `${r.points} points (total ${r.total})` : ''}</p>
                <ul class="plain">
                  {r.deblocages.split(' · ').map((x: string, i: number) => <li key={i}><RichText text={x.replace(/^•\s*/, '')} /></li>)}
                </ul>
                {r.autres && (
                  <>
                    <p class="note" style={{ margin: '8px 0 2px' }}>Autres déblocages (non annoncés en jeu)</p>
                    <ul class="plain">{r.autres.split(' · ').map((x: string, i: number) => <li key={i}><RichText text={x.replace(/^•\s*/, '')} /></li>)}</ul>
                  </>
                )}
              </Section>
            ))}
            <Section title="Article du wiki (anglais)" open={false}>
              <Article blocks={d.article} />
            </Section>
          </>
        )}
      </main>
    </>
  );
}

export function MinesPage() {
  const d = useData('mines');
  return (
    <>
      <TopBar title="Mines" large backTo="/explorer" />
      <main class="page fiche" id="main">
        {!d ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <p class="lead">4 mines de 40 étages, ascenseur tous les 5 étages, coffre tous les 10. Terminer une mine débloque la suivante (terre → eau → vent → feu).</p>
            {d.mines.map((m: any) => (
              <Section key={m.id} title={m.nom_fr} id={m.id}>
                <h4 class="art-h">Récompenses</h4>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Condition</th><th>Récompense</th></tr></thead>
                    <tbody>
                      {m.recompenses.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><RichText text={r.condition} /></td>
                          <td>{r.objet ? <Chip id={r.objet} note={r.quantite ? `×${r.quantite}` : undefined} size={24} /> : r.autre ? <RichText text={r.autre} /> : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {m.monstres.length > 0 && (
                  <>
                    <h4 class="art-h">Monstres</h4>
                    <ChipList ids={m.monstres.map((x: any) => x.id)} notes={Object.fromEntries(m.monstres.filter((x: any) => x.etages).map((x: any) => [x.id, `étages ${x.etages[0]}–${x.etages[1]}`]))} limit={30} />
                  </>
                )}
                {m.article.length > 0 && (
                  <details class="uni">
                    <summary>Détails du wiki (minerais, objets, poissons — anglais)</summary>
                    <Article blocks={m.article} />
                  </details>
                )}
              </Section>
            ))}
          </>
        )}
      </main>
    </>
  );
}

// ---------- Améliorations par magasin ----------

const UP_ORDER = ['sanchez-brothers-blacksmith', 'beach-shack', 'laboratory', 'carpenter', 'sams-general-store', 'oracle-chamber', 'underwater-ranch'];

export function UpgradesPage() {
  const [shops, setShops] = useState<Entity[] | null>(null);
  useEffect(() => {
    Promise.all([loadEntries(), loadDomain('lieux')]).then(([, m]) => {
      const list = [...m.values()].filter((e) => (e.extra as any).ameliorations_qualite || ((e.extra as any).stock ?? []).some(isUpgrade));
      list.sort((a, b) => (UP_ORDER.indexOf(a.id) + 1 || 99) - (UP_ORDER.indexOf(b.id) + 1 || 99));
      setShops(list);
    });
  }, []);
  const sel = route.value.query.get('magasin') ?? '';
  const shown = shops?.filter((s) => !sel || s.id === sel) ?? [];
  return (
    <>
      <TopBar title="Améliorations" large backTo="/explorer" />
      <main class="page fiche" id="main">
        {!shops ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <div class="chips" role="group" aria-label="Magasin">
              <button class="chip" aria-pressed={!sel} onClick={() => go('/ameliorations', undefined, true)}>
                Tous
              </button>
              {shops.map((s) => (
                <button key={s.id} class="chip" aria-pressed={sel === s.id} onClick={() => go('/ameliorations', { magasin: sel === s.id ? undefined : s.id }, true)}>
                  {s.nom_fr}
                </button>
              ))}
            </div>
            {shown.map((s) => {
              const x = s.extra as any;
              const ups = (x.stock ?? []).filter(isUpgrade);
              const rayons = [...new Set(ups.map((r: any) => r.rayon ?? ''))] as string[];
              return (
                <section key={s.id} class="up-shop" id={s.id}>
                  <header class="up-shop-h">
                    <GameImg src={s.image?.url ?? ''} dom="lieux" size={48} />
                    <div>
                      <h2>
                        <a href={`#/fiche/${s.id}`}>{s.nom_fr}</a>
                      </h2>
                      <p class="note">
                        {(x.ouverture ?? []).map((o: any) => `${o.jours} ${ranges(o.plages)}`).join(' · ')}
                        {x.ferme_le ? ` · fermé : ${x.ferme_le}` : ''}
                      </p>
                    </div>
                  </header>
                  {x.ameliorations_qualite && (
                    <Section title="Amélioration de la qualité des produits">
                      <QualityUpgrades data={x.ameliorations_qualite} />
                    </Section>
                  )}
                  {rayons.map((ray) => (
                    <Section key={ray} title={ray.replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1') || 'Améliorations'} count={ups.filter((r: any) => (r.rayon ?? '') === ray).length}>
                      <UpgradeList rows={ups.filter((r: any) => (r.rayon ?? '') === ray)} />
                    </Section>
                  ))}
                </section>
              );
            })}
            <p class="note fine">Source : pages des magasins du Coral Island Wiki. Les améliorations d'outils immobilisent l'outil pendant la durée indiquée.</p>
          </>
        )}
      </main>
    </>
  );
}
