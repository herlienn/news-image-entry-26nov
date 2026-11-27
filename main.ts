// Node 22, standard library only. Draws one 1024x1024 PNG of the day's world news
// to /output/entry.png (or $MAKEFUN_OUTPUT_DIR). No network. Deterministic:
// two runs write the same bytes. Every glyph, scene and polygon below was drawn
// by hand for this entry: Thursday 26 November 2026, version 2.
// v2 is a visual rebuild of v1: same stories, same headlines, same numbers —
// only the drawing changed. v1's art lost head-to-head games because it was
// dark, sparse and decorative; v2 draws every scene bright, busy and
// recognisable at small size.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024, H = 1024;
const buf = new Uint8Array(W * H * 3);
// paper
for (let i = 0; i < W * H; i++) { buf[i * 3] = 246; buf[i * 3 + 1] = 240; buf[i * 3 + 2] = 222; }

// ---------- palette ----------
type RGB = [number, number, number];
const INK: RGB = [20, 24, 38];
const RED: RGB = [178, 34, 34];
const PAPER: RGB = [246, 240, 222];
const SEA: RGB = [172, 208, 232];
const LAND: RGB = [205, 162, 88];
const COAST: RGB = [148, 112, 58];
const GREY: RGB = [90, 92, 96];
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [198, 150, 40];

// ---------- pixel primitives ----------
function px(x: number, y: number, c: RGB): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const o = (yi * W + xi) * 3;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
    const o = (yy * W + xx) * 3;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
  }
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let k = 0; k < t; k++) for (let x = Math.round(x0); x <= Math.round(x1); x++) px(x, y + k, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let k = 0; k < t; k++) for (let y = Math.round(y0); y <= Math.round(y1); y++) px(x + k, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let ax = Math.round(x0), ay = Math.round(y0);
  const bx = Math.round(x1), by = Math.round(y1);
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(ax, ay, c);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ax += sx; }
    if (e2 <= dx) { err += dx; ay += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.round(r);
  for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
    if (dx * dx + dy * dy <= rr * rr) px(cx + dx, cy + dy, c);
  }
}
function ring(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.round(r);
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    px(cx + Math.round(Math.cos(t) * rr), cy + Math.round(Math.sin(t) * rr), c);
  }
}
// filled ellipse, radii rx, ry
function ell(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const rxi = Math.round(rx), ryi = Math.round(ry);
  for (let dy = -ryi; dy <= ryi; dy++) for (let dx = -rxi; dx <= rxi; dx++) {
    if (rxi === 0 || ryi === 0) continue;
    if ((dx * dx) / (rxi * rxi) + (dy * dy) / (ryi * ryi) <= 1) px(cx + dx, cy + dy, c);
  }
}
// scanline polygon fill, points [x,y] integers
function poly(pts: number[][], c: RGB): void {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  poly([[x0, y0], [x1, y1], [x2, y2]], c);
}
// stroke a closed polygon outline
function polyline(pts: number[][], c: RGB): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1], c);
  }
}

// ---------- PNG encoder ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font (hand-drawn) ----------
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '....#', '...#.', '..#..', '.#.#.', '#..##'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.##.', '#....', '.###.'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
};

// ---------- text ----------
function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = FONT[ch] || FONT['?'];
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if (g[r][col] === '#') rect(x + col * s, y + r * s, s, s, c);
  }
}
function textW(s: string, sc: number): number {
  return s.length * sc * 6 - sc;
}
function drawText(s: string, x: number, y: number, sc: number, c: RGB): void {
  let cx = Math.round(x);
  for (const ch of s) { drawChar(ch, cx, Math.round(y), sc, c); cx += sc * 6; }
}
function drawTextC(s: string, cx: number, y: number, sc: number, c: RGB): void {
  drawText(s, cx - Math.floor(textW(s, sc) / 2), y, sc, c);
}
// wrap into lines of at most maxW px (scale sc)
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textW(t, sc) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
// draw wrapped text, returns height used
function para(s: string, x: number, y: number, maxW: number, sc: number, c: RGB, lh?: number): number {
  const lines = wrap(s, maxW, sc);
  const step = lh ?? (7 * sc + 2);
  lines.forEach((ln, i) => drawText(ln, x, y + i * step, sc, c));
  return lines.length * step;
}
function num(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ---------- illustrated scenes ----------
// HERO 1 — Thanksgiving parade, New York. The turkey balloon is the whole
// point: a big fan-tailed turkey that reads as a TURKEY even at 300px.
function drawParade(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [150, 195, 230]); // bright daytime sky
  disc(x + w * 0.86, y + h * 0.16, 11, [255, 225, 140]); // sun
  // towers left and right, bright with lit windows
  rect(x + 4, y + h * 0.34, 30, h * 0.44, [82, 105, 150]);
  rect(x + 40, y + h * 0.48, 24, h * 0.30, [100, 125, 165]);
  rect(x + w - 36, y + h * 0.32, 32, h * 0.46, [82, 105, 150]);
  rect(x + w - 66, y + h * 0.50, 24, h * 0.28, [100, 125, 165]);
  for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 3; wx++) {
    rect(x + 9 + wx * 9, y + h * 0.38 + wy * 11, 4, 5, [255, 220, 120]);
    rect(x + w - 31 + wx * 9, y + h * 0.36 + wy * 11, 4, 5, [255, 220, 120]);
  }
  rect(x, y + h * 0.78, w, h * 0.22, [105, 105, 108]); // street
  hline(x, x + w, y + h * 0.88, WHITE, 2);
  // ---- turkey balloon, centre-left, dominant ----
  const cx = x + w * 0.40, cy = y + h * 0.52;
  // fan tail: five feathers fanning up behind the body
  const feathers: [number, number][] = [[-32, -20], [-17, -31], [0, -35], [17, -31], [32, -20]];
  for (const [fx, fy] of feathers) {
    disc(cx + fx, cy + fy, 10, [120, 70, 30]);
    disc(cx + fx * 1.35, cy + fy * 1.35, 4, [205, 125, 60]);
  }
  // body: big brown ellipse, lighter belly
  ell(cx, cy, 26, 30, [150, 95, 40]);
  ell(cx + 2, cy + 8, 17, 20, [205, 140, 70]);
  // wing on the near side
  ell(cx - 12, cy + 4, 9, 16, [110, 65, 25]);
  // head, top right of the body: beak + wattle + eye
  disc(cx + 18, cy - 26, 10, [150, 95, 40]);
  tri(cx + 26, cy - 30, cx + 26, cy - 22, cx + 36, cy - 26, [240, 180, 40]); // beak
  disc(cx + 27, cy - 18, 3, [200, 40, 40]); // wattle
  disc(cx + 20, cy - 29, 2, WHITE);
  disc(cx + 20, cy - 29, 1, [20, 20, 20]);
  // strings down to the street
  line(cx - 14, cy + 28, cx - 18, y + h * 0.78, [60, 40, 30]);
  line(cx + 14, cy + 28, cx + 18, y + h * 0.78, [60, 40, 30]);
  // round red balloon, smaller, at the right
  disc(x + w * 0.74, y + h * 0.38, 15, [196, 40, 44]);
  disc(x + w * 0.74 - 4, y + h * 0.38 - 4, 6, [230, 95, 95]);
  line(x + w * 0.74, y + h * 0.38 + 15, x + w * 0.74, y + h * 0.78, [60, 40, 30]);
  // parade crowd along the street + confetti in the sky
  const crowd: RGB[] = [[255, 255, 255], [255, 200, 60], [196, 40, 44], [40, 90, 160], [40, 120, 70]];
  for (let i = 0; i < 12; i++) disc(x + 10 + i * 27, y + h * 0.92, 3, crowd[i % 5]);
  disc(x + w * 0.10, y + h * 0.12, 2, [255, 80, 80]);
  disc(x + w * 0.24, y + h * 0.08, 2, [255, 200, 60]);
  disc(x + w * 0.58, y + h * 0.10, 2, WHITE);
  disc(x + w * 0.92, y + h * 0.55, 2, [255, 200, 60]);
  disc(x + w * 0.05, y + h * 0.55, 2, [40, 90, 160]);
}
// HERO 2 — container port in bright daylight, with a red 25% tariff tag
// on the biggest stack (the deck says India faces up to 25%).
function drawPort(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [165, 205, 235]); // bright sky
  disc(x + w * 0.10, y + h * 0.16, 10, [255, 225, 140]); // sun
  rect(x, y + h * 0.60, w, h * 0.40, [52, 110, 165]); // sea
  hline(x + w * 0.05, x + w * 0.95, y + h * 0.72, WHITE, 1);
  hline(x + w * 0.10, x + w * 0.90, y + h * 0.84, WHITE, 1);
  // gantry cranes
  line(x + w * 0.06, y + h * 0.60, x + w * 0.06, y + h * 0.08, [45, 48, 62]);
  line(x + w * 0.06, y + h * 0.08, x + w * 0.28, y + h * 0.08, [45, 48, 62]);
  line(x + w * 0.28, y + h * 0.08, x + w * 0.28, y + h * 0.26, [45, 48, 62]);
  line(x + w * 0.92, y + h * 0.60, x + w * 0.92, y + h * 0.14, [45, 48, 62]);
  line(x + w * 0.92, y + h * 0.14, x + w * 0.72, y + h * 0.14, [45, 48, 62]);
  // ship hull
  poly([[x + w * 0.14, y + h * 0.60], [x + w * 0.86, y + h * 0.60], [x + w * 0.80, y + h * 0.92], [x + w * 0.20, y + h * 0.92]], [28, 34, 50]);
  hline(x + w * 0.16, x + w * 0.84, y + h * 0.64, WHITE, 2);
  // container stacks: two rows, six bright colours
  const cols: RGB[] = [[196, 60, 50], [40, 120, 70], [220, 150, 40], [50, 90, 160], [230, 190, 60], [150, 70, 140]];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    rect(x + w * (0.19 + c * 0.105), y + h * (0.60 - (r + 1) * 0.15), w * 0.095, h * 0.13, cols[(r * 6 + c) % 6]);
  }
  // red 25% tariff tag on the top-row red stack (second from left)
  rect(x + w * 0.295, y + h * 0.315, w * 0.095, h * 0.115, WHITE);
  rect(x + w * 0.295, y + h * 0.315, w * 0.095, 1, RED);
  rect(x + w * 0.295, y + h * 0.315 + h * 0.115 - 1, w * 0.095, 1, RED);
  drawText('25%', x + w * 0.305, y + h * 0.335, 1, RED);
  // bridge tower, white with a red top
  rect(x + w * 0.845, y + h * 0.28, w * 0.05, h * 0.32, [225, 225, 220]);
  rect(x + w * 0.845, y + h * 0.28, w * 0.05, h * 0.06, [196, 60, 50]);
  rect(x + w * 0.845, y + h * 0.38, w * 0.05, h * 0.05, [40, 60, 90]);
  // bow wake
  line(x + w * 0.86, y + h * 0.92, x + w * 0.96, y + h * 0.86, WHITE);
  line(x + w * 0.86, y + h * 0.92, x + w * 0.96, y + h * 0.97, WHITE);
}
// HERO 3 — Cairo tanker fire, redrawn as the BRIGHTEST panel: warm amber
// daylight, a wall of layered flames, light smoke, fire trucks spraying
// water and a roadside crowd. No large dark areas anywhere.
function drawTankerFire(x: number, y: number, w: number, h: number): void {
  // warm amber sky in three bright bands
  rect(x, y, w, h * 0.30, [255, 205, 130]);
  rect(x, y + h * 0.30, w, h * 0.25, [255, 175, 95]);
  rect(x, y + h * 0.55, w, h * 0.07, [255, 145, 70]);
  disc(x + w * 0.88, y + h * 0.13, 10, [255, 240, 180]); // hazy sun
  // light tan skyline along the horizon
  rect(x + w * 0.02, y + h * 0.44, w * 0.07, h * 0.18, [215, 180, 125]);
  rect(x + w * 0.11, y + h * 0.50, w * 0.05, h * 0.12, [215, 180, 125]);
  rect(x + w * 0.90, y + h * 0.46, w * 0.08, h * 0.16, [215, 180, 125]);
  // sandy ground, then the ring road
  rect(x, y + h * 0.62, w, h * 0.16, [232, 205, 155]);
  rect(x, y + h * 0.78, w, h * 0.22, [70, 68, 72]);
  for (let i = 0; i < 8; i++) hline(x + i * w * 0.125 + 4, x + (i + 1) * w * 0.125 - 4, y + h * 0.88, [240, 200, 60], 2);
  // tanker: big silver cylinder + red cab, centre
  const tx = x + w * 0.30, tw = w * 0.38, ty = y + h * 0.58, th = h * 0.16;
  rect(tx, ty, tw, th, [225, 225, 220]);
  rect(tx, ty + th * 0.35, tw, th * 0.30, [200, 60, 50]); // red stripe
  disc(tx, ty + th / 2, th / 2, [205, 205, 200]); // tank end cap
  rect(tx + tw, ty, w * 0.08, th, [200, 60, 50]); // cab
  rect(tx + tw + w * 0.01, ty + th * 0.15, w * 0.05, th * 0.35, [180, 220, 235]); // cab window
  disc(tx + tw * 0.25, ty + th + 4, 5, [20, 20, 22]);
  disc(tx + tw * 0.60, ty + th + 4, 5, [20, 20, 22]);
  disc(tx + tw + w * 0.04, ty + th + 4, 5, [20, 20, 22]);
  // flame wall: five layered flames rising off the tank
  const flames: [number, number][] = [[0.33, 0.50], [0.42, 0.42], [0.51, 0.48], [0.60, 0.36], [0.66, 0.28]];
  for (const [fx, fh] of flames) {
    const bx = x + w * fx, bw = w * 0.075, base = ty;
    tri(bx - bw / 2, base, bx + bw / 2, base, bx, y + h * (0.58 - fh), [250, 110, 15]);
    tri(bx - bw / 3, base, bx + bw / 3, base, bx, y + h * (0.58 - fh * 0.72), [255, 190, 40]);
    tri(bx - bw / 5, base, bx + bw / 5, base, bx, y + h * (0.58 - fh * 0.45), [255, 235, 120]);
  }
  // light smoke puffs above the flames (pale, not black)
  disc(x + w * 0.40, y + h * 0.10, 12, [215, 210, 205]);
  disc(x + w * 0.50, y + h * 0.06, 13, [225, 220, 215]);
  disc(x + w * 0.60, y + h * 0.11, 11, [215, 210, 205]);
  // fire truck at the left, ladder up, water arc onto the fire
  rect(x + w * 0.02, y + h * 0.66, w * 0.13, h * 0.12, [200, 40, 40]);
  rect(x + w * 0.11, y + h * 0.66, w * 0.04, h * 0.12, [225, 225, 220]);
  line(x + w * 0.06, y + h * 0.66, x + w * 0.20, y + h * 0.42, [220, 220, 220]);
  const arc: [number, number][] = [[0.20, 0.42], [0.23, 0.36], [0.27, 0.33], [0.31, 0.34], [0.34, 0.38]];
  for (const [ax, ay] of arc) disc(x + w * ax, y + h * ay, 2, [170, 210, 240]);
  // white ambulance at the right with a red cross
  rect(x + w * 0.84, y + h * 0.64, w * 0.13, h * 0.14, WHITE);
  rect(x + w * 0.885, y + h * 0.66, w * 0.02, h * 0.08, RED);
  rect(x + w * 0.865, y + h * 0.685, w * 0.06, h * 0.02, RED);
  disc(x + w * 0.87, y + h * 0.79, 4, [20, 20, 22]);
  disc(x + w * 0.94, y + h * 0.79, 4, [20, 20, 22]);
  // roadside crowd + rising embers
  const crowd: RGB[] = [[255, 255, 255], [40, 90, 160], [255, 200, 60], [196, 40, 44], [40, 120, 70]];
  for (let i = 0; i < 7; i++) disc(x + w * (0.05 + i * 0.03), y + h * 0.72, 3, crowd[i % 5]);
  disc(x + w * 0.45, y + h * 0.30, 2, [255, 200, 60]);
  disc(x + w * 0.55, y + h * 0.24, 2, [250, 120, 20]);
  disc(x + w * 0.50, y + h * 0.18, 2, [255, 235, 120]);
}
// GRID 1 — refinery in daylight: pale sky, light towers, one big flame
function drawRefinery(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [175, 210, 235]);
  rect(x, y + h * 0.78, w, h * 0.22, [200, 200, 195]);
  rect(x + w * 0.08, y + h * 0.45, w * 0.10, h * 0.35, [150, 150, 155]);
  rect(x + w * 0.24, y + h * 0.28, w * 0.12, h * 0.52, [170, 170, 175]);
  rect(x + w * 0.42, y + h * 0.52, w * 0.10, h * 0.28, [140, 140, 145]);
  disc(x + w * 0.62, y + h * 0.55, 10, [185, 185, 190]);
  rect(x + w * 0.60, y + h * 0.65, w * 0.04, h * 0.15, [140, 140, 145]);
  tri(x + w * 0.26, y + h * 0.28, x + w * 0.34, y + h * 0.28, x + w * 0.30, y + h * 0.06, [250, 160, 30]);
  tri(x + w * 0.28, y + h * 0.28, x + w * 0.32, y + h * 0.28, x + w * 0.30, y + h * 0.16, [255, 220, 80]);
  disc(x + w * 0.30, y + h * 0.05, 3, [255, 220, 80]);
  disc(x + w * 0.78, y + h * 0.22, 6, [235, 235, 230]);
  disc(x + w * 0.86, y + h * 0.14, 7, [245, 245, 240]);
}
// GRID 2 — football: green pitch, white goal, ball
function drawFootball(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [36, 130, 60]);
  hline(x, x + w, y + h * 0.50, WHITE, 2);
  disc(x + w * 0.50, y + h * 0.50, 9, WHITE);
  ring(x + w * 0.50, y + h * 0.50, 9, WHITE);
  rect(x + w * 0.38, y + h * 0.06, w * 0.24, h * 0.20, WHITE);
  rect(x + w * 0.40, y + h * 0.08, w * 0.20, h * 0.18, [36, 130, 60]);
  disc(x + w * 0.68, y + h * 0.72, 6, WHITE);
  disc(x + w * 0.68, y + h * 0.72, 3, [20, 20, 20]);
  disc(x + w * 0.22, y + h * 0.80, 3, WHITE);
}
// GRID 3 — courthouse: pediment, columns, steps
function drawCourthouse(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [170, 200, 220]);
  tri(x + w * 0.10, y + h * 0.30, x + w * 0.90, y + h * 0.30, x + w * 0.50, y + h * 0.08, [210, 205, 190]);
  rect(x + w * 0.10, y + h * 0.30, w * 0.80, h * 0.06, [190, 185, 170]);
  for (let c = 0; c < 4; c++) rect(x + w * (0.16 + c * 0.20), y + h * 0.36, w * 0.07, h * 0.44, [235, 232, 220]);
  rect(x + w * 0.05, y + h * 0.80, w * 0.90, h * 0.07, [180, 175, 160]);
  rect(x + w * 0.02, y + h * 0.87, w * 0.96, h * 0.07, [160, 155, 140]);
  disc(x + w * 0.50, y + h * 0.20, 4, RED);
}
// GRID 4 — storm over tents, brightened: pale slate sky, white rain,
// cream tents with red doors
function drawStorm(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [175, 185, 200]);
  disc(x + w * 0.30, y + h * 0.25, 14, [125, 133, 150]);
  disc(x + w * 0.50, y + h * 0.18, 16, [115, 123, 140]);
  disc(x + w * 0.70, y + h * 0.25, 14, [125, 133, 150]);
  rect(x, y + h * 0.42, w, h * 0.58, [175, 165, 140]);
  for (let i = 0; i < 7; i++) line(x + w * (0.08 + i * 0.13), y + h * 0.42, x + w * (0.05 + i * 0.13), y + h * 0.62, [240, 242, 245]);
  tri(x + w * 0.12, y + h * 0.80, x + w * 0.30, y + h * 0.80, x + w * 0.21, y + h * 0.58, [245, 240, 225]);
  tri(x + w * 0.38, y + h * 0.82, x + w * 0.56, y + h * 0.82, x + w * 0.47, y + h * 0.60, [230, 224, 206]);
  tri(x + w * 0.64, y + h * 0.80, x + w * 0.82, y + h * 0.80, x + w * 0.73, y + h * 0.58, [245, 240, 225]);
  rect(x + w * 0.19, y + h * 0.76, w * 0.04, h * 0.05, [196, 40, 44]);
  rect(x + w * 0.71, y + h * 0.76, w * 0.04, h * 0.05, [196, 40, 44]);
}
// GRID 5 — microchip on a PALE board: dark chip, green traces, gold pins
function drawChip(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [185, 220, 225]);
  line(x + w * 0.06, y + h * 0.20, x + w * 0.30, y + h * 0.20, [40, 160, 110]);
  line(x + w * 0.06, y + h * 0.80, x + w * 0.30, y + h * 0.80, [40, 160, 110]);
  line(x + w * 0.70, y + h * 0.20, x + w * 0.94, y + h * 0.20, [40, 160, 110]);
  line(x + w * 0.70, y + h * 0.80, x + w * 0.94, y + h * 0.80, [40, 160, 110]);
  rect(x + w * 0.32, y + h * 0.22, w * 0.36, h * 0.56, [25, 40, 70]);
  for (let i = 0; i < 4; i++) {
    rect(x + w * (0.32 + i * 0.09), y + h * 0.12, w * 0.03, h * 0.10, [200, 170, 60]);
    rect(x + w * (0.32 + i * 0.09), y + h * 0.78, w * 0.03, h * 0.10, [200, 170, 60]);
  }
  rect(x + w * 0.40, y + h * 0.38, w * 0.20, h * 0.24, [40, 140, 110]);
  drawText('5G', x + w * 0.42, y + h * 0.42, 1, WHITE);
  disc(x + w * 0.12, y + h * 0.50, 3, [250, 200, 60]);
  disc(x + w * 0.88, y + h * 0.50, 3, [250, 200, 60]);
}
// GRID 6 — rocket in bright daylight: blue sky, white rocket, orange flame
function drawRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [150, 195, 235]);
  disc(x + w * 0.80, y + h * 0.20, 8, [255, 225, 140]);
  rect(x, y + h * 0.88, w, h * 0.12, [90, 140, 80]);
  rect(x + w * 0.44, y + h * 0.22, w * 0.12, h * 0.55, [235, 235, 230]);
  tri(x + w * 0.44, y + h * 0.22, x + w * 0.56, y + h * 0.22, x + w * 0.50, y + h * 0.06, [196, 40, 44]);
  rect(x + w * 0.47, y + h * 0.40, w * 0.06, h * 0.12, [40, 90, 160]);
  disc(x + w * 0.50, y + h * 0.46, 3, WHITE);
  tri(x + w * 0.44, y + h * 0.77, x + w * 0.38, y + h * 0.88, x + w * 0.44, y + h * 0.88, [196, 40, 44]);
  tri(x + w * 0.56, y + h * 0.77, x + w * 0.62, y + h * 0.88, x + w * 0.56, y + h * 0.88, [196, 40, 44]);
  tri(x + w * 0.47, y + h * 0.88, x + w * 0.53, y + h * 0.88, x + w * 0.50, y + h * 0.98, [250, 170, 40]);
  line(x + w * 0.16, y + h * 0.88, x + w * 0.16, y + h * 0.40, [220, 220, 220]);
  rect(x + w * 0.16, y + h * 0.40, w * 0.14, h * 0.12, [196, 40, 44]);
  disc(x + w * 0.21, y + h * 0.46, 3, WHITE);
}
// GRID 7 — lab flasks
function drawLab(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [210, 225, 230]);
  rect(x, y + h * 0.78, w, h * 0.22, [120, 110, 100]);
  rect(x + w * 0.14, y + h * 0.20, w * 0.06, h * 0.25, [60, 60, 70]);
  tri(x + w * 0.08, y + h * 0.78, x + w * 0.26, y + h * 0.78, x + w * 0.17, y + h * 0.45, [200, 220, 230]);
  tri(x + w * 0.11, y + h * 0.78, x + w * 0.23, y + h * 0.78, x + w * 0.17, y + h * 0.55, [60, 180, 90]);
  rect(x + w * 0.46, y + h * 0.14, w * 0.06, h * 0.30, [60, 60, 70]);
  tri(x + w * 0.40, y + h * 0.78, x + w * 0.58, y + h * 0.78, x + w * 0.49, y + h * 0.44, [200, 220, 230]);
  tri(x + w * 0.43, y + h * 0.78, x + w * 0.55, y + h * 0.78, x + w * 0.49, y + h * 0.52, [220, 120, 60]);
  rect(x + w * 0.72, y + h * 0.18, w * 0.08, h * 0.60, [200, 220, 230]);
  rect(x + w * 0.72, y + h * 0.50, w * 0.08, h * 0.28, [70, 130, 200]);
  disc(x + w * 0.86, y + h * 0.30, 3, [60, 180, 90]);
  disc(x + w * 0.88, y + h * 0.42, 2, [220, 120, 60]);
}
// GRID 8 — field hospital tent with a red cross
function drawHospital(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [150, 190, 170]);
  disc(x + w * 0.82, y + h * 0.20, 8, [255, 225, 140]);
  rect(x, y + h * 0.70, w, h * 0.30, [140, 125, 90]);
  tri(x + w * 0.10, y + h * 0.72, x + w * 0.62, y + h * 0.72, x + w * 0.36, y + h * 0.30, [240, 240, 235]);
  rect(x + w * 0.30, y + h * 0.70, w * 0.12, h * 0.10, [120, 60, 40]);
  rect(x + w * 0.33, y + h * 0.42, w * 0.06, h * 0.22, [196, 40, 44]);
  rect(x + w * 0.27, y + h * 0.48, w * 0.18, h * 0.06, [196, 40, 44]);
  line(x + w * 0.68, y + h * 0.88, x + w * 0.68, y + h * 0.40, [200, 200, 200]);
  rect(x + w * 0.68, y + h * 0.40, w * 0.16, h * 0.14, [240, 240, 235]);
  disc(x + w * 0.74, y + h * 0.47, 3, [196, 40, 44]);
}
// GRID 9 — supermarket storefront with awning
function drawStore(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [150, 185, 220]);
  rect(x + w * 0.06, y + h * 0.30, w * 0.88, h * 0.55, [235, 230, 215]);
  rect(x + w * 0.06, y + h * 0.30, w * 0.88, h * 0.14, [196, 60, 50]);
  for (let i = 0; i < 6; i++) rect(x + w * (0.06 + i * 0.147), y + h * 0.44, w * 0.073, h * 0.10, i % 2 ? WHITE : [196, 60, 50]);
  rect(x + w * 0.14, y + h * 0.58, w * 0.20, h * 0.27, [120, 180, 220]);
  rect(x + w * 0.66, y + h * 0.58, w * 0.20, h * 0.27, [120, 180, 220]);
  rect(x + w * 0.42, y + h * 0.58, w * 0.16, h * 0.27, [90, 70, 50]);
  drawText('MART', x + w * 0.40, y + h * 0.34, 1, WHITE);
  disc(x + w * 0.10, y + h * 0.92, 2, [40, 40, 40]);
  disc(x + w * 0.90, y + h * 0.92, 2, [40, 40, 40]);
}
// GRID 10 — parliament with dome and flag (Canberra)
function drawParliament(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [170, 200, 225]);
  disc(x + w * 0.80, y + h * 0.20, 7, [255, 225, 140]);
  rect(x + w * 0.08, y + h * 0.55, w * 0.84, h * 0.30, [215, 208, 190]);
  poly([[x + w * 0.38, y + h * 0.55], [x + w * 0.62, y + h * 0.55], [x + w * 0.50, y + h * 0.30]], [190, 184, 168]);
  disc(x + w * 0.50, y + h * 0.42, 7, [150, 170, 200]);
  for (let c = 0; c < 5; c++) rect(x + w * (0.14 + c * 0.15), y + h * 0.58, w * 0.05, h * 0.24, [240, 236, 222]);
  line(x + w * 0.50, y + h * 0.30, x + w * 0.50, y + h * 0.12, [60, 60, 60]);
  rect(x + w * 0.50, y + h * 0.12, w * 0.14, h * 0.09, [30, 60, 140]);
  disc(x + w * 0.55, y + h * 0.165, 2, WHITE);
  rect(x, y + h * 0.85, w, h * 0.15, [90, 130, 70]);
}

// ---------- world map ----------
// Same projection, polygons and pin positions as v1 (verified: all pins on
// land/coast, Gaza pin SW with a leader line, Pyongyang on the coastline).
// v2 only raises the contrast: stronger land colour + a coastline stroke,
// so the continents actually read as a world map at small size.
const MAP_Y0 = 586, MAP_Y1 = 686;
function proj(lon: number, lat: number): [number, number] {
  return [8 + (lon + 170) * 1008 / 360, MAP_Y0 + (75 - lat) * 100 / 130];
}
const CONTINENTS: number[][][] = [
  // North America
  [[-168, 66], [-155, 71], [-140, 70], [-125, 71], [-110, 71], [-95, 69], [-85, 66], [-78, 62], [-70, 60], [-62, 58], [-56, 50], [-60, 47], [-65, 44], [-70, 40], [-74, 35], [-76, 32], [-80, 26], [-81, 30], [-84, 30], [-88, 30], [-91, 29], [-94, 29], [-97, 26], [-97, 22], [-94, 19], [-92, 15], [-89, 14], [-86, 12], [-83, 10], [-80, 8], [-79, 8], [-82, 9], [-85, 11], [-88, 13], [-91, 14], [-94, 16], [-97, 16], [-101, 18], [-105, 20], [-110, 24], [-114, 28], [-117, 33], [-121, 37], [-124, 41], [-124, 47], [-127, 49], [-131, 54], [-135, 58], [-141, 60], [-147, 61], [-153, 58], [-160, 59], [-165, 60], [-168, 66]],
  // Greenland
  [[-58, 64], [-52, 60], [-44, 60], [-40, 64], [-32, 68], [-22, 70], [-20, 74], [-30, 76], [-45, 78], [-55, 76], [-60, 72], [-58, 68], [-58, 64]],
  // South America
  [[-80, 9], [-77, 11], [-72, 12], [-64, 11], [-58, 8], [-52, 5], [-50, 0], [-44, -3], [-35, -8], [-39, -15], [-41, -23], [-48, -28], [-55, -35], [-62, -39], [-66, -45], [-69, -52], [-71, -54], [-74, -44], [-73, -32], [-71, -20], [-77, -12], [-81, -5], [-81, 1], [-80, 9]],
  // Eurasia
  [[-10, 36], [-9, 43], [-4, 48], [-2, 50], [2, 51], [5, 53], [8, 57], [10, 59], [6, 60], [12, 56], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [27, 66], [30, 70], [35, 69], [42, 68], [48, 68], [55, 68], [62, 69], [68, 72], [75, 72], [85, 74], [95, 76], [105, 77], [115, 74], [125, 73], [135, 72], [145, 72], [155, 70], [162, 68], [170, 67], [178, 65], [170, 61], [162, 60], [158, 53], [150, 59], [142, 55], [140, 50], [135, 43], [130, 42], [128, 40], [126.5, 38.5], [127, 36], [124, 34.5], [122, 37], [120, 34], [115, 30], [110, 28], [108, 22], [105, 18], [103, 12], [100, 8], [98, 6], [97, 10], [95, 15], [92, 20], [88, 22], [86, 20], [82, 16], [80, 13], [78, 8], [75, 12], [72, 20], [68, 23], [65, 25], [62, 25], [58, 25], [56, 27], [52, 28], [50, 29], [48, 30], [44, 29], [42, 25], [40, 20], [38, 18], [36, 22], [34, 28], [32, 31], [30, 32], [25, 32], [20, 32], [15, 34], [10, 37], [5, 37], [0, 36], [-5, 36], [-10, 36]],
  // Africa
  [[-6, 35], [-10, 31], [-15, 27], [-17, 21], [-17, 15], [-15, 11], [-12, 8], [-8, 5], [-4, 5], [0, 6], [5, 6], [9, 4], [9, -1], [12, -5], [13, -10], [12, -15], [14, -20], [15, -25], [18, -30], [20, -35], [25, -34], [28, -33], [32, -29], [35, -24], [36, -20], [38, -15], [40, -10], [41, -5], [42, 0], [44, 4], [46, 8], [48, 11], [51, 12], [48, 14], [44, 15], [40, 15], [38, 18], [36, 22], [34, 27], [32, 31], [30, 32], [25, 32], [20, 32], [15, 34], [10, 37], [5, 37], [0, 36], [-6, 35]],
  // Australia
  [[114, -22], [114, -30], [115, -35], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [147, -39], [150, -37], [153, -32], [153, -27], [150, -23], [146, -19], [142, -15], [142, -11], [136, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20], [114, -22]],
];
function drawMap(): void {
  rect(8, MAP_Y0, 1008, MAP_Y1 - MAP_Y0, SEA);
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lo, la]) => { const [x, y] = proj(lo, la); return [Math.round(x), Math.round(y)]; });
    poly(pts, LAND);
    polyline(pts, COAST);
  }
  // New Zealand dots
  const [zx1, zy1] = proj(167, -45), [zx2, zy2] = proj(174, -41);
  disc(zx1, zy1, 3, LAND); disc(zx2, zy2, 3, LAND);
  rect(8, MAP_Y0, 1008, 1, INK); rect(8, MAP_Y1 - 1, 1008, 1, INK);
  rect(8, MAP_Y0, 1, MAP_Y1 - MAP_Y0, INK); rect(1015, MAP_Y0, 1, MAP_Y1 - MAP_Y0, INK);
}
// pins: [x, y, number] in pixels; Gaza pin sits SW of its true spot, leader line to the coast
const PINS: [number, number, number][] = [
  [277, 612, 1], [252, 616, 2], [571, 621, 3], [624, 603, 4], [491, 606, 5],
  [583, 619, 6], [564, 634, 7], [836, 614, 8], [505, 639, 9], [567, 643, 10],
  [273, 636, 11], [901, 665, 12],
];
function drawPins(): void {
  line(564, 634, 580, 620, RED); // leader: Gaza pin to the Gaza coast
  for (const [x, y, n] of PINS) {
    disc(x, y, 8, WHITE);
    ring(x, y, 8, RED); ring(x, y, 7, RED);
    drawTextC(String(n), x, y - 3, 1, RED);
  }
}

// ---------- layout ----------
function outline(x: number, y: number, w: number, h: number, c: RGB = INK): void {
  rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c);
  rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c);
}

// All headlines, decks, numbers, times and pins below are v1's facts,
// unchanged: the news does not change, only the drawing does.
const HEROES = [
  { tag: 'AMERICAS', title: 'THANKSGIVING AT 100', deck: "MACY'S 100TH PARADE MARCHES IN NEW YORK, THEN THREE NFL GAMES: BEARS-LIONS, EAGLES-COWBOYS, CHIEFS-BILLS.", art: drawParade },
  { tag: 'WORLD', title: 'TARIFF BLITZ', deck: 'TRUMP PROPOSES TARIFFS ON 14 PARTNERS, FROM CHINA TO THE EU; INDIA FACES UP TO 25%.', art: drawPort },
  { tag: 'MIDDLE EAST', title: 'CAIRO TANKER FIRE', deck: '31 KILLED AS A FUEL TANKER OVERTURNS AND BURNS ON A CAIRO RING ROAD; 21 HURT, HEALTH MINISTRY SAYS.', art: drawTankerFire },
];
const GRID: { tag: string; title: string; deck: string; art: (x: number, y: number, w: number, h: number) => void }[] = [
  { tag: 'EUROPE', title: 'UKRAINE HITS REFINERIES', deck: 'KYIV SAYS IT HIT AN AIRFIELD AND TWO REFINERIES IN SAMARA; POLAND PLANS A NO-FLY ZONE AT THE BORDER.', art: drawRefinery },
  { tag: 'EUROPE', title: 'PSG HELD 2-2', deck: "ROMA END THE HOLDERS' PERFECT CHAMPIONS LEAGUE RUN; LIVERPOOL WIN 3-0 AT BRUGGE, BARCA 4-1.", art: drawFootball },
  { tag: 'MIDDLE EAST', title: 'NETANYAHU CASE FADES', deck: 'ISRAELI JUDGES URGE PROSECUTORS TO DROP THE CASE 4000 BRIBERY CASE AGAINST THE PRIME MINISTER.', art: drawCourthouse },
  { tag: 'MIDDLE EAST', title: 'GAZA STORM THREAT', deck: 'A STORM THREATENS 1.76 MILLION PEOPLE IN MAKESHIFT SHELTERS; STRIKE KILLS SEVERAL IN GAZA CITY.', art: drawStorm },
  { tag: 'ASIA', title: 'HUAWEI GUILTY', deck: 'U.S. JURY CONVICTS HUAWEI ON 10 OF 12 COUNTS, INCLUDING BANK FRAUD AND IRAN SANCTIONS-BUSTING.', art: drawChip },
  { tag: 'ASIA', title: 'N KOREA EXPELS ENVOY', deck: "PYONGYANG ORDERS SWITZERLAND'S TOP DIPLOMAT OUT IN 48 HOURS; KIM SEEKS MORE TACTICAL NUCLEAR ARMS.", art: drawRocket },
  { tag: 'AFRICA', title: 'NIGERIA METH BUST', deck: 'ANTI-DRUG AGENTS SEIZE A $227M METH LAB IN ENUGU AND ARREST FIVE MEXICANS AND A BUSINESSMAN.', art: drawLab },
  { tag: 'AFRICA', title: 'EBOLA RISK VERY HIGH', deck: 'WHO WARNS THE DRC OUTBREAK STILL RAGES: 11,793 CASES, 5,779 DEAD; FIGHTING TRAPS HEALTH WORKERS.', art: drawHospital },
  { tag: 'AMERICAS', title: '76 FREED IN CARTAGENA', deck: 'COLOMBIAN FORCES END A 17-HOUR SUPERMARKET SIEGE AND FREE ALL 76 HOSTAGES AFTER A BOTCHED ROBBERY.', art: drawStore },
  { tag: 'OCEANIA', title: "AUSTRALIA'S TECH LAW", deck: 'PARLIAMENT PASSES A DIGITAL DUTY OF CARE ACT, PUTTING BIG TECH UNDER A LEGAL DUTY TO KEEP USERS SAFE.', art: drawParliament },
];
const ALSO: string[] = [
  '1. OPEC BLAMES EU FOR COP31 COLLAPSE (REUTERS)',
  '2. POPE LEO LAMENTS COP31 FAILURE (REUTERS)',
  '3. INDIA ANSWERS US TARIFF PLAN (AP)',
  '4. 1,700 INDIANS DEPORTED FROM US IN 2026 (AP)',
  '5. KENYA-SUDAN ROW OVER RSF CLAIMS (THE BRIEF)',
  '6. RSF DRONES KILL 19 IN BLUE NILE (AL JAZEERA)',
  '7. S AFRICA COURT SETS ASIDE PHALA PHALA (AP)',
  '8. MSF HALTS WORK IN S SOUTH SUDAN (PANA)',
  '9. RUTO SEALS GERMAN DEAL, 200,000 JOBS (EIN)',
  '10. CAS RESTORES SENEGAL AFCON WIN (PANA)',
  '11. LIBYA CONDEMNS BENGHAZI ATTACKS (PANA)',
  '12. TWO TANKERS HIT MINES IN HORMUZ (AP)',
  '13. IRAN TO EXECUTE TWO PROTESTERS (AP)',
  '14. KNESSET PANEL BACKS OCT 7 INQUIRY (AP)',
  '15. EISENKOT BLOC AIMS TO FORM GOVERNMENT (AP)',
  '16. NATO CHIEF: READY EUROPE FOR WAR (AP)',
  '17. EU PROPOSES 22ND RUSSIA SANCTIONS (AP)',
  '18. ESTONIA SEALS BORDER WITH RUSSIA (AP)',
  '19. UK OPENS NUCLEAR-VETERANS INQUIRY (AP)',
  '20. PUIGDEMONT TO RETURN TO SPAIN 12 DEC (AP)',
  '21. MISS UNIVERSE: FIRST MARRIED WINNER (AP)',
  '22. ABREGO GARCIA LEAVES US FOR SPAIN (BBC)',
  '23. US ARMY DETONATES 4,500 KG EXPLOSIVES (AP)',
  '24. SIX DEAD IN PLANE CRASH OFF MISSISSIPPI (AP)',
  '25. FCC CLEARS SPACEX 1M SATELLITES (AP)',
  '26. MARSHALL ISLANDS: NO REGRETS (REUTERS)',
  '27. RNZ STAFF STRIKE AGAIN OVER CUTS (RNZ)',
  '28. HEAVY RAIN SOAKS DUNEDIN, N OTAGO (METSERVICE)',
  '29. 2ND TEST STARTS TODAY IN CHRISTCHURCH (CRICINFO)',
  '30. BUSHFIRE BURNS ON FLINDERS ISLAND (AP)',
];

function main(): void {
  // masthead
  hline(8, 1016, 6, INK, 3);
  drawTextC('THE WORLD IN ONE DAY', 512, 12, 6, INK);
  drawTextC('THURSDAY, 26 NOVEMBER 2026', 512, 58, 3, RED);
  drawTextC('43 STORIES - 7 REGIONS - ONE DAY', 512, 82, 2, INK);
  // region bar: EUR 7, ME 7, ASI 4, AFR 9, AME 7, OCE 6, WLD 3
  const segs: [string, number, RGB][] = [
    ['EUR 7', 7, [26, 58, 110]], ['ME 7', 7, [198, 150, 40]], ['ASI 4', 4, [178, 34, 34]],
    ['AFR 9', 9, [34, 110, 60]], ['AME 7', 7, [90, 60, 140]], ['OCE 6', 6, [20, 120, 130]], ['WLD 3', 3, [110, 110, 110]],
  ];
  let bx = 8;
  for (const [label, count, col] of segs) {
    const w = Math.round(count / 43 * 1008);
    rect(bx, 100, w, 14, col);
    drawTextC(label, bx + w / 2, 103, 1, WHITE);
    bx += w;
  }
  // Day in Numbers
  drawText('DAY IN NUMBERS', 8, 120, 1, RED);
  const nums: [string, string][] = [
    ['31', 'KILLED IN CAIRO FIRE'],
    ['14', 'PARTNERS IN TARIFF PLAN'],
    ['100', "MACY'S PARADE, 100TH"],
    ['2-2', 'PSG HELD BY ROMA'],
    ['$227M', 'NIGERIA METH LAB'],
    ['11,793', 'EBOLA CASES IN DRC'],
  ];
  nums.forEach(([n, label], i) => {
    const x = 8 + i * 168;
    outline(x, 132, 163, 36);
    drawTextC(n, x + 81, 135, 2, INK);
    drawTextC(label, x + 81, 153, 1, GREY);
  });
  // heroes
  HEROES.forEach((h, i) => {
    const x = 8 + i * 342;
    h.art(x, 174, 324, 110);
    outline(x, 174, 324, 110);
    drawText(h.tag, x, 288, 1, RED);
    drawText(h.title, x, 300, 2, INK);
    para(h.deck, x, 318, 324, 1, INK);
  });
  hline(8, 1016, 356, INK, 2);
  // grid: 2 columns x 5 rows
  GRID.forEach((g, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 8 + col * 511, y = 362 + row * 43;
    g.art(x, y, 110, 40);
    outline(x, y, 110, 40);
    drawText(g.tag, x + 118, y + 1, 1, RED);
    drawText(g.title, x + 118, y + 12, 2, INK);
    para(g.deck, x + 118, y + 27, 380, 1, INK);
  });
  // map
  drawText('THE WORLD - 12 STORIES PINNED', 8, 580, 1, RED);
  drawMap();
  drawPins();
  drawText('1 NEW YORK  2 WASHINGTON  3 CAIRO  4 SAMARA  5 PARIS  6 JERUSALEM  7 GAZA  8 PYONGYANG  9 ENUGU  10 ITURI  11 CARTAGENA  12 CANBERRA', 8, 690, 1, INK);
  // By the Clock
  drawText('BY THE CLOCK - UTC', 8, 706, 1, RED);
  drawText("13:30 MACY'S 100TH PARADE STEPS OFF, NEW YORK   18:00 BEARS AT LIONS KICK OFF, DETROIT   21:30 EAGLES AT COWBOYS, DALLAS   LATE: PSG HELD 2-2 BY ROMA, PARIS", 8, 720, 1, INK);
  // Also-on
  drawText('ALSO ON THURSDAY 26 NOVEMBER', 8, 738, 1, RED);
  ALSO.forEach((item, i) => {
    const col = Math.floor(i / 10), row = i % 10;
    drawText(item, 8 + col * 340, 752 + row * 20, 1, INK);
  });
  // footer
  hline(8, 1016, 954, INK, 2);
  drawText('SOURCES: REUTERS, AP, AFP, BBC, AL JAZEERA, UEFA, WHO, ESPN, BLOOMBERG, NYT.', 8, 960, 1, GREY);
  drawText('DATE CHECK: STORIES FIRST REPORTED 25 NOV BUT HEADLINING 26 NOV PAPERS COUNT.', 8, 972, 1, GREY);
  drawText('CLOCK: 13:30 + 18:00 + 21:30 AS REPORTED; REST IN ORDER. EVERY STORY HAPPENED, OR WAS FIRST REPORTED, ON 26 NOV 2026 (UTC).', 8, 984, 1, GREY);
  hline(8, 1016, 1016, INK, 3);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log('wrote ' + join(outDir, 'entry.png') + ' ' + png.length + ' bytes');
}

main();
