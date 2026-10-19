// Captures d'audit v2 : chaque écran à 390 px, clair et sombre → reports/audit/v2/<thème>/<nom>.jpg
// (v1 : reports/audit/v1/, mêmes noms ; les pages supprimées en v2 n'ont pas d'équivalent)
// Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/screens.ts
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT ?? 'reports/audit/v2';

export const SCREENS: [string, string][] = [
  ['01-aujourdhui', '#/'],
  ['02-calendrier', '#/calendrier'],
  ['03-recherche-vide', '#/chercher'],
  ['04-recherche-thon', '#/chercher?q=thon'],
  ['05-encyclopedie', '#/chercher'],
  ['06-liste-poissons', '#/chercher/poissons'],
  ['07-fiche-poisson', '#/chercher/poissons?f=arapaima'],
  ['08-fiche-pnj', '#/habitants?f=scott'],
  ['09-fiche-outil', '#/chercher/outils?f=pickaxe'],
  ['10-fiche-magasin', '#/chercher/lieux?f=laboratory'],
  ['11-fiche-culture', '#/chercher/cultures?f=strawberry'],
  ['12-fiche-lieu', '#/chercher/lieux?f=ocean'],
  ['13-fiche-materiau', '#/chercher/ressources?f=wood'],
  ['14-temple', '#/collections/temple'],
  ['15-musee', '#/collections/musee'],
  ['17-trackers', '#/collections'],
  ['18-tracker-poissons', '#/collections/poissons'],
  ['19-tracker-temple', '#/collections/temple?open=offrande-essential-resources'],
  ['23-plus', '#/reglages'],
  ['24-rang', '#/chercher/rang'],
  ['26-liste-pnj', '#/habitants'],
  ['27-liste-outils', '#/chercher/outils'],
  ['29-saisie-rapide', '#/collections/musee/saisie'],
  ['30-chercher-bois', '#/chercher?q=bois'],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
for (const theme of ['light', 'dark'] as const) {
  mkdirSync(`${OUT}/${theme}`, { recursive: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  // Thème « Système » : la capture suit le thème émulé (sinon « Soir » rendrait tout sombre la nuit)
  await page.evaluate(() => localStorage.setItem('cw-theme', 'system'));
  for (const [name, hash] of SCREENS) {
    await page.goto(`${BASE}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'networkidle2' }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({ path: `${OUT}/${theme}/${name}.jpg`, type: 'jpeg', quality: 72 });
  }
  await page.close();
}
await browser.close();
console.log(`${SCREENS.length * 2} captures dans ${OUT}`);
