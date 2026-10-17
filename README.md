# Coral Wiki

Wiki compagnon hors ligne de **Coral Island** (Stairway Games), pensé pour smartphone (PWA).
Contenu repris du [Coral Island Wiki (Fandom)](https://coralisland.fandom.com) sous licence CC BY-SA, complété et recoupé avec d'autres sources. Images © Stairway Games, chargées depuis le CDN Fandom (non copiées dans le dépôt).

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
| Images manquantes (recherche par préfixe) | `scripts/fetch-extra-images.ts` | fusion dans `.cache/images.json` |
| Classification, extraction, relations, FR, contrôles, zod | `scripts/build-data.ts` + `scripts/build/*` | `src/data/` |

Relance incrémentale : `fetch.ts` rafraîchit l'inventaire (`lastrevid`) et ne retélécharge que les pages modifiées ; `--force` pour tout reprendre.

### Données produites (`src/data`)

- Un fichier par domaine (`cultures.json`, `poissons.json`, `pnj.json`…), entités au format `Entity` de `src/data/schema.ts` (validé par zod).
- `articles/<domaine>.json` : contenu complet des pages (titres, paragraphes, listes, tableaux) avec liens `[[id|libellé]]`.
- `search.json` (recherche/listes), `aujourdhui.json` (écran Aujourd'hui : anniversaires, festivals, conditions de capture, cultures, horaires des boutiques), `suivi.json` (événements de cœur, lieux des objets suivis), `temple.json`, `musee.json`, `rang.json`, `mines.json`, `meta.json` (version du jeu), `conflits.json` (divergences entre sources, valeur retenue, raison).
- Liens inverses générés : `utilise_dans`, `aime_par`, `extra.vendu_par`, `extra.obtenu_de`, `extra.produit_par`, `extra.offrandes`, `extra.don_musee`, `extra.requis_pour`, `extra.debloque_par`.

### Apparitions, améliorations, icônes

- **Apparitions** (`scripts/build/spawn.ts`) : une condition par zone (saisons, fenêtres de jours, heures, météo), lue dans les différentes écritures de l'infobox (portées par saison dans « location », par zone dans « season/time/weather », colonnes « ✓ (Mine only) »).
- **Améliorations** (`relations.ts` → `extra.stock[].materiaux`, `extra.ameliorations_qualite`) : or, matériaux, durée, rang, limite ; page `#/ameliorations`.
- **Icônes officielles** (`scripts/build/icons.ts`) : icônes de carte du jeu pour les lieux sans photo, icônes d'interface (météo, qualité, or, cœurs, sac) via `src/data/icones.json`, chargées depuis le CDN du wiki avec repli SVG.

### Règles

- Valeur inconnue → champ listé dans `a_verifier`, jamais inventée.
- Prix par qualité absents → calculés avec la formule du wiki (×1,15 / ×1,3 / ×1,5 / ×2).
- Nom FR : wiki Fandom FR (appariement par empreinte de données, alignement manuel des titres dans `scripts/i18n/fr-alignement.json`) ou Steam ; sinon nom EN (`nom_fr_source: "en"`).
- Conflits tranchés par une source tierce : `scripts/i18n/verifications.json`.

### Traductions FR (non officielles)

- Mémoire de traduction `scripts/i18n/fr/*.json` : clé = empreinte du texte EN (`scripts/i18n/tm.ts`). Une valeur `"="` signifie « identique en FR » (nom propre).
- Un texte modifié sur le wiki change d'empreinte : il réapparaît dans `scripts/i18n/todo/<lot>.tsv` au build suivant.
- Les noms traduits ne remplacent jamais le nom affiché : ils deviennent un alias de recherche (`nom_fr_alias`). Les descriptions traduites sont marquées `description_lang: "fr-trad"` et l'app propose le texte original.
- Les articles complets du wiki restent en anglais (affichés repliés sur chaque fiche).

### Progression du joueur (`src/app/store.ts`)

- IndexedDB `coral-wiki` : un document par profil `{ date, weather, hour, checks, favs }`, écriture différée 300 ms (forcée quand l'onglet passe en arrière-plan).
- Clés de suivi : `pris:<id>`, `musee:<id>`, `temple:<offrande>:<objet>`, `cuisine:<id>`, `coeur:<pnj>:<cœurs>-<n>`, `succes:<id>`. Les mêmes clés servent aux trackers, aux fiches et à l'écran Aujourd'hui.
- Semaine en jeu : chaque saison de 28 jours commence un lundi.

### Sauvegarde et synchronisation (`src/app/sync.ts`)

- Export / import d'un fichier JSON (`{ app: "coral-wiki", version: 1, profiles }`). L'import fusionne par défaut (la version la plus récente de chaque profil gagne) ou remplace tout.
- Synchronisation optionnelle via un **Gist privé** (`coral-wiki.json`) : jeton GitHub **classic** avec le seul scope `gist` (les jetons fine-grained n'ont pas accès aux Gists et sont refusés avec un message explicite). Le jeton reste dans IndexedDB sur l'appareil et n'est envoyé qu'à `api.github.com`.

### Contrôles qualité

```bash
npm run build && npx vite preview --port 4174   # dans un autre terminal
npm run qa:offline    # SW, précache, mode avion : navigation + recherche
node scripts/qa/fiches.ts   # 4 fiches par domaine + pages spéciales : erreurs JS, rendu
npm run qa:progress   # profils, export/import, synchro Gist (API GitHub simulée)
node scripts/qa/compare.ts  # échantillon de 30 fiches : infobox source ↔ app
```

Comparaison manuelle de 30 fiches : [`reports/comparaison-30.md`](reports/comparaison-30.md).

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`, avec `BASE_PATH=/<nom-du-repo>/` (sinon écran blanc). Dans le dépôt : *Settings → Pages → Source : GitHub Actions*. Les données (`src/data`) sont versionnées : le pipeline (`npm run data`) tourne en local, pas en CI.

Rapport de couverture : [`reports/coverage.md`](reports/coverage.md).
