# Architecture des pages web — START2WAY

> Document de référence — S1 → S2/S3
> Dernière mise à jour : 16/08/2026
> **Décision architecture : FIGÉE**

---

## Décision finale — Monorepo Next.js

Toutes les surfaces web START2WAY sont dans **un seul projet Next.js (App Router)**.

```
start2way.com/                   → Route groupe (public)       — SSR/SSG
start2way.com/employer/**        → Route groupe (dashboard)    — CSR, protégé Clerk
start2way.com/management/**      → Route groupe (admin)        — CSR, protégé Clerk (rôle admin)
```

**Justifications :**
- Un seul build, un seul hébergement (Vercel / Cloudflare Pages) — zéro complexité DevOps supplémentaire
- Charte Navy/Amber/Papier et composants UI partagés entre vitrine et panels
- Next.js App Router + middleware Clerk : séparation public/protégé sans duplication
- SSR/SSG natif pour la vitrine (SEO), CSR pour les dashboards (données temps réel)
- Panel admin extractable plus tard si l'équipe grandit (séparation de rôles via Clerk dès S2)

---

## Structure App Router (S2 cible)

```
app/
├── (public)/                        ← Routes publiques (start2way.com)
│   ├── page.tsx                     ← Accueil / Hero
│   ├── innovation/page.tsx          ← Valeur probante, SHA-256, DREAL
│   ├── conducteurs/page.tsx         ← Présentation app mobile
│   ├── employeurs/page.tsx          ← Présentation dashboard
│   ├── tarifs/page.tsx              ← Grille tarifaire
│   ├── telechargement/page.tsx      ← QR codes App Store / Play Store
│   └── mentions-legales/page.tsx    ← CGU, RGPD, contact
│
├── (dashboard)/
│   └── employer/                    ← start2way.com/employer (protégé Clerk)
│       ├── page.tsx                 ← Dashboard KPI
│       ├── registre/page.tsx        ← Registre unique personnel
│       ├── documents/page.tsx       ← Suivi documents
│       ├── flotte/page.tsx          ← Gestion flotte
│       ├── rapports/page.tsx        ← Rapports DREAL
│       └── archives/page.tsx        ← Archives
│
├── (admin)/
│   └── management/                  ← start2way.com/management (protégé Clerk — rôle admin)
│       ├── page.tsx                 ← Dashboard global
│       ├── entreprises/page.tsx     ← Gestion toutes entreprises
│       ├── support/page.tsx         ← Tickets support
│       ├── audit/page.tsx           ← Audit log global
│       ├── techniciens/page.tsx     ← Comptes techniciens + MFA
│       └── monitoring/page.tsx      ← Serveurs, sauvegardes, performances
│
└── middleware.ts                    ← Clerk : routes publiques / dashboard / admin
```

---

## Tableau récapitulatif — Décision finale

| Surface | URL | Projet | Statut S1 | Statut S2/S3 |
|---|---|---|---|---|
| Vitrine publique | `start2way.com` | Next.js monorepo | ❌ Hors périmètre | À développer |
| Panel employeur | `start2way.com/employer` | Next.js monorepo | ✅ `app-web.html` | Migration Next.js |
| Panel admin | `start2way.com/management` | Next.js monorepo | ❌ Hors périmètre | À planifier |

---

## Stack S2 (rappel)

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Clerk (rôles : `employer`, `admin`, `technician`) |
| Base de données | Neon PostgreSQL (serverless) |
| API | Fastify (ou Next.js API Routes) |
| Stockage fichiers | Cloudflare R2 |
| Logique métier | `@start2way/core` (calculs A/B/C/D, conformité R3315) |
| Hébergement | Vercel ou Cloudflare Pages |
| App mobile | React Native / Expo |

---

## S1 — Fichiers livrés (équivalents maquettes)

| Fichier | Correspond à | Statut |
|---|---|---|
| `app-web.html` | `start2way.com/employer` | ✅ Fonctionnel |
| `app-mobile.html` | App mobile conducteur | ✅ Fonctionnel |
| `pitch-deck.html` | `start2way.com` (provisoire) | ✅ Maquette commerciale |
| `docs/s1/js/s2w-localstorage.js` | `@start2way/core` (stub) | ✅ Logique métier S1 |
| `docs/s1/js/s2w-utils.js` | Utilitaires partagés | ✅ Formatage, validation |
