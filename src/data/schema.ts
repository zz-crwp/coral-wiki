// Schémas partagés pipeline ↔ app. Le pipeline valide chaque fichier de domaine avec zod.
import { z } from 'zod';

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export const Season = z.enum(SEASONS);
export type Season = z.infer<typeof Season>;

export const WEATHERS = ['sunny', 'rain', 'storm', 'snow', 'windy', 'blizzard'] as const;
export const Weather = z.enum(WEATHERS);

export const QUALITIES = ['base', 'bronze', 'silver', 'gold', 'osmium'] as const;

/** Valeur inconnue : jamais inventée, explicitement marquée. */
export const A_VERIFIER = 'à vérifier' as const;

export const Image = z.object({ url: z.string().url(), w: z.number().int().positive(), h: z.number().int().positive(), file: z.string() });
export type Image = z.infer<typeof Image>;

export const Source = z.object({
  name: z.string(),
  url: z.string().url(),
  rev: z.number().int().optional(),
  date: z.string().optional(),
});

export const Price = z.object({
  base: z.number().nullable(),
  bronze: z.number().nullable().optional(),
  silver: z.number().nullable().optional(),
  gold: z.number().nullable().optional(),
  osmium: z.number().nullable().optional(),
});
export type Price = z.infer<typeof Price>;

/** Plage horaire en heures décimales (6 = 6h00, 26 = 2h du matin le lendemain). */
export const TimeRange = z.object({ from: z.number(), to: z.number() });

export const GiftLevel = z.enum(['love', 'like', 'neutral', 'dislike', 'hate']);
export type GiftLevel = z.infer<typeof GiftLevel>;

export const Ref = z.string().regex(/^[a-z0-9-]+$/, 'id invalide');

export const Confidence = z.enum(['haute', 'moyenne', 'basse']);

export const Entity = z.object({
  id: Ref,
  nom_fr: z.string().min(1),
  nom_en: z.string().min(1),
  nom_fr_source: z.enum(['wiki-fr', 'langlink', 'en']).describe('provenance du nom FR'),
  /** Traduction FR non officielle du nom (alias de recherche, jamais affichée comme nom officiel). */
  nom_fr_alias: z.string().optional(),
  categorie: z.string(),
  sous_categorie: z.string().optional(),
  image: Image.nullable(),
  description: z.string(), // FR si disponible, sinon EN (cf. description_lang)
  description_en: z.string(),
  /** fr = texte du jeu (wiki FR / Steam), fr-trad = traduction non officielle, en = original. */
  description_lang: z.enum(['fr', 'fr-trad', 'en']),
  obtention: z.array(z.string()),
  lieux: z.array(z.string()),
  saisons: z.array(Season),
  meteo: z.array(z.string()),
  horaires: z.array(TimeRange),
  horaires_texte: z.string().optional(),
  prix: Price.nullable(),
  prerequis: z.array(z.string()),
  utilise_dans: z.array(Ref),
  aime_par: z.partialRecord(GiftLevel, z.array(Ref)),
  /** Champs propres au domaine (rareté, taille d'ombre, croissance…). */
  extra: z.record(z.string(), z.unknown()),
  /** Liens vers d'autres fiches trouvés dans le texte (pour le maillage). */
  liens: z.array(Ref),
  sources: z.array(Source).min(1),
  confiance: Confidence,
  a_verifier: z.array(z.string()).describe('champs non confirmés'),
});
export type Entity = z.infer<typeof Entity>;

/** Entrée de l'index de recherche / des listes (léger, chargé au démarrage). */
export const IndexEntry = z.object({
  id: Ref,
  fr: z.string(),
  en: z.string(),
  c: z.string(), // catégorie
  d: z.string(), // domaine (fichier de données)
  i: z.string().nullable(), // URL image
  s: z.array(Season).optional(),
});
export type IndexEntry = z.infer<typeof IndexEntry>;

export const Meta = z.object({
  game_version: z.string(),
  game_version_date: z.string(),
  game_version_source: z.string().url(),
  upcoming: z.string().optional(),
  generated_at: z.string(),
  fandom_fetched_at: z.string(),
  counts: z.record(z.string(), z.number()),
});
