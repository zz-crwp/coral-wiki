// Page Fandom → domaine de données + catégorie FR. Une page = au plus une entité.
import type { Page } from '../lib/load.ts';
import { templates, type Template } from '../lib/wikitext.ts';
import { clean } from './norm.ts';

export type Domain =
  | 'cultures' | 'arbres' | 'cueillette' | 'poissons' | 'insectes' | 'creatures-marines'
  | 'mineraux' | 'ressources' | 'elevage' | 'artisanat' | 'cuisine' | 'pnj' | 'lieux'
  | 'monstres' | 'festivals' | 'vetements' | 'mobilier' | 'outils' | 'armes' | 'objets'
  | 'groupes' | 'batiments' | 'guides' | 'quetes' | 'maitrises' | 'succes';

export const DOMAIN_LABELS: Record<Domain, string> = {
  cultures: 'Cultures & graines',
  arbres: 'Arbres',
  cueillette: 'Cueillette',
  poissons: 'Poissons',
  insectes: 'Insectes',
  'creatures-marines': 'Créatures marines',
  mineraux: 'Minerais, gemmes, fossiles & artefacts',
  ressources: 'Ressources',
  elevage: 'Élevage',
  artisanat: 'Artisanat',
  cuisine: 'Cuisine',
  pnj: 'Personnages',
  lieux: 'Lieux & magasins',
  monstres: 'Monstres',
  festivals: 'Festivals',
  vetements: 'Vêtements',
  mobilier: 'Mobilier & décoration',
  outils: 'Outils',
  armes: 'Armes & anneaux',
  objets: 'Objets divers',
  groupes: "Groupes d'objets",
  batiments: 'Bâtiments',
  guides: 'Guides & mécaniques',
  quetes: 'Quêtes',
  maitrises: 'Maîtrises & compétences',
  succes: 'Succès',
};

export type Classified = { domain: Domain; categorie: string; infobox: Template | null } | { excluded: string };

const cat = (p: Page, re: RegExp) => p.categories.some((c) => re.test(c.title));

/** Pages de contenu non-jeu ou méta. */
const META_TITLES = /^(Coral Island Wiki|Coral Island|Stairway Games|Wiki rules|Sandbox|Test)$/i;

export function classify(p: Page): Classified {
  const t = p.title;
  if (META_TITLES.test(t)) return { excluded: 'page d’accueil / méta du wiki' };
  if (/\/(Dialogue|Gallery|Galleries|Letters|Events|Hangout Events|Draft|Sandbox)$/i.test(t) || /^Hangout Events\//.test(t))
    return { excluded: 'sous-page fusionnée dans la fiche du personnage' };
  if (/\/Draft$|^Map:/i.test(t)) return { excluded: 'brouillon / carte interactive' };
  if (cat(p, /^(Removed|Candidates for deletion|Blog posts|About)$/)) return { excluded: 'contenu retiré du jeu ou page à supprimer' };
  if (/DLC Pack$/i.test(t)) return { excluded: 'pack DLC (page commerciale, objets importés séparément)' };

  const tpls = templates(p.content);
  const ib = tpls.find((x) => /^infobox/i.test(x.name)) ?? null;
  const name = ib?.name.toLowerCase().replace(/^infobox[ _]/, '') ?? '';
  const type = clean(ib?.params.type).toLowerCase();
  const category = clean(ib?.params.category).toLowerCase();
  const r = (domain: Domain, categorie: string) => ({ domain, categorie, infobox: ib });

  switch (name) {
    case 'character': {
      if (/pet/.test(type)) return r('pnj', 'Animal de compagnie');
      if (/merfolk/.test(type)) return r('pnj', 'Merfolk');
      if (/stranger/.test(type)) return r('pnj', 'Étranger');
      return r('pnj', 'Habitant');
    }
    case 'crop':
      return r('cultures', { fruit: 'Fruit', vegetable: 'Légume', flower: 'Fleur', grain: 'Céréale', mushroom: 'Champignon' }[type] ?? 'Culture');
    case 'tree':
      return r('arbres', 'Arbre');
    case 'fish':
      return r('poissons', 'Poisson');
    case 'bug':
      return type === 'critter' ? r('creatures-marines', 'Créature marine') : r('insectes', 'Insecte');
    case 'scavenge':
      return r('cueillette', 'Cueillette');
    case 'animal':
      return r('elevage', 'Animal');
    case 'monster':
      return r('monstres', 'Monstre');
    case 'festival':
      return r('festivals', 'Festival');
    case 'location':
      return r('lieux', /store|shop/.test(type) || cat(p, /^Shops and services$/) ? 'Magasin' : 'Lieu');
    case 'food':
      return r('cuisine', 'Plat cuisiné');
    case 'artisan product':
      return r('artisanat', 'Produit artisanal');
    case 'clothing':
      return r('vetements', 'Vêtement');
    case 'building':
      return r('batiments', 'Bâtiment');
    case 'terminology':
      return /item group/.test(type) ? r('groupes', "Groupe d'objets") : r('guides', 'Mécanique');
    case 'container':
      return r('mineraux', /geode/.test(category) || /geode/i.test(t) ? 'Géode' : /fossil/.test(type) ? 'Nœud de fossile' : 'Coffre');
    case 'decor':
      return r('mobilier', 'Décoration');
    case 'equipment': {
      if (/tool/.test(type)) return r('outils', 'Outil');
      if (/scarecrow/.test(type)) return r('artisanat', 'Épouvantail');
      if (/sprinkler/.test(type)) return r('artisanat', 'Arroseur');
      if (/fertili/.test(type)) return r('artisanat', 'Engrais');
      if (/bomb/.test(type)) return r('artisanat', 'Explosif');
      if (/ranch/.test(type)) return r('elevage', "Équipement d'élevage");
      return r('artisanat', 'Machine');
    }
    case 'item': {
      if (cat(p, /^(Animal products|Barn products|Coop products)$/) || /^(eggs|any milk)/.test(category)) return r('elevage', "Produit d'élevage");
      if (/artifact/.test(type)) return r('mineraux', 'Artefact');
      if (/fossil|dino print/.test(type)) return r('mineraux', 'Fossile');
      if (/^gem/.test(type)) return r('mineraux', 'Gemme');
      if (/geode/.test(type)) return r('mineraux', 'Géode');
      if (/^(resource|loot)$/.test(type)) return r('ressources', type === 'loot' ? 'Butin' : 'Ressource');
      if (/^(seeds|seedling|sapling)$/.test(type)) return r('cultures', { seeds: 'Graines', seedling: 'Plant', sapling: 'Jeune arbre' }[type]!);
      if (/furniture|decorat|decor|window|floor|wallpaper/.test(type) || /fence/.test(category)) return r('mobilier', 'Mobilier');
      if (/weapon/.test(type)) return r('armes', 'Arme');
      if (/ring/.test(type)) return r('armes', 'Anneau');
      if (/cooking utensil/.test(type)) return r('cuisine', 'Ustensile');
      if (/trap/.test(type)) return r('objets', 'Piège');
      return r('objets', 'Objet');
    }
  }
  if (ib) return r('objets', 'Objet');
  // Sans infobox : article de mécanique / guide si assez de contenu, sinon page de liste.
  if (cat(p, /^(Article stubs)$/) && p.content.length < 400) return { excluded: 'ébauche vide (moins de 400 caractères, sans données)' };
  if (/^\{\{#dpl|<dpl>/i.test(p.content.trim()) && p.content.length < 1200) return { excluded: 'page de liste générée (DPL), remplacée par les listes de l’app' };
  return r('guides', 'Guide');
}
