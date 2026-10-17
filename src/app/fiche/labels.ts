// Libellés FR des champs et valeurs affichés sur les fiches.
export const WEATHER_FR: Record<string, string> = {
  sunny: 'Ensoleillé',
  rain: 'Pluie',
  storm: 'Orage',
  snow: 'Neige',
  windy: 'Vent',
  blizzard: 'Blizzard',
};

export const QUALITY: { key: 'base' | 'bronze' | 'silver' | 'gold' | 'osmium'; label: string; color: string }[] = [
  { key: 'base', label: 'Base', color: 'var(--muted)' },
  { key: 'bronze', label: 'Bronze', color: '#b06a2c' },
  { key: 'silver', label: 'Argent', color: '#8a9aa6' },
  { key: 'gold', label: 'Or', color: '#c9a227' },
  { key: 'osmium', label: 'Osmium', color: '#6a5acd' },
];
export const QUALITY_BY_INDEX = ['Base', 'Bronze', 'Argent', 'Or', 'Osmium'];

export const GIFT_LEVELS: { key: string; label: string; icon: string }[] = [
  { key: 'love', label: 'Adore', icon: '♥♥' },
  { key: 'like', label: 'Aime', icon: '♥' },
  { key: 'neutral', label: 'Neutre', icon: '–' },
  { key: 'dislike', label: "N'aime pas", icon: '✕' },
  { key: 'hate', label: 'Déteste', icon: '✕✕' },
];
export const UNIVERSAL_CODE: Record<string, string> = { L: 'love', l: 'like', n: 'neutral', d: 'dislike', h: 'hate' };

/** Champs « extra » simples affichés en clé/valeur, dans cet ordre. */
export const EXTRA_FIELDS: [string, string, ((v: any) => string)?][] = [
  ['type', 'Type'],
  ['rarete', 'Rareté'],
  ['rarete_mine', 'Rareté (mine)'],
  ['difficulte', 'Difficulté'],
  ['taille_ombre', "Taille de l'ombre"],
  ['motif', 'Motif de nage'],
  ['famille', 'Famille'],
  ['profondeur', 'Profondeur'],
  ['jours', 'Jours'],
  ['croissance', 'Croissance', (v) => `${v} jours`],
  ['repousse', 'Repousse', (v) => `tous les ${v} jours`],
  ['prix_graine', 'Prix de la graine', (v) => `${v} or`],
  ['culture_geante', 'Culture géante'],
  ['rang_ville', 'Rang de ville requis'],
  ['prix_achat', "Prix d'achat", (v) => `${v} or`],
  ['prix_ouverture', "Coût d'ouverture", (v) => `${v} or`],
  ['sante', 'Santé', (v) => `+${v}`],
  ['energie', 'Énergie', (v) => `+${v}`],
  ['effet', 'Effet'],
  ['effet_negatif', 'Effet négatif'],
  ['duree_effet', "Durée de l'effet"],
  ['duree', 'Durée de production'],
  ['taille', 'Encombrement'],
  ['logement', 'Logement'],
  ['frequence', 'Production'],
  ['outil', 'Outil de récolte'],
  ['croissance_animal', 'Croissance'],
  ['deblocage', 'Déblocage'],
  ['source_recette', 'Source de la recette'],
  ['entrees_texte', 'Accepte'],
  ['produits_texte', 'Produit'],
  ['automatique', 'Automatique'],
  ['duree_construction', 'Construction'],
  ['pv', 'PV'],
  ['attaque', 'Attaque'],
  ['defense', 'Défense'],
  ['xp', 'XP'],
  ['variante', 'Variante'],
  ['genre', 'Genre'],
  ['espece', 'Espèce'],
  ['emploi', 'Emploi'],
  ['situation', 'Situation'],
  ['loisirs', 'Loisirs'],
  ['horaires_ouverture', "Horaires d'ouverture"],
  ['ferme_le', 'Fermé le'],
  ['adresse', 'Adresse'],
  ['situe', 'Situé'],
  ['proprietaire', 'Propriétaire'],
  ['employes', 'Employés'],
  ['residents', 'Résidents'],
  ['competence_prix', 'Compétence de prix'],
  ['journal_id', 'N° du journal'],
  ['pourcentage_joueurs', 'Joueurs Steam ayant ce succès', (v) => `${v} %`],
];

export function hours(h: number | null | undefined): string {
  if (h == null) return '';
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${hh}h${mm ? String(mm).padStart(2, '0') : ''}`;
}

export function ranges(r: { from: number; to: number }[]): string {
  if (!r.length) return '';
  if (r.length === 1 && r[0].from <= 6 && r[0].to >= 26) return 'Toute la journée';
  return r.map((x) => `${hours(x.from)} – ${hours(x.to)}`).join(', ');
}
