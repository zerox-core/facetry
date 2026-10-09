// Chroma-key green background -> transparent PNG, then crop to content with small margin.
const path = require('path');
const Jimp = require(path.join('D:/project/FaceTry/sidenote/node_modules', 'jimp'));

const INPUT = process.argv[2];
const OUTPUT = process.argv[3];
const MARGIN_PCT = parseFloat(process.argv[4] || '2'); // margin as % of max dimension

Jimp.read(INPUT).then(img => {
  const { width: w, height: h } = img.bitmap;

  // 1) Key out green with soft alpha based on greenness
  img.scan(0, 0, w, h, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const maxrb = Math.max(r, b);
    const greenness = g - maxrb; // high => background
    let a = 255;
    if (g > 60 && greenness > 40) {
      // scale alpha down across a soft band to feather edges
      a = Math.max(0, Math.min(255, Math.round(((40 - greenness) / 60) * 255)));
    }
    this.bitmap.data[idx + 3] = a;
  });

  // 2) Bounding box of non-transparent pixels
  let minX = w, minY = h, maxX = -1, maxY = -1;
  img.scan(0, 0, w, h, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] > 16) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });
  if (maxX < 0) throw new Error('no content found');

  // 3) Small even margin
  const maxDim = Math.max(maxX - minX + 1, maxY - minY + 1);
  const m = Math.round(maxDim * MARGIN_PCT / 100);
  minX = Math.max(0, minX - m);
  minY = Math.max(0, minY - m);
  maxX = Math.min(w - 1, maxX + m);
  maxY = Math.min(h - 1, maxY + m);

  // 4) Square-ish crop centered on content
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const side = Math.max(cw, ch);
  let cx = minX + Math.floor(cw / 2) - Math.floor(side / 2);
  let cy = minY + Math.floor(ch / 2) - Math.floor(side / 2);
  cx = Math.max(0, Math.min(w - side, cx));
  cy = Math.max(0, Math.min(h - side, cy));

  img.crop(cx, cy, side, side);
  return img.writeAsync(OUTPUT);
}).then(() => console.log('OK', OUTPUT)).catch(e => { console.error(e); process.exit(1); });
