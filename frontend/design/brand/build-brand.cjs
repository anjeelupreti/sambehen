// Run from the repo: node frontend/design/brand/build-brand.cjs
// Turns the supplied logo art into the brand files the app uses:
//  - public/brand/logo-mark.png        flat mark, trimmed, transparent
//  - public/brand/logo-mark-dark.png   same, with a light hat for dark backgrounds
//  - public/brand/logo-3d.png          3D mark with the baked-in checkerboard removed
//  - app/favicon.ico, app/icon.png, app/apple-icon.png
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const FE = path.resolve(__dirname, '../..');
const sharp = createRequire(path.join(FE, 'package.json'))('sharp');

const raw = async (input) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const toPng = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).png();

function trim(img, pad = 0) {
  let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.data[(y * img.w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(img.w - 1, x1 + pad); y1 = Math.min(img.h - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(out, y * w * 4, ((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x0 + w) * 4);
  return { data: out, w, h };
}

function square(img, marginRatio) {
  const side = Math.round(Math.max(img.w, img.h) * (1 + 2 * marginRatio));
  const out = Buffer.alloc(side * side * 4);
  const ox = Math.round((side - img.w) / 2), oy = Math.round((side - img.h) / 2);
  for (let y = 0; y < img.h; y++) img.data.copy(out, ((y + oy) * side + ox) * 4, y * img.w * 4, (y + 1) * img.w * 4);
  return { data: out, w: side, h: side };
}

/** Removes a flattened "transparency" checkerboard connected to the edges. */
function removeCheckerboard(img) {
  const { data, w, h } = img;
  const isBg = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= 22 && Math.min(r, g, b) >= 90;
  };
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !isBg(i)) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    // Soften the one-pixel fringe that touches the removed background.
    const x = i % w, y = (i / w) | 0;
    const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (edge) data[i * 4 + 3] = 150;
  }
  return img;
}

/** The navy hat, lightened, for dark backgrounds. */
function lightHat(img) {
  const out = { ...img, data: Buffer.from(img.data) };
  for (let i = 0; i < out.w * out.h; i++) {
    const r = out.data[i * 4], g = out.data[i * 4 + 1], b = out.data[i * 4 + 2], a = out.data[i * 4 + 3];
    if (a === 0) continue;
    const navy = b < 150 && r < 120 && g < 120;
    if (navy) { out.data[i * 4] = 232; out.data[i * 4 + 1] = 236; out.data[i * 4 + 2] = 244; }
  }
  return out;
}

/** A white keyline around the whole silhouette, so it reads on dark tab bars. */
function outline(img, radius) {
  const { w, h, data } = img;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data[i * 4 + 3];
  const tmp = new Uint8Array(w * h), dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -radius; k <= radius; k++) { const xx = x + k; if (xx >= 0 && xx < w) m = Math.max(m, a[y * w + xx]); }
      tmp[y * w + x] = m;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -radius; k <= radius; k++) { const yy = y + k; if (yy >= 0 && yy < h) m = Math.max(m, tmp[yy * w + x]); }
      dil[y * w + x] = m;
    }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const fa = a[i] / 255;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(data[i * 4 + c] * fa + 255 * (1 - fa));
    out[i * 4 + 3] = Math.max(a[i], dil[i]);
  }
  return { data: out, w, h };
}

(async () => {
  fs.mkdirSync(path.join(FE, 'public/brand'), { recursive: true });

  const flat = trim(await raw(path.join(FE, 'design/brand/logo-flat-source.png')), 2);
  await toPng(flat).toFile(path.join(FE, 'public/brand/logo-mark.png'));
  await toPng(lightHat(flat)).toFile(path.join(FE, 'public/brand/logo-mark-dark.png'));

  const threeD = trim(removeCheckerboard(await raw(path.join(FE, 'design/brand/logo-3d-source.png'))), 2);
  await toPng(threeD).toFile(path.join(FE, 'public/brand/logo-3d.png'));

  // Icons: square, a little margin, white keyline.
  const sq = square(flat, 0.06);
  const keyed = outline(sq, Math.round(sq.w * 0.035));
  const icon = (size) => toPng(keyed).resize(size, size, { kernel: 'lanczos3' }).toBuffer();
  fs.writeFileSync(path.join(FE, 'app/icon.png'), await icon(512));

  // Apple icon: opaque, white ground, generous padding (iOS rounds it).
  const appleSq = square(flat, 0.2);
  await toPng(appleSq).resize(180, 180).flatten({ background: '#ffffff' }).toFile(path.join(FE, 'app/apple-icon.png'));

  const pngs = [];
  for (const s of [16, 32, 48]) pngs.push([s, await icon(s)]);
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map(([s, buf]) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12); offset += buf.length;
    return e;
  });
  fs.writeFileSync(path.join(FE, 'app/favicon.ico'), Buffer.concat([head, ...dir, ...pngs.map((p) => p[1])]));

  // Preview sheet.
  const tile = async (file, size, bg) =>
    sharp({ create: { width: size + 40, height: size + 40, channels: 4, background: bg } })
      .composite([{ input: await sharp(file).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), left: 20, top: 20 }])
      .png().toBuffer();
  const parts = [
    await tile(path.join(FE, 'public/brand/logo-mark.png'), 160, '#f6f7fb'),
    await tile(path.join(FE, 'public/brand/logo-mark-dark.png'), 160, '#0d1322'),
    await tile(path.join(FE, 'public/brand/logo-3d.png'), 160, '#f6f7fb'),
    await tile(path.join(FE, 'public/brand/logo-3d.png'), 160, '#0d1322'),
    await tile(pngs[1][1], 32, '#f6f7fb'), await tile(pngs[1][1], 32, '#202124'),
    await tile(pngs[0][1], 16, '#f6f7fb'), await tile(pngs[0][1], 16, '#202124'),
    await tile(path.join(FE, 'app/apple-icon.png'), 90, '#f6f7fb'),
  ];
  let x = 0; const comps = [];
  for (const p of parts) { const m = await sharp(p).metadata(); comps.push({ input: p, left: x, top: 0 }); x += m.width + 10; }
  await sharp({ create: { width: x, height: 200, channels: 4, background: '#ffffff' } }).composite(comps).png()
    .toFile(path.join(require('os').tmpdir(), 'howdi-brand-preview.png'));
  console.log('flat', flat.w, flat.h, '3d', threeD.w, threeD.h);
})();
