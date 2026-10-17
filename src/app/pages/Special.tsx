// Pages transversales : Temple du lac, Musée, Rang de la ville, Mines.
import { useEffect, useState } from 'preact/hooks';
import { RichText, TopBar, Empty } from '../components.tsx';
import { Chip, ChipList, Section } from '../fiche/parts.tsx';
import { loadEntries, type Block } from '../data.ts';
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

export function TemplePage() {
  const d = useData('temple');
  useAnchor(!!d);
  return (
    <>
      <TopBar title="Temple du lac" backTo="/encyclo" />
      <main class="page fiche" id="main">
        {!d ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <a class="btn track-link" href="#/trackers/temple">Cocher mes offrandes</a>
            <p class="lead">4 autels, {d.autels.reduce((a: number, x: any) => a + x.offrandes.length, 0)} offrandes. Chaque offrande terminée rapporte des points Héritage et débloque des récompenses par palier.</p>
            <Section title="Paliers (toutes offrandes confondues)">
              <ol class="events">
                {d.paliers.map((p: any) => (
                  <li key={p.offrandes} class="event">
                    <span class="hearts" style={{ color: 'var(--primary)' }}>{p.offrandes}</span>
                    <ul class="plain" style={{ paddingLeft: 0, listStyle: 'none' }}>
                      {p.recompenses.map((r: string, i: number) => <li key={i}><RichText text={r} /></li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </Section>
            {d.autels.map((a: any) => (
              <Section key={a.id} title={a.nom_fr} count={a.offrandes.length} id={a.id}>
                {a.effet && <p class="prose" style={{ padding: '0 0 8px' }}><RichText text={a.effet} /></p>}
                {a.offrandes.map((o: any) => (
                  <div key={o.id} id={o.id} class="offering">
                    <h4 class="art-h">
                      {o.nom ?? o.nom_en} <span class="note">({o.objets.length} objets)</span>
                    </h4>
                    <ChipList ids={o.objets.map((x: any) => x.id)} limit={20} notes={Object.fromEntries(o.objets.map((x: any) => [x.id, `×${x.n}${x.qualite ? ` · ${QUALITY_BY_INDEX[x.qualite]}+` : ''}`]))} />
                    {o.recompense.length > 0 && (
                      <p class="note" style={{ marginTop: 6 }}>
                        Récompense : {o.recompense.map((r: any) => <Chip key={r.id} id={r.id} note={`×${r.n}`} size={24} />)}
                      </p>
                    )}
                  </div>
                ))}
              </Section>
            ))}
            <p class="note"><a href={d.source.url} target="_blank" rel="noopener">Source : Coral Island Wiki — Lake Temple</a></p>
          </>
        )}
      </main>
    </>
  );
}

const COLL_FR: Record<string, string> = { poissons: 'Poissons', insectes: 'Insectes', 'creatures-marines': 'Créatures marines', artefacts: 'Artefacts', fossiles: 'Fossiles', gemmes: 'Gemmes' };

export function MuseumPage() {
  const d = useData('musee');
  return (
    <>
      <TopBar title="Musée" backTo="/encyclo" />
      <main class="page fiche" id="main">
        {!d ? (
          <Empty>Chargement…</Empty>
        ) : (
          <>
            <a class="btn track-link" href="#/trackers/musee">Cocher mes dons</a>
            <p class="lead">{d.collections.reduce((a: number, c: any) => a + c.objets.length, 0)} objets donnables. Chaque don rapporte 3 points Musée ; chaque collection complète en rapporte 40.</p>
            {d.collections.map((c: any) => (
              <Section key={c.id} title={COLL_FR[c.id] ?? c.id} count={c.objets.length} open={false} id={c.id}>
                <ChipList ids={c.objets} limit={200} />
              </Section>
            ))}
            <Section title="Paliers de dons">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Dons</th><th>Récompense</th><th>Autre</th></tr></thead>
                  <tbody>
                    {d.paliers_dons.map((p: any) => (
                      <tr key={p.dons}><td>{p.dons}</td><td><RichText text={p.recompense} /></td><td>{p.autre ? <RichText text={p.autre} /> : ''}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            {d.paliers_collections.length > 0 && (
              <Section title="Récompenses de collection" open={false}>
                <Article blocks={d.paliers_collections as Block[]} />
              </Section>
            )}
          </>
        )}
      </main>
    </>
  );
}

export function RankPage() {
  const d = useData('rang');
  return (
    <>
      <TopBar title="Rang de la ville" backTo="/encyclo" />
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
      <TopBar title="Mines" backTo="/encyclo" />
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
