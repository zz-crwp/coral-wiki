// Captures d'audit après refonte : chaque écran à 390 px, thème clair et sombre → reports/audit/apres/<theme>/<nom>.jpg
// (les captures « avant » sont dans reports/audit/<theme>/, mêmes noms de fichiers)
// Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/screens.ts
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT ?? 'reports/audit/apres';

export const SCREENS: [string, string][] = [
  ['01-aujourdhui', '#/'],
  ['02-calendrier', '#/calendrier'],
  ['03-recherche-vide', '#/recherche'],
  ['04-recherche-thon', '#/recherche?q=thon'],
  ['05-encyclopedie', '#/explorer'],
  ['06-liste-poissons', '#/explorer/poissons'],
  ['07-fiche-poisson', '#/explorer/poissons?f=arapaima'],
  ['08-fiche-pnj', '#/explorer/pnj?f=scott'],
  ['09-fiche-outil', '#/explorer/outils?f=pickaxe'],
  ['10-fiche-magasin', '#/explorer/lieux?f=laboratory'],
  ['11-fiche-culture', '#/explorer/cultures?f=strawberry'],
  ['12-fiche-lieu', '#/explorer/lieux?f=ocean'],
  ['13-fiche-materiau', '#/explorer/ressources?f=bronze-bar'],
  ['14-temple', '#/progression/temple'],
  ['15-musee', '#/progression/musee'],
  ['16-ameliorations', '#/explorer/ameliorations?magasin=sanchez-brothers-blacksmith'],
  ['17-trackers', '#/progression'],
  ['18-tracker-poissons', '#/progression/poissons'],
  ['19-tracker-temple', '#/progression/temple?open=offrande-essential-resources'],
  ['20-outil-cultures', '#/outils/cultures'],
  ['21-cadeaux', '#/outils/cadeaux'],
  ['22-cadeaux-scott', '#/outils/cadeaux/scott'],
  ['23-plus', '#/reglages'],
  ['24-rang', '#/explorer/rang'],
  ['25-session', '#/session'],
  ['26-liste-pnj', '#/explorer/pnj'],
  ['27-liste-outils', '#/explorer/outils'],
  ['28-design', '#/design'],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
for (const theme of ['light', 'dark'] as const) {
  mkdirSync(`${OUT}/${theme}`, { recursive: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  await page.goto(BASE, { waitUntil: 'networkidle2' });
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
