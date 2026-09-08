with open("VERTEBRALE.md", "a") as f:
    f.write("\n### [Vertèbre 20] Formulaire Entreprise Multi-étapes\n")
    f.write("- **Fichiers concernés :** `souscription.html`, `app-web.html`\n")
    f.write("- **Logique partagée :** `docs/s1/js/s2w-utils.js` (classe `S2WStepper`)\n")
    f.write("- **Règle :** Le formulaire Entreprise est structuré en 7 sections logiques (Identité, Adresse, Représentant, Coordonnées, Bancaire, Sécurité, Légal). `souscription.html` implémente les 7 étapes, tandis que `app-web.html` (Mon Entreprise) n'implémente que les 5 premières étapes pour éviter la modification des identifiants et l'écrasement des CGU. L'enregistrement partiel dans `app-web.html` (Patch) est obligatoire pour protéger les champs omis.\n")
