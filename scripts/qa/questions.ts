// Les 10 questions du joueur, en 390 px : chaque scénario part de l'ouverture de l'app, compte les taps
// (la frappe dans la recherche n'en est pas un) et mesure le temps jusqu'à la réponse affichée.
// Exigence : 3 taps et 10 secondes au plus. Usage : npm run build && npx vite preview --port 4174 & node scripts/qa/questions.ts
import puppeteer, { type Page } from 'puppeteer-core';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_TAPS = 3;
const MAX_MS = 10_000;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

let taps = 0;
/** Un tap : élément trouvé par sélecteur et texte, cliqué comme un doigt (au centre, après défilement). */
async function tap(p: Page, sel: string, text?: string) {
  await p.waitForFunction((s, t) => [...document.querySelectorAll(s)].some((e) => !t || e.textContent?.includes(t)), { timeout: 8000 }, sel, text ?? '');
  const h = await p.evaluateHandle((s, t) => [...document.querySelectorAll(s)].find((e) => !t || e.textContent?.includes(t)), sel, text ?? '');
  await (h.asElement() as any).evaluate((e: HTMLElement) => e.scrollIntoView({ block: 'center' }));
  await (h.asElement() as any).evaluate((e: HTMLElement) => e.click());
  taps++;
}
async function type(p: Page, sel: string, text: string) {
  await p.waitForSelector(sel);
  await p.type(sel, text, { delay: 30 });
}
/** Attend que la réponse soit visible (fonction évaluée dans la page). */
async function answer(p: Page, fn: string) {
  await p.waitForFunction(fn, { timeout: MAX_MS });
}

type Q = { n: number; q: string; run: (p: Page) => Promise<string> };
const QUESTIONS: Q[] = [
  {
    n: 1,
    q: "Qu'est-ce que je peux attraper ou récolter maintenant qui me manque encore ?",
    run: async (p) => {
      await answer(p, `document.querySelector('#m-catch')?.closest('section')?.querySelectorAll('.mod-list li').length > 0`);
      return p.$eval('#m-catch', (e) => e.closest('section')!.querySelector('.big-num')!.textContent + ' espèces manquantes disponibles');
    },
  },
  {
    n: 2,
    q: "Qu'est-ce qui me manque pour le musée, par catégorie ?",
    run: async (p) => {
      await tap(p, '.tab-capsule a', 'Collections');
      await tap(p, '.ring-cell', 'Musée');
      await tap(p, '.fchip', 'Manquants');
      await answer(p, `document.querySelectorAll('.tsec').length > 1 && location.hash.includes('manquants=1')`);
      return p.$$eval('.tsec .group-label', (e) => e.map((x) => x.textContent?.trim()).slice(0, 4).join(' | '));
    },
  },
  {
    n: 3,
    q: "Qu'est-ce qui me manque pour le temple, autel par autel ?",
    run: async (p) => {
      await tap(p, '.tab-capsule a', 'Collections');
      await tap(p, '.ring-cell', 'Temple');
      await answer(p, `document.querySelectorAll('.temple-hero .ring-cell').length === 4 && document.querySelectorAll('.xrow .slots').length > 10`);
      return p.$$eval('.temple-hero .ring-cell', (e) => e.map((x) => x.textContent?.trim()).join(' | '));
    },
  },
  {
    n: 4,
    q: 'Cet objet sert-il à quelque chose ? Je le garde ou je le vends ?',
    run: async (p) => {
      await tap(p, '.tab-capsule a', 'Chercher');
      await type(p, '.search-dock input', 'bois');
      await answer(p, `[...document.querySelectorAll('.search-page .row')].some((r) => r.textContent.includes('Bois') && r.querySelector('.verdict'))`);
      const fromList = await p.$$eval('.search-page .row', (r) => r.find((x) => x.querySelector('.name')?.textContent === 'Bois')?.querySelector('.verdict')?.textContent ?? '');
      await tap(p, '.search-page .row', 'Bois');
      await answer(p, `document.querySelector('.sheet .verdict-big')`);
      return `liste : « ${fromList} » ; fiche : « ${await p.$eval('.sheet .verdict-big', (e) => e.textContent)} »`;
    },
  },
  {
    n: 5,
    q: 'Où et quand trouver cet objet ?',
    run: async (p) => {
      await tap(p, '.tab-capsule a', 'Chercher');
      await type(p, '.search-dock input', 'murène');
      await tap(p, '.search-page .row', 'Murène jaune');
      await answer(p, `document.querySelectorAll('.sheet .spawn-card').length >= 2`);
      return p.$$eval('.sheet .spawn-card h4', (e) => e.map((x) => x.textContent?.trim()).join(' | '));
    },
  },
  {
    n: 6,
    q: "Qu'aime ce villageois, et où est-il en ce moment ?",
    run: async (p) => {
      await tap(p, '.tab-capsule a', 'Habitants');
      await answer(p, `[...document.querySelectorAll('.xrow')].some((r) => r.textContent.includes('Scott'))`);
      const where = await p.$$eval('.xrow', (r) => r.find((x) => x.querySelector('.xrow-name')?.textContent === 'Scott')?.querySelector('.xrow-sub')?.textContent ?? '');
      await tap(p, '.xrow-main', 'Scott');
      await answer(p, `document.querySelector('#row-scott.open') && document.querySelector('#row-scott .xrow-inner')?.textContent.length > 50`);
      return `ligne : « ${where.slice(0, 60)} » ; dépliée : cadeaux affichés`;
    },
  },
  {
    n: 7,
    q: "Quel anniversaire ou festival aujourd'hui et cette semaine ?",
    run: async (p) => {
      await answer(p, `document.querySelector('#m-week')?.closest('section')?.querySelectorAll('li').length > 0`);
      return p.$eval('#m-week', (e) => [...e.closest('section')!.querySelectorAll('li .name')].map((x) => x.textContent).slice(0, 3).join(', '));
    },
  },
  {
    n: 8,
    q: 'Quels magasins sont ouverts maintenant ?',
    run: async (p) => {
      await answer(p, `document.querySelector('#m-shops')?.closest('section')?.querySelector('.big-num')`);
      return p.$eval('#m-shops', (e) => e.closest('section')!.querySelector('.big-num')!.textContent + ' ouverts');
    },
  },
  {
    n: 9,
    q: 'Que planter maintenant pour que ça pousse avant la fin de la saison ?',
    run: async (p) => {
      await answer(p, `document.querySelector('#m-crops')?.closest('section')?.querySelectorAll('li').length > 0`);
      return p.$eval('#m-crops', (e) => [...e.closest('section')!.querySelectorAll('li .name')].map((x) => x.textContent).join(', '));
    },
  },
  {
    n: 10,
    q: "Qu'est-ce que mon ou ma partenaire a donné ou coché récemment ?",
    run: async (p) => {
      await answer(p, `document.querySelector('#m-recent')?.closest('section')?.textContent.includes('Léa')`);
      return p.$eval('#m-recent', (e) => e.closest('section')!.querySelector('li')!.textContent!.trim().slice(0, 70));
    },
  },
];

// Partie de démonstration : une partenaire (Léa) a donné un thon au musée il y a 5 minutes
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.waitForSelector('.tabbar');
await page.evaluate(
  () =>
    new Promise<void>((done) => {
      const r = indexedDB.open('coral-wiki');
      r.onsuccess = () => {
        const tx = r.result.transaction('profiles', 'readwrite');
        const st = tx.objectStore('profiles');
        st.getAll().onsuccess = (e: any) => {
          const p = e.target.result[0];
          p.partner = { name: 'Léa', player: 'j-lea', gistId: 'abc', prog: { 'musee:tuna': { s: 1, t: Date.now() - 5 * 60_000, par: 'j-lea' } } };
          st.put(p);
        };
        tx.oncomplete = () => done();
      };
    }),
);

let fails = 0;
for (const q of QUESTIONS) {
  taps = 0;
  await page.goto(`${BASE}#/`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  let res = '';
  let err = '';
  try {
    res = await q.run(page);
  } catch (e) {
    err = (e as Error).message.split('\n')[0];
  }
  const ms = Date.now() - t0;
  const ok = !err && taps <= MAX_TAPS && ms <= MAX_MS;
  if (!ok) fails++;
  console.log(`${ok ? '✔' : '✘'} Q${q.n} · ${taps} tap${taps > 1 ? 's' : ''} · ${(ms / 1000).toFixed(1)} s · ${q.q}\n    → ${err || res}`);
}
console.log(fails ? `${fails} question(s) hors objectif` : '10/10 questions en 3 taps et 10 s au plus');
if (fails) process.exitCode = 1;
await browser.close();
