# Coral Wiki

Wiki compagnon hors ligne de **Coral Island** (Stairway Games), pensé pour smartphone (PWA).
Contenu repris du [Coral Island Wiki (Fandom)](https://coralisland.fandom.com) sous licence CC BY-SA, complété et recoupé avec d'autres sources. Images © Stairway Games, chargées depuis le CDN Fandom (non copiées dans le dépôt).

**Version 2.1.0** — en ligne sur https://zz-crwp.github.io/coral-wiki/ · [Journal des versions](CHANGELOG.md) · [Audit](AUDIT.md) · [Conception v2](DESIGN-V2.md) · [Décisions](DECISIONS.md)

## Installation

```bash
git clone https://github.com/zz-crwp/coral-wiki.git && cd coral-wiki
npm install
npm run dev        # http://localhost:5173/coral-wiki/
npm run build      # typecheck + build de production dans dist/
```

Node 22 ou plus récent (les scripts sont en TypeScript exécuté directement par Node). Les données sont versionnées dans `src/data` : pas besoin de relancer le pipeline pour développer.

Sur téléphone : ouvrir le site dans Safari (ou Chrome), puis « Ajouter à l'écran d'accueil ». L'app fonctionne ensuite hors ligne.

## Jouer à plusieurs

La progression commune passe par **un seul compte GitHub pour la maison**, sans serveur et sans rien échanger entre joueurs : chaque téléphone utilise le même jeton, chaque joueur n'a qu'un prénom.

1. Une fois pour toutes, créer un jeton GitHub **classic** avec le seul scope `gist` sur le compte commun : [créer un jeton](https://github.com/settings/tokens/new?scopes=gist&description=Coral%20Wiki). Les jetons « fine-grained » ne donnent pas accès aux gists et sont refusés.
2. Sur le premier téléphone : Réglages › Jouer à plusieurs, saisir son prénom, coller le jeton, « Connecter ». L'app crée un gist secret « Coral Wiki — progression commune » au premier envoi.
3. Sur chaque autre téléphone : son prénom, le **même** jeton, « Connecter ». L'app retrouve le gist commun toute seule ; les autres joueurs apparaissent dans les réglages.

Le gist contient un fichier par joueur (`joueur-<id>.json`) : chaque téléphone n'écrit que le sien et lit tous les autres. Musée, temple, journal des prises et recettes sont communs ; cadeaux de la semaine, cœurs, succès et paliers d'outils restent propres à chacun. Chaque coche garde son auteur et son heure ; en cas de désaccord, la plus récente gagne, clé par clé. Les coches partent 5 s après la dernière et quand l'app passe en arrière-plan ; l'app relit le gist au retour au premier plan. Le jeton reste sur chaque téléphone (IndexedDB) et n'est envoyé qu'à `api.github.com`. Sans jeton, l'app est complète en solo.

## Sauvegarde, export, import

- Réglages › Sauvegarde › **Exporter** : fichier JSON avec tous les profils (format v2).
- **Importer** : fusion par défaut (coches fusionnées une à une, rien n'est perdu) ou remplacement complet. Les fichiers exportés par la v1 sont acceptés.
- Lors du passage à la v2, une **copie de sécurité** de la progression v1 est gardée dans l'app : Réglages › Sauvegarde › « Sauvegarde automatique du … ».

## Application

- **Navigation** : 4 onglets — Aujourd'hui (`#/`), Chercher (`#/chercher`, listes `#/chercher/<domaine>`), Collections (`#/collections`, saisie rapide `#/collections/<id>/saisie`), Habitants (`#/habitants`). Réglages derrière l'engrenage d'Aujourd'hui (`#/reglages`). Les adresses de la v1 redirigent.
- **Verdict et usages** (`src/app/usage.ts`, `Usage` dans `Fiche.tsx`) : À GARDER si l'objet manque au musée ou au temple ou sert à une quête, sinon VENDABLE ; résumé d'usage dans l'index de recherche.
- **Jour de jeu** : puce persistante en haut des écrans (jour, saison, météo), réglage en sheet. Pas d'heure à régler : l'app raisonne à la journée et affiche la plage horaire de chaque chose (captures, boutiques, emploi du temps des habitants).
- **Fiches en sheet** (`?f=<id>` sur n'importe quelle page) : crans moyen / plein, glisser pour fermer, panneau latéral à partir de 960 px. Les anciens liens `#/fiche/<id>` ouvrent la liste du domaine avec la fiche par-dessus.
- **Lignes repliables par domaine** (`src/app/rows.tsx`, composant `src/ui/XRow.tsx`) : repliée, la ligne répond à la question du joueur ; glisser pour cocher (toast « Annuler »), appui long pour le menu (épingler, fiche, source).
- **Système de design** : jetons dans `src/design/tokens.css` (gris système, palette extraite des visuels du jeu, saisons, rayons, ombres, durées), composants dans `src/design/components.css` et `src/ui/`. Thèmes clair, sombre et noir OLED ; Fredoka réservée aux grands titres ; icônes Lucide. Page interne `#/design` avec tous les composants et états.
- **Préférences de l'appareil** (`src/app/prefs.ts`) : thème, écran maintenu allumé (Wake Lock).

## Pipeline de données (`/scripts`)

```bash
npm run data:fetch   # API MediaWiki EN + FR, succès Steam (≈ 15 min la 1re fois, puis incrémental)
npm run data:build   # normalisation → src/data/*.json + reports/coverage.md (≈ 2 s)
```

| Étape | Script | Sortie |
|---|---|---|
| Inventaire + wikitext + catégories + images (1 req/s, User-Agent explicite, cache brut) | `scripts/fetch.ts` | `.cache/pages/<ns>/*.json`, `.cache/images.json` |
| Wiki Fandom FR (noms et descriptions FR du jeu) | `scripts/fetch-fr.ts` | `.cache/fr/` |
| Succès officiels Steam EN + FR, guide Steam anniversaires/cadeaux | `scripts/fetch-steam.ts` | `.cache/steam/` |
| Seconde source coralisland.wiki (CC0) : export XML manuel (Cloudflare) déposé dans `imports/`, réduit en extrait versionné | `scripts/import-wiki2.ts` | `scripts/sources/coralisland-wiki.json` |
| Images manquantes (recherche par préfixe) | `scripts/fetch-extra-images.ts` | fusion dans `.cache/images.json` |
| Classification, extraction, relations, FR, contrôles, zod | `scripts/build-data.ts` + `scripts/build/*` | `src/data/` |

Relance incrémentale : `fetch.ts` rafraîchit l'inventaire (`lastrevid`) et ne retélécharge que les pages modifiées ; `--force` pour tout reprendre.

### Données produites (`src/data`)

- Un fichier par domaine (`cultures.json`, `poissons.json`, `pnj.json`…), entités au format `Entity` de `src/data/schema.ts` (validé par zod).
- `articles/<domaine>.json` : contenu complet des pages (titres, paragraphes, listes, tableaux) avec liens `[[id|libellé]]`.
- `search.json` (recherche/listes), `aujourdhui.json` (écran Aujourd'hui : anniversaires, festivals, conditions de capture, cultures, horaires des boutiques), `suivi.json` (événements de cœur, lieux des objets suivis), `temple.json`, `musee.json`, `rang.json`, `mines.json`, `meta.json` (version du jeu), `conflits.json` (divergences entre sources, valeur retenue, raison).
- Liens inverses générés : `utilise_dans`, `aime_par`, `extra.vendu_par`, `extra.obtenu_de`, `extra.produit_par`, `extra.offrandes`, `extra.don_musee`, `extra.requis_pour`, `extra.debloque_par`.

### Apparitions, cartes, améliorations, icônes

- **Apparitions** (`scripts/build/spawn.ts`) : une condition par zone (saisons, fenêtres de jours, heures, météo), lue dans les différentes écritures de l'infobox (portées par saison dans « location », par zone dans « season/time/weather », colonnes « ✓ (Mine only) », lignes « … (tilling only) »).
- **Cartes** (`scripts/fetch-map.ts`, `scripts/build/map.ts`) : cartes interactives du wiki (île et plongée). Chaque lieu (via `mapid` ou le lien de la bulle) et chaque zone d'apparition (« River (Farm) » → repère « Farm River »…) reçoit ses repères `extra.carte` ; l'app affiche l'extrait de carte cadré (`src/ui/MapView.tsx`), image chargée depuis le CDN du wiki. Chaque zone est aussi liée à sa fiche lieu (`lieux_id`).
- **Améliorations** (`relations.ts` → `extra.stock[].materiaux`, `extra.ameliorations_qualite`) : or, matériaux, durée, rang, limite ; page `#/explorer/ameliorations`.
- **Icônes officielles** (`scripts/build/icons.ts`) : icônes de carte du jeu pour les lieux sans photo, icônes d'interface (météo, qualité, or, cœurs, sac) via `src/data/icones.json`, chargées depuis le CDN du wiki avec repli SVG.

### Fiches autosuffisantes (`scripts/build/context.ts`, `src/app/fiche/context.tsx`)

- Outil, bâtiment, équipement : « Améliorer / Obtenir » (magasin, or, matériaux, durée, ouvert maintenant ?).
- Matériau : « Nécessaire pour » (améliorations et constructions qui le consomment, total).
- Lieu : « À trouver ici » (poissons, insectes, créatures, cueillette, filtre saison).
- « En ce moment » selon la date, la météo et l'heure du profil : boutique ouverte, espèce disponible, culture encore rentable, où se trouve l'habitant (emploi du temps), anniversaire, festival.

### Règles

- Valeur inconnue → champ listé dans `a_verifier`, jamais inventée.
- Prix par qualité absents → calculés avec la formule du wiki (×1,15 / ×1,3 / ×1,5 / ×2).
- Nom FR : wiki Fandom FR (appariement par empreinte de données, alignement manuel des titres dans `scripts/i18n/fr-alignement.json`) ou Steam ; sinon nom EN (`nom_fr_source: "en"`).
- Conflits tranchés par une source tierce : `scripts/i18n/verifications.json`.
- Seconde source coralisland.wiki (`scripts/build/wiki2.ts`) : la valeur la plus récente l'emporte (Fandom, à jour de la 1.3) ; si la seconde source est plus récente et isolée, le champ passe « à vérifier ». Écarts dans `conflits.json`.

### Traductions FR (non officielles)

- Mémoire de traduction `scripts/i18n/fr/*.json` : clé = empreinte du texte EN (`scripts/i18n/tm.ts`). Une valeur `"="` signifie « identique en FR » (nom propre).
- Un texte modifié sur le wiki change d'empreinte : il réapparaît dans `scripts/i18n/todo/<lot>.tsv` au build suivant.
- Les noms traduits (`nom_fr_alias`) sont affichés en titre quand il n'existe pas de nom FR officiel, avec le nom anglais en sous-titre et la mention « nom FR non officiel » sur la fiche ; les deux noms restent cherchables. Les descriptions traduites sont marquées `description_lang: "fr-trad"` et l'app propose le texte original.
- Les articles complets du wiki restent en anglais (affichés repliés sur chaque fiche).

### Progression du joueur (`src/app/store.ts`)

- IndexedDB `coral-wiki` (version 2) : un document par profil `{ date, weather, hour, prog, partner, session, paliers, coeurs }` ; `prog` = une marque `{ s: 0|1, t, par }` par clé (`src/app/progress.ts` : fusion, migration). Les coches sont écrites immédiatement. Magasin `sauvegardes` : copie v1 faite avant la migration.
- Clés de suivi : `pris:<id>`, `musee:<id>`, `temple:<offrande>:<objet>`, `cuisine:<id>`, `coeur:<pnj>:<cœurs>-<n>`, `succes:<id>`. Les mêmes clés servent aux trackers, aux fiches et à l'écran Aujourd'hui.
- Semaine en jeu : chaque saison de 28 jours commence un lundi.

### Sauvegarde et synchronisation (`src/app/sync.ts`)

- Export / import d'un fichier JSON (`{ app: "coral-wiki", version: 2, player, profiles }`, v1 accepté).
- Jeu à plusieurs : un gist secret commun au compte, un fichier par joueur (`joueur-<id>.json` : `{ version: 2, player, partie, progress }`), fusion clé par clé ; voir « Jouer à plusieurs ».

### Contrôles qualité

```bash
npm test              # fusion de la synchro (ordre d'arrivée indifférent) et migration v1 → v2, en Node
npm run build && npx vite preview --port 4174   # dans un autre terminal, puis :
npm run qa:questions  # les 10 questions du joueur en 390 px : taps comptés (≤ 3) et temps (≤ 10 s)
npm run qa:progress   # profils, export/import, jeu à plusieurs (API GitHub simulée : compte commun, 2 joueurs, conflit, ETag)
npm run qa:migration  # base IndexedDB v1 réelle → v2 : aucune coche perdue, copie de sécurité
npm run qa:offline    # SW, précache, mode avion : onglets, recherche, fiche, coche
node scripts/qa/fiches.ts   # 4 fiches par domaine + pages : erreurs JS, rendu
node scripts/qa/scroll.ts   # fluidité du défilement, CPU ralenti ×4
node scripts/qa/screens.ts  # captures 390 px clair/sombre → reports/audit/v2/
node scripts/qa/compare.ts  # échantillon de 30 fiches : infobox source ↔ app
TEXT=26 node scripts/qa/shot.ts light aujourdhui=#/   # texte agrandi : signale tout débordement horizontal
```

Comparaison manuelle de 30 fiches : [`reports/comparaison-30.md`](reports/comparaison-30.md).

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`, avec `BASE_PATH=/<nom-du-repo>/` (sinon écran blanc ; valeur par défaut `/coral-wiki/` dans `vite.config.ts`). Dans le dépôt : *Settings → Pages → Source : GitHub Actions*. Les données (`src/data`) sont versionnées : le pipeline (`npm run data`) tourne en local, pas en CI.

Rapport de couverture : [`reports/coverage.md`](reports/coverage.md).

## Retour arrière vers la v1

La v1 reste disponible sous le tag `v1.0.0`. Pour la remettre en ligne :

```bash
git switch main
git revert --no-edit v1.0.0..v2.0.0   # crée des commits qui annulent la v2, sans réécrire l'historique
git push                              # GitHub Pages redéploie la v1
```

Côté joueurs : après la v2, la base IndexedDB est en version 2 et la v1 ne peut plus l'ouvrir. Avant le retour arrière, exporter la progression depuis la v2 (Réglages › Exporter : le fichier contient aussi les coches au format v1) ; une fois la v1 en ligne, effacer les données du site dans le navigateur, puis Réglages › Importer ce fichier. Pour seulement consulter la v1 en local : `git switch --detach v1.0.0 && npm ci && npm run dev`.
