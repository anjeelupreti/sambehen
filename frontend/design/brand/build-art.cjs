// Run from the repo: node frontend/design/brand/build-art.cjs
//
// Turns the source artwork in this folder into the files the app serves:
//  - mascot-*.png  -> public/brand/mascot/<pose>.webp   (480px)
//  - badges.png    -> public/brand/badges/<milestone>.webp (192px each),
//    split from one strip of five medals.
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const FE = path.resolve(__dirname, '../..');
const sharp = createRequire(path.join(FE, 'package.json'))('sharp');

const OUT = path.join(FE, 'public/brand');
const POSES = ['waving', 'trophy', 'resting', 'megaphone', 'shield', 'door', 'clipboard', 'friends'];
// Medals in the strip, left to right, and which milestones use each.
const MEDALS = [
  ['joined'],
  ['first_message'],
  ['first_referral', 'five_referrals'],
  ['three_months', 'six_months', 'one_year'],
  ['vip'],
];

/** Keeps only the largest opaque shape, dropping stray specks. */
function largestShape({ data, w, h }) {
  const label = new Int32Array(w * h).fill(-1);
  let best = { id: -1, size: 0 };
  let id = 0;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < 24) continue;
    const stack = [start];
    label[start] = id;
    let size = 0;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= w * h || label[n] !== -1 || data[n * 4 + 3] < 24) continue;
        label[n] = id;
        stack.push(n);
      }
    }
    if (size > best.size) best = { id, size };
    id++;
  }
  for (let i = 0; i < w * h; i++) if (label[i] !== best.id) data[i * 4 + 3] = 0;
  return { data, w, h };
}

const raw = async (input) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const fromRaw = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });
const square = (pipeline, size) =>
  pipeline
    .trim({ threshold: 1 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 95 });

(async () => {
  fs.mkdirSync(path.join(OUT, 'mascot'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'badges'), { recursive: true });

  for (const pose of POSES) {
    // Poses are added over time; build the ones that exist.
    if (!fs.existsSync(path.join(__dirname, `mascot-${pose}.png`))) continue;
    const cleaned = largestShape(await raw(path.join(__dirname, `mascot-${pose}.png`)));
    // Re-encode first so trim sees the cleaned alpha.
    const png = await fromRaw(cleaned).png().toBuffer();
    await square(sharp(png), 480).toFile(path.join(OUT, 'mascot', `${pose}.webp`));
  }

  // Find the five medals by scanning for runs of columns that hold artwork.
  const strip = await raw(path.join(__dirname, 'badges.png'));
  const filled = [];
  for (let x = 0; x < strip.w; x++) {
    let n = 0;
    for (let y = 0; y < strip.h; y++) if (strip.data[(y * strip.w + x) * 4 + 3] > 128) n++;
    filled.push(n > 40);
  }
  const runs = [];
  for (let x = 0; x < strip.w; x++) {
    if (filled[x] && (x === 0 || !filled[x - 1])) runs.push([x, x]);
    if (filled[x]) runs[runs.length - 1][1] = x;
  }
  const medals = runs.filter(([a, b]) => b - a > 100);
  if (medals.length !== MEDALS.length) {
    throw new Error(`Expected ${MEDALS.length} medals in badges.png, found ${medals.length}`);
  }

  for (const [index, [x0, x1]] of medals.entries()) {
    const left = Math.max(0, x0 - 4);
    const width = Math.min(strip.w, x1 + 5) - left;
    const crop = await raw(
      await fromRaw(strip).extract({ left, top: 0, width, height: strip.h }).png().toBuffer(),
    );
    const png = await fromRaw(largestShape(crop)).png().toBuffer();
    for (const key of MEDALS[index]) {
      await square(sharp(png), 192).toFile(path.join(OUT, 'badges', `${key}.webp`));
    }
  }
  // The home page sky: nudged off lavender toward the brand blue so the clouds read
  // white next to the white headline, and enlarged once here with a sharp
  // filter rather than by the browser.
  if (fs.existsSync(path.join(__dirname, 'sky-source.png'))) {
    await sharp(path.join(__dirname, 'sky-source.png'))
      .modulate({ hue: -10, saturation: 1.05 })
      .resize(2880, null, { kernel: 'lanczos3' })
      .webp({ quality: 90, smartSubsample: true })
      .toFile(path.join(OUT, 'sky.webp'));
  }
  console.log('Built', POSES.length, 'mascot poses and', medals.length, 'medals.');
})();
