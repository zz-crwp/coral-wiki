// Contexte partagé du build : pages, résolveur, images, collecte des relations et conflits.
import type { Page } from '../lib/load.ts';
import { Resolver, pageUrl } from '../lib/load.ts';
import type { Domain } from './classify.ts';
import type { Template } from '../lib/wikitext.ts';
import { normName } from '../lib/wikitext.ts';

export type Img = { url: string; w: number; h: number; file: string };

export type Draft = {
  id: string;
  domain: Domain;
  page: Page;
  infobox: Template | null;
  nom_en: string;
  nom_fr?: string;
  nom_fr_source?: 'wiki-fr' | 'langlink' | 'en';
  categorie: string;
  sous_categorie?: string;
  image: Img | null;
  description_en: string;
  description_fr?: string;
  obtention: string[];
  lieux: string[];
  saisons: string[];
  meteo: string[];
  horaires: { from: number; to: number }[];
  horaires_texte?: string;
  prix: { base: number | null; bronze?: number | null; silver?: number | null; gold?: number | null; osmium?: number | null } | null;
  prerequis: string[];
  utilise_dans: Set<string>;
  aime_par: Record<string, Set<string>>;
  extra: Record<string, any>;
  liens: Set<string>;
  a_verifier: Set<string>;
  sources: { name: string; url: string; rev?: number; date?: string }[];
};

export type Conflict = { id: string; champ: string; valeurs: { source: string; valeur: unknown }[]; retenu: unknown; raison: string };

export class Ctx {
  drafts = new Map<string, Draft>();
  conflicts: Conflict[] = [];
  warnings: string[] = [];
  pages: Map<string, Page>;
  resolver: Resolver;
  images: Record<string, { url: string; width: number; height: number } | null>;
  constructor(pages: Map<string, Page>, resolver: Resolver, images: Record<string, { url: string; width: number; height: number } | null>) {
    this.pages = pages;
    this.resolver = resolver;
    this.images = images;
  }

  image(file: string | null | undefined): Img | null {
    if (!file) return null;
    const f = normName(file.replace(/^(File|Image|Fichier):/i, '').split('|')[0]);
    const ii = this.images[f];
    if (!ii || !ii.width || !ii.height) return null;
    // Vignette 128 px côté CDN (rapide) : /revision/latest/scale-to-width-down/128
    return { url: ii.url, w: ii.width, h: ii.height, file: f };
  }

  ref(raw: string, track = true): string | null {
    return this.resolver.resolve(raw, track);
  }

  /** Lie a → b en « utilisé dans » (a est utilisé dans b). */
  usedIn(ingredient: string | null, product: string) {
    if (!ingredient || ingredient === product) return;
    this.drafts.get(ingredient)?.utilise_dans.add(product);
  }

  push(id: string, key: string, value: unknown) {
    const d = this.drafts.get(id);
    if (!d) return;
    (d.extra[key] ??= []).push(value);
  }

  conflict(c: Conflict) {
    this.conflicts.push(c);
  }
}

export function fandomSource(p: Page) {
  return { name: 'Coral Island Wiki (Fandom)', url: pageUrl(p.title), rev: p.revid, date: p.timestamp?.slice(0, 10) };
}
