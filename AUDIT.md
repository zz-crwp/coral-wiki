# Audit de Coral Wiki v1 → décisions pour la v2

Audit réalisé le 19/10/2026 sur la v1 (tag `v1.0.0`, commit `3007a4b`), à 390 px, en clair et en sombre.
Les captures sont dans `reports/audit/v1/<thème>/` (avant) et `reports/audit/v2/<thème>/` (après). Elles contiennent les illustrations du jeu (© Stairway Games) : elles restent hors du dépôt public (`.gitignore`) et sont publiées dans la page d'audit privée. Chaque constat renvoie à sa capture par son nom de fichier.

Gravité : **bloquant** (empêche une des 10 questions ou fait perdre des données), **majeur** (réponse lente, ambiguë ou dispersée), **mineur** (friction ou finition).
Décision : **garder**, **fusionner**, **refaire**, **supprimer**.

## 1. Inventaire

| Élément | v1 |
|---|---|
| Pile | Vite 8, TypeScript 7, Preact 11 + signals, vite-plugin-pwa (Workbox), MiniSearch, idb, zod |
| Routes | `#/` Aujourd'hui · `#/explorer` + 26 listes de domaine · `#/explorer/{ameliorations,rang,mines}` · `#/progression` + 8 collections + temple · `#/session` · `#/calendrier` · `#/reglages` · `#/credits` · `#/design` · `#/outils/{cultures,cadeaux,cadeaux/<pnj>}` · fiches en sheet via `?f=<id>` · 12 anciennes adresses redirigées |
| Écrans (fichiers) | 12 pages : Today, Explorer, Domain, Fiche, Trackers, Temple, Session, Calendar, Tools (rentabilité + cadeaux), Special (améliorations, rang, mines), Misc (réglages, crédits), Design |
| Onglets | Aujourd'hui · Explorer · Progression · Session + bouton Recherche |
| Données | 3 002 entités, 26 domaines, 7,2 Mo de JSON (dont 1,9 Mo d'articles anglais), validées par zod au build |
| Stockage | IndexedDB `coral-wiki` v1 : un document par profil `{ checks: { clé: horodatage }, session, paliers, coeurs, date, météo, heure }` ; préférences d'appareil en localStorage |
| Synchro | Gist privé unique, fusion **par profil entier** (le profil modifié le plus récemment écrase l'autre) |
| Poids | JS d'entrée 84 Ko (29 Ko gzip), CSS 66 Ko (14 Ko gzip), 82 morceaux JS, précache 99 fichiers / 7,4 Mo |
| Dépendances | 7 en production, aucune dépendance lourde ; puppeteer-core pour la QA |

## 2. Les 10 questions, mesurées sur la v1

Taps comptés depuis l'ouverture de l'app (onglet Aujourd'hui), sans compter la frappe dans la recherche.

| # | Question | Taps v1 | Temps | Friction | Gravité | Capture |
|---|---|---:|---|---|---|---|
| 1 | Que puis-je attraper ou récolter maintenant qui me manque ? | 2 par domaine, 6+ au total | ~25 s | Le module « À attraper maintenant » compte tout mais mélange pris et non pris ; la liste des manquants exige d'ouvrir poissons, insectes et créatures séparément puis le filtre « Pas attrapés ». La cueillette n'y figure pas. | majeur | `01-aujourdhui`, `06-liste-poissons` |
| 2 | Que me manque-t-il pour le musée, par catégorie ? | 3 | ~8 s | Correct (Progression → Musée → Manquants), mais les puces de catégorie défilent hors écran. | mineur | `15-musee` |
| 3 | Que me manque-t-il pour le temple, autel par autel ? | 2 | ~6 s | Correct. | — | `14-temple` |
| 4 | Cet objet sert-il ? Je le garde ou je le vends ? | 2 + frappe | ~20 s | Aucune réponse directe : musée et temple sont des cases à cocher sans état « manquant », les quêtes sont tout en bas, « Adoré par » est dans une section repliée. Il faut tout lire pour conclure. | **majeur** | `13-fiche-materiau`, `07-fiche-poisson` |
| 5 | Où et quand trouver cet objet ? | 2 + frappe | ~8 s | Bon pour les captures (carte et zones). Pour les autres objets, « Obtention » est un texte. | mineur | `07-fiche-poisson` |
| 6 | Qu'aime ce villageois, où est-il maintenant ? | 3 + défilement | ~12 s | Les habitants sont un domaine parmi 26 dans Explorer ; le planificateur de cadeaux est un écran séparé (doublon). | majeur | `26-liste-pnj`, `21-cadeaux` |
| 7 | Anniversaire ou festival aujourd'hui / cette semaine ? | 0 | ~2 s | Correct. | — | `01-aujourdhui` |
| 8 | Quels magasins sont ouverts maintenant ? | 0–1 | ~3 s | Correct (5 premiers, « Toutes » pour la liste). | — | `01-aujourdhui` |
| 9 | Que planter pour récolter avant la fin de la saison ? | 0 | ~3 s | Correct (4 meilleures cultures). | — | `01-aujourdhui` |
| 10 | Qu'a donné ou coché mon ou ma partenaire récemment ? | impossible | — | Aucune notion d'auteur ni d'historique. | **bloquant** | — |

## 3. Constats

### Bloquants

| # | Constat | Capture | Décision |
|---|---|---|---|
| B1 | **La synchro écrase la progression de l'autre joueur.** La fusion Gist garde le profil entier le plus récent : si deux joueurs cochent chacun de leur côté, les coches du premier à synchroniser disparaissent. Inutilisable en coop. | `23-plus` | **refaire** : un Gist par joueur, fusion clé par clé (le plus récent gagne), suppressions conservées comme « décoché à t ». |
| B2 | **Question 10 impossible** : les coches n'ont ni auteur ni historique consultable. | — | **refaire** : chaque coche porte `par` et `t` ; fil « Récemment » et pastille d'auteur. |
| B3 | **Migration non prévue** : changer le format des coches sans précaution ferait perdre la progression existante. | — | **refaire** : export automatique de sécurité avant la migration, migration IndexedDB v1 → v2 testée. |

### Majeurs

| # | Constat | Capture | Décision |
|---|---|---|---|
| M1 | Pas de verdict « garder ou vendre » ; les usages (musée, temple, quête, cadeau adoré, recettes) sont dispersés sur la fiche. | `13-fiche-materiau` | **refaire** : badges d'usage en tête de fiche et verdict À GARDER / VENDABLE. |
| M2 | « Qu'est-ce qui me manque maintenant » demande 3 listes et 2 filtres chacune ; la cueillette en est absente. | `01-aujourdhui`, `06-liste-poissons` | **refaire** : une liste unique « Manquant et disponible maintenant » (poissons, insectes, créatures, cueillette) sur Aujourd'hui. |
| M3 | Explorer (tuiles de domaines) et la Recherche se recouvrent : deux points d'entrée pour la même base. | `05-encyclopedie`, `03-recherche-vide` | **fusionner** : onglet « Chercher » = recherche instantanée + catalogue en dessous quand le champ est vide. |
| M4 | Les habitants n'ont pas d'onglet ; le planificateur de cadeaux (`#/outils/cadeaux`) duplique les lignes d'habitants. | `26-liste-pnj`, `21-cadeaux`, `22-cadeaux-scott` | **fusionner** : onglet « Habitants » (où il est, anniversaire, cadeaux de la semaine) ; suppression des pages Cadeaux. |
| M5 | Le calculateur de rentabilité (`#/outils/cultures`) duplique la liste des cultures (bénéfice par jour) et le module « À planter ». | `20-outil-cultures`, `11-fiche-culture` | **supprimer** la page ; la liste des cultures et Aujourd'hui gardent le calcul. |
| M6 | La page Améliorations duplique les fiches des magasins et des outils. | `16-ameliorations`, `09-fiche-outil` | **supprimer** la page ; les améliorations vivent sur la fiche du magasin et de l'outil. |
| M7 | L'onglet Session est presque toujours vide en début de partie ; un onglet entier pour une liste d'épingles. | `25-session` | **fusionner** : « Ma session » devient un module d'Aujourd'hui (épingler reste à un appui long). |
| M8 | Rattraper une progression existante est long : une coche à la fois depuis les fiches ou la liste. | `18-tracker-poissons` | **refaire** : mode « Saisie rapide » en grille d'icônes (journal du jeu), un tap = donné. |
| M9 | Performance Lighthouse sous 95 : 94 sur Aujourd'hui, 90 sur une fiche (LCP 3,3 s : la fiche charge tout le fichier des habitants, 535 Ko). | — | **refaire** : premier rendu sans attendre IndexedDB, en-tête de fiche affiché depuis l'index, données des fiches allégées. |

### Mineurs

| # | Constat | Capture | Décision |
|---|---|---|---|
| m1 | « Traduction non officielle · voir le texte original » sur chaque description : bruit visuel. | `08-fiche-pnj` | **refaire** : mention discrète, original au tap. |
| m2 | Toast « Annuler » de 4 s : court quand on a la manette en main. | — | **refaire** : 5 s. |
| m3 | Sombre seulement si le système est en sombre ; le soir l'écran clair éblouit. | `01-aujourdhui` | **refaire** : thème « Auto (soir) » par défaut : sombre de 19 h à 7 h, sinon comme le système. |
| m4 | Puces de filtre qui défilent hors écran sans indice (musée, journal). | `15-musee` | **garder** le défilement, ajouter un fondu de bord. |
| m5 | Rang de la ville et Mines : pages utiles mais peu consultées, rangées comme des domaines. | `24-rang` | **garder**, dans le catalogue de Chercher (« Guides »). |
| m6 | Page interne `#/design` exposée dans les réglages. | `28-design` | **garder** (outil de conception), lien discret en bas des réglages. |
| m7 | Numéro de version de l'app absent ; aucune information après mise à jour. | `23-plus` | **refaire** : version dans les réglages, écran « Nouveautés » une fois. |

## 4. Évaluation heuristique (Nielsen + HIG)

| Heuristique | Constat v1 | Suite v2 |
|---|---|---|
| Visibilité de l'état | Horloge de jeu persistante, pastilles « Maintenant » : bon. Synchro silencieuse. | Indicateur de synchro et auteur des coches. |
| Correspondance avec le jeu | Noms FR en titre, saisons, journal en grille : bon. | Verdict garder/vendre dans le vocabulaire du joueur. |
| Contrôle et liberté | Toast « Annuler » sur les coches. | 5 s, partout (y compris saisie rapide). |
| Cohérence | Une seule fiche, lignes repliables homogènes. Deux points d'entrée (Explorer/Recherche) et trois pages en doublon. | Une entrée, aucune page doublon. |
| Prévention des erreurs | Confirmation seulement pour supprimer un profil. Synchro destructive (B1). | Fusion clé par clé, export avant migration. |
| Reconnaissance plutôt que rappel | Icônes du jeu partout. | Grille de saisie calquée sur le journal. |
| Flexibilité | Appui long, glisser pour cocher. | Saisie rapide pour les experts. |
| Esthétique et minimalisme | Fiches longues mais repliées. Mentions répétées (m1). | Badges d'usage en tête, le reste replié. |
| Aide | Textes d'aide courts. | Écran « Nouveautés » unique. |
| HIG : une main, cibles ≥ 44 px | Barre d'onglets et recherche au pouce, cibles conformes. | Conserver ; 4 onglets. |

## 5. Qualité des données

| Point | Constat | Décision |
|---|---|---|
| Version du jeu | Données Fandom au 17/10/2026, jeu 1.3 (18/06/2026). coral.guide indique « v1.3-1247 » : même version. La 1.4 « Kids Grow Up » est annoncée pour l'hiver, non publiée. | garder ; recontrôler à la sortie de la 1.4 |
| coral.guide | Code public sur GitHub (`koenigderluegner/coral-island-guide`) **sans licence** (tous droits réservés), données extraites des fichiers du jeu. | ne pas importer (licence absente) ; servi seulement à confirmer la version |
| Couverture | 3 002 entités sur 3 168 pages Fandom de contenu, écart 0 (307 exclusions justifiées). | garder |
| Images | 150 entités sans image (5 %), surtout quêtes (81) et guides (61), qui n'en ont pas sur le wiki. | garder ; pictogramme de domaine en repli |
| Obtention | 26 entités sans méthode d'obtention, marquées « à vérifier ». | garder (signalées) |
| Noms FR | 394 noms officiels (13 %), 2 458 traductions non officielles affichées en titre. | garder ; import des noms officiels depuis le PC Steam toujours prévu |
| Recoupement | coralisland.wiki (CC0) : 1 788 valeurs comparées, 1 608 concordantes ; 208 conflits consignés. | garder |
| Apparitions | Recontrôle complet du 19/10 : créneaux datés corrects ; deux corrections (carabe, bulot). | corrigé en v1 |
| Carte | 64 lieux et 298 fiches placés ; Allée des jardins et zone intermédiaire de plongée sans repère sur la carte du wiki. | garder |

## 6. Technique

| Mesure (v1) | Aujourd'hui | Fiche d'habitant |
|---|---:|---:|
| Lighthouse performance | 94 | 90 |
| Accessibilité | 100 | 100 |
| Bonnes pratiques | 100 | 100 |
| FCP / LCP | 2,0 s / 2,7 s | 2,0 s / 3,3 s |
| Poids transféré | 320 Ko | 828 Ko |

- **PWA** : Lighthouse 12 n'a plus de catégorie PWA. Contrôle direct : service worker, précache de 99 fichiers, mode avion 11/11 (`scripts/qa/offline.ts`).
- **Erreurs console** : aucune en usage normal. Dans un navigateur sans interface, le CDN du wiki refuse parfois les images en mode CORS (protection anti-robots) : l'app retombe sur le chargement simple.
- **Images** : vignettes du CDN à 2× la taille d'affichage ; carte de l'île en 2 000 px (une seule image, mise en cache).

## 7. Résultats v2

Mesures du 20/10/2026 sur la build de production (`v2.0.0`), Chrome sans interface, 390 px.

### Les 10 questions (`npm run qa:questions`)

| # | Question | Taps v1 | Taps v2 | Temps v2 | Où |
|---|---|---:|---:|---:|---|
| 1 | Attraper ou récolter maintenant, ce qui me manque | 6+ | **0** | 0,0 s | Aujourd'hui › Manquant et disponible maintenant |
| 2 | Ce qui manque au musée, par catégorie | 3 | 3 | 0,2 s | Collections › Musée › Manquants |
| 3 | Ce qui manque au temple, autel par autel | 2 | 2 | 0,2 s | Collections › Temple |
| 4 | Garder ou vendre | 2 + lecture | **2** (verdict visible dès le résultat) | 0,4 s | Chercher › résultat |
| 5 | Où et quand trouver un objet | 2 | 2 | 0,4 s | Chercher › fiche › Où et quand |
| 6 | Ce qu'aime un villageois, où il est | 3 + défilement | **2** | 0,1 s | Habitants › ligne |
| 7 | Anniversaires et festivals | 0 | 0 | 0,0 s | Aujourd'hui › Cette semaine |
| 8 | Magasins ouverts | 0–1 | 0 | 0,1 s | Aujourd'hui › Boutiques |
| 9 | Que planter | 0 | 0 | 0,1 s | Aujourd'hui › À planter |
| 10 | Ce que le partenaire a coché | impossible | **0** | 0,1 s | Aujourd'hui › Récemment |

### Constats traités

| # | Statut v2 |
|---|---|
| B1 Synchro destructive | corrigé : un gist par joueur, fusion clé par clé ; 18/18 au test à deux joueurs (`npm run qa:progress`), conflit et ETag compris |
| B2 Question 10 | corrigé : auteur et heure sur chaque coche, fil « Récemment », pastille du partenaire |
| B3 Migration | corrigé : sauvegarde v1 intégrale puis conversion ; 401/401 coches conservées en navigateur réel (`npm run qa:migration`), 9/9 tests unitaires (`npm test`) |
| M1 Garder ou vendre | fait : verdict et badges d'usage (fiche et résultats) |
| M2 Manquant maintenant | fait : liste unique sur Aujourd'hui |
| M3 Explorer / Recherche | fusionnés dans Chercher |
| M4 Habitants, Cadeaux | onglet Habitants, pages Cadeaux supprimées |
| M5 Rentabilité | page supprimée (liste des cultures et Aujourd'hui) |
| M6 Améliorations | page supprimée (fiches magasin et outil) |
| M7 Session | module d'Aujourd'hui |
| M8 Saisie rapide | fait (`#/collections/<id>/saisie`) |
| M9 Performance | onglets 95–97 ; fiches 93–95 (voir ci-dessous) |
| m1 Mention de traduction | remplacée par « Texte original », discret |
| m2 Toast | 5 s |
| m3 Sombre le soir | thème « Soir » par défaut |
| m4 Puces hors écran | gardé (défilement horizontal) |
| m5 Rang, Mines | catalogue de Chercher |
| m6 Page /design | lien discret dans les réglages |
| m7 Version, Nouveautés | faits |

### Lighthouse (mobile, 4G lente simulée)

| Écran | Performance | Accessibilité | Bonnes pratiques |
|---|---:|---:|---:|
| Aujourd'hui | 96 | 100 | 100 |
| Chercher | 97 | 100 | 100 |
| Collections | 96 | 100 | 100 |
| Habitants | 96 | 100 | 100 |
| Saisie rapide | 96 | 100 | 100 |
| Fiche poisson (lien direct) | 94 | 100 | 100 |
| Fiche lieu (lien direct) | 93–95 | 100 | 73–100 |
| Fiche habitant (lien direct) | 88–94 | 100 | 73–100 |

- **Performance des fiches ouvertes par lien direct** : 93–95 hors habitants, 88–94 pour un habitant (la liste de 137 habitants se calcule derrière la fiche). Gain par rapport à la v1 (84–90) : un fichier par fiche préchargé dès le HTML, en-tête rendu d'abord, liste par tranches, carte en 1 600 px et en priorité basse. Objectif de 95 atteint sur tous les onglets, pas encore sur toutes les fiches ouvertes par lien.
- **Bonnes pratiques à 73 sur certaines fiches** : uniquement quand le CDN du wiki (Cloudflare) applique sa protection anti-robots au navigateur de test (cookie `__cf_bm`, CORS refusé) ; la même fiche mesure 100 quand le CDN répond normalement. Ce n'est pas lié au code de l'app (décision D24).
- **Hors ligne** : 13/13 (`npm run qa:offline`) ; Lighthouse 12 n'a plus de catégorie PWA.
- **Défilement** (CPU ×4) : 60 i/s sur 9 écrans, 58 i/s sur la saisie rapide du musée (350 vignettes décodées en défilant).
- **Fiches** : 108/108 rendues sans erreur (`scripts/qa/fiches.ts`).

### Captures avant / après

`reports/audit/v1/<thème>/<nom>.jpg` (avant) et `reports/audit/v2/<thème>/<nom>.jpg` (après), mêmes noms de fichiers. Nouveaux écrans v2 : `29-saisie-rapide`, `30-chercher-bois`. Écrans supprimés (pas d'équivalent v2) : `16-ameliorations`, `20-outil-cultures`, `21-cadeaux`, `22-cadeaux-scott`, `25-session`. Comparaison illustrée dans la page d'audit privée.
