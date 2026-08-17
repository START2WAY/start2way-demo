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
  }
};

/* ─── EXPORT GLOBAL ─────────────────────────────────────────────────────── */
window.S2WUtils = S2WUtils;
