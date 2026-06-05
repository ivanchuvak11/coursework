import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("C:/Users/Ivan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json");
const { chromium } = require("playwright");
const root = "C:/programming/coursework/outputs/manual-notification-slides/presentations/notification-slides";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(`file:///${path.join(root, "notification-examples.html").replaceAll("\\", "/")}`);
await page.locator("#sms").screenshot({ path: path.join(root, "assets", "sms-example.png") });
await page.locator("#email").screenshot({ path: path.join(root, "assets", "email-example.png") });
await browser.close();
