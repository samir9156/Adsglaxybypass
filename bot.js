/**
 * @file AdsGalaxy Railway Bot - Final Fixed Version
 * @description Auto account creation, GitHub DB sync, IP check, and Railway Auto-redeploy.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// ENVIRONMENT VARIABLES
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
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];
const FIRST_NAMES = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda'];
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis'];

/**
 * @param {number} ms - Wait time in milliseconds
 * @returns {Promise<void>}
 */
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

/**
 * Fetches the current outbound IP of the Railway container.
 * @returns {Promise<string>} IP Address
 */
async function getCurrentIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return 'Unknown IP';
    }
}

// ==========================================
// 1. GITHUB DATABASE FUNCTION
// ==========================================
/**
 * @param {string} accountData - Account string to append
 */
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
        console.log(`[⏳] Syncing with GitHub Database...`);
        let sha = null;
        let existingContent = '';

        // Check if file exists
        const getRes = await fetch(url, { headers });
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
            existingContent = Buffer.from(data.content, 'base64').toString('utf-8');
        } else if (getRes.status === 404) {
            console.log(`[+] accounts.txt not found. Creating new file...`);
        }

        // Append new data
        const updatedContent = existingContent ? `${existingContent}${accountData}\n` : `${accountData}\n`;
        const base64Content = Buffer.from(updatedContent).toString('base64');

        // Prepare payload
        const payload = {
            message: `Added account: ${accountData.split('|')[0].trim()}`,
            content: base64Content,
            branch: "main"
        };
        
        // SHA is ONLY required if the file already exists
        if (sha) payload.sha = sha;

        // Push to GitHub
        const putRes = await fetch(url, {
            method: 'PUT',
            headers,
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
// 2. RAILWAY AUTO-REDEPLOY FUNCTION
// ==========================================
async function triggerRailwayRedeploy() {
    if (!RAILWAY_TOKEN || !RAILWAY_ENV_ID || !RAILWAY_SERVICE_ID) {
        console.log(`[!] Railway API keys missing. Restarting locally...`);
        process.exit(0); 
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
            process.exit(0); 
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
    
    // Fetch and display IP & Email first
    const currentIP = await getCurrentIP();
    const email = generateEmail();
    const selectedUA = UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

    console.log(`[📧] Email Used: ${email}`);
    console.log(`[🌐] Current IP: ${currentIP}`);
    console.log(`[🕵️] User-Agent: ${selectedUA.substring(0, 40)}...`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setUserAgent(selectedUA);

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
        
        // Trigger Auto-Redeploy
        await triggerRailwayRedeploy();
    }
}

runBot();
