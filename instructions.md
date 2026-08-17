# START2WAY — Spécifications fonctionnelles pour conception

---

## Objectif

START2WAY est une application de gestion des temps de conduite et de repos pour le transport routier français. Elle remplace le Livret Individuel de Contrôle (LIC) papier par une solution numérique à valeur probante, permettant aux conducteurs de chronométrer leur activité (catégories A/B/C/D) et aux employeurs de superviser la conformité de leurs équipes en temps réel.

--- ## Fonctionnalités principales

### Côté Salarié (conducteur)

- **Création de compte** :
  - Saisie du **Code Invitation** (token) fourni par l'employeur
  - Vérification automatique : le code existe, n'a pas été utilisé, n'est pas expiré (12h), et est rattaché à une entreprise active
  - Formulaire d'informations personnelles : nom, prénom, catégorie de permis (VL / PL), coordonnées (téléphone, email)
  - Création du mot de passe de connexion
  - Rattachement automatique à l'entreprise via le `company_id` contenu dans le code - Le compte est créé avec le statut `actif` (ou `bloque` si des documents sont immédiatement requis)

- **Chronométrage 3 boutons** :
  - **Démarrer (vert)** : lance l'enregistrement en catégorie A (Conduite)
  - **Pause (violet)** : suspend l'enregistrement, choix obligatoire entre B (autres tâches) et C (disponibilité)
  - **Arrêter (rouge)** : stoppe la journée et génère automatiquement le feuillet quotidien A/B/C/D
  
- **Saisie kilométrique** : compteur début (pré-rempli) et compteur fin

- **Sélection du véhicule** : liste déroulante de la flotte + option "Autre"

- **Génération automatique du feuillet quotidien** : totaux A/B/C/D, vérification E+D=24h

- **Alertes de conformité** : dépassement 9h/10h, pause 45min après 4h30, repos hebdomadaire 45h (alerte + confirmation obligatoire, jamais de blocage)

- **Historique** : consultation indéfinie, export PDF

- **Profil** : identité, permis (VL/PL), documents obligatoires

---

### Côté Employeur

- **Création de compte** :
  - Formulaire complet (5 sections d'informations entreprise + 1 section identifiants de connexion)
  - Vérification automatique via API INSEE (SIREN/SIRET)
  - **Création des identifiants de connexion** : email de connexion (unique) + mot de passe (avec confirmation)
  - Paiement SEPA (mandat de prélèvement)
  - Activation du compte après validation du premier paiement
  
- **Tableau de bord** : conformité globale, alertes actives, risques 4e/5e classe, documents à expirer

- **Registre unique numérique** : suivi des salariés (statuts : En attente / Actif / Bloqué / Départ enregistré / Supprimé)

- **Gestion des documents** : validation des documents salariés (permis, FCO/FIMO, visite médicale) et véhicules (carte grise, assurance, CT)

- **Génération de rapports de contrôle** : périodes prédéfinies (1 jour, 7 jours, 1 mois, 1 an, 5 ans) ou personnalisées, export PDF horodaté et non modifiable

- **Gestion des codes** : génération de Code Invitation (nouveau salarié) et Code Reprise (correction d'une entrée passée)

---

### Fonctions transverses

- **Onglet Archives** : centralise tous les documents téléversés et rapports générés (versionnés, jamais écrasés)

- **Corbeille** : suppression = déplacement en corbeille (hidden_at), restauration possible. La donnée réelle n'est jamais supprimée du serveur.

---

## Pages / Écrans

### Site vitrine (landing page)
- Présentation du produit, des bénéfices, des prix (14,99€/mois, 2 salariés inclus) - En-tête : Logo (S2 + START2WAY) + boutons "Accès à votre espace en ligne" et "Inscription"

### Page de choix du statut
- Deux grandes cartes : "Je suis Employeur" / "Je suis Salarié"
- Redirection vers le formulaire ou la page de login correspondante

### Écran Salarié — Inscription (2 étapes)
- **Étape 1 — Saisie du Code Invitation** :
  - Champ de texte : "Entrez le code fourni par votre employeur"
  - Bouton "Vérifier"
  - Affichage du nom de l'entreprise rattachée (pour confirmation visuelle)
  - Si le code est invalide / expiré / déjà utilisé : message d'erreur clair
- **Étape 2 — Formulaire d'inscription** (débloqué après vérification du code) :
  - Nom, Prénom
  - Catégorie de permis : VL (véhicule léger) ou PL (poids lourd)
  — détermine les documents obligatoires à suivre
  - Téléphone
  - Email (utilisé comme identifiant de connexion)
  - Mot de passe (avec confirmation)
  - Bouton "Créer mon compte"
- **Message de confirmation** : compte créé, redirection vers la page de connexion ou directement dans l'application

### Écran Salarié — Accueil
- 3 gros boutons : Démarrer (vert) / Pause (violet) / Arrêter (rouge)
- Sélection du véhicule (dropdown)
- Champ kilométrage (début / fin)
- Timeline segmentée A/B/C/D en temps réel
- Bannière d'alerte en cas de dépassement

### Écran Salarié — Feuillet quotidien
- Grille A/B/C/D avec les totaux
- Vérification automatique : E+D = 24h
- Statut de conformité (conforme / non conforme)
- Bouton d'export PDF
- Signature de fin de journée (Code PIN ou manuscrite)

### Écran Salarié — Historique
- Liste des journées avec totaux et statut
- Recherche par date
- Export PDF à la demande

### Écran Salarié — Profil
- Identité, coordonnées, permis (VL/PL)
- Documents téléversés (permis, FCO/FIMO, visite médicale)
- Statut des documents (en attente de validation / valide / expiré)
- Entreprises rattachées (si plusieurs)

### Écran Employeur — Inscription (formulaire complet, 6 sections)
- **Section 1 — Identification générale** :
  - Dénomination sociale (obligatoire)
  - Nom commercial / Enseigne (optionnel)
  - Forme juridique (dropdown : EI, EURL, SARL, SAS, SASU, SA, SCA, SNC, SCI, SELARL, SELAS, SC, Autre)
  - Capital social (optionnel)
- **Section 2 — Numéros d'immatriculation** :
  - SIREN (9 chiffres, obligatoire)
  - SIRET (14 chiffres, obligatoire)
  - Code NAF / APE (optionnel, pré-rempli par API INSEE)
  - Numéro de TVA intracommunautaire (optionnel)
  - Ville du RCS / RNE (optionnel, pré-rempli par API INSEE)
- **Section 3 — Coordonnées et siège social** :
  - Adresse (numéro, rue, complément, code postal, ville, pays)
  - Téléphone principal (obligatoire)
  - Adresse e-mail générique (obligatoire, ex: contact@)
  - Site web (optionnel)
- **Section 4 — Contacts clés** :
  - Représentant légal : Nom, Prénom, Fonction (tous obligatoires)
- **Section 5 — Coordonnées bancaires** :
  - Titulaire du compte (obligatoire)
  - IBAN (obligatoire, validation format)
  - Code BIC / SWIFT (obligatoire)
- **Section 6 — Identifiants de connexion** (NOUVEAU) :
  - Email de connexion (obligatoire, unique dans le système, utilisé comme identifiant)
  - Mot de passe (obligatoire, minimum 8 caractères)
  - Confirmation du mot de passe
  - Validation des CGU + reconnaissance de l'obligation d'information/consultation des représentants du personnel avant activation de la géolocalisation
- **Bouton final** : "Créer mon compte entreprise"
- **Redirection** : vers la page de paiement SEPA (ou confirmation + email)

### Écran Employeur — Dashboard
- Bandeau KPI : conformité globale, alertes actives, risques, documents à expirer
- Barre de filtres : par véhicule, période, statut documentaire, recherche par nom
- Liste des salariés groupée : Non conforme (priorité) / À surveiller / Conforme (repliée)
- Export de la liste filtrée

### Écran Employeur — Registre unique
- Liste complète des salariés avec statuts (En attente / Actif / Bloqué / Départ / Supprimé)
- Actions : générer Code Invitation, générer Code Reprise, enregistrer départ
- Export CSV/Excel/PDF

### Écran Employeur — Gestion des documents
- Documents salariés : validation manuelle (ou dérogation temporaire avec motif)
- Documents véhicules : carte grise, assurance, contrôle technique, location
- Suivi des expirations 

### Écran Employeur — Flotte
- Liste des véhicules avec immatriculation, poids, équipement chronotachygraphe
- Suivi des documents (carte grise, assurance, CT)
- Suivi de l'entretien (seuils kilométriques configurables)
- Ajout / modification / suppression de véhicules 

### Écran Employeur — Générateur de rapport
- Sélecteur de période : 1 jour, 2 jours, 7 jours, 1 mois, 1 an, 5 ans, personnalisé - Sélection des salariés (un ou plusieurs, ou tous)
- Bouton "Générer" → export PDF horodaté avec hash d'intégrité
- Planification automatique récurrente (optionnelle)

### Écran Archives (Salarié et Employeur)
- Liste des documents téléversés (avec historique des versions)
- Liste des rapports générés (manuels et planifiés)
- Corbeille : éléments supprimés visibles, avec option de restauration

### Page de connexion
- Formulaire unique : Email de connexion + Mot de passe
- Bouton "Se connecter"
- Lien "Mot de passe oublié ?"

---

## Contraintes techniques

- **Format** : Tout dans un seul fichier HTML (CSS + JS intégrés)
- **Framework** : Aucun framework — JavaScript vanilla
- **Style** : Sobre, professionnel, respectant la charte graphique (Navy `#0D2242` / Amber `#C9922F` / Blanc cassé `#F8F6F3`)
- **Responsive** : Fonctionne sur mobile (écrans 5-7 pouces) et desktop
- **Stockage** : Les données sont stockées dans le localStorage du navigateur (pour la démonstration/conception)
- **Typographie** : Choix laissé à la discrétion de l'agent, en cohérence avec les projets du secteur (transport, logistique, administrative)

---

## Ce que l'app ne fait PAS (périmètre de conception)

- **Pas de gestion RH / paie** : START2WAY documente l'activité, il ne gère ni les plannings ni les salaire
- **Pas de géolocalisation continue** : Le GPS n'est utilisé que ponctuellement (prise/cessation de service) et ne donne pas de carte de flotte en temps réel
- **Pas de paiement intégré** : Le paiement SEPA est géré en dehors de cette maquette
- **Pas de communication en temps réel** : Pas de chat, pas de notifications push dans cette version
- **Pas de véritable API externe** : Les appels à l'API INSEE ou VIES sont simulés (mockés) pour la conception
- **Pas d'authentification réelle** : Le localStorage simule les sessions utilisateur
- **Pas de génération PDF réelle** : Le bouton d'export PDF peut afficher un aperçu ou télécharger un fichier statique d'exemple
- **Pas d'OCR** : Les documents sont téléversés avec une date d'expiration saisie manuellement

---

## Rappel des couleurs de la charte

| Élément | Code Hex |
| :--- | :--- |
| Principal (Navy) | `#0D2242` |
| Accent (Amber) | `#C9922F` |
| Fond (Papier) | `#F8F6F3` |
| Texte principal | `#1A1A1A` |
| Texte secondaire | `#5A5A5A` |
| Succès / Conforme | `#2E7D32` |
| Alerte / Attention | `#ED6C02` |
| Danger / Non-conforme | `#D32F2F` |

---

## 📌 STATUT DU DOCUMENT

| Élément | Statut |
| :--- | :--- |
| Objectif | ✅ Validé |
| Fonctionnalités | ✅ Validé |
| Pages / Écrans | ✅ Validé (avec les 6 sections employeur) |
| Contraintes techniques | ✅ Validé |
| Périmètre (Ce que l'app ne fait PAS) | ✅ Validé |

---