// Pages de référence du catalogue : Rang de la ville, Mines.
import { useEffect, useState } from 'preact/hooks';
import { RichText, TopBar, Empty } from '../components.tsx';
import { Chip, ChipList, Section } from '../fiche/parts.tsx';
import { loadEntries } from '../data.ts';
import { Article } from './Fiche.tsx';

const files = import.meta.glob<{ default: any }>('../../data/{temple,musee,rang,mines}.json');
function useData(name: string) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    Promise.all([loadEntries(), files[`../../data/${name}.json`]()]).then(([, m]) => setD(m.default));
  }, [name]);
  return d;
}


export function RankPage() {
  const d = useData('rang');
  return (
    <>
      <TopBar title="Rang de la ville" large backTo="/chercher" />
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
      <TopBar title="Mines" large backTo="/chercher" />
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
