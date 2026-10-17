# Reprise sur le PC où Coral Island est installé (Steam)

Brief pour la session Claude Code qui reprendra le projet sur le PC. La session précédente s'est déroulée sur un Mac sans le jeu. Répondre à l'utilisateur **en français**.

## État au 17/10/2026

- App en ligne : https://zz-crwp.github.io/coral-wiki/ (dépôt `zz-crwp/coral-wiki`, déploiement GitHub Pages par Actions à chaque push sur `main`).
- Jalons 1 à 5 terminés : pipeline wiki → `src/data`, PWA hors ligne, fiches, trackers, Aujourd'hui, calendrier, outils, profils, export/import, synchro Gist. Voir `README.md`, `reports/coverage.md` et `reports/comparaison-30.md`.
- L'utilisateur joue sur **PS5** : une progression n'est donc pas importable depuis une sauvegarde PC.

## Mise en route sur le PC

```bash
gh auth login --web --scopes workflow      # compte zz-crwp
gh repo clone zz-crwp/coral-wiki
cd coral-wiki
npm ci
npm run data:fetch   # recrée le cache brut du wiki (.cache, non versionné, ≈ 15 min la 1re fois)
npm run data:build
npm run dev
```

Node ≥ 24 requis : les scripts `.ts` tournent directement grâce au type stripping de Node.

## Demandes de l'utilisateur à traiter depuis le PC

1. **Apparitions précises** des poissons, insectes et créatures marines. Le wiki ne donne que des créneaux grossiers (matin 6–12, après-midi 12–16, soir 16–19, nuit 19–2), des zones approximatives et aucune probabilité. Cibles : heures exactes, zones exactes, météo, saisons, jours (fenêtres des poissons légendaires), rareté.
2. **Noms français officiels** de tous les objets, PNJ, lieux, etc. Aujourd'hui, seuls 13 % viennent d'une source officielle ; les autres sont en anglais avec un alias FR non officiel (`nom_fr_alias`).
3. **Améliorations par magasin**, par exemple au Labo : la liste des améliorations avec prix et matériaux, présentée magasin par magasin.
4. **Icônes manquantes** à combler (fiches et écrans sans image).
5. **Disposition inspirée de l'interface du jeu**, pour une lecture plus simple en jouant : journal de pêche et d'insectes, écran d'amélioration chez un marchand, calendrier. L'utilisateur ne fournira pas de captures PS5 : retrouver les structures dans les fichiers du jeu (widgets d'interface, textures) et dans les captures publiques (page Steam, wiki).

## Piste technique (faisabilité à vérifier en premier)

- Coral Island est un jeu Unreal Engine. Les données sont dans les `.pak` du dossier d'installation Steam (`…\steamapps\common\Coral Island\…\Content\Paks`).
- Outils de lecture : FModel (interface) ou CUE4Parse, ou un équivalent en ligne de commande. Il faut connaître la version d'Unreal du jeu et savoir si les paks sont chiffrés (clé AES). **Ne pas contourner de protection** : si les paks sont chiffrés et qu'aucune clé n'est publiée par la communauté, s'arrêter et en parler à l'utilisateur.
- À chercher : les DataTables de poissons, insectes et créatures (spawn), de boutiques et d'améliorations, d'objets ; les textes FR (`.locres`, culture `fr`) ; les widgets du journal et des boutiques (structure de mise en page seulement).
- Produire un script reproductible `scripts/fetch-game.ts` qui lit un export JSON (fait par l'outil) et l'écrit dans `.cache/game/`. Le brancher ensuite dans `scripts/build-data.ts` comme **source de priorité 1** pour les champs couverts. Les écarts avec le wiki vont dans `conflits.json` (valeur retenue : celle du jeu, source « fichiers du jeu, version x.y »).

## Règles à respecter

- **Images** : ne pas copier d'images extraites du jeu dans le dépôt public (© Stairway Games). Les illustrations restent chargées depuis le CDN Fandom. Les textures du jeu peuvent servir à identifier une icône manquante (nom de fichier), puis on cherche ce fichier sur le wiki.
- Pas de valeur inventée : `a_verifier`, `conflits.json` et sources par fiche, comme pour le reste du pipeline.
- Garder `meta.json` à jour : version du jeu lue sur le PC (actuellement 1.3 ; la 1.4 « Kids Grow Up » est annoncée).
- Contrôles avant livraison : `npm run typecheck`, `npm run build`, `npm run qa:offline`, `node scripts/qa/fiches.ts`, `npm run qa:progress`, Lighthouse ≥ 90.
- Commit et push seulement quand l'utilisateur le demande.
