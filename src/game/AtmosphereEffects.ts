import * as THREE from 'three';
import type { PyroPlacement } from './arena';

/**
 * 4-layer radial gradient procedural canvas texture:
 * Inti tengah: Putih membara (#ffffff)
 * Lapisan tengah: Oranye menyala (#f59e0b)
 * Lapisan luar: Merah membara (#ef4444)
 * Tepi terluar: Transparan penuh
 */
export function createPyroFlameTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const radius = size / 2;

  const grad = ctx.createRadialGradient(center, center, 0, center, center, radius);
  grad.addColorStop(0.0, '#ffffff'); // Inti tengah: Putih membara
  grad.addColorStop(0.2, '#ffffff');
  grad.addColorStop(0.48, '#f59e0b'); // Lapisan tengah: Oranye menyala
  grad.addColorStop(0.78, '#ef4444'); // Lapisan luar: Merah membara
  grad.addColorStop(1.0, 'rgba(239, 68, 68, 0)'); // Tepi terluar: Transparan penuh

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

interface FlameParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseSize: number;
  baseAlpha: number;
  rot: number;
  rotVel: number;
}

export class AtmosphereEffects {
  private readonly scene: THREE.Scene;
  private readonly maxParticles = 640;
  private readonly particles: FlameParticle[] = [];
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly texture: THREE.CanvasTexture;
  private readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;

  // Kilatan Cahaya Dinamis Arena (Dynamic Pyro Flash PointLight)
  readonly flashLight: THREE.PointLight;

  // Sustained burst emission timers
  private burstTimer = 0;
  private burstLevel = 1.0;
  private burstSpawnInterval = 0.024;
  private burstSpawnAcc = 0;
  private activeNozzlePositions: THREE.Vector3[] = [];
  private currentPlacement: PyroPlacement = 'ring_posts';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.texture = createPyroFlameTexture();

    // Kilatan Cahaya Dinamis Arena: jangkauan 25 meter, rona oranye keemasan 0xff7700
    this.flashLight = new THREE.PointLight(0xff7700, 0, 25, 1.25);
    this.flashLight.position.set(0, 7.5, 0);
    this.flashLight.visible = false;
    scene.add(this.flashLight);

    // Initialize particles array
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.0,
        baseSize: 1.0,
        baseAlpha: 0.9,
        rot: 0,
        rotVel: 0,
      });
    }

    // Billboard quad geometry
    const N = this.maxParticles;
    this.positions = new Float32Array(N * 4 * 3);
    const uvs = new Float32Array(N * 4 * 2);
    this.colors = new Float32Array(N * 4 * 4);
    const indices: number[] = [];

    for (let i = 0; i < N; i++) {
      const v = i * 4;
      // Quad UVs
      uvs[i * 8 + 0] = 0;
      uvs[i * 8 + 1] = 0;
      uvs[i * 8 + 2] = 1;
      uvs[i * 8 + 3] = 0;
      uvs[i * 8 + 4] = 1;
      uvs[i * 8 + 5] = 1;
      uvs[i * 8 + 6] = 0;
      uvs[i * 8 + 7] = 1;

      // Two triangles per quad
      indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setIndex(indices);
    this.geometry.setDrawRange(0, 0);

    // Additive Blending: partikel saling bertumpuk menghasilkan pendaran fotometrik super terang
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setPlacement(placement: PyroPlacement) {
    this.currentPlacement = placement;
  }

  getPlacement(): PyroPlacement {
    return this.currentPlacement;
  }

  /**
   * Fire concert stage flame jets from active nozzle positions
   * @param nozzles 4 positions where nozzles are mounted
   * @param level burst intensity (0..1.2)
   * @param duration burst duration in seconds
   * @param mode 'puff' for quick countdown snaps, 'blast' for roaring stadium column
   */
  fire(nozzles: THREE.Vector3[], level = 1.0, duration = 1.4, mode: 'puff' | 'blast' = 'blast') {
    const lvl = Math.max(0.3, Math.min(1.2, level));
    this.activeNozzlePositions = nozzles.map((n) => n.clone());
    this.burstLevel = lvl;

    // 2. Kilatan Cahaya Dinamis Arena: lonjakan seketika ke 8.0x (oranye keemasan)
    const flashTarget = Math.min(9.5, 8.0 * (lvl / 0.8));
    this.flashLight.intensity = Math.max(this.flashLight.intensity, flashTarget);
    this.flashLight.visible = true;

    if (mode === 'puff') {
      // Instant sharp cluster of particles per nozzle
      this.spawnParticlesCluster(nozzles, lvl, 14);
      this.burstTimer = Math.min(duration, 0.22);
    } else {
      // Sustained blast: initial explosive burst + continuous streaming columns
      this.spawnParticlesCluster(nozzles, lvl, 22);
      this.burstTimer = duration;
      this.burstSpawnAcc = 0;
    }
  }

  private spawnParticlesCluster(nozzles: THREE.Vector3[], level: number, countPerNozzle: number) {
    for (const pos of nozzles) {
      for (let c = 0; c < countPerNozzle; c++) {
        this.spawnOneParticle(pos, level);
      }
    }
  }

  private spawnOneParticle(pos: THREE.Vector3, level: number) {
    // Find first inactive particle
    let p: FlameParticle | null = null;
    for (let i = 0; i < this.maxParticles; i++) {
      if (!this.particles[i].active) {
        p = this.particles[i];
        break;
      }
    }
    if (!p) return;

    p.active = true;
    // Slight nozzle origin offset
    p.x = pos.x + (Math.random() - 0.5) * 0.35;
    p.y = pos.y + 0.15 + Math.random() * 0.2;
    p.z = pos.z + (Math.random() - 0.5) * 0.35;

    // Dorongan Vertikal (Velocity Y): Disemburkan ke atas dengan kecepatan acak awal 7.0 hingga 15.0 m/s
    const speedYBase = 7.0 + Math.random() * 8.0;
    p.vy = speedYBase * (0.85 + level * 0.25);

    // Dispersi Horizontal (Velocity X & Z): Sebaran turbulensi gas acak ke segala arah sebesar ±2.2 m/s
    p.vx = (Math.random() - 0.5) * 4.4;
    p.vz = (Math.random() - 0.5) * 4.4;

    // Partikel memiliki umur (lifetime) acak antara 0.6 – 1.1 detik
    p.life = 0;
    p.maxLife = 0.6 + Math.random() * 0.5;

    // Base size & alpha
    p.baseSize = 0.9 + Math.random() * 0.5;
    p.baseAlpha = 0.85 + Math.random() * 0.15;
    p.rot = Math.random() * Math.PI * 2;
    p.rotVel = (Math.random() - 0.5) * 3.5;
  }

  /**
   * Per-frame physics calculation and GPU buffer update
   */
  update(dt: number, camera: THREE.Camera) {
    // Clamp frame delta to avoid physics explosion on tab suspend
    const delta = Math.min(0.066, Math.max(0.001, dt));

    // 2. Kilatan Cahaya Dinamis Arena: meredup secara eksponensial cepat (intensity -= delta * 12.0)
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - delta * 12.0);
      if (this.flashLight.intensity <= 0.001) {
        this.flashLight.visible = false;
      }
    }

    // Sustained streaming emitter
    if (this.burstTimer > 0 && this.activeNozzlePositions.length > 0) {
      this.burstTimer -= delta;
      this.burstSpawnAcc += delta;
      while (this.burstSpawnAcc >= this.burstSpawnInterval) {
        this.burstSpawnAcc -= this.burstSpawnInterval;
        for (const pos of this.activeNozzlePositions) {
          this.spawnOneParticle(pos, this.burstLevel);
        }
      }
    }

    // Camera billboard basis vectors
    const m = camera.matrixWorld.elements;
    const rightX = m[0], rightY = m[1], rightZ = m[2];
    const upX = m[4], upY = m[5], upZ = m[6];

    let activeCount = 0;
    const posArr = this.positions;
    const colArr = this.colors;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      // Gravitasi Nyata (Gravity Vector): kecepatan vertikal dikurangi gravitasi bumi
      // velocity.y -= 9.8 * Δt
      p.vy -= 9.8 * delta;

      // Position update
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Hal ini membuat semburan api melesat kencang di awal, lalu melambat dan mekar di puncaknya sebelum menghilang
      const progress = p.life / p.maxLife; // 0..1
      // Dynamic blooming expansion: grows wider as it climbs and slows at the apex
      const size = p.baseSize * (1.1 + progress * 2.9);
      const halfS = size * 0.5;

      p.rot += p.rotVel * delta;
      const cos = Math.cos(p.rot) * halfS;
      const sin = Math.sin(p.rot) * halfS;

      const rx = rightX * cos + upX * sin;
      const ry = rightY * cos + upY * sin;
      const rz = rightZ * cos + upZ * sin;

      const ux = -rightX * sin + upX * cos;
      const uy = -rightY * sin + upY * cos;
      const uz = -rightZ * sin + upZ * cos;

      const vBase = activeCount * 4;
      const pIdx = vBase * 3;
      const cIdx = vBase * 4;

      // Quad 4 vertices around (p.x, p.y, p.z)
      // v0: -rx - ux
      posArr[pIdx + 0] = p.x - rx - ux;
      posArr[pIdx + 1] = p.y - ry - uy;
      posArr[pIdx + 2] = p.z - rz - uz;

      // v1: +rx - ux
      posArr[pIdx + 3] = p.x + rx - ux;
      posArr[pIdx + 4] = p.y + ry - uy;
      posArr[pIdx + 5] = p.z + rz - uz;

      // v2: +rx + ux
      posArr[pIdx + 6] = p.x + rx + ux;
      posArr[pIdx + 7] = p.y + ry + uy;
      posArr[pIdx + 8] = p.z + rz + uz;

      // v3: -rx + ux
      posArr[pIdx + 9] = p.x - rx + ux;
      posArr[pIdx + 10] = p.y - ry + uy;
      posArr[pIdx + 11] = p.z - rz + uz;

      // Color & alpha photometric ramp
      const alpha = Math.max(0, 1.0 - progress * progress) * p.baseAlpha;
      // Incandescent flame color tint (white-gold to blazing orange)
      const r = 1.0;
      const g = Math.max(0.55, 1.0 - progress * 0.45);
      const b = Math.max(0.18, 0.95 - progress * 0.75);

      for (let vert = 0; vert < 4; vert++) {
        const offset = cIdx + vert * 4;
        colArr[offset + 0] = r;
        colArr[offset + 1] = g;
        colArr[offset + 2] = b;
        colArr[offset + 3] = alpha;
      }

      activeCount++;
    }

    if (activeCount > 0) {
      this.mesh.visible = true;
      this.geometry.setDrawRange(0, activeCount * 6);
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    } else {
      this.mesh.visible = false;
      this.geometry.setDrawRange(0, 0);
    }
  }

  /**
   * Clean GPU memory management (Auto Garbage Collection):
   * Disposes BufferGeometry, Material, Texture from VRAM to keep FPS at rock-solid 60 without leaks.
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.scene.remove(this.mesh);
    this.scene.remove(this.flashLight);
    this.flashLight.dispose();
    for (const p of this.particles) {
      p.active = false;
    }
  }
}
