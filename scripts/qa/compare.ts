// Échantillon de 30 fiches (tirage fixe, réparti par domaine) : infobox source brute ↔ valeurs de l'app.
// Sert à la comparaison manuelle (verdicts notés dans reports/comparaison-30.md).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadNs } from '../lib/load.ts';
import { templates } from '../lib/wikitext.ts';

const pages = loadNs(0);
const byTitle = new Map([...pages.values()].map((p) => [p.title, p]));
const DOMS = ['cultures', 'arbres', 'cueillette', 'elevage', 'poissons', 'insectes', 'creatures-marines', 'mineraux', 'artisanat', 'cuisine', 'pnj', 'lieux', 'festivals', 'outils', 'monstres', 'quetes', 'ressources', 'objets'];
let seed = 20261017;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const picks: { dom: string; e: any }[] = [];
for (let round = 0; picks.length < 30; round++)
  for (const d of DOMS) {
    if (picks.length >= 30) break;
    const list = JSON.parse(readFileSync(`src/data/${d}.json`, 'utf8')) as any[];
    const e = list[Math.floor(rnd() * list.length)];
    if (!picks.some((p) => p.e.id === e.id)) picks.push({ dom: d, e });
  }

const short = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return (s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '¦').slice(0, 160);
};
let md = `# Comparaison de 30 fiches avec la source\n\nTirage fixe (graine ${20261017}), réparti sur ${DOMS.length} domaines. Source : wikitext Fandom en cache (${readdirSync('.cache/pages/0').length} pages).\n\n`;
for (const { dom, e } of picks) {
  const title = decodeURIComponent(e.sources[0].url.split('/wiki/')[1]).replace(/_/g, ' ');
  const p = byTitle.get(title);
  const box = p ? templates(p.content).find((t) => /infobox|^npc|^item|^fish|^crop|^location|^festival|^quest/i.test(t.name)) : undefined;
  md += `## ${e.nom_fr} (${dom})\n\n[Source](${e.sources[0].url})\n\n| Source (infobox ${box?.name ?? '—'}) | Valeur |\n|---|---|\n`;
  for (const [k, v] of Object.entries(box?.params ?? {})) if (String(v).trim()) md += `| ${k} | ${short(v)} |\n`;
  md += `\n| App | Valeur |\n|---|---|\n`;
  const app: Record<string, unknown> = {
    nom_fr: e.nom_fr,
    nom_en: e.nom_en,
    categorie: e.categorie,
    saisons: e.saisons,
    meteo: e.meteo,
    horaires: e.horaires,
    lieux: e.lieux,
    prix: e.prix,
    obtention: e.obtention,
    a_verifier: e.a_verifier,
    image: e.image?.file,
    ...Object.fromEntries(Object.entries(e.extra ?? {}).filter(([k]) => !['emploi_du_temps', 'evenements_coeur', 'sorties', 'lettres', 'cadeaux', 'mariage'].includes(k))),
  };
  for (const [k, v] of Object.entries(app)) if (v != null && !(Array.isArray(v) && !v.length)) md += `| ${k} | ${short(v)} |\n`;
  md += '\n**Verdict** : _à remplir_\n\n';
}
writeFileSync('reports/comparaison-30-brut.md', md);
console.log(picks.map((p) => `${p.dom}:${p.e.id}`).join(' '));
