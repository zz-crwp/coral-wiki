// Extrait de la carte du wiki centré sur des repères : image de l'île (ou de la plongée) chargée depuis le CDN
// du wiki, cadrée sur la zone utile, épingles colorées par groupe. Aucune image n'est copiée dans le dépôt.
import { useState } from 'preact/hooks';
import carte from '../data/carte.json';

export type Pin = [number, number, number, number]; // carte, x ‰, y ‰ (depuis le haut), groupe
type Carte = { nom: string; img: string; w: number; h: number; source: string };
const CARTES = (carte as { cartes: Carte[] }).cartes;
export const PIN_COLORS = ['var(--hibiscus)', 'var(--lagon-deep)', 'var(--palm)', 'var(--sunset)', 'var(--winter)', 'var(--ink-logo)'];

/** Fenêtre de la carte (fractions) qui contient les repères avec une marge, au format du cadre. */
function frame(pins: Pin[], mapAspect: number, boxAspect: number) {
  const xs = pins.map((p) => p[1] / 1000);
  // L'épingle se dessine au-dessus du point : on décale le cadrage vers le haut
  const ys = pins.flatMap((p) => [p[2] / 1000 - 0.05, p[2] / 1000]);
  const pad = 0.06;
  let ww = Math.max(0.3, Math.max(...xs) - Math.min(...xs) + pad * 2);
  let wh = (ww * mapAspect) / boxAspect;
  const needH = Math.max(...ys) - Math.min(...ys) + pad * 2;
  if (wh < needH) {
    wh = needH;
    ww = (wh * boxAspect) / mapAspect;
  }
  if (ww > 1) (ww = 1), (wh = mapAspect / boxAspect);
  if (wh > 1) (wh = 1), (ww = Math.min(1, boxAspect / mapAspect));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const x0 = Math.min(Math.max(0, cx - ww / 2), 1 - ww);
  const y0 = Math.min(Math.max(0, cy - wh / 2), 1 - wh);
  return { x0, y0, ww, wh };
}

export function MapView({ pins, labels, aspect = 16 / 10 }: { pins: Pin[]; labels?: string[]; aspect?: number }) {
  // Chargée en CORS anonyme : le CDN ne peut pas déposer de cookie tiers ; repli simple s'il refuse
  const [cors, setCors] = useState(true);
  if (!pins?.length || !CARTES.length) return null;
  const maps = [...new Set(pins.map((p) => p[0]))].filter((m) => CARTES[m]);
  return (
    <>
      {maps.map((mi) => {
        const c = CARTES[mi];
        const ps = pins.filter((p) => p[0] === mi);
        const f = frame(ps, c.w / c.h, aspect);
        const where = [...new Set(ps.map((p) => labels?.[p[3]]).filter(Boolean))].join(', ');
        return (
          <figure key={mi} class="mapview">
            <div class="mapview-box" style={{ aspectRatio: String(aspect) }} role="img" aria-label={`${c.nom}${where ? ` : ${where}` : ''}`}>
              <img
                src={c.img}
                crossOrigin={cors ? "anonymous" : undefined}
                referrerpolicy="no-referrer"
                onError={() => cors && setCors(false)}
                alt=""
                loading="lazy"
                fetchpriority="low"
                decoding="async"
                width={c.w}
                height={c.h}
                style={{ width: `${100 / f.ww}%`, left: `${(-f.x0 / f.ww) * 100}%`, top: `${(-f.y0 / f.wh) * 100}%` }}
              />
              {ps.map((p, i) => (
                <span key={i} class="mapview-pin" style={{ left: `${((p[1] / 1000 - f.x0) / f.ww) * 100}%`, top: `${((p[2] / 1000 - f.y0) / f.wh) * 100}%`, '--pin': PIN_COLORS[p[3] % PIN_COLORS.length] }} />
              ))}
            </div>
            <figcaption>
              {c.nom}
              {' · '}
              <a href={c.source} target="_blank" rel="noopener">
                carte du wiki
              </a>
            </figcaption>
          </figure>
        );
      })}
    </>
  );
}
