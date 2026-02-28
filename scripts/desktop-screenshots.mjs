import { chromium } from 'playwright';
import path from 'path';

const OUTPUT_DIR = path.resolve('store-screenshots');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    locale: 'en-US',
  });
  const page = await context.newPage();

  // Navigate to PomoCare
  await page.goto('https://app.pomocare.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Screenshot 1: Main timer screen
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-timer.png'), fullPage: false });
  console.log('Captured: desktop-timer.png');

  // Screenshot 2: Open statistics panel
  // Click the stats icon (bar chart icon)
  const statsButton = page.locator('button').filter({ has: page.locator('svg') }).nth(0);
  try {
    // Try clicking the stats icon in the header
    await page.click('header button:first-of-type', { timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-stats.png'), fullPage: false });
    console.log('Captured: desktop-stats.png');
  } catch (e) {
    console.log('Stats click failed, trying alternate selector');
    // Try other approaches
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes('chart')) {
        await btn.click();
        await page.waitForTimeout(1500);
        break;
      }
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-stats.png'), fullPage: false });
    console.log('Captured: desktop-stats.png');
  }

  // Go back to main screen
  await page.goto('https://app.pomocare.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Screenshot 3: Open settings panel
  try {
    // Click the settings icon (gear icon)
    const settingsButtons = await page.locator('svg.lucide-settings').all();
    if (settingsButtons.length > 0) {
      await settingsButtons[0].click();
    } else {
      // Try finding by aria or other means
      await page.click('[aria-label*="settings"], [aria-label*="Settings"]', { timeout: 3000 });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-settings.png'), fullPage: false });
    console.log('Captured: desktop-settings.png');
  } catch (e) {
    console.log('Settings capture failed:', e.message);
  }

  await browser.close();
  console.log('Done! Screenshots saved to', OUTPUT_DIR);
}

main().catch(console.error);
