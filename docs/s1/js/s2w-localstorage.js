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
  // CONFIGURATION AIRTABLE — DÉMO CONNECTÉE
  // NOTE DE SÉCURITÉ : Les identifiants de connexion Airtable sont saisis via une interface utilisateur
  // sécurisée au premier chargement et stockés localement dans le localStorage du navigateur client.
  // En production, toutes les requêtes Airtable doivent transiter par un serveur backend sécurisé.
  // CONFIGURATION AIRTABLE — SUPPRIMÉE LORS DE LA MIGRATION D2B
  // Le client s'adresse uniquement au serveur local (façade Legacy Airtable)
  TABLES_LIST: ['companies', 'users', 'sessions', 'messages', 'alerts', 'reprise_codes', 'event_logs', 'reopen_logs', 'vehicles', 'documents', 'invitations', 'reports', 'day_declarations', 'expeditions', 'expedition_events', 'expedition_anomalies', 'expedition_vehicle_usages', 'service_entitlements', 'circuit_runs', 'circuit_stops', 'circuit_stop_events'],

  /* Lecture complète du cache local */
  get() {
    try { return JSON.parse(localStorage.getItem(S2W_KEY)) || {}; }
    catch { return {}; }
  },

  /* Écriture complète du cache local */
  set(data) {
    try { localStorage.setItem(S2W_KEY, JSON.stringify(data)); }
    catch (e) { console.error('[S2W] Erreur écriture localStorage :', e); }
  },

  /* Lecture d'une table (synchrone depuis le cache) */
  table(name) {
    const d = this.get();
    return Array.isArray(d[name]) ? d[name] : [];
  },

  /* Ajout d'un enregistrement (synchrone + push asynchrone) */
  push(name, record, options = {}) {
    const d = this.get();
    if (!Array.isArray(d[name])) d[name] = [];
    d[name].push(record);
    this.set(d);
    

    
    return record;
  },

  /* Mise à jour partielle par id (synchrone + patch asynchrone) */
  update(name, id, patch, options = {}) {
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

  /* Recherche par id (synchrone) */
  find(name, id) {
    return this.table(name).find(r => r.id === id || r.code === id) || null;
  },

  /* Recherche par champ (synchrone) */
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

  /* ─── INITIALISATION ─── */
  async init() {
    console.log('[S2W] Initialisation du cache de données...');
    const existing = this.get();
    
    if (existing._initialized) {
      await this.migrateEmployments();
      return;
    }
    
    const cache = {};
    for (const tableName of this.TABLES_LIST) {
      cache[tableName] = [];
    }
    
    cache._initialized = true;
    cache._version = '1.0.0';
    cache._created_at = new Date().toISOString();
    this.set(cache);
    await this.migrateEmployments();
    console.log('[S2W] Cache initialisé localement.');
  },

  async migrateEmployments() {
    console.log('[S2W] Exécution de la migration Employments...');
    const data = this.get();
    data.employments = data.employments || [];
    data.migration_logs = data.migration_logs || [];
    let modified = false;

    // 1. Migrate Users to Employments
    const users = data.users || [];
    console.log('[S2W] migrateEmployments called. data.users length:', users.length, JSON.stringify(users));
    for (const user of users) {
      if (user.type === 'employee' && user.company_id) {
        const existing = data.employments.find(e => e.user_id === user.id && e.company_id === user.company_id);
        if (!existing) {
          const emp = {
            id: 'emp_' + Math.random().toString(36).substr(2, 9),
            user_id: user.id,
            company_id: user.company_id,
            status: user.status === 'depart' ? 'depart' : 'active',
            created_at: new Date().toISOString(),
            depart_at: user.depart_at || null
          };
          data.employments.push(emp);
          modified = true;
          // Note: On évite un push asynchrone massif, la sync se fera via le mécanisme global
        }
      }
    }

    // 2. Migrate Sessions
    const sessions = data.sessions || [];
    for (const session of sessions) {
      if (!session.employment_id) {
        const userEmps = data.employments.filter(e => e.user_id === session.user_id);
        if (userEmps.length === 1) {
          session.employment_id = userEmps[0].id;
          modified = true;
        } else if (userEmps.length > 1) {
          data.migration_logs.push({ entity: 'session', id: session.id, issue: 'MIGRATION_AMBIGUOUS' });
          modified = true;
        }
      }
    }

    // 3. Migrate Feuillets
    const feuillets = data.feuillets || [];
    for (const feuillet of feuillets) {
      if (!feuillet.employment_id) {
        // Retrouver le user_id via la session
        const session = sessions.find(s => s.id === feuillet.session_id);
        if (session && session.employment_id) {
          feuillet.employment_id = session.employment_id;
          modified = true;
        } else if (session) {
          const userEmps = data.employments.filter(e => e.user_id === session.user_id);
          if (userEmps.length === 1) {
            feuillet.employment_id = userEmps[0].id;
            modified = true;
          } else {
            data.migration_logs.push({ entity: 'feuillet', id: feuillet.id, issue: 'MIGRATION_AMBIGUOUS' });
            modified = true;
          }
        }
      }
    }

    if (modified) {
      this.set(data);
      console.log('[S2W] Migration Employments terminée avec succès.');
    } else {
      console.log('[S2W] Aucune donnée à migrer pour Employments.');
    }
  },

  /* Réinitialisation complète (Données + Déconnexion) */
  async reset() {
    await this.ensureCredentials();
    console.log('[S2W] Lancement du reset...');
    // Supprimer le cache local
    localStorage.removeItem(S2W_KEY);
    // Vider également la base distante Airtable pour les prochains tests
    await this.clearAirtableTables();
    // Recréer le cache local vide
    await this.init();
    console.log('[S2W] Reset complet effectué (local et distant vides).');
  }
};

/* ─── EXPORT GLOBAL ─────────────────────────────────────────────────────── */
window.S2W = S2W;
window.SECRET_KEY_LOCAL = SECRET_KEY_LOCAL;
