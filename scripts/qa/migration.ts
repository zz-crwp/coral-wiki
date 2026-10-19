// Migration IndexedDB v1 → v2 dans un vrai navigateur : on recrée une base v1 (comme la v1 publiée),
// on ouvre l'app v2, puis on vérifie que chaque coche est devenue une marque et qu'une sauvegarde existe.
// Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/migration.ts
import puppeteer from 'puppeteer-core';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ok = (c: boolean, m: string) => {
  console.log(`${c ? '✔' : '✘'} ${m}`);
  if (!c) process.exitCode = 1;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
// Page du même domaine sans l'app (le service worker n'est pas encore installé) : on y crée la base v1
await page.goto(`${BASE}favicon.svg`);
const N = 400;
await page.evaluate(
  (n) =>
    new Promise<void>((done, fail) => {
      const req = indexedDB.open('coral-wiki', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('profiles', { keyPath: 'id' });
        req.result.createObjectStore('meta');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['profiles', 'meta'], 'readwrite');
        const checks: Record<string, number> = {};
        for (let i = 0; i < n; i++) checks[`musee:objet${i}`] = 1_700_000_000_000 + i;
        checks['temple:offrande-essential-resources:wood'] = 1_700_000_000_999;
        tx.objectStore('profiles').put({ id: 'p1', name: 'Ma ferme', created: 1, updated: 2, date: { season: 'summer', day: 12, year: 2 }, weather: 'rain', hour: 14, checks, favs: ['tuna'], session: ['tuna', 'scott'], paliers: { pickaxe: 2 }, coeurs: { scott: 4 } });
        tx.objectStore('profiles').put({ id: 'p2', name: 'Deuxième', created: 3, updated: 4, date: { season: 'spring', day: 1, year: 1 }, weather: 'sunny', hour: 9, checks: { 'pris:tuna': 5 }, favs: [] });
        tx.objectStore('meta').put('p1', 'active');
        tx.oncomplete = () => (db.close(), done());
        tx.onerror = () => fail(tx.error);
      };
      req.onerror = () => fail(req.error);
    }),
  N,
);
ok(true, `base v1 créée : 2 profils, ${N + 1} coches sur le premier`);

await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.waitForSelector('.tabbar', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1000));
const r = await page.evaluate(
  () =>
    new Promise<any>((done) => {
      const req = indexedDB.open('coral-wiki');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['profiles', 'sauvegardes', 'meta'], 'readonly');
        const out: any = { version: db.version };
        tx.objectStore('profiles').getAll().onsuccess = (e: any) => (out.profiles = e.target.result);
        tx.objectStore('sauvegardes').getAll().onsuccess = (e: any) => (out.backups = e.target.result);
        tx.objectStore('meta').get('player').onsuccess = (e: any) => (out.player = e.target.result);
        tx.oncomplete = () => done(out);
      };
    }),
);
ok(r.version === 2, `base passée en version ${r.version}`);
const p1 = r.profiles.find((p: any) => p.id === 'p1');
const keys = Object.keys(p1?.prog ?? {});
ok(keys.length === N + 1, `profil 1 : ${keys.length}/${N + 1} marques`);
ok(keys.every((k) => p1.prog[k].s === 1 && p1.prog[k].par === r.player.id), 'toutes cochées, auteur = joueur local');
ok(p1.prog['musee:objet7'].t === 1_700_000_000_007, 'horodatages conservés');
ok(!('checks' in p1), 'ancien champ « checks » retiré');
ok(p1.paliers.pickaxe === 2 && p1.coeurs.scott === 4 && p1.session.length === 2 && p1.date.season === 'summer', 'paliers, cœurs, session et date conservés');
ok(!!r.profiles.find((p: any) => p.id === 'p2')?.prog['pris:tuna'], 'profil 2 migré');
ok(r.backups.length === 1 && Object.keys(r.backups[0].profiles[0].checks).length === N + 1, 'sauvegarde v1 intégrale enregistrée avant conversion');
// L'interface lit bien les coches migrées
await page.goto(`${BASE}#/reglages`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.body.innerText.includes('401 coches'), { timeout: 8000 }).then(
  () => ok(true, 'réglages : « 401 coches » affiché pour Ma ferme'),
  () => ok(false, 'réglages : nombre de coches introuvable'),
);
await browser.close();
