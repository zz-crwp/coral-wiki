# Comparaison manuelle de 30 fiches avec la source

Date : 17/10/2026 · Échantillon tiré au hasard avec une graine fixe, réparti sur 18 domaines (`node scripts/qa/compare.ts`). Pour chaque fiche, l'infobox Fandom brute a été relue à côté des valeurs de l'app (`reports/comparaison-30-brut.md`). Les champs vérifiés sont les saisons, la météo, les horaires, les lieux, les prix par qualité, la croissance et la repousse, l'obtention, l'anniversaire et l'image.

**Résultat** : 30/30 fiches sans valeur fausse sur les données clés. 6 défauts de présentation ou de traduction sont corrigés dans le pipeline, donc sur toutes les fiches concernées, pas seulement sur l'échantillon. Une incohérence vient de la source elle-même et est signalée.

| # | Fiche | Domaine | Verdict | Remarque |
|---|---|---|---|---|
| 1 | Strawberry seeds | cultures | ✔ conforme | 10 j, repousse 4 j, printemps, rang D, prix ×qualité OK |
| 2 | Pine tree | arbres | ✔ corrigé | « Pousse à partir de Pine tree » (auto-référence : *Pine cone* redirige vers *Pine tree*) → supprimé |
| 3 | Rose hip | cueillette | ✔ conforme | Hiver, 3 lieux, offrande « Sesajen d'hiver » |
| 4 | Buffalo milk | élevage | ✔ conforme | |
| 5 | Great white shark | poissons | ✔ corrigé | Fenêtre « Été 1–14 » affichée en anglais et ignorée par « Aujourd'hui » → traduite et prise en compte (4 poissons concernés) |
| 6 | Eastern black swallowtail | insectes | ✔ conforme | Nuit 19h–2h, pluie/orage, 5 lieux |
| 7 | Blue lobster | créatures marines | ✔ conforme | 10–20 m, automne/hiver |
| 8 | Clay vessel | minéraux | ✔ corrigé | Obtention en double (« Coffret orné » brut + lien) et « Fabriqué » trompeur → doublons retirés, « Dupliqué avec Slime of replication » |
| 9 | Pickled sweet potato | artisanat | ⚠ source | L'infobox indique 6 h, le tableau de recette 7 h : incohérence du wiki, les deux valeurs restent affichées. Doublon d'obtention corrigé |
| 10 | Peyek | cuisine | ✔ corrigé | « Cuisine » brut en double de « Cuisiné (voir recette) » → retiré |
| 11 | Lembus | pnj | ✔ conforme | Animal mythique, la ferme (fiche ébauche sur le wiki) |
| 12 | Cabanon balnéaire | lieux | ✔ conforme | 9h–17h, fermé le mardi (pris en compte dans « Boutiques ouvertes ») |
| 13 | Festival of the Sun | festivals | ✔ conforme | Supplément (notes 1.3 de Stairway) : horaires, activités et image marqués « à vérifier » |
| 14 | Filet à insectes | outils | ✔ conforme | Améliorations 2 000 / 5 000 / 10 000 / … or |
| 15 | Water Slime | monstres | ✔ corrigé | PV affichés deux fois (« Santé » et « PV ») → un seul |
| 16 | Town Rank F | quêtes | ✔ conforme | Description absente à la source → « à vérifier » |
| 17 | Bois dur | ressources | ✔ conforme | |
| 18 | Brontosaurus skin | objets | ✔ corrigé | Doublon « Cabane vide » retiré, achat 15 000 or conservé |
| 19 | Jackfruit seedling | cultures | ✔ conforme | 2×2, été/automne, 10 j / 4 j |
| 20 | Orange | arbres | ✔ conforme | Maturité 28 j, repousse 4 j, printemps, rang C |
| 21 | Daffodil | cueillette | ✔ conforme | 7 lieux |
| 22 | Large buffalo milk | élevage | ✔ conforme | |
| 23 | Boxfish | poissons | ✔ conforme | Après-midi, soir et nuit → 12h–2h |
| 24 | Man-faced stink bug | insectes | ✔ conforme | |
| 25 | Hermit crab | créatures marines | ✔ conforme | 20–30 m, toute l'année |
| 26 | Rusty spear | minéraux | ✔ corrigé | Doublons « Coffret » et « Marché noir » retirés |
| 27 | Olive jam | artisanat | ✔ corrigé | « Fabriqué (voir recette) » redondant avec « Produit par Bocal Mason » → retiré |
| 28 | Pommes de terre rissolées | cuisine | ✔ conforme | Nom FR officiel (empreinte prix, santé, énergie) |
| 29 | Paul | pnj | ✔ corrigé | « Photographe animalière » pour un homme (traduction partagée avec Anne) → accord au genre (`scripts/i18n/genre-fr.json`), « Marié(e) » → « Marié » / « Mariée » |
| 30 | Bath House | lieux | ✔ conforme | Ouvert 24 h. L'image est le portrait du propriétaire (pas de photo du lieu sur le wiki), signalé |

## Corrections appliquées à tout le jeu de données

- **Obtention** : une source brute de l'infobox est retirée quand une ligne liée la couvre déjà (achat, machine, butin). Une recette par *Slime of replication* devient « Dupliqué avec … ».
- **Auto-références** : `graine` et `donne` ne pointent plus vers la fiche elle-même.
- **Poissons à fenêtre de jours** (gator gar, giant stingray, great white shark, hammerhead) : la fenêtre est stockée (`extra.jours_saison`), affichée en français et utilisée par l'écran « Aujourd'hui ».
- **Accord au genre** des emplois partagés (Paul, Denali, Dinda, Surya) et de la situation familiale.
- **Monstres** : la valeur PV n'apparaît plus deux fois.
