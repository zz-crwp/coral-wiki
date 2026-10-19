# Décisions v2

Choix faits pendant la v2 sans demander, en prenant l'option la plus simple pour le joueur. Chaque ligne dit ce qui a été décidé et pourquoi.

## Architecture et contenu

| # | Décision | Pourquoi |
|---|---|---|
| D1 | Quatre onglets : Aujourd'hui, Chercher, Collections, Habitants (l'architecture proposée par le brief, confirmée par l'audit). | Explorer doublait la recherche (M3), Session était presque toujours vide (M7), les habitants n'avaient pas d'entrée (M4). |
| D2 | « Ma session » devient un module d'Aujourd'hui, affiché seulement s'il y a des épingles. | Un onglet entier pour une liste souvent vide coûtait une place de la barre. |
| D3 | Rang de la ville et Mines restent, rangés dans le catalogue de Chercher. | Infos uniques, consultées rarement : pas de place dans la barre. |
| D4 | Supprimés : Rentabilité des cultures, Cadeaux (deux pages), Améliorations, articles anglais complets hors guides. | Doublons des listes et des fiches (M4, M5, M6) ; articles longs remplacés par le lien vers la source. |
| D5 | Habitants montre aussi animaux de compagnie et ondins ; le filtre « Habitants » restreint aux villageois. | Une seule liste, un filtre plutôt qu'un écran de plus. |
| D6 | Verdict : **À GARDER** si l'objet manque au musée ou au temple, ou s'il est demandé par une quête ; sinon **VENDABLE** s'il a un prix ; sinon pas de verdict. | Les quêtes ne sont pas suivies dans l'app : un objet de quête reste « à garder » (prudence). Cadeau adoré et recettes nuancent sans changer le verdict. |
| D7 | « Manquant et disponible maintenant » compte les captures (poissons, insectes, créatures) non encore prises, plus les objets de saison attendus par une offrande du temple pas encore faite. | La cueillette n'a pas de journal : seul le temple dit qu'elle « manque ». |
| D8 | L'écran « Nouveautés » ne s'affiche pas au tout premier lancement (rien à annoncer), seulement après une mise à jour. | Le brief demande une présentation après la mise à jour. |
| D9 | Thème par défaut « Soir » : sombre de 19 h à 7 h (heure réelle), sinon comme le système. Options : Système, Clair, Sombre, OLED. | « Mode sombre par défaut le soir » sans imposer le sombre en journée. |

## Progression et synchro

| # | Décision | Pourquoi |
|---|---|---|
| D10 | Clés **communes** : musée, temple, journal des prises, recettes. **Personnelles** : cadeaux de la semaine, événements de cœur, succès, paliers d'outils, cœurs, horloge de jeu. | Le brief cite musée et temple ; le journal et les recettes suivent la même logique de collection. Cadeaux et cœurs dépendent de chaque joueur. |
| D11 | Décocher écrit une marque datée `{ s: 0 }` au lieu d'effacer la clé. | Sinon une coche plus ancienne de l'autre joueur réapparaîtrait à la fusion. |
| D12 | Égalité d'horodatage : on départage par auteur, puis par état. Une nouvelle marque locale a toujours un horodatage strictement supérieur à celle qu'elle remplace. | Résultat identique quel que soit l'ordre d'arrivée ; « Annuler » gagne toujours. |
| D13 | Un gist par joueur pour **une** partie : celle qui est active au moment de la connexion. | Le cas d'usage est une partie en coop ; plusieurs parties synchronisées compliqueraient l'appairage. |
| D14 | Appairage : on colle le lien **ou** l'identifiant du gist du partenaire ; l'app vérifie qu'il contient une progression Coral Wiki. | Le plus simple à échanger par message. |
| D15 | Les coches sont écrites immédiatement dans IndexedDB (plus d'écriture différée de 300 ms), ainsi que les relectures du partenaire. | Les tests ont montré qu'une coche suivie d'une fermeture immédiate pouvait être perdue. |
| D16 | Export automatique avant migration : copie intégrale des profils v1 dans le magasin IndexedDB `sauvegardes`, téléchargeable depuis Réglages › Sauvegarde. | Un navigateur bloque un téléchargement sans geste de l'utilisateur ; la copie locale est garantie. |
| D17 | Les confirmations restent pour les actes destructifs : supprimer un profil, importer en remplacement, se déconnecter de la synchro. Aucune pour les coches. | « Aucune boîte de confirmation » vise les coches ; ces trois actes ne s'annulent pas par un toast. |

## Technique

| # | Décision | Pourquoi |
|---|---|---|
| D18 | Scénarios et captures avec **Puppeteer** (déjà en place, Chrome du système) plutôt que Playwright. | Même rôle, sans télécharger de navigateurs supplémentaires. |
| D19 | **coral.guide** n'est pas importé. | Son dépôt GitHub (`koenigderluegner/coral-island-guide`) n'a pas de licence (tous droits réservés) et ses données viennent des fichiers du jeu. Il sert seulement à confirmer la version couverte (1.3-1247). |
| D20 | Les captures d'audit restent hors du dépôt public et sont publiées dans la page d'audit privée. | Elles contiennent des illustrations du jeu (© Stairway Games). |
| D21 | Une fiche = un petit fichier `e/<id>.json` généré au build, non précaché ; hors ligne, repli sur le fichier du domaine (précaché). | La fiche d'un habitant ouverte par lien attendait 535 Ko ; pas de doublon dans le cache hors ligne. |
| D22 | Police Fredoka auto-hébergée (`public/fonts`, licence OFL jointe) et préchargée ; la dépendance npm est retirée. | Le grand titre est l'élément LCP des onglets. |
| D23 | Listes longues rendues par tranches (24 lignes, puis 30 à chaque temps libre) ; sections de fiche sous la ligne de flottaison rendues au premier temps libre. | Temps de blocage de la fiche d'habitant : 500 ms → ~100 ms. |
| D24 | « Bonnes pratiques » Lighthouse : mesuré à 100 sur les onglets ; sur les fiches, il dépend du CDN du wiki, qui applique parfois sa protection anti-robots au navigateur de test (cookie `__cf_bm`, CORS refusé). Les images de carte sont chargées en CORS anonyme (pas de cookie tiers) avec repli. | Ne dépend pas du code de l'app ; détaillé dans AUDIT.md. |
| D25 | Tag `v1.0.0` posé sur `3007a4b`, dernier déploiement de la v1. La v2 est développée sur la branche `v2`, fusionnée dans `main` pour le déploiement. | GitHub Pages déploie depuis `main`. |
| D26 | Des copies « … 2.json » créées par la synchronisation iCloud du Bureau dans `src/data` ont été déplacées hors du projet (copies identiques ou plus anciennes). | Elles cassaient le build. |
