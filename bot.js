import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// ===== CONFIG =====
const LOGIN_URL = process.env.LOGIN_URL;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ===== SETTINGS =====
const fuelThreshold = 450;
const co2Threshold = 115;
const maxAmount = 2000000;
const BOOST_INTERVAL = 60 * 60 * 1000;

// ===== MEMORY (in-memory only) =====
let memory = {};

// ===== TELEGRAM =====
async function sendTelegram(msg) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
    });
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

// ===== FETCH CASH =====
async function getCash(page) {
    await page.goto("https://airlinemanager.com/banking.php", { waitUntil: "domcontentloaded" });
    return await page.evaluate(() => {
        const m = document.body.innerText.match(/\$\s?([\d,]+)/);
        return m ? parseInt(m[1].replace(/,/g, "")) : 0;
    });
}

// ===== BUY =====
async function buy(page, type, price, amount) {
    const before = await getCash(page);

    await page.evaluate(async (type, amount) => {
        await fetch(`https://airlinemanager.com/${type}.php?mode=do&amount=${amount}`, {
            credentials: "include"
        });
    }, type, amount);

    await new Promise(r => setTimeout(r, 3000));

    const after = await getCash(page);

    if (after < before) {
        const total = (price * amount) / 1000;

        await sendTelegram(
`✅ ${type.toUpperCase()} BOUGHT
Price: $${price}/1000
Amount: ${amount}
Total: $${total}`
        );
        return true;
    }

    return false;
}

// ===== MAIN FUNCTION =====
export default async function runBot() {

    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
    });

    const page = await browser.newPage();
    const now = Date.now();

    try {
        await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

        // ✈️ DEPART
        await page.goto("https://airlinemanager.com/routes_main.php");

        const ids = await page.evaluate(() =>
            [...document.querySelectorAll("[id^=routeMainList]")]
                .map(el => el.id.match(/\d+/)?.[0])
                .filter(Boolean)
        );

        if (ids.length > 0) {
            const res = await page.evaluate(async (ids) => {
                const r = await fetch(
                    `https://airlinemanager.com/route_depart.php?mode=all&ids=${ids.join(",")}`,
                    { credentials: "include" }
                );
                return await r.text();
            }, ids);

            if (res.includes("playSound('depart')")) {
                await sendTelegram("✈️ Depart completed");
            }
        }

        // 💰 CASH
        const cash = await getCash(page);

        if (cash > 7000000) {
            await sendTelegram(`💰 Cash Alert: $${cash.toLocaleString()}`);
        }

        // ⛽ FUEL
        await page.goto("https://airlinemanager.com/fuel.php");

        const fuelPrice = await page.evaluate(() => {
            const m = document.body.innerText.match(/\$\s?([\d,]+)/g);
            return m ? parseInt(m.pop().replace(/[$,]/g, "")) : null;
        });

        if (fuelPrice !== null && fuelPrice <= fuelThreshold) {
            await buy(page, "fuel", fuelPrice, maxAmount);
        }

        // 🌱 CO2
        await page.goto("https://airlinemanager.com/co2.php");

        const co2Price = await page.evaluate(() => {
            const m = document.body.innerText.match(/\$\s?([\d,]+)/g);
            return m ? parseInt(m.pop().replace(/[$,]/g, "")) : null;
        });

        if (co2Price !== null && co2Price <= co2Threshold) {
            await buy(page, "co2", co2Price, maxAmount);
        }

        // 📊 BOOST REPORT
        await sendTelegram("✅ Bot cycle completed");

        memory.cash = cash;
        memory.time = now;

    } catch (err) {
        console.log(err);
        await sendTelegram("❌ ERROR: " + err.message);
    }

    await browser.close();
}
