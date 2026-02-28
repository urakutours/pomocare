/**
 * SVG → PNG アイコン生成スクリプト
 * ストア登録（Microsoft Store / Google Play）に必要なPNGアイコンを生成する
 *
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

// Standard icon sizes (from icon-512x512.svg)
const STANDARD_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];

// Maskable icon sizes (from icon-maskable-512x512.svg)
const MASKABLE_SIZES = [192, 512];

async function generate() {
  console.log('Generating PNG icons...\n');

  // --- Standard icons ---
  const standardSvg = readFileSync(join(ICONS_DIR, 'icon-512x512.svg'));
  for (const size of STANDARD_SIZES) {
    const out = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(standardSvg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`  ✓ icon-${size}x${size}.png`);
  }

  // --- Maskable icons ---
  const maskableSvg = readFileSync(join(ICONS_DIR, 'icon-maskable-512x512.svg'));
  for (const size of MASKABLE_SIZES) {
    const out = join(ICONS_DIR, `icon-maskable-${size}x${size}.png`);
    await sharp(maskableSvg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`  ✓ icon-maskable-${size}x${size}.png`);
  }

  // --- Apple touch icon ---
  const appleSvg = readFileSync(join(ICONS_DIR, 'apple-touch-icon.svg'));
  const appleOut = join(ICONS_DIR, 'apple-touch-icon.png');
  await sharp(appleSvg, { density: 300 })
    .resize(180, 180)
    .png()
    .toFile(appleOut);
  console.log('  ✓ apple-touch-icon.png');

  console.log(`\nDone! Generated ${STANDARD_SIZES.length + MASKABLE_SIZES.length + 1} PNG icons.`);
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
