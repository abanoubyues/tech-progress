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

/**
 * shape 'circle' puts the black behind the artwork only, as a disc, leaving the
 * corners transparent so the icon reads as a round badge rather than a square
 * tile. shape 'square' fills the whole canvas, which maskable icons need.
 */
async function icon(size, inset, file, shape = 'circle') {
  const inner = Math.round(size * inset);
  const art = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const dest = path.join(OUT, file);

  if (shape === 'square') {
    // Two passes on purpose: compositing alone leaves the transparent parts of
    // the artwork transparent, so the result is flattened onto black to
    // guarantee a solid background rather than a see-through icon.
    const composed = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: art, gravity: 'center' }])
      .png()
      .toBuffer();

    await sharp(composed).flatten({ background: BLACK }).png({ compressionLevel: 9 }).toFile(dest);
  } else {
    // A hair larger than the artwork so no light pixel of the outer ring lands
    // on a transparent edge and fringes.
    const r = (inner / 2) * 1.01;
    const disc = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#000000"/></svg>`
    );

    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: await sharp(disc).png().toBuffer() },
        { input: art, gravity: 'center' },
      ])
      .png({ compressionLevel: 9 })
      .toFile(dest);
  }

  const { size: bytes } = await fs.stat(dest);
  console.log(
    `  ${file.padEnd(26)} ${size}x${size} ${shape.padEnd(6)} inset ${Math.round(inset * 100)}% ${(bytes / 1024).toFixed(1)} KB`
  );
}

// Round badges: the black sits behind the art only, corners stay transparent.
await icon(16, 0.98, 'favicon-16.png');
await icon(32, 0.98, 'favicon-32.png');
await icon(48, 0.98, 'favicon-48.png');
await icon(192, 0.98, 'icon-192.png');
await icon(512, 0.98, 'icon-512.png');

// iOS composites transparency to black and applies its own rounded-square mask,
// so a disc here would just become a black tile. Full bleed is honest about that.
await icon(180, 0.9, 'apple-touch-icon.png', 'square');

// Android crops maskable icons itself, so these must fill the square. Its
// circular mask is what makes the launcher icon round.
await icon(192, 0.72, 'icon-maskable-192.png', 'square');
await icon(512, 0.72, 'icon-maskable-512.png', 'square');

// Multi-resolution .ico for older browsers and Windows pinned sites.
const ico = await pngToIco([16, 32, 48].map((s) => path.join(OUT, `favicon-${s}.png`)));
await fs.writeFile(path.join(OUT, 'favicon.ico'), ico);
console.log(`  favicon.ico                16+32+48 ${(ico.length / 1024).toFixed(1)} KB`);
