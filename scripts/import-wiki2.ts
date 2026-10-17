// Seconde source : export XML (Special:Export) du wiki coralisland.wiki, sous licence CC0 (domaine public).
// Le site est protégé par Cloudflare : l'export est fait à la main dans un navigateur, déposé dans imports/,
// puis réduit ici à un extrait structuré versionné (scripts/sources/coralisland-wiki.json).
// Usage : node scripts/import-wiki2.ts [imports/fichier.xml]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { plain, sections, templates } from './lib/wikitext.ts';

const file = process.argv[2] ?? join('imports', readdirSync('imports').filter((f) => f.endsWith('.xml')).sort().pop()!);
const xml = readFileSync(file, 'utf8');
const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');

type Page = { titre: string; ns: number; rev: string; texte: string };
const pages: Page[] = [...xml.matchAll(/<page>([\s\S]*?)<\/page>/g)].map((m) => ({
  titre: dec(/<title>([^<]*)<\/title>/.exec(m[1])![1]),
  ns: Number(/<ns>(\d+)<\/ns>/.exec(m[1])![1]),
  rev: /<timestamp>([^<]*)<\/timestamp>/.exec(m[1])?.[1] ?? '',
  texte: dec(/<text[^>]*>([\s\S]*?)<\/text>/.exec(m[1])?.[1] ?? ''),
}));

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const clean = (v: string | undefined) => plain((v ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ; ')).replace(/\s+/g, ' ').trim();
const infobox = (t: string) => templates(t).find((x) => /^infobox /i.test(x.name));

/** Tableaux de cadeaux : « === ''Love'' === » puis lignes « |{{iconNew|…}} \n |Nom ». */
function gifts(t: string) {
  const out: Record<string, string[]> = {};
  const LV: Record<string, string> = { love: 'love', like: 'like', neutral: 'neutral', dislike: 'dislike', dislikes: 'dislike', hate: 'hate' };
  for (const m of t.matchAll(/^===\s*''(\w+)''\s*===\s*$([\s\S]*?)(?=^===|^==[^=]|\Z)/gm)) {
    const lv = LV[m[1].toLowerCase()];
    if (!lv) continue;
    const names: string[] = [];
    // Chaque ligne de tableau : |icône \n |Nom \n |Description …
    for (const row of m[2].split(/^\|-\s*$/m).slice(1)) {
      const cells = row.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}') && !l.startsWith('|+'));
      const name = clean(cells[1]?.slice(1));
      if (name && !/^universal/i.test(name)) names.push(name);
    }
    out[lv] = [...new Set(names)];
  }
  return out;
}

/** Lignes de {{Shop}} : nom ; prix ou coûts ; colonnes. */
function shops(t: string) {
  const out: { section: string; nom: string; cout: string; colonnes: Record<string, string> }[] = [];
  for (const [sec, body] of Object.entries(sections(t))) {
    for (const s of templates(body).filter((x) => /^shop$/i.test(x.name))) {
      const cols = (s.params.cols ?? '').split(/\s*;\s*/).filter(Boolean);
      for (const [k, raw] of Object.entries(s.params)) {
        if (!/^\d+$/.test(k)) continue;
        const cells = raw.split(/\s*;\s*/);
        const nom = clean(cells[0].replace(/\{\{[^{}]*\}\}/g, ''));
        if (!nom) continue;
        out.push({ section: clean(sec), nom, cout: clean(cells[1]), colonnes: Object.fromEntries(cols.map((c, i) => [c, clean(cells[i + 2])]).filter(([, v]) => v)) });
      }
    }
  }
  return out;
}

const personnages: any[] = [];
const captures: any[] = [];
const objets: any[] = [];
const lieux: any[] = [];
for (const p of pages.filter((x) => x.ns === 0)) {
  const ib = infobox(p.texte);
  if (!ib) continue;
  const P = ib.params;
  const kind = ib.name.replace(/^infobox\s+/i, '').toLowerCase();
  const base = { titre: p.titre, rev: p.rev };
  if (kind === 'character') {
    const bd = /(spring|summer|fall|winter)\]*\s*(\d{1,2})/i.exec(clean(P.birthday));
    personnages.push({ ...base, anniversaire: bd ? { saison: bd[1].toLowerCase(), jour: +bd[2] } : null, emploi: clean(P.occupation) || null, type: clean(P.type) || null, cadeaux: gifts(p.texte) });
  } else if (kind === 'caught') {
    const how = Object.entries(sections(p.texte)).find(([s]) => /how to obtain/i.test(s))?.[1] ?? '';
    captures.push({
      ...base,
      type: clean(P.type),
      saisons: Object.fromEntries(SEASONS.map((s) => [s, clean(P[s])]).filter(([, v]) => v)),
      heures: clean(P.time),
      meteo: clean(P.weather),
      prix: clean(P.sell),
      rarete: clean(P.rarity),
      difficulte: clean(P.difficulty),
      taille: clean(P.size),
      motif: clean(P.pattern),
      obtention: clean(how).slice(0, 600),
    });
  } else if (kind === 'item') {
    objets.push({ ...base, type: clean(P.type), graine: clean(P.seed) || null, prix_graine: clean(P.seed_price) || null, rang: clean(P.rank) || null, croissance: clean(P.growth) || null, repousse: clean(P.regrowth) || null, prix: clean(P.sell) || null, saison: clean(P.season) || null });
  } else if (kind === 'location') {
    lieux.push({ ...base, ouverture: clean(P.open) || null, ferme: clean(P.closed) || null, proprietaire: clean(P.owner) || null, stock: shops(p.texte) });
  }
}

mkdirSync('scripts/sources', { recursive: true });
const out = {
  source: { nom: 'Coral Island Wiki (coralisland.wiki)', url: 'https://coralisland.wiki', licence: 'CC0 1.0 (domaine public)', export: file.split('/').pop(), importe_le: new Date().toISOString().slice(0, 10) },
  personnages,
  captures,
  objets,
  lieux,
};
writeFileSync('scripts/sources/coralisland-wiki.json', JSON.stringify(out, null, 1));
console.log(`personnages ${personnages.length}, captures ${captures.length}, objets ${objets.length}, lieux ${lieux.length}`);
