// Succès Steam (source officielle, noms FR localisés) + % de joueurs.
// Sortie : .cache/steam/achievements.json
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, UA } from './lib/api.ts';

const APP = 1158160;

async function page(lang: string) {
  const res = await fetch(`https://steamcommunity.com/stats/${APP}/achievements/?l=${lang}`, { headers: { 'User-Agent': UA, Cookie: `Steam_Language=${lang}` } });
  const html = await res.text();
  const m = /id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`SSR introuvable (${lang})`);
  const list: any[] = [];
  // Les données sont des chaînes JSON imbriquées : on cherche l'objet qui contient les succès.
  const walk = (o: any) => {
    if (Array.isArray(o)) {
      if (o.length && o[0]?.api_name) list.push(...o);
      else o.forEach(walk);
    } else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    else if (typeof o === 'string' && o.startsWith('{')) {
      try {
        walk(JSON.parse(o));
      } catch {}
    }
  };
  walk(JSON.parse(m[1]));
  return list;
}

const [en, fr] = [await page('english'), await new Promise((r) => setTimeout(r, 1500)).then(() => page('french'))];
const pct = await (await fetch(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${APP}`)).json();
const pctMap = new Map<string, number>(pct.achievementpercentages.achievements.map((a: any) => [a.name, Number(a.percent)]));
const frMap = new Map(fr.map((a) => [a.api_name, a]));
const out = en.map((a) => ({
  api_name: a.api_name,
  name_en: a.name,
  desc_en: a.description,
  name_fr: frMap.get(a.api_name)?.name ?? null,
  desc_fr: frMap.get(a.api_name)?.description ?? null,
  icon: a.icon_achieved,
  hidden: a.hidden,
  percent: pctMap.get(a.api_name) ?? null,
}));
await mkdir(join(CACHE_DIR, 'steam'), { recursive: true });
await writeFile(join(CACHE_DIR, 'steam', 'achievements.json'), JSON.stringify(out, null, 1));
console.log(`succès: ${out.length} (FR: ${out.filter((a) => a.name_fr).length})`);
