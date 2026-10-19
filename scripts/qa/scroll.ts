// Fluidité du défilement : CPU ralenti ×4 (≈ iPhone milieu de gamme), défilement continu de chaque liste,
// mesure des images par seconde et des images longues (> 25 ms). Usage : vite preview --port 4174 & node scripts/qa/scroll.ts
import puppeteer from 'puppeteer-core';

const BASE = process.env.QA_URL ?? 'http://localhost:4174/coral-wiki/';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGES = ['#/', '#/chercher', '#/chercher/poissons', '#/habitants', '#/chercher/objets', '#/chercher/cultures', '#/collections/temple', '#/collections/musee', '#/collections/musee/saisie', '#/chercher/poissons?f=arapaima'];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU ?? 4) });
let worst = Infinity;
for (const h of PAGES) {
  await page.goto(`${BASE}${h}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  const r = await page.evaluate(async () => {
    const sc = (document.querySelector('.sheet-layer.open .sheet-body') as HTMLElement | null) ?? document.scrollingElement!;
    const max = sc.scrollHeight - sc.clientHeight;
    const times: number[] = [];
    let last = performance.now();
    const t0 = last;
    await new Promise<void>((done) => {
      const step = (t: number) => {
        times.push(t - last);
        last = t;
        const k = (t - t0) / 3000; // 3 s d'aller-retour
        sc.scrollTop = max * (k < 0.5 ? k * 2 : 2 - k * 2);
        if (t - t0 < 3000) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    times.shift();
    const fps = (times.length / times.reduce((a, b) => a + b, 0)) * 1000;
    return { fps: Math.round(fps), long: times.filter((x) => x > 25).length, max: Math.round(Math.max(...times)), h: max };
  });
  worst = Math.min(worst, r.fps);
  console.log(`${h.padEnd(34)} ${String(r.fps).padStart(3)} i/s · ${r.long} images > 25 ms · pire ${r.max} ms · ${r.h} px`);
}
console.log(`Pire moyenne : ${worst} i/s`);
await browser.close();
