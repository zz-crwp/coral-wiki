// Contrôle de la progression : profils, export/import JSON, synchro à deux (un gist par joueur, appairage, fusion).
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

// Faux serveur de Gists : un compte par jeton, gists secrets lisibles par identifiant, ETag sur la lecture
const TOKENS: Record<string, string> = { [FAKE_TOKEN]: 'joueur-a', [FAKE_TOKEN.replace('qa', 'qb')]: 'joueur-b' };
const TOKEN_B = FAKE_TOKEN.replace('qa', 'qb');
const gists = new Map<string, any>();
let n = 0;
let notModified = 0;
const hexId = () => (0x1000 + ++n).toString(16).padStart(32, 'a');
async function mockGitHub(page: Page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.hostname !== 'api.github.com') return req.continue();
    const auth = (req.headers()['authorization'] ?? '').replace('Bearer ', '');
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-oauth-scopes, etag' };
    const send = (status: number, body: unknown, etag?: string) =>
      req.respond({ status, contentType: 'application/json', headers: { 'x-oauth-scopes': 'gist', ...cors, ...(etag ? { etag } : {}) }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH' } });
    const login = TOKENS[auth];
    if (!login) return send(401, { message: 'Bad credentials' });
    if (u.pathname === '/user') return send(200, { login });
    if (u.pathname === '/gists' && req.method() === 'GET') return send(200, [...gists.values()].filter((g) => g.owner === login));
    if (u.pathname === '/gists' && req.method() === 'POST') {
      const g = { id: hexId(), owner: login, rev: 1, ...JSON.parse(req.postData()!) };
      gists.set(g.id, g);
      return send(201, g, `"${g.id}-${g.rev}"`);
    }
    const id = u.pathname.split('/')[2];
    const g = gists.get(id);
    if (!g) return send(404, { message: 'Not Found' });
    if (req.method() === 'PATCH') {
      if (g.owner !== login) return send(404, { message: 'Not Found' });
      g.files = { ...g.files, ...JSON.parse(req.postData()!).files };
      g.rev++;
      return send(200, g, `"${g.id}-${g.rev}"`);
    }
    const etag = `"${g.id}-${g.rev}"`;
    if (req.headers()['if-none-match'] === etag) {
      notModified++;
      return req.respond({ status: 304, headers: { ...cors, etag } });
    }
    return send(200, g, etag);
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
  await p.goto(`${BASE}#/collections/poissons`, { waitUntil: 'domcontentloaded' });
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

// 3. Jouer à deux : chaque joueur relie son compte, échange son lien de gist, puis coches croisées
async function connectAs(p: Page, prenom: string, token: string) {
  await p.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tok');
  await p.click('#pname-me', { count: 3 });
  await p.type('#pname-me', prenom);
  await p.$eval('#pname-me', (e) => (e as HTMLInputElement).blur());
  await p.type('#tok', token);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.body.textContent?.includes('Synchronisé à'), { timeout: 10000 }).catch(() => null);
}
async function syncBtn(p: Page) {
  await p.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
  await clickText(p, '.btn', 'Synchroniser');
  await p.waitForFunction(() => document.body.textContent?.includes('Synchronisé à'), { timeout: 10000 }).catch(() => null);
  await wait(p, 300);
}
const mine = (login: string) => [...gists.values()].find((g) => g.owner === login);

await connectAs(A, 'Alex', FAKE_TOKEN);
const ga = mine('joueur-a');
const fa = ga && JSON.parse(ga.files['progress.json'].content);
ok(!!ga && ga.public === false && fa?.version === 2 && fa.player.name === 'Alex' && Object.values(fa.progress).filter((m: any) => m.s).length === 3, 'A : gist secret créé (progress.json v2, 3 marques, auteur Alex)');

const B = await device(browser);
await connectAs(B, 'Bea', TOKEN_B);
const gb = mine('joueur-b');
ok(!!gb && gb.id !== ga.id, 'B : son propre gist, distinct de celui de A');

// Appairage dans les deux sens, par lien
async function pairWith(p: Page, id: string, who: string) {
  await p.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#partner');
  await p.type('#partner', `https://gist.github.com/x/${id}`);
  await clickText(p, 'button', 'Appairer');
  await p.waitForFunction((w) => document.body.textContent?.includes(`Partenaire : ${w}`), { timeout: 8000 }, who).then(
    () => ok(true, `appairage avec ${who}`),
    () => ok(false, `appairage avec ${who}`),
  );
}
await pairWith(A, gb.id, 'Bea');
await pairWith(B, ga.id, 'Alex');

// B coche 2 poissons (communs) et 1 succès (personnel), puis synchronise
await openTemple(B);
const bBefore = await pressed(B);
ok(bBefore === 3, `B voit déjà les 3 prises de Alex (${bBefore})`);
await B.$$eval('button.jtile-btn', (b) => [10, 11].forEach((i) => (b[i] as HTMLElement).click()));
await B.goto(`${BASE}#/collections/succes`, { waitUntil: 'domcontentloaded' });
await B.reload({ waitUntil: 'domcontentloaded' });
await B.waitForSelector('button.check', { timeout: 10000 });
await B.$eval('button.check', (e) => (e as HTMLElement).click());
await wait(B, 400);
await syncBtn(B);
if (process.env.DBG) {
  const fb = JSON.parse(mine('joueur-b').files['progress.json'].content);
  console.log('DBG gist B', Object.entries(fb.progress).map(([k, m]: any) => `${k}=${m.s}`).join(' '));
}
await syncBtn(A);
if (process.env.DBG) console.log('DBG A partner', await A.evaluate(() => new Promise((ok) => { const r = indexedDB.open('coral-wiki'); r.onsuccess = () => { const t = r.result.transaction('profiles').objectStore('profiles').getAll(); t.onsuccess = () => ok(JSON.stringify(t.result.map((p: any) => [p.name, Object.keys(p.prog).length, p.partner?.name, Object.keys(p.partner?.prog ?? {}).length]))); }; })));
await openTemple(A);
ok((await pressed(A)) === 5, `A voit les 2 prises de Bea (${await pressed(A)} au total)`);
const dots = await A.$$eval('.jtile .player-dot', (e) => e.map((x) => x.textContent));
ok(dots.length === 2 && dots.every((d) => d === 'B'), `pastille « B » sur les coches de Bea (${dots.length})`);
await A.goto(`${BASE}#/collections/succes`, { waitUntil: 'domcontentloaded' });
await A.reload({ waitUntil: 'domcontentloaded' });
await A.waitForSelector('button.check', { timeout: 10000 });
ok((await pressed(A)) === 0, 'le succès de Bea reste personnel (0 chez Alex)');
await A.goto(`${BASE}#/`, { waitUntil: 'domcontentloaded' });
await A.waitForFunction(() => document.querySelector('#m-recent')?.closest('section')?.textContent?.includes('Bea'), { timeout: 8000 }).then(
  () => ok(true, '« Récemment » montre les coches de Bea'),
  () => ok(false, '« Récemment » ne montre pas Bea'),
);

// Conflit : Alex décoche une prise de Bea (plus récent) → Bea la voit décochée après synchro
await openTemple(A);
await A.$$eval('button.jtile-btn[aria-pressed="true"]', (b) => {
  const t = b.find((x) => x.querySelector('.player-dot'));
  (t as HTMLElement).click();
});
await wait(A, 400);
await syncBtn(A);
await syncBtn(B);
await openTemple(B);
ok((await pressed(B)) === 4, `décoché par Alex, décoché chez Bea (${await pressed(B)})`);
const before304 = notModified;
await syncBtn(B);
ok(notModified > before304, `relecture sans changement : réponse 304 (ETag), ${notModified - before304} fois`);

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
