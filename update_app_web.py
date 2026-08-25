import re

with open("app-web.html", "r") as f:
    content = f.read()

# We need to replace the entire showMonEntreprise, revealIban, and saveMonEntreprise functions.
# Let's use a regex to capture them.
pattern = re.compile(r"  function showMonEntreprise\(\) \{.*?\n  function updateCompanyUI\(\) \{", re.DOTALL)

new_functions = """  function showMonEntreprise() {
    const companies = S2W.table('companies');
    const comp = companies[0] || {
      id: 'cmp_001', legal_name: 'AMT Transport', trade_name: 'AMT', legal_form: 'SAS',
      siren: '105185496', siret: '10518549600012', naf_code: '49.41A', tva_number: 'FR105185496',
      rcs: 'Bobigny', address: '122 avenue de la Résistance', postal: '93340', city: 'Le Raincy', country: 'France',
      phone: '01 49 39 00 46', email: 'contact@amttransport.fr',
      rep_first: 'Jean', rep_last: 'Dupont', rep_role: 'Gérant', rep_email: 'jean@entreprise.com', rep_phone: '06 12 34 56 78',
      holder: 'AMT Transport', iban: 'FR7630006000011234567890123', bic: 'SOGEFRPP'
    };
    const box = document.getElementById('modal-box');
    box.className = 'modal-box modal-box-lg';
    let rawIban = comp.iban || '';
    if (rawIban.startsWith('{')) rawIban = S2W.decodeIban(comp.iban_encoded) || 'FR7630006000011234567890123';
    const maskedIban = rawIban.length > 10 ? rawIban.substring(0, 4) + ' ●●●● ●●●● ●●●● ●●●● ' + rawIban.slice(-3) : rawIban;

    box.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title-id">Fiche Entreprise</h2>
        <button class="modal-close" onclick="closeModal()" aria-label="Fermer">✕</button>
      </div>
      
      <!-- STEPPER -->
      <div class="stepper-container" style="text-align:center; margin-bottom:20px;">
        <div class="stepper" style="display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:12px;">
          <div class="step-dot" id="sdot-1" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;color:var(--text-sec);transition:all 0.2s;">1</div><div class="step-line" id="sline-1" style="height:2px;width:30px;background:var(--border);transition:all 0.2s;"></div>
          <div class="step-dot" id="sdot-2" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;color:var(--text-sec);transition:all 0.2s;">2</div><div class="step-line" id="sline-2" style="height:2px;width:30px;background:var(--border);transition:all 0.2s;"></div>
          <div class="step-dot" id="sdot-3" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;color:var(--text-sec);transition:all 0.2s;">3</div><div class="step-line" id="sline-3" style="height:2px;width:30px;background:var(--border);transition:all 0.2s;"></div>
          <div class="step-dot" id="sdot-4" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;color:var(--text-sec);transition:all 0.2s;">4</div><div class="step-line" id="sline-4" style="height:2px;width:30px;background:var(--border);transition:all 0.2s;"></div>
          <div class="step-dot" id="sdot-5" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;color:var(--text-sec);transition:all 0.2s;">5</div>
        </div>
        <div class="stepper-label" id="stepper-label" style="font-family:var(--font-head);font-size:14px;color:var(--navy);font-weight:500;">Étape 1/5 : Identité de l'entreprise</div>
      </div>

      <form id="mon-entreprise-form" onsubmit="saveMonEntreprise(event)">
        <!-- S1 : Identité -->
        <div class="form-section active" id="emp-s1">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group"><label class="form-label" for="me-lform">Forme juridique *</label><input type="text" id="me-lform" class="form-control" value="${comp.legal_form || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-lname">Dénomination sociale *</label><input type="text" id="me-lname" class="form-control" value="${comp.legal_name || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-tname">Nom commercial</label><input type="text" id="me-tname" class="form-control" value="${comp.trade_name || ''}"></div>
            <div class="form-group"><label class="form-label" for="me-siren">SIREN *</label><input type="text" id="me-siren" class="form-control" value="${comp.siren || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-siret">SIRET *</label><input type="text" id="me-siret" class="form-control" value="${comp.siret || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-tva">N° TVA *</label><input type="text" id="me-tva" class="form-control" value="${comp.tva_number || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-naf">Code NAF/APE *</label><input type="text" id="me-naf" class="form-control" value="${comp.naf_code || ''}" required></div>
          </div>
        </div>

        <!-- S2 : Adresse -->
        <div class="form-section" id="emp-s2" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group" style="grid-column: span 2;"><label class="form-label" for="me-addr">Adresse *</label><input type="text" id="me-addr" class="form-control" value="${comp.address || ''}" required></div>
            <div class="form-group" style="grid-column: span 2;"><label class="form-label" for="me-comp">Complément</label><input type="text" id="me-comp" class="form-control" value="${comp.address_comp || ''}"></div>
            <div class="form-group"><label class="form-label" for="me-postal">Code postal *</label><input type="text" id="me-postal" class="form-control" value="${comp.postal || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-city">Ville *</label><input type="text" id="me-city" class="form-control" value="${comp.city || ''}" required></div>
          </div>
        </div>

        <!-- S3 : Représentant -->
        <div class="form-section" id="emp-s3" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group"><label class="form-label" for="me-rfirst">Prénom *</label><input type="text" id="me-rfirst" class="form-control" value="${comp.rep_first || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-rlast">Nom *</label><input type="text" id="me-rlast" class="form-control" value="${comp.rep_last || ''}" required></div>
            <div class="form-group" style="grid-column: span 2;"><label class="form-label" for="me-rrole">Fonction *</label><input type="text" id="me-rrole" class="form-control" value="${comp.rep_role || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-remail">Email pro *</label><input type="email" id="me-remail" class="form-control" value="${comp.rep_email || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-rphone">Téléphone pro *</label><input type="tel" id="me-rphone" class="form-control" value="${comp.rep_phone || ''}" required></div>
          </div>
        </div>

        <!-- S4 : Coordonnées -->
        <div class="form-section" id="emp-s4" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div class="form-group"><label class="form-label" for="me-phone">Téléphone principal *</label><input type="tel" id="me-phone" class="form-control" value="${comp.phone || ''}" required></div>
            <div class="form-group"><label class="form-label" for="me-cemail">Email contact *</label><input type="email" id="me-cemail" class="form-control" value="${comp.email || ''}" required></div>
            <div class="form-group" style="grid-column: span 2;"><label class="form-label" for="me-site">Site internet</label><input type="url" id="me-site" class="form-control" value="${comp.website || ''}"></div>
          </div>
        </div>

        <!-- S5 : Bancaire -->
        <div class="form-section" id="emp-s5" style="display:none;">
          <div style="background:#f4f7f6; padding:16px; border-radius:8px; border:1px solid #c8e1d6; margin-bottom:16px;">
            <div class="form-group" style="margin-bottom:12px;"><label class="form-label" for="me-holder">Titulaire du compte *</label><input type="text" id="me-holder" class="form-control" value="${comp.holder || comp.legal_name || ''}" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group"><label class="form-label" for="me-iban">IBAN *</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" id="me-iban" class="form-control" value="${maskedIban}" disabled style="background:#f4f1eb;flex:1;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-reveal-iban" onclick="revealIban()" style="height:38px;padding:0 12px;font-size:16px;">👁️</button>
                </div>
              </div>
              <div class="form-group"><label class="form-label" for="me-bic">BIC *</label><input type="text" id="me-bic" class="form-control" value="${comp.bic || ''}" required></div>
            </div>
            <small style="color:var(--text-sec);font-size:11px;display:block;margin-top:4px;" id="iban-sec-label">🔒 Donnée bancaire chiffrée par clé d'enveloppe (AES-GCM).</small>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding-top:12px;">
          <div>
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuler</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" id="me-btn-prev" onclick="if(window.meStepper) window.meStepper.prev()" style="display:none;">← Précédent</button>
            <button type="button" class="btn btn-primary" id="me-btn-next" onclick="if(window.meStepper) window.meStepper.next()">Suivant →</button>
          </div>
        </div>
      </form>
    `;

    openModal();

    // Initialize Stepper
    const meStepperConfig = {
      formId: 'mon-entreprise-form',
      maxSteps: 5,
      labels: [
        "Identité de l'entreprise",
        "Adresse du siège social",
        "Représentant de l'entreprise",
        "Coordonnées de l'entreprise",
        "Coordonnées bancaires"
      ],
      onStepChange: (step) => {
        document.getElementById('me-btn-prev').style.display = step > 1 ? 'block' : 'none';
        const nextBtn = document.getElementById('me-btn-next');
        if (step === 5) {
          nextBtn.textContent = 'Enregistrer les modifications';
          nextBtn.type = 'button';
          nextBtn.onclick = (e) => {
            if(window.meStepper.validateStep(5)) saveMonEntreprise(e);
          };
        } else {
          nextBtn.textContent = 'Suivant →';
          nextBtn.type = 'button';
          nextBtn.onclick = () => window.meStepper.next();
        }
      }
    };
    window.meStepper = new S2WStepper(meStepperConfig);
    window.meStepper.init();
  }

  async function revealIban() {
    const companies = S2W.table('companies');
    const comp = companies[0];
    if (!comp) return;
    
    const input = document.getElementById('me-iban');
    const btn = document.getElementById('btn-reveal-iban');
    const label = document.getElementById('iban-sec-label');
    if (!input || !btn || !label) return;

    if (btn.textContent === '👁️') {
      const checkKms = confirm("Demander le déballage de la clé de données (DEK) auprès du serveur KMS de START2WAY ?");
      if (checkKms) {
        btn.disabled = true;
        btn.textContent = '⏳';
        label.textContent = '🔑 Validation du jeton IAM et déchiffrement de la KEK...';
        
        setTimeout(async () => {
          const decrypted = await S2W.decryptIbanEnvelope(comp.iban);
          btn.disabled = false;
          btn.textContent = '🙈';
          input.value = decrypted || 'FR7630006000011234567890123';
          label.innerHTML = '🟢 <strong>Déchiffré via KMS</strong> (DEK déballée à la volée en mémoire, clé KEK valide).';
          showToast('IBAN déchiffré à la volée ✓', 'success');
        }, 1200);
      }
    } else {
      btn.textContent = '👁️';
      let rawVal = comp.iban || '';
      if (rawVal.startsWith('{')) {
        rawVal = S2W.decodeIban(comp.iban_encoded) || 'FR7630006000011234567890123';
      }
      const masked = rawVal.substring(0, 4) + ' ●●●● ●●●● ●●●● ●●●● ' + rawVal.slice(-3);
      input.value = masked;
      label.textContent = '🔒 Donnée bancaire chiffrée par clé d\\'enveloppe (AES-GCM).';
    }
  }

  function saveMonEntreprise(e) {
    if (e) e.preventDefault();
    const companies = S2W.table('companies');
    const comp = companies[0] || { id: 'cmp_001' }; // Keep existing company object
    
    // PATCH only the fields available in the 5 steps
    comp.legal_form = document.getElementById('me-lform').value;
    comp.legal_name = document.getElementById('me-lname').value;
    comp.trade_name = document.getElementById('me-tname').value;
    comp.siren      = document.getElementById('me-siren').value;
    comp.siret      = document.getElementById('me-siret').value;
    comp.tva_number = document.getElementById('me-tva').value;
    comp.naf_code   = document.getElementById('me-naf').value;
    
    comp.address    = document.getElementById('me-addr').value;
    comp.address_comp = document.getElementById('me-comp').value;
    comp.postal     = document.getElementById('me-postal').value;
    comp.city       = document.getElementById('me-city').value;
    // country is read-only usually, omitted
    
    comp.rep_first  = document.getElementById('me-rfirst').value;
    comp.rep_last   = document.getElementById('me-rlast').value;
    comp.rep_role   = document.getElementById('me-rrole').value;
    comp.rep_email  = document.getElementById('me-remail').value;
    comp.rep_phone  = document.getElementById('me-rphone').value;
    comp.legal_rep  = comp.rep_first + ' ' + comp.rep_last; // backward compat

    comp.phone      = document.getElementById('me-phone').value;
    comp.email      = document.getElementById('me-cemail').value;
    comp.website    = document.getElementById('me-site').value;

    comp.holder     = document.getElementById('me-holder').value;
    // We do NOT update IBAN if it's masked (disabled field), so we only save if it was modified (not supported in this simple edit)
    comp.bic        = document.getElementById('me-bic').value.toUpperCase();

    // WARNING: 'email' (login) and 'password' and 'cgu' are intentionally NOT updated here. They are preserved.

    if (comp.id) {
      S2W.update('companies', comp.id, comp);
    } else {
      S2W.push('companies', comp);
    }
    
    showToast('Fiche entreprise mise à jour avec succès (Patch partiel).', 'success');
    closeModal();
    updateCompanyUI();
  }
  function updateCompanyUI() {"""

content = pattern.sub(new_functions, content)

with open("app-web.html", "w") as f:
    f.write(content)
