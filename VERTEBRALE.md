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



