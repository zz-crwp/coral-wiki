// Fil « Récemment » (Q10) : dernières coches des deux joueurs, avec l'auteur et le moment.
import { entry } from '../app/data.ts';
import { GameImg } from '../app/components.tsx';
import { Icon } from '../app/icons.tsx';
import { active, marks, me } from '../app/store.ts';
import { recent } from '../app/progress.ts';
import { openFiche } from '../app/router.ts';

const ACTION: [string, string, string][] = [
  ['musee:', 'donné au musée', 'décoché du musée'],
  ['temple:', 'offert au temple', 'retiré du temple'],
  ['pris:', 'attrapé', 'décoché du journal'],
  ['cuisine:', 'cuisiné', 'décoché des recettes'],
  ['cadeau:', 'cadeau offert', 'cadeau décoché'],
  ['coeur:', 'événement de cœur vu', 'événement de cœur décoché'],
  ['succes:', 'succès obtenu', 'succès décoché'],
];
/** Clé de suivi → fiche concernée (dernier segment identifiant une entité connue). */
function idOf(key: string) {
  const parts = key.split(':');
  if (key.startsWith('temple:')) return parts[2];
  return parts[1];
}
function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function RecentFeed() {
  const list = recent(marks.value, 8).filter(({ key }) => ACTION.some(([p]) => key.startsWith(p)));
  if (!list.length) return null;
  const players = active.value?.partners ?? [];
  return (
    <section class="module" aria-labelledby="m-recent">
      <div class="module-head" id="m-recent">
        <Icon name="clock" /> Récemment{players.length ? ` · vous et ${players.map((x) => x.name).join(', ')}` : ''}
      </div>
      <ul class="mod-list">
        {list.map(({ key, m }) => {
          const id = idOf(key);
          const e = entry(id);
          const [, on, off] = ACTION.find(([p]) => key.startsWith(p))!;
          const who = m.par === me.value.id ? 'Vous' : players.find((x) => x.player === m.par)?.name ?? 'Autre téléphone';
          return (
            <li key={key}>
              <button onClick={() => e && openFiche(e.id)} disabled={!e}>
                {e ? <GameImg src={e.img} dom={e.dom} size={36} /> : <span class="cat-ic"><Icon name="check" /></span>}
                <span class="txt">
                  <span class="name">{e?.fr ?? id}</span>
                  <span class="sub">
                    <span class={`who${m.par === me.value.id ? '' : ' partner'}`}>{who}</span> · {m.s ? on : off} · {ago(m.t)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
