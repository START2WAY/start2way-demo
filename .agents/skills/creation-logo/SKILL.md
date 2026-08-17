---
name: creation-logo
description: >-
  Cette compétence guide la conception, la génération et l'intégration de logos de haute qualité.
  À activer lors de la création d'identités visuelles, d'icônes de marque ou de ressources de branding (en SVG brut, par génération d'image IA, ou via des dessins et animations CSS).
  Ne pas activer pour des tâches de mise en page UI générales ou d'édition d'images bitmap existantes sans rapport avec le branding.
license: Apache-2.0
metadata:
  version: v1
  publisher: Antigravity
---

# 🎨 Création de Logo (Logo Creation)

## Vue d'ensemble
Cette compétence fournit un guide complet pour la conception et l'implémentation de logos professionnels directement intégrables dans des applications ou des sites web. Elle fusionne trois approches complémentaires : la **conception vectorielle SVG pure**, la **génération d'images par IA guidée**, et le **tracé interactif en CSS/HTML**.

---

## Dépendances
- `ui-ux-pro-max` (pour l'harmonie des palettes de couleurs et l'esthétique premium)
- `modern-web-guidance` (pour l'intégration et l'optimisation des performances web)

---

## Démarrage rapide

### Exemple minimal de logo SVG moderne
Pour créer un logo vectoriel minimaliste et l'intégrer directement dans votre HTML :
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48" class="brand-logo">
  <defs>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0D2242" />
      <stop offset="100%" stop-color="#ED6C02" />
    </linearGradient>
  </defs>
  <!-- Tracé géométrique fluide -->
  <path d="M20,80 L50,20 L80,80 Z" fill="none" stroke="url(#logoGrad)" stroke-width="12" stroke-linejoin="round" />
  <circle cx="50" cy="53" r="10" fill="#ED6C02" />
</svg>
```

---

## Workflow d'exécution

### Étape 1 — Choix de l'approche technique
Déterminer la méthode la plus appropriée selon le cas d'usage :
1. **SVG Vectoriel Pur (Recommandé) :** Pour les icônes d'application, les logos de navigation et les marques nécessitant une scalabilité parfaite et un poids plume.
2. **Générative par Prompting IA :** Pour explorer des concepts artistiques complexes, des emblèmes illustrés ou des logos 3D texturés.
3. **Dessin et Animation CSS :** Pour les logos interactifs intégrés devant réagir dynamiquement au survol ou à l'état de l'application (transitions, transformations).

---

### Étape 2 — Conception par approche

#### Approche A : Conception Vectorielle SVG
1. **Définir le viewBox :** Toujours utiliser un espace de coordonnées carré et propre (ex: `0 0 100 100` ou `0 0 512 512`).
2. **Utiliser des Déclarations Sémantiques :** Structurer le SVG avec des balises claires (`<defs>`, `<g>`, `<path>`, `<text>`).
3. **Optimiser les Tracés :** Limiter le nombre de points d'ancrage pour garder le fichier léger.
4. **Assurer l'accessibilité :** Ajouter des attributs `aria-label` ou des balises `<title>` pour les lecteurs d'écran.

#### Approche B : Direction Artistique par Génération d'Image
Lors de l'utilisation de l'outil `generate_image`, utiliser des invites (prompts) structurées selon ce canevas :
*   **Sujet principal :** "A minimalist vector logo icon of [sujet]..."
*   **Style & Rendu :** "...flat design, clean line art, sharp geometry, high contrast..."
*   **Composition :** "...isolated on a solid black background, center-aligned, symmetry..."
*   **À exclure (Negative Prompts) :** "...no gradients, no realistic textures, no photorealistic details, no text labels..."
*   **Format de sortie :** Utiliser un ratio `1:1` pour les icônes de marque et logos.

#### Approche C : Tracé et Micro-Animations CSS
1. **Exploiter `clip-path` :** Dessiner des formes complexes réactives directement en CSS.
2. **Intégrer des dégradés HSL :** Utiliser des variables CSS pour des thèmes sombres/clairs dynamiques.
3. **Ajouter des transitions fluides :**
   ```css
   .brand-logo {
     transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
   }
   .brand-logo:hover {
     transform: scale(1.05) rotate(5deg);
   }
   ```

---

## Étape 3 — Intégration et Optimisation
1. **Nettoyage SVG (si approche A) :** Supprimer les métadonnées inutiles des éditeurs graphiques (comme Illustrator ou Inkscape) : les attributs de namespace non standards, les id redondants.
2. **Accessibilité :**
   *   Si le logo accompagne un texte de marque visible : marquer le SVG avec `aria-hidden="true"`.
   *   Si le logo est seul : ajouter `<title id="logo-title">Nom de la marque</title>` et référencer `aria-labelledby="logo-title"`.
3. **Performances :** Si le logo généré est une image matricielle (PNG/WebP), l'optimiser pour le web, utiliser les bons attributs `width` et `height`, et activer le lazy loading si nécessaire.

---

## Erreurs courantes
*   **Fond opaque sur les images générées :** Omettre de spécifier "isolated on solid black background" ou "isolated on solid white background", ce qui rend le détourage du logo extrêmement difficile.
*   **Tracés non réactifs :** Utiliser des dimensions absolues (`width="150px"`) à l'intérieur du code du tracé SVG au lieu d'utiliser le `viewBox` combiné avec des classes de dimensionnement CSS.
*   **Textes pixelisés :** Dessiner des textes de marque sous forme d'image matricielle au lieu d'utiliser des polices web ou des tracés vectoriels (`<path>` convertis en contours).
