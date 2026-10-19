// Préférences d'affichage propres à l'appareil (pas au profil) : thème et écran maintenu allumé.
import { signal } from '@preact/signals';

export type Theme = 'soir' | 'system' | 'light' | 'dark' | 'oled';
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

export const theme = signal<Theme>((['system', 'light', 'dark', 'oled'].includes(read('cw-theme') ?? '') ? read('cw-theme') : 'soir') as Theme);
/** « Auto (soir) » : sombre de 19 h à 7 h (heure réelle), sinon comme le système. */
const evening = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 7;
};
export const wakeOn = signal(read('cw-wake') === '1');

export function setTheme(t: Theme) {
  theme.value = t;
  write('cw-theme', t === 'soir' ? null : t);
  applyPrefs();
}

// Écran maintenu allumé (Wake Lock API) : redemandé quand l'app revient au premier plan
let lock: { release: () => Promise<void> } | null = null;
async function requestWake() {
  try {
    lock = await (navigator as any).wakeLock?.request('screen');
  } catch {
    lock = null;
  }
}
export const wakeSupported = 'wakeLock' in navigator;
export function setWake(on: boolean) {
  wakeOn.value = on;
  write('cw-wake', on ? '1' : null);
  if (on) requestWake();
  else lock?.release().catch(() => {}), (lock = null);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (wakeOn.value) requestWake();
  if (theme.value === 'soir') applyPrefs(); // le soir arrive pendant que l'app est ouverte
});
setInterval(() => theme.value === 'soir' && applyPrefs(), 10 * 60_000);

export function applyPrefs() {
  const t = theme.value === 'soir' ? (evening() ? 'dark' : 'system') : theme.value;
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  // Couleur de la barre d'état assortie au fond du thème choisi
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  const DEF = ['#f2f2f6', '#111315'];
  const forced = { light: '#f2f2f6', dark: '#111315', oled: '#000000' } as Record<string, string>;
  metas.forEach((m, i) => (m.content = t === 'system' ? DEF[i] ?? DEF[0] : forced[t]));
  if (wakeOn.value) requestWake();
}
