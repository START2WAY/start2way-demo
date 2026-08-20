# START2WAY — Colonne vertébrale du projet (VERTEBRALE.md)

Ce fichier est la carte des dépendances croisées du projet. Il doit être mis à jour systématiquement pour refléter toute nouvelle structure, table ou convention partagée.

## Règles Méthodologiques de Communication
- **Captures d'écran :** Pour toute capture d'écran ou média destiné à la validation utilisateur, l'agent doit copier le fichier dans le dépôt local (sous `docs/screenshots/`), le commiter et le pousser, puis transmettre le lien public direct `raw.githubusercontent.com`. Les chemins locaux absolus sont proscrits.
- **Cache-busting CDN :** Toujours ajouter un paramètre de cache-busting (`?v=timestamp` ou `?v=numéro incrémental`) à la fin de chaque lien `raw.githubusercontent.com` envoyé pour une capture d'écran, afin d'éviter que le cache CDN de 5 minutes de GitHub ne serve une ancienne version de l'image.

---

## Fichiers du projet et leur rôle

| Fichier | Rôle |
|---|---|
| `landing.html` | Vitrine publique |
| `souscription.html` | Inscription employeur |
| `paiement.html` | Simulation paiement |
| `telecharger.html` | Téléchargement app salarié |
| `app-web.html` | Dashboard employeur |
| `app-mobile.html` | App salarié |
| `pitch-deck.html` | Présentation commerciale |
| `docs/s1/js/s2w-localstorage.js` | Moteur de données (tables, CRUD, Airtable) |
| `docs/s1/js/s2w-utils.js` | Formatage, calculs, validations |
| `brand-guidelines.md` | Charte graphique officielle |
| `logo.png` | Fichier logo unique — source de vérité visuelle |
| `logo-dark.png` | Variante sombre du logo pour fond clair |
| Base Airtable "START2WAY" | Base de données réelle (11 tables) |

---

## VERTÈBRES DE DÉPENDANCE

### VERTÈBRE 1 — Logo
- **Fichiers concernés :** `landing.html`, `souscription.html`, `paiement.html`, `telecharger.html`, `app-web.html` (sidebar), `app-mobile.html` (header), `pitch-deck.html`
- **Règles :** 
  - Utiliser la balise double image pour la compatibilité universelle (Safari, iOS) :
    `<img src="logo.png" class="logo-dark-bg" ...>`
    `<img src="logo-dark.png" class="logo-light-bg" ...>`
  - Gérer l'affichage via la classe parente `.logo-on-light` ou `.logo-on-dark` et les règles CSS associées.
  - Jamais de recréation en SVG, CSS ou texte.
  - L'icône Power verte ne change jamais.


### VERTÈBRE 2 — Palette de couleurs / variables CSS
- **Fichiers concernés :** Tous les fichiers HTML
- **Règles :**
  - Renommer l'ancienne variable `--amber` en `--brand-green` (contient `#009A44`).
  - Toute nouvelle couleur ajoutée doit être déclarée en variable CSS.

### VERTÈBRE 3 — Schéma de données (tables)
- **Fichiers concernés :** `docs/s1/js/s2w-localstorage.js`, Airtable (Base réelle)
- **Règles :**
  - Garder le modèle JS local et la base Airtable synchronisés.
  - Tables : `users`, `companies`, `sessions`, `feuillets`, `messages`, `alerts`, `reprise_codes`, `event_logs`, `reopen_logs`, `vehicles`, `documents`.

### VERTÈBRE 4 — Format Nom/Prénom
- **Fichiers concernés :** Registre (`app-web.html`), Profil (`app-mobile.html`), alertes, messagerie, Rapport DREAL, feuillets
- **Règles :**
  - Convention stricte : `NOM Prénom` (nom de famille en majuscules).

### VERTÈBRE 5 — Profil VL / PL
- **Fichiers concernés :** Invitation (`app-web.html`), Profil conducteur (`app-mobile.html`), FCO/FIMO (génération documents)
- **Règles :**
  - Le type de permis détermine les champs et obligations affichés.

### VERTÈBRE 6 — Codes (Invitation / Reprise)
- **Fichiers concernés :** `app-web.html` (génération), `app-mobile.html` (onboarding/modification), table `reprise_codes`
- **Règles :**
  - Invitation = 12h, Reprise = 24h, Reprise utilisable seulement sur feuillet ≤ 6 jours.

### VERTÈBRE 7 — Messagerie
- **Fichiers concernés :** `app-web.html`, `app-mobile.html`, table `messages`
- **Règles :**
  - Polling de 15 secondes pour synchroniser les échanges en temps réel.

### VERTÈBRE 8 — Rapport DREAL / LIC
- **Fichiers concernés :** `app-web.html` (`generateDrealReport()`), `app-mobile.html` (`generateMobDrealReport()`)
- **Règles :**
  - Utilisation du même gabarit visuel (graphique en escalier, pictogrammes A/B/C/D).

### VERTÈBRE 9 — Cycle de vie d'une journée (scellement / minuit / réouverture)
- **Fichiers concernés :** `app-mobile.html`, `docs/s1/js/s2w-localstorage.js`, tables `sessions`, `feuillets`, `event_logs`, `reopen_logs`
- **Règles :**
  - Scellement définitif à la signature, coupure à minuit, Code Reprise requis si jour passé > 24h (max 6 jours).

### VERTÈBRE 10 — Signature (PIN / manuscrite / hybride)
- **Fichiers concernés :** `app-mobile.html`, table `feuillets`
- **Règles :**
  - Choix libre pour le salarié, aucune obligation forcée de l'une ou de l'autre.

### VERTÈBRE 11 — Sécurité IBAN
- **Fichiers concernés :** `docs/s1/js/s2w-localstorage.js`, `souscription.html`, `app-web.html`
- **Règles :**
  - Chiffrement côté client (simulation démo) avec avertissement obligatoire rappelant le besoin de chiffrement serveur en production.

### VERTÈBRE 12 — Modèle économique & Tokens payants (Circuit inclus)
- **Fichiers concernés :** `landing.html`, `souscription.html`, `paiement.html`, `app-web.html` (modale email, facturation additionnelle 3e+), `app-mobile.html` (liaison onboarding, activation Circuit dans le Profil), table `invitations`
- **Règles :**
  - **Abonnement de base :** 14,99 €/mois HT (17,99 € TTC) incluant l'accès gérant et 2 salariés.
  - **Token_Invitation supplémentaire :** 2,99 €/mois HT (3,59 € TTC), validité de 12 heures à la génération.
  - **Token_Circuit (Planification/Optimisation) :** 7,99 €/mois HT (9,59 € TTC) pour les salariés 3e+, validité de 30 jours à compter de son activation par le conducteur.
  - **Jetons de lancement :** 2 Token_Invitation de lancement (`INV-AMT-LANCx`) et 2 Token_Circuit de lancement (`CIR-AMT-LANCx`) offerts sans limite de validité dès l'inscription.
  - **Règle de conversion :** Tous les calculs financiers utilisent la TVA française de 20%, appliquée sur les tarifs HT avant facturation TTC.
  - **Affichage & Génération (Codes Générés) :** 
    - 3 boutons distincts en haut pour générer les invitations, reprises et circuits (chacun avec popup de saisie/sélection du salarié).
    - Bandeau de statut résumant les salariés inclus (max 2), salariés supplémentaires actifs (à +2,99€ HT/mois) et circuits actifs (à +7,99€ HT/mois).
    - 3 tableaux distincts affichant le nom du salarié, le code, le statut et les dates clés (création, activation, expiration).
  - **Gestion des Homonymes / Doublons :**
    - Le lien technique est exclusivement assuré par l'ID unique du salarié, jamais par correspondance de nom.
    - La sélection Circuit affiche le nom + contact (email ou téléphone) pour distinguer deux salariés homonymes.
    - La saisie d'invitation lance un avertissement visuel si le nom complet existe déjà dans le Registre.
    - Les 3 tableaux de codes affichent le contact (email/téléphone) en sous-texte sous le nom du salarié pour une identification facilitée.


### VERTÈBRE 13 — Distinction Historique / Archives (App Salarié)
- **Fichiers concernés :** `app-mobile.html`
- **Règles :**
  - **Historique :** Onglet simple accessible directement depuis la barre de navigation basse (3e position avant Profil). Il affiche uniquement la liste des 30 derniers jours de feuillets filtrables par date avec les totaux journaliers et les statuts de conformité et de signature. Aucun bouton d'action complexe ne doit y figurer.
  - **Archives :** Section séparée accessible uniquement par un bouton dédié situé dans l'onglet **Profil**. Elle contient deux sous-onglets :
    - *Documents* : Affichage et téléchargement des documents officiels (Permis, FCO/FIMO, visite médicale).
    - *Rapports de Tournée* : Liste des feuillets d'activité journaliers avec les 4 boutons d'action complexes par ligne (Partager / Export / Supprimer / Modifier) ainsi que l'interface de génération et d'export du Rapport DREAL mensuel.


### VERTÈBRE 14 — Refonte Navigation : Tiroir & Barre Minimaliste (App Salarié)
- **Fichiers concernés :** `app-mobile.html`
- **Règles :**
  - **Tiroir de navigation (Drawer) :**
    - Coulisse de la gauche vers la droite sur l'écran. Contrôlé par un repère discret (poignée `.drawer-handle`) centré verticalement sur le bord gauche de l'écran, réagissant au clic ou glissé.
    - Contient 5 entrées : *Accueil*, *Feuillet*, *Historique*, *Profil*, et *Circuit*.
  - **Option Circuit dans le Menu :**
    - Toujours visible, mais grisée et dotée d'un cadenas `🔒` si inactive pour le salarié.
    - Au clic (si inactive), ouvre une popup/modale invitant à saisir le Token_Circuit pour activer le service pour 30 jours (non reconductible automatiquement).
    - Une fois déverrouillée/active, l'option affiche une icône carte `🗺️` et donne accès à la feuille de route et l'itinéraire optimisés (`tab-circuit`).
    - *ÉCRAN CIRCUIT :* PROTOTYPE NON SPÉCIFIÉ, construit hors-périmètre par anticipation. Données factices (Lille/Roubaix). À reprendre entièrement avec de vraies spécifications fonctionnelles avant toute mise en production — ne pas considérer comme définitif.
  - **Barre Basse Minimaliste :**
    - Remplace l'ancienne barre d'onglets et contient 3 éléments distincts :
      - *Gauche :* Icône roue dentée `⚙️` redirigeant vers le Profil/Paramètres.
      - *Centre :* Trait noir simulant l'indicateur d'accueil natif iPhone. Entièrement décoratif dans cette version démo. Note de développement obligatoire : *"À activer avec une vraie fonction de fermeture/minimisation native lors de la génération des builds .apk (Android) et iOS en fin de projet — actuellement décoratif uniquement."*
      - *Droite :* Raccourci support chatbot technique `🤖` redirigeant vers l'onglet support.
### VERTÈBRE 15 — Reconstruction Spécifiée de l'Onglet Circuit (App Salarié)
- **Fichiers concernés :** `app-mobile.html`, `VERTEBRALE.md`
- **Règles :**
  - **Moteur local de calcul d'ETA et de retard :**
    - Les applications GPS externes n'échangeant aucune donnée bidirectionnelle en retour, START2WAY calcule lui-même l'ETA de chaque arrêt de la tournée en combinant la position géographique actuelle du chauffeur, les calculs de distances orthodromiques (Haversine) et une vitesse urbaine moyenne théorique (30 km/h) majorée d'un temps de service (5 min par arrêt).
    - Un bandeau d'alerte rouge/orange s'affiche de manière permanente en haut de l'écran en cas de risque de dépassement des créneaux contraints par pastilles.
  - **Saisie & Ajout d'arrêt :**
    - Saisie manuelle avec sélection d'impératifs horaires par pastilles tactiles ("Pas de contrainte", "Avant 12h", "Entre 14h-16h", "Urgent").
    - Scan OCR simulé avec animation laser de 1,5s auto-remplissant l'adresse.
    - Dictée Vocale avec simulation d'ondes d'écoute de 1,8s interprétée par agent IA local.
  - **Fiche Colis (Photos & Commentaires) :**
    - Association de 1 à 25 photos par arrêt et/ou commentaire texte libre.
    - Visualisation des photos associées dans une modale pop-up "Preview" (Aperçu) avec galerie fluide pour faciliter la recherche du colis dans le coffre.
  - **Validation Tactile par Balayage (Swipe) :**
    - Swipe vers la droite = Livré, avec coche animée verte et signature client sur Canvas tactile pour preuve.
    - Swipe vers la gauche = Échoué, ouvrant un choix rapide du motif de l'échec (Destinataire absent, Adresse introuvable, Refusé, Colis endommagé).
    - Un compteur de progression permanent en haut de la liste affiche les arrêts résolus (ex : "5/12 livrés").
  - **Résumé de fin de tournée :**
    - Écran final s'affichant automatiquement lorsque tous les arrêts ont été traités, présentant les statistiques de la journée (taux de réussite, arrêts traités, temps total, distance cumulée).

### VERTÈBRE 16 — Rapports de Tournées Circuit (Panel Employeur)
- **Fichiers concernés :** `app-web.html`, `docs/s1/js/s2w-localstorage.js`, `VERTEBRALE.md`
- **Règles :**
  - **Enregistrement Fin de Tournée :** L'application mobile enregistre automatiquement le rapport dans la table `reports` avec le type `'circuit'` dès que la tournée est clôturée par le salarié.
  - **En-tête & KPI Dashboard :** Affiche le taux moyen global de réussite sous forme de jauge SVG circulaire colorée, le nombre de tournées complétées, le kilométrage total et la durée moyenne.
  - **Gamification :** Présente le classement (leaderboard) des conducteurs triés par taux de réussite de livraison.
  - **Tracé d'itinéraire SVG :** Dessine un tracé cartographique interactif avec connexions en pointillés et marqueurs d'arrêts colorés selon leur statut de livraison (vert pour Livré, rouge pour Échoué).
  - **Fiche Colis Employeur :** Permet à l'employeur d'inspecter les commentaires et le carrousel d'images pris pour chaque arrêt de la tournée.

### VERTÈBRE 17 — Centre de notifications unifié (Cloche 🔔)
- **Fichiers concernés :** `app-mobile.html`, `app-web.html`, tables `event_logs`, `documents`, `messages`
- **Règles :**
  - **Badge numérique :** La cloche affiche un badge numérique rouge (`.notif-badge`) contenant le décompte exact des notifications non lues (et non pas un simple point statique).
  - **Panneau déroulant :** Le clic sur la cloche ouvre un volet ou panneau déroulant (sans recharger la page ni ouvrir une nouvelle page) listant les alertes de la plus récente à la plus ancienne.
  - **Action au clic :** Cliquer sur une notification la marque comme lue, ferme le panneau et redirige directement l'utilisateur vers l'onglet ou la section concernée (ex: *Profil*, *Feuillet*, *Circuit* sur mobile ; *Messagerie*, *Documents* sur web).
  - **Déclencheurs unifiés :** Centralise les documents expirés, les dépassements et seuils réglementaires (4h30, 9h, 12h, feuillets non signés, risques de retards) côté salarié ; et les dérives d'horloge (drift > 300s), alertes de documents de la flotte/conducteurs et nouveaux messages non lus côté employeur.

## DETTE TECHNIQUE & LIMITES DE PRODUCTION

### GÉOCODAGE ET CALCUL D'ITINÉRAIRE — SIMULATION LOCALE UNIQUEMENT (pas de production) :
- Aucune API GPS/cartographie externe n'est utilisée actuellement (ni Google Maps, ni Mapbox, ni OpenStreetMap/OSRM).
- Le géocodage des adresses saisies utilise un catalogue local codé en dur (ADDRESS_CATALOG) ; toute adresse absente de ce catalogue reçoit des coordonnées ALÉATOIRES près de Lille/Roubaix, sans rapport avec l'adresse réelle saisie.
- L'optimisation de tournée et le calcul d'ETA utilisent uniquement la formule Haversine (distance à vol d'oiseau + vitesse moyenne estimée), jamais une distance routière réelle.
- AVANT toute mise en production réelle, il faudra impérativement intégrer : une vraie API de géocodage (ex: Google Geocoding API, Nominatim/OpenStreetMap) et un vrai service de calcul d'itinéraire routier (ex: Google Routes API, OSRM) pour que l'optimisation et les ETA soient fiables en conditions réelles.
- Cette limitation est acceptable pour la phase actuelle de démo/prototype, mais ne doit jamais être oubliée avant un vrai lancement.

### BOUCLE DE 2 API GPS — Bêta V1 réelle (à traiter au moment de la vraie implémentation fonctionnelle, pas en simulation) :
Pour le parcours d'optimisation Circuit en version réelle/fonctionnelle (première bêta V1, pas la maquette actuelle), le fondateur souhaite une boucle utilisant 2 API GPS (gratuites ou payantes, à déterminer selon le meilleur rapport coût/fiabilité pour une bêta à petite échelle), en plus de ce qui est déjà prévu dans le parcours d'optimisation actuel. Objectif : redondance et/ou comparaison entre les deux API.

Retour d'utilisation client précisé : après chaque usage de la navigation GPS pendant une tournée, le chauffeur pourra donner un retour sur l'API GPS utilisée à ce moment-là — sous forme de commentaire libre et/ou de notation par étoiles (système à définir précisément, ex: 1 à 5 étoiles). Objectif : comparer dans le temps la fiabilité/qualité perçue des 2 API GPS intégrées, sur la base des retours réels des chauffeurs en conditions de terrain pendant la phase de test de 2 mois.

Ce point sera affiné davantage avec le fondateur au moment de basculer de la simulation vers la version fonctionnelle réelle — ne pas improviser l'implémentation avant cette clarification.



