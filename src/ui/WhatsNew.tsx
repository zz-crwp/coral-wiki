// « Nouveautés » : affiché une seule fois après une mise à jour (pas au tout premier lancement).
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './Sheet.tsx';
import { Icon } from '../app/icons.tsx';

export const VERSION = __APP_VERSION__;
const KEY = 'cw-version';
const NEWS: { icon: string; title: string; text: string }[] = [
  { icon: 'today', title: 'Toute la journée', text: "Plus d'heure à régler : changez seulement le jour et la météo. Aujourd'hui liste ce qui vous manque dans la journée, chaque élément avec sa plage horaire." },
  { icon: 'search', title: 'Chercher, au pouce', text: 'Un onglet dédié, résultats dès la première lettre, et un verdict « À garder » ou « Vendable » sur chaque objet.' },
  { icon: 'habitants', title: 'Habitants', text: 'Leur journée heure par heure, leurs cadeaux adorés et les deux cadeaux de la semaine, dans un onglet.' },
  { icon: 'progress', title: 'Saisie rapide', text: 'Dans Collections, une grille comme le journal du jeu : un tap par objet pour rattraper votre progression.' },
  { icon: 'habitants', title: 'Jouer à plusieurs', text: 'Un seul compte GitHub pour la maison, le même jeton sur chaque téléphone et un prénom par joueur : le musée et le temple deviennent communs et « Récemment » montre ce que l’autre a fait.' },
];

function shouldShow() {
  try {
    const seen = localStorage.getItem(KEY);
    if (seen === VERSION) return false;
    // Premier lancement (aucune trace d'une version précédente) : rien à annoncer
    const returning = seen !== null || Object.keys(localStorage).some((k) => k.startsWith('cw-'));
    localStorage.setItem(KEY, VERSION);
    return returning;
  } catch {
    return false;
  }
}

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(shouldShow()), []);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={`Nouveautés de la version ${VERSION}`} detent="fit">
      <ul class="news-list">
        {NEWS.map((n) => (
          <li key={n.title}>
            <span class="cat-ic">
              <Icon name={n.icon} />
            </span>
            <span>
              <strong>{n.title}</strong>
              <span class="c-2">{n.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p class="t-footnote c-2">Votre progression a été conservée ; une copie de sécurité est dans Réglages › Sauvegarde.</p>
      <button class="btn wide" onClick={() => setOpen(false)}>
        C'est parti
      </button>
    </Sheet>
  );
}
