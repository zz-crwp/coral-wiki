// Sheet à crans (moyen, grand, ajusté au contenu), façon Apple Plans : la page reste visible derrière.
// Glisser la poignée ou l'en-tête pour changer de cran ; glisser vers le bas pour fermer ; Échap ferme.
// Sur tablette ou en paysage large (≥ 960 px), `dock` la transforme en panneau latéral.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from '../app/icons.tsx';

export type Detent = 'medium' | 'large' | 'fit';

export function Sheet({
  open,
  onClose,
  title,
  detent = 'large',
  dock = false,
  actions,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: ComponentChildren;
  detent?: Detent;
  dock?: boolean;
  actions?: ComponentChildren;
  children: ComponentChildren;
  label?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [cur, setCur] = useState<Detent>(detent);
  const [dy, setDy] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; last: number } | null>(null);
  const returnFocus = useRef<Element | null>(null);

  // Montage / démontage avec animation d'entrée et de sortie
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement;
      setCur(detent);
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    } else if (mounted) {
      setShown(false);
      const t = setTimeout(() => setMounted(false), 360);
      (returnFocus.current as HTMLElement | null)?.focus?.();
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    if (shown) ref.current?.focus({ preventScroll: true });
  }, [shown]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    if (dock) document.body.classList.add('has-dock');
    return () => {
      removeEventListener('keydown', k);
      document.body.classList.remove('has-dock');
    };
  }, [open, dock]);

  if (!mounted) return null;
  const h = ref.current?.offsetHeight ?? window.innerHeight;
  const base = !shown ? '100%' : cur === 'medium' ? '45%' : '0%';

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button:not(.sheet-handle)')) return;
    drag.current = { y: e.clientY, t: performance.now(), last: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const d = e.clientY - drag.current.y;
    drag.current.last = e.clientY;
    setDy(d < 0 ? d / 3 : d); // résistance vers le haut
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const d = g.last - g.y;
    const v = d / Math.max(1, performance.now() - g.t); // px/ms
    setDy(0);
    if (d > h * 0.28 || v > 0.7) {
      if (cur === 'large' && d < h * 0.45 && v < 1.2 && detent !== 'fit') setCur('medium');
      else onClose();
    } else if (d < -60 || v < -0.5) setCur('large');
  };

  return (
    <div class={`sheet-layer${shown ? ' open' : ''} ${cur}${dock ? ' docked' : ''}`}>
      <div class="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        class={`sheet${dy !== 0 ? ' dragging' : ''}${cur === 'fit' ? ' fit' : ''}`}
        role="dialog"
        aria-modal={dock ? undefined : 'true'}
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        style={{ transform: `translateY(calc(${base} + ${dy}px))` }}
      >
        <div class="sheet-grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <button class="sheet-handle" aria-label={cur === 'large' ? 'Réduire' : 'Agrandir'} onClick={() => setCur(cur === 'large' ? 'medium' : 'large')} />
          {(title || actions) && (
            <div class="sheet-head">
              <h2>{title}</h2>
              {actions}
              <button class="sheet-close" aria-label="Fermer" onClick={onClose}>
                <Icon name="close" />
              </button>
            </div>
          )}
        </div>
        {/* Au cran moyen, la sheet garde sa pleine hauteur et descend de 45 % : le bas du contenu sortirait
            de l'écran. Une marge égale au décalage permet de défiler jusqu'au bout. */}
        <div ref={body} class="sheet-body" style={cur === 'medium' ? { paddingBottom: `calc(${Math.round(h * 0.45)}px + var(--safe-bottom) + var(--s-8))` } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}
