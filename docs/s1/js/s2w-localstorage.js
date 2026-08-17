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
  AIRTABLE_TOKEN: '',
  BASE_ID: '',
  TABLES_LIST: ['companies', 'users', 'sessions', 'feuillets', 'messages', 'alerts', 'reprise_codes', 'event_logs', 'reopen_logs', 'vehicles', 'documents', 'invitations', 'reports'],

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
  push(name, record) {
    const d = this.get();
    if (!Array.isArray(d[name])) d[name] = [];
    d[name].push(record);
    this.set(d);
    
    // Push asynchrone vers Airtable en arrière-plan
    this.insertToAirtable(name, record);
    
    return record;
  },

  /* Mise à jour partielle par id (synchrone + patch asynchrone) */
  update(name, id, patch) {
    const d = this.get();
    if (!Array.isArray(d[name])) return false;
    const idx = d[name].findIndex(r => r.id === id || r.code === id);
    if (idx === -1) return false;
    d[name][idx] = { ...d[name][idx], ...patch };
    this.set(d);
    
    // Patch asynchrone vers Airtable en arrière-plan
    this.updateInAirtable(name, id, patch);
    
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

  async ensureCredentials() {
    if (this.AIRTABLE_TOKEN && this.BASE_ID) {
      return true;
    }
    const t = localStorage.getItem('s2w_airtable_token');
    const b = localStorage.getItem('s2w_airtable_base_id');
    if (t && b) {
      this.AIRTABLE_TOKEN = t;
      this.BASE_ID = b;
      return true;
    }

    if (this._credentialsPromise) {
      return this._credentialsPromise;
    }

    this._credentialsPromise = new Promise((resolve) => {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }

      const overlay = document.createElement('div');
      overlay.id = 's2w-config-overlay';
      overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(13,34,66,0.95);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:sans-serif;color:#fff;padding:20px;box-sizing:border-box;backdrop-filter:blur(8px);';
      
      overlay.innerHTML = `
        <div style="background:#fff;color:#0D2242;padding:30px;border-radius:16px;max-width:450px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.3);box-sizing:border-box;">
          <h2 style="margin:0 0 10px 0;font-size:22px;font-weight:700;color:#0D2242;display:flex;align-items:center;gap:8px;">🚀 Configuration Airtable</h2>
          <p style="margin:0 0 20px 0;font-size:13px;color:#555;line-height:1.5;">Veuillez renseigner vos identifiants Airtable pour connecter la base de données démo de START2WAY.</p>
          
          <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:6px;">Token d'accès personnel Airtable (PAT)</label>
          <input type="password" id="s2w-cfg-token" placeholder="pat..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:16px;box-sizing:border-box;font-size:14px;" />
          
          <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:6px;">ID de la Base Airtable</label>
          <input type="text" id="s2w-cfg-base" placeholder="app..." style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:20px;box-sizing:border-box;font-size:14px;" />
          
          <button id="s2w-cfg-submit" style="width:100%;background:#ED6C02;color:#fff;border:none;padding:12px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;">Enregistrer et se connecter</button>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      document.getElementById('s2w-cfg-submit').onclick = () => {
        const tVal = document.getElementById('s2w-cfg-token').value.trim();
        const bVal = document.getElementById('s2w-cfg-base').value.trim();
        if (!tVal || !bVal) {
          alert("Veuillez remplir tous les champs.");
          return;
        }
        localStorage.setItem('s2w_airtable_token', tVal);
        localStorage.setItem('s2w_airtable_base_id', bVal);
        this.AIRTABLE_TOKEN = tVal;
        this.BASE_ID = bVal;
        document.body.removeChild(overlay);
        this._credentialsPromise = null;
        resolve(true);
      };
    });

    return this._credentialsPromise;
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

  _deserializeFields(fields) {
    const item = { ...fields };
    const jsonKeys = ['signature_path', 'maintenance_thresholds', 'docs', 'included_dates', 'all_dates'];
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
      
      const res = await fetch(`https://api.airtable.com/v0/${this.BASE_ID}/${tableName}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
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

      const res = await fetch(`https://api.airtable.com/v0/${this.BASE_ID}/${tableName}/${record._airtable_id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });
      
      if (res.ok) {
        console.log(`[S2W] Enregistrement Airtable ${record._airtable_id} mis à jour.`);
      } else {
        console.error(`[S2W] Échec de mise à jour Airtable pour ${tableName}/${record._airtable_id} :`, await res.text());
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
        const url = `https://api.airtable.com/v0/${this.BASE_ID}/${tableName}${offset ? `?offset=${offset}` : ''}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.AIRTABLE_TOKEN}`
          }
        });
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
    return allRecords;
  },

  async syncFromAirtable() {
    await this.ensureCredentials();
    console.log('[S2W] Synchronisation depuis Airtable en cours...');
    const cache = this.get();
    
    // 1. Uploader les enregistrements locaux non synchronisés (qui n'ont pas de _airtable_id)
    for (const tableName of this.TABLES_LIST) {
      const localRecords = cache[tableName] || [];
      for (const r of localRecords) {
        if (!r._airtable_id) {
          await this.insertToAirtable(tableName, r);
        }
      }
    }
    
    // 2. Télécharger les derniers enregistrements distants
    const updatedCache = this.get(); // Re-lire le cache mis à jour avec les nouveaux _airtable_id
    for (const tableName of this.TABLES_LIST) {
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
        await fetch(`https://api.airtable.com/v0/${this.BASE_ID}/${tableName}?${query}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.AIRTABLE_TOKEN}`
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
    console.log('[S2W] Cache initialisé avec succès depuis Airtable (base propre).');
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
