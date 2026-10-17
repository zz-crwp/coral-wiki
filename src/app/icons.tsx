// Icônes SVG (trait 1.8, viewBox 24) : interface + pictogrammes de catégorie (repli d'image).
import type { SVGAttributes } from 'preact';

type P = SVGAttributes<SVGSVGElement> & { title?: string };

const Svg = ({ children, title, ...p }: P & { children: any }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} {...p}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);

const paths: Record<string, any> = {
  // Interface
  today: (
    <>
      <circle cx="12" cy="10" r="3.6" />
      <path d="M12 2.8v1.6M12 15.6v1.2M4.8 10H3.2M20.8 10h-1.6M6.9 4.9l1.1 1.1M17.1 4.9 16 6M2.5 20.5c2.2-1.6 4.4-1.6 6.6 0s4.4 1.6 6.6 0 4.2-1.6 5.8-.4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m20 20-4.6-4.6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" />
      <path d="M7 8h1.5M7 11h1.5M15.5 8H17M15.5 11H17" />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.3 12.2 2.4 2.4 5-5.2" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  back: <path d="M15 5 8 12l7 7" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10" />
    </>
  ),
  wave: <path d="M2 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.6 5-.6M2 19c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.6 5-.6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.1" />
    </>
  ),
  minus: <path d="M6 12h12" />,
  edit: <path d="M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />,
  'star-on': <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" fill="currentColor" />,
  plus: <path d="M12 6v12M6 12h12" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  cake: (
    <>
      <path d="M4.5 20.5h15M5.5 20.5v-6.5c0-.8.7-1.5 1.5-1.5h10c.8 0 1.5.7 1.5 1.5v6.5" />
      <path d="M5.5 16c1.2 1 2.4 1 3.6 0s2.4-1 3.6 0 2.4 1 3.6 0 1.7-.8 2.2-.4M12 12.5V9M12 6.8c-.8-.8-.8-1.8 0-2.8.8 1 .8 2 0 2.8z" />
    </>
  ),
  shop: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5M4 9.5h16" />
      <path d="M5.5 12v8.5h13V12M10 20.5v-5h4v5" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />,
  rain: (
    <>
      <path d="M7 15.5a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 7.4a3.9 3.9 0 0 1 .4 7.8" />
      <path d="M8.5 18 7.5 20.5M12.5 17l-1 3M16.5 18l-1 2.5" />
    </>
  ),
  storm: (
    <>
      <path d="M7 15.5a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 7.4a3.9 3.9 0 0 1 .4 7.8" />
      <path d="m12.5 13-2.5 4h3.5l-2 4" />
    </>
  ),
  snow: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />,
  windy: <path d="M3 9h11.5a2.5 2.5 0 1 0-2.5-2.5M3 13h15.5a2.5 2.5 0 1 1-2.5 2.5M3 17h7" />,
  blizzard: (
    <>
      <path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h14.5a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M6 16.5v4M4.3 17.5l3.4 2M4.3 19.5l3.4-2M13 18v3.5M11.5 18.9l3 1.7M11.5 20.6l3-1.7" />
    </>
  ),
  sunny: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  // Pictogrammes de domaine
  cultures: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 2.5-6.5 7-7 0 4.5-2.5 7-7 7z" />
      <path d="M12 15c0-3-2-5-6-5.5 0 3.5 2 5.5 6 5.5z" />
      <path d="M7 21h10" />
    </>
  ),
  arbres: (
    <>
      <path d="M12 21v-6" />
      <path d="M12 3c3.6 0 6.5 2.8 6.5 6.3S15.6 15 12 15s-6.5-2.2-6.5-5.7S8.4 3 12 3z" />
      <circle cx="9.5" cy="9" r=".9" fill="currentColor" />
      <circle cx="14" cy="11" r=".9" fill="currentColor" />
    </>
  ),
  cueillette: (
    <>
      <path d="M4 11h16l-1.6 8.2c-.1.7-.8 1.3-1.5 1.3H7.1c-.7 0-1.4-.6-1.5-1.3z" />
      <path d="M8 11c0-3 1.8-5.5 4-5.5s4 2.5 4 5.5" />
      <path d="M10 15h4" />
    </>
  ),
  poissons: (
    <>
      <path d="M3 12c2.5-3.6 6-5 9.5-5 3.4 0 5.8 2 7 5-1.2 3-3.6 5-7 5-3.5 0-7-1.4-9.5-5z" />
      <path d="M3 12 1.5 9M3 12l-1.5 3" />
      <circle cx="16" cy="11" r=".9" fill="currentColor" />
    </>
  ),
  insectes: (
    <>
      <path d="M12 7v13" />
      <path d="M12 9c-4.5-4-8.5-3-8.5.5S7.5 15 12 12M12 9c4.5-4 8.5-3 8.5.5S16.5 15 12 12" />
      <path d="M12 13c-3 1.5-5 3.5-4 5.5M12 13c3 1.5 5 3.5 4 5.5M11 5 9.5 3M13 5l1.5-2" />
    </>
  ),
  'creatures-marines': (
    <>
      <path d="m12 3 2.2 5.4 5.8.4-4.5 3.7 1.4 5.7L12 15.1l-4.9 3.1 1.4-5.7L4 8.8l5.8-.4z" />
    </>
  ),
  mineraux: (
    <>
      <path d="M7 4h10l4 5-9 11L3 9z" />
      <path d="M3 9h18M9 4l3 16M15 4l-3 16" />
    </>
  ),
  ressources: (
    <>
      <path d="M4 15.5 8 9h8l4 6.5" />
      <rect x="3" y="15.5" width="18" height="4.5" rx="1.5" />
      <path d="M9.5 9 12 4.5 14.5 9" />
    </>
  ),
  elevage: (
    <>
      <path d="M6 9c-1.5-.5-2.5-2-2-3.5 1.6 0 2.8.7 3.4 1.8M18 9c1.5-.5 2.5-2 2-3.5-1.6 0-2.8.7-3.4 1.8" />
      <path d="M7 8.5c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5v5c0 3-2.2 5.5-5 5.5s-5-2.5-5-5.5z" />
      <path d="M10 16h4M10 11v.1M14 11v.1" />
    </>
  ),
  artisanat: (
    <>
      <path d="M14.5 5.5a4 4 0 0 0 4.9 4.9l-9 9a2.1 2.1 0 0 1-3-3z" />
      <path d="m16 3 5 5" />
    </>
  ),
  cuisine: (
    <>
      <path d="M3.5 12h17c0 4.5-3.8 8-8.5 8s-8.5-3.5-8.5-8z" />
      <path d="M9 9c0-1.5 1-1.5 1-3M13 9c0-1.5 1-1.5 1-3M8 20h8" />
    </>
  ),
  pnj: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  lieux: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  monstres: (
    <>
      <path d="M4 20V11a8 8 0 0 1 16 0v9l-2.7-2-2.6 2-2.7-2-2.6 2-2.7-2z" />
      <circle cx="9.5" cy="11" r="1" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1" fill="currentColor" />
    </>
  ),
  festivals: (
    <>
      <path d="M3 4.5c6 2 12 2 18 0" />
      <path d="M5.5 5.4 7 10l2-4.2M11 6.2 12.5 11l1.5-4.8M16.5 5.8l1.5 4.4 1.5-4.8" />
      <path d="M6 15.5c1.5 1 1.5 3 0 4M12 14c1.5 1 1.5 3.5 0 5M18 15.5c-1.5 1-1.5 3 0 4" />
    </>
  ),
  vetements: (
    <>
      <path d="M8.5 3.5 4 6.5l2 4 2-1V20h8V9.5l2 1 2-4-4.5-3c-.5 1.5-2 2.5-3.5 2.5S9 5 8.5 3.5z" />
    </>
  ),
  mobilier: (
    <>
      <path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
      <path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4.5H3z" />
      <path d="M5 17.5V20M19 17.5V20" />
    </>
  ),
  outils: (
    <>
      <path d="M14 4c2.5 0 5.5 1.5 6.5 4.5-3-1.2-5-1-6.5.5L6 17.5a1.8 1.8 0 0 1-2.5-2.5L12 6.5C11.5 5.5 12.5 4 14 4z" />
    </>
  ),
  armes: (
    <>
      <path d="M19.5 4.5 9 15M19.5 4.5l-.5 4-8 8M19.5 4.5l-4 .5-8 8" />
      <path d="m6.5 14.5 3 3M5 19l2.2-2.2" />
    </>
  ),
  objets: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  groupes: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  batiments: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  guides: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  quetes: (
    <>
      <path d="M6 3.5h9.5L19 7v13.5H6z" />
      <path d="M9 9.5h7M9 13h7M9 16.5h4" />
    </>
  ),
  maitrises: (
    <>
      <path d="m4 8 4 3 4-6 4 6 4-3-2 10H6z" />
      <path d="M6 21h12" />
    </>
  ),
  succes: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4.5c0 2.5 1.2 4 3.3 4.3M16.5 6h3c0 2.5-1.2 4-3.3 4.3M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" />
    </>
  ),
};

export function Icon({ name, ...p }: P & { name: string }) {
  return <Svg {...p}>{paths[name] ?? paths.objets}</Svg>;
}
