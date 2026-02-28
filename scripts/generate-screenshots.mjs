/**
 * Store screenshot generation script using Playwright.
 * Captures PomoCare app screens at store-required resolutions.
 *
 * Usage: node scripts/generate-screenshots.mjs
 * Requires: dev server running on http://localhost:5174 (npm run dev)
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'screenshots');
const BASE_URL = 'http://localhost:5174';

// Viewports for each store
const PHONE = { width: 1080, height: 1920, deviceScaleFactor: 3 };
const DESKTOP = { width: 1920, height: 1080, deviceScaleFactor: 1 };

// Sample session data to make stats look realistic
function makeSessions() {
  const sessions = [];
  const labels = ['Work', 'Study', 'Reading', 'Exercise'];
  const now = new Date();
  for (let d = 0; d < 7; d++) {
    const count = Math.floor(Math.random() * 6) + 1;
    for (let i = 0; i < count; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(9 + i * 2, Math.floor(Math.random() * 60));
      sessions.push({
        id: `s-${d}-${i}`,
        startTime: date.toISOString(),
        duration: [15, 25, 35, 45][Math.floor(Math.random() * 4)] * 60,
        label: labels[Math.floor(Math.random() * labels.length)],
        completed: true,
      });
    }
  }
  return sessions;
}

function makeLabels() {
  return [
    { id: 'l1', name: 'Work', color: '#0abab5' },
    { id: 'l2', name: 'Study', color: '#6366f1' },
    { id: 'l3', name: 'Reading', color: '#f59e0b' },
    { id: 'l4', name: 'Exercise', color: '#ef4444' },
  ];
}

function defaultSettings(overrides = {}) {
  return {
    workTime: 25,
    breakTime: 5,
    longBreakTime: 20,
    longBreakInterval: 4,
    alarmSound: 'bell',
    alarmRepeat: 1,
    theme: 'light',
    language: 'ja',
    activePresets: [15, 25, 35, 45],
    restPresets: [5, 10, 15],
    customMessage: '',
    labels: makeLabels(),
    activeLabel: null,
    customColors: [],
    ...overrides,
  };
}

async function setupPage(page, settingsOverrides = {}) {
  const settings = defaultSettings(settingsOverrides);
  const sessions = makeSessions();
  await page.addInitScript(({ settings, sessions }) => {
    localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
    localStorage.setItem('pomodoro-sessions', JSON.stringify(sessions));
  }, { settings, sessions });
}

async function screenshot(page, name, viewport) {
  const filename = join(OUT_DIR, `${name}-${viewport === PHONE ? 'phone' : 'desktop'}.png`);
  await page.screenshot({ path: filename, type: 'png' });
  console.log(`  ✓ ${name}-${viewport === PHONE ? 'phone' : 'desktop'}.png`);
}

async function captureAllScreens(browser, viewport, suffix) {
  console.log(`\nCapturing ${suffix} screenshots (${viewport.width}x${viewport.height})...`);

  const context = await browser.newContext({
    viewport: { width: Math.floor(viewport.width / (viewport.deviceScaleFactor || 1)), height: Math.floor(viewport.height / (viewport.deviceScaleFactor || 1)) },
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
  });

  // 1. Timer (Light theme, Japanese)
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'light', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '01-timer-light', viewport);
    await page.close();
  }

  // 2. Stats
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'light', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // Click stats icon (bar chart)
    const statsBtn = page.locator('button:has(svg.lucide-bar-chart-3), button:has(svg.lucide-chart-no-axes-column)').first();
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      await page.waitForTimeout(800);
    }
    await screenshot(page, '02-stats', viewport);
    await page.close();
  }

  // 3. Settings (General tab)
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'light', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const settingsBtn = page.locator('button:has(svg.lucide-settings)').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(800);
    }
    await screenshot(page, '03-settings', viewport);
    await page.close();
  }

  // 4. Settings (Labels tab)
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'light', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const settingsBtn = page.locator('button:has(svg.lucide-settings)').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
    }
    // Click labels tab
    const labelsTab = page.getByRole('button', { name: /ラベル/ });
    if (await labelsTab.isVisible()) {
      await labelsTab.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, '04-labels', viewport);
    await page.close();
  }

  // 5. Dark theme
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'dark', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '05-timer-dark', viewport);
    await page.close();
  }

  // 6. English language
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'light', language: 'en' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '06-timer-english', viewport);
    await page.close();
  }

  // 7. Gray theme
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'gray', language: 'ja' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '07-timer-gray', viewport);
    await page.close();
  }

  // 8. Stats English
  {
    const page = await context.newPage();
    await setupPage(page, { theme: 'dark', language: 'en' });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const statsBtn = page.locator('button:has(svg.lucide-bar-chart-3), button:has(svg.lucide-chart-no-axes-column)').first();
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      await page.waitForTimeout(800);
    }
    await screenshot(page, '08-stats-dark-en', viewport);
    await page.close();
  }

  await context.close();
}

async function generateFeatureGraphic() {
  console.log('\nGenerating Feature Graphic (1024x500)...');
  const sharp = (await import('sharp')).default;
  const { readFileSync } = await import('fs');

  const logoSvg = readFileSync(join(__dirname, '..', 'public', 'icons', 'logo.svg'));

  // Create the feature graphic: tiffany background + logo + tagline
  const svgTemplate = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0abab5"/>
        <stop offset="100%" stop-color="#088f8b"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="500" fill="url(#bg)"/>
    <circle cx="512" cy="200" r="80" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.3"/>
    <polygon points="492,148 492,252 560,200" fill="#ffffff"/>
    <text x="512" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">PomoCare</text>
    <text x="512" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#ffffff" opacity="0.85">Focus Timer for Deep Work</text>
  </svg>`;

  await sharp(Buffer.from(svgTemplate))
    .resize(1024, 500)
    .png()
    .toFile(join(OUT_DIR, 'feature-graphic.png'));
  console.log('  ✓ feature-graphic.png');
}

async function main() {
  console.log('PomoCare Store Screenshot Generator\n');

  // Generate feature graphic (no browser needed)
  await generateFeatureGraphic();

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  // Phone screenshots (1080x1920 for Google Play)
  await captureAllScreens(browser, PHONE, 'phone');

  // Desktop screenshots (1920x1080 for Microsoft Store)
  await captureAllScreens(browser, DESKTOP, 'desktop');

  await browser.close();

  console.log('\nDone! Screenshots saved to public/screenshots/');
  console.log('Note: dev server must be running (npm run dev) for screenshots to work.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
