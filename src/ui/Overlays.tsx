// Sheet globale de fiche (au-dessus de l'écran courant, `?f=<id>`).
import { useEffect, useState } from 'preact/hooks';
import { entry } from '../app/data.ts';
import { Icon } from '../app/icons.tsx';
import { closeFiche, route } from '../app/router.ts';
import { pinned, togglePin } from '../app/store.ts';
import { FicheView } from '../app/pages/Fiche.tsx';
import { Sheet } from './Sheet.tsx';
import { toast } from './feedback.tsx';

export function FicheSheet() {
  const id = route.value.query.get('f');
  const [shown, setShown] = useState(id);
  useEffect(() => {
    if (id) setShown(id);
  }, [id]);
  const e = shown ? entry(shown) : undefined;
  const pin = shown ? pinned(shown) : false;
  return (
    <Sheet
      open={!!id}
      onClose={closeFiche}
      label={e?.fr ?? 'Fiche'}
      detent="medium"
      dock
      actions={
        shown && (
          <button
            class="icon-btn"
            aria-pressed={pin}
            aria-label={pin ? 'Retirer de la session' : 'Épingler à la session'}
            onClick={() => {
              togglePin(shown);
              toast(pin ? 'Retiré de la session' : 'Épinglé à la session', () => togglePin(shown));
            }}
          >
            <Icon name={pin ? 'unpin' : 'pin'} />
          </button>
        )
      }
    >
      {shown && <FicheView key={shown} id={shown} />}
    </Sheet>
  );
}
