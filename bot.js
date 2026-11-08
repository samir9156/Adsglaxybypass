/**
 * @file AdsGalaxy Railway Bot
 * @description Automated account creation with 3-min delay and unique email generation.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// CONFIGURATION
// ==========================================
const TARGET_URLS = process.env.TARGET_URLS 
    ? process.env.TARGET_URLS.split(',').map(url => url.trim()).filter(url => url !== '') 
    : ['https://app.adsgalaxy.online/api/clicks/62/2237426'];

const PASSWORD = process.env.BOT_PASSWORD || 'Test@12345';
const DELAY_MINUTES = 3; 

if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
];

const FIRST_NAMES = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda', 'william', 'elizabeth', 'david', 'barbara', 'richard', 'susan'];
const LAST_NAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez'];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @returns {string} A highly unique email address
 */
function generateRealisticEmail() {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const num = Math.floor(Math.random() * 999999);
    const letters = Math.random().toString(36).substring(2, 4); 
    return `${f}.${l}${num}${letters}@gmail.com`;
}

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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
        console.log(`[+] Register form detected. Filling with: ${email}`);
        await page.type('input[name="email"]', String(email), { delay: 50 });
        
        await page.evaluate((pw) => {
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = String(pw);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }, password);
        
        await page.evaluate(() => {
            const btn = document.querySelector('#sub-email');
            if(btn) btn.click();
        });
        
        console.log(`[+] Clicked Create Account. Checking status...`);
        await delay(5000);

        const isStillRegisterForm = await page.evaluate(() => !!document.querySelector('input[name="email"]'));
        const errorText = await page.evaluate(() => document.body.innerText);
        
        if (isStillRegisterForm && (errorText.includes('already') || errorText.includes('exists') || errorText.includes('error'))) {
            console.log(`[⚠️] Email already registered or Error occurred!`);
            return false; 
        }
    }

    const hasLoginInput = await page.evaluate(() => !!document.querySelector('input[name="identifier"]'));
    if (hasLoginInput) {
        console.log(`[+] Login form detected. Signing in...`);
        await page.type('input[name="identifier"]', String(email), { delay: 50 });
        await page.evaluate((pw) => {
            document.querySelectorAll('input[type="password"]').forEach(input => {
                input.value = String(pw);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }, password);
        await page.evaluate(() => {
            const btn = document.querySelector('button.btn-primary');
            if(btn) btn.click();
        });
        await delay(5000);
    }

    console.log(`[+] Navigating to Tasks page...`);
    const clickedTasks = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, button, div'));
        const taskBtn = elements.find(el =>
            (el.innerText && el.innerText.trim().toUpperCase() === 'TASKS') ||
            (el.href && el.href.toLowerCase().includes('task'))
        );
        if (taskBtn) { taskBtn.click(); return true; }
        return false;
    });

    if (clickedTasks) await delay(3000);

    console.log(`[+] Looking for UNLOCK button...`);
    const hasUnlock = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, .btn-task, a'));
        const target = btns.find(b =>
            (b.innerText && b.innerText.toUpperCase().includes('UNLOCK')) ||
            b.classList.contains('btn-task')
        );
        if (target) { target.click(); return true; }
        return false;
    });

    if (hasUnlock) {
        console.log(`[✅] UNLOCK clicked. Claiming...`);
        await delay(6000);
        return true;
    } else {
        console.log(`[❌] UNLOCK button not found.`);
        return false;
    }
}

async function runBot() {
    console.log(`[+] Railway Bot Started!`);
    while (true) {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setUserAgent(getRandomUA());

        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 3) {
            attempts++;
            const email = generateRealisticEmail();
            console.log(`\n[📧] Attempt ${attempts} | Email: ${email}`);

            try {
                let urlsProcessed = 0;
                for (let i = 0; i < TARGET_URLS.length; i++) {
                    const urlSuccess = await processUrl(page, TARGET_URLS[i], email, PASSWORD);
                    if (!urlSuccess && i === 0) {
                        throw new Error("First link processing failed. Maybe email exists.");
                    }
                    if (urlSuccess) urlsProcessed++;
                }
                
                if (urlsProcessed > 0) {
                    fs.appendFileSync('accounts.txt', `${email} | ${PASSWORD} | SUCCESS\n`);
                    success = true; 
                }
            } catch (error) {
                console.error(`[!] Attempt failed: ${error.message}`);
                if (attempts === 3) {
                    console.error(`[❌] Failed 3 times. Moving to next iteration.`);
                }
            }
        }

        await context.close();
        await browser.close();
        console.log(`\n[+] Data cleared. Waiting ${DELAY_MINUTES} minutes...`);
        await delay(DELAY_MINUTES * 60 * 1000);
    }
}

runBot();
