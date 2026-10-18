// Contrôle de la progression : profils, export/import JSON, synchronisation Gist.
// L'API GitHub est simulée (interception des requêtes) : aucun appel réseau réel, jeton factice.
// Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/progress.ts
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ok = (c: boolean, m: string) => { console.log(`${c ? '✔' : '✘'} ${m}`); if (!c) process.exitCode = 1; };
const wait = (p: Page, ms: number) => p.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
const FAKE_TOKEN = 'ghp_' + 'qa0123456789abcdefghijklmnopqrstuvwx'.slice(0, 36);

// Faux serveur de Gists partagé par les deux « appareils »
const gists = new Map<string, any>();
let n = 0;
async function mockGitHub(page: Page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.hostname !== 'api.github.com') return req.continue();
    const auth = req.headers()['authorization'];
    const send = (status: number, body: unknown) =>
      req.respond({ status, contentType: 'application/json', headers: { 'x-oauth-scopes': 'gist', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-oauth-scopes' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH', 'access-control-expose-headers': 'x-oauth-scopes' } });
    if (auth !== `Bearer ${FAKE_TOKEN}`) return send(401, { message: 'Bad credentials' });
    if (u.pathname === '/user') return send(200, { login: 'qa-user' });
    if (u.pathname === '/gists' && req.method() === 'GET') return send(200, [...gists.values()]);
    if (u.pathname === '/gists' && req.method() === 'POST') {
      const g = { id: `g${++n}`, ...JSON.parse(req.postData()!) };
      gists.set(g.id, g);
      return send(201, g);
    }
    const id = u.pathname.split('/')[2];
    const g = gists.get(id);
    if (!g) return send(404, { message: 'Not Found' });
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData()!);
      g.files = { ...g.files, ...body.files };
      return send(200, g);
    }
    return send(200, g);
  });
}

async function device(browser: Browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36');
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mockGitHub(page);
  return page;
}
const pressed = (p: Page) => p.$$eval('button.check[aria-pressed="true"], button.jtile-btn[aria-pressed="true"]', (e) => e.length);
async function openTemple(p: Page) {
  await p.goto(`${BASE}#/progression/poissons`, { waitUntil: 'domcontentloaded' });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('button.check, button.jtile-btn', { timeout: 10000 });
  await wait(p, 400);
}
async function clickText(p: Page, sel: string, text: string) {
  await p.waitForFunction((s, t) => [...document.querySelectorAll(s)].some((e) => e.textContent?.includes(t)), { timeout: 10000 }, sel, text);
  const h = await p.evaluateHandle((s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent?.includes(t)), sel, text);
  await (h.asElement() as any).evaluate((e: HTMLElement) => e.click());
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
const A = await device(browser);

// 1. Coches + profils
await openTemple(A);
const btns = await A.$$('button.check, button.jtile-btn');
for (const b of btns.slice(0, 3)) await b.evaluate((e) => (e as HTMLElement).click());
await wait(A, 500);
ok((await pressed(A)) === 3, 'profil 1 : 3 coches');

await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('.setting.add');
await A.click('.setting.add');
await A.type('#pname', 'Deuxième ferme');
await A.click('form.setting button[type=submit]');
await wait(A, 300);
await openTemple(A);
ok((await pressed(A)) === 0, 'profil 2 créé et actif : 0 coche');
await A.$$eval('button.check, button.jtile-btn', (b, i) => (b[i] as HTMLElement).click(), 5);
await wait(A, 500);

await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('.radio');
await clickText(A, '.radio', 'Ma ferme');
await openTemple(A);
ok((await pressed(A)) === 3, 'retour au profil 1 après rechargement : 3 coches conservées');

// 2. Export → modification → import (remplacement)
const dir = mkdtempSync(join(tmpdir(), 'cw-qa-'));
const cdp = await A.createCDPSession();
await cdp.send('Page.setDownloadBehavior' as any, { behavior: 'allow', downloadPath: dir });
await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('.setting.link');
await clickText(A, 'button.setting', 'Exporter');
await wait(A, 1500);
const file = readdirSync(dir).find((f) => f.endsWith('.json'));
const exported = file ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : null;
ok(!!exported && exported.profiles.length === 2, `export : ${file} (${exported?.profiles.length} profils)`);

await openTemple(A);
await A.$$eval('button.check, button.jtile-btn', (b, i) => (b[i] as HTMLElement).click(), 0); // décoche
await wait(A, 500);
ok((await pressed(A)) === 2, 'modification après export : 2 coches');
await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('.segmented');
await clickText(A, '.segmented button', 'Remplacer');
A.once('dialog', (d) => d.accept());
const input = await A.$('input[type=file]');
await input!.uploadFile(join(dir, file!));
await A.waitForSelector('p[role=status]', { timeout: 5000 }).catch(() => null);
await openTemple(A);
ok((await pressed(A)) === 3, 'import (remplacement) : état de l’export restauré (3 coches)');

// 3. Gist : connexion sur l'appareil A, puis récupération sur un appareil B vierge
await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('#tok');
await A.type('#tok', FAKE_TOKEN);
await A.keyboard.press('Enter');
await A.waitForFunction(() => document.body.textContent?.includes('Synchronisé à'), { timeout: 10000 }).catch(() => null);
const g = [...gists.values()][0];
ok(!!g && g.public === false && JSON.parse(g.files['coral-wiki.json'].content).profiles.length === 2, 'Gist privé créé avec les 2 profils');

const B = await device(browser);
await B.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await B.waitForSelector('#tok');
await B.type('#tok', FAKE_TOKEN);
await B.keyboard.press('Enter');
await B.waitForFunction(() => document.body.textContent?.includes('Synchronisé à'), { timeout: 10000 }).catch(() => null);
const names = await B.$$eval('.radio .set-t', (e) => e.map((x) => x.firstChild?.textContent));
ok(names.length === 2 && names.includes('Ma ferme') && names.includes('Deuxième ferme'), `appareil B : profils récupérés (${names.join(', ')})`);
ok(gists.size === 1, 'appareil B réutilise le même Gist');

// Modification sur B, synchro, puis A récupère
await clickText(B, '.radio', 'Ma ferme');
await openTemple(B);
await B.$$eval('button.check, button.jtile-btn', (b, i) => (b[i] as HTMLElement).click(), 10);
await wait(B, 500);
await B.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await clickText(B, '.btn', 'Synchroniser');
await wait(B, 1500);
await A.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await A.waitForSelector('.btn');
await clickText(A, '.btn', 'Synchroniser');
await wait(A, 1500);
await openTemple(A);
ok((await pressed(A)) === 4, 'modification de B visible sur A après synchro (4 coches)');

// Mauvais jeton refusé
const C = await device(browser);
await C.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await C.waitForSelector('#tok');
await C.type('#tok', 'github_pat_11AAAAAAA0123456789abcdefghijklmnopqrstuvwxyz');
await C.keyboard.press('Enter');
await C.waitForSelector('.note.err', { timeout: 5000 }).catch(() => null);
const msg = await C.$eval('.note.err', (e) => e.textContent).catch(() => '');
ok(/fine-grained/.test(msg ?? ''), `jeton fine-grained refusé : « ${msg?.slice(0, 60)}… »`);

await browser.close();
