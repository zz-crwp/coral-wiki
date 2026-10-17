// Icônes officielles du jeu hébergées sur le wiki : icônes de carte (lieux sans photo) et icônes d'interface
// (météo, qualité, or, cœurs…). Chargées depuis le CDN Fandom comme toutes les images, jamais copiées dans le dépôt.

/** Lieux et festivals sans image : icône de la carte du jeu correspondante. */
export const MAP_ICONS: Record<string, string> = {
  'community-center': 'Community center map icon.png',
  library: 'Community center map icon.png', // la bibliothèque est dans le centre communautaire
  'recreation-center': 'Community center map icon.png',
  'diving-pier': 'Diving pier map icon.png',
  'starlet-elementary-school': 'School map icon.png',
  'zarahs-boat': 'Zarahs boat map icon.png',
  'giant-village': 'Giant map icon.png',
  'pufferfish-shop': 'Pufferfish map icon.png',
  'hillside-brewery-and-vineyard': 'Drink map icon.png',
  'pet-shelter': 'Default store map icon.png',
  'deep-forest': 'Forest map icon.png',
  'mid-forest': 'Forest map icon.png',
  'bamboo-forest': 'Forest map icon.png',
  woodlands: 'Tree map icon.png',
  'garden-lane': 'Tree map icon.png',
  '2-parkview': 'Home map icon.png',
  'agung-house': 'Home map icon.png',
  barrack: 'Home map icon.png',
  'cooking-staff-house': 'Home map icon.png',
  'denali-family-house': 'Home map icon.png',
  'emmas-cottage': 'Home map icon.png',
  'wildlife-enthusiasts': 'Home map icon.png',
  'victorian-mansion': 'Home map icon.png',
  'abandoned-villa': 'Home map icon.png',
  'naga-palace': 'Default location map icon.png',
  'hot-spring': 'Default location map icon.png',
  lighthouse: 'Default location map icon.png',
  'winter-fair': 'Festival map icon.png',
  'festival-of-the-sun': 'Festival map icon.png',
};

/** Icônes d'interface : clé utilisée par l'app → fichier du wiki. */
export const UI_ICONS: Record<string, string> = {
  sunny: 'Weather sunny.png',
  rain: 'Weather rain.png',
  storm: 'Weather storm.png',
  snow: 'Weather snow.png',
  windy: 'Weather windy.png',
  coin: 'Coin.png',
  bronze: 'Bronze.png',
  silver: 'Silver.png',
  gold: 'Gold.png',
  osmium: 'Osmium.png',
  health: 'Health.png',
  energy: 'Energy.png',
  calendar: 'Calendar.png',
  journal: 'Journal menu.png',
  map: 'Map menu.png',
  bag1: 'Bag level 1.png',
  bag2: 'Bag level 2.png',
  bag3: 'Bag level 3.png',
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`heart${i + 1}`, `Heart ${i + 1} icon.png`])),
};
