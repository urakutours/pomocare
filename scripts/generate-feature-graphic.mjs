#!/usr/bin/env node
/**
 * Generates a 1024x500 feature graphic for Google Play Store listing.
 * Background: tiffany (#0abab5) → darker gradient
 * Content: app logo + tagline ("Focus deeper.")
 * Output: resources/play-feature-graphic.png
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'resources');
const outPath = join(outDir, 'play-feature-graphic.png');

mkdirSync(outDir, { recursive: true });

const WIDTH = 1024;
const HEIGHT = 500;

// SVG with gradient + logo + tagline
// Two arrows logo (matching resources/icon.png design)
// Arrow 1 (lighter): path="M 0,0 L 120,100 L 0,200 Z"
// Arrow 2 (white): offset 55px right
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#14aca8"/>

  <!-- Two arrows logo on the right side -->
  <g transform="translate(780, 160)">
    <!-- Light arrow (behind) -->
    <polygon points="0,0 120,90 0,180" fill="rgba(255,255,255,0.45)"/>
    <!-- White arrow (front) -->
    <polygon points="60,0 180,90 60,180" fill="#ffffff"/>
  </g>

  <!-- App name -->
  <text x="80" y="230" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="115" font-weight="700" fill="#ffffff" letter-spacing="-2">PomoCare</text>

  <!-- Tagline -->
  <text x="82" y="305" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="38" font-weight="400" fill="rgba(255,255,255,0.95)">Focus deeper. Simply.</text>

  <!-- Secondary line -->
  <text x="82" y="360" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" font-weight="400" fill="rgba(255,255,255,0.75)">A Pomodoro timer for deep work</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(outPath);

console.log(`[generate-feature-graphic] wrote ${outPath} (${WIDTH}x${HEIGHT})`);
