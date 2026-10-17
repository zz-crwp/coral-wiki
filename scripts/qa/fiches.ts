// Parcourt un échantillon de fiches de chaque domaine + pages spéciales : erreurs JS, sections vides, liens cassés.
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const search = JSON.parse(readFileSync(new URL('../../src/data/search.json', import.meta.url), 'utf8'));
const byDom = new Map<string, string[]>();
for (const r of search.e) (byDom.get(r[4]) ?? byDom.set(r[4], []).get(r[4])!).push(r[0]);
const ids: string[] = [];
for (const list of byDom.values()) for (let i = 0; i < Math.min(4, list.length); i++) ids.push(list[Math.floor((i * list.length) / 4)]);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
// Le CDN Fandom refuse l'User-Agent « HeadlessChrome » : on se présente comme un Chrome mobile ordinaire.
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36');
await page.setViewport({ width: 390, height: 844, isMobile: true });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
await page.goto(BASE, { waitUntil: 'networkidle0' });
let ok = 0;
for (const id of [...ids, 'scott', 'sams-general-store', 'mason-jar', 'maitrise-mining']) {
  await page.goto(`${BASE}#/fiche/${id}`, { waitUntil: 'domcontentloaded' });
  const t = await page.waitForSelector('.hero h2', { timeout: 8000 }).then(() => true).catch(() => false);
  const secs = await page.$$eval('.fsec', (s) => s.length);
  if (t && secs > 0) ok++;
  else errors.push(`fiche ${id} : rendu incomplet (titre ${t}, sections ${secs})`);
}
for (const p of ['temple', 'musee', 'rang', 'mines', 'ameliorations', 'ameliorations?magasin=laboratory', 'trackers/poissons', 'trackers/musee', 'outils/cultures', 'outils/cadeaux/scott', 'calendrier', 'encyclo', 'recherche?q=graines%20de%20myrtille', 'recherche?q=thon']) {
  await page.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));
  const txt = await page.$eval('main', (m) => m.textContent?.slice(0, 120) ?? '').catch(() => '');
  console.log(`  /${p} → ${txt.replace(/\s+/g, ' ').slice(0, 100)}`);
}
console.log(`${ok}/${ids.length + 4} fiches rendues ; ${errors.length} erreur(s)`);
for (const e of errors.slice(0, 20)) console.log('  ✘', e);
if (errors.length) process.exitCode = 1;
await browser.close();
