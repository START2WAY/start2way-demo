# CONTEXTE DU PROJET — START2WAY

---

## Qui suis-je ?

Je suis un **chauffeur-livreur à temps partiel** et **développeur digital à temps plein**. Cette double casquette est née de l'observation directe d'un Livret Individuel de Contrôle (LIC) papier utilisé au quotidien dans l'entreprise de transport où je travaille (AMT Transport, Le Raincy 93).

J'ai constaté que ce carnet papier — qui sert à prouver la conformité des temps de conduite et de repos — est à la fois **rigoureux dans sa logique** (grille A/B/C/D, totaux, contrôle 24h) mais **archaïque dans son usage** (remplissage manuel, pertes de documents, absence d'alertes, sanctions lourdes en cas d'erreur).

Le projet START2WAY est né de cette observation terrain : un produit conçu par quelqu'un qui **vit le problème** et qui a la **compétence technique** pour le résoudre.

---

## Qui sont mes utilisateurs ?

Mon produit s'adresse à **deux types d'utilisateurs** :

### 1. Les conducteurs (Salariés)
- **Profil** : Chauffeurs-livreurs, routiers, transporteurs de marchandises
- **Âge** : 25-60 ans
- **Niveau tech** : Très variable — certains sont à l'aise avec les smartphones, d'autres beaucoup moins. L'interface doit être **ultra-simple, avec de gros boutons tactiles** (car utilisée au volant ou dans un environnement bruyant).
- **Besoins principaux** :
  - Chronométrer facilement leur activité (Démarrer / Pause / Arrêter)
  - Ne pas risquer d'amende pour dépassement (9h de conduite, 4h30 sans pause, non-respect du repos obligatoire de 45h)
  - Prouver leur bonne foi en cas de contrôle (via des rapports PDF horodatés et non falsifiables)
  - Avoir un historique fiable de leurs journées de travail
  - Être protégés par l'article R3315-8 (si l'employeur est en carence, c'est à lui de payer)
  
### 2. Les employeurs (Entreprises de transport)
- **Profil** : Dirigeants, responsables RH, gestionnaires de flotte de PME de transport (5 à 100 salariés)
- **Âge** : 35-65 ans
- **Niveau tech** : Utilisent déjà des outils numériques (tableurs, logiciels de paie) mais cherchent à sécuriser leur conformité sans ajouter une charge administrative supplémentaire.
- **Besoins principaux** :
  - Superviser en temps réel la conformité de toute leur flotte
  - Recevoir des alertes avant qu'une infraction ne soit commise
  - Générer des rapports PDF prêts à transmettre à la DREAL en cas de contrôle
  - Centraliser les documents des salariés (permis, FCO/FIMO, visites médicales) et des véhicules (cartes grises, assurances, CT)
  - Archivage légal 5 ans sans gestion manuelle
  
  ---
  
  ## Pourquoi cette app ?
  
  **Le problème que START2WAY résout :**
  
  Aujourd'hui, les entreprises de transport utilisent un **carnet papier** (le Livret Individuel de Contrôle) pour suivre les temps de conduite et de repos de leurs conducteurs. Ce système présente des défauts critiques :
  
  1. **Remplissage manuel** : le conducteur doit noter chaque changement d'activité (conduite, autres tâches, disponibilité, repos) à la main sur une grille horaire.
  2. **Aucune alerte** : impossible de savoir qu'on approche d'un dépassement (9h de conduite, 4h30 sans pause) avant qu'il ne soit trop tard.
  3. **Risque de perte** : les carnets papier se perdent, se détériorent, ou sont mal remplis.
  4. **Sanctions lourdes** : les amendes vont de 450€ à 1 500€, avec des risques de récidive.
  5. **Charge administrative** : l'employeur doit collecter, vérifier et archiver manuellement les feuillets pendant 5 ans.
  6. **Responsabilité floue** : en cas de contrôle, il est difficile de prouver si c'est le conducteur ou l'employeur qui est en faute (article R3315-8).
  
  **La solution START2WAY :**
  
  Une application mobile (iOS/Android) et web qui :
  - **Automatise** le chronométrage en 3 gestes (Démarrer / Pause / Arrêter)
  - **Génère** automatiquement le feuillet quotidien A/B/C/D
  - **Alerte** en temps réel sur les dépassements (sans bloquer physiquement le conducteur)
  - **Trace** chaque action de manière horodatée et non falsifiable (hash cryptographique)
  - **Protège** le conducteur en documentant les décisions de l'employeur (dérogations, validations)
  - **Centralise** tout pour l'employeur (registre unique, documents, rapports PDF)
  - **Archive** légalement pendant 5 ans
  
  ---
  
  ## Ce qui existe déjà
  
  **L'outil actuel : le Livret Individuel de Contrôle (LIC) papier**
  
  Ce carnet existe depuis l'arrêté ministériel du 20 juillet 1998. Il contient :
  - Une **grille horaire de 0 à 24h** avec 4 catégories :
    - **A** = Conduite (volant)
    - **B** = Autres tâches (marteaux croisés)
    - **C** = Disponibilité (rectangle barré)
    - **D** = Repos / Pause (chaise)
  - Un **total E = A + B + C** qui doit se compléter avec D pour former 24h
  - Une **formule de contrôle** : E + D = 24h
  
  **Ce qui fonctionne bien dans le papier :**
  - La **logique A/B/C/D** est simple, rigoureuse, et comprise par tous les conducteurs
  - La **valeur probante** est reconnue par la DREAL
  - L'**archivage 5 ans** est obligatoire et bien établi
  
  **Ce qui est problématique :**
  - Le remplissage manuel est source d'erreurs et de pertes de temps
  - Pas d'alertes en temps réel
  - Pas de traçabilité de la responsabilité (conducteur vs employeur)
  - Les documents expirés (permis, visites médicales) ne sont pas suivis automatiquement
  - Les rapports de contrôle sont longs à produire
  
  **Ce que l'agent doit retenir :**
  - **Inspirez-vous de la logique A/B/C/D** du papier pour la structure des données et des écrans
  - **Améliorez** l'expérience utilisateur en automatisant ce qui peut l'être (totaux, alertes, rapports)
  - **Gardez** la rigueur et la valeur probante qui font la force du papier
  - **Évitez** la complexité inutile : les conducteurs doivent pouvoir utiliser l'app sans formation
  
  ---
  
  ## Ton et ambiance
  
  **Ton recherché : Professionnel, rigoureux, rassurant, mais pas froid.**
  
  START2WAY se situe à l'intersection de plusieurs univers :
  - **Administratif / Juridique** : on parle de conformité légale, de contrôles DREAL, d'amendes. Cela impose une crédibilité et une rigueur absolues.
  - **Transport / Logistique** : le produit est utilisé par des conducteurs qui ont un métier physique, exigeant, avec des contraintes de temps et de sécurité. L'interface doit être simple, efficace, et ne pas ajouter de complexité.
  - **Startup / Innovation** : on remplace un carnet papier vieux de 25 ans par une solution moderne et connectée. Il faut montrer qu'on apporte un vrai progrès.
  
  **Ambiance visuelle :**
  - **Sérieuse** mais pas austère
  - **Claire** et **aérée** — pas de surcharge d'informations
  - Des **couleurs profondes** (Navy) pour la confiance, rehaussées par des touches chaudes (Amber) pour la convivialité
  - Une **référence subtile au papier** (fond blanc cassé, typographie légèrement empreinte d'officiel) pour faire le pont avec l'ancien livret
  
  **Exemples de sites / apps qui m'inspirent :**
  - **Stripe** (dashboard clair, confiance, design épuré)
  - **Notion** (organisation, lisibilité, sobriété)
  - **Les sites gouvernementaux** (Service-Public.fr, Légifrance) pour la crédibilité et la rigueur
  - **Uber Driver** (simplicité d'usage, gros boutons, UX pensée pour des utilisateurs en mouvement)
  
  **Ce que l'app ne doit PAS être :**
  - Trop ludique ou colorée (on parle de conformité légale, pas d'un jeu)
  - Trop technique ou complexe (les conducteurs ne sont pas des ingénieurs)
  - Trop "startup" avec des animations excessives (le produit doit inspirer confiance, pas faire gadget)
  - Trop froide et impersonnelle (on accompagne des humains dans leur quotidien)
  
  ---
  
  ## 📌 STATUT DU DOCUMENT
  
  | Élément | Statut |
  | :--- | :--- |
  | Qui suis-je ? | ✅ Validé |
  | Qui sont mes utilisateurs ? | ✅ Validé |
  | Pourquoi cette app ? | ✅ Validé |
  | Ce qui existe déjà | ✅ Validé |
  | Ton et ambiance | ✅ Validé |
  
  ---