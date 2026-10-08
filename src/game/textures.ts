import * as THREE from 'three';

/**
 * Procedural PBR Texture Generator for Robot Chassis & Armour.
 * Generated purely on CPU canvas once at launch, zero external network downloads,
 * 100% lightweight and instant, shared across all fighters.
 */

let armourNormalTex: THREE.CanvasTexture | null = null;
let armourRoughTex: THREE.CanvasTexture | null = null;
let steelNormalTex: THREE.CanvasTexture | null = null;
let carbonTex: THREE.CanvasTexture | null = null;

/**
 * High-tech brushed titanium & micro-panel normal map:
 * Gives robot armour realistic metallic sheen, subtle horizontal micro-brush lines,
 * and high-frequency light reflection.
 */
export function getArmourNormalMap(): THREE.CanvasTexture {
  if (armourNormalTex) return armourNormalTex;
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  // Generate subtle brushed directional grain + micro-noise normal map
  // Flat normal in tangent space = (128, 128, 255)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // High-frequency horizontal brushed streaks
      const brush = (Math.sin(y * 1.8) * 0.5 + Math.sin(y * 4.3) * 0.3 + (Math.random() - 0.5) * 0.4) * 18;
      // Micro-grain in X
      const grainX = (Math.random() - 0.5) * 12;
      const grainY = (Math.random() - 0.5) * 8;

      // Hexagonal micro-seam hint every 64 pixels
      const seamX = Math.abs((x % 64) - 32) < 2 ? 14 : 0;
      const seamY = Math.abs((y % 64) - 32) < 2 ? 14 : 0;

      const nx = Math.min(255, Math.max(0, 128 + grainX + seamX));
      const ny = Math.min(255, Math.max(0, 128 + brush + grainY + seamY));
      const nz = 255;

      data[idx] = nx;
      data[idx + 1] = ny;
      data[idx + 2] = nz;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  armourNormalTex = tex;
  return tex;
}

/**
 * Brushed Metal Roughness map:
 * Varies surface gloss so lights catch edges and brushed grain naturally
 * instead of having a flat plastic highlight.
 */
export function getArmourRoughnessMap(): THREE.CanvasTexture {
  if (armourRoughTex) return armourRoughTex;
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Brushed variation (darker = more specular gloss, lighter = more matte)
      const streak = Math.sin(y * 0.8) * 20 + Math.sin(y * 3.5) * 15;
      const noise = (Math.random() - 0.5) * 25;
      const edge = ((x % 64 < 3 || x % 64 > 61) || (y % 64 < 3 || y % 64 > 61)) ? -35 : 0;
      const val = Math.min(255, Math.max(0, 140 + streak + noise + edge));

      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  armourRoughTex = tex;
  return tex;
}

/**
 * Heavy Industrial Machined Steel Normal Map:
 * Used for pistons, knuckles, joints and internal structural chassis.
 */
export function getSteelNormalMap(): THREE.CanvasTexture {
  if (steelNormalTex) return steelNormalTex;
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Machined concentric / parallel lathe turnings
      const lathe = Math.sin(x * 12.0) * 14;
      const noise = (Math.random() - 0.5) * 10;
      data[idx] = Math.min(255, Math.max(0, 128 + lathe + noise));
      data[idx + 1] = Math.min(255, Math.max(0, 128 + noise));
      data[idx + 2] = 250;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 4;
  steelNormalTex = tex;
  return tex;
}

/**
 * 2x2 Twill Carbon Fiber Weave Pattern:
 * Used for under-suit and secondary joints.
 */
export function getCarbonFiberTexture(): THREE.CanvasTexture {
  if (carbonTex) return carbonTex;
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, S, S);

  const cellSize = 16;
  for (let y = 0; y < S; y += cellSize) {
    for (let x = 0; x < S; x += cellSize) {
      const isAlt = ((x / cellSize) + (y / cellSize)) % 2 === 0;
      ctx.fillStyle = isAlt ? '#252a36' : '#14161d';
      ctx.fillRect(x, y, cellSize, cellSize);

      // Weave thread highlight line
      ctx.strokeStyle = isAlt ? '#353c4d' : '#0e1015';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isAlt) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y + cellSize);
      } else {
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x, y + cellSize);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = 4;
  carbonTex = tex;
  return tex;
}
