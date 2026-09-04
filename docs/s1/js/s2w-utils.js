/* ==========================================================================
   START2WAY — Utilitaires s2w-utils.js
   Formatage, validation, badges, conformité métier
   Version : S1 (démo HTML standalone)
   ========================================================================== */

'use strict';

/* ─── FORMATAGE DURÉES ──────────────────────────────────────────────────── */
const S2WUtils = {

  /* Secondes → "Xh YYmin" */
  fmtDuration(sec) {
    if (!sec && sec !== 0) return '—';
    const h = Math.floor(Math.abs(sec) / 3600);
    const m = Math.floor((Math.abs(sec) % 3600) / 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  },

  /* Secondes → "HH:MM:SS" */
  fmtChrono(sec) {
    const h = Math.floor(Math.abs(sec) / 3600).toString().padStart(2, '0');
    const m = Math.floor((Math.abs(sec) % 3600) / 60).toString().padStart(2, '0');
    const s = (Math.abs(sec) % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  },

  /* ISO date → "lun. 15 août 2026" */
  fmtDateLong(isoStr) {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr.slice(0,10) + 'T12:00:00')
        .toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    } catch { return isoStr.slice(0,10); }
  },

  /* ISO date → "15/08/2026" */
  fmtDateShort(isoStr) {
    if (!isoStr) return '—';
    try {
      return new Date(isoStr.slice(0,10) + 'T12:00:00')
        .toLocaleDateString('fr-FR');
    } catch { return isoStr.slice(0,10); }
  },

  /* ISO datetime → "15/08/2026 à 14h32" */
  fmtDatetime(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('fr-FR') + ' à ' +
        d.getHours() + 'h' + d.getMinutes().toString().padStart(2,'0');
    } catch { return isoStr; }
  },

  /* Nom complet */
  fullName(user) {
    if (!user) return 'Inconnu';
    const last = (user.last_name || '').toUpperCase();
    return `${last} ${user.first_name || ''}`;
  },

  /* Initiales */
  initials(user) {
    if (!user) return '??';
    return `${(user.first_name || '?').charAt(0)}${(user.last_name || '?').charAt(0)}`.toUpperCase();
  },

  /* ─── BADGES EXPIRATION ─── */
  badgeExpiry(expiresAt, label) {
    if (!expiresAt) return '<span class="badge badge-muted">N/A</span>';
    const diff = (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
    const dateStr = this.fmtDateShort(expiresAt);
    if (diff < 0)
      return `<span class="badge badge-danger" title="Expiré le ${dateStr}">Expiré</span>`;
    if (diff < 15)
      return `<span class="badge badge-danger" title="Expire le ${dateStr}">⚠ ${Math.ceil(diff)}j</span>`;
    if (diff < 30)
      return `<span class="badge badge-warning" title="Expire le ${dateStr}">Expire dans ${Math.ceil(diff)}j</span>`;
    return `<span class="badge badge-success" title="Valide jusqu'au ${dateStr}">Valide</span>`;
  },

  /* Badge statut conducteur */
  badgeUserStatus(status) {
    const MAP = {
      actif:     { cls:'badge-success',  label:'Actif' },
      bloque:    { cls:'badge-danger',   label:'Bloqué' },
      depart:    { cls:'badge-warning',  label:'Départ enregistré' },
      supprime:  { cls:'badge-muted',    label:'Supprimé' },
      'en attente': { cls:'badge-info',  label:'En attente' }
    };
    const s = MAP[status] || { cls:'badge-muted', label: status };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  },

  /* Badge conformité feuillet */
  badgeConformity(status) {
    if (status === 'conforme')
      return '<span class="badge badge-success">✓ Conforme</span>';
    if (status === 'non_conforme')
      return '<span class="badge badge-danger">✗ Non conforme</span>';
    if (status === 'en_attente')
      return '<span class="badge badge-warning">⏳ En attente</span>';
    return `<span class="badge badge-muted">${status}</span>`;
  },

  /* Badge sévérité alerte */
  badgeSeverity(severity) {
    if (severity === 'critical') return '<span class="badge badge-danger">Critique</span>';
    if (severity === 'warning')  return '<span class="badge badge-warning">Avertissement</span>';
    return '<span class="badge badge-muted">Info</span>';
  },

  /* ─── VALIDATIONS MÉTIER ─── */
  isCompliantDay(feuillet) {
    const { total_a_sec, total_b_sec, total_c_sec, total_d_sec } = feuillet;
    const E = total_a_sec + total_b_sec + total_c_sec;
    const total = E + total_d_sec;
    const check24h = Math.abs(total - 24 * 3600) <= 60;
    const checkDrive = total_a_sec <= 9 * 3600;
    return { ok: check24h && checkDrive, check24h, checkDrive, E, total };
  },

  /* Vérification 4h30 sans pause (pour alerte en temps réel) */
  needsPause(elapsedSecInA) {
    return elapsedSecInA >= 4 * 3600 + 30 * 60;
  },

  /* Vérification proche limite (pour alerte préventive) */
  nearPauseLimit(elapsedSecInA) {
    return elapsedSecInA >= 4 * 3600 + 20 * 60;
  },

  /* ─── GÉNÉRATION IDs ─── */
  uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  },

  /* ─── VALIDATION FORMULAIRES ─── */
  isValidSiren(v) { return /^\d{9}$/.test(v.replace(/\s/g,'')); },
  isValidSiret(v) { return /^\d{14}$/.test(v.replace(/\s/g,'')); },
  isValidIban(v)  { return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(v.replace(/\s/g,'')); },
  isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); },
  isValidPhone(v) { return /^[\d\s\+\-\.]{8,15}$/.test(v.trim()); },

  /* ─── VALIDATION TOKEN CIRCUIT ─── */
  
  /* ─── VALIDATION TOKEN INVITATION ─── */
  async validateInvitationToken(code, userId) {
    if (!code) return { success: false, message: 'Veuillez saisir un code d\'invitation.' };
    
    try {
      const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
      const res = await fetch(`${API_URL}/invitations/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-type': (typeof window !== 'undefined' && window.START2WAY_CLIENT_TYPE) ? window.START2WAY_CLIENT_TYPE : 'UNKNOWN',
          'x-user-id': userId
        },
        body: JSON.stringify({ code: code.toUpperCase() })
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INVALID_INVITATION_CODE') return { success: false, message: 'Code invalide, inconnu ou déjà utilisé.' };
        if (data.error === 'WRONG_WORKFLOW_FOR_CIRCUIT') return { success: false, message: 'Ce code est un code Circuit. Veuillez l\'utiliser dans la section correspondante.' };
        return { success: false, message: 'Erreur lors de la validation du code.' };
      }
      
      return { success: true, message: data.message, invitationId: data.invitation_id, companyId: data.company_id };
    } catch (e) {
      console.error('[S2W] Erreur validation invitation:', e);
      return { success: false, message: 'Erreur réseau.' };
    }
  },
async validateCircuitToken(code, userId = 'usr_001') {
    if (!code) return { success: false, message: 'Veuillez saisir un code d\'activation.' };
    
    try {
      const API_URL = (typeof window !== 'undefined' && window.START2WAY_API_BASE_URL) ? window.START2WAY_API_BASE_URL : 'http://localhost:3000/api';
      const res = await fetch(`${API_URL}/circuits/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-type': (typeof window !== 'undefined' && window.START2WAY_CLIENT_TYPE) ? window.START2WAY_CLIENT_TYPE : 'UNKNOWN',
          'x-user-id': userId
        },
        body: JSON.stringify({ code: code.toUpperCase() })
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INVITATION_INVALID') return { success: false, message: 'Code invalide, inconnu ou déjà utilisé.' };
        return { success: false, message: 'Erreur lors de la validation du code.' };
      }
      
      return { success: true, message: data.message, invitationId: data.invitation_id, companyId: data.company_id };
    } catch (e) {
      console.error('[S2W] Erreur validation circuit:', e);
      return { success: false, message: 'Erreur réseau.' };
    }
  },

  /* Score de force mot de passe */
  passwordStrength(pwd) {
    const tests = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
    const score = tests.filter(r => r.test(pwd)).length;
    const labels = ['', 'Faible', 'Moyen', 'Fort', 'Très fort'];
    const classes = ['', 'strength-weak', 'strength-medium', 'strength-strong', 'strength-very-strong'];
    return { score, label: labels[score] || '', cls: classes[score] || '' };
  },

  /* Format IBAN avec espaces */
  formatIban(raw) {
    return raw.replace(/\s/g,'').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
  },

  /* ─── TOAST ─── */
  showToast(msg, type, containerId) {
    const cid = containerId || 'toast-container';
    let container = document.getElementById(cid);
    if (!container) {
      container = document.createElement('div');
      container.id = cid;
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bgMap = { success:'#2E7D32', error:'#D32F2F', warning:'#ED6C02', info:'#0D2242' };
    toast.style.cssText = `
      background:${bgMap[type]||bgMap.info};color:#fff;padding:12px 20px;
      border-radius:8px;font-family:'Source Sans 3',sans-serif;font-size:14px;
      box-shadow:0 4px 16px rgba(0,0,0,0.2);max-width:360px;
      animation:slideInRight 0.3s ease;
    `;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, 3000);
  },

  /* ─── GESTION DE SESSION (CLIENT-SIDE) ─── */
  login(userId) {
    localStorage.setItem('s2w_current_user_id', userId);
    window.currentUserId = userId;
  },
  logout() {
    localStorage.removeItem('s2w_current_user_id');
    window.currentUserId = null;
  },
  getLoggedInUserId() {
    if (window.currentUserId) return window.currentUserId;
    const stored = localStorage.getItem('s2w_current_user_id');
    if (stored) {
      window.currentUserId = stored;
      return stored;
    }
    return null;
  },
  getLoggedInUser() {
    const uid = this.getLoggedInUserId();
    if (!uid) return null;
    return window.S2W ? window.S2W.find('users', uid) : null;
  },

  /* ─── EMPLOYMENT (MULTI-TENANCY) ─── */
  getUserEmployments(userId) {
    if (!window.S2W) return [];
    return window.S2W.table('employments').filter(e => e.user_id === userId);
  },
  getActiveEmployments(userId) {
    return this.getUserEmployments(userId).filter(e => e.status === 'active');
  },
  getEmployment(userId, companyId) {
    return this.getUserEmployments(userId).find(e => e.company_id === companyId) || null;
  },
  createEmployment(userId, companyId, invitationId = null) {
    if (!window.S2W) return null;
    let emp = this.getEmployment(userId, companyId);
    if (!emp) {
      emp = {
        id: 'emp_' + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        company_id: companyId,
        status: 'active',
        created_at: new Date().toISOString(),
        depart_at: null,
        created_via_invitation_id: invitationId
      };
      window.S2W.push('employments', emp);
    } else if (emp.status === 'depart') {
      // Re-activate if they rejoin
      window.S2W.update('employments', emp.id, {
        status: 'active',
        depart_at: null,
        created_via_invitation_id: invitationId || emp.created_via_invitation_id
      });
    }
    return emp;
  },
  endEmployment(userId, companyId) {
    if (!window.S2W) return null;
    let emp = this.getEmployment(userId, companyId);
    if (emp && emp.status !== 'depart') {
      window.S2W.update('employments', emp.id, {
        status: 'depart',
        depart_at: new Date().toISOString()
      });
    }
    return emp;
  },

  getEmploymentBusinessTimezone(employmentId, strict = false) {
    if (!window.S2W) {
      if (strict) throw new Error("S2W not initialized");
      return 'Europe/Paris';
    }
    const employments = window.S2W.table('employments') || [];
    const companies = window.S2W.table('companies') || [];
    const emp = employments.find(e => e.id === employmentId);
    if (!emp || !emp.company_id) {
      if (strict) throw new Error("Employment or company_id missing");
      return 'Europe/Paris';
    }
    const comp = companies.find(c => c.id === emp.company_id);
    const tz = (comp && comp.timezone) ? comp.timezone : null;
    
    if (!tz) {
      if (strict) throw new Error("Timezone missing from company");
      return 'Europe/Paris';
    }
    
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch (e) {
      if (strict) throw new Error("Invalid IANA timezone: " + tz);
      return 'Europe/Paris';
    }
    
    return tz;
  },

  getBusinessDate(isoStr, timezone) {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
      const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA donne YYYY-MM-DD
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      return formatter.format(d);
    } catch (e) {
      console.error("[S2WUtils] Erreur timezone:", e);
      return new Date(isoStr).toISOString().slice(0, 10);
    }
  },

  getMidnightUTC(dateStr, timezone) {
    try {
      let guess = new Date(dateStr + 'T00:00:00Z').getTime();
      let step = 60 * 60 * 1000;
      for (let i = -14; i <= 14; i++) {
        let t = guess + i * step;
        let ds = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(t));
        if (ds === dateStr) {
          let minuteGuess = t - step;
          for (let j = 0; j <= 60; j++) {
            let mt = minuteGuess + j * 60 * 1000;
            let mds = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(mt));
            if (mds === dateStr) {
               return new Date(mt).toISOString();
            }
          }
        }
      }
      throw new Error(`Unable to resolve midnight for ${dateStr} in ${timezone}`);
    } catch (e) {
      console.error("[S2WUtils] Erreur getMidnightUTC:", e);
      throw e; // Fail closed, ne pas silencieusement transformer en T00:00:00.000Z
    }
  },
  /* ─── MOTEUR LIVRET LIC MENSUEL (F5A) ─────────────────────────────────── */
  buildMonthlyLICBooklet(userId, employmentId, year, month) {
    if (!userId || !employmentId || !year || !month) return null;
    
    // Convert string year/month to numbers
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    
    // Get employment to check boundaries
    const emp = window.S2W ? window.S2W.find('employments', employmentId) : null;
    if (!emp || emp.user_id !== userId) return null;
    
    const empStart = new Date(emp.start_date);
    empStart.setHours(0,0,0,0);
    const empEnd = emp.end_date ? new Date(emp.end_date) : new Date('2099-12-31');
    empEnd.setHours(23,59,59,999);
    
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Fetch all feuillets for this employment for the month
    const monthPrefix = `${y}-${m.toString().padStart(2, '0')}`;
    const allFeuillets = window.S2W ? window.S2W.table('feuillets').filter(f => f.employment_id === employmentId && f.date.startsWith(monthPrefix) && f.status !== 'supprime') : [];
    // Fetch all segments for this employment for the month to prove real activity
    const allSegments = window.S2W ? window.S2W.table('segments').filter(s => s.employment_id === employmentId && s.business_date && s.business_date.startsWith(monthPrefix)) : [];
    
    // Fetch day declarations
    const allDeclarations = window.S2W ? window.S2W.table('day_declarations').filter(d => d.employment_id === employmentId && d.business_date.startsWith(monthPrefix)) : [];
    
    let bookletReady = true;
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${monthPrefix}-${day.toString().padStart(2, '0')}`;
      const currentDate = new Date(`${dayStr}T12:00:00Z`); // use 12:00 to avoid timezone issues
      currentDate.setHours(0,0,0,0);
      
      let dayType = 'UNRESOLVED_DAY';
      let meta = null;
      
      // 1. Check if outside employment scope
      if (currentDate < empStart || currentDate > empEnd) {
        dayType = 'OUTSIDE_EMPLOYMENT';
      }
      // 2. Check if future day
      else if (currentDate > today) {
        dayType = 'FUTURE_DAY';
      }
      else {
        // 3. Check for existing activity (segments prove real work)
        const daySegments = allSegments.filter(s => s.business_date === dayStr);
        if (daySegments.length > 0) {
          dayType = 'WORK_DAY';
          meta = { source: 'segments', count: daySegments.length };
        } else {
          // 4. Check for day declarations
          const decls = allDeclarations.filter(d => d.business_date === dayStr).sort((a,b) => new Date(b.declared_at) - new Date(a.declared_at));
          if (decls.length > 0) {
            dayType = decls[0].day_type;
            meta = { reason_note: decls[0].reason_note };
          } else {
            // Nothing found and it's a past/current date inside employment scope
            dayType = 'UNRESOLVED_DAY';
            bookletReady = false;
          }
        }
      }
      
      days.push({
        date: dayStr,
        dayType: dayType,
        meta: meta
      });
    }
    
    return {
      userId,
      employmentId,
      year: y,
      month: m,
      companyId: emp.company_id,
      bookletReady,
      days
    };
  }

};

/* ─── EXPORT GLOBAL ─────────────────────────────────────────────────────── */
window.S2WUtils = S2WUtils;

/* ─── CONTROLEUR DE STEPPER (MULTI-ETAPES) ──────────────────────────────── */
class S2WStepper {
  constructor(config) {
    this.formId = config.formId;
    this.maxSteps = config.maxSteps;
    this.currentStep = 1;
    this.onFinish = config.onFinish;
    this.onStepChange = config.onStepChange;
    this.labels = config.labels || [];
  }

  init() {
    this.goTo(1, true);
    for (let i = 1; i <= this.maxSteps; i++) {
      const dot = document.getElementById(`sdot-${i}`);
      if (dot) {
        dot.addEventListener('click', () => {
          if (dot.classList.contains('done')) this.goTo(i, true);
        });
      }
    }
  }

  validateStep(n) {
    const section = document.getElementById(`emp-s${n}`);
    if (!section) return true;
    let ok = true;
    section.querySelectorAll('[required]').forEach(inp => {
      inp.classList.remove('input-error');
      const empty = inp.type === 'checkbox' ? !inp.checked : !inp.value.trim();
      if (empty) { inp.classList.add('input-error'); ok = false; }
    });
    if (!ok && window.S2WUtils && S2WUtils.showToast) {
      S2WUtils.showToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
    } else if (!ok) {
      alert('Veuillez remplir tous les champs obligatoires (*)');
    }
    return ok;
  }

  next() {
    if (!this.validateStep(this.currentStep)) return;
    if (this.currentStep === this.maxSteps) {
      if (this.onFinish) this.onFinish();
      return;
    }
    const currentDot = document.getElementById(`sdot-${this.currentStep}`);
    if (currentDot) {
      currentDot.classList.add('done');
      currentDot.style.cursor = 'pointer';
    }
    this.goTo(this.currentStep + 1, true);
  }

  prev() {
    if (this.currentStep > 1) {
      this.goTo(this.currentStep - 1, true);
    }
  }

  goTo(n, skipValidation = false) {
    if (!skipValidation && n > this.currentStep && !this.validateStep(this.currentStep)) return;
    
    for (let i = 1; i <= this.maxSteps; i++) {
      const section = document.getElementById(`emp-s${i}`);
      if (section) section.classList.remove('active');
      
      const dot = document.getElementById(`sdot-${i}`);
      if (dot) {
        dot.classList.remove('active');
        if (i < n) {
          dot.classList.add('done');
          dot.style.cursor = 'pointer';
        }
      }
      const line = document.getElementById(`sline-${i}`);
      if (line) line.style.background = i < n ? 'var(--navy)' : 'var(--border)';
    }

    this.currentStep = n;
    
    const currentSection = document.getElementById(`emp-s${n}`);
    if (currentSection) currentSection.classList.add('active');
    const currentDot = document.getElementById(`sdot-${n}`);
    if (currentDot) currentDot.classList.add('active');

    const labelEl = document.getElementById('stepper-label');
    if (labelEl && this.labels[n-1]) {
      labelEl.textContent = `Étape ${n}/${this.maxSteps} : ${this.labels[n-1]}`;
    }

    if (this.onStepChange) this.onStepChange(this.currentStep);
  }
}
window.S2WStepper = S2WStepper;
