/**
 * @file AdsGalaxy Railway Bot - Final Version
 * @description Auto account creation, GitHub DB sync, and Railway Auto-redeploy.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// ENVIRONMENT VARIABLES (Railway se aayenge)
// ==========================================
const TARGET_URLS = process.env.TARGET_URLS 
    ? process.env.TARGET_URLS.split(',').map(url => url.trim()).filter(url => url !== '') 
    : ['https://app.adsgalaxy.online/api/clicks/62/2237426'];
const PASSWORD = process.env.BOT_PASSWORD || 'Test@12345';

// GitHub Database Variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'samir9156/Adsglaxybypass';
const GITHUB_FILE = 'accounts.txt';

// Railway Auto-Redeploy Variables
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const RAILWAY_ENV_ID = process.env.RAILWAY_ENV_ID;
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;

// ==========================================
// CONFIGURATION
// ==========================================
const UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];
const FIRST_NAMES = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda'];
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis'];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @returns {string} Unique Random Email
 */
function generateEmail() {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const num = Math.floor(Math.random() * 999999);
    const letters = Math.random().toString(36).substring(2, 4); 
    return `${f}.${l}${num}${letters}@gmail.com`;
}

// ==========================================
// 1. GITHUB DATABASE FUNCTION (Append Mode)
// ==========================================
async function updateGitHubDatabase(accountData) {
    if (!GITHUB_TOKEN) {
        console.log(`[!] GitHub Token missing. Saving locally.`);
        fs.appendFileSync(GITHUB_FILE, accountData + '\n');
        return;
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Railway-Bot'
    };

    try {
        console.log(`[⏳] Syncing with GitHub...`);
        let sha = null;
        let existingContent = '';

        // Fetch existing file
        const getRes = await fetch(url, { headers });
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
            existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
        }

        // Add new data without deleting old
        const updatedContent = existingContent ? `${existingContent}${accountData}\n` : `${accountData}\n`;
        const base64Content = Buffer.from(updatedContent).toString('base64');

        // Push to GitHub
        const putRes = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Added account: ${accountData.split('|')[0].trim()}`,
                content: base64Content,
                sha: sha || undefined
            })
        });

        if (putRes.status === 200 || putRes.status === 201) {
            console.log(`[✅] Database Updated on GitHub!`);
        } else {
            console.log(`[!] GitHub Push Failed: ${putRes.statusText}`);
        }
    } catch (error) {
        console.log(`[!] GitHub Error: ${error.message}`);
    }
}

// ==========================================
// 2. RAILWAY AUTO-REDEPLOY FUNCTION
// ==========================================
async function triggerRailwayRedeploy() {
    if (!RAILWAY_TOKEN || !RAILWAY_ENV_ID || !RAILWAY_SERVICE_ID) {
        console.log(`[!] Railway API keys missing. Force restarting locally...`);
        process.exit(0); // Forces Railway to restart the container
        return;
    }

    console.log(`\n[🔄] Triggering Railway Redeploy for New IP...`);
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
            console.log(`[✅] Redeploy triggered! Container restarting...`);
            await delay(5000); 
            process.exit(0); // Ensure script exits
        }
    } catch (e) {
        console.log(`[!] Redeploy failed: ${e.message}`);
        process.exit(0); 
    }
}

// ==========================================
// 3. CORE BOT LOGIC
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

    // Register
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

    // Login
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

    // Tasks
    const clickedTasks = await page.evaluate(() => {
        const taskBtn = Array.from(document.querySelectorAll('a, button, div')).find(el =>
            (el.innerText && el.innerText.trim().toUpperCase() === 'TASKS') ||
            (el.href && el.href.toLowerCase().includes('task'))
        );
        if (taskBtn) { taskBtn.click(); return true; }
        return false;
    });
    if (clickedTasks) await delay(3000);

    // Unlock
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
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setUserAgent(UA_LIST[Math.floor(Math.random() * UA_LIST.length)]);

    const email = generateEmail();
    console.log(`\n[📧] Email: ${email}`);

    try {
        let success = false;
        // Loop through all target URLs
        for (let i = 0; i < TARGET_URLS.length; i++) {
            const result = await processUrl(page, TARGET_URLS[i], email, PASSWORD);
            if (result) success = true;
        }
        
        if (success) {
            const accountData = `${email} | ${PASSWORD} | SUCCESS`;
            await updateGitHubDatabase(accountData);
        }
        
    } catch (error) {
        console.error(`[!] Error: ${error.message}`);
    } finally {
        await context.close();
        await browser.close();
        
        // 3 minute wait ki jagah Auto-Redeploy trigger
        await triggerRailwayRedeploy();
    }
}

runBot();
