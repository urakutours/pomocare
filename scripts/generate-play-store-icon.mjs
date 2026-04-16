#!/usr/bin/env node
/**
 * Resizes resources/icon.png (1024x1024) to 512x512 for Google Play Store listing.
 * Output: resources/play-store-icon-512.png
 */
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'resources', 'icon.png');
const dst = join(__dirname, '..', 'resources', 'play-store-icon-512.png');

await sharp(src)
  .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
  .png({ quality: 100, compressionLevel: 9 })
  .toFile(dst);

console.log(`[generate-play-store-icon] wrote ${dst}`);
