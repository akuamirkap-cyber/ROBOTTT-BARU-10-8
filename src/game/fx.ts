import * as THREE from 'three';
import { SparkStreaks } from './sparks';

function glowTexture(inner = 0.0) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, inner * 32, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  // 4-point high-contrast anime/AAA fighting-game impact starburst spikes
  g.save();
  g.translate(64, 64);
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 4);
    const sg = g.createLinearGradient(-62, 0, 62, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.38, 'rgba(255,255,255,0.75)');
    sg.addColorStop(0.5, 'rgba(255,255,255,1)');
    sg.addColorStop(0.62, 'rgba(255,255,255,0.75)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.ellipse(0, 0, i % 2 === 0 ? 62 : 42, i % 2 === 0 ? 3.5 : 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return new THREE.CanvasTexture(c);
}

export class Effects {
  private N = 700;
  private pos: Float32Array;
  private col: Float32Array;
  private base: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private head = 0;
  private points: THREE.Points;
  private rings: { m: THREE.Mesh; age: number; life: number; max: number; alpha?: number }[] = [];
  private impactRings: { m: THREE.Mesh; age: number; life: number; max: number; alpha?: number }[] = [];
  private flashes: { s: THREE.Sprite; age: number; life: number; size: number }[] = [];
  private starFlares: { s: THREE.Sprite; age: number; life: number; size: number }[] = [];
  private light: THREE.PointLight;
  private lightPow = 0;
  private streaks: SparkStreaks;
  // ---- METAL DEBRIS: armour chips and bolt fragments knocked off by a blow (tumbling instanced solids)
  private readonly SN = 160;
  private shardMesh: THREE.InstancedMesh;
  private sPos = new Float32Array(this.SN * 3);
  private sVel = new Float32Array(this.SN * 3);
  private sRot = new Float32Array(this.SN * 3);
  private sSpin = new Float32Array(this.SN * 3);
  private sLife = new Float32Array(this.SN);
  private sMax = new Float32Array(this.SN).fill(1);
  private sSize = new Float32Array(this.SN).fill(1);
  private sHead = 0;
  private sDummy = new THREE.Object3D();
  private sColor = new THREE.Color();

  private wasPointsActive = false;

  constructor(scene: THREE.Scene) {
    const N = this.N;
    this.pos = new Float32Array(N * 3).fill(-100);
    this.col = new Float32Array(N * 3);
    this.base = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.maxLife = new Float32Array(N).fill(1);
    this.grav = new Float32Array(N).fill(14);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.26,
      map: glowTexture(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.streaks = new SparkStreaks(scene);

    // debris: a chipped slab (box) with a hot, fading edge glow — one instanced draw call for all of them
    const shardGeo = new THREE.BoxGeometry(0.16, 0.05, 0.11);
    const shardMat = new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 0.9, roughness: 0.35, emissive: 0xff8a40, emissiveIntensity: 0 });
    this.shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, this.SN);
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.castShadow = true;
    this.shardMesh.frustumCulled = false;
    this.shardMesh.count = this.SN;
    for (let i = 0; i < this.SN; i++) {
      this.sDummy.position.set(0, -100, 0);
      this.sDummy.scale.setScalar(0.001);
      this.sDummy.updateMatrix();
      this.shardMesh.setMatrixAt(i, this.sDummy.matrix);
      this.shardMesh.setColorAt(i, this.sColor.setHex(0x8e949c));
    }
    scene.add(this.shardMesh);

    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, age: 1, life: 1, max: 1, alpha: 0.26 });
    }
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.76, 1, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.visible = false;
      scene.add(m);
      this.impactRings.push({ m, age: 1, life: 1, max: 1, alpha: 0.28 });
    }
    const tex = glowTexture();
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.flashes.push({ s, age: 1, life: 1, size: 1 });
    }
    const stex = starTexture();
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: stex,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0,
          rotation: Math.random() * Math.PI,
        }),
      );
      s.visible = false;
      scene.add(s);
      this.starFlares.push({ s, age: 1, life: 1, size: 1 });
    }
    this.light = new THREE.PointLight(0xffffff, 0, 16, 1.5);
    scene.add(this.light);
  }

  /**
   * A burst of welding sparks: thin white-hot streaks that cool to orange and red, fly on a gravity arc, bounce on the floor
   * and sometimes pop into a few tiny sparks. Most are fast (long streaks), ~20% drift slowly and glow for longer.
   */
  private weldBurst(p: THREE.Vector3, n: number, speed: number, c: THREE.Color, warm: boolean, dir: THREE.Vector3 | undefined, spread: number, life: number, grav: number) {
    const actualN = Math.min(n, 32);
    for (let k = 0; k < actualN; k++) {
      let vx = (Math.random() * 2 - 1) * spread;
      let vy = (Math.random() * 2 - 1) * spread * 0.8 + 0.3;
      let vz = (Math.random() * 2 - 1) * spread;
      if (dir) {
        vx += dir.x * 1.4;
        vy += dir.y * 1.4;
        vz += dir.z * 1.4;
      }
      const l = Math.hypot(vx, vy, vz) || 1;
      const drift = Math.random() < 0.2;
      const sp = speed * (drift ? 0.3 + Math.random() * 0.3 : 0.25 + Math.pow(Math.random(), 1.6) * 1.15);
      this.streaks.emit(
        p.x,
        p.y,
        p.z,
        (vx / l) * sp,
        (vy / l) * sp,
        (vz / l) * sp,
        life * (0.55 + Math.random() * 0.9) * (drift ? 1.5 : 1),
        0.016 + Math.random() * 0.022,
        grav * 1.25,
        warm,
        c.r,
        c.g,
        c.b,
        !drift && Math.random() < 0.08 ? 0.35 + Math.random() * 0.25 : 0,
      );
    }
  }

  spark(p: THREE.Vector3, n: number, speed: number, color: number, dir?: THREE.Vector3, spread = 1, life = 0.7, grav = 14) {
    const c = new THREE.Color(color);
    // fast, hot-coloured sparks are WELDING SPARKS (streaks); slow, grey ones stay soft dust
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    if (grav >= 8 && (hsl.s > 0.15 || hsl.l > 0.9)) {
      const warm = hsl.s < 0.15 || hsl.h < 0.17 || hsl.h > 0.95;
      this.weldBurst(p, n, speed, c, warm, dir, spread, life, grav);
      return;
    }
    const actualN = Math.min(n, 30);
    for (let k = 0; k < actualN; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.N;
      const rx = Math.random() * 2 - 1;
      const ry = Math.random() * 2 - 1;
      const rz = Math.random() * 2 - 1;
      const sp = speed * (0.35 + Math.random() * 0.9);
      let vx = rx * spread;
      let vy = ry * spread * 0.8 + 0.3;
      let vz = rz * spread;
      if (dir) {
        vx += dir.x * 1.4;
        vy += dir.y * 1.4;
        vz += dir.z * 1.4;
      }
      const l = Math.hypot(vx, vy, vz) || 1;
      this.vel[i * 3] = (vx / l) * sp;
      this.vel[i * 3 + 1] = (vy / l) * sp;
      this.vel[i * 3 + 2] = (vz / l) * sp;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      const bright = 0.8 + Math.random() * 1.0;
      this.base[i * 3] = c.r * bright;
      this.base[i * 3 + 1] = c.g * bright;
      this.base[i * 3 + 2] = c.b * bright;
      this.maxLife[i] = life * (0.5 + Math.random() * 0.8);
      this.life[i] = this.maxLife[i];
      this.grav[i] = grav;
    }
  }

  /**
   * ARMOUR DEBRIS. A heavy blow does not only make sparks: it knocks chips of plating and bolt heads off the
   * armour. They fly out of the impact with the punch, tumble, bounce on the canvas, and lie there for a moment.
   * `color` tints the chips to the armour that was hit; a fraction of them carry a hot glowing edge.
   */
  shards(p: THREE.Vector3, n: number, dir: THREE.Vector3, color = 0x8e949c, speed = 9, scale = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.sHead;
      this.sHead = (this.sHead + 1) % this.SN;
      const i3 = i * 3;
      let vx = (Math.random() * 2 - 1) * 0.9 + dir.x * 1.3;
      let vy = Math.random() * 0.9 + 0.35 + dir.y * 0.6;
      let vz = (Math.random() * 2 - 1) * 0.9 + dir.z * 1.3;
      const l = Math.hypot(vx, vy, vz) || 1;
      const sp = speed * (0.4 + Math.random() * 0.9);
      vx = (vx / l) * sp;
      vy = (vy / l) * sp;
      vz = (vz / l) * sp;
      this.sPos[i3] = p.x + (Math.random() - 0.5) * 0.3;
      this.sPos[i3 + 1] = p.y + (Math.random() - 0.5) * 0.3;
      this.sPos[i3 + 2] = p.z + (Math.random() - 0.5) * 0.3;
      this.sVel[i3] = vx;
      this.sVel[i3 + 1] = vy;
      this.sVel[i3 + 2] = vz;
      this.sRot[i3] = Math.random() * Math.PI * 2;
      this.sRot[i3 + 1] = Math.random() * Math.PI * 2;
      this.sRot[i3 + 2] = Math.random() * Math.PI * 2;
      this.sSpin[i3] = (Math.random() - 0.5) * 24;
      this.sSpin[i3 + 1] = (Math.random() - 0.5) * 24;
      this.sSpin[i3 + 2] = (Math.random() - 0.5) * 24;
      this.sMax[i] = 1.4 + Math.random() * 1.2;
      this.sLife[i] = this.sMax[i];
      this.sSize[i] = scale * (0.5 + Math.random() * 1.1);
      // chips take the colour of the armour they came off, a few are still glowing hot at the break
      const hot = Math.random() < 0.35;
      this.sColor.setHex(color);
      if (hot) this.sColor.lerp(new THREE.Color(0xffb060), 0.75);
      else this.sColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      this.shardMesh.setColorAt(i, this.sColor);
    }
    if (this.shardMesh.instanceColor) this.shardMesh.instanceColor.needsUpdate = true;
  }

  ring(x: number, z: number, color: number, max: number, life = 0.5, y = 0.07, alpha = 0.26) {
    const r = this.rings.find((q) => q.age >= q.life) ?? this.rings[0];
    r.age = 0;
    r.life = life;
    r.max = Math.min(max, 5.5);
    r.alpha = alpha;
    r.m.position.set(x, y, z);
    (r.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.m.visible = true;
  }

  /**
   * 3D Oriented Sonic Shockwave Ring + 4-Point Starburst Impact Flare right at the point of fist contact!
   */
  impactWave(p: THREE.Vector3, dir: THREE.Vector3, color: number, max: number, life = 0.24, alpha = 0.28) {
    const r = this.impactRings.find((q) => q.age >= q.life) ?? this.impactRings[0];
    r.age = 0;
    r.life = life;
    r.max = Math.min(max, 4.6);
    r.alpha = alpha;
    r.m.position.copy(p);
    // Orient ring perpendicular to the punch vector so it bursts outward like a 3D sonic boom halo
    r.m.lookAt(p.x + dir.x, p.y + dir.y * 0.4, p.z + dir.z);
    (r.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.m.visible = true;

    const sf = this.starFlares.find((q) => q.age >= q.life) ?? this.starFlares[0];
    sf.age = 0;
    sf.life = life * 0.65;
    sf.size = Math.min(max * 0.85, 4.2);
    sf.s.position.copy(p);
    const smat = sf.s.material as THREE.SpriteMaterial;
    smat.color.setHex(0xffffff);
    smat.rotation = Math.random() * Math.PI;
    sf.s.visible = true;
  }

  flash(p: THREE.Vector3, size: number, color: number, life = 0.18) {
    const f = this.flashes.find((q) => q.age >= q.life) ?? this.flashes[0];
    f.age = 0;
    f.life = life;
    f.size = size;
    f.s.position.copy(p);
    (f.s.material as THREE.SpriteMaterial).color.setHex(color);
    f.s.visible = true;
    this.light.position.copy(p);
    this.light.color.setHex(color);
    this.lightPow = size * 19; // a heavier punch of light on an impact — the ring answers every blow
  }

  update(dt: number, cam?: THREE.Camera) {
    if (cam) this.streaks.update(dt, cam);
    const N = this.N;
    let anyPoint = false;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      anyPoint = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.pos[i3 + 1] = -100;
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        continue;
      }
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.vel[i3] *= 1 - 0.8 * dt;
      this.vel[i3 + 2] *= 1 - 0.8 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05 && this.grav[i] > 0) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.35;
      }
      const f = Math.pow(this.life[i] / this.maxLife[i], 0.8);
      this.col[i3] = this.base[i3] * f;
      this.col[i3 + 1] = this.base[i3 + 1] * f;
      this.col[i3 + 2] = this.base[i3 + 2] * f;
    }
    if (anyPoint || this.wasPointsActive) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
      this.wasPointsActive = anyPoint;
    }

    // ---- debris: gravity, tumble, bounce + skid on the canvas, shrink away at the end of life
    let anyShard = false;
    for (let i = 0; i < this.SN; i++) {
      if (this.sLife[i] <= 0) continue;
      anyShard = true;
      const i3 = i * 3;
      this.sLife[i] -= dt;
      if (this.sLife[i] <= 0) {
        this.sDummy.position.set(0, -100, 0);
        this.sDummy.scale.setScalar(0.001);
        this.sDummy.updateMatrix();
        this.shardMesh.setMatrixAt(i, this.sDummy.matrix);
        continue;
      }
      this.sVel[i3 + 1] -= 26 * dt;
      this.sPos[i3] += this.sVel[i3] * dt;
      this.sPos[i3 + 1] += this.sVel[i3 + 1] * dt;
      this.sPos[i3 + 2] += this.sVel[i3 + 2] * dt;
      let onFloor = false;
      if (this.sPos[i3 + 1] < 0.04) {
        this.sPos[i3 + 1] = 0.04;
        if (this.sVel[i3 + 1] < -0.6) {
          this.sVel[i3 + 1] *= -0.38;
          this.sVel[i3] *= 0.6;
          this.sVel[i3 + 2] *= 0.6;
          this.sSpin[i3] *= 0.5;
          this.sSpin[i3 + 1] *= 0.5;
          this.sSpin[i3 + 2] *= 0.5;
        } else {
          this.sVel[i3 + 1] = 0;
          this.sVel[i3] *= 1 - 6 * dt;
          this.sVel[i3 + 2] *= 1 - 6 * dt;
          onFloor = true;
        }
      }
      if (!onFloor) {
        this.sRot[i3] += this.sSpin[i3] * dt;
        this.sRot[i3 + 1] += this.sSpin[i3 + 1] * dt;
        this.sRot[i3 + 2] += this.sSpin[i3 + 2] * dt;
      } else {
        // settle flat
        this.sRot[i3] *= 1 - 8 * dt;
        this.sRot[i3 + 2] *= 1 - 8 * dt;
      }
      const u = this.sLife[i] / this.sMax[i];
      const sc = this.sSize[i] * (u < 0.2 ? u / 0.2 : 1);
      this.sDummy.position.set(this.sPos[i3], this.sPos[i3 + 1], this.sPos[i3 + 2]);
      this.sDummy.rotation.set(this.sRot[i3], this.sRot[i3 + 1], this.sRot[i3 + 2]);
      this.sDummy.scale.setScalar(sc);
      this.sDummy.updateMatrix();
      this.shardMesh.setMatrixAt(i, this.sDummy.matrix);
    }
    if (anyShard) this.shardMesh.instanceMatrix.needsUpdate = true;

    for (const r of this.rings) {
      if (r.age >= r.life) {
        r.m.visible = false;
        continue;
      }
      r.age += dt;
      const u = Math.min(1, r.age / r.life);
      const e = 1 - Math.pow(1 - u, 3);
      r.m.scale.setScalar(0.3 + e * r.max);
      (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * (r.alpha ?? 0.26);
    }
    for (const r of this.impactRings) {
      if (r.age >= r.life) {
        r.m.visible = false;
        continue;
      }
      r.age += dt;
      const u = Math.min(1, r.age / r.life);
      const e = 1 - Math.pow(1 - u, 3.2);
      r.m.scale.setScalar(0.25 + e * r.max);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - u, 1.4) * (r.alpha ?? 0.28);
    }
    for (const f of this.flashes) {
      if (f.age >= f.life) {
        f.s.visible = false;
        continue;
      }
      f.age += dt;
      const u = Math.min(1, f.age / f.life);
      f.s.scale.setScalar(f.size * (0.5 + u * 1.6));
      (f.s.material as THREE.SpriteMaterial).opacity = (1 - u) * 0.38;
    }
    for (const sf of this.starFlares) {
      if (sf.age >= sf.life) {
        sf.s.visible = false;
        continue;
      }
      sf.age += dt;
      const u = Math.min(1, sf.age / sf.life);
      const e = 1 - Math.pow(1 - u, 2.5);
      sf.s.scale.setScalar(sf.size * (0.35 + e * 1.45));
      const smat = sf.s.material as THREE.SpriteMaterial;
      smat.opacity = Math.pow(1 - u, 1.5) * 0.38;
      smat.rotation += dt * 2.5;
    }
    this.lightPow *= Math.exp(-14 * dt);
    this.light.intensity = this.lightPow;
  }
}

/** Camera-facing ultra-smooth ribbon that follows a fast-moving fist with Catmull-Rom spline and anti-twist framing. */
export class Trail {
  private pts: { p: THREE.Vector3; age: number }[] = [];
  private readonly MAX_CTRL = 14;
  private readonly SEGS = 32;
  private life = 0.24;
  private geo = new THREE.BufferGeometry();
  private posA: Float32Array;
  private colA: Float32Array;
  readonly mesh: THREE.Mesh;
  private color = new THREE.Color();
  width = 0.55;

  // Cached vector helpers to eliminate garbage collection / heap churn
  private _t0 = new THREE.Vector3();
  private _t1 = new THREE.Vector3();
  private _t2 = new THREE.Vector3();
  private _t3 = new THREE.Vector3();
  private _tan = new THREE.Vector3();
  private _view = new THREE.Vector3();
  private _side = new THREE.Vector3();
  private _prevSide = new THREE.Vector3();

  constructor(scene: THREE.Scene, color: number) {
    this.color.setHex(color);
    // (SEGS + 1) rings of vertices = (32 + 1) * 2 = 66 vertices
    const vertCount = (this.SEGS + 1) * 2;
    this.posA = new Float32Array(vertCount * 3);
    this.colA = new Float32Array(vertCount * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posA, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colA, 3));

    const idx: number[] = [];
    for (let i = 0; i < this.SEGS; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setColor(c: number) {
    this.color.setHex(c);
  }

  clear() {
    this.pts.length = 0;
    this.mesh.visible = false;
  }

  update(p: THREE.Vector3, emit: boolean, dt: number, cam: THREE.Camera) {
    for (let i = 0; i < this.pts.length; i++) {
      this.pts[i].age += dt;
    }
    while (this.pts.length > 0 && this.pts[this.pts.length - 1].age > this.life) {
      this.pts.pop();
    }

    if (emit) {
      if (this.pts.length === 0) {
        this.pts.unshift({ p: p.clone(), age: 0 });
      } else {
        const dSq = p.distanceToSquared(this.pts[0].p);
        // Only insert new node when the fist has moved meaningfully (prevents zero-length kinks)
        if (dSq >= 0.0016) {
          this.pts.unshift({ p: p.clone(), age: 0 });
          if (this.pts.length > this.MAX_CTRL) this.pts.pop();
        } else {
          // Update the leading head position smoothly and keep it fresh
          this.pts[0].p.copy(p);
          this.pts[0].age = 0;
        }
      }
    }

    const K = this.pts.length;
    if (K < 2) {
      this.mesh.visible = false;
      return;
    }

    // Verify the curve has meaningful extension so we don't render a collapsed dot
    let totalLen = 0;
    for (let i = 0; i < K - 1; i++) {
      totalLen += this.pts[i].p.distanceTo(this.pts[i + 1].p);
    }
    if (totalLen < 0.08) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    const M = this.SEGS;

    // Reset reference side vector
    this._prevSide.set(0, 0, 0);

    for (let s = 0; s <= M; s++) {
      const u = s / M; // 0 = fist tip, 1 = trail tail
      const t = u * (K - 1);
      const idx = Math.min(Math.floor(t), K - 2);
      const f = t - idx;
      const f2 = f * f;
      const f3 = f2 * f;

      // 4 control points for standard Catmull-Rom spline
      const p1 = this.pts[idx].p;
      const p2 = this.pts[idx + 1].p;
      const p0 = idx > 0 ? this.pts[idx - 1].p : this._t0.subVectors(p1, this._t1.subVectors(p2, p1));
      const p3 = idx + 2 < K ? this.pts[idx + 2].p : this._t3.addVectors(p2, this._t2.subVectors(p2, p1));

      // Catmull-Rom position
      const c0 = -0.5 * f3 + f2 - 0.5 * f;
      const c1 = 1.5 * f3 - 2.5 * f2 + 1.0;
      const c2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f;
      const c3 = 0.5 * f3 - 0.5 * f2;

      const posX = c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x;
      const posY = c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y;
      const posZ = c0 * p0.z + c1 * p1.z + c2 * p2.z + c3 * p3.z;

      // Catmull-Rom tangent derivative
      const dc0 = -1.5 * f2 + 2.0 * f - 0.5;
      const dc1 = 4.5 * f2 - 5.0 * f;
      const dc2 = -4.5 * f2 + 4.0 * f + 0.5;
      const dc3 = 1.5 * f2 - f;

      this._tan.set(
        dc0 * p0.x + dc1 * p1.x + dc2 * p2.x + dc3 * p3.x,
        dc0 * p0.y + dc1 * p1.y + dc2 * p2.y + dc3 * p3.y,
        dc0 * p0.z + dc1 * p1.z + dc2 * p2.z + dc3 * p3.z,
      );
      if (this._tan.lengthSq() < 1e-6) {
        this._tan.subVectors(p2, p1);
        if (this._tan.lengthSq() < 1e-6) this._tan.set(0, 1, 0);
      }
      this._tan.normalize();

      // Camera view vector from curve point to camera
      this._view.set(cam.position.x - posX, cam.position.y - posY, cam.position.z - posZ);

      // Ribbon side vector perpendicular to tangent and camera ray
      this._side.crossVectors(this._tan, this._view);
      const sLen = this._side.length();
      if (sLen < 1e-4) {
        // Tangent is collinear with view: fallback to camera up vector to avoid flipping
        this._side.crossVectors(this._tan, cam.up);
        if (this._side.lengthSq() < 1e-4) {
          this._side.copy(this._prevSide.lengthSq() > 0.1 ? this._prevSide : new THREE.Vector3(0, 1, 0));
        } else {
          this._side.normalize();
        }
      } else {
        this._side.multiplyScalar(1 / sLen);
      }

      // ANTI-TWIST & ANTI-FOLD (Strict parallel-transport orientation lock)
      // Ensures the ribbon's left/right orientation never flips backwards or creates figure-8 kinks!
      if (this._prevSide.lengthSq() > 0.1) {
        if (this._side.dot(this._prevSide) < 0) {
          this._side.negate();
        }
        // Smooth out angular variations between consecutive spline samples
        this._side.lerp(this._prevSide, 0.22).normalize();
      }
      this._prevSide.copy(this._side);

      // Interpolated age & life fraction along the spline
      const age = this.pts[idx].age * (1 - f) + this.pts[idx + 1].age * f;
      const lifeFrac = Math.max(0, 1 - age / this.life);

      // Aerodynamic blade taper profile:
      // - Smoothly tapers at the very fist knuckle (no blunt flat rectangle block)
      // - Swells to full aerodynamic width right behind the fist
      // - Tapers gracefully down to a razor-sharp tip at the tail
      const headTaper = Math.sin(Math.min(1, s / 3.0) * (Math.PI * 0.5));
      const tailTaper = Math.pow(lifeFrac, 1.25) * Math.pow(1 - u, 0.65);
      const w = this.width * (0.28 + 0.72 * headTaper) * tailTaper;

      // Color intensity & alpha falloff
      const c = Math.pow(lifeFrac, 1.35) * Math.min(1, (s + 0.5) / 2.5) * 0.85;

      const o = s * 6;
      this.posA[o] = posX + this._side.x * w;
      this.posA[o + 1] = posY + this._side.y * w;
      this.posA[o + 2] = posZ + this._side.z * w;

      this.posA[o + 3] = posX - this._side.x * w;
      this.posA[o + 4] = posY - this._side.y * w;
      this.posA[o + 5] = posZ - this._side.z * w;

      for (let k = 0; k < 2; k++) {
        const ko = o + k * 3;
        this.colA[ko] = this.color.r * c;
        this.colA[ko + 1] = this.color.g * c;
        this.colA[ko + 2] = this.color.b * c;
      }
    }

    this.geo.setDrawRange(0, M * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
