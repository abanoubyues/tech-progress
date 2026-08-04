/**
 * Regenerates public/icons/ from assets/tree-of-life.png.
 *
 * Only needed when the artwork changes; the generated icons are committed. Run:
 *   npm install --no-save sharp png-to-ico
 *   node scripts/build-icons.mjs
 *
 * The source is transparent line art, so every output is composited onto solid
 * black. Inset differs per target because each platform crops differently:
 *   - favicons / PWA "any": art nearly fills the square
 *   - apple-touch-icon: iOS rounds the corners, so a little breathing room
 *   - maskable: Android can crop to a circle or squircle and only guarantees the
 *     middle 80%, so the art sits well inside that
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets', 'tree-of-life.png');
const OUT = path.join(root, 'public', 'icons');
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

await fs.mkdir(OUT, { recursive: true });

// Trim the transparent margin so the inset maths is about the artwork itself.
const trimmed = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();
const meta = await sharp(trimmed).metadata();
console.log(`source ${meta.width}x${meta.height} after trim`);

async function icon(size, inset, file) {
  const inner = Math.round(size * inset);
  const art = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Two passes on purpose: compositing alone leaves the transparent parts of the
  // artwork transparent, so the result is flattened onto black afterwards to
  // guarantee a solid background rather than a see-through icon.
  const composed = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toBuffer();

  const dest = path.join(OUT, file);
  await sharp(composed).flatten({ background: BLACK }).png({ compressionLevel: 9 }).toFile(dest);

  const { size: bytes } = await fs.stat(dest);
  console.log(
    `  ${file.padEnd(26)} ${size}x${size} inset ${Math.round(inset * 100)}% ${(bytes / 1024).toFixed(1)} KB`
  );
}

await icon(16, 0.96, 'favicon-16.png');
await icon(32, 0.96, 'favicon-32.png');
await icon(48, 0.96, 'favicon-48.png');
await icon(192, 0.94, 'icon-192.png');
await icon(512, 0.94, 'icon-512.png');
await icon(180, 0.88, 'apple-touch-icon.png');
await icon(192, 0.72, 'icon-maskable-192.png');
await icon(512, 0.72, 'icon-maskable-512.png');

// Multi-resolution .ico for older browsers and Windows pinned sites.
const ico = await pngToIco([16, 32, 48].map((s) => path.join(OUT, `favicon-${s}.png`)));
await fs.writeFile(path.join(OUT, 'favicon.ico'), ico);
console.log(`  favicon.ico                16+32+48 ${(ico.length / 1024).toFixed(1)} KB`);
