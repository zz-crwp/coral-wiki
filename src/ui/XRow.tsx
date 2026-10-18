// Ligne repliable : la ligne repliée répond à la question du joueur ; le dépliage (sur place, la ligne
// devient une carte) donne le reste. Glisser vers la droite = cocher ; appui long = menu contextuel.
import { useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { GameImg } from '../app/components.tsx';
import { Icon } from '../app/icons.tsx';

export type XRowProps = {
  id: string;
  open: boolean;
  onToggle: () => void;
  img?: string;
  dom: string;
  name: ComponentChildren;
  sub?: ComponentChildren;
  end?: ComponentChildren;
  done?: boolean;
  /** Coche par glissement : libellés pour l'action et l'annulation. */
  swipe?: { on: boolean; label: string; offLabel: string; act: () => void };
  onLongPress?: () => void;
  children?: ComponentChildren;
  imgSize?: number;
  /** Remplace l'image (emblème d'autel…). */
  leading?: ComponentChildren;
};

const SWIPE_AT = 84;

export function XRow({ id, open, onToggle, img = '', dom, name, sub, end, done, swipe, onLongPress, children, imgSize = 48, leading }: XRowProps) {
  const [dx, setDx] = useState(0);
  // Le contenu déplié reste monté après la 1re ouverture : la fermeture s'anime aussi
  const seen = useRef(false);
  if (open) seen.current = true;
  const g = useRef<{ x: number; y: number; mode: 'idle' | 'swipe' | 'scroll'; timer: number; long: boolean } | null>(null);

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const st = { x: e.clientX, y: e.clientY, mode: 'idle' as const, timer: 0, long: false };
    g.current = st;
    if (onLongPress)
      st.timer = window.setTimeout(() => {
        if (g.current === st && st.mode === 'idle') {
          st.long = true;
          onLongPress();
        }
      }, 480);
  };
  const move = (e: PointerEvent) => {
    const st = g.current;
    if (!st) return;
    const mx = e.clientX - st.x;
    const my = e.clientY - st.y;
    if (st.mode === 'idle' && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      clearTimeout(st.timer);
      st.mode = swipe && Math.abs(mx) > Math.abs(my) && mx > 0 ? 'swipe' : 'scroll';
      if (st.mode === 'swipe') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (st.mode === 'swipe') setDx(Math.max(0, Math.min(mx, 140)));
  };
  const up = () => {
    const st = g.current;
    if (!st) return;
    clearTimeout(st.timer);
    if (st.mode === 'swipe' && dx >= SWIPE_AT) {
      swipe!.act();
      navigator.vibrate?.(8);
    }
    setDx(0);
    // Laisse le clic se produire seulement pour un simple toucher
    setTimeout(() => (g.current = null), 0);
  };
  const click = (e: MouseEvent) => {
    const st = g.current;
    if (st && (st.mode !== 'idle' || st.long)) {
      e.preventDefault();
      return;
    }
    onToggle();
  };

  return (
    <div id={`row-${id}`} class={`xrow${open ? ' open' : ''}${done ? ' done' : ''}`}>
      {swipe && dx > 0 && (
        <div class={`swipe-bg${swipe.on ? ' undo' : ''}`} style={{ opacity: Math.min(1, dx / SWIPE_AT) }} aria-hidden="true">
          <Icon name={swipe.on ? 'undo' : 'check'} />
          {swipe.on ? swipe.offLabel : swipe.label}
        </div>
      )}
      <div class="xrow-slide" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <button
          class="xrow-main"
          aria-expanded={open}
          aria-controls={`rowd-${id}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onClick={click}
          onContextMenu={(e) => {
            if (onLongPress) {
              e.preventDefault();
              onLongPress();
            }
          }}
        >
          {leading ?? <GameImg src={img} dom={dom} size={imgSize} done={done} />}
          <span class="xrow-txt">
            <span class="xrow-name">{name}</span>
            {sub && <span class="xrow-sub">{sub}</span>}
          </span>
          {end && <span class="xrow-end">{end}</span>}
          <Icon name="chevron" class="xrow-chev" />
        </button>
        <div class="xrow-detail" id={`rowd-${id}`}>
          <div>{seen.current && <div class="xrow-inner" inert={!open}>{children}</div>}</div>
        </div>
      </div>
    </div>
  );
}
