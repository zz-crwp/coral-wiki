# Coral Wiki v2 — conception

Principe : chaque écran répond à une question de joueur, en 3 taps et 10 secondes au plus, téléphone dans une main, manette dans l'autre. Une information n'existe qu'à un endroit ; ailleurs, on y renvoie par un lien. Les constats qui motivent chaque choix sont dans `AUDIT.md` (codes B, M, m).

## 1. Architecture

Quatre onglets en bas d'écran, rien d'autre dans la barre :

| Onglet | Route | Répond à | Contenu |
|---|---|---|---|
| **Aujourd'hui** | `#/` | Q1, Q7, Q8, Q9, Q10 | Jour de jeu (puce persistante + carte du jour : jour précédent / suivant, météo en 2 taps ; *2.1 : plus d'heure à régler*) · **Manquant et disponible aujourd'hui**, chaque élément avec sa plage horaire (captures non prises + cueillettes demandées par le temple) · Ma session (si épingles) · Cette semaine (anniversaires, festivals) · Boutiques ouvertes · À planter · **Récemment** (coches des deux joueurs) |
| **Chercher** | `#/chercher` | Q4, Q5 | Champ en bas (au pouce), résultats dès la 1re lettre, FR et EN, accents et fautes tolérés, verdict « À garder » sur chaque résultat. Champ vide : consultés récemment puis le catalogue (domaines groupés par intention, rang, mines). Listes de domaine : `#/chercher/<domaine>` |
| **Collections** | `#/collections` | Q2, Q3 | Anneaux Musée · Temple · Journal ; collections (musée, temple, poissons, insectes, créatures, recettes, cœurs, succès, paliers d'outils). Filtres « Manquant », « Disponible maintenant », « Cette saison », « Par lieu ». **Saisie rapide** en grille : `#/collections/<id>/saisie` |
| **Habitants** | `#/habitants` | Q6, Q7 | Une ligne par habitant : où il est maintenant, anniversaire, cadeaux offerts cette semaine (2 cases), cœurs ; dépliée : cadeaux adorés et aimés, emploi du temps |

Hors onglets : Réglages (engrenage sur Aujourd'hui) `#/reglages` (profils, synchro à deux, thème, écran allumé, sauvegarde, version, crédits) · Calendrier `#/calendrier` (depuis « Cette semaine » et l'horloge) · Nouveautés (sheet unique après mise à jour) · `#/design` (interne).

Fiches : sheet à crans au-dessus de n'importe quel écran (`?f=<id>`), panneau latéral à partir de 960 px.

**Supprimé** : onglet Explorer (fusionné dans Chercher, M3), onglet Session (module d'Aujourd'hui, M7), pages Rentabilité des cultures (M5), Cadeaux et Cadeaux par habitant (M4), Améliorations (M6), articles anglais complets hors guides (texte long, lien vers le wiki à la place). Les anciennes adresses redirigent.

## 2. Parcours des 10 questions (cible v2)

| # | Parcours | Taps |
|---|---|---:|
| 1 | Ouvrir l'app → module « Manquant et disponible maintenant » (déjà filtré sur l'heure, la météo et les coches communes) | 0 |
| 2 | Collections → Musée → « Manquant » (les catégories sont des sections, pas des filtres) | 2–3 |
| 3 | Collections → Temple (autels en anneaux, offrandes à compléter en tête) | 1–2 |
| 4 | Chercher → saisir 2–3 lettres → le résultat porte déjà « À garder » / « Vendable » ; tap → badges d'usage en tête de fiche | 1–2 |
| 5 | Chercher → résultat → « Où et quand » (carte et zones) en tête de fiche | 2 |
| 6 | Habitants → la ligne affiche où il est ; tap → cadeaux adorés | 1–2 |
| 7 | Aujourd'hui → « Cette semaine » | 0 |
| 8 | Aujourd'hui → « Boutiques » (« Toutes » pour la liste complète) | 0–1 |
| 9 | Aujourd'hui → « À planter » (seulement ce qui mûrit avant la fin de la saison) | 0 |
| 10 | Aujourd'hui → « Récemment » (qui a coché quoi) | 0 |

Ces parcours sont des scénarios automatisés (`scripts/qa/questions.ts`) qui comptent les taps.

## 3. Une seule fiche par objet

Ordre, de haut en bas :
1. **En-tête** : icône du jeu sur tuile teintée, nom FR (anglais en sous-titre), puis **verdict** et **badges d'usage** calculés depuis les données et les coches communes :
   - `Musée : manquant` / `Musée : donné`
   - `Temple : <autel> · <offrande> (×n)` tant que l'objet n'est pas offert
   - `Quête : <nom>` (objet demandé par une quête)
   - `Adoré par : A, B, C`
   - `Recettes : n` · `Améliorations : n`
   - Verdict **À GARDER** si l'objet manque au musée ou au temple, ou sert à une quête ; sinon **VENDABLE** (les badges cadeau et recette restent visibles pour nuancer).
2. **En ce moment** (dispo maintenant, ouvert, où est l'habitant).
3. **Où et quand** (carte, zones liées à leur fiche lieu) ou **Obtention**.
4. **Prix par qualité**.
5. **Utilisé dans** (recettes, améliorations), puis le reste replié, sources en bas.

Les listes thématiques (temple, musée, journal, lieu « À trouver ici ») sont des vues filtrées de la même base ; aucune liste n'est recopiée dans une autre page.

## 4. Saisie et coches

- **Glisser** une ligne vers la droite ou **appui long** : coche ; toast « Annuler » de **5 s** ; aucune confirmation (sauf supprimer un profil).
- **Saisie rapide** : grille d'icônes comme le journal du jeu, un tap = donné / attrapé, toast « Annuler », compteur en haut, filtre « Manquants » ; pour rattraper une progression existante.
- **Ma session** : épingler depuis une fiche ou un appui long ; module en tête d'Aujourd'hui.

## 5. Progression commune à deux

Modèle par clé de suivi (`musee:<id>`, `temple:<offrande>:<objet>`, `pris:<id>`, `cuisine:<id>`, `coeur:…`, `succes:<id>`, `cadeau:…`) :

```ts
type Mark = { s: 0 | 1; t: number; par: string }; // état, horodatage ms UTC, joueur
type Progress = Record<string, Mark>;
```

- Une coche écrit `{ s: 1, t: now, par: moi }` ; décocher écrit `{ s: 0, … }` (la suppression est une marque, pour gagner contre une coche plus ancienne).
- **Fusion** clé par clé : la marque la plus récente gagne ; à égalité, ordre stable sur `par` puis `s`. Fonction pure, commutative, associative et idempotente : même résultat quel que soit l'ordre d'arrivée (testé).
- **Commun** : musée, temple, journal (`pris:`), recettes (`cuisine:`). **Personnel** : cadeaux de la semaine, événements de cœur, succès, paliers d'outils, cœurs, horloge de jeu. Le fil « Récemment » montre les deux.
- **GitHub Gist** (*révisé en 2.1*) : **un seul compte GitHub pour la maison**, le même jeton sur chaque téléphone, un prénom par joueur. Un gist secret commun, un fichier par joueur (`joueur-<id>.json`) : chacun n'écrit que le sien et lit tous les autres. Aucun appairage. Jeton **classic** à portée `gist` seule, gardé sur l'appareil.
- **Hors ligne d'abord** : les coches sont locales et immédiates ; envoi groupé 5 s après la dernière coche et quand l'app passe en arrière-plan ; lecture au démarrage et au retour au premier plan avec `If-None-Match` (ETag, réponse 304 sans quota). Sans jeton, l'app est complète en solo.
- **Qui a coché quoi** : initiale colorée du joueur sur les coches du partenaire ; fil « Récemment » (15 dernières marques).

## 6. Stockage et migration

- IndexedDB `coral-wiki` passe en **version 2**. Dans la transaction de mise à niveau : copie intégrale des profils v1 dans le magasin `sauvegardes` (export automatique, téléchargeable depuis les réglages), puis conversion `checks: { clé: horodatage }` → `prog: { clé: { s: 1, t: horodatage, par: <joueur local> } }`. Aucune coche perdue (test `scripts/qa/migration.test.ts`).
- Identité du joueur (identifiant aléatoire + prénom) dans `meta`, commune aux profils de l'appareil.
- Export / import JSON : format v2, l'import accepte aussi les fichiers v1 (migrés à la lecture).

## 7. Système de composants (repris de la refonte, ajustés)

Jetons (`src/design/tokens.css`), ligne repliable par domaine (`XRow`), sheet à crans, puces d'état, contrôle segmenté, anneau, tuile d'image teintée, carte (`MapView`). Ajouts v2 :

| Composant | Rôle |
|---|---|
| `Verdict` + `UsageBadges` | en-tête de fiche et ligne de recherche (Q4) |
| `QuickGrid` | saisie rapide en grille (M8) |
| `RecentFeed` | fil des coches avec auteur (Q10) |
| `PlayerDot` | initiale colorée de l'auteur d'une coche |
| `SearchDock` | champ de recherche de l'onglet Chercher, ancré au-dessus de la barre |

Thème par défaut **Auto (soir)** : sombre de 19 h à 7 h, sinon comme le système ; options Clair, Sombre, Noir OLED. Contrastes AA, cibles ≥ 44 px, animations ≤ 350 ms coupées par `prefers-reduced-motion`.

## 8. Performance

Cible Lighthouse ≥ 95 (performance, accessibilité, bonnes pratiques) sur Aujourd'hui, Chercher, Collections, Habitants et une fiche.
- Police des grands titres préchargée depuis `index.html` (le LCP d'Aujourd'hui est le grand titre).
- Fiche : une entité = un petit fichier JSON (`/e/<id>.json`) au lieu du fichier complet du domaine (535 Ko pour les habitants).
- Articles anglais : seulement pour les guides, chargés à l'ouverture de la section.
