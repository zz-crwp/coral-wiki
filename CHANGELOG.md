# Journal des versions

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [2.2.0] — 2026-10-24

### Modifié
- **Design plus sobre (règles des écrans d'app)** : carte du jour en aplat lagon profond, sans dégradé ni ombres de texte ; titres d'écran à 28 px ; libellés des onglets à 11 px ; bordures plus discrètes en thème sombre ; chiffres alignés partout ; catégories de Chercher sur deux colonnes, plates.

### Corrigé
- Fiches des graines et plants : la culture qu'ils donnent n'apparaît plus dans « Utilisé dans » (elle reste dans « Donne »). 98 fiches concernées.
- Page blanche possible après un déploiement quand l'app restait ouverte : rechargement automatique à chaque nouvelle version (au plus une fois toutes les 10 s), y compris quand c'est le morceau de la page elle-même qui a disparu.

### Ajouté
- `npm run qa:relations` : audit des liens entre fiches (3 002 fiches : 0 lien cassé, 0 relation à sens unique).

## [2.1.0] — 2026-10-20

### Modifié
- **Jouer à plusieurs avec un seul compte GitHub** : le même jeton sur chaque téléphone, juste un prénom par joueur. Plus de gist par joueur ni de lien à échanger : l'app retrouve toute seule le gist commun, qui contient un fichier par joueur.
- **Plus d'heure à régler** : seuls le jour et la météo se changent (jour précédent / suivant sur Aujourd'hui). Tout est calculé pour la journée, avec la plage horaire de chaque chose : captures (« 6h – 19h »), boutiques (horaires du jour), habitants (leur journée heure par heure).
- Les filtres « Maintenant » deviennent « Aujourd'hui » (anciens liens acceptés).

### Supprimé
- Réglage de l'heure (+1 h, curseur) et appairage par lien de gist.

## [2.0.0] — 2026-10-20

Version pensée pour jouer à deux sur console, téléphone en main : chacune des 10 questions de joueur se règle en 3 taps et 10 secondes au plus (scénarios automatisés). Détails dans `AUDIT.md`, `DESIGN-V2.md` et `DECISIONS.md`.

### Ajouté
- **Jouer à deux** : chaque joueur relie son compte GitHub ; l'app range ses coches dans son gist secret (`progress.json`), lit celui du partenaire et fusionne clé par clé (la plus récente gagne). Musée, temple, journal et recettes sont communs ; cadeaux, cœurs, succès et paliers restent personnels. Envoi groupé 5 s après une coche, lecture au retour dans l'app avec ETag.
- **Récemment** : fil des dernières coches des deux joueurs, avec l'auteur et le moment ; initiale du partenaire sur ses coches.
- **Verdict À GARDER / VENDABLE** sur chaque résultat de recherche et en tête de fiche, avec les usages : musée (manquant ou donné), offrandes du temple, quêtes, adoré par, recettes, améliorations.
- **Manquant et disponible maintenant** sur Aujourd'hui : captures pas encore prises à l'heure, la météo et le jour de jeu, coche en un tap ; objets de saison attendus au temple.
- **Saisie rapide** : grille d'icônes comme le journal du jeu, un tap par objet, pour rattraper une progression existante.
- Filtre **Disponible maintenant** dans les collections.
- Onglet **Habitants** (où il est, anniversaire, cadeaux de la semaine, cœurs).
- Prénom du joueur, version de l'app et sauvegardes automatiques dans Réglages ; écran **Nouveautés** affiché une fois après la mise à jour.
- Thème **Soir** par défaut (sombre de 19 h à 7 h).
- Scénarios des 10 questions, tests de fusion et de migration, test de synchro à deux (`scripts/qa/`).

### Modifié
- Barre d'onglets : Aujourd'hui, **Chercher**, **Collections**, **Habitants** (au lieu d'Aujourd'hui, Explorer, Progression, Session + bouton Recherche). Les anciennes adresses redirigent.
- **Chercher** devient un onglet : champ au-dessus de la barre, résultats dès la 1re lettre, catalogue quand le champ est vide.
- Progression stockée par marque `{ état, horodatage, auteur }` ; base IndexedDB en version 2, migrée sans perte (copie de sécurité v1 conservée).
- Export / import au format v2 (les fichiers v1 sont acceptés) ; l'import fusionne les coches une à une au lieu de garder le profil le plus récent.
- Toast « Annuler » de 5 s ; coches écrites immédiatement.
- Fiches : chargées depuis un petit fichier par fiche, en-tête affiché d'abord ; listes longues rendues par tranches ; police des titres préchargée. Lighthouse performance : onglets 96–97, fiches 93–95.

### Supprimé
- Onglets Explorer et Session (fusionnés dans Chercher et Aujourd'hui).
- Pages Rentabilité des cultures, Cadeaux, Cadeaux par habitant et Améliorations (doublons des listes et des fiches).
- Articles anglais complets des fiches (sauf guides) : lien vers la source à la place.
- Code et styles morts (5 fonctions, 70 règles CSS), dépendance `@fontsource-variable/fredoka`.

### Corrigé
- La synchronisation écrasait la progression de l'autre joueur (fusion par profil entier).
- Une coche faite juste avant de fermer l'app pouvait être perdue (écriture différée).

## [1.0.0] — 2026-10-19

Première version publique : wiki hors ligne installable (PWA), données du Coral Island Wiki (Fandom, CC BY-SA) recoupées avec coralisland.wiki (CC0), fiches en sheet, horloge de jeu, lignes repliables par domaine, collections et trackers, cartes du wiki, noms FR en titre, synchronisation Gist d'une sauvegarde.
