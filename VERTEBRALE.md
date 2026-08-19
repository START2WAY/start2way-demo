# START2WAY — Colonne vertébrale du projet (VERTEBRALE.md)

Ce fichier est la carte des dépendances croisées du projet. Il doit être mis à jour systématiquement pour refléter toute nouvelle structure, table ou convention partagée.

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
