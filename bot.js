/**
 * @file AdsGalaxy Railway Bot - Final Bulletproof Version
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// ENVIRONMENT VARIABLES (Strict Parsing)
// ==========================================
// Ye line automatically extra spaces, newlines, aur quotes hata degi
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim().replace(/['"]/g, '');
const GITHUB_REPO = (process.env.GITHUB_REPO || 'samir9156/Adsglaxybypass').trim().replace(/['"]/g, '');
const GITHUB_FILE = 'accounts.txt';

const TARGET_URLS = process.env.TARGET_URLS 
    ? process.env.TARGET_URLS.split(',').map(url => url.trim()).filter(url => url !== '') 
    : ['https://app.adsgalaxy.online/api/clicks/62/2237426'];
const PASSWORD = (process.env.BOT_PASSWORD || 'Test@12345').trim();

// Railway API Variables
const RAILWAY_TOKEN = (process.env.RAILWAY_TOKEN || '').trim();
const RAILWAY_ENV_ID = (process.env.RAILWAY_ENV_ID || '').trim();
const RAILWAY_SERVICE_ID = (process.env.RAILWAY_SERVICE_ID || '').trim();

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

// ==========================================
// GITHUB DATABASE FUNCTION
// ==========================================
async function updateGitHubDatabase(accountData) {
    if (!GITHUB_TOKEN) {
        console.log(`[!] GITHUB_TOKEN is missing.`);
        return;
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
    console.log(`[🔍] Fetching URL: ${url}`);
    
    // 'token' prefix is safer for classic PATs
    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Railway-Bot'
    };

    try {
        console.log(`[⏳] Syncing with GitHub Database...`);
        let sha = null;
        let existingContent = '';

        const getRes = await fetch(url, { headers });
        
        // Print exact status code for debugging
        console.log(`[+] GET Status: ${getRes.status}`);
        
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
            existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
            console.log(`[+] File found. SHA: ${sha.substring(0, 7)}...`);
        } else if (getRes.status === 404) {
            console.log(`[+] File not found (404). It will be created.`);
        } else {
            console.log(`[!] GitHub Auth Failed! Status: ${getRes.status}`);
            return;
        }

        const updatedContent = existingContent ? `${existingContent}${accountData}\n` : `${accountData}\n`;
        const base64Content = Buffer.from(updatedContent).toString('base64');

        const payload = {
            message: `Added account: ${accountData.split('|')[0].trim()}`,
            content: base64Content,
            branch: "main"
        };
        if (sha) payload.sha = sha;

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (putRes.status === 200 || putRes.status === 201) {
            console.log(`[✅] Database Updated on GitHub!`);
        } else {
            const errData = await putRes.json();
            console.log(`[!] GitHub Push Failed: ${errData.message}`);
        }
    } catch (error) {
        console.log(`[!] GitHub Error: ${error.message}`);
    }
}

// ==========================================
// RAILWAY REDEPLOY
// ==========================================
async function triggerRailwayRedeploy() {
    if (!RAILWAY_TOKEN || !RAILWAY_ENV_ID || !RAILWAY_SERVICE_ID) {
        console.log(`[!] Railway API keys missing. Restarting locally...`);
        process.exit(0); 
        return;
    }

    console.log(`\n[🔄] Triggering Railway Redeploy...`);
    try {
        const res = await fetch('https://backboard.railway.com/graphql/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RAILWAY_TOKEN}`
            },
            body: JSON.stringify({
                query: `
                    mutation serviceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
                        serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
                    }
                `,
                variables: { environmentId: RAILWAY_ENV_ID, serviceId: RAILWAY_SERVICE_ID }
            })
        });
        
        const data = await res.json();
        if(data.errors) {
            console.log(`[!] Redeploy error:`, data.errors[0].message);
            process.exit(0); 
        } else {
            console.log(`[✅] Redeploy triggered! Restarting...`);
            await delay(5000); 
            process.exit(0); 
        }
    } catch (e) {
        console.log(`[!] Redeploy failed: ${e.message}`);
        process.exit(0); 
    }
}

// ==========================================
// CORE BOT
// ==========================================
async function processUrl(page, url, email, password) {
    console.log(`\n[🌐] Processing: ${url}`);
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.log(`[!] Navigation Error: ${e.message}`);
        return false;
    }
    await delay(2000);

    const hasEmailInput = await page.evaluate(() => !!document.querySelector('input[name="email"]'));
    if (hasEmailInput) {
        await page.type('input[name="email"]', email, { delay: 50 });
        await page.evaluate((pw) => {
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = String(pw);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }, password);
        await page.evaluate(() => document.querySelector('#sub-email')?.click());
        await delay(5000);
    }

    const hasLoginInput = await page.evaluate(() => !!document.querySelector('input[name="identifier"]'));
    if (hasLoginInput) {
        await page.type('input[name="identifier"]', email, { delay: 50 });
        await page.evaluate((pw) => {
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = String(pw);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }, password);
        await page.evaluate(() => document.querySelector('button.btn-primary')?.click());
        await delay(5000);
    }

    const clickedTasks = await page.evaluate(() => {
        const taskBtn = Array.from(document.querySelectorAll('a, button, div')).find(el =>
            (el.innerText && el.innerText.trim().toUpperCase() === 'TASKS') ||
            (el.href && el.href.toLowerCase().includes('task'))
        );
        if (taskBtn) { taskBtn.click(); return true; }
        return false;
    });
    if (clickedTasks) await delay(3000);

    const hasUnlock = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button, .btn-task, .btn-unlock')).find(b =>
            (b.innerText && b.innerText.toUpperCase().includes('UNLOCK')) ||
            b.classList.contains('btn-task')
        );
        if (btn) { btn.click(); return true; }
        return false;
    });

    if (hasUnlock) {
        await delay(5000);
        return true;
    }
    return false;
}

async function runBot() {
    console.log(`[+] Railway Bot Started!`);
    
    const email = generateEmail();
    const selectedUA = UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
    console.log(`[📧] Email: ${email}`);
    console.log(`[🕵️] UA: ${selectedUA.substring(0, 40)}...`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setUserAgent(selectedUA);

    try {
        let success = false;
        for (let i = 0; i < TARGET_URLS.length; i++) {
            const result = await processUrl(page, TARGET_URLS[i], email, PASSWORD);
            if (result) success = true;
        }
        
        if (success) {
            await updateGitHubDatabase(`${email} | ${PASSWORD} | SUCCESS`);
        }
        
    } catch (error) {
        console.error(`[!] Error: ${error.message}`);
    } finally {
        await context.close();
        await browser.close();
        await triggerRailwayRedeploy();
    }
}

runBot();
