const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const dir = 'docs/img/captures';
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 414, height: 896 }
  });
  
  const page = await browser.newPage();
  
  const capture = async (name) => {
    await new Promise(r => setTimeout(r, 500)); // small delay to ensure rendering
    await page.screenshot({ path: `${dir}/${name}.png` });
    console.log(`Captured: ${name}.png`);
  };

  const clickByText = async (tag, text) => {
    await page.evaluate((tag, text) => {
      const elements = [...document.querySelectorAll(tag)];
      const target = elements.find(el => el.innerText.includes(text));
      if(target) target.click();
    }, tag, text);
    await new Promise(r => setTimeout(r, 500));
  };

  await page.goto('http://localhost:8000/app-mobile.html');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });

  // 1. Bienvenue
  await capture('onboarding_welcome');

  // 2. Stepper Step 1 (Infos perso)
  await clickByText('button', 'Créer mon compte');
  await page.waitForSelector('#su-nom', {visible: true});
  await capture('onboarding_step1');

  // Fill Step 1
  await page.type('#su-nom', 'DOE');
  await page.type('#su-prenom', 'JOHN');
  await page.type('#su-email', 'john@test.com');
  await page.type('#su-tel', '0612345678');
  await page.evaluate(() => { document.getElementById('su-dob').value = '1990-01-01'; });
  
  // click Suivant
  await clickByText('button', 'Suivant');
  
  // 3. Stepper Step 2 (Infos pro)
  await capture('onboarding_step2');
  await page.select('#su-permis-type', 'VL');
  await page.type('#su-permis-num', '123456789');
  await page.evaluate(() => { document.getElementById('su-fco').value = '2030-01-01'; });
  await page.evaluate(() => { document.getElementById('su-visite').value = '2030-01-01'; });
  await clickByText('button', 'Suivant');

  // 4. Stepper Step 3 (Security)
  await capture('onboarding_step3');
  await page.type('#su-mdp', 'Admin123!');
  await page.type('#su-mdp-conf', 'Admin123!');
  await page.type('#su-pin', '1234');
  await page.type('#su-pin-conf', '1234');
  await clickByText('button', 'Suivant');

  // 5. Stepper Step 4 (Activation)
  await capture('onboarding_step4');
  
  // 6. Mode Limité
  await clickByText('button', 'Plus tard');
  await new Promise(r => setTimeout(r, 1000));
  
  // Open drawer to show padlocks
  await page.evaluate(() => {
    if(window.S2W && S2W.toggleDrawer) S2W.toggleDrawer();
    else document.querySelector('.menu-trigger')?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await capture('onboarding_limited_mode');

  await browser.close();
})();
