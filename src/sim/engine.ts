import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createRig, JOINTS, type Rig } from './rig';
import { ATTACKS, ATTACK_ORDER, CHANNELS, sampleTrack, jointChannel, slowAt, type AttackId, type Attack } from './anim';
import type { JointName } from './rig';

interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; max: number; gravity: number; drag: number; grow: number; baseOp: number }

export type CamPreset = 'side' | 'diagonal' | 'victim' | 'top';
export type AutoMode = 'off' | 'cycle' | 'random';

const BLEND_DUR = 0.45;
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));


export class Engine {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  attacker: Rig;
  victim: Rig;
  attack: Attack = ATTACKS.clash;
  time = 0;
  playing = true;
  speed = 1;
  cinematic = true;
  slowmo = true;
  private grindAcc = 0;
  private animDt = 0;
  private hitStop = 0;
  private fovKick = 0;
  private dustAcc = 0;
  private contact = new THREE.Vector3();
  autoMode: AutoMode = 'off';
  onTime?: (t: number) => void;
  onAttack?: (id: AttackId) => void;
  onImpact?: (kind: 'hit' | 'clash') => void;

  private clock = new THREE.Clock();
  private raf = 0;
  private particles: Particle[] = [];
  private shake = 0;
  private flash = 0;
  private rings: { mesh: THREE.Mesh; life: number; dur: number; scale: number; face: boolean }[] = [];
  private target: THREE.Mesh;
  private impactLight: THREE.PointLight;
  private container: HTMLElement;
  private ro: ResizeObserver;
  private camTarget: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private bufA = new Array(CHANNELS).fill(0);
  private bufV = new Array(CHANNELS).fill(0);
  private lastA = new Array(CHANNELS).fill(0);
  private lastV = new Array(CHANNELS).fill(0);
  private fromA: number[] | null = null;
  private fromV: number[] | null = null;
  private blendT = BLEND_DUR;
  private clockT = 0;
  private sinceImpact = 99;
  private cineWas = false;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth, h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 100);
    this.camera.position.set(0.4, 1.6, 4.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.85, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 12;

    this.buildWorld();

    this.attacker = createRig({ armor: 0x2563eb, accent: 0xe2e8f0, frame: 0x262b36, glow: 0x22d3ee, glove: 0x9ca3af, joint: 0xfacc15 }, 'A_');
    this.victim = createRig({ armor: 0xdc2626, accent: 0x1f2937, frame: 0x2a2a30, glow: 0xff9a1f, glove: 0x9ca3af, joint: 0x22d3ee }, 'V_');

    const aWrap = new THREE.Group();
    aWrap.position.set(-0.65, 0, 0);
    aWrap.rotation.y = Math.PI / 2;
    aWrap.add(this.attacker.root);
    const vWrap = new THREE.Group();
    vWrap.position.set(0.65, 0, 0);
    vWrap.rotation.y = -Math.PI / 2;
    vWrap.add(this.victim.root);
    this.scene.add(aWrap, vWrap);

    this.target = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.012, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0, depthTest: false }),
    );
    this.target.renderOrder = 998;
    this.scene.add(this.target);

    this.impactLight = new THREE.PointLight(0xffe0a0, 0, 6, 2);
    this.scene.add(this.impactLight);

    this.setJointsVisible(false);
    this.setLabelsVisible(false);
    this.apply(0);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.clock.start();
    this.loop();
  }

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x070b16);
    s.fog = new THREE.Fog(0x070b16, 9, 22);

    s.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1a2e, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4;
    key.shadow.bias = -0.0005;
    s.add(key);
    const rimA = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimA.position.set(-5, 3, -3);
    const rimB = new THREE.DirectionalLight(0xff7a1a, 1.2);
    rimB.position.set(5, 3, -3);
    s.add(rimA, rimB);
    const spot = new THREE.SpotLight(0xffe7b0, 25, 14, 0.6, 0.5);
    spot.position.set(0, 7, 0);
    spot.target.position.set(0, 0, 0);
    s.add(spot, spot.target);

    // sci-fi arena floor
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#0f1a2e';
    g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(56,189,248,0.12)';
    g.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
    g.strokeStyle = 'rgba(56,189,248,0.55)';
    g.lineWidth = 6;
    g.beginPath(); g.arc(512, 512, 230, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(512, 282); g.lineTo(512, 742); g.stroke();
    g.fillStyle = 'rgba(56,189,248,0.35)';
    g.fillRect(250, 498, 30, 28);
    g.fillStyle = 'rgba(255,140,30,0.35)';
    g.fillRect(744, 498, 30, 28);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const side = new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.6, roughness: 0.4 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 6), [side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.35 }), side, side, side]);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    s.add(floor);
    // glowing edge strip
    const edge = new THREE.Mesh(new THREE.BoxGeometry(6.04, 0.03, 6.04), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    edge.position.y = -0.02;
    s.add(edge);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.9 });
    const corners: [number, number][] = [[-2.8, -2.8], [2.8, -2.8], [2.8, 2.8], [-2.8, 2.8]];
    corners.forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 12), postMat);
      p.position.set(x, 0.75, z);
      p.castShadow = true;
      s.add(p);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), ropeMat);
      cap.position.set(x, 1.52, z);
      s.add(cap);
    });
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
      for (let k = 0; k < 3; k++) {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 6), ropeMat);
        rope.position.set((x1 + x2) / 2, 0.5 + k * 0.4, (z1 + z2) / 2);
        rope.rotation.z = Math.PI / 2;
        rope.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
        s.add(rope);
      }
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x060a14 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    s.add(ground);
  }

  // ---------- pose application ----------
  private applyArr(rig: Rig, a: number[]) {
    rig.root.position.set(a[0], a[1], a[2]);
    rig.root.rotation.set(a[3], a[4], a[5], 'YXZ');
    for (let i = 0; i < JOINTS.length; i++) {
      const o = 6 + i * 3;
      if (this.headOff && rig === this.victim && JOINTS[i] === 'head') continue;
      rig.joints[JOINTS[i]].rotation.set(a[o], a[o + 1], a[o + 2]);
    }
  }

  // ================= OVERDRIVE: detachable head =================
  private headOff = false;
  private headVel = new THREE.Vector3();
  private headAng = new THREE.Vector3();
  private headRest = false;
  private reStart: { pos: THREE.Vector3; quat: THREE.Quaternion } | null = null;
  private headGhost = new THREE.Object3D();
  private stumpAcc = 0;

  private detachHead(vel: THREE.Vector3) {
    if (this.headOff) return;
    const head = this.victim.joints.head;
    this.scene.attach(head);
    this.headOff = true;
    this.headRest = false;
    this.reStart = null;
    this.headVel.copy(vel);
    this.headAng.set(9 + Math.random() * 3, (Math.random() - 0.5) * 8, -6 - Math.random() * 4);
  }

  private restoreHead() {
    if (!this.headOff) return;
    const head = this.victim.joints.head;
    this.victim.joints.neck.add(head);
    head.position.set(0, 0.09, 0);
    head.quaternion.identity();
    this.headOff = false;
    this.reStart = null;
  }

  private updateHead(dt: number) {
    const a = this.attack;
    const d = a.detach;
    if (!d) { this.restoreHead(); return; }
    const t = this.time;
    if (t < d.t || t >= d.reattach[1]) { this.restoreHead(); return; }
    if (!this.headOff) {
      // seeked into the window: drop the head from the neck
      this.victim.root.updateMatrixWorld(true);
      this.detachHead(new THREE.Vector3(0.6, 0.5, 0));
    }
    const head = this.victim.joints.head;
    if (t < d.reattach[0]) {
      if (dt <= 0 || this.headRest) return;
      // ballistic flight + bounce on the canvas + ropes
      this.headVel.y -= 9.8 * dt;
      head.position.addScaledVector(this.headVel, dt);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.headAng.x * dt, this.headAng.y * dt, this.headAng.z * dt));
      head.quaternion.multiply(q);
      const R = 0.11;
      if (head.position.y < R) {
        head.position.y = R;
        if (Math.abs(this.headVel.y) > 0.6) {
          this.shake = Math.max(this.shake, 0.012);
          const p = head.position.clone(); p.y = 0.02;
          for (let i = 0; i < 6; i++) this.addParticle(p, new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2), 0xfff3b0, 0.004, 0.2, { gravity: 6, baseOp: 0.8 });
        }
        this.headVel.y = -this.headVel.y * 0.42;
        this.headVel.x *= 0.72; this.headVel.z *= 0.72;
        this.headAng.multiplyScalar(0.6);
        if (Math.abs(this.headVel.y) < 0.35 && this.headVel.length() < 0.5) this.headRest = true;
      }
      for (const ax of ['x', 'z'] as const) {
        if (Math.abs(head.position[ax]) > 2.62) {
          head.position[ax] = Math.sign(head.position[ax]) * 2.62;
          this.headVel[ax] *= -0.45;
        }
      }
      return;
    }
    // ---- magnetic reattach ----
    if (!this.reStart) this.reStart = { pos: head.position.clone(), quat: head.quaternion.clone() };
    const neck = this.victim.joints.neck;
    if (this.headGhost.parent !== neck) neck.add(this.headGhost);
    const hc = jointChannel('head');
    this.headGhost.position.set(0, 0.09, 0);
    this.headGhost.rotation.set(this.lastV[hc], this.lastV[hc + 1], this.lastV[hc + 2]);
    this.headGhost.updateMatrixWorld(true);
    const tp = new THREE.Vector3(), tq = new THREE.Quaternion();
    this.headGhost.getWorldPosition(tp);
    this.headGhost.getWorldQuaternion(tq);
    const k = smooth(clamp01((t - d.reattach[0]) / (d.reattach[1] - d.reattach[0])));
    head.position.lerpVectors(this.reStart.pos, tp, k);
    head.position.y += Math.sin(k * Math.PI) * 0.45;
    head.quaternion.slerpQuaternions(this.reStart.quat, tq, k);
    // magnetic sparkle trail
    if (dt > 0 && Math.random() < 0.6) this.addParticle(head.position, new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3), 0x67e8f9, 0.006, 0.3, { drag: 2, baseOp: 0.7 });
  }

  /** sparks + short arcs from the neck stump while the head is off */
  private updateStump(dt: number) {
    if (!this.headOff || dt <= 0) return;
    const d = this.attack.detach!;
    const since = this.time - d.t;
    const rate = since < 0.6 ? 70 : 10;
    this.stumpAcc += dt * rate;
    const p = new THREE.Vector3();
    this.victim.joints.neck.localToWorld(p.set(0, 0.07, 0));
    while (this.stumpAcc >= 1) {
      this.stumpAcc -= 1;
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6);
      this.addParticle(p, v, Math.random() < 0.3 ? 0x7dd3fc : 0xffd166, 0.004 + Math.random() * 0.005, 0.2 + Math.random() * 0.3, { gravity: 6, baseOp: 0.9 });
    }
  }

  private glitchJitter(rig: Rig, seed: number, amt: number) {
    if (amt <= 0) return;
    const t = this.clockT * 40 + seed;
    const n = (k: number) => (Math.sin(t * (1.3 + k * 0.71) + k * 12.9) > 0.55 ? 1 : 0) * Math.sin(t * 7.1 + k) * amt;
    rig.joints.head.rotation.y += n(1) * 0.25;
    rig.joints.head.rotation.z += n(2) * 0.15;
    rig.joints.elbowR.rotation.x += n(3) * 0.25;
    rig.joints.wristR.rotation.x += n(4) * 0.4;
  }

  // ---------- spring layer (secondary motion / whiplash) ----------
  private springA = { pos: new Float64Array(CHANNELS), vel: new Float64Array(CHANNELS), init: false };
  private springV = { pos: new Float64Array(CHANNELS), vel: new Float64Array(CHANNELS), init: false };

  /** global "luwes" layer: every channel follows its target through a spring.
   *  Torso is tight, arms/head trail slightly behind with a tiny overshoot (overlapping action). */
  private baseSpring(): Map<number, [number, number]> {
    const m = new Map<number, [number, number]>();
    const set = (n: JointName, w: number, z: number) => { const c = jointChannel(n); for (let i = 0; i < 3; i++) m.set(c + i, [w, z]); };
    for (let c = 0; c < 6; c++) m.set(c, [c === 1 ? 36 : 32, 1.0]);
    set('pelvis', 34, 1); set('waist', 30, 0.95); set('spine', 28, 0.9); set('chest', 26, 0.85);
    set('neck', 24, 0.8); set('head', 21, 0.72);
    for (const s of ['L', 'R']) {
      set(('clav' + s) as JointName, 26, 0.85);
      set(('shoulder' + s) as JointName, 26, 0.82);
      set(('elbow' + s) as JointName, 24, 0.78);
      set(('wrist' + s) as JointName, 20, 0.7);
      set(('hip' + s) as JointName, 40, 1);
      set(('knee' + s) as JointName, 40, 1);
      set(('ankle' + s) as JointName, 46, 1);
    }
    return m;
  }

  private springCache = new Map<string, [number, number, number][]>();
  private springSet(isVictim: boolean): [number, number, number][] {
    const key = this.attack.id + (isVictim ? 'V' : 'A');
    let v = this.springCache.get(key);
    if (!v) { v = this.computeSpringSet(isVictim); this.springCache.set(key, v); }
    return v;
  }

  private computeSpringSet(isVictim: boolean): [number, number, number][] {
    const m = this.baseSpring();
    for (const [c, w, z] of this.impactSet(isVictim)) m.set(c, [w, z]);
    // the punching arm must stay fast & accurate
    const a = this.attack;
    if (!isVictim || a.kind === 'clash') {
      const hands = new Set<string>([a.hand, ...(a.hits?.map((h) => h.hand) ?? [])]);
      for (const s of hands) for (const n of ['shoulder', 'elbow', 'wrist']) {
        const c = jointChannel((n + s) as JointName);
        for (let i = 0; i < 3; i++) m.set(c + i, [44, 1]);
      }
    }
    return [...m.entries()].map(([c, [w, z]]) => [c, w, z]);
  }

  private impactSet(isVictim: boolean): [number, number, number][] {
    const a = this.attack;
    const out: [number, number, number][] = [];
    const push = (n: JointName, w: number, z: number) => { const c = jointChannel(n); out.push([c, w, z], [c + 1, w, z], [c + 2, w, z]); };
    if (a.kind === 'show') return out;
    if (isVictim && a.kind === 'hit') {
      push('head', 22, 0.32);
      push('neck', 24, 0.4);
      push('chest', 26, 0.55);
      push('spine', 26, 0.6);
      push('waist', 28, 0.65);
      push('shoulderL', 20, 0.4); push('shoulderR', 20, 0.4);
      push('elbowL', 20, 0.42); push('elbowR', 20, 0.42);
    } else {
      const free = a.hand === 'L' ? 'R' : 'L';
      push('head', 30, 0.5);
      push('neck', 30, 0.55);
      push(('shoulder' + free) as JointName, 28, 0.5);
      push(('elbow' + free) as JointName, 28, 0.5);
    }
    return out;
  }

  /**
   * Accuracy weight (0..1). Near every impact the spring/lag layer fades out so the pose is EXACTLY
   * the key-framed pose (computed by IK) -> fist lands precisely on the target and the target
   * is exactly where it was aimed at. After the impact the spring takes over again (with the kick).
   */
  private accW(isVictim: boolean, t: number) {
    const a = this.attack;
    const ss = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
    if (a.lock) {
      if (t > a.lock[1] + (isVictim ? 0 : 0.04)) return 0;
      if (t >= a.lock[0] - 0.15) return ss((t - (a.lock[0] - 0.15)) / 0.12);
      return 0;
    }
    if (a.kind === 'clash') {
      const end = a.release ?? a.hitTime + 0.1;
      if (t > end) return 0;
      return ss((t - (a.hitTime - 0.32)) / 0.18);
    }
    const hits = a.hits ?? (a.kind === 'hit' ? [{ t: a.hitTime }] : []);
    let w = 0;
    for (const h of hits) {
      const endT = isVictim ? h.t : h.t + 0.04;
      if (t > endT) continue;
      w = Math.max(w, ss((t - (h.t - 0.2)) / 0.14));
    }
    return w;
  }

  private hitList(): { t: number; hand: 'L' | 'R'; big: number }[] {
    const a = this.attack;
    if (a.kind === 'show') return [];
    if (a.kind === 'clash') return [{ t: a.hitTime, hand: 'R', big: 1.25 }];
    if (a.hits) return a.hits;
    const big = a.id === 'uppercut' || a.id === 'overhand' ? 1.3 : a.id === 'jab' ? 0.6 : 1.05;
    return [{ t: a.hitTime, hand: a.hand, big }];
  }

  /**
   * Procedural ANTICIPATION layer (additive, attacker only):
   *  1) wind-up: hips & shoulders counter-rotate away, body sinks onto the rear leg, punching arm
   *     cocks back, chin tucks, eyes stay on target  (deep & held)
   *  2) strike: the offset collapses with ease-in -> the punch ACCELERATES into the target
   *  3) follow-through: hips/shoulders over-rotate through the target, then settle
   * Exactly 0 at the impact moment -> the IK-aimed contact pose is untouched (punch still lands).
   */
  private addAnticipation(buf: number[], t: number) {
    if (this.attack.lock) return; // hand-authored wind-up (grab must not slip)
    const hits = this.hitList();
    if (!hits.length) return;
    const ss = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
    const J = (n: JointName) => jointChannel(n);
    let prevT = -1;
    for (const h of hits) {
      const gap = prevT < 0 ? 0.9 : h.t - prevT;
      prevT = h.t;
      const L = Math.min(0.55, Math.max(0.15, gap * 0.82)); // wind-up length
      const S = Math.min(0.1, L * 0.38); // strike length (fast!)
      const u = t - h.t;
      let A = 0, F = 0;
      if (u > -L && u < 0) {
        const rise = ss((u + L) / (L - S) * 1.15);
        const x = u < -S ? 0 : (u + S) / S;
        A = rise * (1 - x * x);
      } else if (u >= 0 && u < 0.45) {
        const q = u / 0.075;
        F = q * Math.exp(1 - q);
      }
      if (A === 0 && F === 0) continue;
      const k = Math.max(0.45, Math.min(1.45, h.big));
      const a = A * k, f = F * k;
      const sg = h.hand === 'R' ? 1 : -1;
      const P = h.hand;
      const O = P === 'R' ? 'L' : 'R';
      // root: sink, shift weight back, coil
      buf[1] -= 0.065 * a;
      buf[2] += -0.08 * a + 0.045 * f;
      buf[3] += 0.05 * a + 0.05 * f;
      buf[4] += -sg * 0.36 * a + sg * 0.16 * f;
      // torso
      buf[J('spine')] += 0.06 * a;
      buf[J('chest') + 1] += -sg * 0.24 * a + sg * 0.12 * f;
      // head: chin tucked, eyes locked on the opponent (counter-rotate the coil)
      buf[J('head')] += 0.14 * a;
      buf[J('head') + 1] += sg * 0.55 * a - sg * 0.2 * f;
      // legs: deeper knee bend, feet stay flat
      for (const s of ['L', 'R'] as const) {
        buf[J(('hip' + s) as JointName)] -= 0.14 * a;
        buf[J(('knee' + s) as JointName)] += 0.28 * a;
        buf[J(('ankle' + s) as JointName)] -= (0.14 + 0.05) * a + 0.05 * f;
      }
      // punching arm cocks back, other hand guards the chin
      buf[J(('shoulder' + P) as JointName)] += 0.5 * a;
      buf[J(('elbow' + P) as JointName)] -= 0.28 * a;
      buf[J(('shoulder' + O) as JointName)] -= 0.12 * a;
      buf[J(('elbow' + O) as JointName)] -= 0.1 * a;
    }
  }

  private stepSpring(st: { pos: Float64Array; vel: Float64Array; init: boolean; prev?: Float64Array; raw?: Float64Array }, buf: number[], set: [number, number, number][], dt: number, snap: boolean, acc = 0) {
    if (!st.prev) st.prev = new Float64Array(CHANNELS);
    if (!st.raw) st.raw = new Float64Array(CHANNELS);
    const prev = st.prev, raw = st.raw;
    if (snap || !st.init) {
      for (let c = 0; c < CHANNELS; c++) { st.pos[c] = buf[c]; st.vel[c] = 0; prev[c] = buf[c]; }
      st.init = true;
      return;
    }
    for (let c = 0; c < CHANNELS; c++) raw[c] = buf[c];
    const inSet = new Uint8Array(CHANNELS);
    for (const [c] of set) inSet[c] = 1;
    for (let c = 0; c < CHANNELS; c++) if (!inSet[c]) { st.pos[c] = raw[c]; st.vel[c] = 0; }
    if (dt > 0) {
      const sub = 3, h = dt / sub;
      for (const [c, w, z] of set) {
        let p = st.pos[c], v = st.vel[c];
        for (let i = 0; i < sub; i++) {
          const a = w * w * (raw[c] - p) - 2 * z * w * v;
          v += a * h;
          p += v * h;
        }
        st.pos[c] = p; st.vel[c] = v;
      }
    }
    for (const [c] of set) buf[c] = st.pos[c] + (raw[c] - st.pos[c]) * acc;
    // fully locked to the exact pose: keep the spring state in sync (no pop when it hands back)
    if (acc > 0.999) {
      for (const [c] of set) {
        if (dt > 0) st.vel[c] = (raw[c] - prev[c]) / dt;
        st.pos[c] = raw[c];
      }
    }
    for (let c = 0; c < CHANNELS; c++) prev[c] = raw[c];
  }

  private kick(st: { vel: Float64Array }, imp: Partial<Record<JointName, [number, number, number]>>, scale = 1) {
    for (const [n, v] of Object.entries(imp)) {
      const c = jointChannel(n as JointName);
      st.vel[c] += v![0] * scale; st.vel[c + 1] += v![1] * scale; st.vel[c + 2] += v![2] * scale;
    }
  }

  private apply(t: number, dt = 0, snap = false) {
    sampleTrack(this.attack.attacker, t, this.bufA);
    sampleTrack(this.attack.victim, t, this.bufV);
    if (this.fromA && this.fromV && this.blendT < BLEND_DUR) {
      const k = smooth(this.blendT / BLEND_DUR);
      for (let c = 0; c < CHANNELS; c++) {
        this.bufA[c] = this.fromA[c] + (this.bufA[c] - this.fromA[c]) * k;
        this.bufV[c] = this.fromV[c] + (this.bufV[c] - this.fromV[c]) * k;
      }
    }
    this.addAnticipation(this.bufA, t);
    if (this.attack.kind === 'clash') this.addAnticipation(this.bufV, t);
    this.stepSpring(this.springA, this.bufA, this.springSet(false), dt, snap, this.accW(false, t));
    this.stepSpring(this.springV, this.bufV, this.springSet(true), dt, snap, this.accW(true, t));
    for (let c = 0; c < CHANNELS; c++) { this.lastA[c] = this.bufA[c]; this.lastV[c] = this.bufV[c]; }
    this.applyArr(this.attacker, this.bufA);
    this.applyArr(this.victim, this.bufV);

    const a = this.attack;
    if (a.glitch) {
      const g = t > a.glitch[0] && t < a.glitch[1] ? Math.sin(((t - a.glitch[0]) / (a.glitch[1] - a.glitch[0])) * Math.PI) : 0;
      this.glitchJitter(this.attacker, 0, g);
      this.glitchJitter(this.victim, 5.3, g);
    }
    // pressing: motors straining - high-frequency tremble
    if (false as boolean) {
      const k = 0;
      for (const [rig, ph] of [[this.attacker, 0], [this.victim, 1.9]] as [Rig, number][]) {
        const f = this.clockT * 62 + ph;
        rig.joints.chest.rotation.z += Math.sin(f) * 0.012 * k;
        rig.joints.chest.rotation.x += Math.sin(f * 1.3) * 0.008 * k;
        rig.joints.head.rotation.z += Math.sin(f * 0.9) * 0.02 * k;
        rig.joints.shoulderL.rotation.x += Math.sin(f * 1.1) * 0.02 * k;
        rig.joints.kneeL.rotation.x += Math.sin(f * 0.7) * 0.012 * k;
        rig.root.position.y += Math.sin(f * 1.7) * 0.003 * k;
      }
    }
    // charging tremble
    if (a.charge) {
      const k = clamp01((t - a.charge[0]) / (a.charge[1] - 0.35 - a.charge[0]));
      if (t > a.charge[0] && t < a.charge[1] - 0.3) {
        const tr = Math.sin(this.clockT * 70) * 0.012 * k;
        this.attacker.joints.shoulderR.rotation.z += tr;
        this.victim.joints.shoulderR.rotation.z -= tr;
        this.attacker.joints.elbowR.rotation.x += tr;
        this.victim.joints.elbowR.rotation.x += tr;
      }
    }
  }

  setAttack(id: AttackId, blend = true) {
    if (blend) {
      this.fromA = this.lastA.slice();
      this.fromV = this.lastV.slice();
      this.blendT = 0;
    }
    this.restoreHead();
    this.attack = ATTACKS[id];
    this.time = 0;
    this.onAttack?.(id);
    this.onTime?.(0);
  }

  seek(t: number) {
    this.time = Math.max(0, Math.min(this.attack.duration, t));
    this.blendT = BLEND_DUR;
    this.apply(this.time, 0, true);
    this.onTime?.(this.time);
  }

  setJointsVisible(v: boolean) {
    [...this.attacker.markers, ...this.victim.markers].forEach((m) => (m.visible = v));
  }
  setLabelsVisible(v: boolean) {
    this.victim.labels.forEach((l) => (l.visible = v));
    this.attacker.labels.forEach((l) => (l.visible = false));
  }
  setXray(v: boolean) {
    [...this.attacker.meshes, ...this.victim.meshes].forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = v;
      mat.opacity = v ? 0.35 : 1;
      mat.depthWrite = !v;
    });
  }

  setCamera(p: CamPreset) {
    const map: Record<CamPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
      side: { pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
      diagonal: { pos: [3.6, 2.4, 3.2], look: [0.3, 0.7, 0] },
      victim: { pos: [-1.2, 1.5, 2.2], look: [1.2, 0.8, 0] },
      top: { pos: [0.6, 6.5, 0.8], look: [0.3, 0, 0] },
    };
    const m = map[p];
    this.camTarget = { pos: new THREE.Vector3(...m.pos), look: new THREE.Vector3(...m.look) };
  }

  // ---------- FX ----------
  private addParticle(pos: THREE.Vector3, vel: THREE.Vector3, color: number, size: number, max: number, opts: Partial<Pick<Particle, 'gravity' | 'drag' | 'grow' | 'baseOp'>> = {}) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opts.baseOp ?? 1, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mesh.position.copy(pos);
    this.particles.push({ mesh, vel, life: 0, max, gravity: opts.gravity ?? 0, drag: opts.drag ?? 1.5, grow: opts.grow ?? 0, baseOp: opts.baseOp ?? 1 });
    this.scene.add(mesh);
  }

  private addRing(pos: THREE.Vector3, color: number, dur: number, scale: number, face: boolean, normalX = false) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.09, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    mesh.position.copy(pos);
    if (normalX) mesh.rotation.set(0, Math.PI / 2, 0);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 0, dur, scale, face });
  }

  private spawnHit(pos: THREE.Vector3, dir: [number, number, number], big: number) {
    const [dx, dy, dz] = dir;
    // subtle: a few tiny short-lived sparks thrown AWAY from the camera line, no rings
    const colors = [0xfff3b0, 0xffd166, 0xffffff];
    const n = Math.round(14 * big);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(dx + (Math.random() - 0.3) * 1.2, dy + (Math.random() - 0.5) * 1.2, dz + (Math.random() - 0.5) * 1.2).normalize();
      this.addParticle(pos, d.multiplyScalar((1.2 + Math.random() * 2) * big), colors[i % 3], 0.004 + Math.random() * 0.006, 0.12 + Math.random() * 0.18, { gravity: 6, baseOp: 0.85 });
    }
    // 2 small metal bits for heavy hits only
    if (big >= 1.2) {
      for (let i = 0; i < 2; i++) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.009, 0.009), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.9, roughness: 0.3, transparent: true }));
        mesh.position.copy(pos);
        const v = new THREE.Vector3(dx * 1.2 + Math.random() - 0.3, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5);
        this.particles.push({ mesh, vel: v, life: 0, max: 0.7, gravity: 6, drag: 0.4, grow: 0, baseOp: 1 });
        this.scene.add(mesh);
      }
    }
    this.impactLight.position.copy(pos);
    this.impactLight.intensity = 4 * big;
    this.shake = Math.max(this.shake, 0.02 * big);
    this.flash = 0.35;
    this.sinceImpact = 0;
    this.onImpact?.('hit');
  }

  private spawnClash(pos: THREE.Vector3) {
    // dramatic metal-on-metal contact: a disc of sparks perpendicular to the punch line + one shock ring
    const cA = this.attacker.glowColor.getHex(), cB = this.victim.glowColor.getHex();
    const colors = [0xffffff, 0xfff3b0, 0xffc56b, 0xffffff, cA, cB];
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2.2;
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.cos(a) * sp, Math.sin(a) * sp);
      this.addParticle(pos, v, colors[i % 6], 0.004 + Math.random() * 0.007, 0.18 + Math.random() * 0.25, { gravity: 4, drag: 1.6, baseOp: 0.85 });
    }
    // one thin, faint ring in the plane between the fists (doesn't cover the robots)
    this.addRing(pos, 0xffffff, 0.3, 3.5, false, true);
    this.impactLight.position.copy(pos);
    this.impactLight.intensity = 8;
    this.shake = 0.025;
    this.flash = 0.35;
    this.sinceImpact = 0;
    this.onImpact?.('clash');
  }

  private spawnRelease(pos: THREE.Vector3) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 1.8;
      const v = new THREE.Vector3((Math.random() - 0.5) * 1, Math.cos(a) * sp, Math.sin(a) * sp);
      this.addParticle(pos, v, i % 2 ? 0xfff3b0 : 0xffffff, 0.004 + Math.random() * 0.006, 0.15 + Math.random() * 0.2, { gravity: 5, drag: 1.5, baseOp: 0.8 });
    }
    this.impactLight.position.copy(pos);
    this.impactLight.intensity = 4;
    this.shake = Math.max(this.shake, 0.012);
    this.flash = 0.15;
  }

  /** grinding sparks + contact glow + feet dust while the fists are locked */
  private updatePress(dt: number) {
    const a = this.attack, t = this.time;
    if (!a.press || t < a.press[0] || t > a.press[1]) return;
    const pA = new THREE.Vector3(), pB = new THREE.Vector3();
    this.attacker.hand.R.getWorldPosition(pA);
    this.victim.hand.R.getWorldPosition(pB);
    this.contact.copy(pA).lerp(pB, 0.5);
    const k = clamp01((t - a.press[0]) / (a.press[1] - a.press[0]));
    if (this.playing) {
      this.grindAcc += dt * (5 + 6 * k);
      while (this.grindAcc >= 1) {
        this.grindAcc -= 1;
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 1.8;
        const v = new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.abs(Math.cos(ang)) * sp + 0.3, Math.sin(ang) * sp);
        this.addParticle(this.contact, v, Math.random() < 0.5 ? 0xfff3b0 : 0xffb347, 0.004 + Math.random() * 0.006, 0.2 + Math.random() * 0.35, { gravity: 5, drag: 1 });
      }
      this.dustAcc += dt * 2;
      while (this.dustAcc >= 1) {
        this.dustAcc -= 1;
        for (const r of [this.attacker, this.victim]) {
          r.joints.ankleR.getWorldPosition(pA);
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xa5b4c8, transparent: true, opacity: 0.35, depthWrite: false }));
          m.position.set(pA.x + (Math.random() - 0.5) * 0.1, 0.03, pA.z + (Math.random() - 0.5) * 0.1);
          this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5), life: 0, max: 0.8, gravity: -0.05, drag: 1.5, grow: 2, baseOp: 0.35 });
          this.scene.add(m);
        }
      }
    }
    this.impactLight.position.copy(this.contact);
    this.impactLight.intensity = Math.max(this.impactLight.intensity, 1.5 + 1.5 * k);

    for (const r of [this.attacker, this.victim]) r.knuckleMat.emissiveIntensity = 1.5 + 1.5 * k;
  }

  private spawnDust(pos: THREE.Vector3, amount = 40) {
    for (let i = 0; i < amount; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xa5b4c8, transparent: true, opacity: 0.45, depthWrite: false }));
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.8, 0.03, pos.z + (Math.random() - 0.5) * 0.5);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * 0.8, 0.3 + Math.random() * 0.5, Math.sin(a) * 0.8), life: 0, max: 0.9 + Math.random() * 0.6, gravity: -0.1, drag: 1.5, grow: 2, baseOp: 0.45 });
      this.scene.add(mesh);
    }
    this.shake = Math.max(this.shake, 0.025);
  }

  private flicker(t: number) {
    return Math.sin(t * 83) + Math.sin(t * 131 + 1.7) > 0.2 ? 1 : 0.08;
  }

  private updateRobotFx(dt: number) {
    const a = this.attack, t = this.time;
    // ---- eyes / core power ----
    const level = (isVictim: boolean) => {
      let l = 1;
      if (a.kind === 'hit' && isVictim && a.powerDown) {
        const [p0, p1] = a.powerDown;
        if (t > p0 - 0.2 && t < p0) l = this.flicker(this.clockT);
        else if (t >= p0 && t < p1) l = 0.03;
        else if (t >= p1 && t < p1 + 0.8) l = this.flicker(this.clockT) * (0.4 + 0.6 * ((t - p1) / 0.8));
      }
      if (a.glitch && t > a.glitch[0] && t < a.glitch[1]) l = this.flicker(this.clockT + (isVictim ? 0.37 : 0));
      if (isVictim && a.stun && t > a.stun[0] && t < a.stun[1]) l = this.flicker(this.clockT);
      if (a.kind === 'clash' && t > a.hitTime && t < a.hitTime + 0.25) l = this.flicker(this.clockT + (isVictim ? 0.37 : 0));
      if (a.charge && t > a.charge[0] && t < a.hitTime + 0.3) l *= 1 + 0.8 * clamp01((t - a.charge[0]) / (a.hitTime - a.charge[0]));
      return l;
    };
    this.attacker.glowMat.emissiveIntensity = 2.2 * level(false);
    this.victim.glowMat.emissiveIntensity = 2.2 * level(true);

    // ---- glove charge ----
    let charge = 0;
    if (a.charge) {
      if (t > a.charge[0] && t <= a.hitTime) charge = smooth(clamp01((t - a.charge[0]) / (a.hitTime - 0.2 - a.charge[0])));
      else if (t > a.hitTime) charge = Math.max(0, 1 - (t - a.hitTime) / 0.5);
    }
    const pulse = 0.85 + 0.15 * Math.sin(this.clockT * 30);
    for (const r of [this.attacker, this.victim]) {
      r.gloveMat.emissiveIntensity = charge * 1.6 * pulse;
      r.knuckleMat.emissiveIntensity = 1.2 + charge * 6 * pulse;
    }
    // OVERDRIVE: attacker's eyes + right fist power up
    if (a.odCharge) {
      let k = 0;
      if (t > a.odCharge[0] && t <= a.odCharge[1]) k = smooth(clamp01((t - a.odCharge[0]) / (a.odCharge[1] - a.odCharge[0] - 0.15)));
      else if (t > a.odCharge[1]) k = Math.max(0, 1 - (t - a.odCharge[1]) / 0.6);
      const pz = 0.8 + 0.2 * Math.sin(this.clockT * 22);
      this.attacker.gloveMat.emissiveIntensity = k * 1.1 * pz;
      this.attacker.knuckleMat.emissiveIntensity = 1.2 + k * 4 * pz;
      this.attacker.glowMat.emissiveIntensity = 2.2 * (1 + k * 0.9);
      // a few energy motes drawn into the fist (subtle)
      if (this.playing && k > 0.05 && t <= a.odCharge[1] && Math.random() < k * 0.8) {
        this.attacker.hand.R.getWorldPosition(this.tmp);
        const off = new THREE.Vector3().randomDirection().multiplyScalar(0.18 + Math.random() * 0.12);
        this.addParticle(this.tmp.clone().add(off), off.clone().multiplyScalar(-3), 0x22d3ee, 0.006, 0.3, { drag: 0, baseOp: 0.8 });
      }
    }

    // hit flash on the target part
    if (a.kind === 'hit') {
      const m = (a.hitPart === 'head' ? this.victim.headMesh : this.victim.chestMesh) as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      this.victim.armorMat.emissive.setRGB(this.flash * 0.25, this.flash * 0.12, this.flash * 0.05);
      void mat;
    } else {
      this.victim.armorMat.emissive.setRGB(0, 0, 0);
    }
    this.attacker.armorMat.emissive.setRGB(0, 0, 0);
    if (a.kind === 'clash') this.victim.armorMat.emissive.setRGB(0, 0, 0);

    // ---- charge particles (converging energy) ----
    if (this.playing && a.charge && t > a.charge[0] && t < a.hitTime - 0.25) {
      const rate = 30 + charge * 120;
      const n = Math.floor(rate * dt + Math.random());
      for (const r of [this.attacker, this.victim]) {
        r.hand.R.getWorldPosition(this.tmp);
        for (let i = 0; i < n; i++) {
          const off = new THREE.Vector3().randomDirection().multiplyScalar(0.25 + Math.random() * 0.25);
          const life = 0.3 + Math.random() * 0.15;
          this.addParticle(this.tmp.clone().add(off), off.clone().multiplyScalar(-1 / life), r.glowColor.getHex(), 0.01 + Math.random() * 0.01, life, { drag: 0 });
        }
      }
    }
    // dash trails
    if (this.playing && a.charge && t > a.hitTime - 0.32 && t < a.hitTime) {
      for (const r of [this.attacker, this.victim]) {
        r.hand.R.getWorldPosition(this.tmp);
        for (let i = 0; i < 4; i++) {
          this.addParticle(this.tmp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06)), new THREE.Vector3(), r.glowColor.getHex(), 0.03, 0.3, { drag: 0, grow: -0.6 });
        }
      }
    }
  }

  private updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vel.y -= p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.005 && p.gravity > 0) { p.mesh.position.y = 0.005; p.vel.y *= -0.3; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      const k = p.life / p.max;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * p.baseOp;
      if (p.grow) p.mesh.scale.setScalar(Math.max(0.01, 1 + k * p.grow));
      if (p.life >= p.max) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const k = r.life / r.dur;
      const e = 1 - Math.pow(1 - Math.min(1, k), 3);
      r.mesh.scale.setScalar(1 + e * r.scale);
      if (r.face) r.mesh.lookAt(this.camera.position);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.impactLight.intensity *= Math.pow(0.002, dt);
    this.sinceImpact += dt;

    // target indicator
    const a = this.attack;
    const dtHit = a.hitTime - this.time;
    let op = 0;
    if (a.kind === 'hit' && dtHit > 0 && dtHit < 1.0) op = (1 - dtHit) * (0.55 + 0.45 * Math.sin(this.clockT * 18));
    (this.target.material as THREE.MeshBasicMaterial).opacity = 0 * op;
    const j = a.hitPart === 'chest' ? this.victim.chestMesh : this.victim.headMesh;
    j.getWorldPosition(this.target.position);
    this.target.lookAt(this.camera.position);
    this.target.scale.setScalar(1 + (dtHit > 0 ? dtHit * 0.8 : 0));
  }

  private cinematicCam() {
    const t = this.time;
    const H = this.attack.hitTime;
    if (this.attack.detach) {
      const D = this.attack.detach.t;
      type CK = { t: number; pos: [number, number, number]; look: [number, number, number] };
      const C: CK[] = this.attack.id === 'overdrive' ? [
        { t: 0, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
        { t: 0.98, pos: [1.7, 1.35, 2.7], look: [0.15, 1.2, 0] },
        { t: 1.5, pos: [-1.55, 1.4, 1.0], look: [0.55, 1.25, 0] },
        { t: H - 0.25, pos: [-1.2, 1.15, 1.35], look: [0.5, 1.3, 0] },
        { t: H, pos: [-0.2, 1.2, 1.6], look: [0.5, 1.35, 0] },
        { t: H + 0.9, pos: [0.3, 1.5, 3.0], look: [1.2, 0.9, 0] },
        { t: H + 2.4, pos: [0.6, 1.7, 4.2], look: [0.5, 0.6, 0] },
        { t: H + 3.6, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
      ] : [
        { t: 0, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
        { t: Math.max(0.5, D - 1.4), pos: [1.3, 1.35, 3.4], look: [0.1, 1.1, 0] },
        { t: D - 0.35, pos: [-0.5, 1.25, 2.3], look: [0.35, 1.3, 0] },
        { t: D, pos: [-0.25, 1.25, 1.9], look: [0.5, 1.35, 0] },
        { t: D + 0.9, pos: [0.3, 1.5, 3.1], look: [1.2, 0.9, 0] },
        { t: D + 2.4, pos: [0.6, 1.7, 4.2], look: [0.5, 0.6, 0] },
        { t: D + 3.6, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
      ];
      const H2 = D;
      let i = 0;
      while (i < C.length - 2 && t > C[i + 1].t) i++;
      const A = C[i], B = C[i + 1];
      const k = smooth(clamp01((t - A.t) / (B.t - A.t)));
      this.tmp.set(...A.pos).lerp(this.tmp2.set(...B.pos), k);
      this.camera.position.lerp(this.tmp, 0.1);
      this.tmp.set(...A.look).lerp(this.tmp2.set(...B.look), k);
      // follow the flying head
      if (this.headOff) {
        const w = smooth(clamp01((t - H2) / 0.25)) * (1 - smooth(clamp01((t - (H2 + 2.2)) / 0.6)));
        const hp = new THREE.Vector3();
        this.victim.joints.head.getWorldPosition(hp);
        this.tmp.lerp(hp, w * 0.85);
      }
      this.controls.target.lerp(this.tmp, 0.14);
      this.camera.lookAt(this.controls.target);
      return;
    }
    const CINE: { t: number; pos: [number, number, number]; look: [number, number, number] }[] = [
      { t: 0, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
      { t: H - 0.75, pos: [2.0, 1.2, 2.9], look: [0, 1.05, 0] },
      { t: H - 0.02, pos: [0.7, 1.2, 1.55], look: [0, 1.36, 0] },
      { t: H + 0.55, pos: [0.35, 1.18, 1.4], look: [0, 1.36, 0] },
      { t: H + 1.1, pos: [0.1, 1.4, 2.6], look: [0, 1.1, 0] },
      { t: H + 2.0, pos: [0.4, 1.6, 4.6], look: [0, 0.85, 0] },
    ];
    let i = 0;
    while (i < CINE.length - 2 && t > CINE[i + 1].t) i++;
    const A = CINE[i], B = CINE[i + 1];
    const k = smooth(clamp01((t - A.t) / (B.t - A.t)));
    this.tmp.set(...A.pos).lerp(this.tmp2.set(...B.pos), k);
    this.camera.position.lerp(this.tmp, 0.12);
    this.tmp.set(...A.look).lerp(this.tmp2.set(...B.look), k);
    this.controls.target.lerp(this.tmp, 0.12);
    this.camera.lookAt(this.controls.target);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.min(this.clock.getDelta(), 1 / 30);
    this.clockT += realDt;
    if (this.blendT < BLEND_DUR) this.blendT += realDt;

    if (this.playing) {
      const a = this.attack;
      const prev = this.time;
      const frozen = this.hitStop > 0;
      if (frozen) this.hitStop -= realDt;
      this.animDt = frozen ? 0 : realDt * this.speed * (this.slowmo ? slowAt(a, this.time) : 1);
      this.time += this.animDt;
      if (a.release !== undefined && prev < a.release && this.time >= a.release) {
        this.kick(this.springA, { head: [3, 0, 0], chest: [2, 0, 0] });
        this.kick(this.springV, { head: [3, 0, 0], chest: [2, 0, 0] });
        this.spawnRelease(this.contact.clone());
      }
      const hits = a.hits ?? (a.kind === 'show' ? [] : [{ t: a.hitTime, hand: a.hand, impulse: a.impulse, dir: a.sparkDir, big: a.id === 'uppercut' || a.id === 'overhand' ? 1.3 : a.id === 'jab' ? 0.6 : 1 }]);
      for (const h of hits) {
        if (!(prev < h.t && this.time >= h.t)) continue;
        this.apply(h.t, 0);
        this.kick(this.springV, h.impulse, 1.3);
        this.kick(this.springA, a.recoil);
        // whole-body reaction: pushed back by the momentum, leaning back (or folding for body shots)
        if (a.kind === 'hit') {
          const fold = (h.impulse.spine?.[0] ?? 0) > 0 ? 1 : -1;
          this.springV.vel[2] -= 3.4 * h.big;
          this.springV.vel[3] += fold * 4.2 * h.big;
          this.springV.vel[1] -= 0.8 * h.big;
        }
        this.attacker.root.updateMatrixWorld(true);
        this.victim.root.updateMatrixWorld(true);
        const pos = new THREE.Vector3();
        this.attacker.hand[h.hand].getWorldPosition(pos);
        if (a.kind === 'clash') {
          const p2 = new THREE.Vector3();
          this.victim.hand.R.getWorldPosition(p2);
          pos.lerp(p2, 0.5);
          this.spawnClash(pos);
          this.hitStop = 0.11;
          this.fovKick = 3.5;
        } else {
          pos.x += 0.05;
          this.spawnHit(pos, h.dir, h.big);
          if (a.kind === 'hit') {
            this.hitStop = Math.max(this.hitStop, 0.03 + 0.055 * h.big);
            this.fovKick = Math.max(this.fovKick, 2.6 * h.big);
          }
          if (a.detach && Math.abs(h.t - a.detach.t) < 1e-6) {
            // rip the head off: flies in the punch direction (attacker forward = world +x)
            const dv = a.detach.vel ?? [3.4, 3.0, 0];
            this.detachHead(new THREE.Vector3(dv[0], dv[1], dv[2] + (Math.random() - 0.5) * 0.4));
            const np = new THREE.Vector3();
            this.victim.joints.neck.localToWorld(np.set(0, 0.07, 0));
            for (let i = 0; i < 24; i++) {
              const v = new THREE.Vector3(0.5 + Math.random() * 2.5, 0.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2.5);
              this.addParticle(np, v, i % 3 ? 0xffd166 : 0xffffff, 0.004 + Math.random() * 0.007, 0.25 + Math.random() * 0.35, { gravity: 6, baseOp: 0.9 });
            }
            for (let i = 0; i < 4; i++) {
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.01), new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.9, roughness: 0.3, transparent: true }));
              mesh.position.copy(np);
              this.particles.push({ mesh, vel: new THREE.Vector3(1 + Math.random() * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2), life: 0, max: 1.0, gravity: 7, drag: 0.3, grow: 0, baseOp: 1 });
              this.scene.add(mesh);
            }
            this.hitStop = 0.16;
            this.fovKick = 5;
            this.shake = Math.max(this.shake, 0.05);
          }
        }
      }
      if (prev < a.impactTime && this.time >= a.impactTime) {
        const pos = new THREE.Vector3();
        if (a.kind === 'clash') {
          this.attacker.joints.ankleR.getWorldPosition(pos);
          this.spawnDust(pos, 5);
          this.victim.joints.ankleR.getWorldPosition(pos);
          this.spawnDust(pos, 5);
        } else {
          this.victim.joints.chest.getWorldPosition(pos);
          this.spawnDust(pos, a.id === 'jab' ? 12 : 40);
        }
      }
      if (this.time >= a.duration) {
        const over = this.time - a.duration;
        if (this.autoMode !== 'off') {
          const idx = ATTACK_ORDER.indexOf(a.id);
          let next: AttackId;
          if (this.autoMode === 'cycle') next = ATTACK_ORDER[(idx + 1) % ATTACK_ORDER.length];
          else {
            const others = ATTACK_ORDER.filter((x) => x !== a.id);
            next = others[Math.floor(Math.random() * others.length)];
          }
          this.fromA = this.lastA.slice();
          this.fromV = this.lastV.slice();
          this.blendT = 0;
          this.attack = ATTACKS[next];
          this.onAttack?.(next);
        }
        this.time = over;
        this.restoreHead();
      }
      this.onTime?.(this.time);
    }
    this.apply(this.time, this.playing ? this.animDt : 0, false);
    this.victim.root.updateMatrixWorld(true);
    this.updateHead(this.playing ? this.animDt : 0);
    this.updateStump(this.playing ? this.animDt : 0);
    this.updateRobotFx(realDt);
    this.updatePress(realDt);
    this.updateFx(realDt);

    const cine = this.cinematic && (this.attack.kind === 'clash' || !!this.attack.detach) && this.playing;
    if (cine) {
      this.camTarget = null;
      this.cinematicCam();
    } else {
      if (this.cineWas) this.setCamera('side');
      if (this.camTarget) {
        this.camera.position.lerp(this.camTarget.pos, 0.07);
        this.controls.target.lerp(this.camTarget.look, 0.07);
        if (this.camera.position.distanceTo(this.camTarget.pos) < 0.01) this.camTarget = null;
      }
      this.controls.update();
    }
    this.cineWas = cine;

    // camera punch-in on impact
    if (this.fovKick > 0.01 || this.camera.fov !== 42) {
      this.fovKick *= Math.pow(0.004, realDt);
      if (this.fovKick < 0.01) this.fovKick = 0;
      this.camera.fov = 42 - this.fovKick;
      this.camera.updateProjectionMatrix();
    }
    if (this.shake > 0.0005) {
      this.shake *= Math.pow(0.015, realDt);
      const f = this.clockT * 60;
      const off = new THREE.Vector3(Math.sin(f * 1.7) * this.shake, Math.cos(f * 2.3) * this.shake, Math.sin(f * 1.1) * this.shake * 0.5);
      this.camera.position.add(off);
      this.renderer.render(this.scene, this.camera);
      this.camera.position.sub(off);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.labelRenderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
