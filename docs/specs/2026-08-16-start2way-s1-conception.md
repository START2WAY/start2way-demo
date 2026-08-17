# START2WAY — Spécification S1 : Démo 100% Fonctionnelle

**Date :** 2026-08-16
**Auteur :** Michael Scofield (START2WAY)
**Statut :** ✅ Approuvée — prête pour planification
**Sous-projet :** S1 — Démo HTML auto-suffisante pour rendez-vous commerciaux

---

## Contexte et objectif

START2WAY est un SaaS de remplacement du Livret Individuel de Contrôle (LIC) papier pour les entreprises de transport. Fondé sur les contraintes légales du Code des transports (R3315-1 à R3315-8), il garantit :
- L'horodatage inviolable côté serveur des segments A/B/C/D
- L'intégrité cryptographique (SHA-256) de chaque feuillet
- L'archivage automatique 5 ans (R3315-5)
- La traçabilité complète pour la clause protectrice R3315-8

**Objectif de S1 :** Produire deux fichiers HTML auto-suffisants et un pitch deck interactif, 100% fonctionnels avec localStorage, prêts à être démontrés lors de rendez-vous commerciaux (Phase 1 pilote : AMT Transport).

---

## Périmètre S1 — Livrables

### L1 — `app-web.html` (Dashboard Employeur — complet)

Actuellement : Dashboard + stubs vides pour 5 pages.
Cible : 7 sections navigables + 2 formulaires fonctionnels.

#### Pages à construire

**Page : Registre unique**
- Tableau des salariés avec colonnes : Nom, Prénom, Permis, Statut, Date d'entrée, Actions
- Statuts possibles : `En attente` / `Actif` / `Bloqué` / `Départ enregistré` / `Supprimé`
- Boutons par ligne : Générer Code Invitation, Générer Code Reprise, Enregistrer départ
- Filtres par statut + recherche par nom
- Export CSV/Excel/PDF (simulé avec feedback visuel)
- Données mockées : 12 conducteurs AMT Transport (8 Actifs, 2 Bloqués, 1 Départ, 1 Supprimé)

**Page : Documents**
- Tableau croisé : lignes = salariés + véhicules, colonnes = types de documents
- Types salariés : Permis, FCO/FIMO, Visite médicale
- Types véhicules : Carte grise, Assurance, Contrôle technique
- Badges d'expiration : `Valide` (vert) / `Expire bientôt` (orange, < 30 jours) / `Expiré` (rouge)
- Bouton validation manuelle par l'employeur + dérogation temporaire
- Données mockées : 3 expirés (permis Martin, CT DX-847-AZ, FCO Lefèvre), 2 urgents, 5 à surveiller

**Page : Flotte**
- Liste des véhicules : immatriculation, marque/modèle, poids max, chronotachygraphe (oui/non)
- Documents du véhicule avec badges d'expiration
- Suivi entretien : kilométrage actuel, seuils configurables (vidange, pneus, révision)
- Boutons : Ajouter véhicule / Modifier / Archiver
- Données mockées : 8 véhicules AMT (DX-847-AZ, GH-231-BF, KL-562-ZP, etc.)

**Page : Rapports DREAL**
- Sélecteur de période : 1j / 2j / 7j / 1m / 1an / 5ans / Personnalisé (date pickers)
- Sélection conducteurs : un, plusieurs, ou tous (checkbox multi-select)
- Bouton "Générer le rapport" → barre de progression simulée → aperçu PDF mock avec hash SHA-256 affiché
- Planification récurrente : hebdomadaire / mensuelle (toggle + sélecteur jour)
- Hash affiché : format `Rapport généré le 16/08/2026 à 14h32 — Hash : 7A3F9B2C8E1D4F6A...`
- ⚠️ Hash dynamique : recalculé à chaque génération via `SHA-256(company_id + période_start + période_end + new Date().toISOString() + SECRET_KEY_LOCAL)`. `SECRET_KEY_LOCAL` est une constante fixe dans le code (`"S2W-LOCAL-DEMO-KEY-2026"`). Chaque génération produit un hash unique (le timestamp change). La valeur complète (64 caractères hex) est affichée et copiable. Objectif démonstratif : prouver que le hash n'est pas statique mais calculé.

**Page : Archives**
- Deux onglets : Documents téléversés / Rapports générés
- Documents : historique des versions (badge "Remplacé" pour l'ancienne version)
- Rapports : liste avec type (manuel/planifié), période, conducteurs, date génération
- Corbeille : éléments supprimés visibles + bouton Restaurer
- Données mockées : historique 3 mois, 2 éléments en corbeille

#### Formulaires à rendre fonctionnels

**Formulaire Inscription Employeur (6 sections)**

Section 1 — Identification :
- Dénomination sociale (obligatoire)
- Enseigne commerciale (optionnel)
- Forme juridique (dropdown : EI, EURL, SARL, SAS, SASU, SA, SCA, SNC, SCI, SELARL, SELAS, SC, Autre)
- Capital social (optionnel, numérique)

Section 2 — Immatriculation :
- SIREN (9 chiffres, validation format)
- SIRET (14 chiffres, validation format)
- Code NAF/APE (optionnel, mock pré-rempli : "49.41A — Transport routier de fret")
- TVA intracommunautaire (optionnel, format FR)
- Ville du RCS/RNE (optionnel, mock pré-rempli)

Section 3 — Coordonnées :
- Adresse complète (numéro, rue, complément, code postal, ville, pays)
- Téléphone (obligatoire, format FR)
- Email générique (obligatoire, validation format)
- Site web (optionnel)

Section 4 — Contacts :
- Représentant légal : Nom, Prénom, Fonction (tous obligatoires)

Section 5 — Bancaire :
- Titulaire du compte (obligatoire)
- IBAN (obligatoire, validation format FR76...)
- BIC/SWIFT (obligatoire)
- ⚠️ Chiffrement local simulé : IBAN et BIC sont encodés en Base64 dans localStorage (simulation de chiffrement côté client). Affichage du message : "Vos coordonnées bancaires sont chiffrées localement. Aucune donnée bancaire n'est stockée en clair." L'affichage dans l'interface masque l'IBAN (FR76 ●●●● ●●●● ●●●● ●●●● 012).

Section 6 — Identifiants :
- Email de connexion (obligatoire, unique dans localStorage)
- Mot de passe (min 8 caractères, indicateur de force)
- Confirmation mot de passe
- Cases à cocher : CGU acceptées + reconnaissance géolocalisation ponctuelle

Comportement : sauvegarde dans `localStorage.companies[]` → redirection dashboard

**Formulaire Inscription Salarié (2 étapes)**

Étape 1 — Code Invitation :
- Champ texte + bouton "Vérifier"
- Si code valide : afficher le nom de l'entreprise rattachée + débloquer étape 2
- Si invalide/expiré/déjà utilisé : message d'erreur contextualisé

Étape 2 — Informations personnelles (débloqué après vérification) :
- Nom, Prénom
- Catégorie de permis (VL / PL — détermine les documents obligatoires)
- Téléphone, Email
- Mot de passe + confirmation

Comportement : sauvegarde dans `localStorage.drivers[]` statut `actif`, rattachement via `company_id`, redirection page de connexion

---

### L2 — `app-mobile.html` (Application Conducteur — complète)

Actuellement : Accueil + stubs vides pour 3 onglets + chrono hardcodé.

#### Correction chronomètre

État initial au chargement :
- Affichage : `00:00:00`
- Label état : "Aucune session en cours. Appuyez sur Démarrer pour débuter votre journée."
- Bouton Démarrer (vert) : actif
- Bouton Pause (violet) : désactivé
- Bouton Arrêter (rouge) : désactivé
- Catégorie affichée : aucune (vide)
- Timeline : vide

#### Onglets à construire

**Onglet : Feuillet quotidien**
- Sélecteur de date (date picker, défaut = aujourd'hui)
- Grille A/B/C/D :
  - A : Conduite (temps de conduite effectif)
  - B : Autre travail (chargement, livraison, paperasse)
  - C : Disponibilité (temps d'attente rémunéré)
  - D : Repos (toutes pauses confondues)
- Ligne E (total A+B+C) + vérification E + D = 24h
- Badge statut : `Conforme` (vert) / `Non conforme` (rouge) avec motif
- Bouton "Exporter en PDF" : aperçu simulé (tableau HTML imprimable)
- Signature de fin de journée : champ PIN (4 chiffres) + canvas signature manuscrite (toggle)
- Données mockées :
  - 15/08/2026 : A=7h00, B=2h45, C=0h30, D=13h45 → E=10h15 → Conforme (10h15 + 13h45 = 24h)
  - 14/08/2026 : A=9h02 → Non conforme (dépassement 9h journalières)

**Onglet : Historique**
- Liste des 30 dernières journées : date, A/B/C/D totaux, badge statut
- Statuts mockés : 25 Conforme, 3 Non conforme, 2 En attente de signature
- Recherche par date (champ date picker)
- Bouton "Exporter PDF" par ligne (simulé)
- Tap sur une ligne → affiche le feuillet détaillé de cette journée

**Onglet : Profil**
- Section identité : Nom, Prénom, catégorie permis (VL/PL)
- Section documents (avec badges statut) :
  - Permis : Valide (expiration 12/2028)
  - FCO/FIMO : Valide (expiration 03/2027)
  - Visite médicale : À renouveler (expire dans 14 jours — badge orange)
- Section entreprise : AMT Transport (rattachée), bouton "Contacter l'employeur"
- Contact d'urgence : Marie Dupont — 06 87 65 43 21
- Données mockées : Martin Dupont, PL, AMT Transport

---

### L3 — `pitch-deck.html` (Nouveau fichier)

Fichier HTML standalone, design START2WAY (Navy/Amber/Papier), navigable au clavier.

**Acte 1 — Le problème**
- Image du LIC n°126330 (visuel haute résolution ou représentation fidèle)
- 3 problèmes clés présentés visuellement :
  1. Remplissage manuel → erreurs, pertes, contrôles compliqués
  2. Aucune alerte → dépassements découverts trop tard
  3. Responsabilité floue → R3315-8 (jusqu'à 1 500€/conducteur/infraction)
- Chiffres-clés : 1 500€ max d'amende, contrôle DREAL sans préavis, archivage 5 ans obligatoire

**Acte 2 — La solution**
- Deux boutons CTA cliquables : "Ouvrir l'app conducteur" (→ app-mobile.html) et "Ouvrir le dashboard" (→ app-web.html)
- Guide de navigation étape par étape (accordéon dépliable) :
  - Mobile : 3 boutons → Démarrer → Pause B/C → Timeline → Arrêter → Feuillet
  - Web : Dashboard KPI → Conducteur en dépassement → Journal alertes → Rapport PDF

**Acte 3 — La preuve & l'offre**
- Slide offre pilote :
  - Tarif : 14,99€/mois (2 conducteurs inclus, 4,99€/conducteur supplémentaire)
  - Recherche 5 entreprises pilotes
  - Contrepartie : 6 mois offerts + logo sur site + référence client
- Contact : start2way.contact@gmail.com
- Arguments différenciants en accordéon : légalité, horodatage, R3315-8, export DREAL

---

### L4 — localStorage unifié

Schéma commun aux deux applications. Initialisé au premier chargement si absent.

```javascript
{
  companies:   [],   // Entreprises (employeurs inscrits)
  users:       [],   // Tous utilisateurs (conducteurs + employeurs)
  vehicles:    [],   // Véhicules de la flotte
  sessions:    [],   // Sessions journalières de chronométrage
  segments:    [],   // Segments A/B/C/D (horodatés, immuables après clôture)
  feuillets:   [],   // Feuillets quotidiens générés
  documents:   [],   // Documents (permis, FCO, CT, assurances…)
  invitations: [],   // Codes d'invitation générés par les employeurs
  reports:     [],   // Rapports DREAL générés
  alerts:      [],   // Alertes déclenchées (dépassements, expirations)
  audit_log:   [],   // Traçabilité R3315-8
  tokens_invitation_illimite: []  // Tokens illimités séparés des invitations uniques
}
```

Données mockées AMT Transport pré-chargées au premier lancement :
- 1 entreprise (AMT Transport, cmp_001)
- 12 utilisateurs (conducteurs, dont Martin Dupont usr_001)
- 8 véhicules
- 30 sessions historiques (30 derniers jours)
- Segments correspondants
- Feuillets générés
- Documents (3 expirés, 2 urgents, 5 à surveiller)
- Alertes actives

---

## Règles métier non négociables

| Règle | Valeur | Source légale |
|---|---|---|
| Durée max conduite journalière | 9h (dérogation 10h, 2x/semaine) | R3315-1 |
| Durée max sans pause | 4h30 | R3315-2 |
| Pause minimale | 45 min (fractionnable 15+30) | R3315-2 |
| Repos journalier minimal | 11h | R3315-3 |
| Repos hebdomadaire minimal | 45h normal / 24h réduit | R3315-4 |
| Archivage feuillets | 5 ans, immuable | R3315-5 |
| Vérification E + D = 24h | Total des 4 catégories = 24h | LIC standard |
| Responsabilité employeur | Traçabilité de toute dérogation autorisée | R3315-8 |

---

## Contraintes techniques S1

- **Fichiers standalone** : chaque HTML est un fichier unique, zéro dépendance externe sauf Google Fonts
- **Vanilla JS** : pas de framework, pas de build step
- **localStorage** : toutes les données persistent entre rechargements
- **Typographie** : Lexend (titres) + Source Sans 3 (corps) — Google Fonts
- **Palette** : Navy `#0D2242` / Amber `#C9922F` / Papier `#F8F6F3`
- **Responsive** : 375px (mobile) / 768px (tablette) / 1440px (desktop)
- **Accessibilité** : ARIA sur tous les contrôles interactifs, navigation clavier complète

---

## Hors périmètre S1

- Backend réel (API, base de données, auth)
- Application React Native
- Signature TSA (RFC 3161)
- Intégration API INSEE réelle
- Envoi d'emails réels
- Géolocalisation réelle

Ces éléments sont documentés dans la feuille de route S2 (architecture production).
