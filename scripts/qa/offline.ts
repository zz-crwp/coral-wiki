// Contrôle hors ligne : 1re visite (SW installé + précache), puis mode avion → navigation et recherche.
// Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/offline.ts
import puppeteer from 'puppeteer-core';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ok = (c: boolean, m: string) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) process.exitCode = 1; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
// Le CDN Fandom refuse l'User-Agent « HeadlessChrome » : on se présente comme un Chrome mobile ordinaire.
await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36');
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
const swReady = await page.evaluate(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 15000))]);
  return !!reg;
});
ok(swReady, 'service worker actif après la 1re visite');
// Laisse le précache se terminer
await page.evaluate(() => new Promise((r) => setTimeout(r, 3000)));
const cached = await page.evaluate(async () => {
  let n = 0;
  for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length;
  return n;
});
ok(cached > 50, `précache : ${cached} entrées`);

await page.setOfflineMode(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.tabbar', { timeout: 10000 });
ok(true, 'rechargement hors ligne : shell affiché');

await page.goto(`${BASE}#/recherche?q=myrtile`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.row', { timeout: 10000 }).catch(() => null);
const hit = await page.$$eval('.row .name', (els) => els.map((e) => e.textContent));
ok(hit.includes('Myrtille'), `recherche hors ligne « myrtile » → ${hit.slice(0, 3).join(', ')}`);

await page.goto(`${BASE}#/fiche/scott`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero h2', { timeout: 10000 }).catch(() => null);
ok((await page.$eval('.hero h2', (e) => e.textContent).catch(() => '')) === 'Scott', 'fiche hors ligne (Scott)');

await page.goto(`${BASE}#/encyclo/poissons`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.row', { timeout: 10000 }).catch(() => null);
ok((await page.$$('.row')).length > 5, 'liste hors ligne (poissons)');

// Progression : coche hors ligne, rechargement, l'état doit survivre.
await page.goto(`${BASE}#/trackers/temple`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button.check', { timeout: 10000 });
const before = await page.$$eval('button.check[aria-pressed="true"]', (e) => e.length);
await page.click('button.check[aria-pressed="false"]');
await page.evaluate(() => new Promise((r) => setTimeout(r, 600))); // écriture différée 300 ms
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('button.check', { timeout: 10000 });
await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
const after = await page.$$eval('button.check[aria-pressed="true"]', (e) => e.length);
ok(after === before + 1, `coche conservée après rechargement hors ligne (${before} → ${after})`);

for (const [h, sel, label] of [['#/', '.date-main', "Aujourd'hui"], ['#/trackers', '.tracker-row', 'trackers'], ['#/calendrier', '.cal-d', 'calendrier']] as const) {
  await page.goto(`${BASE}${h}`, { waitUntil: 'domcontentloaded' });
  ok(!!(await page.waitForSelector(sel, { timeout: 10000 }).catch(() => null)), `${label} hors ligne`);
}
await browser.close();
