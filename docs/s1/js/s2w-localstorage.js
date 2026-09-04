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
  TABLES_LIST: ['companies', 'users', 'sessions', 'messages', 'alerts', 'reprise_codes', 'event_logs', 'reopen_logs', 'vehicles', 'documents', 'invitations', 'reports', 'day_declarations'],

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
    
    // Si l'option silent est activée, on n'enqueue pas la synchro
    if (!options.silent) {
      if (name !== 'feuillets' && name !== 'employments' && name !== 'day_declarations') {
        this.insertToAirtable(name, record);
      } else {
        if (typeof window !== 'undefined' && window.enqueueSyncOperation) {
          window.enqueueSyncOperation(name, record.id, 'CREATE', record);
        }
      }
    }
    
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
    
    if (!options.silent) {
      if (name !== 'feuillets' && name !== 'employments' && name !== 'day_declarations') {
        this.updateInAirtable(name, id, patch);
      } else {
        if (typeof window !== 'undefined' && window.enqueueSyncOperation) {
          window.enqueueSyncOperation(name, id, 'UPDATE', patch);
        }
      }
    }
    
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

  /* ─── COMMUNICATIONS ET SYNCHRONISATION AIRTABLE ─── */

  _credentialsPromise: null,

  _credentialsPromise: null,

  async ensureCredentials() {
    // Phase D2B: Les credentials frontend sont supprimés. 
    // Le serveur s'occupe de l'authentification Airtable de manière centralisée.
    return true;
  },

  _serializeFields(record) {
    const fields = {};
    for (const [k, v] of Object.entries(record)) {
      if (k.startsWith('_')) continue;
      if (v === null || v === undefined) continue;
      
      // Serialize arrays or objects to JSON string for Airtable multilineText fields
      if (typeof v === 'object') {
        fields[k] = JSON.stringify(v);
      } else {
        fields[k] = v;
      }
    }
    return fields;
  },

  _getLegacyHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-client-type': (typeof window !== 'undefined' && window.START2WAY_CLIENT_TYPE) ? window.START2WAY_CLIENT_TYPE : 'UNKNOWN'
    };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('sessionToken');
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      // Keep x-user-id for backwards compatibility or fallback during signup
      if (window.currentUserId) headers['x-user-id'] = window.currentUserId;
      if (window.currentCompanyId) headers['x-company-id'] = window.currentCompanyId;
    }
    return headers;
  },,


  _deserializeFields(fields) {
    const item = { ...fields };
    const jsonKeys = ['signature_path', 'maintenance_thresholds', 'docs', 'included_dates', 'all_dates', 'stops'];
    for (const key of jsonKeys) {
      if (typeof item[key] === 'string' && item[key].trim().startsWith('[')) {
        try {
          item[key] = JSON.parse(item[key]);
        } catch (e) {
          console.warn(`[S2W] Failed to parse JSON field ${key}:`, e);
        }
      } else if (typeof item[key] === 'string' && item[key].trim().startsWith('{')) {
        try {
          item[key] = JSON.parse(item[key]);
        } catch (e) {
          console.warn(`[S2W] Failed to parse JSON field ${key}:`, e);
        }
      }
    }
    return item;
  },

  async insertToAirtable(tableName, record) {
    await this.ensureCredentials();
    try {
      const fields = this._serializeFields(record);
      
      const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
      const res = await fetch(`${API_URL}/legacy/${tableName}`, {
        method: 'POST',
        headers: this._getLegacyHeaders(),
        body: JSON.stringify({ fields })
      });
      
      if (res.ok) {
        const data = await res.json();
        record._airtable_id = data.id;
        
        // Mettre à jour le cache local avec l'ID Airtable obtenu
        const cache = this.get();
        if (cache[tableName]) {
          const idx = cache[tableName].findIndex(r => r.id === record.id);
          if (idx !== -1) {
            cache[tableName][idx]._airtable_id = data.id;
            this.set(cache);
          }
        }
        console.log(`[S2W] Enregistrement ${record.id} synchronisé dans Airtable (${data.id})`);
      } else {
        console.error(`[S2W] Échec d'écriture dans Airtable pour ${tableName} :`, await res.text());
      }
    } catch (e) {
      console.error(`[S2W] Erreur lors du push Airtable (${tableName}) :`, e);
    }
  },

  async updateInAirtable(tableName, id, patch) {
    await this.ensureCredentials();
    try {
      const cache = this.get();
      const records = cache[tableName] || [];
      const record = records.find(r => r.id === id || r.code === id);
      if (!record || !record._airtable_id) {
        console.warn(`[S2W] Impossible de mettre à jour ${id} sur Airtable : pas encore d'ID distant.`);
        return;
      }

      const fields = this._serializeFields(patch);

      const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
      const res = await fetch(`${API_URL}/legacy/${tableName}/${record._airtable_id}`, {
        method: 'PATCH',
        headers: this._getLegacyHeaders(),
        body: JSON.stringify({ fields })
      });
      
      if (res.ok) {
        console.log(`[S2W] Enregistrement Airtable ${record._airtable_id} mis à jour.`);
      } else {
        const text = await res.text();
        console.error(`[S2W] Échec de mise à jour Airtable pour ${tableName}/${record._airtable_id} :`, text);
        try {
          const body = JSON.parse(text);
          if (res.status === 409 && body.error === 'VERSION_CONFLICT' && body.conflict_id) {
            console.warn('[S2W] VERSION_CONFLICT intercepté en direct (Company). Appel au recheck...');
            
            // Notification UI if available
            if (typeof window !== 'undefined' && window.showToast) {
              window.showToast('Conflit détecté, vérification de la résolution...', 'error');
            }

            const recheckRes = await fetch(`${API_URL}/sync/conflicts/${body.conflict_id}/recheck`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-client-type': 'COMPANY_PANEL',
                'x-company-id': this.get().session?.company_id || ''
              }
            });

            if (recheckRes.ok) {
              const recheckBody = await recheckRes.json();
              if (recheckBody.status === 'RESOLVED_ALREADY_APPLIED') {
                console.log('[S2W] Conflit Company résolu (ALREADY_APPLIED). Application locale.');
                if (recheckBody.central_state && recheckBody.central_state.payload) {
                  const centralPayload = typeof recheckBody.central_state.payload === 'string'
                    ? JSON.parse(recheckBody.central_state.payload)
                    : recheckBody.central_state.payload;
                  
                  const currentData = this.get();
                  if (currentData[tableName]) {
                    const idx = currentData[tableName].findIndex(r => r.id === id);
                    if (idx >= 0) {
                      currentData[tableName][idx] = { ...currentData[tableName][idx], ...centralPayload };
                      this.set(currentData);
                    }
                  }
                }
                if (typeof window !== 'undefined' && window.showToast) {
                  window.showToast('Conflit résolu. Affichage rafraîchi.', 'success');
                }
                return; // Treated as success
              } else if (recheckBody.status === 'OPEN') {
                console.warn('[S2W] Conflit Company resté OPEN. Mutation bloquée.');
                if (typeof window !== 'undefined' && window.showToast) {
                  window.showToast('Conflit non résoluble. Veuillez recharger la page.', 'error');
                }
              }
            } else {
              console.error('[S2W] Recheck Company a échoué avec status', recheckRes.status);
            }
          }
        } catch(e) {
          // Ignore parse error
        }
      }
    } catch (e) {
      console.error(`[S2W] Erreur lors du patch Airtable (${tableName}) :`, e);
    }
  },

  async fetchAllFromAirtable(tableName) {
    await this.ensureCredentials();
    let allRecords = [];
    let offset = '';
    try {
      do {
        const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
        const url = `${API_URL}/legacy/${tableName}${offset ? `?offset=${offset}` : ''}`;
        
        // Remove Content-Type for GET requests, although fetch usually ignores it or handles it fine.
        // We'll just pass _getLegacyHeaders() which has it, that's harmless.
        const headers = this._getLegacyHeaders();
        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.error(`[S2W] Erreur de récupération ${tableName} :`, await res.text());
          break;
        }
        const data = await res.json();
        allRecords = [...allRecords, ...(data.records || [])];
        offset = data.offset;
      } while (offset);
    } catch (e) {
      console.error(`[S2W] Erreur de connexion Airtable (${tableName}) :`, e);
    }
    console.log(`[S2W] fetchAllFromAirtable(${tableName}) returned ${allRecords.length} records`);
    return allRecords;
  },

  async syncFromAirtable() {
    await this.ensureCredentials();
    console.log('[S2W] Synchronisation depuis Airtable en cours...');
    const cache = this.get();
    
    // 1. Fetch remote data first to avoid duplicate insertions
    const remoteData = {};
    for (const tableName of this.TABLES_LIST) {
      remoteData[tableName] = await this.fetchAllFromAirtable(tableName);
    }
    
    // 2. Upload missing local records (insert) or link them to existing remote records
    for (const tableName of this.TABLES_LIST) {
      const localRecords = cache[tableName] || [];
      
      const remoteMap = {};
      remoteData[tableName].forEach(r => {
        if (r.fields && r.fields.id) remoteMap[r.fields.id] = r.id;
      });

      for (const r of localRecords) {
        if (!r._airtable_id && remoteMap[r.id]) {
          // Exists remotely, just associate it locally
          r._airtable_id = remoteMap[r.id];
        } else if (!r._airtable_id) {
          // Truly new, post to Airtable
          await this.insertToAirtable(tableName, r);
        }
      }
    }
    
    // 3. Download and merge the latest remote records
    const updatedCache = this.get(); // Re-read cache to get any new _airtable_id
    for (const tableName of this.TABLES_LIST) {
      // Re-fetch to include the ones we just inserted
      const records = await this.fetchAllFromAirtable(tableName);
      updatedCache[tableName] = records.map(r => {
        const item = this._deserializeFields({ ...r.fields, _airtable_id: r.id });
        if (tableName === 'messages' && item.is_read === undefined) item.is_read = false;
        if (tableName === 'alerts' && item.acknowledged === undefined) item.acknowledged = false;
        if (tableName === 'documents' && item.validated_by_employer === undefined) item.validated_by_employer = false;
        return item;
      });
    }
    this.set(updatedCache);
    console.log('[S2W] Synchronisation Airtable terminée ✓');
  },

  async clearAirtableTables() {
    await this.ensureCredentials();
    console.log('[S2W] Nettoyage complet des tables distantes Airtable...');
    for (const tableName of this.TABLES_LIST) {
      const records = await this.fetchAllFromAirtable(tableName);
      if (records.length === 0) continue;
      const ids = records.map(r => r.id);
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const query = batch.map(id => `records[]=${id}`).join('&');
        const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
        await fetch(`${API_URL}/legacy/${tableName}?${query}`, {
          method: 'DELETE',
          headers: {
            'x-client-type': 'START2WAY_TECH_PANEL',
            'x-user-id': 'tech_admin',
            'x-company-id': 'tech_admin'
          }
        });
      }
      console.log(`[S2W] Table "${tableName}" vidée sur Airtable.`);
    }
  },

  /* ─── INITIALISATION ─── */
  async init() {
    await this.ensureCredentials();
    console.log('[S2W] Initialisation du cache de données...');
    const existing = this.get();
    
    // Si déjà initialisé localement, faire un pull rapide pour rester synchrone
    if (existing._initialized) {
      await this.syncFromAirtable();
      await this.migrateEmployments();
      return;
    }
    
    // Premier chargement : vider localement et charger les tables distantes Airtable
    const cache = {};
    for (const tableName of this.TABLES_LIST) {
      const records = await this.fetchAllFromAirtable(tableName);
      cache[tableName] = records.map(r => {
        const item = this._deserializeFields({ ...r.fields, _airtable_id: r.id });
        if (tableName === 'messages' && item.is_read === undefined) item.is_read = false;
        if (tableName === 'alerts' && item.acknowledged === undefined) item.acknowledged = false;
        if (tableName === 'documents' && item.validated_by_employer === undefined) item.validated_by_employer = false;
        return item;
      });
    }
    
    cache._initialized = true;
    cache._version = '1.0.0';
    cache._created_at = new Date().toISOString();
    this.set(cache);
    await this.migrateEmployments();
    console.log('[S2W] Cache initialisé avec succès depuis Airtable (base propre).');
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
