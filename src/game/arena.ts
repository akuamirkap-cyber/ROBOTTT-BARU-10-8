import * as THREE from 'three';
import { buildShow, type Show } from './arenaShow';
import { buildCrowd, type Spot } from './crowd';
import { buildProps } from './arenaProps';
import { buildSheen } from './mirror';
import { buildSpotRig } from './spotlights';
import { markReflect, REFLECT_LIGHTS_LAYER } from './layers';
import { AtmosphereEffects } from './AtmosphereEffects';
import {
  ROWS_PER_TIER,
  STAND_ROW_SPACING,
  STAND_TIERS,
  standRowHeight,
  standRowInnerRadius,
  standTierInnerRadius,
} from './stadiumLayout';

export type PyroPlacement = 'ring_posts' | 'steel_platform';
export const LS_PYRO = 'steel-titans-pyro-placement';

export function loadPyroPlacement(): PyroPlacement {
  try {
    const p = localStorage.getItem(LS_PYRO);
    if (p === 'ring_posts' || p === 'steel_platform') return p;
  } catch {
    /* ignore */
  }
  return 'steel_platform';
}

export function savePyroPlacement(p: PyroPlacement) {
  try {
    localStorage.setItem(LS_PYRO, p);
  } catch {
    /* ignore */
  }
}

export interface Arena {
  update(t: number, dt: number, hype: number, focus?: THREE.Vector3, camera?: THREE.Camera): void;
  /** the pyro nozzles on top of the four corner towers */
  towers: THREE.Vector3[];
  /** the 4 active pyrotechnic flame nozzles (either on corner posts or steel platform corners) */
  cornerNozzles: THREE.Vector3[];
  /** fires flame jet from the 4 active nozzles ('puff' for 1,2,3 counts, 'blast' for FIGHT! / KO) */
  fireCornerPyro(level: number, duration?: number, mode?: 'puff' | 'blast'): void;
  /** sets the placement of the pyro nozzles: 'ring_posts' (tiang ring) or 'steel_platform' (ujung platform baja) */
  setPyroPlacement(placement: PyroPlacement): void;
  /** gets the current placement of the pyro nozzles */
  getPyroPlacement(): PyroPlacement;
  dispose?(): void;
  /** compresses and jolts the specialized corner turnbuckle protector pad when a fighter collides with it */
  triggerCornerPad(cornerIdx: number, strength: number): void;
  setScreen(left: string, right: string, sub: string, lc: string, rc: string): void;
  /** the giant face boards: live portraits of both fighters */
  setFaces: Show['setFaces'];
  ropeHit(x: number, z: number, strength: number): void;
  /** called every frame a fighter leans on the ropes: depth = how far the rope is pushed out */
  ropePress(x: number, z: number, depth: number): void;
  /**
   * RING ENTRY: the ropes are held open at (x, z) — the top rope lifted, the two lower ropes pressed down to the
   * canvas — by `amount` (0..1). Call it every frame while they are held; they close on their own (with a wobble)
   * once the calls stop.
   */
  ropeSpread(x: number, z: number, amount: number): void;
  /** a heavy body slams onto the canvas at (x, z): the whole ring dips and springs back, every rope jolts */
  canvasSlam(x: number, z: number, strength: number): void;
  /** TEAM MATCH: the whole ring (canvas, apron, posts, ropes) grows by this factor; 1 = the standard 1v1 ring */
  setRingScale(s: number): void;
  /**
   * the glossy floors (real planar reflections of the Titans and the lights). The canvas sheen and the hall floor
   * are switched separately — the quality ladder drops the hall first, then the canvas.
   */
  setMirrors(canvasOn: boolean, hallOn?: boolean): void;
  keyLight: THREE.DirectionalLight;
  rimRed: THREE.SpotLight;
  rimBlue: THREE.SpotLight;
  /** the hero followspots lock onto these two (the fighters' feet, world space); null = lamp parked */
  track(a: THREE.Vector3 | null, b: THREE.Vector3 | null): void;
  /** IMPACT LIGHTING: the whole rig kicks for a beat on a heavy blow (0..1) */
  strobe(k: number): void;
}

const FONT = '800 {S}px "Barlow Condensed", Impact, "Arial Black", sans-serif';
const font = (s: number) => FONT.replace('{S}', String(s));

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}
function toTex(c: HTMLCanvasElement, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
}
/** the WRC (World Robot Championship) emblem: a hexagon with the three letters */
function wrcEmblem(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  hexPath(g, cx, cy, r);
  const grd = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grd.addColorStop(0, '#16213f');
  grd.addColorStop(1, '#0a0e1c');
  g.fillStyle = grd;
  g.fill();
  g.lineWidth = r * 0.06;
  g.strokeStyle = '#d8dee8';
  g.stroke();
  hexPath(g, cx, cy, r * 0.84);
  g.lineWidth = r * 0.025;
  g.strokeStyle = 'rgba(201,162,74,0.8)';
  g.stroke();
  g.fillStyle = '#e8ecf2';
  g.font = font(Math.round(r * 0.78));
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('WRC', cx, cy + r * 0.02);
  g.fillStyle = 'rgba(201,162,74,0.9)';
  g.fillRect(cx - r * 0.5, cy + r * 0.46, r * 1.0, r * 0.05);
}
function arcText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, a0: number) {
  let a = a0;
  g.textAlign = 'center';
  for (const ch of text) {
    const w = g.measureText(ch).width;
    g.save();
    g.translate(cx, cy);
    g.rotate(a + w / 2 / r);
    g.translate(0, -r);
    g.fillText(ch, 0, 0);
    g.restore();
    a += w / r;
  }
}

function ringTexture() {
  const S = 1024;
  const { c, g } = canvas(S, S);
  // Tekstur kanvas ring WRC: Dark slate / deep charcoal bertekstur, warna seimbang (tidak terlalu gelap, tidak memutih)
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#151922');
  grad.addColorStop(1, '#0e121a');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // the weave of the canvas
  g.fillStyle = 'rgba(255,255,255,0.028)';
  for (let y = 0; y < S; y += 3) g.fillRect(0, y, S, 1);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let x = 0; x < S; x += 3) g.fillRect(x, 0, 1, S);
  // scuffs and combat marks
  for (let i = 0; i < 1100; i++) {
    g.strokeStyle = `rgba(255,255,255,${Math.random() * 0.022})`;
    g.lineWidth = Math.random() * 1.2;
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 140, y + (Math.random() - 0.5) * 140);
    g.stroke();
  }
  for (let i = 0; i < 35; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 30 + Math.random() * 90;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(0,0,0,0.20)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the boundary line and the centre mark - high contrast, vibrant & sharp
  g.strokeStyle = 'rgba(230,238,255,0.85)';
  g.lineWidth = 6;
  g.strokeRect(64, 64, S - 128, S - 128);
  g.beginPath();
  g.arc(S / 2, S / 2, 332, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(215,172,70,0.85)';
  g.lineWidth = 4.5;
  g.stroke();
  // centre: the emblem and graphics, jelas & tajam dengan kontras tinggi
  g.globalAlpha = 0.95;
  wrcEmblem(g, S / 2, S / 2 - 30, 180);
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(235,240,252,0.92)';
  g.font = font(44);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('WORLD ROBOT CHAMPIONSHIP', S / 2, S / 2 + 200);
  g.fillStyle = 'rgba(215,172,70,0.95)';
  g.fillRect(S / 2 - 150, S / 2 + 236, 300, 3.5);
  return toTex(c);
}

/** one long LED / apron strip: [emblem] WORLD ROBOT CHAMPIONSHIP · STEEL TITANS … repeated */
function stripTexture(dark: boolean) {
  const W = 2048;
  const Hh = 128;
  const { c, g } = canvas(W, Hh);
  g.fillStyle = dark ? '#0b0d13' : '#07080d';
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < Hh; y += 3) g.fillRect(0, y, W, 1);
  g.fillStyle = 'rgba(201,162,74,0.55)';
  g.fillRect(0, 6, W, 2);
  g.fillRect(0, Hh - 8, W, 2);
  const seg = W / 2;
  for (let s = 0; s < 2; s++) {
    const x0 = s * seg;
    g.globalAlpha = 0.85;
    wrcEmblem(g, x0 + 90, Hh / 2, 44);
    g.globalAlpha = 1;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = font(54);
    g.fillStyle = 'rgba(232,236,242,0.9)';
    g.fillText('WORLD ROBOT CHAMPIONSHIP', x0 + 165, Hh / 2 + 2);
    g.fillStyle = 'rgba(170,180,200,0.8)';
    g.fillText('STEEL TITANS', x0 + 165 + 660, Hh / 2 + 2);
    g.fillStyle = 'rgba(201,162,74,0.8)';
    g.fillRect(x0 + 165 + 620, Hh / 2 - 22, 3, 44);
  }
  const t = toTex(c, 4);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * PELAT DIAMOND PLATE ANTI-SLIP (Platform Dek Baja 13.5m)
 * Raised 3D embossed diamond lugs with brushed industrial metallic steel sheen.
 */
function diamondPlateTexture() {
  const S = 512;
  const { c, g } = canvas(S, S);
  // Brushed steel background
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#121620');
  grad.addColorStop(0.5, '#1a1f2c');
  grad.addColorStop(1, '#11141d');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  // Micro-grit brushed metal lines
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < S; y += 2) g.fillRect(0, y, S, 1);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < S; x += 3) g.fillRect(x, 0, 1, S);

  // Draw 3D embossed diamond lugs (classic 5-bar / cross-hatch pattern)
  const drawLug = (cx: number, cy: number, angle: number) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    const rw = 20;
    const rh = 6.5;

    // Ambient drop shadow
    g.fillStyle = 'rgba(0, 0, 0, 0.65)';
    g.beginPath();
    g.ellipse(1.5, 1.8, rw / 2 + 1, rh / 2 + 1, 0, 0, Math.PI * 2);
    g.fill();

    // Dark bottom-right shadow bevel
    g.fillStyle = '#0a0d13';
    g.beginPath();
    g.ellipse(0.6, 0.8, rw / 2, rh / 2, 0, 0, Math.PI * 2);
    g.fill();

    // Main steel lug body
    const lugGrad = g.createLinearGradient(-rw / 2, -rh / 2, rw / 2, rh / 2);
    lugGrad.addColorStop(0, '#505a6e');
    lugGrad.addColorStop(0.5, '#353e4f');
    lugGrad.addColorStop(1, '#222834');
    g.fillStyle = lugGrad;
    g.beginPath();
    g.ellipse(0, 0, rw / 2 - 0.5, rh / 2 - 0.5, 0, 0, Math.PI * 2);
    g.fill();

    // Top-left crisp specular highlight
    g.strokeStyle = 'rgba(230, 242, 255, 0.7)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(0, -0.6, rw / 2 - 1.5, Math.PI * 0.9, Math.PI * 1.9);
    g.stroke();

    g.restore();
  };

  const step = 64;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      drawLug(x + 16, y + 16, Math.PI / 4);
      drawLug(x + 28, y + 28, Math.PI / 4);
      drawLug(x + 48, y + 48, -Math.PI / 4);
      drawLug(x + 60, y + 60, -Math.PI / 4);
    }
  }

  const tex = toTex(c, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * HAZARD RIM TEXTURE (Platform Dek Baja 13.5m)
 * Industrial safety hazard chevrons (diagonal black & yellow stripes) with metal rivets and WRC branding.
 */
function hazardRimTexture() {
  const W = 1024;
  const H = 128;
  const { c, g } = canvas(W, H);

  // Base background
  g.fillStyle = '#0f1218';
  g.fillRect(0, 0, W, H);

  // 45-degree diagonal hazard caution stripes (Safety Yellow & Matte Black)
  const stripeW = 36;
  g.save();
  for (let x = -H; x < W + H; x += stripeW * 2) {
    g.fillStyle = '#ffbe00';
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + stripeW, 0);
    g.lineTo(x + stripeW - H, H);
    g.lineTo(x - H, H);
    g.closePath();
    g.fill();
  }
  g.restore();

  // Top and bottom heavy steel flange borders
  const flangeH = 14;
  g.fillStyle = '#161922';
  g.fillRect(0, 0, W, flangeH);
  g.fillRect(0, H - flangeH, W, flangeH);

  // Edge bevel highlights & shadow lines
  g.fillStyle = 'rgba(255, 255, 255, 0.3)';
  g.fillRect(0, 0, W, 2);
  g.fillRect(0, H - flangeH, W, 1.5);
  g.fillStyle = 'rgba(0, 0, 0, 0.7)';
  g.fillRect(0, flangeH - 1.5, W, 2);
  g.fillRect(0, H - 2, W, 2);

  // Steel bolt studs along the flange
  for (let x = 20; x < W; x += 44) {
    for (const by of [flangeH / 2, H - flangeH / 2]) {
      g.fillStyle = '#0a0d13';
      g.beginPath();
      g.arc(x + 1, by + 1, 3.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6b7991';
      g.beginPath();
      g.arc(x, by, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d5e2f5';
      g.beginPath();
      g.arc(x - 0.7, by - 0.7, 1.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Stenciled industrial labels in the middle
  for (let s = 0; s < 2; s++) {
    const x0 = s * (W / 2) + 40;
    g.fillStyle = 'rgba(10, 12, 16, 0.9)';
    g.fillRect(x0 + 60, H / 2 - 18, 380, 36);
    g.strokeStyle = '#ffbe00';
    g.lineWidth = 1.5;
    g.strokeRect(x0 + 60, H / 2 - 18, 380, 36);

    g.fillStyle = '#ffffff';
    g.font = font(22);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText('DEK BAJA 13.5M  ·  HAZARD RIM', x0 + 250, H / 2 + 1);
  }

  const tex = toTex(c, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * UNDERGLOW CYAN TEXTURE
 * Smooth neon cyan light pool with linear falloff on the arena floor.
 */
function cyanUnderglowTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(0, 245, 255, 0.95)');
  grad.addColorStop(0.2, 'rgba(0, 220, 255, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 165, 255, 0.22)');
  grad.addColorStop(1, 'rgba(0, 120, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = toTex(c, 8);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * BANTALAN KHUSUS SUDUT TIANG ARENA (Corner Turnbuckle Protector Pad)
 * High-density foam boxing cushion with stitched vinyl seams, WRC branding, and hazard warning chevrons.
 */
function cornerPadTexture(type: 'blue' | 'red' | 'neutral', title: string) {
  const W = 512;
  const H = 1024;
  const { c, g } = canvas(W, H);

  // Rich textured vinyl background
  const bg = g.createLinearGradient(0, 0, W, 0);
  if (type === 'blue') {
    bg.addColorStop(0, '#0a1d48');
    bg.addColorStop(0.5, '#173f8a');
    bg.addColorStop(1, '#0a1d48');
  } else if (type === 'red') {
    bg.addColorStop(0, '#540d14');
    bg.addColorStop(0.5, '#991822');
    bg.addColorStop(1, '#540d14');
  } else {
    bg.addColorStop(0, '#12151c');
    bg.addColorStop(0.5, '#222834');
    bg.addColorStop(1, '#12151c');
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Micro-leather / heavy vinyl grain
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 2, H);

  // Vertical foam bevel shading (3D cylindrical cushion appearance)
  const cylGrad = g.createLinearGradient(0, 0, W, 0);
  cylGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
  cylGrad.addColorStop(0.12, 'rgba(0,0,0,0.15)');
  cylGrad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  cylGrad.addColorStop(0.88, 'rgba(0,0,0,0.15)');
  cylGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = cylGrad;
  g.fillRect(0, 0, W, H);

  // Reinforced double stitched seam edges (Yellow/Gold or White stitch)
  const stitchColor = type === 'neutral' ? '#ffbe00' : '#f0e4b8';
  g.strokeStyle = stitchColor;
  g.lineWidth = 2.5;
  g.setLineDash([8, 6]);
  g.strokeRect(18, 18, W - 36, H - 36);
  g.strokeRect(32, 32, W - 64, H - 64);
  g.setLineDash([]);

  // Top & bottom hazard caution stripes
  const drawHazardStrip = (y0: number, h: number) => {
    g.fillStyle = '#10141d';
    g.fillRect(18, y0, W - 36, h);
    g.save();
    g.beginPath();
    g.rect(18, y0, W - 36, h);
    g.clip();
    const stripeW = 24;
    for (let x = -h; x < W + h; x += stripeW * 2) {
      g.fillStyle = type === 'neutral' ? '#ffbe00' : '#ffffff';
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x + stripeW, y0);
      g.lineTo(x + stripeW - h, y0 + h);
      g.lineTo(x - h, y0 + h);
      g.closePath();
      g.fill();
    }
    g.restore();
  };
  drawHazardStrip(36, 48);
  drawHazardStrip(H - 84, 48);

  // WRC Emblem in upper section
  wrcEmblem(g, W / 2, 220, 110);

  // Big bold championship designation
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.font = font(58);
  g.fillText(title, W / 2, 420);

  g.fillStyle = type === 'blue' ? '#8bc5ff' : type === 'red' ? '#ff9e9e' : '#ffd060';
  g.font = font(42);
  g.fillText(type === 'blue' ? 'BLUE CORNER' : type === 'red' ? 'RED CORNER' : 'NEUTRAL', W / 2, 480);

  // Center protective rating badge
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(W / 2 - 180, 560, 360, 60);
  g.strokeStyle = stitchColor;
  g.lineWidth = 2;
  g.strokeRect(W / 2 - 180, 560, 360, 60);
  g.fillStyle = '#ffffff';
  g.font = '700 24px Arial, sans-serif';
  g.fillText('TITAN IMPACT ABSORBER', W / 2, 590);

  // Lower subtitle
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = '700 22px Arial, sans-serif';
  g.fillText('STEEL TITANS · WORLD FINALS', W / 2, 700);
  g.fillText('HEAVYWEIGHT DIVISION', W / 2, 735);

  const tex = toTex(c, 8);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function bannerTexture() {
  const W = 1024;
  const Hh = 512;
  const { c, g } = canvas(W, Hh);
  const grd = g.createLinearGradient(0, 0, W, Hh);
  grd.addColorStop(0, '#0a1226');
  grd.addColorStop(1, '#131c3d');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(150,28,38,0.55)';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(260, 0);
  g.lineTo(120, Hh);
  g.lineTo(0, Hh);
  g.fill();
  g.fillStyle = 'rgba(40,70,160,0.55)';
  g.beginPath();
  g.moveTo(W, 0);
  g.lineTo(W - 260, 0);
  g.lineTo(W - 120, Hh);
  g.lineTo(W, Hh);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.lineWidth = 2;
  for (let i = -Hh; i < W; i += 38) {
    g.beginPath();
    g.moveTo(i, Hh);
    g.lineTo(i + Hh, 0);
    g.stroke();
  }
  wrcEmblem(g, 300, Hh / 2, 175);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.font = font(96);
  g.fillText('WORLD ROBOT', 520, Hh / 2 - 70);
  g.fillStyle = '#d8b86a';
  g.fillText('CHAMPIONSHIP', 520, Hh / 2 + 30);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '700 34px Arial, sans-serif';
  g.fillText('STEEL TITANS · WORLD FINALS', 524, Hh / 2 + 120);
  g.strokeStyle = 'rgba(216,222,232,0.7)';
  g.lineWidth = 6;
  g.strokeRect(10, 10, W - 20, Hh - 20);
  return toTex(c);
}

/** A legible, team-colour portal sign instead of a blank glowing slab. */
function entranceSignTexture(hex: number) {
  const W = 768;
  const Hh = 96;
  const { c, g } = canvas(W, Hh);
  const color = `#${new THREE.Color(hex).getHexString()}`;
  const bg = g.createLinearGradient(0, 0, W, Hh);
  bg.addColorStop(0, '#080d1a');
  bg.addColorStop(0.5, '#131a2a');
  bg.addColorStop(1, '#080d1a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = color;
  g.fillRect(0, 0, W, 5);
  g.fillRect(0, Hh - 5, W, 5);
  g.strokeStyle = `${color}bb`;
  g.lineWidth = 3;
  g.strokeRect(8, 8, W - 16, Hh - 16);
  g.fillStyle = '#edf4ff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(48);
  g.fillText('RING WALK', W / 2, 46);
  g.fillStyle = color;
  g.font = '700 15px Arial, sans-serif';
  g.fillText('WORLD ROBOT CHAMPIONSHIP', W / 2, 76);
  for (const [x, dir] of [[54, 1], [W - 54, -1]] as const) {
    g.beginPath();
    g.moveTo(x - dir * 14, 48);
    g.lineTo(x + dir * 8, 34);
    g.lineTo(x + dir * 8, 43);
    g.lineTo(x + dir * 22, 43);
    g.lineTo(x + dir * 22, 53);
    g.lineTo(x + dir * 8, 53);
    g.lineTo(x + dir * 8, 62);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }
  return toTex(c, 4);
}

function wallTexture() {
  const W = 2048;
  const Hh = 256;
  const { c, g } = canvas(W, Hh);
  g.fillStyle = '#0a0d16';
  g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(160,185,255,0.08)';
  g.lineWidth = 2;
  for (let x = 0; x <= W; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, Hh);
    g.stroke();
  }
  for (let y = 0; y <= Hh; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // light strips
  for (const y of [40, 120, 200]) {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, 'rgba(120,150,255,0.0)');
    gr.addColorStop(0.5, 'rgba(120,150,255,0.5)');
    gr.addColorStop(1, 'rgba(120,150,255,0.0)');
    for (let k = 0; k < 8; k++) {
      g.fillStyle = gr;
      g.fillRect((k * W) / 8 + 20, y, W / 8 - 40, 3);
    }
  }
  // panel grime
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Math.random() * Hh, Math.random() * 60, Math.random() * 30);
  }
  return toTex(c, 4);
}

function floorDecalTexture() {
  const S = 1024;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#020408';
  g.fillRect(0, 0, S, S);
  for (let r = 60; r < S / 2; r += 34) {
    g.beginPath();
    g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    g.strokeStyle = `rgba(160,195,255,${0.04 + (r % 68 === 26 ? 0.05 : 0)})`;
    g.lineWidth = 2;
    g.stroke();
  }
  // bold ring with lettering - high contrast
  g.beginPath();
  g.arc(S / 2, S / 2, 460, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(215,230,255,0.28)';
  g.lineWidth = 10;
  g.stroke();
  g.beginPath();
  g.arc(S / 2, S / 2, 432, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(220,180,88,0.42)';
  g.lineWidth = 3;
  g.stroke();
  g.font = font(34);
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.52)';
  arcText(g, 'WORLD ROBOT CHAMPIONSHIP  ·  WRC  ·  STEEL TITANS  ·  ', S / 2, S / 2, 392, -Math.PI * 0.5);
  arcText(g, 'WORLD ROBOT CHAMPIONSHIP  ·  WRC  ·  STEEL TITANS  ·  ', S / 2, S / 2, 392, Math.PI * 0.5 + 0.06);
  return toTex(c, 4);
}

export function buildArena(scene: THREE.Scene, camera?: THREE.Camera): Arena {
  scene.background = new THREE.Color(0x010206);
  // Deep dark stadium contrast: crisp midnight shadows without milky fog bleaching
  scene.fog = new THREE.FogExp2(0x020308, 0.0016);

  // ---------- BROADCAST RING LIGHTING: rich saturated colours, crisp highlights, deep shadows ----------
  scene.add(new THREE.AmbientLight(0x5a70a8, 0.05));
  scene.add(new THREE.HemisphereLight(0x7da4f0, 0x0c0d18, 0.18));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.25);
  key.position.set(12, 40, 18);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 1.5;
  const sc = key.shadow.camera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sc.near = 10;
  sc.far = 90;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  scene.add(key.target);

  const mkRim = (color: number, x: number, z: number, intensity = 3.2) => {
    const s = new THREE.SpotLight(color, intensity, 60, 1.05, 0.7, 1.1);
    s.position.set(x, 22, z);
    s.target.position.set(0, 2.4, 0);
    scene.add(s, s.target);
    return s;
  };
  // THE RING KEY: spotlight seimbang (intensity 3.8) agar gambar logo & tekstur matras tampil jernih tanpa silau/pucat
  const ringKey = new THREE.SpotLight(0xffeed6, 3.8, 96, 0.65, 0.52, 0.94);
  ringKey.position.set(5, 33, 7);
  ringKey.target.position.set(0, 0, 0);
  scene.add(ringKey, ringKey.target);
  // A gentle cool fill from the opposite corner (intensity 1.8) menjaga bayangan lembut dan warna tidak mati
  const ringFill = new THREE.SpotLight(0x9fc4ff, 1.8, 88, 0.84, 0.60, 1.0);
  ringFill.position.set(-11, 30, -13);
  ringFill.target.position.set(0, 0, 0);
  scene.add(ringFill, ringFill.target);
  // Subtle crimson/blue rims add shape around the armour; a soft white side kicker keeps silhouettes clear.
  const rimRed = mkRim(0xff4a3c, -22, -28, 3.4);
  const rimBlue = mkRim(0x4a92ff, 22, 28, 3.4);
  const rimSide = mkRim(0xd8e4ff, 30, -12, 1.8);

  // ---------- floor: deep dark metallic contrast ----------
  const floor = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ color: 0x030509, roughness: 0.36, metalness: 0.78 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.4;
  floor.receiveShadow = true;
  scene.add(floor);
  const decal = new THREE.Mesh(new THREE.CircleGeometry(31, 64), new THREE.MeshStandardMaterial({ map: floorDecalTexture(), roughness: 0.38, metalness: 0.65 }));
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = -1.39;
  decal.receiveShadow = true;
  scene.add(decal);

  // ---------- ring ----------
  const ringTex = ringTexture();
  // Matras dengan respon pencahayaan seimbang & tekstur warna tajam, tidak silau dan tidak terlalu gelap
  const topMat = new THREE.MeshStandardMaterial({
    map: ringTex,
    color: new THREE.Color(0xffffff),
    roughness: 0.82,
    metalness: 0.04,
  });
  const apronTex = stripTexture(true);
  apronTex.repeat.set(1, 1);
  const apronMat = new THREE.MeshStandardMaterial({ map: apronTex, emissiveMap: apronTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.3, roughness: 0.66, metalness: 0.22 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.52, metalness: 0.75 });
  const ring = new THREE.Group(); // everything that must grow with the ring in TEAM MATCH (2v2)
  scene.add(ring);
  let ringScale = 1;
  // LAYER 1 (TOP): Matras / Ring Canvas platform (y = 0 down to y = -0.7)
  const platform = new THREE.Mesh(new THREE.BoxGeometry(31, 0.7, 31), [apronMat, apronMat, topMat, baseMat, apronMat, apronMat]);
  platform.position.y = -0.35;
  platform.receiveShadow = true;
  platform.castShadow = false;
  ring.add(platform);

  // LAYER 2 (BELOW MATRAS): Platform Dek Baja & Hazard Rim
  // "Dek 13.5m, pelat diamond plate anti-slip & underglow cyan"
  const diamondTex = diamondPlateTexture();
  diamondTex.repeat.set(16, 16);
  const diamondMat = new THREE.MeshStandardMaterial({
    map: diamondTex,
    roughness: 0.32,
    metalness: 0.88,
  });

  const hazardTex = hazardRimTexture();
  hazardTex.repeat.set(10, 1);
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.42,
    metalness: 0.65,
    emissive: new THREE.Color(0xffbe00),
    emissiveIntensity: 0.08,
  });

  const DECK_W = 34.2; // 13.5m clearance + perimeter stepped walkway
  const DECK_H = 0.7; // From y = -0.7 down to y = -1.4 (arena floor)
  const deckMesh = new THREE.Mesh(
    new THREE.BoxGeometry(DECK_W, DECK_H, DECK_W),
    [hazardMat, hazardMat, diamondMat, baseMat, hazardMat, hazardMat]
  );
  deckMesh.position.y = -1.05;
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = false;
  ring.add(deckMesh);

  // Heavy steel corner reinforcements
  const steelTrimMat = new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.38, metalness: 0.88 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerBracket = new THREE.Mesh(new THREE.BoxGeometry(1.4, DECK_H + 0.02, 1.4), steelTrimMat);
      cornerBracket.position.set(sx * (DECK_W / 2 - 0.65), -1.05, sz * (DECK_W / 2 - 0.65));
      ring.add(cornerBracket);
    }
  }

  // UNDERGLOW CYAN: Continuous glowing neon strips along the 4 bottom edges of the deck
  const cyanGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00f5ff).multiplyScalar(1.2),
    toneMapped: false,
  });
  const mkCyanStrip = (w: number, d: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), cyanGlowMat);
    mesh.position.set(x, -1.35, z);
    ring.add(mesh);
  };
  mkCyanStrip(DECK_W + 0.08, 0.12, 0, DECK_W / 2);
  mkCyanStrip(DECK_W + 0.08, 0.12, 0, -DECK_W / 2);
  mkCyanStrip(0.12, DECK_W + 0.08, DECK_W / 2, 0);
  mkCyanStrip(0.12, DECK_W + 0.08, -DECK_W / 2, 0);

  // UNDERGLOW CYAN HALO: Projected luminous cyan light pool on the floor beneath the deck
  const cyanPoolTex = cyanUnderglowTexture();
  const cyanPoolMat = new THREE.MeshBasicMaterial({
    map: cyanPoolTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const haloW = DECK_W + 3.2;
  const haloD = 4.2;
  const mkHalo = (x: number, z: number, rotY: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(haloW, haloD), cyanPoolMat);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rotY;
    p.position.set(x, -1.385, z);
    ring.add(p);
  };
  mkHalo(0, DECK_W / 2 + haloD / 2 - 0.4, 0);
  mkHalo(0, -DECK_W / 2 - haloD / 2 + 0.4, Math.PI);
  mkHalo(DECK_W / 2 + haloD / 2 - 0.4, 0, -Math.PI / 2);
  mkHalo(-DECK_W / 2 - haloD / 2 + 0.4, 0, Math.PI / 2);

  // ---------- THE GLOSSY FLOORS: disabled on canvas to keep matras pure deep dark matte without bleached white sheen
  // Default is off for 60 FPS performance and dark canvas contrast
  const setMirrors = (_canvasOn: boolean, _hallOn = _canvasOn) => {
    // No-op: mirror render passes disabled for locked 60 FPS arena performance
  };

  const neonRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4350).multiplyScalar(0.8) });
  const neonBlue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5f9bff).multiplyScalar(0.8) });
  const mkStrip = (w: number, d: number, x: number, z: number, m: THREE.Material, y = -0.05) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), m);
    mesh.position.set(x, y, z);
    markReflect(mesh, true);
    ring.add(mesh);
  };
  mkStrip(31.1, 0.14, 0, 15.5, neonBlue);
  mkStrip(31.1, 0.14, 0, -15.5, neonRed);
  mkStrip(0.14, 31.1, 15.5, 0, neonBlue);
  mkStrip(0.14, 31.1, -15.5, 0, neonRed);

  // ---------- CHAMPIONSHIP CORNER POSTS, SPECIALIZED TURNBUCKLE PADS & PYRO NOZZLES ----------
  const postMat = new THREE.MeshStandardMaterial({ color: 0x181b22, metalness: 0.92, roughness: 0.28 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x485264, metalness: 0.96, roughness: 0.18 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x15181f, metalness: 0.9, roughness: 0.32 });

  const pilotAmberMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff9820),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const pilotBlueMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x3388ff),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const H = 13.6;
  const ropeYs = [2.0, 3.6, 5.2]; // like a real ring: the top rope catches a 7 m robot across the chest / upper back
  const corners: [number, number][] = [
    [H, H],    // 0: Blue Corner
    [-H, H],   // 1: Neutral Corner NW
    [H, -H],   // 2: Neutral Corner SE
    [-H, -H],  // 3: Red Corner
  ];
  const cornerTypes: ('blue' | 'neutral' | 'neutral' | 'red')[] = ['blue', 'neutral', 'neutral', 'red'];
  const cornerTitles = ['BLUE CORNER', 'NEUTRAL', 'NEUTRAL', 'RED CORNER'];

  // Pad springs for physical impact reaction
  interface PadSpring {
    group: THREE.Group;
    jolt: number;
    joltVel: number;
  }
  const padSprings: PadSpring[] = [];

  // Volumetric concert flame emitter interface
  interface ConcertFlameEmitter {
    group: THREE.Group;
    pilotGroup: THREE.Group;
    ledRing: THREE.MeshBasicMaterial;
    placement: PyroPlacement;
    cornerIdx: number;
  }
  const nozzleEmitters: ConcertFlameEmitter[] = [];
  const postNozzlePositions: THREE.Vector3[] = [];
  const deckNozzlePositions: THREE.Vector3[] = [];
  const cornerNozzlePositions: THREE.Vector3[] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];

  let currentPyroPlacement: PyroPlacement = loadPyroPlacement();
  const atmosphere = new AtmosphereEffects(scene);
  let currentCamera: THREE.Camera | undefined = camera;

  const buildConcertFlameMesh = (parentGroup: THREE.Group, baseY: number, placement: PyroPlacement, cornerIdx: number, cType: string) => {
    const flameMount = new THREE.Group();
    flameMount.position.y = baseY;
    parentGroup.add(flameMount);

    // Dual-color realistic pilot flame (blue base bulb + flickering amber tongue)
    const pilotGroup = new THREE.Group();
    const pilotBase = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pilotBlueMat);
    pilotBase.position.y = 0.08;
    pilotGroup.add(pilotBase);
    const pilotTongue = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), pilotAmberMat);
    pilotTongue.position.y = 0.22;
    pilotGroup.add(pilotTongue);
    flameMount.add(pilotGroup);

    // Glowing LED status ring
    const ledMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cType === 'blue' ? 0x00e1ff : cType === 'red' ? 0xff4d00 : 0xffbe00).multiplyScalar(1.2),
      toneMapped: false,
    });

    const emitter: ConcertFlameEmitter = {
      group: parentGroup,
      pilotGroup,
      ledRing: ledMat,
      placement,
      cornerIdx,
    };
    nozzleEmitters.push(emitter);
    return emitter;
  };

  corners.forEach(([x, z], i) => {
    const cType = cornerTypes[i];
    const cTitle = cornerTitles[i];
    const inwardYaw = Math.atan2(-x, -z); // points towards ring center (0, 0)

    // Main heavy steel corner post
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 7.2, 16), postMat);
    postMesh.position.set(x, 3.6, z);
    postMesh.castShadow = false;
    markReflect(postMesh);
    ring.add(postMesh);

    // Heavy cast iron base flange
    const baseFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.65, 0.45, 16), chromeMat);
    baseFlange.position.set(x, 0.22, z);
    ring.add(baseFlange);

    // Turnbuckle eyelet brackets on the steel post
    for (const y of ropeYs) {
      const eyelet = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12), chromeMat);
      eyelet.position.set(x, y, z);
      ring.add(eyelet);
    }

    // ======================================================================
    // 1. BANTALAN KHUSUS POJOK TIANG (Turnbuckle Corner Protector Cushion)
    // Custom contoured high-density foam wedge facing inward to protect fighters!
    // ======================================================================
    const padGroup = new THREE.Group();
    padGroup.position.set(x, 0, z);
    padGroup.rotation.y = inwardYaw;
    ring.add(padGroup);

    const padTex = cornerPadTexture(cType, cTitle);
    const padFrontMat = new THREE.MeshStandardMaterial({
      map: padTex,
      roughness: 0.45,
      metalness: 0.08,
    });
    const sideColor = cType === 'blue' ? 0x0c204d : cType === 'red' ? 0x5a0f15 : 0x141822;
    const padSideMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      roughness: 0.58,
      metalness: 0.06,
    });
    const padBackMat = new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.75,
      metalness: 0.1,
    });

    const padMaterials = [padSideMat, padSideMat, padSideMat, padSideMat, padFrontMat, padBackMat];
    const PAD_W = 1.48; // width across corner
    const PAD_H = 4.85; // height spanning from below bottom rope to above top rope
    const PAD_D = 1.05; // depth protruding toward ring center
    const padMesh = new THREE.Mesh(new THREE.BoxGeometry(PAD_W, PAD_H, PAD_D), padMaterials);
    padMesh.position.set(0, 3.6, 0.54);
    padMesh.castShadow = false;
    markReflect(padMesh);
    padGroup.add(padMesh);

    // Beveled top and bottom safety end-caps
    const endCapMat = new THREE.MeshStandardMaterial({
      color: cType === 'blue' ? 0x122e6b : cType === 'red' ? 0x75131b : 0x1e2430,
      roughness: 0.5,
      metalness: 0.08,
    });
    for (const [capY] of [[3.6 + PAD_H / 2 + 0.1], [3.6 - PAD_H / 2 - 0.1]] as const) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(PAD_W / 2, PAD_W / 2, 0.22, 16), endCapMat);
      cap.position.set(0, capY, 0.54);
      cap.scale.set(1, 1, PAD_D / PAD_W);
      padGroup.add(cap);
    }

    // Heavy protective turnbuckle foam sleeves connecting into the pad
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: cType === 'blue' ? 0x1a3d8a : cType === 'red' ? 0x8a1c25 : 0x242a38,
      roughness: 0.6,
      metalness: 0.05,
    });
    for (const y of ropeYs) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.85, 12), sleeveMat);
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.set(0, y, 0.25);
      padGroup.add(sleeve);
    }

    // Reinforced nylon tie-down retention straps with chrome ratchet buckles
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.85, metalness: 0.05 });
    for (const sy of [1.6, 2.8, 4.4, 5.6]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(PAD_W + 0.08, 0.1, PAD_D + 0.45), strapMat);
      strap.position.set(0, sy, 0.35);
      padGroup.add(strap);

      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.1), chromeMat);
      buckle.position.set(PAD_W / 2 + 0.05, sy, 0.1);
      padGroup.add(buckle);
    }

    padSprings.push({ group: padGroup, jolt: 0, joltVel: 0 });

    // ======================================================================
    // 2. NOZEL API PYRO — OPSI 1: POJOK TIANG RING (Ring Post Top Nozzles)
    // ======================================================================
    const postNozzleGroup = new THREE.Group();
    postNozzleGroup.position.set(x, 7.2, z);
    ring.add(postNozzleGroup);
    postNozzlePositions.push(new THREE.Vector3(x, 7.4, z));

    const nozzleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.32, 16), chromeMat);
    nozzleCollar.position.y = 0.16;
    postNozzleGroup.add(nozzleCollar);

    for (let b = 0; b < 6; b++) {
      const ba = (b / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), chromeMat);
      bolt.position.set(Math.cos(ba) * 0.44, 0.34, Math.sin(ba) * 0.44);
      postNozzleGroup.add(bolt);
    }

    const burnerCone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.26, 0.7, 16), nozzleMat);
    burnerCone.position.y = 0.62;
    postNozzleGroup.add(burnerCone);

    const heatShield = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 24), chromeMat);
    heatShield.rotation.x = Math.PI / 2;
    heatShield.position.y = 0.72;
    postNozzleGroup.add(heatShield);

    // Ceramic igniter spark pins
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.1 });
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.1, metalness: 0.9 });
    for (const sign of [-1, 1]) {
      const pinBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), ceramicMat);
      pinBase.position.set(sign * 0.24, 0.88, 0);
      postNozzleGroup.add(pinBase);
      const pinTip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6), pinMat);
      pinTip.rotation.z = sign * -0.4;
      pinTip.position.set(sign * 0.2, 0.98, 0);
      postNozzleGroup.add(pinTip);
    }

    const postEmitter = buildConcertFlameMesh(postNozzleGroup, 0.72, 'ring_posts', i, cType);
    const postLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 6, 24), postEmitter.ledRing);
    postLedRing.rotation.x = Math.PI / 2;
    postLedRing.position.y = 0.31;
    postNozzleGroup.add(postLedRing);

    // ======================================================================
    // 3. NOZEL API PYRO — OPSI 2: UJUNG SISI PLATFORM BAJA (Steel Deck Corners)
    // Heavy industrial stadium concert flame cannon units at the outer diamond plate corners!
    // ======================================================================
    const sx = Math.sign(x);
    const sz = Math.sign(z);
    const deckX = sx * 16.3; // outer corner of 34.2m deck
    const deckZ = sz * 16.3;
    deckNozzlePositions.push(new THREE.Vector3(deckX, 0.3, deckZ));

    const stageProjectorGroup = new THREE.Group();
    stageProjectorGroup.position.set(deckX, -0.7, deckZ); // sits on top of steel platform surface (y = -0.7)
    stageProjectorGroup.rotation.y = inwardYaw;
    ring.add(stageProjectorGroup);

    // Heavy reinforced pedestal box with hazard stripes and diamond plate top
    const projectorBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.44, 1.3),
      [hazardMat, hazardMat, diamondMat, baseMat, hazardMat, hazardMat]
    );
    projectorBox.position.y = 0.22;
    projectorBox.receiveShadow = true;
    stageProjectorGroup.add(projectorBox);

    // 4 Corner heavy steel anchor plates with chrome bolts
    for (const bx of [-0.55, 0.55]) {
      for (const bz of [-0.55, 0.55]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), chromeMat);
        plate.position.set(bx, 0.45, bz);
        stageProjectorGroup.add(plate);
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6), chromeMat);
        bolt.position.set(bx, 0.49, bz);
        stageProjectorGroup.add(bolt);
      }
    }

    // High-pressure braided gas feed lines
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1c212d, roughness: 0.6, metalness: 0.8 });
    for (const hx of [-0.28, 0.28]) {
      const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 10), hoseMat);
      hose.position.set(hx, 0.38, -0.42);
      stageProjectorGroup.add(hose);
    }

    // Heavy dual flame projector cannon turret
    const turretCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.35, 16), chromeMat);
    turretCollar.position.y = 0.56;
    stageProjectorGroup.add(turretCollar);

    const cannonShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.8, 16), nozzleMat);
    cannonShroud.position.y = 0.98;
    stageProjectorGroup.add(cannonShroud);

    const cannonShield = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 24), chromeMat);
    cannonShield.rotation.x = Math.PI / 2;
    cannonShield.position.y = 1.05;
    stageProjectorGroup.add(cannonShield);

    // Dual pilot pins on stage projector
    for (const sign of [-1, 1]) {
      const pinBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 8), ceramicMat);
      pinBase.position.set(sign * 0.26, 1.25, 0);
      stageProjectorGroup.add(pinBase);
      const pinTip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 6), pinMat);
      pinTip.rotation.z = sign * -0.4;
      pinTip.position.set(sign * 0.22, 1.35, 0);
      stageProjectorGroup.add(pinTip);
    }

    const deckEmitter = buildConcertFlameMesh(stageProjectorGroup, 1.05, 'steel_platform', i, cType);
    const deckLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 6, 24), deckEmitter.ledRing);
    deckLedRing.rotation.x = Math.PI / 2;
    deckLedRing.position.y = 0.72;
    stageProjectorGroup.add(deckLedRing);
  });

  const applyPyroPlacement = (placement: PyroPlacement) => {
    currentPyroPlacement = placement;
    savePyroPlacement(placement);
    atmosphere.setPlacement(placement);
    for (let i = 0; i < 4; i++) {
      if (placement === 'ring_posts') {
        cornerNozzlePositions[i].copy(postNozzlePositions[i]);
      } else {
        cornerNozzlePositions[i].copy(deckNozzlePositions[i]);
      }
    }
  };

  applyPyroPlacement(currentPyroPlacement);

  const setPyroPlacement = (placement: PyroPlacement) => {
    applyPyroPlacement(placement);
  };

  const getPyroPlacement = (): PyroPlacement => currentPyroPlacement;

  const fireCornerPyro = (level: number, duration = 1.4, mode: 'puff' | 'blast' = 'blast') => {
    const lvl = Math.max(0.2, Math.min(1.2, level));
    atmosphere.fire(cornerNozzlePositions, lvl, duration, mode);
  };

  const triggerCornerPad = (cornerIdx: number, strength: number) => {
    const idx = Math.max(0, Math.min(3, Math.floor(cornerIdx)));
    if (padSprings[idx]) {
      padSprings[idx].joltVel += Math.min(4, Math.max(0.4, strength)) * 2.4;
    }
  };
  const ropeColors = [0xb8262e, 0xe8e6e0, 0x2a4fb8];
  // sides: 0:+z 1:-z 2:+x 3:-x. Each rope is a finely segmented tube that bends around the contact point.
  const ROPE_SEG = 56;
  const ropeLen = H * 2;
  const nSign = [1, -1, 1, -1]; // outward direction in the rope group's local z
  const ropeW = [0.55, 0.8, 1.0]; // lower / middle / upper rope: the chest / upper back leans on the top rope, the hips brush the middle one, the knees barely reach the bottom one
  interface RopeMesh {
    geo: THREE.BufferGeometry;
    base: Float32Array;
    w: number;
    k: number; // 0 bottom · 1 middle · 2 top
  }
  const ropeSides: RopeMesh[][] = [[], [], [], []];
  /** one held-open spot on a side: u = where along the rope, a = how far open (smoothed), t = this frame's target */
  interface Spread {
    u: number;
    a: number;
    t: number;
  }
  const ropeS = [0, 1, 2, 3].map(() => ({ x: 0, v: 0, u: 0, press: 0, active: false, spreads: [] as Spread[] }));
  // how far each rope moves when the ropes are held open for a ring entry: the top rope goes UP (the gloves lift
  // it), the middle and bottom ropes are pressed DOWN to the canvas — a 7 m machine ducks under one and steps over
  // the others exactly the way a boxer climbs through
  const SPREAD_Y = [-1.75, -3.1, 1.75];
  ropeYs.forEach((y, k) => {
    const mat = new THREE.MeshStandardMaterial({ color: ropeColors[k], roughness: 0.62, metalness: 0.08, emissive: ropeColors[k], emissiveIntensity: 0.02 });
    const mk = (side: number, rx: number, rz: number, rotY: number) => {
      const geo = new THREE.CylinderGeometry(0.12, 0.12, ropeLen, 10, ROPE_SEG, false);
      geo.rotateZ(Math.PI / 2); // length along local X
      const r = new THREE.Mesh(geo, mat);
      r.castShadow = true;
      r.frustumCulled = false;
      markReflect(r);
      const g = new THREE.Group();
      g.add(r);
      g.position.set(rx, y, rz);
      g.rotation.y = rotY;
      ring.add(g);
      ropeSides[side].push({ geo, base: (geo.attributes.position.array as Float32Array).slice(), w: ropeW[k], k });
    };
    mk(0, 0, H, 0);
    mk(1, 0, -H, 0);
    mk(2, H, 0, Math.PI / 2);
    mk(3, -H, 0, Math.PI / 2);
  });
  const sideOf = (x: number, z: number) => (Math.abs(x) > Math.abs(z) ? (x > 0 ? 2 : 3) : z > 0 ? 0 : 1);
  const alongOf = (side: number, x: number, z: number) => (side < 2 ? x : -z); // local X of that rope group
  const setRingScale = (s: number) => {
    ringScale = s;
    ring.scale.set(s, 1, s);
    // the walkways slide out with the edge of the bigger ring so the ramps still land on the apron
    const d = (s - 1) * 15.5;
    for (const e of entrances) e.g.position.set(e.out.x * d, -1.4, e.out.y * d);
  };
  const ropeHit = (x0: number, z0: number, strength: number) => {
    const x = x0 / ringScale;
    const z = z0 / ringScale;
    const sd = sideOf(x, z);
    const st = ropeS[sd];
    st.u = alongOf(sd, x, z);
    const kick = Math.min(5, strength) * 5.5;
    st.v += kick;
    st.active = true;
    // the ropes run through the corner posts: a slam on one side jerks the two adjoining sides too (more on the
    // side whose post is nearer the impact), so the whole ring answers the blow instead of one rope on its own
    for (const cs of [1, -1]) {
      let adj: number;
      let adjU: number;
      let cornerU: number;
      if (sd < 2) {
        // side 0 (+z) / 1 (-z): corners at x = ±H, shared with side 2 (+x) / 3 (-x) at their local z-end
        adj = cs > 0 ? 2 : 3;
        cornerU = cs * H;
        adjU = -(sd === 0 ? 1 : -1) * H;
      } else {
        // side 2 (+x) / 3 (-x): local along = -z, corners at z = ∓H, shared with side 0 (+z) / 1 (-z)
        adj = cs > 0 ? 1 : 0; // along = +H → z = -H → side 1
        cornerU = cs * H;
        adjU = (sd === 2 ? 1 : -1) * H;
      }
      const near = Math.max(0, 1 - Math.abs(st.u - cornerU) / (2 * H)); // 1 at the shared post, 0.5 mid-rope, 0 at the far post
      const a = ropeS[adj];
      if (near <= 0.05) continue;
      a.u += (adjU * 0.8 - a.u) * 0.5; // the jolt lives near the shared post
      a.v += kick * 0.32 * near;
      a.active = true;
    }
  };
  const ropePress = (x0: number, z0: number, depth: number) => {
    const x = x0 / ringScale;
    const z = z0 / ringScale;
    const sd = sideOf(x, z);
    const st = ropeS[sd];
    st.u += (alongOf(sd, x, z) - st.u) * 0.5;
    st.press = Math.max(st.press, depth);
    st.active = true;
  };
  const ropeSpread = (x0: number, z0: number, amount: number) => {
    const x = x0 / ringScale;
    const z = z0 / ringScale;
    const sd = sideOf(x, z);
    const st = ropeS[sd];
    const u = alongOf(sd, x, z);
    let sp = st.spreads.find((q) => Math.abs(q.u - u) < 1.6);
    if (!sp) {
      if (st.spreads.length >= 3) return;
      sp = { u, a: 0, t: 0 };
      st.spreads.push(sp);
    }
    sp.u += (u - sp.u) * 0.5;
    sp.t = Math.max(sp.t, Math.min(1, amount));
    st.active = true;
  };
  // the ring platform is sprung: a landing / a knock-down makes the whole thing dip and ring back up
  let ringY = 0;
  let ringVy = 0;
  const canvasSlam = (x: number, z: number, strength: number) => {
    ringVy -= Math.min(3, strength) * 0.55;
    const h = 20 * ringScale;
    ropeHit(x, h, strength * 0.45);
    ropeHit(x, -h, strength * 0.45);
    ropeHit(h, z, strength * 0.45);
    ropeHit(-h, z, strength * 0.45);
  };
  const updateRing = (dt: number) => {
    if (Math.abs(ringY) < 0.0005 && Math.abs(ringVy) < 0.002) {
      ringY = 0;
      ringVy = 0;
      ring.position.y = 0;
      return;
    }
    const w = Math.PI * 2 * 3.4;
    const zeta = 0.3;
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const hh = dt / n;
    for (let i = 0; i < n; i++) {
      ringVy += (-w * w * ringY - 2 * zeta * w * ringVy) * hh;
      ringY += ringVy * hh;
    }
    ring.position.y = Math.max(-0.16, ringY);
  };
  const updateRopes = (dt: number) => {
    for (let sd = 0; sd < 4; sd++) {
      const st = ropeS[sd];
      if (!st.active) continue;
      // the held-open spots ease towards this frame's target (opening a touch slower than they close), and go away
      // once they have closed
      let spreading = false;
      for (const sp of st.spreads) {
        sp.a += (sp.t - sp.a) * (1 - Math.exp(-(sp.t > sp.a ? 5.5 : 7.5) * dt));
        sp.t = 0;
        if (sp.a > 0.002) spreading = true;
      }
      if (!spreading) st.spreads.length = 0;
      // under-damped spring: the rope follows the robot, then wobbles back
      const w = Math.PI * 2 * 6.5;
      const zeta = 0.34;
      const n = Math.max(1, Math.ceil(dt / 0.006));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        st.v += (w * w * (st.press - st.x) - 2 * zeta * w * st.v) * h;
        st.x += st.v * h;
      }
      st.press = 0;
      // the rope wraps AROUND the body: it moves out by the body's penetration plus a pad so it sits on the far side
      // of the armour instead of through its middle (the pad fades in over the first few cm of contact)
      const amp = st.x + 0.16 * Math.min(1, Math.max(0, st.x) / 0.06);
      const still = Math.abs(st.x) < 0.002 && Math.abs(st.v) < 0.02 && !spreading;
      for (const rm of ropeSides[sd]) {
        const pos = rm.geo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const sy = SPREAD_Y[rm.k];
        for (let i = 0; i < arr.length; i += 3) {
          const px = rm.base[i];
          let d = 0;
          let lift = 0;
          if (!still) {
            const du = (px - st.u) / 4.8;
            const taper = Math.max(0, 1 - (px / H) * (px / H)); // anchored at the corner posts
            d = amp * rm.w * Math.exp(-du * du) * taper;
            for (const sp of st.spreads) {
              const ds = (px - sp.u) / 3.1;
              lift += sp.a * sy * Math.exp(-ds * ds) * taper;
            }
          }
          arr[i + 1] = rm.base[i + 1] - Math.abs(d) * 0.12 + lift;
          arr[i + 2] = rm.base[i + 2] + nSign[sd] * d;
        }
        pos.needsUpdate = true;
      }
      if (still) {
        st.x = 0;
        st.v = 0;
        st.active = false;
      }
    }
  };

  // ---------- LED ring boards around the ring (scrolling WRC ads) ----------
  // The boards are broken at the two ENTRANCE aisles (see buildEntrance below) so the walkways run straight through
  // them, each gap closed off with a lit end-post.
  const ENTRY_A = [1.247, 4.389]; // azimuths (x = cos a, z = sin a) of the blue / red entrance aisles
  const ENTRY_GAP = 0.19; // half-angle of the opening in the boards (≈ 5 m at r 26.5)
  const ledTex = stripTexture(false);
  ledTex.repeat.set(-6, 1); // negative: the strip is seen from inside the cylinder
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, side: THREE.BackSide, color: new THREE.Color(0.9, 0.9, 0.9) });
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fabff).multiplyScalar(0.86) });
  const arcs: [number, number][] = [
    [ENTRY_A[0] + ENTRY_GAP, ENTRY_A[1] - ENTRY_GAP],
    [ENTRY_A[1] + ENTRY_GAP, ENTRY_A[0] + Math.PI * 2 - ENTRY_GAP],
  ];
  for (const [a0, a1] of arcs) {
    const len = a1 - a0;
    // CylinderGeometry: x = r·sin θ, z = r·cos θ → θ = π/2 − a
    const led = new THREE.Mesh(new THREE.CylinderGeometry(26.5, 26.5, 1.8, Math.ceil((96 * len) / (Math.PI * 2)), 1, true, Math.PI / 2 - a1, len), ledMat);
    led.position.y = -0.5;
    scene.add(led);
    const rimG = new THREE.Group();
    rimG.rotation.y = -a0; // a torus arc starts at azimuth 0; a yaw of −a0 moves its start to a0
    const ledRim = new THREE.Mesh(new THREE.TorusGeometry(26.55, 0.08, 6, Math.ceil((96 * len) / (Math.PI * 2)), len), rimMat);
    ledRim.rotation.x = Math.PI / 2;
    ledRim.position.y = 0.42;
    rimG.add(ledRim);
    scene.add(rimG);
  }
  const endPost = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.85 });
  for (const a of ENTRY_A) {
    for (const sgn of [-1, 1]) {
      const b = a + sgn * ENTRY_GAP;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.9, 0.32), endPost);
      post.position.set(Math.cos(b) * 26.5, -0.45, Math.sin(b) * 26.5);
      post.rotation.y = -b;
      scene.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), rimMat);
      cap.position.set(Math.cos(b) * 26.5, 0.52, Math.sin(b) * 26.5);
      cap.rotation.y = -b;
      scene.add(cap);
    }
  }

  // ---------- stands: stepped rows of seats with aisles ----------
  const tiers = STAND_TIERS;
  const rowsPer = ROWS_PER_TIER;
  const rowW = STAND_ROW_SPACING;
  const rIn = standTierInnerRadius;
  const rowInner = standRowInnerRadius;
  const rowH = standRowHeight;
  // the LOWER bowl (tiers 0–1) is built in two arcs: the entrance tunnels (buildEntrance) pass through the gaps
  // between them. The UPPER bowl (tiers 2–3) is one full ring behind the tunnel housings.
  const LOWER = 2;
  const lower: THREE.Vector2[] = [new THREE.Vector2(rIn(0), -1.4)];
  const upper: THREE.Vector2[] = [];
  for (let k = 0; k < tiers; k++) {
    for (let r = 0; r < rowsPer; r++) {
      (k < LOWER ? lower : upper).push(new THREE.Vector2(rowInner(k, r), rowH(k, r)), new THREE.Vector2(rowInner(k, r) + rowW, rowH(k, r)));
    }
  }
  upper.unshift(lower[lower.length - 1].clone());
  upper.push(new THREE.Vector2(rowInner(tiers - 1, rowsPer - 1) + rowW, -1.4));
  const standsMat = new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.9, metalness: 0.25, side: THREE.DoubleSide });
  const STAND_GAP = 0.17; // half-angle leaves a clean ~9.5 m opening for the widened ring-walk portals at r = 28
  for (const [a0, a1] of [
    [ENTRY_A[0] + STAND_GAP, ENTRY_A[1] - STAND_GAP],
    [ENTRY_A[1] + STAND_GAP, ENTRY_A[0] + Math.PI * 2 - STAND_GAP],
  ]) {
    const len = a1 - a0;
    // LatheGeometry: x = r·sin φ, z = r·cos φ → φ = π/2 − a
    const stands = new THREE.Mesh(new THREE.LatheGeometry(lower, Math.ceil((96 * len) / (Math.PI * 2)), Math.PI / 2 - a1, len), standsMat);
    stands.receiveShadow = true;
    scene.add(stands);
  }
  const standsUp = new THREE.Mesh(new THREE.LatheGeometry(upper, 96), standsMat);
  standsUp.receiveShadow = true;
  scene.add(standsUp);

  // ---------- ENTRANCE WALKWAYS (the ring walk) ----------
  // Two runways, one per corner, each cut into the lower bowl at an aisle: a tunnel gate with a lit portal and
  // floodlights, a flat lit runway with crowd barriers and chevrons pointing at the ring, and a LAUNCH WEDGE at the
  // end. The runway does NOT join the ring: it stops short of the apron, and the machines take off from the wedge,
  // flip over the ropes and land on the canvas (see Game.ts RING WALK).
  // Local frame: +z points OUT from the ring down the aisle, y = 0 is the hall floor (-1.4 world).
  const entrances: { g: THREE.Group; out: THREE.Vector2 }[] = [];
  const buildEntrance = (ang: number, hex: number) => {
    const g = new THREE.Group();
    g.position.y = -1.4;
    g.rotation.y = Math.atan2(Math.cos(ang), Math.sin(ang));
    scene.add(g);
    entrances.push({ g, out: new THREE.Vector2(Math.cos(ang), Math.sin(ang)) });
    const col = new THREE.Color(hex);
    const deck = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.42, metalness: 0.7, emissive: col.clone().multiplyScalar(0.05) });
    const carpet = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.55), roughness: 0.6, metalness: 0.2, emissive: col.clone().multiplyScalar(0.42) });
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x070910, roughness: 0.9, metalness: 0.2 });
    const led = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.95) });
    const ledW = new THREE.MeshBasicMaterial({ color: 0xe8f4ff });
    const put = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      o.receiveShadow = true;
      o.castShadow = m !== led && m !== ledW;
      g.add(o);
      return o;
    };
    const W = 7.2; // a wider, balanced ring-walk with clear space for the entrance rails
    // flat runway from the gate to the foot of the wedge
    const Z0 = 23.5; // foot of the wedge
    const Z1 = 19.8; // the lip of the wedge — the take-off point, a clear 3.5 m short of the ring platform
    const rise = 0.5;
    const flatL = 35 - Z0;
    const flatZ = (35 + Z0) / 2;
    put(new THREE.BoxGeometry(W, 0.14, flatL), deck, 0, 0.07, flatZ);
    // the launch wedge: a solid steel ramp that climbs 0.5 m to a sharp lip
    const wedge = new THREE.Shape();
    wedge.moveTo(-Z0, 0);
    wedge.lineTo(-Z1, rise);
    wedge.lineTo(-Z1, 0);
    wedge.closePath();
    const wg = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: W, bevelEnabled: false }), deck);
    wg.rotation.y = Math.PI / 2; // shape x → −z, extrusion → +x
    wg.position.x = -W / 2;
    wg.castShadow = false;
    wg.receiveShadow = true;
    g.add(wg);
    const slope = Math.atan2(rise, Z0 - Z1);
    const SL = Math.hypot(rise, Z0 - Z1);
    const SZ = (Z0 + Z1) / 2;
    // the team-colour carpet down the middle of the runway and up the wedge
    put(new THREE.BoxGeometry(W * 0.5, 0.02, flatL), carpet, 0, 0.15, flatZ);
    put(new THREE.BoxGeometry(W * 0.5, 0.02, SL), carpet, 0, rise / 2 + 0.02, SZ, slope, 0, 0);
    // One continuous centre guide makes the widened path read as a clean, intentional entrance lane.
    put(new THREE.BoxGeometry(0.08, 0.025, flatL), ledW, 0, 0.165, flatZ);
    put(new THREE.BoxGeometry(0.08, 0.025, SL), ledW, 0, rise / 2 + 0.032, SZ, slope, 0, 0);
    // LED edge strips the whole way and a bright white lip on the wedge
    for (const sx of [-1, 1]) {
      put(new THREE.BoxGeometry(0.14, 0.18, flatL), led, sx * (W / 2 - 0.1), 0.18, flatZ);
      put(new THREE.BoxGeometry(0.14, 0.18, SL), led, sx * (W / 2 - 0.1), rise / 2 + 0.1, SZ, slope, 0, 0);
    }
    put(new THREE.BoxGeometry(W, 0.08, 0.22), ledW, 0, rise + 0.04, Z1 + 0.1);
    put(new THREE.PlaneGeometry(W, rise - 0.08), led, 0, rise / 2, Z1 - 0.01, 0, Math.PI, 0); // the lit face of the lip, toward the ring
    put(new THREE.BoxGeometry(W, 0.06, 0.2), ledW, 0, 0.16, Z0);
    // runway lights: white LED studs down both edges of the carpet
    for (let z = 33.5; z > Z1 + 0.4; z -= 1.1) {
      const y0 = z >= Z0 ? 0 : (rise * (Z0 - z)) / (Z0 - Z1);
      for (const sx of [-1, 1]) put(new THREE.SphereGeometry(0.07, 8, 6), ledW, sx * (W * 0.25 + 0.12), y0 + 0.17, z);
    }
    // chevrons on the deck pointing at the ring
    for (let z = 33; z > Z0 + 0.5; z -= 1.7) {
      put(new THREE.BoxGeometry(0.14, 0.03, 1.5), led, -0.55, 0.16, z, 0, -0.65, 0);
      put(new THREE.BoxGeometry(0.14, 0.03, 1.5), led, 0.55, 0.16, z, 0, 0.65, 0);
    }
    // crowd barriers both sides of the flat runway: posts + a double rail + a light on every post
    for (let z = Z0 + 0.5; z <= 34; z += 2.4) {
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + 0.35);
        put(new THREE.CylinderGeometry(0.06, 0.07, 1.15, 10), steel, x, 0.57, z);
        put(new THREE.SphereGeometry(0.11, 12, 8), led, x, 1.2, z);
      }
    }
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 0.35);
      put(new THREE.BoxGeometry(0.06, 0.06, flatL - 1), steel, x, 1.05, flatZ + 0.5);
      put(new THREE.BoxGeometry(0.06, 0.06, flatL - 1), steel, x, 0.65, flatZ + 0.5);
    }
    // the tunnel gate: a tunnel housing through the lower bowl (dark inside, steel-trimmed outside with a lit roof
    // edge), a lit portal frame, a sign and two floodlights
    put(new THREE.BoxGeometry(W + 1.4, 8.6, 10), dark, 0, 4.3, 39.5);
    put(new THREE.BoxGeometry(W + 1.0, 0.1, 9), dark, 0, 0.05, 39);
    put(new THREE.BoxGeometry(W + 2.0, 0.3, 10.4), steel, 0, 8.75, 39.7); // the roof slab
    for (const sx of [-1, 1]) {
      put(new THREE.BoxGeometry(0.3, 8.6, 10.2), steel, sx * (W / 2 + 0.85), 4.3, 39.6); // side skins
      put(new THREE.BoxGeometry(0.12, 0.12, 10.2), led, sx * (W / 2 + 1.0), 8.95, 39.6); // lit roof edges
    }
    put(new THREE.BoxGeometry(W + 2.0, 0.12, 0.12), led, 0, 8.95, 44.8);
    for (const sx of [-1, 1]) put(new THREE.BoxGeometry(0.2, 2.7, 2.8), steel, sx * (W / 2 + 1.0), 1.35, 33.2); // caps on the cut front row
    for (const sx of [-1, 1]) {
      put(new THREE.BoxGeometry(1.1, 9.4, 1.1), steel, sx * (W / 2 + 1.1), 4.7, 34.5);
      put(new THREE.BoxGeometry(0.16, 8.6, 0.16), led, sx * (W / 2 + 0.55), 4.3, 34.0);
      put(new THREE.BoxGeometry(0.16, 8.6, 0.16), led, sx * (W / 2 + 0.55), 4.3, 35.0);
    }
    put(new THREE.BoxGeometry(W + 3.3, 1.5, 1.2), steel, 0, 10.1, 34.5);
    put(new THREE.BoxGeometry(W + 1.2, 0.16, 0.16), led, 0, 9.3, 34.0);
    const sign = new THREE.MeshBasicMaterial({ map: entranceSignTexture(hex), side: THREE.DoubleSide, toneMapped: false });
    put(new THREE.PlaneGeometry(W + 0.6, 1.0), sign, 0, 10.1, 33.85, 0, Math.PI, 0); // readable from the ring-walk approach
    for (const sx of [-1, 1]) {
      // floodlights on the pillars, aimed down the runway, with a soft visible beam
      const lx = sx * (W / 2 + 1.1);
      put(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 16), steel, lx, 9.1, 33.6, Math.PI / 2 + 0.55, 0, 0);
      put(new THREE.CircleGeometry(0.38, 16), ledW, lx, 9.1 - Math.sin(0.55) * 0.26, 33.6 - Math.cos(0.55) * 0.26, -Math.PI / 2 - 0.55 + Math.PI, 0, 0);
      const lightAt = new THREE.Vector3(lx, 9.1, 33.6);
      const hitAt = new THREE.Vector3(lx - sx * 1.6, 0.2, 21.5);
      const beamLen = lightAt.distanceTo(hitAt);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, beamLen, 24, 1, true).rotateX(Math.PI / 2), // apex on +z
        new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), 0.6), transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.position.copy(lightAt).add(hitAt).multiplyScalar(0.5);
      beam.renderOrder = 3;
      g.add(beam);
      g.updateMatrixWorld(true);
      beam.lookAt(lightAt.clone().applyMatrix4(g.matrixWorld));
    }
  };
  buildEntrance(ENTRY_A[0], 0x2f7cff); // the blue corner's aisle
  buildEntrance(ENTRY_A[1], 0xff3b4a); // the red corner's aisle

  // seats on a regular grid; a few empty ones; 6 aisles
  const spots: Spot[] = [];
  const AISLE = Math.PI / 3;
  for (let k = 0; k < tiers; k++) {
    for (let r = 0; r < rowsPer; r++) {
      const rs = rowInner(k, r) + rowW * 0.5;
      // Distance LOD: Near tiers stay dense (1.25m spacing), distant upper tiers have 1.85m spacing
      const seatSpacing = k < 2 ? 1.25 : 1.85;
      const n = Math.floor((Math.PI * 2 * rs) / seatSpacing);
      const off = r * 0.5 + k * 0.3;
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * Math.PI * 2;
        const m = (((a - 0.2) % AISLE) + AISLE) % AISLE;
        const dAisle = Math.min(m, AISLE - m) * rs;
        if (dAisle < 1.3) continue; // aisle
        // the two entrance tunnels cut a wider hole through the lower bowl
        const dEntry = Math.min(...ENTRY_A.map((ea) => Math.abs(Math.atan2(Math.sin(a - ea), Math.cos(a - ea))))) * rs;
        if (k < 2 && dEntry < 5.4) continue;
        const x = Math.cos(a) * rs;
        const z = Math.sin(a) * rs;
        spots.push({ x, y: rowH(k, r), z, yaw: Math.atan2(-x, -z), empty: Math.random() < 0.14 });
      }
    }
  }
  const crowd = buildCrowd(scene, spots, 240);
  // corner pyro towers, TV cameras, stand lights, wall fins, flags and the OFFICIAL JUDGES' desks
  const props = buildProps(scene);
  const show = buildShow(scene, ENTRY_A);
  const ORIGIN = new THREE.Vector3(0, 3.4, 0);

  // ---------- the hall: walls, roof, WRC banners ----------
  const wallTex = wallTexture();
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.repeat.set(-1, 1);
  // Dark atmospheric stadium arena wall: avoids washing out background to pale white
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 44, 96, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, color: new THREE.Color(0.18, 0.22, 0.32) }));
  wall.position.y = 20.6;
  scene.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(64, 14, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x090b12, side: THREE.BackSide }));
  roof.position.y = 49.6;
  scene.add(roof);
  const roofRim = new THREE.Mesh(new THREE.TorusGeometry(62.5, 0.5, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9db6ff).multiplyScalar(0.42) }));
  roofRim.rotation.x = Math.PI / 2;
  roofRim.position.y = 42;
  scene.add(roofRim);

  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture(), color: new THREE.Color(0.93, 0.93, 0.93) });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.52;
    const x = Math.cos(a) * 63.3;
    const z = Math.sin(a) * 63.3;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), bannerMat);
    b.position.set(x, 19, z);
    b.rotation.y = Math.atan2(-x, -z);
    scene.add(b);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(31, 16), new THREE.MeshBasicMaterial({ color: 0x05060a }));
    frame.position.set(x * 0.9995, 19, z * 0.9995);
    frame.rotation.y = b.rotation.y;
    scene.add(frame);
  }

  // ---------- truss + beams ----------
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.9, roughness: 0.4 });
  const truss = new THREE.Mesh(new THREE.TorusGeometry(18, 0.45, 8, 56), trussMat);
  truss.rotation.x = Math.PI / 2;
  truss.position.y = 27;
  scene.add(truss);
  // outer light rig with 40 lamps
  const truss2 = new THREE.Mesh(new THREE.TorusGeometry(40, 0.5, 8, 96), trussMat);
  truss2.rotation.x = Math.PI / 2;
  truss2.position.y = 34;
  scene.add(truss2);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdbe6ff).multiplyScalar(1.26) }), 40);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    dm.position.set(Math.cos(a) * 40, 33.2, Math.sin(a) * 40);
    dm.updateMatrix();
    lamps.setMatrixAt(i, dm.matrix);
  }
  scene.add(lamps);

  // the broadcast light rig: eight inner followspots, eight colour movers and two blue main-event shafts
  const spotRig = buildSpotRig(scene);

  // ---------- jumbotron ----------
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 1024;
  sCanvas.height = 576;
  const sctx = sCanvas.getContext('2d')!;
  const sTex = new THREE.CanvasTexture(sCanvas);
  sTex.colorSpace = THREE.SRGBColorSpace;
  const setScreen = (left: string, right: string, sub: string, lc: string, rc: string) => {
    const g = sctx;
    const grd = g.createLinearGradient(0, 0, 1024, 0);
    grd.addColorStop(0, '#0a1230');
    grd.addColorStop(0.5, '#090a12');
    grd.addColorStop(1, '#2a0a10');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 576);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 576; y += 6) g.fillRect(0, y, 1024, 2);
    wrcEmblem(g, 512, 78, 52);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(86);
    g.fillStyle = lc;
    g.fillText(left.toUpperCase(), 270, 220);
    g.fillStyle = rc;
    g.fillText(right.toUpperCase(), 754, 220);
    g.fillStyle = '#ffffff';
    g.font = font(120);
    g.fillText('VS', 512, 320);
    g.font = '700 44px Arial, sans-serif';
    g.fillStyle = '#ffb030';
    g.fillText(sub, 512, 462);
    g.fillStyle = '#ffffff';
    g.font = '700 30px Arial, sans-serif';
    g.fillText('WRC · WORLD ROBOT CHAMPIONSHIP', 512, 522);
    sTex.needsUpdate = true;
  };
  setScreen('Atlas', 'Scrap-9', 'ROUND 1', '#4da3ff', '#ff6a4d');
  // A proper suspended, eight-sided jumbo-tron: much larger than the old cube and visible around the full bowl.
  // Every face uses the same live matchup canvas, so names / round state stay readable from any seating section.
  const jumbo = new THREE.Group();
  jumbo.position.y = 22;
  const JUMBO_SIDES = 8;
  const JUMBO_H = 5.4;
  const JUMBO_FACE_R = 11.8;
  const JUMBO_SHELL_R = JUMBO_FACE_R / Math.cos(Math.PI / JUMBO_SIDES);
  const JUMBO_FACE_W = 2 * JUMBO_FACE_R * Math.tan(Math.PI / JUMBO_SIDES) * 0.96;
  const tronFrame = new THREE.MeshStandardMaterial({ color: 0x11151e, metalness: 0.82, roughness: 0.38, side: THREE.DoubleSide });
  const tronEdge = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4b9cff).multiplyScalar(0.9), toneMapped: false });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(JUMBO_SHELL_R, JUMBO_SHELL_R, JUMBO_H, JUMBO_SIDES, 1, true), tronFrame);
  jumbo.add(shell);
  const scrMat = new THREE.MeshBasicMaterial({ map: sTex, color: new THREE.Color(1.02, 1.02, 1.02), side: THREE.DoubleSide, toneMapped: false });
  for (let i = 0; i < JUMBO_SIDES; i++) {
    const a = ((i + 0.5) / JUMBO_SIDES) * Math.PI * 2;
    const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const backing = new THREE.Mesh(new THREE.BoxGeometry(JUMBO_FACE_W + 0.24, JUMBO_H + 0.16, 0.3), tronFrame);
    backing.position.copy(radial).multiplyScalar(JUMBO_FACE_R);
    backing.rotation.y = a;
    jumbo.add(backing);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(JUMBO_FACE_W, JUMBO_H - 0.2), scrMat);
    screen.position.copy(radial).multiplyScalar(JUMBO_FACE_R + 0.17);
    screen.rotation.y = a;
    jumbo.add(screen);
  }
  // Heavy top/bottom rings and restrained blue edge lighting keep the drum crisp without washing out the screens.
  for (const y of [-JUMBO_H / 2, JUMBO_H / 2]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(JUMBO_SHELL_R + 0.22, JUMBO_SHELL_R + 0.22, 0.24, JUMBO_SIDES), tronFrame);
    rim.position.y = y;
    jumbo.add(rim);
    const led = new THREE.Mesh(new THREE.CylinderGeometry(JUMBO_SHELL_R + 0.36, JUMBO_SHELL_R + 0.36, 0.07, JUMBO_SIDES), tronEdge);
    led.position.y = y + (y > 0 ? -0.13 : 0.13);
    jumbo.add(led);
  }
  // Four diagonal hangers tie the jumbo-tron back to the inner roof truss.
  const hangerMat = new THREE.MeshStandardMaterial({ color: 0x373d49, metalness: 0.88, roughness: 0.34 });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const start = new THREE.Vector3(Math.sin(a) * (JUMBO_SHELL_R - 0.25), JUMBO_H / 2, Math.cos(a) * (JUMBO_SHELL_R - 0.25));
    const end = new THREE.Vector3(Math.sin(a) * 17.3, 5.1, Math.cos(a) * 17.3);
    const dir = end.clone().sub(start);
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, dir.length(), 8), hangerMat);
    hanger.position.copy(start).add(end).multiplyScalar(0.5);
    hanger.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    jumbo.add(hanger);
  }
  scene.add(jumbo);

  let smoothHype = 0;
  let frame = 0;
  let kick = 0; // the impact kick on the ring key
  const strobe = (k: number) => {
    kick = Math.max(kick, Math.min(1, k));
    spotRig.strobe(k);
  };
  const update = (t: number, dt: number, hype: number, focus?: THREE.Vector3, cam?: THREE.Camera) => {
    if (cam) currentCamera = cam;
    smoothHype += (hype - smoothHype) * (1 - Math.exp(-3 * dt));
    kick = Math.max(0, kick - dt * 5);
    updateRopes(dt);
    updateRing(dt);
    frame++;
    // Pass camera for behind-the-camera frustum culling (sliced across 4 frames for 60 FPS headroom)
    crowd.update(t, smoothHype, frame % 4, 4, currentCamera);
    const foc = focus ?? ORIGIN;
    if (frame % 2 === 0) {
      props.update(t, dt * 2, smoothHype, foc, currentCamera);
    }
    rimSide.intensity = 1.0 + smoothHype * 0.2;
    // Balanced canvas lighting: cahaya pas dan cocok agar gambar & warna matras tampak jelas dan tajam
    ringKey.intensity = 3.8 + smoothHype * 0.4 + kick * 0.25;
    ringFill.intensity = 1.8 + smoothHype * 0.25;
    ledTex.offset.x = (ledTex.offset.x + dt * 0.012) % 1;
    spotRig.update(t, dt, smoothHype, foc);
    show.update(t, dt, smoothHype);
    // the apron LEDs breathe smoothly with the crowd (no harsh on/off cutoff)
    const ap = 0.82 + Math.sin(t * 1.2) * 0.06 + smoothHype * 0.12;
    neonRed.color.setHex(0xff4350).multiplyScalar(ap);
    neonBlue.color.setHex(0x5f9bff).multiplyScalar(ap);

    // Update corner pads elastic spring compression
    for (let i = 0; i < 4; i++) {
      const sp = padSprings[i];
      sp.joltVel += (-sp.jolt * 26 - sp.joltVel * 8) * dt;
      sp.jolt += sp.joltVel * dt;
      const comp = THREE.MathUtils.clamp(1 - sp.jolt * 0.16, 0.75, 1.1);
      sp.group.scale.set(comp, 1, 1 - sp.jolt * 0.1);
    }

    // Update concert flame particle physics & dynamic flash pointlight (AtmosphereEffects)
    if (cam) currentCamera = cam;
    if (currentCamera) {
      atmosphere.update(dt, currentCamera);
    }

    // Update hardware nozzle pilot lights (blue base + flickering amber flame tongue)
    for (let i = 0; i < nozzleEmitters.length; i++) {
      const nz = nozzleEmitters[i];
      if (nz.placement !== currentPyroPlacement) {
        nz.group.visible = false;
        continue;
      }
      nz.group.visible = true;
      nz.pilotGroup.visible = true;
      const pilotH = 0.22 + Math.sin(t * 16 + nz.cornerIdx) * 0.06;
      nz.pilotGroup.scale.set(1, pilotH * 4.2, 1);
    }
  };

  return {
    update,
    setScreen,
    setFaces: show.setFaces,
    ropeHit,
    ropePress,
    ropeSpread,
    canvasSlam,
    setRingScale,
    setMirrors,
    keyLight: key,
    rimRed,
    rimBlue,
    towers: props.towers,
    cornerNozzles: cornerNozzlePositions,
    fireCornerPyro,
    setPyroPlacement,
    getPyroPlacement,
    triggerCornerPad,
    track: spotRig.track,
    strobe,
    dispose: () => atmosphere.dispose(),
  };
}
