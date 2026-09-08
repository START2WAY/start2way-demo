# START2WAY — VERTEBRALE.md

## VERSION 2 — BASELINE PRODUIT & TECHNIQUE ACTUELLE

Ce fichier contient uniquement les invariants actuels de START2WAY.

Il ne sert PAS de journal historique.

Il ne doit pas contenir :

* anciennes décisions,
* prototypes abandonnés,
* comptes rendus de bugs,
* captures d’écran,
* détails de tests passés,
* simulations devenues obsolètes,
* dette cosmétique.

---

# 0 — ORDRE D’AUTORITÉ

Pour l’agent Antigravity :

1. instruction explicite de la tâche actuellement donnée par l’utilisateur ;
2. règles de ce `VERTEBRALE.md` ;
3. code et architecture actuels du dépôt ;
4. anciennes documentations uniquement comme historique.

Si une ancienne documentation contredit ce fichier :

**VERTEBRALE.md prévaut.**

Si la tâche dit READ ONLY :

**aucune écriture n’est autorisée.**

READ ONLY interdit notamment :

* modification fichier,
* création fichier,
* commit,
* push,
* déploiement,
* modification DB,
* modification Airtable,
* modification GCP.

---

# 1 — RÈGLES DE TRAVAIL DE L’AGENT

START2WAY doit être livré rapidement en V1 commercialisable.

L’agent ne doit jamais élargir spontanément le scope.

## Pour chaque tâche

Faire uniquement :

1. comprendre la demande ;
2. inspecter les éléments strictement nécessaires ;
3. appliquer la correction demandée ;
4. effectuer un test réel ciblé ;
5. STOP.

## Interdictions

Ne jamais créer spontanément :

* `implementation_plan.md`
* `walkthrough.md`
* `task.md`
* framework de test
* script d’audit général
* nouvelle architecture
* dépendance supplémentaire

sauf demande explicite.

Ne jamais transformer :

* un contrôle en refactor,
* un audit en correction,
* une correction en audit global.

## Limite de tentatives

Maximum :

**2 corrections sur le même problème.**

Après 2 échecs :

```text
BLOCKER :
...

EXACT ERROR :
...

DECISION NEEDED :
...
```

Puis STOP.

---

# 2 — LES 6 COUCHES TECHNIQUES

START2WAY possède actuellement 6 couches devant rester cohérentes :

1. Repository local
2. GitHub `main`
3. Cloud Build
4. Cloud Run
5. Cloud SQL PostgreSQL
6. Airtable Mirror

Chaîne de référence :

```text
LOCAL
→ GITHUB
→ CLOUD BUILD
→ CLOUD RUN
→ CLOUD SQL
→ AIRTABLE MIRROR
```

Une modification d’une couche ne doit pas casser le contrat avec la suivante.

---

# 3 — SOURCE DE VÉRITÉ DES DONNÉES

## Production

La source centrale de vérité est :

**Cloud SQL / PostgreSQL**

Airtable n’est PAS la base principale.

Airtable est uniquement :

**un miroir asynchrone downstream.**

Une panne Airtable ne doit jamais :

* supprimer les données centrales,
* rendre Airtable autoritaire,
* provoquer un rollback de la donnée Cloud SQL valide.

---

# 4 — DAL & POSTGRESQL

PostgreSQL est l'unique moteur de base de données START2WAY.
Cloud SQL héberge PostgreSQL en production.
Aucun fallback SQLite n'est supporté.

Attention particulière :

PostgreSQL utilise des opérations asynchrones.

Tout appel DAL PostgreSQL retournant une Promise doit être correctement `await`.



---

# 5 — IDENTITÉ UTILISATEUR

Un `User` représente l’identité personnelle START2WAY.

Un utilisateur peut exister sans entreprise.

Un utilisateur peut être rattaché à plusieurs entreprises.

Le rattachement professionnel est représenté par :

**Employment**

Relation canonique :

```text
User
→ Employment
→ Company
```

Interdit d’utiliser :

```text
user.company_id
```

comme unique autorité métier.

---

# 6 — EMPLOYMENT / MULTI-ENTREPRISE

Un utilisateur peut avoir plusieurs `Employment`.

Un seul contexte professionnel peut être actif à un instant donné.

Le changement d’entreprise est interdit pendant :

* activité en cours,
* session de travail incompatible,
* autre état métier bloquant défini.

Les données professionnelles doivent rester rattachées à leur :

`employment_id`

d’origine.

Un changement d’entreprise ne doit jamais réattribuer rétroactivement les anciennes données.

---

# 7 — TIMEZONE

Autorité timezone :

```text
Employment
→ Company
→ company.timezone
```

Les sessions professionnelles doivent capturer :

`business_timezone`

Les objets journaliers doivent capturer leur :

`business_date`

et leur timezone métier lorsque nécessaire.

Une nouvelle session professionnelle doit échouer si aucune timezone métier valide ne peut être déterminée.

---

# 8 — LIC / JOURNÉE DE TRAVAIL

START2WAY est un service LIC numérique.

La journée métier doit préserver :

* chronologie,
* activités,
* pauses,
* véhicule,
* employment,
* timezone,
* événements.

Les données validées ne doivent pas être détruites pour simuler une réouverture.

## Minuit

La journée doit être clôturée automatiquement selon la timezone métier.

## Réouverture le même jour

Une reprise le même business day doit continuer la journée correspondante sans destruction de l’historique.

## J+1

Un feuillet précédent nécessitant une signature peut bloquer le démarrage d’un nouveau service selon la règle métier actuelle.

---

# 9 — SIGNATURE DU FEUILLET

La signature intervient seulement après :

* fermeture de la journée,
* sauvegarde centrale confirmée,
* absence d’activité encore active.

Ne jamais considérer un feuillet signé comme modifiable librement.

---

# 10 — HISTORIQUE SALARIÉ

Dans l’application salarié, l’historique professionnel exposé est :

**les feuillets journaliers archivés.**

Ne pas créer d’historique salarié autonome pour :

* Expéditions,
* Circuit.

Les données peuvent exister techniquement en base sans devenir un écran historique salarié.

---

# 11 — VÉHICULES

Le véhicule utilisé appartient au contexte professionnel actif.

Les règles de sélection et changement doivent respecter :

* Company,
* Employment,
* disponibilité,
* session active,
* usage en cours.

Le changement de véhicule ne doit pas casser :

* la session,
* l’Expédition,
* la chronologie.

---

# 12 — EXPÉDITION

Expédition et Circuit sont deux concepts différents.

Une Expédition :

* est liée au contexte professionnel,
* peut survivre à un changement de véhicule,
* peut traverser minuit selon les règles métier existantes,
* ne termine pas automatiquement la session ou l’activité.

Une Expédition active peut bloquer `CLOCK_OUT`.

Ne jamais fusionner Expédition et Circuit.

---

# 13 — CIRCUIT — DÉFINITION OFFICIELLE

Circuit est un service personnel optionnel pour le chauffeur.

L’entreprise ne construit PAS la tournée Circuit du salarié.

Le chauffeur crée lui-même son Circuit :

* au dépôt,
* sur quai,
* avant sa tournée,
* à partir de ses propres adresses.

START2WAY optimise ensuite ces arrêts.

---

# 14 — CIRCUIT — ENTITLEMENT

Le code :

`CIR-XXXX...`

sert uniquement à activer le droit d’utilisation du service Circuit.

Il ne représente PAS :

* une mission,
* une tournée entreprise,
* une liste d’adresses,
* un Employment.

L’entitlement Circuit est :

**User-scoped**

et non Company-scoped.

Il survit :

* aux changements d’entreprise,
* aux multiples Employments.

---

# 15 — CIRCUIT — DURÉE

La durée d’un entitlement Circuit est calculée à partir de :

`activated_at`

en ajoutant le nombre de jours du mois calendrier d’activation.

Exemples :

```text
septembre → +30 jours
octobre → +31 jours
février 2027 → +28 jours
février 2028 → +29 jours
```

Ne pas revenir à la règle :

“expire à la fin du mois courant”.

---

# 16 — CIRCUIT — MODÈLE CANONIQUE

Modèle actuel :

```text
User
→ service_entitlements
→ circuit_runs
→ circuit_stops
→ circuit_stop_events
```

Un entitlement peut permettre plusieurs `circuit_runs` successifs pendant sa période active.

---

# 17 — CIRCUIT — SAISIE DES ARRÊTS

Méthodes V1 prévues :

* Manuel
* CSV
* Excel
* OCR photo
* Voix

Toutes les entrées doivent rejoindre une normalisation commune.

Le destinataire et l’adresse sont deux données distinctes.

---

# 18 — CIRCUIT — STATUTS

Statuts canoniques :

```text
TODO
DELIVERED
FAILED
```

Affichage français :

```text
À faire
Livré
Échec
```

Avant de passer à la destination suivante, le chauffeur confirme le résultat de l’arrêt précédent.

Le premier arrêt n’a évidemment aucun arrêt précédent à valider.

---

# 19 — CIRCUIT — PREUVES DE LIVRAISON

Les éléments suivants sont facultatifs sauf future décision contraire :

* note,
* photo,
* signature,
* preuve documentaire.

Ne jamais rendre automatiquement une preuve obligatoire sans instruction explicite.

---

# 20 — CIRCUIT — NAVIGATION

START2WAY n’est pas un GPS turn-by-turn.

Navigation externe prévue :

* Google Maps
* Waze
* Apple Maps

START2WAY calcule et organise la tournée puis peut ouvrir une application externe de navigation.

---

# 21 — CIRCUIT — PIPELINE COMMERCIAL

Pipeline officiel :

```text
raw input
→ deterministic parsing
→ AI quality control
→ human review
→ real geocoding
→ geographic validation
→ real route matrix
→ constraints
→ deterministic optimization
→ AI result audit
→ human final validation
→ external navigation
```

L’IA ne doit jamais être autoritaire pour :

* coordonnées GPS,
* Place ID,
* distances routières,
* durées routières,
* ETA mathématiques,
* ordre optimisé déterministe.

---

# 22 — CIRCUIT — PROVIDERS

Architecture prévue :

* OCR Provider
* Speech Provider
* Geocoding Provider
* Route Matrix Provider
* Optimization Provider
* AI Agent Wrapper

Stack Google actuellement prévue :

* Google Maps Geocoding API
* Google Routes API / ComputeRouteMatrix
* Google Route Optimization API
* Google Cloud Vision
* Google Speech-to-Text

Si un provider réel n’est pas configuré :

retourner explicitement :

`PROVIDER_NOT_CONFIGURED`

Interdit de produire un résultat fictif.

---

# 23 — INTERDICTION DES MOCKS EN PRODUCTION

Sont interdits comme fallback production :

* coordonnées aléatoires,
* catalogue d’adresses codé en dur,
* Lille/Roubaix fictif,
* Haversine présenté comme route réelle,
* faux OCR,
* fausse reconnaissance vocale,
* fausse optimisation,
* faux PASS.

Un mock peut uniquement exister dans un test explicitement identifié comme mock.

---

# 24 — CIRCUIT & ENTREPRISE

Circuit reste un service personnel salarié.

L’entreprise ne doit pas recevoir :

* liste détaillée des adresses Circuit,
* photos personnelles Circuit,
* signatures Circuit,
* contrôle complet de la tournée personnelle.

Une future vue Company pourra uniquement afficher un résumé opérationnel succinct de ses propres salariés, par exemple :

```text
Circuit actif — X/Y arrêts effectués
```

avec éventuellement le nombre d’échecs.

Pas de dispatch Circuit employeur en V1 actuelle.

---

# 25 — AIRTABLE MIRROR

Airtable reçoit des données depuis Cloud SQL via le Mirror Sync.

Flux :

```text
Cloud SQL
→ airtable_mirror_status
→ Airtable API
```

Statuts actuels pertinents :

```text
PENDING
COMPLETED
FAILED_RETRYABLE
FAILED_BLOCKED
```

Un succès réel nécessite que le même objet puisse être retrouvé côté Airtable après synchronisation.

---

# 26 — CONFIGURATION PRODUCTION

Les secrets de production ne doivent jamais provenir d’un `.env` embarqué dans l’image.

Configuration sensible via Secret Manager.

Exemples :

* DATABASE_URL
* AIRTABLE_PAT

Configuration non secrète possible via variables Cloud Run.

Exemples :

* DB_ENGINE
* AIRTABLE_BASE_ID
* AIRTABLE_API_URL

---

# 27 — SECRETS

INTERDICTION ABSOLUE d’afficher :

* PAT,
* mot de passe DB,
* DATABASE_URL complète,
* access token,
* Authorization header,
* private key.

Ne jamais rechercher un secret dans :

* historique shell,
* logs,
* ancien fichier oublié,
* screenshot.

Ne jamais recopier un secret directement dans un script de test.

---

# 28 — GCP

Projet actuel :

`project-0000f1d2-0f56-47e3-bf9`

Région backend principale :

`europe-west1`

Service Cloud Run :

`start2way-backend`

Cloud SQL :

`start2way-postgres`

Database :

`start2way`

Le déploiement production doit rester relié à :

* GitHub,
* Cloud Build,
* Cloud Run.

---

# 29 — BUILD / DEPLOY

Pour une modification produit :

```text
Local
→ commit
→ GitHub main
→ Cloud Build
→ Cloud Run
```

Après déploiement, vérifier uniquement ce qui est nécessaire :

```text
BUILD = SUCCESS
REVISION = READY
TRAFFIC = 100%
```

Pas d’audit supplémentaire si le critère d’acceptation métier est déjà satisfait.

---

# 30 — COLLISION DB LEGACY

Attention à la résolution Node :

```text
server/db.js
server/db/index.js
```

Le backend doit explicitement utiliser le DAL attendu.

Ne jamais réintroduire involontairement une résolution vers l’ancien `server/db.js`.

---

# 31 — SYNCHRONISATION OFFLINE

Le système doit préserver :

* ordre chronologique,
* employment_id,
* opérations offline,
* idempotence,
* conflits de version.

Retry de synchronisation côté application :

environ toutes les 15 secondes selon le mécanisme existant.

Une reconnexion ne doit pas réattribuer une opération à un autre Employment.

---

# 32 — IMMUTABILITÉ MÉTIER

Les objets professionnels historiques restent attachés à :

* leur utilisateur,
* leur Employment,
* leur Company,
* leur business day,
* leur timezone,
* leur contexte d’origine.

Une modification de contexte courant ne doit jamais réécrire l’origine historique d’un objet.

---

# 33 — TESTS

Préférer :

* vrai backend,
* vraie DB,
* vraie API,
* vrai navigateur intégré Antigravity.

Pour les tests UI/E2E :

utiliser le navigateur Chrome intégré à Antigravity.

Ne pas introduire spontanément :

* Puppeteer,
* Playwright,
* jsdom.

Pas de PASS hardcodé.

---

# 34 — PRIORITÉ V1

Classifier tout problème :

## BLOCKING V1

À corriger immédiatement.

## SECURITY / DATA SERIOUS

À corriger immédiatement.

## IMPORTANT NON-BLOCKING

Noter, ne pas interrompre la tâche principale.

## COSMETIC / REFACTOR

Reporter.

La perfection architecturale n’est pas un objectif avant livraison V1.

---

# 35 — DISCIPLINE DE SCOPE

Si une tâche demande de modifier un seul fichier :

ne pas modifier un deuxième fichier sans nécessité directe.

Si une anomalie secondaire apparaît :

```text
NON-BLOCKING DEBT :
...
```

Puis continuer la tâche demandée.

Ne jamais “profiter” d’une tâche pour nettoyer autre chose.

---

# 36 — ARRÊT OBLIGATOIRE

Une fois le critère demandé validé :

**STOP.**

Ne pas :

* chercher un nouveau problème,
* relancer un audit,
* refaire un plan,
* nettoyer des fichiers adjacents,
* optimiser autre chose.

---

# 37 — FORMAT DE RAPPORT PAR DÉFAUT

Rapport court :

```text
START2WAY — TASK RESULT

TASK :
...

CHANGE :
...

REAL CHECK :
...

RESULT :
PASS / FAIL

COMMIT :
...

DEPLOY :
PASS / FAIL / NOT REQUIRED

NON-BLOCKING DEBT :
...

BLOCKER :
...
```

---

# 38 — CE QUI N’EST PLUS AUTORITAIRE

Les anciennes règles suivantes sont explicitement OBSOLÈTES :

* Airtable comme base centrale de vérité.
* `user.company_id` comme rattachement professionnel unique.
* Circuit créé ou dispatché par l’employeur.
* Circuit rattaché à un Employment pour son entitlement.
* Token Circuit expirant obligatoirement à la fin du mois civil.
* Circuit limité à une seule tournée.
* catalogue d’adresses Lille/Roubaix en production.
* coordonnées aléatoires.
* Haversine comme calcul routier commercial.
* faux OCR / fausse voix comme fallback.
* historique salarié détaillé Expédition.
* historique salarié détaillé Circuit.
* rapports Circuit employeur avec adresses/photos/signatures.
* leaderboard employeur Circuit.
* ancienne architecture Airtable-first.
* anciens tests/demo `usr_001`.
* règles historiques de screenshots GitHub obligatoires.
* journalisation de toutes les anciennes corrections dans VERTEBRALE.

---

# 39 — RÈGLE FINALE

`VERTEBRALE.md` contient les invariants.

Il ne raconte pas l’histoire du projet.

Avant toute modification importante, l’agent doit respecter les invariants concernés.

Mais il ne doit PAS relire ou auditer les 39 sections à chaque petite tâche.

Il consulte uniquement les sections pertinentes au scope courant.

**Exécuter précisément. Tester une fois. STOP.**
