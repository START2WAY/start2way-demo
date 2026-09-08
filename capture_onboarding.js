const puppeteer = require('puppeteer');

const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE = 'appPRhZZarIzOZjmV';

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 414, height: 896 }
  });
  
  const page = await browser.newPage();
  
  // Navigate first to set local storage
  await page.goto('http://localhost:8000/app-mobile.html?t=' + Date.now());
  
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('s2w_airtable_base_id', 'appPRhZZarIzOZjmV');
  });

  await page.reload({ waitUntil: 'networkidle0' });
  await page.addStyleTag({content: `
    ::-webkit-scrollbar { display: none; }
    #airtable-config-modal { display: none !important; }
    #airtable-warning-banner { display: none !important; }
    .modal-overlay { opacity: 1 !important; pointer-events: all !important; transition: none !important; }
    .modal-sheet { transform: translateY(0) !important; transition: none !important; }
  `});
  
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // 1. Welcome Screen
  console.log('Capturing Welcome...');
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_welcome.png' });

  // 2. Login
  console.log('Capturing Login...');
  await page.evaluate(() => {
    document.getElementById('login-modal').classList.add('open');
    document.getElementById('login-modal').style.zIndex = '9999';
    document.getElementById('login-email').value = 'jean.dupont@email.com';
    document.getElementById('login-password').value = 'SecurePass123!';
  });
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_login.png' });
  await page.evaluate(() => {
    document.getElementById('login-modal').classList.remove('open');
    document.getElementById('login-modal').style.display = 'none';
  });
  await wait(300);

  // 3. Step 1 Remplie
  console.log('Capturing Step 1...');
  await page.evaluate(() => {
    const signup = document.getElementById('signup-modal');
    signup.classList.add('open');
    signup.style.zIndex = '9999';
    signup.style.display = 'flex';
    
    // Simulate S2WStepper active state
    document.getElementById('sdot-1').style.background = 'var(--brand-green)';
    document.getElementById('sdot-1').style.borderColor = 'var(--brand-green)';

    const steps = document.querySelectorAll('.s2w-step-content');
    if (steps) steps.forEach(s => s.style.display = 'none');
    
    const step1 = document.getElementById('emp-s1');
    if (step1) step1.style.display = 'block';

    if (document.getElementById('su-nom')) document.getElementById('su-nom').value = 'Dupont';
    if (document.getElementById('su-prenom')) document.getElementById('su-prenom').value = 'Jean';
    if (document.getElementById('su-email')) document.getElementById('su-email').value = 'jean.dupont@email.com';
    if (document.getElementById('su-tel')) document.getElementById('su-tel').value = '0612345678';
    if (document.getElementById('su-dob')) document.getElementById('su-dob').value = '1985-04-12';
  });
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_step1.png' });

  // 4. Step 2
  console.log('Capturing Step 2...');
  await page.evaluate(() => {
    document.getElementById('emp-s1').style.display = 'none';
    document.getElementById('emp-s2').style.display = 'block';
    
    document.getElementById('sline-1').style.background = 'var(--brand-green)';
    document.getElementById('sdot-2').style.background = 'var(--brand-green)';
    document.getElementById('sdot-2').style.borderColor = 'var(--brand-green)';

    if (document.getElementById('su-permis-type')) {
      document.getElementById('su-permis-type').value = 'PL';
      // Trigger togglePLFields manually
      const plFields = document.getElementById('pl-fields');
      if(plFields) plFields.style.display = 'flex';
    }
    if (document.getElementById('su-permis-num')) document.getElementById('su-permis-num').value = '123456789A';
    if (document.getElementById('su-fco')) document.getElementById('su-fco').value = '2028-10-15';
    if (document.getElementById('su-visite')) document.getElementById('su-visite').value = '2027-05-20';
  });
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_step2.png' });

  // 5. Step 3 (Security)
  console.log('Capturing Step 3...');
  await page.evaluate(() => {
    document.getElementById('emp-s2').style.display = 'none';
    document.getElementById('emp-s3').style.display = 'block';

    document.getElementById('sline-2').style.background = 'var(--brand-green)';
    document.getElementById('sdot-3').style.background = 'var(--brand-green)';
    document.getElementById('sdot-3').style.borderColor = 'var(--brand-green)';

    if (document.getElementById('su-mdp')) document.getElementById('su-mdp').value = 'SecurePass123!';
    if (document.getElementById('su-mdp-conf')) document.getElementById('su-mdp-conf').value = 'SecurePass123!';
    if (document.getElementById('su-pin')) document.getElementById('su-pin').value = '1234';
    if (document.getElementById('su-pin-conf')) document.getElementById('su-pin-conf').value = '1234';
  });
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_step3.png' });

  // 6. Step 4 (Activation)
  console.log('Capturing Step 4...');
  await page.evaluate(() => {
    document.getElementById('emp-s3').style.display = 'none';
    document.getElementById('emp-s4').style.display = 'block';
    
    document.getElementById('sline-3').style.background = 'var(--brand-green)';
    document.getElementById('sdot-4').style.background = 'var(--brand-green)';
    document.getElementById('sdot-4').style.borderColor = 'var(--brand-green)';

    if (document.getElementById('su-inv-code')) document.getElementById('su-inv-code').value = 'INV-9876-WXYZ';
  });
  await wait(500);
  await page.screenshot({ path: 'captures/onboard_step4.png' });

  // 7. Limited Mode
  console.log('Capturing Limited Mode...');
  await page.evaluate(() => {
    document.getElementById('signup-modal').classList.remove('open');
    document.getElementById('signup-modal').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    // Ensure body gets the class!
    document.body.classList.add('is-limited');
    document.getElementById('limited-mode-banner').style.display = 'block';
    
    // Open drawer
    const drawerOverlay = document.getElementById('drawer-overlay');
    const navDrawer = document.querySelector('.nav-drawer');
    if (drawerOverlay && navDrawer) {
      drawerOverlay.classList.add('active');
      navDrawer.classList.add('open');
    }
  });
  await wait(1000);
  await page.screenshot({ path: 'captures/onboard_limited.png' });

  await browser.close();
  console.log('All done!');
})();
