/* ==========================================================================
   START2WAY — Module localStorage S2W
   Core CRUD + Mock Data AMT Transport + SHA-256 dynamique
   Version : S1 (démo HTML standalone)
   ========================================================================== */

'use strict';

const S2W_KEY = 'start2way_data';
const SECRET_KEY_LOCAL = 'S2W-LOCAL-DEMO-KEY-2026';

/* ─── CRUD ─────────────────────────────────────────────────────────────── */
const S2W = {

  /* Lecture complète */
  get() {
    try { return JSON.parse(localStorage.getItem(S2W_KEY)) || {}; }
    catch { return {}; }
  },

  /* Écriture complète */
  set(data) {
    try { localStorage.setItem(S2W_KEY, JSON.stringify(data)); }
    catch (e) { console.error('[S2W] Erreur écriture localStorage :', e); }
  },

  /* Lecture d'une table */
  table(name) {
    const d = this.get();
    return Array.isArray(d[name]) ? d[name] : [];
  },

  /* Ajout d'un enregistrement */
  push(name, record) {
    const d = this.get();
    if (!Array.isArray(d[name])) d[name] = [];
    d[name].push(record);
    this.set(d);
    return record;
  },

  /* Mise à jour partielle par id */
  update(name, id, patch) {
    const d = this.get();
    if (!Array.isArray(d[name])) return false;
    const idx = d[name].findIndex(r => r.id === id || r.code === id);
    if (idx === -1) return false;
    d[name][idx] = { ...d[name][idx], ...patch };
    this.set(d);
    return d[name][idx];
  },

  /* Suppression logique (soft delete) */
  softDelete(name, id) {
    return this.update(name, id, { hidden_at: new Date().toISOString() });
  },

  /* Restauration depuis corbeille */
  restore(name, id) {
    return this.update(name, id, { hidden_at: null, restored_at: new Date().toISOString() });
  },

  /* Recherche par id */
  find(name, id) {
    return this.table(name).find(r => r.id === id || r.code === id) || null;
  },

  /* Recherche par champ */
  findWhere(name, field, value) {
    return this.table(name).filter(r => r[field] === value);
  },

  /* ─── SÉCURITÉ ─── */
  /* ─── ENVELOPE ENCRYPTION (AES-256-GCM + KMS simulé) ─── */
  KMS_KEK_HEX: "4a65616e4475706f6e744b4d534b6579537461727432576179456e76656c6f70",

  async getKmsKek() {
    const rawKey = new Uint8Array(this.KMS_KEK_HEX.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  },

  async encryptIbanEnvelope(rawPlaintext) {
    const cleanIban = rawPlaintext.replace(/\s/g, '');
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(cleanIban);

    const dekBytes = crypto.getRandomValues(new Uint8Array(32));
    const dekKey = await crypto.subtle.importKey(
      "raw",
      dekBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    const ibanIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedIbanBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: ibanIv },
      dekKey,
      dataBytes
    );
    const encryptedIbanArray = new Uint8Array(encryptedIbanBuffer);

    const kekKey = await this.getKmsKek();
    const dekIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedDekBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: dekIv },
      kekKey,
      dekBytes
    );
    const wrappedDekArray = new Uint8Array(wrappedDekBuffer);

    const toB64 = (arr) => btoa(String.fromCharCode.apply(null, arr));
    
    const envelope = {
      cipher: toB64(encryptedIbanArray),
      wrapped_dek: toB64(wrappedDekArray),
      iban_iv: toB64(ibanIv),
      dek_iv: toB64(dekIv)
    };

    return JSON.stringify(envelope);
  },

  async decryptIbanEnvelope(envelopeJson) {
    // SIMULATION DÉMO — déchiffrement réel à faire côté serveur en prod (la clé KEK ne doit jamais être exposée côté client)
    try {
      const envelope = JSON.parse(envelopeJson);
      const fromB64 = (str) => new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));
      
      const cipherBytes = fromB64(envelope.cipher);
      const wrappedDekBytes = fromB64(envelope.wrapped_dek);
      const ibanIvBytes = fromB64(envelope.iban_iv);
      const dekIvBytes = fromB64(envelope.dek_iv);

      const kekKey = await this.getKmsKek();
      const unwrappedDekBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: dekIvBytes },
        kekKey,
        wrappedDekBytes
      );
      const dekBytes = new Uint8Array(unwrappedDekBuffer);

      const dekKey = await crypto.subtle.importKey(
        "raw",
        dekBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decryptedIbanBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ibanIvBytes },
        dekKey,
        cipherBytes
      );

      const decoder = new TextEncoder();
      return decoder.decode(decryptedIbanBuffer);
    } catch (e) {
      console.error("Erreur de déchiffrement de l'enveloppe :", e);
      return "";
    }
  },

  encodeIban(raw) {
    try { return btoa(unescape(encodeURIComponent(raw.replace(/\s/g, '')))); }
    catch { return ''; }
  },
  decodeIban(encoded) {
    try { return decodeURIComponent(escape(atob(encoded))); }
    catch { return ''; }
  },
  maskIban(raw) {
    if (!raw) return '';
    const clean = raw.replace(/\s/g, '');
    if (clean.length < 8) return clean;
    return clean.slice(0, 4) + ' ●●●● ●●●● ●●●● ' + clean.slice(-3);
  },

  /* ─── SHA-256 dynamique (Web Crypto API) ─── */
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async computeSegmentHash(segment) {
    const payload = [
      segment.session_id, segment.category,
      segment.started_at, segment.ended_at,
      segment.duration_sec, SECRET_KEY_LOCAL
    ].join('|');
    return this.sha256(payload);
  },

  async computeReportHash(companyId, periodStart, periodEnd) {
    const timestamp = new Date().toISOString();
    const payload = `${companyId}|${periodStart}|${periodEnd}|${timestamp}|${SECRET_KEY_LOCAL}`;
    return this.sha256(payload);
  },

  /* ─── INITIALISATION ─── */
  async init() {
    const existing = this.get();
    
    // Si déjà initialisé, s'assurer que l'IBAN par défaut est chiffré en enveloppe
    if (existing._initialized) {
      if (existing.companies && existing.companies.length > 0) {
        const c = existing.companies[0];
        if (!c.iban || !c.iban.startsWith('{')) {
          const raw = c.iban || this.decodeIban(c.iban_encoded) || 'FR7630006000011234567890123';
          c.iban = await this.encryptIbanEnvelope(raw);
          this.set(existing);
        }
      }
      return;
    }
    
    const history = _generateMockHistory();
    const base = JSON.parse(JSON.stringify(MOCK_DATA));
    base.sessions = [...(base.sessions || []), ...history.sessions];
    base.feuillets = [...(base.feuillets || []), ...history.feuillets];
    
    // Chiffrer l'IBAN de base lors de la toute première init
    if (base.companies && base.companies.length > 0) {
      const c = base.companies[0];
      const raw = c.iban || this.decodeIban(c.iban_encoded) || 'FR7630006000011234567890123';
      c.iban = await this.encryptIbanEnvelope(raw);
    }

    base._initialized = true;
    base._version = '1.0.0';
    base._created_at = new Date().toISOString();
    this.set(base);
    console.log('[S2W] Données mockées AMT Transport initialisées avec enveloppe IBAN.');
  },

  /* Réinitialisation (debug) */
  async reset() {
    localStorage.removeItem(S2W_KEY);
    await this.init();
    console.log('[S2W] Réinitialisation et ré-initialisation de l\'enveloppe effectuées.');
  }
};

/* ─── DONNÉES MOCKÉES AMT TRANSPORT ────────────────────────────────────── */
const MOCK_DATA = {

  companies: [{
    id: 'cmp_001',
    legal_name: 'AMT Transport',
    trade_name: 'AMT',
    legal_form: 'SAS',
    siren: '105185496',
    siret: '10518549600012',
    naf_ape: '49.41A',
    vat_number: 'FR105185496',
    rcs_city: 'Bobigny',
    address_street: '122 avenue de la Résistance',
    address_complement: '',
    address_postal_code: '93340',
    address_city: 'Le Raincy',
    address_country: 'France',
    phone: '01 49 39 00 46',
    email: 'contact@amttransport.fr',
    website: '',
    rep_first_name: 'Jean',
    rep_last_name: 'Dupont',
    rep_function: 'Gérant',
    iban_encoded: 'RlI3NjMwMDA2MDAwMDExMjM0NTY3ODkwMTg5',
    bic_swift: 'SOGEFRPP',
    account_holder: 'AMT Transport SAS',
    status: 'active',
    plan: 'pilote',
    created_at: '2024-01-15T09:00:00Z'
  }],

  users: [
    { id:'usr_001', company_id:'cmp_001', email:'martin.dupont@email.com',
      role:'salarie', first_name:'Martin', last_name:'Dupont',
      license_category:'PL', phone:'06 12 34 56 78',
      emergency_contact:'Marie Dupont — 06 87 65 43 21',
      status:'actif', created_at:'2024-02-01T08:00:00Z', hidden_at:null },
    { id:'usr_002', company_id:'cmp_001', email:'christine.lefevre@email.com',
      role:'salarie', first_name:'Christine', last_name:'Lefèvre',
      license_category:'PL', phone:'06 23 45 67 89', status:'bloque',
      created_at:'2024-02-15T08:00:00Z', hidden_at:null },
    { id:'usr_003', company_id:'cmp_001', email:'jpierre.martin@email.com',
      role:'salarie', first_name:'Jean-Pierre', last_name:'Martin',
      license_category:'PL', phone:'06 34 56 78 90', status:'actif',
      created_at:'2024-03-01T08:00:00Z', hidden_at:null },
    { id:'usr_004', company_id:'cmp_001', email:'karim.benali@email.com',
      role:'salarie', first_name:'Karim', last_name:'Benali',
      license_category:'VL', phone:'06 45 67 89 01', status:'actif',
      created_at:'2024-03-15T08:00:00Z', hidden_at:null },
    { id:'usr_005', company_id:'cmp_001', email:'sophie.morel@email.com',
      role:'salarie', first_name:'Sophie', last_name:'Morel',
      license_category:'PL', phone:'06 56 78 90 12', status:'actif',
      created_at:'2024-04-01T08:00:00Z', hidden_at:null },
    { id:'usr_006', company_id:'cmp_001', email:'thomas.roux@email.com',
      role:'salarie', first_name:'Thomas', last_name:'Roux',
      license_category:'PL', phone:'06 67 89 01 23', status:'actif',
      created_at:'2024-04-15T08:00:00Z', hidden_at:null },
    { id:'usr_007', company_id:'cmp_001', email:'lucie.gerard@email.com',
      role:'salarie', first_name:'Lucie', last_name:'Gérard',
      license_category:'VL', phone:'06 78 90 12 34', status:'actif',
      created_at:'2024-05-01T08:00:00Z', hidden_at:null },
    { id:'usr_008', company_id:'cmp_001', email:'olivier.petit@email.com',
      role:'salarie', first_name:'Olivier', last_name:'Petit',
      license_category:'PL', phone:'06 89 01 23 45', status:'actif',
      created_at:'2024-05-15T08:00:00Z', hidden_at:null },
    { id:'usr_009', company_id:'cmp_001', email:'nathalie.simon@email.com',
      role:'salarie', first_name:'Nathalie', last_name:'Simon',
      license_category:'VL', phone:'06 90 12 34 56', status:'actif',
      created_at:'2024-06-01T08:00:00Z', hidden_at:null },
    { id:'usr_010', company_id:'cmp_001', email:'marc.leblanc@email.com',
      role:'salarie', first_name:'Marc', last_name:'Leblanc',
      license_category:'PL', phone:'06 01 23 45 67', status:'depart',
      depart_at:'2026-07-31T18:00:00Z', created_at:'2024-06-15T08:00:00Z', hidden_at:null },
    { id:'usr_011', company_id:'cmp_001', email:'valerie.henry@email.com',
      role:'salarie', first_name:'Valérie', last_name:'Henry',
      license_category:'VL', phone:'06 12 23 34 45', status:'bloque',
      created_at:'2024-07-01T08:00:00Z', hidden_at:null },
    { id:'usr_012', company_id:'cmp_001', email:'pierre.durand@email.com',
      role:'salarie', first_name:'Pierre', last_name:'Durand',
      license_category:'PL', phone:'06 23 34 45 56', status:'supprime',
      hidden_at:'2026-06-01T00:00:00Z', created_at:'2024-07-15T08:00:00Z' }
  ],

  vehicles: [
    { id:'veh_001', company_id:'cmp_001', plate_number:'DX-847-AZ',
      brand_model:'Renault Master', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:124532, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2026-12-01',status:'valide'},
        controle_technique:{expires_at:'2026-09-15',status:'a_renouveler'} } },
    { id:'veh_002', company_id:'cmp_001', plate_number:'GH-231-BF',
      brand_model:'Mercedes Actros', max_weight_kg:19000, tachograph_equipped:true,
      last_known_km:87643, maintenance_thresholds:{oil_change:20000,tires:50000,inspection:60000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2026-11-15',status:'valide'},
        controle_technique:{expires_at:'2027-02-10',status:'valide'} } },
    { id:'veh_003', company_id:'cmp_001', plate_number:'KL-562-ZP',
      brand_model:'Citroën Jumpy', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:56210, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2027-01-01',status:'valide'},
        controle_technique:{expires_at:'2027-06-15',status:'valide'} } },
    { id:'veh_004', company_id:'cmp_001', plate_number:'MN-974-QA',
      brand_model:'Iveco Daily', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:198432, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2026-10-31',status:'valide'},
        controle_technique:{expires_at:'2026-08-12',status:'expire'} } },
    { id:'veh_005', company_id:'cmp_001', plate_number:'PQ-385-RF',
      brand_model:'Renault Master', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:43210, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2027-02-28',status:'valide'},
        controle_technique:{expires_at:'2027-08-01',status:'valide'} } },
    { id:'veh_006', company_id:'cmp_001', plate_number:'ST-126-WB',
      brand_model:'Scania R450', max_weight_kg:26000, tachograph_equipped:true,
      last_known_km:312540, maintenance_thresholds:{oil_change:25000,tires:60000,inspection:80000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2026-09-30',status:'a_renouveler'},
        controle_technique:{expires_at:'2027-04-15',status:'valide'} } },
    { id:'veh_007', company_id:'cmp_001', plate_number:'UV-453-XC',
      brand_model:'Volkswagen Crafter', max_weight_kg:3500, tachograph_equipped:false,
      last_known_km:78901, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2027-05-31',status:'valide'},
        controle_technique:{expires_at:'2028-01-10',status:'valide'} } },
    { id:'veh_008', company_id:'cmp_001', plate_number:'YZ-789-LD',
      brand_model:'Mercedes Sprinter', max_weight_kg:3500, tachograph_equipped:true,
      last_known_km:22134, maintenance_thresholds:{oil_change:15000,tires:30000,inspection:45000},
      documents:{ carte_grise:{expires_at:null,status:'valide'},
        assurance:{expires_at:'2027-03-15',status:'valide'},
        controle_technique:{expires_at:'2028-07-20',status:'valide'} } }
  ],

  documents: [
    { id:'doc_001', owner_id:'usr_001', owner_type:'user', type:'permis',
      issued_at:'2020-12-01', expires_at:'2028-12-01', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2024-02-01T08:00:00Z' },
    { id:'doc_002', owner_id:'usr_001', owner_type:'user', type:'fco_fimo',
      issued_at:'2022-03-01', expires_at:'2027-03-01', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2024-02-01T08:00:00Z' },
    { id:'doc_003', owner_id:'usr_001', owner_type:'user', type:'visite_medicale',
      issued_at:'2024-08-30', expires_at:'2026-08-30', status:'a_renouveler',
      validated_by_employer:false, hidden_at:null, created_at:'2024-08-30T08:00:00Z' },
    { id:'doc_004', owner_id:'usr_002', owner_type:'user', type:'permis',
      issued_at:'2016-06-01', expires_at:'2026-08-20', status:'expire',
      validated_by_employer:false, hidden_at:null, created_at:'2024-02-15T08:00:00Z' },
    { id:'doc_005', owner_id:'usr_002', owner_type:'user', type:'fco_fimo',
      issued_at:'2021-08-21', expires_at:'2026-08-21', status:'expire',
      validated_by_employer:false, hidden_at:null, created_at:'2024-02-15T08:00:00Z' },
    { id:'doc_006', owner_id:'usr_002', owner_type:'user', type:'visite_medicale',
      issued_at:'2025-01-10', expires_at:'2027-01-10', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2025-01-10T08:00:00Z' },
    { id:'doc_007', owner_id:'usr_003', owner_type:'user', type:'permis',
      issued_at:'2017-06-10', expires_at:'2027-06-10', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2024-03-01T08:00:00Z' },
    { id:'doc_008', owner_id:'usr_003', owner_type:'user', type:'fco_fimo',
      issued_at:'2023-09-15', expires_at:'2028-09-15', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2024-03-01T08:00:00Z' },
    { id:'doc_009', owner_id:'usr_003', owner_type:'user', type:'visite_medicale',
      issued_at:'2025-03-01', expires_at:'2027-03-01', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2025-03-01T08:00:00Z' },
    { id:'doc_010', owner_id:'usr_004', owner_type:'user', type:'permis',
      issued_at:'2019-04-20', expires_at:'2029-04-20', status:'valide',
      validated_by_employer:true, hidden_at:null, created_at:'2024-03-15T08:00:00Z' }
  ],

  invitations: [
    { id:'inv_001', code:'INV-AMT-2026-A7B3', company_id:'cmp_001', type:'illimite',
      created_at:'2026-08-15T09:00:00Z', expires_at:null,
      used_at:null, used_by_user_id:null, status:'pending' }
  ],

  sessions: [
    { id:'ses_ref_15', user_id:'usr_001', vehicle_id:'veh_001',
      date:'2026-08-15', started_at:'2026-08-15T06:00:00Z',
      stopped_at:'2026-08-15T16:15:00Z', status:'closed', signature_type:'PIN' },
    { id:'ses_ref_14', user_id:'usr_001', vehicle_id:'veh_001',
      date:'2026-08-14', started_at:'2026-08-14T05:58:00Z',
      stopped_at:'2026-08-14T16:00:00Z', status:'closed', signature_type:'PIN' }
  ],

  segments: [
    { id:'seg_15_A1', session_id:'ses_ref_15', category:'A',
      started_at:'2026-08-15T06:00:00Z', ended_at:'2026-08-15T10:30:00Z',
      duration_sec:16200, integrity_hash:'a7f3b9c2e8d1f4a6b3c9d2e1f8a4b7c3', locked_at:'2026-08-15T16:15:00Z' },
    { id:'seg_15_B1', session_id:'ses_ref_15', category:'B',
      started_at:'2026-08-15T10:30:00Z', ended_at:'2026-08-15T11:15:00Z',
      duration_sec:2700, integrity_hash:'b8c4a1d3f2e9c7b4a2d1e3f9b7a4c8d2', locked_at:'2026-08-15T16:15:00Z' },
    { id:'seg_15_A2', session_id:'ses_ref_15', category:'A',
      started_at:'2026-08-15T11:15:00Z', ended_at:'2026-08-15T13:30:00Z',
      duration_sec:8100, integrity_hash:'c9d5b2e4f3a8d6c5b3e2f4a8c9d1b5e3', locked_at:'2026-08-15T16:15:00Z' },
    { id:'seg_15_C1', session_id:'ses_ref_15', category:'C',
      started_at:'2026-08-15T13:30:00Z', ended_at:'2026-08-15T14:00:00Z',
      duration_sec:1800, integrity_hash:'d1e6c3f5a4b9e7d6c4f3b5a9d2e6c4f5', locked_at:'2026-08-15T16:15:00Z' },
    { id:'seg_15_A3', session_id:'ses_ref_15', category:'A',
      started_at:'2026-08-15T14:00:00Z', ended_at:'2026-08-15T14:45:00Z',
      duration_sec:2700, integrity_hash:'e2f7d4a6b5c1f8e7d5a4c6b1e3f7d5a6', locked_at:'2026-08-15T16:15:00Z' },
    { id:'seg_15_D1', session_id:'ses_ref_15', category:'D',
      started_at:'2026-08-15T14:45:00Z', ended_at:'2026-08-15T16:15:00Z',
      duration_sec:5400, integrity_hash:'f3a8e5b7c6d2a9f8e6b5d7c2f4a8e6b7', locked_at:'2026-08-15T16:15:00Z' }
  ],

  feuillets: [
    { id:'feu_ref_15', session_id:'ses_ref_15',
      total_a_sec:27000, total_b_sec:2700, total_c_sec:1800, total_d_sec:54900,
      total_a:'7h30', total_b:'0h45', total_c:'0h30', total_d:'15h15',
      status:'conforme', integrity_hash:'b8c4a1d3f2e9c7b4a2d1e3f9b7a4c8d2',
      generated_at:'2026-08-15T16:15:00Z', signed_at:'2026-08-15T16:20:00Z' },
    { id:'feu_ref_14', session_id:'ses_ref_14',
      total_a_sec:32520, total_b_sec:0, total_c_sec:0, total_d_sec:54480,
      total_a:'9h02', total_b:'0h00', total_c:'0h00', total_d:'14h58',
      status:'non_conforme', integrity_hash:'c9d5b2e4f3a8d6c5b3e2f4a8c9d1b5e3',
      generated_at:'2026-08-14T16:00:00Z', signed_at:null }
  ],

  alerts: [
    { id:'alt_001', user_id:'usr_001', type:'conduite_journaliere', severity:'critical',
      message:'Martin Dupont a dépassé 9h de conduite (9h02) le 14/08/2026.',
      triggered_at:'2026-08-14T16:00:02Z', resolved_at:null, acknowledged:true },
    { id:'alt_002', user_id:'usr_002', type:'document_expire', severity:'critical',
      message:'Permis de conduire de Christine Lefèvre expiré (20/08/2026).',
      triggered_at:'2026-08-20T00:00:00Z', resolved_at:null, acknowledged:false },
    { id:'alt_003', user_id:'usr_002', type:'document_expire', severity:'critical',
      message:'FCO/FIMO de Christine Lefèvre expiré (21/08/2026).',
      triggered_at:'2026-08-21T00:00:00Z', resolved_at:null, acknowledged:false },
    { id:'alt_004', owner_id:'veh_001', type:'document_expire', severity:'warning',
      message:'Contrôle technique DX-847-AZ expire dans 30 jours (15/09/2026).',
      triggered_at:'2026-08-16T00:00:00Z', resolved_at:null, acknowledged:false },
    { id:'alt_005', owner_id:'veh_004', type:'document_expire', severity:'critical',
      message:'Contrôle technique MN-974-QA expiré (12/08/2026).',
      triggered_at:'2026-08-12T00:00:00Z', resolved_at:null, acknowledged:false },
    { id:'alt_006', user_id:'usr_001', type:'pause_imminente', severity:'warning',
      message:'Martin Dupont approche de 4h30 sans pause (4h28 en cours).',
      triggered_at:'2026-08-15T10:28:00Z', resolved_at:'2026-08-15T10:30:00Z', acknowledged:true }
  ],

  reports: [],
  audit_log: [],
  tokens_invitation_illimite: [],
  messages: [
    { id: 'msg_001', sender_id: 'gerant', receiver_id: 'usr_001', text: "Bonjour Martin, bienvenue sur START2WAY. N'hésite pas à me contacter ici si besoin.", timestamp: '2026-08-15T09:00:00Z', is_read: true },
    { id: 'msg_002', sender_id: 'usr_001', receiver_id: 'gerant', text: "Merci ! C'est noté, l'application fonctionne très bien.", timestamp: '2026-08-15T09:15:00Z', is_read: true }
  ],
  reprise_codes: []
};

/* ─── GÉNÉRATION HISTORIQUE 30 JOURS ────────────────────────────────────── */
function _generateMockHistory() {
  const sessions = [];
  const feuillets = [];
  const today = new Date('2026-08-16T00:00:00Z');
  const NON_CONF_DAYS = new Set([2, 8, 15]); // jours non conformes (2, 8, 15 jours en arrière)

  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Pas de session le week-end
    const dow = d.getDay(); // 0=dim, 6=sam
    if (dow === 0 || dow === 6) continue;

    const dateStr = d.toISOString().slice(0, 10);
    if (dateStr === '2026-08-14' || dateStr === '2026-08-15') continue;
    const nonConf = NON_CONF_DAYS.has(i);
    const pending = i === 1;

    // Conduite : non conforme = 9h02-9h15, conforme = 6h30-8h45
    const condSec = nonConf
      ? 9 * 3600 + Math.floor(Math.random() * 900 + 120)
      : 6 * 3600 + Math.floor(Math.random() * 8100);

    const autreSec = Math.floor(Math.random() * 3600 + 1800);
    const dispoSec = Math.floor(Math.random() * 1800 + 900);
    const reposSec = 24 * 3600 - condSec - autreSec - dispoSec;

    const fmt = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${h}h${m.toString().padStart(2, '0')}`;
    };

    const sid = `ses_hist_${i}`;
    sessions.push({
      id: sid, user_id: 'usr_001', vehicle_id: 'veh_001',
      date: dateStr,
      started_at: `${dateStr}T06:00:00Z`,
      stopped_at: `${dateStr}T16:00:00Z`,
      status: 'closed', signature_type: pending ? null : 'PIN'
    });

    feuillets.push({
      id: `feu_hist_${i}`, session_id: sid,
      total_a_sec: condSec, total_b_sec: autreSec,
      total_c_sec: dispoSec, total_d_sec: reposSec,
      total_a: fmt(condSec), total_b: fmt(autreSec),
      total_c: fmt(dispoSec), total_d: fmt(reposSec),
      status: pending ? 'en_attente' : nonConf ? 'non_conforme' : 'conforme',
      integrity_hash: `hist_hash_${i}_${dateStr.replace(/-/g,'')}`,
      generated_at: `${dateStr}T16:01:00Z`,
      signed_at: pending ? null : `${dateStr}T16:05:00Z`
    });
  }
  return { sessions, feuillets };
}

/* ─── EXPORT GLOBAL ─────────────────────────────────────────────────────── */
window.S2W = S2W;
window.SECRET_KEY_LOCAL = SECRET_KEY_LOCAL;
window.MOCK_DATA = MOCK_DATA;
