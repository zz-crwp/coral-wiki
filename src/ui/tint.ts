// Couleur dominante d'une image du jeu, pour teinter légèrement le fond de sa tuile.
// Calcul unique sur un canevas 8×8 (image chargée en CORS), mis en cache en mémoire et dans localStorage.
const KEY = 'cw-tints';
let cache: Record<string, string> | null = null;
let dirty = 0;

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    cache = {};
  }
  return cache!;
}
function save() {
  if (dirty) return;
  dirty = window.setTimeout(() => {
    dirty = 0;
    try {
      const entries = Object.entries(cache ?? {});
      // Borne : 4 000 entrées au plus (~120 Ko)
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.slice(-4000))));
    } catch {}
  }, 1500);
}

export function cachedTint(src: string): string | undefined {
  return load()[src];
}

/** Moyenne des pixels opaques, pondérée par la saturation : la couleur « du sujet », pas celle du contour. */
export function computeTint(img: HTMLImageElement, src: string): string | undefined {
  const c = load();
  if (c[src]) return c[src];
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const s = mx ? (mx - mn) / mx : 0;
      const k = 0.15 + s;
      r += d[i] * k;
      g += d[i + 1] * k;
      b += d[i + 2] * k;
      w += k;
    }
    if (!w) return;
    const hex = `rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})`;
    c[src] = hex;
    save();
    return hex;
  } catch {
    return; // image non CORS (mode de repli) : pas de teinte
  }
}
