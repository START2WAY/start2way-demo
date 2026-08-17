# START2WAY S1 — Plan d'Implémentation : Démo 100% Fonctionnelle

> **Pour les agents exécuteurs :** Implémenter ce plan tâche par tâche dans l'ordre indiqué.
> Les étapes utilisent la syntaxe case à cocher (`- [ ]`) pour le suivi.
> Chaque tâche est testable indépendamment avant de passer à la suivante.

**Objectif :** Transformer les deux maquettes HTML partielles en une démo 100% fonctionnelle avec localStorage persistant, prête pour les rendez-vous commerciaux AMT Transport.

**Architecture :** HTML vanilla + Vanilla JS + localStorage. Zéro build step. Deux fichiers standalone + un pitch deck. Données mockées AMT Transport pré-chargées au premier lancement.

**Stack technique :** HTML5 / CSS3 / Vanilla JS / Web Crypto API (SHA-256) / localStorage / Google Fonts (Lexend + Source Sans 3)

**Spec :** `docs/specs/2026-08-16-start2way-s1-conception.md`

## Contraintes globales

- Chaque fichier HTML est standalone (zéro dépendance externe sauf Google Fonts CDN)
- Pas de framework JS, pas de build step, pas de npm
- Palette stricte : Navy `#0D2242` / Amber `#C9922F` / Papier `#F8F6F3`
- Typographie : Lexend (titres/labels) + Source Sans 3 (corps)
- Responsive : 375px / 768px / 1440px
- ARIA sur tous les contrôles interactifs
- localStorage : toutes les données persistent entre rechargements
- `SECRET_KEY_LOCAL = "S2W-LOCAL-DEMO-KEY-2026"` (constante dans le code)
- Règles métier : 9h conduite max / 4h30 sans pause max / 45 min pause min / 11h repos jour / 45h repos hebdo / archivage 5 ans

---

## Cartographie des fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Modifier | `app-web.html` | Ajouter 5 pages + 2 formulaires + localStorage unifié |
| Modifier | `app-mobile.html` | Corriger chrono + ajouter 3 onglets + localStorage unifié |
| Créer | `pitch-deck.html` | Pitch 3 actes standalone |
| Créer | `docs/plans/2026-08-16-start2way-s1-plan.md` | Ce fichier |

---

## Tâche 1 : Module localStorage unifié

**Fichiers :**
- Modifier : `app-web.html` (section `<script>`, début du fichier)
- Modifier : `app-mobile.html` (section `<script>`, début du fichier)

**Interfaces :**
- Produit : objet global `S2W` avec méthodes `get()`, `set()`, `push()`, `init()` utilisées par toutes les tâches suivantes

- [ ] **Étape 1 : Écrire le module S2W dans app-web.html**

Ajouter ce bloc JS au début de `<script>` dans `app-web.html`, avant toute autre fonction :

```javascript
// ─── MODULE S2W — localStorage unifié ────────────────────────────────
const S2W_KEY = 'start2way_data';
const SECRET_KEY_LOCAL = 'S2W-LOCAL-DEMO-KEY-2026';

const S2W = {
  get() {
    try { return JSON.parse(localStorage.getItem(S2W_KEY)) || {}; }
    catch { return {}; }
  },
  set(data) {
    localStorage.setItem(S2W_KEY, JSON.stringify(data));
  },
  table(name) {
    const d = this.get();
    return d[name] || [];
  },
  push(name, record) {
    const d = this.get();
    if (!d[name]) d[name] = [];
    d[name].push(record);
    this.set(d);
  },
  update(name, id, patch) {
    const d = this.get();
    if (!d[name]) return;
    const idx = d[name].findIndex(r => r.id === id);
    if (idx !== -1) d[name][idx] = { ...d[name][idx], ...patch };
    this.set(d);
  },
  find(name, id) {
    return this.table(name).find(r => r.id === id) || null;
  },
  encodeIban(raw) {
    return btoa(unescape(encodeURIComponent(raw)));
  },
  decodeIban(encoded) {
    try { return decodeURIComponent(escape(atob(encoded))); } catch { return ''; }
  },
  maskIban(raw) {
    if (!raw || raw.length < 8) return raw;
    return raw.slice(0,4) + ' ●●●● ●●●● ●●●● ' + raw.slice(-3);
  },
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  },
  init() {
    const existing = this.get();
    if (existing._initialized) return;
    this.set({ ...MOCK_DATA, _initialized: true });
  }
};
```

- [ ] **Étape 2 : Copier le même module dans app-mobile.html**

Copier le bloc S2W identique dans `<script>` de `app-mobile.html`. La constante `SECRET_KEY_LOCAL` et les méthodes sont identiques dans les deux fichiers.

- [ ] **Étape 3 : Créer les données mockées AMT Transport**

Ajouter avant `S2W.init()` dans les deux fichiers la constante `MOCK_DATA` :

```javascript
const MOCK_DATA = {
  companies: [{
    id: 'cmp_001', legal_name: 'AMT Transport', trade_name: 'AMT',
    legal_form: 'SAS', siren: '105185496', siret: '10518549600012',
    naf_ape: '49.41A', vat_number: 'FR105185496', rcs_city: 'Bobigny',
    address_street: '122 avenue de la Résistance', address_postal_code: '93340',
    address_city: 'Le Raincy', address_country: 'France',
    phone: '01 49 39 00 46', email: 'contact@amttransport.fr',
    rep_first_name: 'Jean', rep_last_name: 'Dupont', rep_function: 'Gérant',
    iban_encoded: btoa('FR7630006000011234567890189'),
    bic_swift: 'SOGEFRPP', status: 'active', created_at: '2024-01-15T09:00:00Z'
  }],
  users: [
    { id:'usr_001', company_id:'cmp_001', email:'martin.dupont@email.com',
      role:'salarie', first_name:'Martin', last_name:'Dupont',
      license_category:'PL', phone:'06 12 34 56 78',
      emergency_contact:'Marie Dupont — 06 87 65 43 21',
      status:'actif', created_at:'2024-02-01T08:00:00Z' },
    { id:'usr_002', company_id:'cmp_001', email:'christine.lefevre@email.com',
      role:'salarie', first_name:'Christine', last_name:'Lefèvre',
      license_category:'PL', phone:'06 23 45 67 89', status:'actif',
      created_at:'2024-02-15T08:00:00Z' },
    { id:'usr_003', company_id:'cmp_001', email:'jpierre.martin@email.com',
      role:'salarie', first_name:'Jean-Pierre', last_name:'Martin',
      license_category:'PL', phone:'06 34 56 78 90', status:'bloque',
      created_at:'2024-03-01T08:00:00Z' },
    { id:'usr_004', company_id:'cmp_001', email:'karim.benali@email.com',
      role:'salarie', first_name:'Karim', last_name:'Benali',
      license_category:'VL', phone:'06 45 67 89 01', status:'actif',
      created_at:'2024-03-15T08:00:00Z' },
    { id:'usr_005', company_id:'cmp_001', email:'sophie.morel@email.com',
      role:'salarie', first_name:'Sophie', last_name:'Morel',
      license_category:'PL', phone:'06 56 78 90 12', status:'actif',
      created_at:'2024-04-01T08:00:00Z' },
    { id:'usr_006', company_id:'cmp_001', email:'thomas.roux@email.com',
      role:'salarie', first_name:'Thomas', last_name:'Roux',
      license_category:'PL', phone:'06 67 89 01 23', status:'actif',
      created_at:'2024-04-15T08:00:00Z' },
    { id:'usr_007', company_id:'cmp_001', email:'lucie.gerard@email.com',
      role:'salarie', first_name:'Lucie', last_name:'Gérard',
      license_category:'VL', phone:'06 78 90 12 34', status:'actif',
      created_at:'2024-05-01T08:00:00Z' },
    { id:'usr_008', company_id:'cmp_001', email:'olivier.petit@email.com',
      role:'salarie', first_name:'Olivier', last_name:'Petit',
      license_category:'PL', phone:'06 89 01 23 45', status:'actif',
      created_at:'2024-05-15T08:00:00Z' },
    { id:'usr_009', company_id:'cmp_001', email:'nathalie.simon@email.com',
      role:'salarie', first_name:'Nathalie', last_name:'Simon',
      license_category:'VL', phone:'06 90 12 34 56', status:'actif',
      created_at:'2024-06-01T08:00:00Z' },
    { id:'usr_010', company_id:'cmp_001', email:'marc.leblanc@email.com',
      role:'salarie', first_name:'Marc', last_name:'Leblanc',
      license_category:'PL', phone:'06 01 23 45 67', status:'depart',
      depart_at:'2026-07-31T18:00:00Z', created_at:'2024-06-15T08:00:00Z' },
    { id:'usr_011', company_id:'cmp_001', email:'valerie.henry@email.com',
      role:'salarie', first_name:'Valérie', last_name:'Henry',
      license_category:'VL', phone:'06 12 23 34 45', status:'bloque',
      created_at:'2024-07-01T08:00:00Z' },
    { id:'usr_012', company_id:'cmp_001', email:'pierre.durand@email.com',
      role:'salarie', first_name:'Pierre', last_name:'Durand',
      license_category:'PL', phone:'06 23 34 45 56', status:'supprime',
      hidden_at:'2026-06-01T00:00:00Z', created_at:'2024-07-15T08:00:00Z' }
  ],
  vehicles: [
    { id:'veh_001', company_id:'cmp_001', plate_number:'DX-847-AZ',
      brand_model:'Renault Master', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:124532, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2027-01-15',status:'valide'},
        assurance:{expires_at:'2026-12-01',status:'valide'},
        controle_technique:{expires_at:'2026-09-15',status:'a_renouveler'} } },
    { id:'veh_002', company_id:'cmp_001', plate_number:'GH-231-BF',
      brand_model:'Mercedes Actros', max_weight_kg:19000, tachograph_equipped:true,
      last_known_km:87643, maintenance_thresholds:{oil_change:20000,tires:50000,inspection:60000},
      documents:{ carte_grise:{expires_at:'2028-03-20',status:'valide'},
        assurance:{expires_at:'2026-11-15',status:'valide'},
        controle_technique:{expires_at:'2027-02-10',status:'valide'} } },
    { id:'veh_003', company_id:'cmp_001', plate_number:'KL-562-ZP',
      brand_model:'Citroën Jumpy', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:56210, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2026-08-30',status:'a_renouveler'},
        assurance:{expires_at:'2027-01-01',status:'valide'},
        controle_technique:{expires_at:'2027-06-15',status:'valide'} } },
    { id:'veh_004', company_id:'cmp_001', plate_number:'MN-974-QA',
      brand_model:'Iveco Daily', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:198432, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2027-09-10',status:'valide'},
        assurance:{expires_at:'2026-10-31',status:'valide'},
        controle_technique:{expires_at:'2026-08-20',status:'expire'} } },
    { id:'veh_005', company_id:'cmp_001', plate_number:'PQ-385-RF',
      brand_model:'Renault Master', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:43210, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2028-01-15',status:'valide'},
        assurance:{expires_at:'2027-02-28',status:'valide'},
        controle_technique:{expires_at:'2027-08-01',status:'valide'} } },
    { id:'veh_006', company_id:'cmp_001', plate_number:'ST-126-WB',
      brand_model:'Scania R450', max_weight_kg:26000, tachograph_equipped:true,
      last_known_km:312540, maintenance_thresholds:{oil_change:25000,tires:60000,inspection:80000},
      documents:{ carte_grise:{expires_at:'2026-12-31',status:'valide'},
        assurance:{expires_at:'2026-09-30',status:'a_renouveler'},
        controle_technique:{expires_at:'2027-04-15',status:'valide'} } },
    { id:'veh_007', company_id:'cmp_001', plate_number:'UV-453-XC',
      brand_model:'Volkswagen Crafter', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:78901, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2029-05-20',status:'valide'},
        assurance:{expires_at:'2027-05-31',status:'valide'},
        controle_technique:{expires_at:'2028-01-10',status:'valide'} } },
    { id:'veh_008', company_id:'cmp_001', plate_number:'YZ-789-LD',
      brand_model:'Mercedes Sprinter', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:22134, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:'2030-02-14',status:'valide'},
        assurance:{expires_at:'2027-03-15',status:'valide'},
        controle_technique:{expires_at:'2028-07-20',status:'valide'} } }
  ],
  documents: [
    { id:'doc_001', owner_id:'usr_001', owner_type:'user', type:'permis',
      expires_at:'2028-12-01', status:'valide', validated_by_employer:true },
    { id:'doc_002', owner_id:'usr_001', owner_type:'user', type:'fco_fimo',
      expires_at:'2027-03-15', status:'valide', validated_by_employer:true },
    { id:'doc_003', owner_id:'usr_001', owner_type:'user', type:'visite_medicale',
      expires_at:'2026-08-30', status:'a_renouveler', validated_by_employer:false },
    { id:'doc_004', owner_id:'usr_002', owner_type:'user', type:'permis',
      expires_at:'2026-08-20', status:'expire', validated_by_employer:false },
    { id:'doc_005', owner_id:'usr_002', owner_type:'user', type:'fco_fimo',
      expires_at:'2026-08-21', status:'expire', validated_by_employer:false },
    { id:'doc_006', owner_id:'usr_003', owner_type:'user', type:'permis',
      expires_at:'2027-06-10', status:'valide', validated_by_employer:true },
    { id:'doc_007', owner_id:'veh_001', owner_type:'vehicle', type:'controle_technique',
      expires_at:'2026-09-15', status:'a_renouveler', validated_by_employer:false },
    { id:'doc_008', owner_id:'veh_004', owner_type:'vehicle', type:'controle_technique',
      expires_at:'2026-08-20', status:'expire', validated_by_employer:false }
  ],
  invitations: [
    { code:'INV-AMT-2026-A7B3', company_id:'cmp_001', type:'illimite',
      created_at:'2026-08-15T09:00:00Z', expires_at:null, used_at:null,
      used_by_user_id:null, status:'pending' }
  ],
  sessions: [], segments: [], feuillets: [],
  reports: [], alerts: [
    { id:'alt_001', user_id:'usr_001', type:'conduite_journaliere', severity:'critical',
      message:'Martin Dupont a dépassé 9h de conduite (9h02) le 14/08/2026.',
      triggered_at:'2026-08-14T16:00:02Z', resolved_at:null },
    { id:'alt_002', user_id:'usr_002', type:'document_expire', severity:'critical',
      message:'Permis de Christine Lefèvre expiré.',
      triggered_at:'2026-08-20T00:00:00Z', resolved_at:null },
    { id:'alt_003', user_id:'veh_001', type:'document_expire', severity:'warning',
      message:'Contrôle technique DX-847-AZ expire dans 30 jours.',
      triggered_at:'2026-08-16T00:00:00Z', resolved_at:null }
  ],
  audit_log: [],
  tokens_invitation_illimite: []
};
```

- [ ] **Étape 4 : Appeler S2W.init() dans les deux fichiers**

Dans chaque fichier, à la fin du bloc `<script>`, avant la fermeture `</script>` :

```javascript
// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
  S2W.init();
  // ... appels init existants (horloge, animations, etc.)
});
```

- [ ] **Étape 5 : Vérifier la persistance**

Ouvrir `app-web.html` dans Chrome → Inspecter → Application → localStorage → vérifier que `start2way_data` contient l'objet complet avec `_initialized: true`.

---

## Tâche 2 : Correction du chronomètre mobile (état vierge)

**Fichiers :**
- Modifier : `app-mobile.html` (JS + HTML du timer)

**Interfaces :**
- Consomme : module S2W (Tâche 1)
- Produit : fonctions `startTimer()`, `pauseTimer()`, `stopTimer()` qui lisent/écrivent dans `S2W.table('sessions')` et `S2W.table('segments')`

- [ ] **Étape 1 : Corriger l'état HTML initial du chronomètre**

Dans `app-mobile.html`, localiser le bloc du timer et remplacer les valeurs hardcodées :

```html
<!-- AVANT -->
<div class="timer-state active" id="timer-state">En cours — Conduite (A)</div>
<div class="timer-display" id="timer-display">04:28:03</div>

<!-- APRÈS -->
<div class="timer-state idle" id="timer-state" aria-live="polite">
  Aucune session en cours
</div>
<div class="timer-display" id="timer-display" aria-label="Temps écoulé" aria-live="off">
  00:00:00
</div>
<div class="timer-cat" id="timer-cat">
  Appuyez sur Démarrer pour débuter votre journée
</div>
```

- [ ] **Étape 2 : Corriger l'état initial des boutons**

```html
<!-- Démarrer : actif -->
<button class="action-btn-main btn-start" id="btn-start" onclick="startTimer()"
  aria-label="Démarrer la session de travail">
  <span class="btn-icon" aria-hidden="true">▶</span>
  <span class="btn-label">Démarrer</span>
</button>

<!-- Pause : désactivé initialement -->
<button class="action-btn-main btn-pause" id="btn-pause" onclick="pauseTimer()"
  disabled aria-label="Mettre en pause" aria-disabled="true">
  <span class="btn-icon" aria-hidden="true">⏸</span>
  <span class="btn-label">Pause</span>
</button>

<!-- Arrêter : désactivé initialement -->
<button class="action-btn-main btn-stop" id="btn-stop" onclick="stopTimer()"
  disabled aria-label="Arrêter la session" aria-disabled="true">
  <span class="btn-icon" aria-hidden="true">⏹</span>
  <span class="btn-label">Arrêter</span>
</button>
```

- [ ] **Étape 3 : Réécrire la logique de state machine du chronomètre**

Remplacer les fonctions `startTimer`, `pauseTimer`, `stopTimer` existantes :

```javascript
// ─── STATE MACHINE CHRONOMÈTRE ────────────────────────────────────────
let timerState = 'idle'; // idle | running | paused
let timerInterval = null;
let sessionStartTime = null;
let segmentStartTime = null;
let currentCategory = null;
let elapsedSeconds = 0;

function setTimerUI(state, category = null) {
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnStop  = document.getElementById('btn-stop');
  const stateEl  = document.getElementById('timer-state');
  const catEl    = document.getElementById('timer-cat');

  btnStart.disabled = state !== 'idle';
  btnPause.disabled = state !== 'running';
  btnStop.disabled  = state === 'idle';
  btnStart.setAttribute('aria-disabled', state !== 'idle');
  btnPause.setAttribute('aria-disabled', state !== 'running');
  btnStop.setAttribute('aria-disabled', state === 'idle');

  const catLabels = { A:'Conduite', B:'Autre travail', C:'Disponibilité', D:'Repos' };
  stateEl.className = `timer-state ${state}`;

  if (state === 'idle') {
    stateEl.textContent = 'Aucune session en cours';
    catEl.textContent = 'Appuyez sur Démarrer pour débuter votre journée';
  } else if (state === 'running') {
    stateEl.textContent = `En cours — ${catLabels[category] || 'Conduite'} (${category || 'A'})`;
    catEl.textContent = '';
  } else if (state === 'paused') {
    stateEl.textContent = 'En pause';
    catEl.textContent = 'Sélectionnez la catégorie de pause';
  }
}

function startTimer() {
  if (timerState !== 'idle') return;
  timerState = 'running';
  currentCategory = 'A';
  sessionStartTime = new Date().toISOString();
  segmentStartTime = Date.now();
  elapsedSeconds = 0;

  // Créer la session dans localStorage
  const session = {
    id: 'ses_' + Date.now(), user_id: 'usr_001', vehicle_id: 'veh_001',
    date: new Date().toISOString().slice(0,10),
    started_at: sessionStartTime, stopped_at: null, status: 'active'
  };
  S2W.push('sessions', session);
  window._currentSessionId = session.id;

  setTimerUI('running', 'A');
  timerInterval = setInterval(tickTimer, 1000);

  // Feedback haptic
  if (navigator.vibrate) navigator.vibrate(50);
}

function pauseTimer() {
  if (timerState !== 'running') return;
  clearInterval(timerInterval);
  timerState = 'paused';
  setTimerUI('paused');
  openPauseModal();
}

function stopTimer() {
  if (timerState === 'idle') return;
  clearInterval(timerInterval);
  timerState = 'idle';

  // Fermer la session dans localStorage
  S2W.update('sessions', window._currentSessionId, {
    stopped_at: new Date().toISOString(), status: 'closed'
  });
  window._currentSessionId = null;

  setTimerUI('idle');
  elapsedSeconds = 0;
  document.getElementById('timer-display').textContent = '00:00:00';

  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  // Proposer de voir le feuillet
  setTimeout(() => {
    if (confirm('Session terminée. Voir le feuillet du jour ?')) switchTab('feuillet');
  }, 500);
}

function tickTimer() {
  elapsedSeconds++;
  const h = Math.floor(elapsedSeconds / 3600).toString().padStart(2,'0');
  const m = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2,'0');
  const s = (elapsedSeconds % 60).toString().padStart(2,'0');
  document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
  updateTimeline();
  checkConformityThresholds();
}

function checkConformityThresholds() {
  const MAX_DRIVE = 9 * 3600;      // 9h
  const MAX_NO_PAUSE = 4.5 * 3600; // 4h30
  if (currentCategory === 'A' && elapsedSeconds >= MAX_NO_PAUSE - 300) {
    // Alerte 5 min avant dépassement
    document.getElementById('mob-alert')?.classList.remove('hidden');
  }
}
```

- [ ] **Étape 4 : Vérifier l'état vierge**

Ouvrir `app-mobile.html` → l'affichage doit montrer `00:00:00`, le bouton Démarrer seul actif, les deux autres grisés. Cliquer Démarrer → le chrono démarre. Recharger la page → retour à l'état vierge (pas de session persistée entre rechargements pour le chrono actif).

---

## Tâche 3 : Pages web — Registre unique

**Fichiers :**
- Modifier : `app-web.html` (fonction `switchPage`, ajout du HTML de la page registre)

**Interfaces :**
- Consomme : `S2W.table('users')`, `S2W.table('companies')`, `S2W.table('invitations')`
- Produit : fonctions `renderRegistre()`, `generateInviteCode()`, `registerDepart(userId)` utilisées par les tâches suivantes

- [ ] **Étape 1 : Ajouter la page Registre dans switchPage()**

Dans la fonction `switchPage(page)`, ajouter le cas `'registre'` :

```javascript
case 'registre':
  contentArea.innerHTML = buildPageRegistre();
  renderRegistre();
  break;
```

- [ ] **Étape 2 : Écrire buildPageRegistre()**

```javascript
function buildPageRegistre() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Registre unique du personnel</h1>
      <p class="page-subtitle">12 salariés — AMT Transport</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-secondary" onclick="exportRegistre('csv')">↓ CSV</button>
      <button class="btn btn-secondary" onclick="exportRegistre('pdf')">↓ PDF</button>
      <button class="btn btn-amber" onclick="showInviteModal()">+ Nouveau salarié</button>
    </div>
  </div>
  <div class="filters" role="group" aria-label="Filtres par statut">
    <button class="filter-btn active" data-filter="tous" onclick="filterRegistre('tous',this)">Tous (12)</button>
    <button class="filter-btn" data-filter="actif" onclick="filterRegistre('actif',this)">Actifs (8)</button>
    <button class="filter-btn" data-filter="bloque" onclick="filterRegistre('bloque',this)">Bloqués (2)</button>
    <button class="filter-btn" data-filter="depart" onclick="filterRegistre('depart',this)">Départ (1)</button>
    <button class="filter-btn" data-filter="supprime" onclick="filterRegistre('supprime',this)">Supprimés (1)</button>
  </div>
  <div class="search-bar">
    <input type="search" id="registre-search" placeholder="Rechercher par nom…"
      oninput="renderRegistre()" aria-label="Rechercher un salarié">
  </div>
  <div class="table-container">
    <table class="data-table" id="registre-table" role="grid" aria-label="Registre du personnel">
      <thead>
        <tr>
          <th scope="col">Salarié</th>
          <th scope="col">Permis</th>
          <th scope="col">Statut</th>
          <th scope="col">Entrée</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody id="registre-tbody"></tbody>
    </table>
  </div>`;
}
```

- [ ] **Étape 3 : Écrire renderRegistre()**

```javascript
let _registreFilter = 'tous';

function filterRegistre(filter, btn) {
  _registreFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRegistre();
}

function renderRegistre() {
  const users = S2W.table('users');
  const search = document.getElementById('registre-search')?.value.toLowerCase() || '';
  const tbody = document.getElementById('registre-tbody');
  if (!tbody) return;

  const STATUS_LABELS = {
    actif: { label:'Actif', cls:'badge-success' },
    bloque: { label:'Bloqué', cls:'badge-danger' },
    depart: { label:'Départ enregistré', cls:'badge-warning' },
    supprime: { label:'Supprimé', cls:'badge-muted' },
    'en attente': { label:'En attente', cls:'badge-info' }
  };

  const filtered = users.filter(u => {
    const matchFilter = _registreFilter === 'tous' || u.status === _registreFilter;
    const matchSearch = !search ||
      u.first_name.toLowerCase().includes(search) ||
      u.last_name.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  tbody.innerHTML = filtered.map(u => {
    const s = STATUS_LABELS[u.status] || { label: u.status, cls:'badge-muted' };
    const entryDate = new Date(u.created_at).toLocaleDateString('fr-FR');
    return `
    <tr>
      <td><strong>${u.last_name} ${u.first_name}</strong><br>
        <small class="text-sec">${u.email}</small></td>
      <td><span class="badge badge-neutral">${u.license_category}</span></td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td>${entryDate}</td>
      <td class="actions-cell">
        <button class="action-btn" onclick="generateDriverInvite('${u.id}')"
          title="Générer un code invitation">🔗</button>
        <button class="action-btn" onclick="registerDepart('${u.id}')"
          title="Enregistrer un départ" ${u.status === 'supprime' ? 'disabled' : ''}>🚪</button>
      </td>
    </tr>`;
  }).join('');
}

function exportRegistre(format) {
  const btn = event.target;
  btn.textContent = '⏳ Export…';
  setTimeout(() => {
    btn.textContent = format === 'csv' ? '↓ CSV' : '↓ PDF';
    showToast(`Registre exporté en ${format.toUpperCase()} — ${S2W.table('users').length} salariés`);
  }, 1200);
}
```

- [ ] **Étape 4 : Vérifier**

Naviguer vers Registre → la table affiche 12 lignes. Filtrer par "Actifs" → 8 lignes. Rechercher "Martin" → 1-2 résultats. Cliquer CSV → toast de confirmation.

---

## Tâche 4 : Pages web — Documents

**Fichiers :**
- Modifier : `app-web.html`

**Interfaces :**
- Consomme : `S2W.table('documents')`, `S2W.table('users')`, `S2W.table('vehicles')`
- Produit : fonction `renderDocuments()`, `validateDocument(docId)`, `badgeExpiry(date)`

- [ ] **Étape 1 : Ajouter la page Documents dans switchPage()**

```javascript
case 'documents':
  contentArea.innerHTML = buildPageDocuments();
  renderDocuments();
  break;
```

- [ ] **Étape 2 : Écrire badgeExpiry() — fonction partagée**

```javascript
function badgeExpiry(expiresAt) {
  if (!expiresAt) return '<span class="badge badge-muted">N/A</span>';
  const diff = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return `<span class="badge badge-danger">Expiré</span>`;
  if (diff < 30) return `<span class="badge badge-warning">Expire dans ${Math.ceil(diff)}j</span>`;
  return `<span class="badge badge-success">Valide jusqu'au ${new Date(expiresAt).toLocaleDateString('fr-FR')}</span>`;
}
```

- [ ] **Étape 3 : Écrire renderDocuments()**

```javascript
function buildPageDocuments() {
  return `
  <div class="page-header">
    <div>
      <h1 class="page-title">Suivi des documents</h1>
      <p class="page-subtitle">Salariés et véhicules — AMT Transport</p>
    </div>
  </div>
  <div class="tabs" role="tablist">
    <button class="tab active" role="tab" aria-selected="true"
      onclick="switchDocTab('salaries',this)">Salariés</button>
    <button class="tab" role="tab" aria-selected="false"
      onclick="switchDocTab('vehicules',this)">Véhicules</button>
  </div>
  <div id="doc-tab-content"></div>`;
}

let _docTab = 'salaries';

function switchDocTab(tab, btn) {
  _docTab = tab;
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected','false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected','true');
  renderDocuments();
}

function renderDocuments() {
  const container = document.getElementById('doc-tab-content');
  if (!container) return;
  const docs = S2W.table('documents');

  if (_docTab === 'salaries') {
    const users = S2W.table('users').filter(u => u.status !== 'supprime');
    container.innerHTML = `<table class="data-table" aria-label="Documents salariés">
      <thead><tr><th>Salarié</th><th>Permis</th><th>FCO/FIMO</th><th>Visite médicale</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => {
        const permis = docs.find(d => d.owner_id === u.id && d.type === 'permis');
        const fco    = docs.find(d => d.owner_id === u.id && d.type === 'fco_fimo');
        const visite = docs.find(d => d.owner_id === u.id && d.type === 'visite_medicale');
        return `<tr>
          <td><strong>${u.last_name} ${u.first_name}</strong></td>
          <td>${badgeExpiry(permis?.expires_at)}</td>
          <td>${badgeExpiry(fco?.expires_at)}</td>
          <td>${badgeExpiry(visite?.expires_at)}</td>
          <td><button class="action-btn" onclick="validateDocument('${u.id}')"
            title="Valider manuellement">✓</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } else {
    const vehicles = S2W.table('vehicles');
    container.innerHTML = `<table class="data-table" aria-label="Documents véhicules">
      <thead><tr><th>Véhicule</th><th>Carte grise</th><th>Assurance</th><th>CT</th></tr></thead>
      <tbody>${vehicles.map(v => `<tr>
        <td><strong>${v.plate_number}</strong><br><small>${v.brand_model}</small></td>
        <td>${badgeExpiry(v.documents?.carte_grise?.expires_at)}</td>
        <td>${badgeExpiry(v.documents?.assurance?.expires_at)}</td>
        <td>${badgeExpiry(v.documents?.controle_technique?.expires_at)}</td>
      </tr>`).join('')}</tbody></table>`;
  }
}
```

- [ ] **Étape 4 : Vérifier**

Naviguer vers Documents → onglet Salariés : badges rouge (Lefèvre), orange (Martin visite méd.), verts (autres). Onglet Véhicules : CT DX-847-AZ en orange, CT MN-974-QA en rouge.

---

## Tâche 5 : Pages web — Flotte

**Fichiers :**
- Modifier : `app-web.html`

**Interfaces :**
- Consomme : `S2W.table('vehicles')`
- Produit : `renderFlotte()`, `addVehicle()`, `showVehicleDetail(id)`

- [ ] **Étape 1 : Ajouter dans switchPage()**

```javascript
case 'flotte':
  contentArea.innerHTML = buildPageFlotte();
  renderFlotte();
  break;
```

- [ ] **Étape 2 : Écrire renderFlotte()**

```javascript
function buildPageFlotte() {
  return `
  <div class="page-header">
    <div><h1 class="page-title">Gestion de la flotte</h1>
      <p class="page-subtitle">8 véhicules — AMT Transport</p></div>
    <button class="btn btn-amber" onclick="addVehicle()">+ Ajouter un véhicule</button>
  </div>
  <div class="grid-cards" id="flotte-grid"></div>`;
}

function renderFlotte() {
  const vehicles = S2W.table('vehicles');
  const grid = document.getElementById('flotte-grid');
  if (!grid) return;
  grid.innerHTML = vehicles.map(v => {
    const ctStatus = v.documents?.controle_technique?.status || 'inconnu';
    const ctBadge = ctStatus === 'valide' ? 'badge-success'
      : ctStatus === 'a_renouveler' ? 'badge-warning' : 'badge-danger';
    return `
    <div class="vehicle-card" onclick="showVehicleDetail('${v.id}')" role="button"
      tabindex="0" aria-label="Voir détails ${v.plate_number}">
      <div class="vehicle-card-header">
        <span class="vehicle-plate">${v.plate_number}</span>
        <span class="badge ${ctBadge}">CT ${ctStatus.replace('_',' ')}</span>
      </div>
      <div class="vehicle-model">${v.brand_model}</div>
      <div class="vehicle-meta">
        <span>${(v.max_weight_kg/1000).toFixed(1)}t</span>
        <span>${v.tachograph_equipped ? '🕐 Tachy' : 'Sans tachy'}</span>
        <span>${v.last_known_km.toLocaleString('fr-FR')} km</span>
      </div>
    </div>`;
  }).join('');
}

function addVehicle() { showToast('Formulaire d\'ajout véhicule — Disponible en production'); }
function showVehicleDetail(id) { showToast(`Fiche véhicule ${id} — Détail complet en production`); }
```

- [ ] **Étape 3 : Vérifier**

Page Flotte → 8 cartes. CT de MN-974-QA en badge rouge. CT de DX-847-AZ en orange.

---

## Tâche 6 : Pages web — Rapports DREAL

**Fichiers :**
- Modifier : `app-web.html`

**Interfaces :**
- Consomme : `S2W.table('users')`, `S2W.sha256()`, constante `SECRET_KEY_LOCAL`
- Produit : `generateReport()` qui calcule un hash SHA-256 dynamique

- [ ] **Étape 1 : Ajouter dans switchPage()**

```javascript
case 'rapports':
  contentArea.innerHTML = buildPageRapports();
  break;
```

- [ ] **Étape 2 : Écrire buildPageRapports() + generateDrealReport()**

```javascript
function buildPageRapports() {
  const users = S2W.table('users').filter(u => u.status === 'actif');
  const userOptions = users.map(u =>
    `<option value="${u.id}">${u.last_name} ${u.first_name}</option>`
  ).join('');
  return `
  <div class="page-header">
    <h1 class="page-title">Rapports DREAL</h1>
    <p class="page-sub">Génération et planification des rapports de conformité</p>
  </div>
  <div class="report-form card">
    <div class="form-row">
      <div class="form-group">
        <label for="report-period">Période</label>
        <select id="report-period" class="form-control">
          <option value="1j">1 jour</option>
          <option value="7j" selected>7 jours</option>
          <option value="1m">1 mois</option>
          <option value="1an">1 an</option>
          <option value="5ans">5 ans</option>
          <option value="custom">Personnalisé</option>
        </select>
      </div>
      <div class="form-group">
        <label for="report-drivers">Conducteurs</label>
        <select id="report-drivers" multiple class="form-control" size="4">
          <option value="tous" selected>Tous les conducteurs</option>
          ${userOptions}
        </select>
      </div>
    </div>
    <div class="form-row" id="custom-dates" style="display:none">
      <div class="form-group">
        <label for="report-start">Du</label>
        <input type="date" id="report-start" class="form-control">
      </div>
      <div class="form-group">
        <label for="report-end">Au</label>
        <input type="date" id="report-end" class="form-control">
      </div>
    </div>
    <button class="btn btn-amber" id="btn-generate-report"
      onclick="generateDrealReport()">Générer le rapport</button>
  </div>
  <div id="report-result" style="display:none" class="card report-result">
    <div class="report-preview-header">
      <span class="badge badge-success">✓ Rapport généré</span>
      <div id="report-hash-display" class="hash-display"></div>
    </div>
    <div class="report-preview-body" id="report-preview-body"></div>
    <div class="report-actions">
      <button class="btn btn-secondary" onclick="showToast('Téléchargement PDF simulé')">↓ PDF</button>
      <button class="btn btn-secondary" onclick="copyReportHash()">⎘ Copier le hash</button>
    </div>
  </div>`;
}

async function generateDrealReport() {
  const btn = document.getElementById('btn-generate-report');
  const period = document.getElementById('report-period').value;
  btn.textContent = '⏳ Calcul du hash…';
  btn.disabled = true;

  // Hash dynamique : SHA-256(company_id + période + timestamp ISO)
  const timestamp = new Date().toISOString();
  const company = S2W.table('companies')[0];
  const payload = `${company?.id}|${period}|${timestamp}|${SECRET_KEY_LOCAL}`;
  const hash = await S2W.sha256(payload);

  setTimeout(() => {
    btn.textContent = 'Générer le rapport';
    btn.disabled = false;

    const resultEl = document.getElementById('report-result');
    const hashEl   = document.getElementById('report-hash-display');
    const previewEl = document.getElementById('report-preview-body');

    resultEl.style.display = 'block';
    window._lastReportHash = hash;

    hashEl.innerHTML = `
      <p class="hash-label">Hash d'intégrité SHA-256</p>
      <p class="hash-value" id="hash-value">${hash}</p>
      <p class="hash-meta">Généré le ${new Date().toLocaleDateString('fr-FR')} à
        ${new Date().toLocaleTimeString('fr-FR')} — Chaque génération produit un hash unique</p>`;

    const users = S2W.table('users').filter(u => u.status === 'actif').slice(0,3);
    previewEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Conducteur</th><th>Permis</th><th>Statut conformité</th><th>Alertes</th></tr></thead>
        <tbody>${users.map(u => `<tr>
          <td>${u.last_name} ${u.first_name}</td>
          <td>${u.license_category}</td>
          <td><span class="badge badge-success">Conforme</span></td>
          <td>0</td>
        </tr>`).join('')}
        </tbody>
      </table>`;

    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 1500);
}

function copyReportHash() {
  navigator.clipboard.writeText(window._lastReportHash || '')
    .then(() => showToast('Hash copié dans le presse-papiers'))
    .catch(() => showToast('Copie non disponible — sélectionnez le hash manuellement'));
}
```

- [ ] **Étape 3 : Vérifier**

Page Rapports → sélectionner "7 jours" → cliquer Générer → après 1.5s, le rapport apparaît avec un hash SHA-256 de 64 caractères. Cliquer à nouveau Générer → le hash est différent (timestamp change).

---

## Tâche 7 : Pages web — Archives

**Fichiers :**
- Modifier : `app-web.html`

**Interfaces :**
- Consomme : `S2W.table('documents')`, `S2W.table('reports')`
- Produit : `renderArchives()`, `restoreFromTrash(id)`

- [ ] **Étape 1 : Ajouter dans switchPage()**

```javascript
case 'archives':
  contentArea.innerHTML = buildPageArchives();
  renderArchives('documents');
  break;
```

- [ ] **Étape 2 : Écrire renderArchives()**

```javascript
function buildPageArchives() {
  return `
  <div class="page-header"><h1 class="page-title">Archives</h1></div>
  <div class="tabs" role="tablist">
    <button class="tab active" role="tab" onclick="renderArchives('documents',this)">Documents</button>
    <button class="tab" role="tab" onclick="renderArchives('rapports',this)">Rapports</button>
    <button class="tab" role="tab" onclick="renderArchives('corbeille',this)">🗑 Corbeille (2)</button>
  </div>
  <div id="archives-content" class="archive-list"></div>`;
}

function renderArchives(tab, btn) {
  if (btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const el = document.getElementById('archives-content');
  if (!el) return;

  const docs = S2W.table('documents');
  const now = new Date();
  const months3 = new Date(now - 90 * 24 * 3600 * 1000).toISOString();

  if (tab === 'documents') {
    const recent = docs.filter(d => !d.hidden_at && d.created_at >= months3);
    el.innerHTML = recent.length
      ? recent.map(d => `<div class="archive-item">
          <span class="archive-type">${d.type.replace('_',' ')}</span>
          <span class="archive-owner">${d.owner_id}</span>
          <span class="badge ${d.status === 'valide' ? 'badge-success' : 'badge-warning'}">${d.status}</span>
          <span class="archive-date">${new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
        </div>`).join('')
      : '<p class="empty-state">Aucun document récent</p>';
  } else if (tab === 'rapports') {
    el.innerHTML = '<p class="empty-state">Aucun rapport généré en dehors de la session — les rapports apparaissent ici après génération.</p>';
  } else {
    // Corbeille : documents avec hidden_at
    const trashed = docs.filter(d => d.hidden_at);
    el.innerHTML = trashed.length
      ? trashed.map(d => `<div class="archive-item">
          <span class="archive-type">${d.type}</span>
          <span class="badge badge-muted">Supprimé</span>
          <button class="action-btn" onclick="restoreFromTrash('${d.id}')">↩ Restaurer</button>
        </div>`).join('')
      : '<p class="empty-state">Corbeille vide</p>';
  }
}

function restoreFromTrash(id) {
  S2W.update('documents', id, { hidden_at: null });
  showToast('Document restauré');
  renderArchives('corbeille');
}
```

- [ ] **Étape 3 : Vérifier**

Page Archives → onglet Documents : liste des docs récents. Onglet Corbeille : 0 éléments (les docs mockés n'ont pas `hidden_at`). Appeler `S2W.update('documents','doc_001',{hidden_at:new Date().toISOString()})` en console → Corbeille affiche 1 élément → Restaurer le remet à 0.

---

## Tâche 8 : Formulaire Inscription Employeur (6 sections)

**Fichiers :**
- Modifier : `app-web.html` (modale ou nouvelle page)

**Interfaces :**
- Consomme : `S2W.push('companies', ...)`, `S2W.encodeIban()`
- Produit : formulaire multi-étapes accessible avec validation et redirection dashboard

- [ ] **Étape 1 : Créer la structure HTML du formulaire multi-étapes**

Dans `showInviteModal()` ou une nouvelle fonction `showEmployeurForm()`, injecter :

```javascript
function showEmployeurForm() {
  const modal = document.getElementById('invite-modal');
  modal.innerHTML = `
  <div class="modal-box modal-large" role="dialog" aria-modal="true"
    aria-labelledby="form-title">
    <div class="modal-header">
      <h2 id="form-title">Inscription Employeur — AMT Transport</h2>
      <button class="modal-close" onclick="closeModal()" aria-label="Fermer">✕</button>
    </div>
    <div class="stepper" role="navigation" aria-label="Étapes du formulaire">
      ${[1,2,3,4,5,6].map(i => `
      <div class="step ${i===1?'active':''}" id="step-dot-${i}" aria-label="Étape ${i}">${i}</div>
      `).join('<div class="step-line"></div>')}
    </div>
    <form id="employer-form" novalidate>
      <div id="form-section-1" class="form-section active">
        <h3>Section 1 — Identification</h3>
        <div class="form-group">
          <label for="f-legal-name">Dénomination sociale *</label>
          <input type="text" id="f-legal-name" class="form-control" required
            placeholder="Ex: AMT Transport" autocomplete="organization">
        </div>
        <div class="form-group">
          <label for="f-trade-name">Enseigne commerciale</label>
          <input type="text" id="f-trade-name" class="form-control" placeholder="Optionnel">
        </div>
        <div class="form-group">
          <label for="f-legal-form">Forme juridique *</label>
          <select id="f-legal-form" class="form-control" required>
            <option value="">Choisir…</option>
            ${['EI','EURL','SARL','SAS','SASU','SA','SCA','SNC','SCI','SELARL','SELAS','SC','Autre']
              .map(f=>`<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="f-capital">Capital social (€)</label>
          <input type="number" id="f-capital" class="form-control" placeholder="Optionnel" min="0">
        </div>
      </div>

      <div id="form-section-2" class="form-section">
        <h3>Section 2 — Immatriculation</h3>
        <div class="form-group">
          <label for="f-siren">SIREN *</label>
          <input type="text" id="f-siren" class="form-control" required maxlength="9"
            pattern="[0-9]{9}" placeholder="9 chiffres" inputmode="numeric">
        </div>
        <div class="form-group">
          <label for="f-siret">SIRET *</label>
          <input type="text" id="f-siret" class="form-control" required maxlength="14"
            pattern="[0-9]{14}" placeholder="14 chiffres" inputmode="numeric">
        </div>
        <div class="form-group">
          <label for="f-naf">Code NAF/APE</label>
          <input type="text" id="f-naf" class="form-control" value="49.41A"
            placeholder="Ex: 49.41A — Transport routier de fret">
        </div>
        <div class="form-group">
          <label for="f-vat">TVA intracommunautaire</label>
          <input type="text" id="f-vat" class="form-control" placeholder="FR + 11 chiffres">
        </div>
        <div class="form-group">
          <label for="f-rcs">Ville du RCS/RNE</label>
          <input type="text" id="f-rcs" class="form-control" placeholder="Ex: Bobigny">
        </div>
      </div>

      <div id="form-section-3" class="form-section">
        <h3>Section 3 — Coordonnées</h3>
        <div class="form-group">
          <label for="f-address">Adresse *</label>
          <input type="text" id="f-address" class="form-control" required
            placeholder="Numéro et rue" autocomplete="street-address">
        </div>
        <div class="form-row">
          <div class="form-group"><label for="f-postal">Code postal *</label>
            <input type="text" id="f-postal" class="form-control" required maxlength="5"
              placeholder="75000" inputmode="numeric" autocomplete="postal-code"></div>
          <div class="form-group"><label for="f-city">Ville *</label>
            <input type="text" id="f-city" class="form-control" required
              placeholder="Paris" autocomplete="address-level2"></div>
        </div>
        <div class="form-group">
          <label for="f-phone">Téléphone *</label>
          <input type="tel" id="f-phone" class="form-control" required
            placeholder="01 23 45 67 89" autocomplete="tel">
        </div>
        <div class="form-group">
          <label for="f-email-co">Email professionnel *</label>
          <input type="email" id="f-email-co" class="form-control" required
            placeholder="contact@entreprise.fr" autocomplete="email">
        </div>
      </div>

      <div id="form-section-4" class="form-section">
        <h3>Section 4 — Représentant légal</h3>
        <div class="form-row">
          <div class="form-group"><label for="f-rep-first">Prénom *</label>
            <input type="text" id="f-rep-first" class="form-control" required
              placeholder="Jean" autocomplete="given-name"></div>
          <div class="form-group"><label for="f-rep-last">Nom *</label>
            <input type="text" id="f-rep-last" class="form-control" required
              placeholder="Dupont" autocomplete="family-name"></div>
        </div>
        <div class="form-group"><label for="f-rep-role">Fonction *</label>
          <input type="text" id="f-rep-role" class="form-control" required
            placeholder="Gérant / Directeur général…"></div>
      </div>

      <div id="form-section-5" class="form-section">
        <h3>Section 5 — Coordonnées bancaires</h3>
        <div class="security-notice">
          🔒 Vos coordonnées bancaires sont chiffrées localement. Aucune donnée bancaire n'est stockée en clair.
        </div>
        <div class="form-group"><label for="f-account-holder">Titulaire du compte *</label>
          <input type="text" id="f-account-holder" class="form-control" required
            placeholder="Nom du titulaire" autocomplete="name"></div>
        <div class="form-group"><label for="f-iban">IBAN *</label>
          <input type="text" id="f-iban" class="form-control" required
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            maxlength="34" oninput="formatIban(this)"></div>
        <div class="form-group"><label for="f-bic">BIC/SWIFT *</label>
          <input type="text" id="f-bic" class="form-control" required
            placeholder="BNPAFRPP" maxlength="11"></div>
      </div>

      <div id="form-section-6" class="form-section">
        <h3>Section 6 — Identifiants de connexion</h3>
        <div class="form-group"><label for="f-login-email">Email de connexion *</label>
          <input type="email" id="f-login-email" class="form-control" required
            placeholder="votre@email.com" autocomplete="username email"></div>
        <div class="form-group"><label for="f-pwd">Mot de passe *</label>
          <input type="password" id="f-pwd" class="form-control" required
            minlength="8" placeholder="Minimum 8 caractères" autocomplete="new-password"
            oninput="updatePasswordStrength(this.value)">
          <div id="pwd-strength" class="password-strength"></div></div>
        <div class="form-group"><label for="f-pwd2">Confirmation *</label>
          <input type="password" id="f-pwd2" class="form-control" required
            placeholder="Répéter le mot de passe" autocomplete="new-password"></div>
        <div class="form-group checkbox-group">
          <label><input type="checkbox" id="f-cgu" required>
            J'accepte les <a href="#" onclick="return false">Conditions Générales d'Utilisation</a></label>
        </div>
        <div class="form-group checkbox-group">
          <label><input type="checkbox" id="f-geo" required>
            Je reconnais que START2WAY collecte ma géolocalisation de manière ponctuelle
            (prise et cessation de service uniquement), conformément à la CNIL.</label>
        </div>
      </div>
    </form>

    <div class="modal-footer">
      <button class="btn btn-secondary" id="btn-prev-section" onclick="prevSection()"
        style="display:none">← Précédent</button>
      <button class="btn btn-amber" id="btn-next-section" onclick="nextSection()">
        Suivant →</button>
    </div>
  </div>`;
  modal.style.display = 'flex';
  _currentSection = 1;
}
```

- [ ] **Étape 2 : Écrire la navigation multi-étapes et la soumission**

```javascript
let _currentSection = 1;
const TOTAL_SECTIONS = 6;

function nextSection() {
  if (!validateSection(_currentSection)) return;
  if (_currentSection === TOTAL_SECTIONS) {
    submitEmployerForm();
    return;
  }
  goToSection(_currentSection + 1);
}

function prevSection() {
  if (_currentSection > 1) goToSection(_currentSection - 1);
}

function goToSection(n) {
  document.getElementById(`form-section-${_currentSection}`)?.classList.remove('active');
  document.getElementById(`step-dot-${_currentSection}`)?.classList.remove('active');
  document.getElementById(`step-dot-${_currentSection}`)?.classList.add('done');
  _currentSection = n;
  document.getElementById(`form-section-${n}`)?.classList.add('active');
  document.getElementById(`step-dot-${n}`)?.classList.add('active');
  document.getElementById('btn-prev-section').style.display = n > 1 ? 'inline-flex' : 'none';
  document.getElementById('btn-next-section').textContent =
    n === TOTAL_SECTIONS ? 'Créer mon compte →' : 'Suivant →';
}

function validateSection(n) {
  const section = document.getElementById(`form-section-${n}`);
  const inputs = section?.querySelectorAll('[required]') || [];
  let valid = true;
  inputs.forEach(input => {
    input.classList.remove('input-error');
    if (!input.value.trim() || (input.type === 'checkbox' && !input.checked)) {
      input.classList.add('input-error');
      valid = false;
    }
  });
  if (!valid) showToast('Veuillez remplir tous les champs obligatoires (*)');
  return valid;
}

function formatIban(input) {
  let v = input.value.replace(/\s/g,'').toUpperCase();
  v = v.replace(/(.{4})/g, '$1 ').trim();
  input.value = v;
}

function updatePasswordStrength(pwd) {
  const el = document.getElementById('pwd-strength');
  if (!el) return;
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r=>r.test(pwd)).length;
  const labels = ['','Faible','Moyen','Fort','Très fort'];
  const classes = ['','strength-weak','strength-medium','strength-strong','strength-very-strong'];
  el.className = `password-strength ${classes[score]}`;
  el.textContent = score > 0 ? labels[score] : '';
}

async function submitEmployerForm() {
  const pwd = document.getElementById('f-pwd').value;
  const pwd2 = document.getElementById('f-pwd2').value;
  if (pwd !== pwd2) { showToast('Les mots de passe ne correspondent pas'); return; }

  const ibanRaw = document.getElementById('f-iban').value.replace(/\s/g,'');
  const newCompany = {
    id: 'cmp_' + Date.now(),
    legal_name: document.getElementById('f-legal-name').value,
    legal_form: document.getElementById('f-legal-form').value,
    siren: document.getElementById('f-siren').value,
    siret: document.getElementById('f-siret').value,
    naf_ape: document.getElementById('f-naf').value,
    email: document.getElementById('f-email-co').value,
    phone: document.getElementById('f-phone').value,
    address_street: document.getElementById('f-address').value,
    address_postal_code: document.getElementById('f-postal').value,
    address_city: document.getElementById('f-city').value,
    address_country: 'France',
    rep_first_name: document.getElementById('f-rep-first').value,
    rep_last_name: document.getElementById('f-rep-last').value,
    rep_function: document.getElementById('f-rep-role').value,
    iban_encoded: S2W.encodeIban(ibanRaw),
    bic_swift: document.getElementById('f-bic').value,
    status: 'active',
    created_at: new Date().toISOString()
  };

  S2W.push('companies', newCompany);
  closeModal();
  showToast(`Compte créé pour ${newCompany.legal_name} — Bienvenue sur START2WAY !`);
}
```

- [ ] **Étape 3 : Vérifier**

Cliquer "+ Nouveau salarié" → modale en 6 sections apparaît. Naviguer section par section. Section 5 : affiche le message de sécurité bancaire. Saisir un IBAN → auto-formatage FR76 XXXX... Section 6 : indicateur de force du mot de passe. Valider → toast de confirmation, modale fermée, nouvelle entreprise dans `localStorage.start2way_data.companies`.

---

## Tâche 9 : Formulaire Inscription Salarié

**Fichiers :**
- Modifier : `app-web.html`

**Interfaces :**
- Consomme : `S2W.table('invitations')`, `S2W.push('users', ...)`
- Produit : `showSalarieForm()`, `verifyInviteCode()`, `submitSalarieForm()`

- [ ] **Étape 1 : Écrire showSalarieForm()**

```javascript
function showSalarieForm() {
  const modal = document.getElementById('invite-modal');
  modal.innerHTML = `
  <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="sal-form-title">
    <div class="modal-header">
      <h2 id="sal-form-title">Créer mon compte conducteur</h2>
      <button class="modal-close" onclick="closeModal()" aria-label="Fermer">✕</button>
    </div>
    <div id="step-code" class="form-section active">
      <h3>Étape 1 — Code d'invitation</h3>
      <p class="form-hint">Votre employeur vous a communiqué un code d'invitation.</p>
      <div class="form-group">
        <label for="f-invite-code">Code d'invitation *</label>
        <input type="text" id="f-invite-code" class="form-control" required
          placeholder="INV-XXXX-XXXX-XXXX" oninput="this.value=this.value.toUpperCase()"
          autocomplete="off">
      </div>
      <div id="code-feedback" class="code-feedback" aria-live="polite"></div>
      <button class="btn btn-amber" onclick="verifyInviteCode()">Vérifier le code</button>
    </div>
    <div id="step-infos" class="form-section" style="display:none">
      <h3>Étape 2 — Informations personnelles</h3>
      <div id="company-badge" class="company-confirmed"></div>
      <div class="form-row">
        <div class="form-group"><label for="f-sal-last">Nom *</label>
          <input type="text" id="f-sal-last" class="form-control" required
            placeholder="DUPONT" autocomplete="family-name"></div>
        <div class="form-group"><label for="f-sal-first">Prénom *</label>
          <input type="text" id="f-sal-first" class="form-control" required
            placeholder="Martin" autocomplete="given-name"></div>
      </div>
      <div class="form-group"><label for="f-sal-license">Catégorie de permis *</label>
        <select id="f-sal-license" class="form-control" required>
          <option value="">Choisir…</option>
          <option value="VL">VL — Véhicule Léger (&lt; 3,5t)</option>
          <option value="PL">PL — Poids Lourd (≥ 3,5t)</option>
        </select>
      </div>
      <div class="form-group"><label for="f-sal-phone">Téléphone *</label>
        <input type="tel" id="f-sal-phone" class="form-control" required
          placeholder="06 XX XX XX XX" autocomplete="tel"></div>
      <div class="form-group"><label for="f-sal-email">Email *</label>
        <input type="email" id="f-sal-email" class="form-control" required
          placeholder="votre@email.com" autocomplete="username email"></div>
      <div class="form-group"><label for="f-sal-pwd">Mot de passe *</label>
        <input type="password" id="f-sal-pwd" class="form-control" required
          minlength="8" placeholder="Minimum 8 caractères" autocomplete="new-password"></div>
      <button class="btn btn-amber" onclick="submitSalarieForm()">Créer mon compte →</button>
    </div>
  </div>`;
  modal.style.display = 'flex';
}

function verifyInviteCode() {
  const code = document.getElementById('f-invite-code').value.trim();
  const feedback = document.getElementById('code-feedback');
  const invitations = S2W.table('invitations');
  const inv = invitations.find(i => i.code === code && !i.used_at);

  if (!inv) {
    feedback.className = 'code-feedback error';
    feedback.textContent = '❌ Code invalide, expiré ou déjà utilisé. Contactez votre employeur.';
    return;
  }

  const company = S2W.find('companies', inv.company_id);
  window._pendingInvite = inv;
  window._pendingCompany = company;

  document.getElementById('step-code').style.display = 'none';
  const stepInfos = document.getElementById('step-infos');
  stepInfos.style.display = 'block';
  document.getElementById('company-badge').innerHTML =
    `✅ Entreprise confirmée : <strong>${company?.legal_name || inv.company_id}</strong>`;
}

function submitSalarieForm() {
  const required = ['f-sal-last','f-sal-first','f-sal-license','f-sal-phone','f-sal-email','f-sal-pwd'];
  const allFilled = required.every(id => document.getElementById(id)?.value.trim());
  if (!allFilled) { showToast('Veuillez remplir tous les champs obligatoires'); return; }

  const newUser = {
    id: 'usr_' + Date.now(),
    company_id: window._pendingCompany?.id || 'cmp_001',
    last_name: document.getElementById('f-sal-last').value.toUpperCase(),
    first_name: document.getElementById('f-sal-first').value,
    license_category: document.getElementById('f-sal-license').value,
    phone: document.getElementById('f-sal-phone').value,
    email: document.getElementById('f-sal-email').value,
    role: 'salarie', status: 'actif',
    created_at: new Date().toISOString()
  };

  S2W.push('users', newUser);
  if (window._pendingInvite) {
    S2W.update('invitations', window._pendingInvite.code, {
      used_at: new Date().toISOString(), used_by_user_id: newUser.id
    });
  }
  closeModal();
  showToast(`Compte créé pour ${newUser.first_name} ${newUser.last_name} — Bienvenue !`);
}
```

- [ ] **Étape 2 : Vérifier**

Appeler `showSalarieForm()` → saisir `INV-AMT-2026-A7B3` → cliquer Vérifier → l'étape 2 s'affiche avec "Entreprise confirmée : AMT Transport". Remplir le formulaire → soumettre → nouvel utilisateur dans `localStorage.start2way_data.users`.

---

## Tâche 10 : Onglets mobile — Feuillet quotidien

**Fichiers :**
- Modifier : `app-mobile.html`

**Interfaces :**
- Consomme : `S2W.table('feuillets')`, `S2W.table('sessions')`, règles métier (E+D=24h)
- Produit : `renderFeuillet(date)`, vérification conformité, signature PIN

- [ ] **Étape 1 : Écrire renderFeuillet()**

Dans `switchTab('feuillet')`, appeler `renderFeuillet()` :

```javascript
function renderFeuillet(targetDate) {
  const date = targetDate || new Date().toISOString().slice(0,10);
  const tab = document.getElementById('tab-content-feuillet');
  if (!tab) return;

  // Données mockées journée du 15/08
  const feuillet15 = {
    date: '2026-08-15', user: 'Martin Dupont',
    A: 7*3600, B: 2*3600+45*60, C: 30*60, D: 13*3600+45*60
  };
  const feuillet14 = {
    date: '2026-08-14', user: 'Martin Dupont',
    A: 9*3600+2*60, B: 0, C: 0, D: 14*3600-2*60
  };

  const data = date === '2026-08-15' ? feuillet15 : date === '2026-08-14' ? feuillet14 : null;
  const fmt = (sec) => {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
    return `${h}h${m.toString().padStart(2,'0')}`;
  };

  if (!data) {
    tab.innerHTML = `<p class="empty-state">Aucune journée enregistrée pour le ${date}.</p>`;
    return;
  }

  const E = data.A + data.B + data.C;
  const total = E + data.D;
  const check24 = Math.abs(total - 24*3600) < 60; // tolérance 1 min
  const conforme = data.A <= 9*3600 && check24;

  tab.innerHTML = `
  <div class="feuillet-header">
    <h2>Feuillet du ${new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2>
    <span class="badge ${conforme ? 'badge-success' : 'badge-danger'}">
      ${conforme ? '✓ Conforme' : '✗ Non conforme'}
    </span>
  </div>
  <div class="feuillet-date-nav">
    <input type="date" value="${date}" class="form-control"
      onchange="renderFeuillet(this.value)" aria-label="Sélectionner une date">
  </div>
  <table class="feuillet-table" role="grid" aria-label="Détail du feuillet quotidien">
    <thead>
      <tr><th>Cat.</th><th>Libellé</th><th>Durée</th></tr>
    </thead>
    <tbody>
      <tr class="row-A"><td><strong>A</strong></td><td>Conduite</td><td>${fmt(data.A)}</td></tr>
      <tr class="row-B"><td><strong>B</strong></td><td>Autre travail</td><td>${fmt(data.B)}</td></tr>
      <tr class="row-C"><td><strong>C</strong></td><td>Disponibilité</td><td>${fmt(data.C)}</td></tr>
      <tr class="row-D"><td><strong>D</strong></td><td>Repos</td><td>${fmt(data.D)}</td></tr>
      <tr class="row-E total"><td colspan="2"><strong>E (A+B+C)</strong></td><td><strong>${fmt(E)}</strong></td></tr>
      <tr class="row-total ${check24 ? '' : 'error'}">
        <td colspan="2">E + D = ${check24 ? '✓ 24h' : '✗ ' + fmt(total)}</td>
        <td><strong>${fmt(total)}</strong></td>
      </tr>
    </tbody>
  </table>
  ${!conforme ? `<div class="alert-card red" role="alert">
    <strong>Non conforme :</strong> Conduite = ${fmt(data.A)} (max 9h).
    Infraction à l'article R3315-1 du Code des transports.
  </div>` : ''}
  <div class="feuillet-signature">
    <h3>Signature de fin de journée</h3>
    <div class="pin-input">
      <label for="pin-code">Code PIN (4 chiffres)</label>
      <input type="password" id="pin-code" maxlength="4" inputmode="numeric"
        pattern="[0-9]{4}" placeholder="••••" class="form-control pin-field">
      <button class="btn btn-amber" onclick="signFeuillet('${date}')">Signer</button>
    </div>
  </div>
  <button class="btn btn-secondary" style="margin-top:12px"
    onclick="exportFeuillet('${date}')">↓ Exporter en PDF</button>`;
}

function signFeuillet(date) {
  const pin = document.getElementById('pin-code')?.value;
  if (pin?.length !== 4) { showMobToast('Saisissez un code PIN de 4 chiffres'); return; }
  if (navigator.vibrate) navigator.vibrate(50);
  showMobToast(`Feuillet du ${date} signé et verrouillé ✓`);
}

function exportFeuillet(date) {
  showMobToast('Export PDF simulé — Disponible en production');
}

function showMobToast(msg) {
  let t = document.getElementById('mob-toast');
  if (!t) { t = document.createElement('div'); t.id='mob-toast'; document.body.appendChild(t); }
  t.className = 'mob-toast show';
  t.textContent = msg;
  setTimeout(() => t.classList.remove('show'), 3000);
}
```

- [ ] **Étape 2 : Vérifier**

Onglet Feuillet → date du 15/08 : tableau A=7h, B=2h45, C=0h30, D=13h45, E+D=24h ✓, badge Conforme. Changer la date sur 14/08 → A=9h02, badge Non conforme, alerte rouge R3315-1.

---

## Tâche 11 : Onglets mobile — Historique

**Fichiers :**
- Modifier : `app-mobile.html`

**Interfaces :**
- Consomme : `S2W.table('feuillets')`, données mockées 30 jours
- Produit : `renderHistorique()`, liste cliquable → feuillet détaillé

- [ ] **Étape 1 : Générer les 30 journées mockées**

Ajouter dans MOCK_DATA (ou dans la fonction d'init) :

```javascript
// Génération des 30 dernières journées mockées pour Martin Dupont
function generateMockHistory() {
  const sessions = [], feuillets = [];
  const today = new Date('2026-08-16');
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0,10);
    // Journées non conformes : j=2, j=8, j=15
    const nonConf = [2,8,15].includes(i);
    const conduite = nonConf ? 9*3600+Math.floor(Math.random()*600+60) : 7*3600+Math.floor(Math.random()*3600);
    const autre = 2*3600+Math.floor(Math.random()*1800);
    const dispo = 30*60;
    const repos = 24*3600 - conduite - autre - dispo;
    const sid = `ses_hist_${i}`;
    sessions.push({ id:sid, user_id:'usr_001', vehicle_id:'veh_001',
      date:dateStr, started_at:`${dateStr}T06:00:00Z`,
      stopped_at:`${dateStr}T16:00:00Z`, status:'closed' });
    feuillets.push({ id:`feu_hist_${i}`, session_id:sid,
      total_a:Math.floor(conduite/3600)+'h'+Math.floor((conduite%3600)/60).toString().padStart(2,'0'),
      total_b:Math.floor(autre/3600)+'h'+Math.floor((autre%3600)/60).toString().padStart(2,'0'),
      total_c:'0h30', total_d:Math.floor(repos/3600)+'h'+Math.floor((repos%3600)/60).toString().padStart(2,'0'),
      status: nonConf ? 'non_conforme' : 'conforme',
      generated_at:`${dateStr}T16:01:00Z` });
  }
  return { sessions, feuillets };
}
```

Appeler cette fonction dans `S2W.init()` et fusionner les résultats.

- [ ] **Étape 2 : Écrire renderHistorique()**

```javascript
function renderHistorique() {
  const tab = document.getElementById('tab-content-historique');
  if (!tab) return;
  const feuillets = S2W.table('feuillets').filter(f => f.session_id?.startsWith('ses_hist'));
  const sorted = feuillets.sort((a,b) => b.generated_at.localeCompare(a.generated_at));

  tab.innerHTML = `
  <div class="historique-header">
    <h2>Historique — 30 derniers jours</h2>
    <input type="date" id="hist-search-date" class="form-control"
      oninput="filterHistorique(this.value)" aria-label="Rechercher par date">
  </div>
  <div id="hist-list">
    ${sorted.map((f,i) => {
      const conf = f.status === 'conforme';
      const date = new Date(f.generated_at).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
      return `<div class="hist-item" onclick="renderFeuillet('${f.generated_at.slice(0,10)}')"
        role="button" tabindex="0" aria-label="Voir feuillet du ${date}">
        <div class="hist-date">${date}</div>
        <div class="hist-totals">A:${f.total_a} B:${f.total_b}</div>
        <span class="badge ${conf ? 'badge-success' : 'badge-danger'} badge-sm">
          ${conf ? 'Conforme' : 'Non conforme'}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function filterHistorique(dateVal) {
  const items = document.querySelectorAll('.hist-item');
  items.forEach(item => {
    const show = !dateVal || item.getAttribute('aria-label')?.includes(dateVal);
    item.style.display = show ? '' : 'none';
  });
}
```

- [ ] **Étape 3 : Vérifier**

Onglet Historique → 30 lignes. 3 badges rouges (Non conforme). Tap sur une ligne → affiche le feuillet de cette journée dans l'onglet Feuillet.

---

## Tâche 12 : Onglet mobile — Profil

**Fichiers :**
- Modifier : `app-mobile.html`

**Interfaces :**
- Consomme : `S2W.find('users','usr_001')`, `S2W.table('documents')`
- Produit : `renderProfil()`

- [ ] **Étape 1 : Écrire renderProfil()**

```javascript
function renderProfil() {
  const tab = document.getElementById('tab-content-profil');
  if (!tab) return;
  const user = S2W.find('users','usr_001');
  const docs = S2W.table('documents').filter(d => d.owner_id === 'usr_001');
  const company = S2W.find('companies', user?.company_id);

  const docTypes = { permis:'Permis de conduire', fco_fimo:'FCO/FIMO', visite_medicale:'Visite médicale' };

  tab.innerHTML = `
  <div class="profil-card">
    <div class="profil-avatar" aria-hidden="true">${user?.first_name?.charAt(0)}${user?.last_name?.charAt(0)}</div>
    <h2 class="profil-name">${user?.first_name} ${user?.last_name}</h2>
    <span class="badge badge-neutral">${user?.license_category} — Poids Lourd</span>
  </div>

  <div class="profil-section">
    <h3>Documents</h3>
    ${docs.map(d => {
      const diff = (new Date(d.expires_at) - new Date()) / (1000*60*60*24);
      const cls = diff < 0 ? 'badge-danger' : diff < 30 ? 'badge-warning' : 'badge-success';
      const label = diff < 0 ? 'Expiré'
        : diff < 30 ? `Expire dans ${Math.ceil(diff)}j`
        : `Valide — ${new Date(d.expires_at).toLocaleDateString('fr-FR')}`;
      return `<div class="doc-row">
        <span class="doc-label">${docTypes[d.type] || d.type}</span>
        <span class="badge ${cls}">${label}</span>
      </div>`;
    }).join('')}
  </div>

  <div class="profil-section">
    <h3>Entreprise</h3>
    <div class="profil-company">${company?.legal_name || 'Non renseignée'}</div>
    <button class="btn btn-secondary btn-sm" onclick="showMobToast('Fonctionnalité disponible en production')">
      ✉ Contacter l'employeur
    </button>
  </div>

  <div class="profil-section">
    <h3>Contact d'urgence</h3>
    <p>${user?.emergency_contact || 'Non renseigné'}</p>
  </div>

  <div class="profil-section">
    <h3>Informations de connexion</h3>
    <p class="text-sec">${user?.email}</p>
  </div>`;
}
```

- [ ] **Étape 2 : Vérifier**

Onglet Profil → affiche Martin Dupont, PL, AMT Transport. Badge orange sur Visite médicale (expire dans 14 jours). Badge vert sur Permis et FCO/FIMO.

---

## Tâche 13 : pitch-deck.html

**Fichiers :**
- Créer : `pitch-deck.html`

**Interfaces :**
- Produit : fichier HTML standalone avec les 3 actes, liens vers les deux apps

- [ ] **Étape 1 : Créer pitch-deck.html**

Nouveau fichier standalone (même design system Navy/Amber/Papier) avec :

**Structure HTML :**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>START2WAY — Présentation commerciale</title>
  <!-- même liens Google Fonts -->
  <style>
    /* design tokens identiques à app-web.html */
    /* layout: slides scrollables verticalement */
    /* chaque .slide = 100vh avec centrage flexbox */
  </style>
</head>
<body>
  <!-- Navigation fixe : barre de progression + boutons actes -->
  <!-- Acte 1 : problème (slide 1) -->
  <!-- Acte 2 : solution (slide 2 — avec 2 CTA) -->
  <!-- Acte 3 : offre pilote (slide 3) -->
  <!-- Guide de navigation (accordéon) -->
  <!-- Footer : contact start2way.contact@gmail.com -->
</body>
</html>
```

- [ ] **Étape 2 : Implémenter le contenu des 3 actes**

Acte 1 — Le problème :
- Illustration du LIC papier (carré avec lignes de tableau, style document)
- 3 cards problème : Remplissage manuel / Aucune alerte / Responsabilité floue
- Chiffres-clés : `1 500€` / `5 ans d'archivage` / `Contrôle DREAL sans préavis`

Acte 2 — La solution :
- 2 boutons CTA côte à côte : "📱 App Conducteur" (→ app-mobile.html) + "💻 Dashboard Employeur" (→ app-web.html)
- Accordéon "Guide de démo" avec 2 sections : Mobile (5 étapes) + Web (5 étapes)

Acte 3 — L'offre :
- Carte offre pilote : `14,99€/mois`, 2 conducteurs inclus, `4,99€` par conducteur supp.
- Badge "5 entreprises pilotes" + "6 mois offerts"
- CTA : `mailto:start2way.contact@gmail.com`

- [ ] **Étape 3 : Vérifier**

Ouvrir pitch-deck.html → 3 slides scrollables. Les 2 boutons CTA ouvrent les bonnes apps. L'accordéon s'ouvre et se ferme. Le CTA email ouvre le client mail.

---

## Auto-révision du plan (obligatoire — exécuter avant de livrer)

- [ ] **Couverture spec :** Toutes les pages web (Registre ✓, Documents ✓, Flotte ✓, Rapports ✓, Archives ✓) + formulaires (Employeur ✓, Salarié ✓) + onglets mobile (Feuillet ✓, Historique ✓, Profil ✓) + correction chrono ✓ + pitch-deck ✓ + localStorage ✓
- [ ] **Placeholders :** Aucun TBD ou TODO dans ce plan
- [ ] **Cohérence types :** `S2W.table()`, `S2W.push()`, `S2W.update()`, `S2W.find()` utilisés uniformément dans toutes les tâches
- [ ] **Règles métier :** 9h, 4h30, 45 min, 11h présentes dans la vérification (Tâche 2 et 10)
- [ ] **Hash dynamique :** `S2W.sha256()` utilise `crypto.subtle.digest` (Web Crypto API native)
- [ ] **IBAN chiffré :** `S2W.encodeIban()` = btoa (simulation), `S2W.maskIban()` pour l'affichage

---

## Exécution

**Plan complet sauvegardé dans `docs/plans/2026-08-16-start2way-s1-plan.md`.**

Deux options d'exécution :

**1. Exécution directe (recommandé pour ce plan)** — Les 13 tâches sont indépendantes et séquentielles. L'agent les exécute une par une dans cette session, en testant chaque livrable avant de passer à la suivante.

**2. Tâche par tâche (si session longue)** — Exécuter les Tâches 1-3 dans une première session, puis 4-9 (web), puis 10-13 (mobile + pitch).
