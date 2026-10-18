// Captures ponctuelles pendant le développement : node scripts/qa/shot.ts <thème> <nom>=<hash> …
// Thème : light | dark | oled. Variables : QA_URL, OUT, FULL=1 (page entière), W (largeur).
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_URL ?? 'http://localhost:5173/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.env.OUT ?? 'reports/shots';
const [theme = 'light', ...list] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await page.setViewport({ width: Number(process.env.W ?? 390), height: Number(process.env.H ?? 844), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'light' ? 'light' : 'dark' }]);
page.on('pageerror', (e) => console.log('ERREUR', (e as Error).message));
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.evaluate((t) => (t === 'oled' ? localStorage.setItem('cw-theme', 'oled') : localStorage.removeItem('cw-theme')), theme);
for (const item of list) {
  const i = item.indexOf('=');
  const [name, hash] = [item.slice(0, i), item.slice(i + 1)];
  await page.goto(`${BASE}${hash ?? ''}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'networkidle2' }).catch(() => null);
  // TEXT=28 : simule un texte agrandi (Dynamic Type) en fixant la taille de base, puis signale tout débordement horizontal
  if (process.env.TEXT) await page.evaluate((px) => (document.documentElement.style.fontSize = `${px}px`), process.env.TEXT);
  await new Promise((r) => setTimeout(r, Number(process.env.WAIT ?? 1500)));
  if (process.env.TEXT) {
    const over = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('main *, .sheet *, .tabbar *')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.filters, .chips, .strip, .table-wrap, .tiers-pick');
      });
      return { scroll: document.documentElement.scrollWidth > W, bad: bad.slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${e.className}`) };
    });
    console.log(name, over.scroll ? 'DÉBORDEMENT PAGE' : 'ok', over.bad.join(' | '));
  }
  if (process.env.DBG) console.log(name, await page.evaluate(() => [location.hash, document.querySelector('.sheet-layer')?.className, document.querySelectorAll('.sheet-layer').length]));
  await page.screenshot({ path: `${OUT}/${theme}-${name}.jpg`, type: 'jpeg', quality: 70, fullPage: process.env.FULL === '1' });
}
await browser.close();
