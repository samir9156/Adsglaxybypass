const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_REPO = (process.env.GITHUB_REPO || 'samir9156/Adsglaxybypass').trim();
const GITHUB_FILE = 'accounts.txt';

const TARGET_URLS = process.env.TARGET_URLS 
    ? process.env.TARGET_URLS.split(',').map(url => url.trim()).filter(url => url !== '') 
    : ['https://app.adsgalaxy.online/api/clicks/62/2237426'];
const PASSWORD = (process.env.BOT_PASSWORD || 'Test@12345').trim();

const RAILWAY_TOKEN = (process.env.RAILWAY_TOKEN || '').trim();
const RAILWAY_ENV_ID = (process.env.RAILWAY_ENV_ID || '').trim();
const RAILWAY_SERVICE_ID = (process.env.RAILWAY_SERVICE_ID || '').trim();

// Telegram Userbot Variables
const TG_API_ID = (process.env.TG_API_ID || '').trim();
const TG_API_HASH = (process.env.TG_API_HASH || '').trim();
const TG_SESSION = (process.env.TG_SESSION || '').trim();

const UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];
const FIRST_NAMES = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda'];
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis'];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateEmail() {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const num = Math.floor(Math.random() * 999999);
    const letters = Math.random().toString(36).substring(2, 4); 
    return `${f}.${l}${num}${letters}@gmail.com`;
}

async function updateGitHubDatabase(accountData) {
    if (!GITHUB_TOKEN) return;
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
    const headers = { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Railway-Bot' };

    try {
        let sha = null; let existingContent = '';
        const getRes = await fetch(url, { headers });
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
            existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
        }
        const updatedContent = existingContent ? `${existingContent}${accountData}\n` : `${accountData}\n`;
        const base64Content = Buffer.from(updatedContent).toString('base64');
        const payload = { message: `Added account`, content: base64Content, branch: "main" };
        if (sha) payload.sha = sha;
        await fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(payload) });
    } catch (error) { console.log(`[!] GitHub Error`); }
}

async function triggerRailwayRedeploy() {
    if (!RAILWAY_TOKEN) { process.exit(0); }
    try {
        await fetch('https://backboard.railway.com/graphql/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RAILWAY_TOKEN}` },
            body: JSON.stringify({
                query: `mutation serviceInstanceRedeploy($environmentId: String!, $serviceId: String!) { serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId) }`,
                variables: { environmentId: RAILWAY_ENV_ID, serviceId: RAILWAY_SERVICE_ID }
            })
        });
        process.exit(0); 
    } catch (e) { process.exit(0); }
}

// ==========================================
// SMART PAGE HANDLER
// ==========================================
async function processUrl(page, url, email, password) {
    console.log(`\n[🌐] Processing: ${url}`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) { return false; }

    await delay(2000);
    const pageText = await page.evaluate(() => document.body.innerText);

    // 1. ADS PROMO PAGE DETECT
    if (pageText.includes('Monetize and Advertise') || pageText.includes('Start Bot')) {
        console.log(`[🔍] AdsGalaxy Promo Page Detected!`);
        
        // Extract Telegram Link
        const tgLink = await page.evaluate(() => {
            const aTags = Array.from(document.querySelectorAll('a'));
            const tg = aTags.find(a => a.href && a.href.includes('t.me'));
            return tg ? tg.href : null;
        });

        if (tgLink && TG_SESSION) {
            console.log(`[📨] Sending Start to Bot: ${tgLink}`);
            try {
                // Python script call karein
                const cmd = `python3 telegram_start.py ${TG_API_ID} "${TG_API_HASH}" "${TG_SESSION}" "${tgLink}"`;
                execSync(cmd, { stdio: 'inherit' });
                console.log(`[✅] Telegram action completed!`);
            } catch (err) {
                console.log(`[!] Telegram script failed.`);
            }
        } else {
            console.log(`[!] No Telegram link found or Session missing.`);
        }
        return 'PROMO';
    }

    // 2. TARGET SITE (AliCore/Dollar Tree)
    try {
        await page.waitForSelector('input[name="email"]', { timeout: 3000 });
        await page.evaluate((mail, pw) => {
            document.querySelector('input[name="email"]').value = mail;
            document.querySelector('input[name="email"]').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = pw;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            document.querySelector('#sub-email')?.click();
        }, email, password);
        await page.waitForSelector('input[name="identifier"]', { timeout: 6000 }).catch(() => {});
    } catch (e) {}

    try {
        await page.waitForSelector('input[name="identifier"]', { timeout: 3000 });
        await page.evaluate((mail, pw) => {
            document.querySelector('input[name="identifier"]').value = mail;
            document.querySelector('input[name="identifier"]').dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = pw;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            document.querySelector('button.btn-primary')?.click();
        }, email, password);
        await delay(3000); 
    } catch (e) {}

    try {
        await page.evaluate(() => {
            const taskBtn = Array.from(document.querySelectorAll('a, button, div')).find(el =>
                (el.innerText && el.innerText.trim().toUpperCase() === 'TASKS') || (el.href && el.href.toLowerCase().includes('task'))
            );
            if (taskBtn) taskBtn.click();
        });

        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('button, .btn-task, .btn-unlock')).some(b =>
                (b.innerText && b.innerText.toUpperCase().includes('UNLOCK')) || b.classList.contains('btn-task')
            );
        }, { timeout: 8000 });

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, .btn-task, .btn-unlock')).find(b =>
                (b.innerText && b.innerText.toUpperCase().includes('UNLOCK')) || b.classList.contains('btn-task')
            );
            if (btn) btn.click();
        });
        await delay(3000); 
        return 'SUCCESS';
    } catch (e) { return 'FAILED'; }
}

async function runBot() {
    console.log(`[+] Smart Bot Started!`);
    const email = generateEmail();
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setUserAgent(UA_LIST[Math.floor(Math.random() * UA_LIST.length)]);

    try {
        let accountClaimed = false;
        for (let i = 0; i < TARGET_URLS.length; i++) {
            const status = await processUrl(page, TARGET_URLS[i], email, PASSWORD);
            if (status === 'SUCCESS') accountClaimed = true;
        }
        if (accountClaimed) await updateGitHubDatabase(`${email} | ${PASSWORD} | SUCCESS`);
    } catch (error) { console.error(`[!] Error`); } finally {
        await context.close(); await browser.close();
        await triggerRailwayRedeploy();
    }
}
runBot();
