// Retours d'action : toast « Annuler » après chaque coche, menu contextuel (appui long).
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Icon } from '../app/icons.tsx';
import { Sheet } from './Sheet.tsx';

type Toast = { id: number; msg: string; undo?: () => void };
const toastSig = signal<Toast | null>(null);
let seq = 0;

/** Affiche un message court ; avec `undo`, propose « Annuler » pendant 4 secondes. */
export function toast(msg: string, undo?: () => void) {
  toastSig.value = { id: ++seq, msg, undo };
}

export function Toaster() {
  const t = toastSig.value;
  useEffect(() => {
    if (!t) return;
    const id = t.id;
    const h = setTimeout(() => {
      if (toastSig.value?.id === id) toastSig.value = null;
    }, 4000);
    return () => clearTimeout(h);
  }, [t?.id]);
  if (!t) return null;
  return (
    <div class="toast" role="status" aria-live="polite" key={t.id}>
      <span>{t.msg}</span>
      {t.undo && (
        <button
          onClick={() => {
            t.undo!();
            toastSig.value = null;
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}

export type MenuItem = { icon: string; label: string; onClick?: () => void; href?: string; danger?: boolean };
type Menu = { title: ComponentChildren; items: MenuItem[] };
const menuSig = signal<Menu | null>(null);

/** Menu contextuel (appui long sur une ligne). */
export function openMenu(m: Menu) {
  menuSig.value = m;
  navigator.vibrate?.(10);
}

export function ContextMenu() {
  const m = menuSig.value;
  const close = () => (menuSig.value = null);
  return (
    <Sheet open={!!m} onClose={close} title={m?.title} detent="fit" label="Actions">
      {m && (
        <div class="menu-list">
          {m.items.map((it) =>
            it.href ? (
              <a key={it.label} href={it.href} target={it.href.startsWith('http') ? '_blank' : undefined} rel="noopener" onClick={close} class={it.danger ? 'danger' : undefined}>
                <Icon name={it.icon} />
                {it.label}
              </a>
            ) : (
              <button
                key={it.label}
                class={it.danger ? 'danger' : undefined}
                onClick={() => {
                  close();
                  it.onClick?.();
                }}
              >
                <Icon name={it.icon} />
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </Sheet>
  );
}
