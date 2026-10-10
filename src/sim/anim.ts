import * as THREE from 'three';
import { JOINTS, type JointName } from './rig';

type V3 = [number, number, number];
export type J = Partial<Record<JointName, V3>>;

export interface Pose { p: V3; r: V3; j: J }
export interface Key { t: number; pose: Pose; sharp?: boolean }
export interface Phase { t: number; name: string; color: string }

export type AttackId =
  | 'clash' | 'freestyle' | 'jab' | 'cross' | 'hook' | 'uppercut' | 'overhand'
  | 'combo123' | 'comboLiver' | 'comboRapid'
  | 'tauntBeckon' | 'tauntChin' | 'tauntFlex'
  | 'comboAtom' | 'comboBodyHead' | 'comboDoubleHook' | 'comboZeus'
  | 'tauntDance' | 'tauntSlam' | 'tauntSpin' | 'tauntThrone'
  | 'overdrive' | 'comboIppo' | 'comboAli'
  | 'tyson86' | 'tysonSlip' | 'tysonRush' | 'mayweather' | 'leonardBolo';

export interface Track {
  times: number[];
  vals: number[][];
  mIn: number[][];
  mOut: number[][];
}

export interface Hit { t: number; hand: 'L' | 'R'; impulse: J; dir: V3; big: number }

export interface Attack {
  id: AttackId;
  kind: 'hit' | 'clash' | 'show';
  name: string;
  target: string;
  icon: string;
  desc: string;
  hand: 'L' | 'R';
  duration: number;
  hitTime: number;
  impactTime: number;
  hitPart: 'head' | 'chest' | 'fist' | 'none';
  sparkDir: V3;
  powerDown?: [number, number];
  stun?: [number, number];
  charge?: [number, number];
  glitch?: [number, number];
  /** angular velocity kick (rad/s) applied to the victim's spring layer at impact */
  impulse: J;
  /** recoil kick applied to the attacker at impact */
  recoil: J;
  /** multiple impacts (combos) */
  hits?: Hit[];
  /** OVERDRIVE: head detaches at t, flies (physics), magnetically returns during reattach window */
  detach?: { t: number; reattach: [number, number]; vel?: V3 };
  /** window where both robots are locked to the exact key poses (grab must stay on the head) */
  lock?: [number, number];
  /** attacker-only power charge glow window */
  odCharge?: [number, number];
  category?: 'special' | 'single' | 'combo' | 'taunt';
  /** time-scale keys [animTime, scale] (slow motion) */
  slowmo?: [number, number][];
  /** pushing / pressing phase (fists locked) */
  press?: [number, number];
  /** moment both robots shove off */
  release?: number;
  phases: Phase[];
  attacker: Track;
  victim: Track;
}

// ================= helpers =================
const merge = (base: Pose, o: { p?: V3; r?: V3; j?: J }): Pose => ({
  p: o.p ?? base.p,
  r: o.r ?? base.r,
  j: { ...base.j, ...(o.j ?? {}) },
});
const at = (pose: Pose, z: number, y = pose.p[1]): Pose => ({ ...pose, p: [pose.p[0], y, z] });

const plant = (pose: Pose, sides: ('L' | 'R')[] = ['L', 'R']): Pose => {
  const j: J = { ...pose.j };
  for (const s of sides) {
    const hip = j[('hip' + s) as JointName]?.[0] ?? 0;
    const knee = j[('knee' + s) as JointName]?.[0] ?? 0;
    const a = j[('ankle' + s) as JointName] ?? [0, 0, 0];
    j[('ankle' + s) as JointName] = [-(pose.r[0] + hip + knee), a[1], a[2]];
  }
  return { ...pose, j };
};

const Z3: V3 = [0, 0, 0];
const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const j: J = {};
  for (const n of JOINTS) j[n] = mix3(a.j[n] ?? Z3, b.j[n] ?? Z3, k);
  return { p: mix3(a.p, b.p, k), r: mix3(a.r, b.r, k), j };
};

/** kinetic chain: hips/legs lead (kBody), chest + punching arm lag behind (kArm) */
const chain = (a: Pose, b: Pose, side: 'L' | 'R', kBody: number, kArm: number): Pose => {
  const P = mixPose(a, b, kBody);
  const arm: JointName[] = [('clav' + side) as JointName, ('shoulder' + side) as JointName, ('elbow' + side) as JointName, ('wrist' + side) as JointName, 'chest', 'head'];
  for (const n of arm) P.j[n] = mix3(a.j[n] ?? Z3, b.j[n] ?? Z3, kArm);
  return plant(P);
};

// ================= FK skeleton (mirrors rig.ts offsets) =================
const SK = (() => {
  const mk = (parent: THREE.Object3D | null, pos: V3) => {
    const o = new THREE.Object3D();
    o.position.set(...pos);
    parent?.add(o);
    return o;
  };
  const root = mk(null, [0, 0, 0]);
  root.rotation.order = 'YXZ';
  const pelvis = mk(root, [0, 0, 0]);
  const waist = mk(pelvis, [0, 0.08, 0]);
  const spine = mk(waist, [0, 0.12, 0]);
  const chest = mk(spine, [0, 0.12, 0]);
  const neck = mk(chest, [0, 0.25, 0]);
  const head = mk(neck, [0, 0.09, 0]);
  const headC = mk(head, [0, 0.11, 0]);
  const arm = (s: number) => {
    const clav = mk(chest, [s * 0.06, 0.2, 0]);
    const sh = mk(clav, [s * 0.15, 0, 0]);
    const el = mk(sh, [0, -0.28, 0]);
    const wr = mk(el, [0, -0.26, 0]);
    const kn = mk(wr, [0, -0.127, 0.005]);
    return { clav, sh, el, wr, kn };
  };
  const L = arm(1), R = arm(-1);
  const map: Partial<Record<JointName, THREE.Object3D>> = {
    pelvis, waist, spine, chest, neck, head,
    clavL: L.clav, shoulderL: L.sh, elbowL: L.el, wristL: L.wr,
    clavR: R.clav, shoulderR: R.sh, elbowR: R.el, wristR: R.wr,
  };
  return { root, map, headC, L, R };
})();

function setPose(p: Pose) {
  SK.root.position.set(...p.p);
  SK.root.rotation.set(p.r[0], p.r[1], p.r[2], 'YXZ');
  for (const [n, o] of Object.entries(SK.map)) {
    const v = p.j[n as JointName] ?? Z3;
    o!.rotation.set(v[0], v[1], v[2]);
  }
  SK.root.updateMatrixWorld(true);
}
const wpos = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

interface AimOpts { elbow?: THREE.Vector3; lockElbow?: boolean; rootZ?: boolean }

/** numeric IK so the knuckles land exactly on T */
function aim(pose: Pose, side: 'L' | 'R', T: THREE.Vector3, o: AimOpts = {}): Pose {
  const sh = ('shoulder' + side) as JointName, el = ('elbow' + side) as JointName;
  const P: Pose = { p: [...pose.p] as V3, r: [...pose.r] as V3, j: { ...pose.j } };
  P.j[sh] = [...(P.j[sh] ?? Z3)] as V3;
  P.j[el] = [...(P.j[el] ?? Z3)] as V3;
  const params: { arr: V3; i: number; init: number; w: number; min: number; max: number }[] = [];
  const add = (arr: V3, i: number, w: number, min = -10, max = 10) => params.push({ arr, i, init: arr[i], w, min, max });
  add(P.j[sh]!, 0, 1);
  add(P.j[sh]!, 1, 1.5);
  add(P.j[sh]!, 2, 1);
  if (!o.lockElbow) add(P.j[el]!, 0, 1, -2.6, 0);
  if (o.rootZ) add(P.p, 2, 0.05);
  const arm = SK[side];
  const cost = () => {
    setPose(P);
    let c = wpos(arm.kn).distanceToSquared(T) * 1000;
    if (o.elbow) c += wpos(arm.el).distanceToSquared(o.elbow) * 40;
    for (const q of params) { const d = q.arr[q.i] - q.init; c += d * d * q.w * 0.05; }
    return c;
  };
  let best = cost();
  let step = 0.3;
  for (let it = 0; it < 600 && step > 0.0003; it++) {
    let improved = false;
    for (const q of params) {
      const v0 = q.arr[q.i];
      for (const d of [step, -step]) {
        q.arr[q.i] = Math.max(q.min, Math.min(q.max, v0 + d));
        const c = cost();
        if (c < best) { best = c; improved = true; break; }
        q.arr[q.i] = v0;
      }
    }
    if (!improved) step *= 0.5;
  }
  return plant(P);
}

// ================= base poses =================
const guard: Pose = plant({
  p: [0, 0.95, 0],
  r: [0, 0, 0],
  j: {
    spine: [0.05, 0, 0],
    shoulderL: [-1.0, 0, 0.25], elbowL: [-1.9, 0, 0],
    shoulderR: [-0.8, 0, -0.3], elbowR: [-2.1, 0, 0],
    hipL: [-0.35, 0, 0.1], kneeL: [0.5, 0, 0],
    hipR: [-0.05, 0, -0.1], kneeR: [0.4, 0, 0],
  },
});
/** boxer bounce - low */
const gDown = (z = 0, base = guard): Pose => plant(merge(base, { p: [0, 0.92, z], j: { hipL: [-0.42, 0, 0.1], kneeL: [0.64, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.55, 0, 0] } }));
/** boxer bounce - high (on the toes) */
const gUp = (z = 0, base = guard): Pose => plant(merge(base, { p: [0, 0.965, z], j: { hipL: [-0.3, 0, 0.1], kneeL: [0.38, 0, 0], hipR: [-0.02, 0, -0.1], kneeR: [0.3, 0, 0] } }));

const vIdle: Pose = plant(merge(guard, {
  j: { shoulderL: [-0.95, 0, 0.42], elbowL: [-1.95, 0, 0], shoulderR: [-0.95, 0, -0.42], elbowR: [-1.95, 0, 0] },
}));
const vPre: Pose = merge(vIdle, { p: [0, 0.95, 0.02] });
const vTight = (z: number, y = 0.93): Pose => plant(merge(vIdle, {
  p: [0, y, z], r: [0.06, 0, 0],
  j: { head: [0.15, 0, 0], shoulderL: [-1.15, 0, 0.32], elbowL: [-2.3, 0, 0], shoulderR: [-1.15, 0, -0.32], elbowR: [-2.3, 0, 0], hipL: [-0.42, 0, 0.1], kneeL: [0.62, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.55, 0, 0] },
}));

function vHead(off: V3) {
  setPose(vPre);
  const w = SK.headC.localToWorld(new THREE.Vector3(...off));
  return new THREE.Vector3(-w.x, w.y, 1.3 - w.z);
}

const standby = (z: number, head: V3 = [0.12, 0, 0]): Pose => plant({
  p: [0, 0.97, z], r: [0, 0, 0],
  j: {
    head,
    shoulderL: [-0.05, 0, 0.12], elbowL: [-1.57, 0, 0],
    shoulderR: [-0.05, 0, -0.12], elbowR: [-1.57, 0, 0],
    hipL: [-0.12, 0, 0.08], kneeL: [0.18, 0, 0],
    hipR: [-0.12, 0, -0.08], kneeR: [0.18, 0, 0],
  },
});
const rigid = (z: number, extra: J = {}): Pose => plant({
  p: [0, 0.98, z], r: [0, 0, 0],
  j: {
    shoulderL: [0, 0, 0.1], elbowL: [-0.1, 0, 0],
    shoulderR: [0, 0, -0.1], elbowR: [-0.1, 0, 0],
    hipL: [-0.03, 0, 0.08], kneeL: [0.06, 0, 0],
    hipR: [-0.03, 0, -0.08], kneeR: [0.06, 0, 0],
    ...extra,
  },
});
const calibrate = (z: number): Pose => rigid(z, { shoulderL: [0, 0, 1.57], elbowL: [0, 0, 0], shoulderR: [0, 0, -1.57], elbowR: [0, 0, 0] });

const limp: J = { shoulderL: [0.05, 0, 0.1], elbowL: [-0.15, 0, 0], shoulderR: [0.05, 0, -0.1], elbowR: [-0.15, 0, 0] };

const lyingAt = (z: number, spread = false): Pose => ({
  p: [0, 0.13, z], r: [-Math.PI / 2, 0.05, 0],
  j: {
    head: [0.1, 0, 0],
    shoulderL: spread ? [-0.1, 0, 1.45] : [0.1, 0, 0.5], elbowL: [-0.15, 0, 0],
    shoulderR: spread ? [-0.1, 0, -1.5] : [0.1, 0, -0.5], elbowR: [-0.15, 0, 0],
    hipL: [0, 0, 0.1], kneeL: [0.03, 0, 0], ankleL: [0.3, 0, 0],
    hipR: [0, 0, -0.1], kneeR: [0.03, 0, 0], ankleR: [0.3, 0, 0],
  },
});
const kneelP = (z: number, yaw = 0, extra: J = {}): Pose => ({
  p: [0, 0.55, z], r: [0.2, yaw, 0],
  j: {
    spine: [0.2, 0, 0], head: [0.35, 0, 0], ...limp,
    hipL: [-0.2, 0, 0.1], kneeL: [1.57, 0, 0], ankleL: [1.4, 0, 0],
    hipR: [-0.2, 0, -0.1], kneeR: [1.57, 0, 0], ankleR: [1.4, 0, 0],
    ...extra,
  },
});
const allFoursP = (z: number, yaw = 0, extra: J = {}): Pose => ({
  p: [0, 0.52, z], r: [1.35, yaw, 0],
  j: {
    neck: [-0.1, 0, 0], head: [0.3, 0, 0],
    shoulderL: [-1.2, 0, 0.15], elbowL: [-0.6, 0, 0], wristL: [-0.9, 0, 0],
    shoulderR: [-1.2, 0, -0.15], elbowR: [-0.6, 0, 0], wristR: [-0.9, 0, 0],
    hipL: [-1.35, 0, 0.1], kneeL: [1.57, 0, 0], ankleL: [1.4, 0, 0],
    hipR: [-1.35, 0, -0.1], kneeR: [1.57, 0, 0], ankleR: [1.4, 0, 0],
    ...extra,
  },
});
const proneP = (z: number, extra: J = {}): Pose => ({
  p: [0, 0.125, z], r: [Math.PI / 2, 0, 0],
  j: {
    head: [-0.15, 0.7, 0],
    shoulderL: [-0.25, 0, 0.55], elbowL: [-0.3, 0, 0],
    shoulderR: [-0.25, 0, -0.55], elbowR: [-0.3, 0, 0],
    hipL: [0, 0, 0.1], kneeL: [0.05, 0, 0], ankleL: [1.35, 0, 0],
    hipR: [0, 0, -0.1], kneeR: [0.05, 0, 0], ankleR: [1.35, 0, 0],
    ...extra,
  },
});

function marchHome(t: number, z: number, dt = 0.5, base = guard): Key[] {
  const z1 = z * 0.6, z2 = z * 0.25;
  return [
    { t, pose: plant(merge(at(base, z1, 0.97), { j: { hipL: [-0.85, 0, 0.1], kneeL: [1.0, 0, 0], hipR: [0.1, 0, -0.1], kneeR: [0.15, 0, 0] } }), ['R']) },
    { t: t + dt, pose: plant(merge(at(base, z2, 0.97), { j: { hipR: [-0.75, 0, -0.1], kneeR: [1.0, 0, 0], hipL: [0.05, 0, 0.1], kneeL: [0.15, 0, 0] } }), ['L']) },
  ];
}

const bounceIn: Key[] = [
  { t: 0, pose: guard },
  { t: 0.22, pose: gDown(0) },
  { t: 0.44, pose: gUp(0.02) },
];
const victimIntro = (hit: number): Key[] => [
  { t: 0, pose: vIdle },
  { t: hit * 0.3, pose: gDown(0, vIdle) },
  { t: hit * 0.62, pose: gUp(0.01, vIdle) },
  { t: hit, pose: vPre, sharp: true },
];

// =============== robot reboot sequences ===============
function rebootFromBack(t0: number, LZ: number, spread = false) {
  const lying = lyingAt(LZ, spread);
  const SZ = LZ + 0.45;
  const hingeSit: Pose = {
    p: [0, 0.14, LZ], r: [0, 0, 0],
    j: { spine: [0.05, 0, 0], shoulderL: [0.15, 0, 0.3], shoulderR: [0.15, 0, -0.3], hipL: [-1.57, 0, 0.1], hipR: [-1.57, 0, -0.1] },
  };
  const tuck: Pose = plant({
    p: [0, 0.18, LZ + 0.05], r: [0.25, 0, 0],
    j: {
      spine: [0.2, 0, 0],
      shoulderL: [-0.9, 0, 0.12], elbowL: [-0.6, 0, 0], shoulderR: [-0.9, 0, -0.12], elbowR: [-0.6, 0, 0],
      hipL: [-2.5, 0, 0.15], kneeL: [2.1, 0, 0], hipR: [-2.5, 0, -0.15], kneeR: [2.1, 0, 0],
    },
  });
  const squat: Pose = plant({
    p: [0, 0.6, LZ + 0.1], r: [0.35, 0, 0],
    j: {
      spine: [0.15, 0, 0], head: [-0.4, 0, 0],
      shoulderL: [-0.9, 0, 0.1], elbowL: [-0.8, 0, 0], shoulderR: [-0.9, 0, -0.1], elbowR: [-0.8, 0, 0],
      hipL: [-1.75, 0, 0.12], kneeL: [1.2, 0, 0], hipR: [-1.75, 0, -0.12], kneeR: [1.2, 0, 0],
    },
  });
  const keys: Key[] = [
    { t: t0, pose: lying },
    { t: t0 + 0.35, sharp: true, pose: merge(lying, { j: { shoulderR: [0.3, 0, -0.2], elbowR: [-0.8, 0, 0], head: [0.1, 0.4, 0] } }) },
    { t: t0 + 0.55, sharp: true, pose: lying },
    { t: t0 + 1.0, pose: lying },
    { t: t0 + 1.6, pose: hingeSit },
    { t: t0 + 1.9, sharp: true, pose: merge(hingeSit, { j: { head: [0, 0.7, 0] } }) },
    { t: t0 + 2.2, sharp: true, pose: merge(hingeSit, { j: { head: [0, -0.7, 0] } }) },
    { t: t0 + 2.45, pose: hingeSit },
    { t: t0 + 2.95, pose: tuck },
    { t: t0 + 3.55, pose: squat },
    { t: t0 + 4.2, pose: rigid(SZ) },
    { t: t0 + 4.65, pose: calibrate(SZ) },
    { t: t0 + 5.0, pose: calibrate(SZ) },
    { t: t0 + 5.45, pose: at(vIdle, SZ) },
    ...marchHome(t0 + 5.95, SZ, 0.5, vIdle),
    { t: t0 + 6.95, pose: vIdle },
  ];
  return { keys, standT: t0 + 4.2, end: t0 + 6.95, bootT: t0 + 1.0 };
}

function riseFromFours(s: number, zf: number) {
  const z1 = zf + 0.03, SZ = zf + 0.25;
  const arms90: J = { shoulderL: [-0.3, 0, 0.1], elbowL: [-1.57, 0, 0], shoulderR: [-0.3, 0, -0.1], elbowR: [-1.57, 0, 0] };
  const keys: Key[] = [
    { t: s, pose: kneelP(z1, 0, { spine: [0.05, 0, 0], head: [0, 0, 0], ...arms90 }) },
    {
      t: s + 0.55,
      pose: {
        p: [0, 0.56, z1], r: [0.05, 0, 0],
        j: { spine: [0.1, 0, 0], ...arms90, hipL: [-1.6, 0, 0.1], kneeL: [1.6, 0, 0], ankleL: [-0.05, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [1.57, 0, 0], ankleR: [1.0, 0, 0] },
      },
    },
    {
      t: s + 1.1,
      pose: {
        p: [0, 0.8, z1 + 0.12], r: [0.3, 0, 0],
        j: { spine: [0.1, 0, 0], head: [-0.2, 0, 0], ...arms90, hipL: [-1.3, 0, 0.1], kneeL: [1.07, 0, 0], ankleL: [-0.07, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.5, 0, 0], ankleR: [0.2, 0, 0] },
      },
    },
    { t: s + 1.6, pose: rigid(SZ) },
    { t: s + 2.0, pose: calibrate(SZ) },
    { t: s + 2.35, pose: calibrate(SZ) },
    { t: s + 2.8, pose: at(vIdle, SZ) },
    ...marchHome(s + 3.3, SZ, 0.5, vIdle),
    { t: s + 4.3, pose: vIdle },
  ];
  return { keys, standT: s + 1.6, end: s + 4.3 };
}

function attackerOutro(t: number, z: number, standT: number, end: number, back = 0.15): Key[] {
  const zb = z - back;
  const raw: Key[] = [
    { t: t + 0.45, pose: gDown(z - back * 0.6) },
    { t: t + 0.8, pose: gUp(zb) },
    { t: t + 1.15, pose: gDown(zb) },
    { t: t + 1.7, pose: standby(zb) },
    { t: t + 2.2, sharp: true, pose: standby(zb, [0.15, 0.5, 0]) },
    { t: t + 2.7, sharp: true, pose: standby(zb, [0.15, -0.5, 0]) },
    { t: t + 3.1, pose: standby(zb, [0.2, 0, 0]) },
    { t: standT + 0.2, pose: standby(zb, [0.05, 0, 0]) },
    { t: standT + 0.75, pose: at(guard, zb, 0.95) },
    { t: end - 0.55, pose: at(guard, zb * 0.4, 0.95) },
    { t: end, pose: guard },
  ];
  const out: Key[] = [];
  for (const k of raw) {
    const last = out[out.length - 1];
    if (!last || k.t > last.t + 0.25) out.push(k);
  }
  return out;
}

// ================================================================
// CLASH - both throw a right cross with full momentum, fists collide
// ================================================================
function makeClash() {
  const HIT = 1.32;
  const T = new THREE.Vector3(0, 1.4, 0.65);
  return makeClashPress(HIT, T);
}

/** old knock-back version kept for reference */
export function makeClashKnockback() {
  const HIT = 1.32;
  const T = new THREE.Vector3(0, 1.4, 0.65);
  const cross = aim(plant({
    p: [0, 0.89, 0.35], r: [0.09, 0.5, 0],
    j: {
      spine: [0.06, 0, 0], chest: [0, 0.15, 0], head: [-0.12, -0.5, 0],
      shoulderR: [-1.6, 0, 0.15], elbowR: [-0.04, 0, 0],
      shoulderL: [-0.65, 0, 0.35], elbowL: [-2.3, 0, 0],
      hipL: [-0.72, 0, 0.1], kneeL: [0.6, 0, 0],
      hipR: [0.32, 0, -0.1], kneeR: [0.2, 0, 0],
    },
  }), 'R', T, { lockElbow: true, rootZ: true });
  const cz = cross.p[2];
  const sR = cross.j.shoulderR!;
  const load = plant(merge(guard, {
    p: [0, 0.89, 0.16], r: [0.06, -0.32, 0],
    j: {
      chest: [0, -0.14, 0], head: [-0.08, 0.32, 0],
      shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0],
      shoulderL: [-1.1, 0, 0.2], elbowL: [-1.7, 0, 0],
      hipL: [-0.52, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.66, 0, 0],
    },
  }));
  const zr = cz - 0.42;
  const keys: Key[] = [
    ...bounceIn,
    { t: 0.66, pose: gDown(0.05) },
    // step in + lead hand paws to measure distance
    { t: 0.88, pose: plant(merge(gUp(0.12), { r: [0.03, -0.1, 0], j: { shoulderL: [-1.35, 0, 0.12], elbowL: [-0.95, 0, 0], head: [-0.08, 0.1, 0] } })) },
    // load: hips coil back, weight on rear leg
    { t: 1.08, pose: load },
    // drive: hips fire first, arm follows
    { t: 1.22, pose: chain(load, cross, 'R', 0.78, 0.38) },
    { t: HIT, sharp: true, pose: cross },
    // compression: arm buckles from the collision
    { t: HIT + 0.08, pose: plant(merge(cross, { p: [0, 0.9, cz - 0.06], r: [0.04, cross.r[1] - 0.12, 0], j: { shoulderR: [sR[0] + 0.35, sR[1], sR[2] - 0.12], elbowR: [-0.9, 0, 0], wristR: [0.35, 0, 0] } })) },
    // knocked back: rear foot catches the weight
    {
      t: HIT + 0.36,
      pose: plant({
        p: [0, 0.91, cz - 0.36], r: [-0.08, 0.15, 0],
        j: {
          chest: [-0.06, 0.05, 0], head: [0.05, -0.12, 0],
          shoulderR: [-0.3, 0, -0.5], elbowR: [-0.7, 0, 0], wristR: [0.4, 0, 0],
          shoulderL: [-0.95, 0, 0.35], elbowL: [-1.9, 0, 0],
          hipL: [-0.2, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [0.25, 0, -0.12], kneeR: [0.45, 0, 0],
        },
      }),
    },
    { t: HIT + 0.62, pose: merge(gDown(zr), { j: { shoulderR: [-0.35, 0, -0.35], elbowR: [-1.1, 0, 0] } }) },
    // shake out the right arm servo
    { t: HIT + 0.9, sharp: true, pose: merge(gDown(zr), { j: { shoulderR: [-0.4, 0, -0.4], elbowR: [-0.8, 0, 0], wristR: [0.7, 0, 0], head: [0.1, -0.35, 0] } }) },
    { t: HIT + 1.08, sharp: true, pose: merge(gDown(zr), { j: { shoulderR: [-0.5, 0, -0.35], elbowR: [-1.5, 0, 0], wristR: [-0.5, 0, 0], head: [0.1, -0.35, 0] } }) },
    { t: HIT + 1.4, pose: gUp(zr) },
    { t: HIT + 1.75, pose: gDown(zr * 0.6) },
    { t: HIT + 2.1, pose: gUp(zr * 0.25) },
    { t: HIT + 2.5, pose: guard },
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing - saling ukur', color: '#38bdf8' },
    { t: 0.8, name: 'Step-in + tangan kiri ukur jarak', color: '#a3e635' },
    { t: 1.02, name: 'Pinggul memutar - CROSS!', color: '#f97316' },
    { t: HIT, name: '💥 TINJU KANAN BERTABRAKAN', color: '#ef4444' },
    { t: HIT + 0.15, name: 'Keduanya terdorong mundur', color: '#f43f5e' },
    { t: HIT + 0.8, name: 'Kibas servo lengan kanan', color: '#8b5cf6' },
    { t: HIT + 1.4, name: 'Kembali siaga', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 0.36, END: HIT + 2.5, keys, phases };
}

// ================================================================
// CLASH (PRESS) - fists meet, both robots drive INTO each other
// ================================================================
export function makeClashPressOld(HIT: number, T: THREE.Vector3) {
  const cross = aim(plant({
    p: [0, 0.89, 0.35], r: [0.09, 0.5, 0],
    j: {
      spine: [0.06, 0, 0], chest: [0, 0.15, 0], head: [-0.12, -0.5, 0],
      shoulderR: [-1.6, 0, 0.15], elbowR: [-0.04, 0, 0],
      shoulderL: [-0.65, 0, 0.35], elbowL: [-2.3, 0, 0],
      hipL: [-0.72, 0, 0.1], kneeL: [0.6, 0, 0],
      hipR: [0.32, 0, -0.1], kneeR: [0.2, 0, 0],
    },
  }), 'R', T, { lockElbow: true, rootZ: true });
  const cz = cross.p[2];
  const sR = cross.j.shoulderR!;
  const load = plant(merge(guard, {
    p: [0, 0.89, 0.16], r: [0.06, -0.32, 0],
    j: {
      chest: [0, -0.14, 0], head: [-0.08, 0.32, 0],
      shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0],
      shoulderL: [-1.1, 0, 0.2], elbowL: [-1.7, 0, 0],
      hipL: [-0.52, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.66, 0, 0],
    },
  }));

  /** body drives forward by d, leans in; the right fist stays locked on the contact point */
  const press = (d: number, lean: number, yaw: number, low: number, elbow: number, extra: J = {}) => aim(plant({
    p: [0, 0.89 - low, cz + d], r: [0.09 + lean, yaw, 0],
    j: {
      spine: [0.08 + lean * 0.5, 0, 0], chest: [0.05, 0.1, 0], head: [-0.15 - lean * 1.2, -yaw * 0.9, 0],
      shoulderR: [sR[0], sR[1], sR[2]], elbowR: [elbow, 0, 0],
      shoulderL: [-1.2, 0, 0.32], elbowL: [-2.3, 0, 0],
      hipL: [-0.8 - low * 2.5, 0, 0.12], kneeL: [0.8 + low * 3.5, 0, 0],
      hipR: [0.42 + lean * 0.6, 0, -0.12], kneeR: [0.12, 0, 0],
      ...extra,
    },
  }), 'R', T);

  const contact = cross;
  const drive1 = press(0.08, 0.12, 0.42, 0.02, -0.6);
  const drive2 = press(0.15, 0.2, 0.36, 0.04, -1.1);
  const strainA = press(0.13, 0.17, 0.4, 0.035, -0.95, { head: [-0.32, -0.3, 0.06] });
  const strainB = press(0.18, 0.23, 0.32, 0.05, -1.25, { head: [-0.42, -0.32, -0.05] });
  const maxPush = press(0.2, 0.26, 0.3, 0.06, -1.35, { head: [-0.45, -0.3, 0] });

  const zr = cz - 0.32;
  const R0 = HIT;
  const REL = R0 + 1.5;
  const keys: Key[] = [
    ...bounceIn,
    { t: 0.66, pose: gDown(0.05) },
    { t: 0.88, pose: plant(merge(gUp(0.12), { r: [0.03, -0.1, 0], j: { shoulderL: [-1.35, 0, 0.12], elbowL: [-0.95, 0, 0], head: [-0.08, 0.1, 0] } })) },
    { t: 1.08, pose: load },
    { t: 1.22, pose: chain(load, cross, 'R', 0.78, 0.38) },
    // CONTACT
    { t: R0, sharp: true, pose: contact },
    // bodies keep driving forward - arms compress
    { t: R0 + 0.16, pose: drive1 },
    { t: R0 + 0.42, pose: drive2 },
    // power struggle - grinding back and forth
    { t: R0 + 0.68, pose: strainA },
    { t: R0 + 0.92, pose: strainB },
    { t: R0 + 1.12, pose: strainA },
    { t: R0 + 1.36, pose: maxPush },
    // SHOVE OFF - both explode backward from the locked fists
    {
      t: REL + 0.12, sharp: true,
      pose: plant({
        p: [0, 0.9, cz - 0.22], r: [-0.06, 0.25, 0],
        j: {
          chest: [-0.05, 0.08, 0], head: [-0.05, -0.2, 0],
          shoulderR: [-1.0, 0, -0.35], elbowR: [-0.5, 0, 0], wristR: [0.4, 0, 0],
          shoulderL: [-1.0, 0, 0.35], elbowL: [-1.9, 0, 0],
          hipL: [-0.3, 0, 0.12], kneeL: [0.4, 0, 0], hipR: [0.3, 0, -0.12], kneeR: [0.5, 0, 0],
        },
      }),
    },
    { t: REL + 0.4, pose: merge(gDown(zr), { j: { shoulderR: [-0.4, 0, -0.35], elbowR: [-1.1, 0, 0] } }) },
    // servo shake of the right arm
    { t: REL + 0.65, sharp: true, pose: merge(gDown(zr), { j: { shoulderR: [-0.4, 0, -0.4], elbowR: [-0.8, 0, 0], wristR: [0.7, 0, 0], head: [0.1, -0.35, 0] } }) },
    { t: REL + 0.82, sharp: true, pose: merge(gDown(zr), { j: { shoulderR: [-0.5, 0, -0.35], elbowR: [-1.5, 0, 0], wristR: [-0.5, 0, 0], head: [0.1, -0.35, 0] } }) },
    { t: REL + 1.1, pose: gUp(zr) },
    { t: REL + 1.45, pose: gDown(zr * 0.55) },
    { t: REL + 1.8, pose: gUp(zr * 0.2) },
    { t: REL + 2.2, pose: guard },
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing - saling ukur', color: '#38bdf8' },
    { t: 0.8, name: 'Step-in + tangan kiri ukur jarak', color: '#a3e635' },
    { t: 1.02, name: 'Pinggul memutar - CROSS!', color: '#f97316' },
    { t: R0, name: '💥 TINJU KANAN BERTEMU!', color: '#ef4444' },
    { t: R0 + 0.12, name: '⚡ SALING MENEKAN - badan merapat', color: '#f43f5e' },
    { t: R0 + 0.6, name: '🔥 ADU TENAGA - servo maksimal', color: '#dc2626' },
    { t: REL, name: 'SALING DORONG - terpental!', color: '#f97316' },
    { t: REL + 0.55, name: 'Kibas servo lengan kanan', color: '#8b5cf6' },
    { t: REL + 1.1, name: 'Kembali siaga', color: '#6366f1' },
  ];
  const slowmo: [number, number][] = [
    [0, 1], [R0 - 0.12, 1], [R0, 0.1], [R0 + 0.25, 0.22], [R0 + 1.2, 0.38], [REL, 0.45], [REL + 0.25, 1],
  ];
  return { HIT, IMPACT: REL + 0.4, END: REL + 2.2, keys, phases, slowmo, press: [R0 + 0.05, REL] as [number, number], release: REL };
}

// ================================================================
// CLASH (DYNAMIC) - both advance while swinging; fists meet mid-stride,
// momentum carries the bodies in, fists skid past each other, then separate
// ================================================================
function makeClashPress(HIT: number, T: THREE.Vector3) {
  const armClashBase = (z: number, yaw: number, lean: number, extra: J = {}): Pose => plant({
    p: [0, 0.89, z], r: [0.09 + lean, yaw, 0],
    j: {
      spine: [0.06 + lean * 0.4, 0, 0], chest: [0, 0.18, 0], head: [-0.12 - lean, -yaw, 0],
      shoulderR: [-1.30, 0, 0.48], elbowR: [-1.68, 0, 0],
      shoulderL: [-1.0, 0, 0.38], elbowL: [-2.3, 0, 0],
      hipL: [-0.75, 0, 0.1], kneeL: [0.62, 0, 0],
      hipR: [0.34 + lean * 0.5, 0, -0.1], kneeR: [0.18, 0, 0],
      ...extra,
    },
  });
  const cross = aim(armClashBase(0.35, 0.5, 0), 'R', T, { lockElbow: false, rootZ: true });
  const cz = cross.p[2];

  // step-in with the lead foot into dip and hook wind-up
  const step = plant(merge(gUp(cz * 0.35), {
    r: [0.06, -0.22, 0],
    j: {
      chest: [0, -0.14, 0], head: [-0.08, 0.22, 0],
      shoulderR: [-0.48, 0.10, 0.50], elbowR: [-2.0, 0, 0],
      shoulderL: [-1.15, 0, 0.25], elbowL: [-1.8, 0, 0],
      hipL: [-0.78, 0, 0.1], kneeL: [0.82, 0, 0], hipR: [0.06, 0, -0.1], kneeR: [0.45, 0, 0],
    },
  }), ['R']);
  // ancang-ancang hook mantap: deep hip & chest coil, dipped stance, right arm cocked high with flared elbow
  const load = plant(merge(guard, {
    p: [0, 0.86, cz * 0.62], r: [0.08, -0.42, -0.05],
    j: {
      chest: [0, -0.20, 0], head: [-0.08, 0.40, 0.05],
      shoulderR: [-0.42, 0.18, 0.66], elbowR: [-1.75, 0, 0],
      shoulderL: [-1.15, 0, 0.35], elbowL: [-2.1, 0, 0],
      hipL: [-0.72, 0, 0.12], kneeL: [0.85, 0, 0], hipR: [-0.18, 0, -0.12], kneeR: [0.72, 0, 0],
    },
  }));
  // momentum carries the body in; forearms collide and cross over each other (Arm-to-Arm Clash)
  const compress = aim(armClashBase(cz + 0.07, 0.5, 0.1, { shoulderR: [-1.30, 0, 0.48], elbowR: [-1.68, 0, 0] }), 'R', T);
  // HOLD: both stand their ground - locked arm-to-arm tension, rear leg driving, equal power struggle
  const hold1 = aim(armClashBase(cz + 0.09, 0.5, 0.13, { shoulderR: [-1.30, 0, 0.48], elbowR: [-1.68, 0, 0], head: [-0.3, -0.5, 0] }), 'R', T);
  const hold2 = aim(armClashBase(cz + 0.08, 0.5, 0.12, { shoulderR: [-1.30, 0, 0.48], elbowR: [-1.68, 0, 0], head: [-0.3, -0.5, 0] }), 'R', T);
  // push-off: both drive through the locked arms and spring apart, staying square
  const push = plant({
    p: [0, 0.9, cz - 0.2], r: [-0.04, 0.4, 0],
    j: {
      chest: [-0.03, 0.1, 0], head: [-0.08, -0.4, 0],
      shoulderR: [-1.3, 0, -0.1], elbowR: [-1.5, 0, 0],
      shoulderL: [-1.0, 0, 0.32], elbowL: [-1.95, 0, 0],
      hipL: [-0.35, 0, 0.1], kneeL: [0.42, 0, 0], hipR: [0.28, 0, -0.1], kneeR: [0.48, 0, 0],
    },
  });
  const zr = cz - 0.3;

  const R0 = HIT;
  const H0 = R0 + 0.12, H1 = R0 + 0.55, REL = R0 + 0.6;
  const keys: Key[] = [
    ...bounceIn,
    { t: 0.64, pose: gDown(0.03) },
    { t: 0.86, pose: step },
    { t: 1.04, pose: load },
    { t: 1.16, pose: chain(load, cross, 'R', 0.82, 0.42) },
    { t: R0, sharp: true, pose: cross },
    { t: H0, pose: compress },
    { t: (H0 + H1) / 2, pose: hold1 },
    { t: H1, pose: hold2 },
    { t: REL + 0.14, sharp: true, pose: push },
    { t: REL + 0.42, pose: merge(gDown(zr), { j: { shoulderR: [-0.9, 0, -0.35], elbowR: [-1.6, 0, 0] } }) },
    { t: REL + 0.75, pose: gUp(zr) },
    { t: REL + 1.05, pose: gDown(zr * 0.5) },
    { t: REL + 1.4, pose: guard },
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing - saling ukur', color: '#38bdf8' },
    { t: 0.7, name: 'Step-in + ancang-ancang hook mantap', color: '#a3e635' },
    { t: 1.04, name: 'Putaran pinggul & ayunan hook dahsyat!', color: '#f97316' },
    { t: R0, name: '⚔️ ARM-TO-ARM CLASH! Lengan bertabrakan!', color: '#ef4444' },
    { t: R0 + 0.06, name: '🛡️ TAHAN LENGAN - adu tenaga sama-sama kuat', color: '#f43f5e' },
    { t: REL, name: 'Saling dorong - memisah', color: '#fb923c' },
    { t: REL + 0.5, name: 'Kembali siaga', color: '#6366f1' },
  ];
  const slowmo: [number, number][] = [
    [0, 1], [R0 - 0.05, 1], [R0 + 0.01, 0.12], [H0, 0.16], [H1, 0.22], [REL + 0.1, 1],
  ];
  return { HIT, IMPACT: REL + 0.42, END: REL + 1.4, keys, phases, slowmo, press: [R0 + 0.02, REL] as [number, number], release: REL };
}

const smoothK = (x: number) => x * x * (3 - 2 * x);
/** time-scale at animation time t */
export function slowAt(a: { slowmo?: [number, number][] }, t: number) {
  const s = a.slowmo;
  if (!s || s.length === 0) return 1;
  if (t <= s[0][0]) return s[0][1];
  for (let i = 0; i < s.length - 1; i++) {
    const [t0, v0] = s[i], [t1, v1] = s[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * smoothK((t - t0) / (t1 - t0));
  }
  return s[s.length - 1][1];
}

// ================================================================
// JAB - snap lead straight, then slip out
// ================================================================
function makeJab() {
  const HIT = 1.02;
  const T = vHead([0, -0.01, 0.1]);
  const jab = aim(plant({
    p: [0, 0.93, 0.22], r: [0.06, -0.25, 0],
    j: {
      spine: [0.06, 0, 0], chest: [0, -0.12, 0], head: [-0.05, 0.28, 0],
      shoulderL: [-1.6, 0, 0.05], elbowL: [-0.04, 0, 0],
      shoulderR: [-0.85, 0, -0.25], elbowR: [-2.2, 0, 0],
      hipL: [-0.62, 0, 0.1], kneeL: [0.55, 0, 0],
      hipR: [0.14, 0, -0.1], kneeR: [0.3, 0, 0],
    },
  }), 'L', T, { lockElbow: true, rootZ: true });
  const jz = jab.p[2];
  const pre = plant(merge(gDown(0.08), { r: [0.04, 0.1, 0], j: { head: [-0.1, -0.1, 0], shoulderL: [-0.95, 0, 0.3], elbowL: [-2.0, 0, 0] } }));
  const slip = plant(merge(gDown(jz - 0.12), { r: [0.06, 0.12, 0.16], j: { spine: [0.06, 0, 0.06], head: [-0.05, 0, -0.12] } }));
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.66, pose: gDown(0.04) },
    { t: 0.84, pose: pre },
    { t: 0.95, pose: chain(pre, jab, 'L', 0.75, 0.45) },
    { t: HIT, sharp: true, pose: jab },
    { t: HIT + 0.07, pose: merge(jab, { j: { elbowL: [-0.25, 0, 0] } }) },
    // snap back on the same line and slip the head off-centre
    { t: HIT + 0.24, sharp: true, pose: slip },
    { t: HIT + 0.5, pose: gUp(jz - 0.15) },
    { t: HIT + 0.78, pose: gDown(jz - 0.15) },
    { t: HIT + 1.1, pose: gUp((jz - 0.15) * 0.6) },
    { t: HIT + 1.45, pose: gDown((jz - 0.15) * 0.25) },
    { t: HIT + 1.9, pose: guard },
  ];
  const victim: Key[] = [
    ...victimIntro(HIT),
    {
      t: HIT + 0.08,
      pose: plant(merge(vIdle, {
        p: [0, 0.95, -0.04], r: [-0.08, -0.04, 0],
        j: { neck: [-0.2, 0, 0], head: [-0.45, -0.18, 0.05], chest: [-0.08, -0.05, 0], shoulderL: [-0.85, 0, 0.55], elbowL: [-1.7, 0, 0], shoulderR: [-0.8, 0, -0.6], elbowR: [-1.6, 0, 0] },
      })),
    },
    // reflex: shell up the guard and step back
    { t: HIT + 0.3, pose: vTight(-0.18) },
    { t: HIT + 0.55, sharp: true, pose: merge(vTight(-0.22), { j: { head: [0.1, 0.3, 0] } }) },
    { t: HIT + 0.75, sharp: true, pose: merge(vTight(-0.22), { j: { head: [0.1, -0.2, 0] } }) },
    { t: HIT + 1.0, pose: vTight(-0.22) },
    { t: HIT + 1.4, pose: gUp(-0.12, vIdle) },
    { t: HIT + 1.9, pose: vIdle },
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing - ukur jarak', color: '#38bdf8' },
    { t: 0.8, name: 'Jab kilat tangan kiri', color: '#facc15' },
    { t: HIT, name: 'JAB KENA WAJAH! 👊', color: '#ef4444' },
    { t: HIT + 0.15, name: 'Tarik cepat + slip kepala', color: '#a3e635' },
    { t: HIT + 0.3, name: 'Lawan menutup guard', color: '#f97316' },
    { t: HIT + 1.1, name: 'Kembali siaga', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 0.3, END: HIT + 1.9, attacker, victim, phases, stun: [HIT, HIT + 0.5] as [number, number] };
}

// ================================================================
// CROSS - feint, coil, full hip rotation
// ================================================================
function makeCross() {
  const HIT = 1.25, LZ = -0.62, T0 = HIT + 1.55;
  const up = rebootFromBack(T0, LZ);
  const T = vHead([0, -0.01, 0.1]);
  const cross = aim(plant({
    p: [0, 0.89, 0.4], r: [0.11, 0.52, 0],
    j: {
      spine: [0.08, 0, 0], chest: [0, 0.18, 0], head: [-0.12, -0.52, 0],
      shoulderR: [-1.6, 0, 0.15], elbowR: [-0.04, 0, 0],
      shoulderL: [-0.6, 0, 0.38], elbowL: [-2.3, 0, 0],
      hipL: [-0.78, 0, 0.1], kneeL: [0.6, 0, 0],
      hipR: [0.32, 0, -0.1], kneeR: [0.2, 0, 0],
    },
  }), 'R', T, { lockElbow: true, rootZ: true });
  const load = plant(merge(guard, {
    p: [0, 0.89, 0.12], r: [0.06, -0.32, 0],
    j: { chest: [0, -0.15, 0], head: [-0.08, 0.32, 0], shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0], shoulderL: [-1.05, 0, 0.22], elbowL: [-1.8, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.66, 0, 0] },
  }));
  const follow = plant(merge(cross, { p: [0, 0.88, cross.p[2] + 0.03], r: [0.14, 0.66, 0], j: { chest: [0, 0.26, 0], elbowR: [-0.3, 0, 0] } }));
  const attacker: Key[] = [
    ...bounceIn,
    // lead-hand feint
    { t: 0.64, pose: plant(merge(gDown(0.05), { r: [0.04, -0.18, 0], j: { shoulderL: [-1.4, 0, 0.1], elbowL: [-0.8, 0, 0], head: [-0.08, 0.18, 0] } })) },
    { t: 0.86, pose: gUp(0.08) },
    { t: 1.06, pose: load },
    { t: 1.17, pose: chain(load, cross, 'R', 0.78, 0.36) },
    { t: HIT, sharp: true, pose: cross },
    { t: HIT + 0.12, pose: follow },
    { t: HIT + 0.35, pose: plant(merge(gDown(cross.p[2] - 0.05), { r: [0.05, 0.15, 0] })) },
    ...attackerOutro(HIT + 0.35, cross.p[2] - 0.05, up.standT, up.end),
  ];
  const sitFall: Pose = {
    p: [0, 0.16, LZ + 0.02], r: [-0.35, 0.06, 0],
    j: {
      spine: [0.15, 0, 0], head: [0.45, 0.25, 0.1],
      shoulderL: [0.25, 0, 0.35], elbowL: [-0.3, 0, 0], shoulderR: [0.25, 0, -0.4], elbowR: [-0.3, 0, 0],
      hipL: [-1.25, 0, 0.15], kneeL: [0.9, 0, 0], ankleL: [0.4, 0, 0],
      hipR: [-1.1, 0, -0.15], kneeR: [0.7, 0, 0], ankleR: [0.4, 0, 0],
    },
  };
  const lyingBent = merge(lyingAt(LZ), { j: { hipL: [-0.6, 0, 0.12], kneeL: [0.9, 0, 0], ankleL: [0.2, 0, 0], hipR: [-0.35, 0, -0.1], kneeR: [0.55, 0, 0], ankleR: [0.2, 0, 0], shoulderL: [-0.2, 0, 0.9], shoulderR: [-0.2, 0, -1.0] } });
  const victim: Key[] = [
    ...victimIntro(HIT),
    // head whips back, arms fly loose
    {
      t: HIT + 0.1,
      pose: plant(merge(vIdle, {
        p: [0, 0.96, -0.1], r: [-0.14, 0.06, 0],
        j: { neck: [-0.3, 0, 0], head: [-0.75, 0.3, 0.12], chest: [-0.2, 0.1, 0], shoulderL: [-0.6, 0, 0.95], elbowL: [-0.6, 0, 0], shoulderR: [-0.7, 0, -1.05], elbowR: [-0.5, 0, 0], hipL: [-0.25, 0, 0.1], kneeL: [0.25, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.25, 0, 0] },
      })),
    },
    // stagger: rear foot steps back, power cut -> head lolls
    {
      t: HIT + 0.38,
      pose: plant({
        p: [0, 0.9, -0.32], r: [-0.18, 0.12, 0.04],
        j: {
          chest: [-0.1, 0, 0], neck: [0.1, 0, 0], head: [0.35, 0.3, 0.2],
          shoulderL: [-0.3, 0, 0.55], elbowL: [-0.3, 0, 0], shoulderR: [-0.3, 0, -0.6], elbowR: [-0.3, 0, 0],
          hipL: [-0.5, 0, 0.12], kneeL: [0.35, 0, 0], hipR: [0.32, 0, -0.1], kneeR: [0.45, 0, 0],
        },
      }),
    },
    // knees buckle
    {
      t: HIT + 0.66,
      pose: plant({
        p: [0, 0.6, -0.48], r: [-0.06, 0.1, 0.03],
        j: { spine: [0.1, 0, 0], head: [0.5, 0.2, 0.15], ...limp, hipL: [-1.25, 0, 0.12], kneeL: [1.75, 0, 0], hipR: [-1.1, 0, -0.12], kneeR: [1.75, 0, 0] },
      }),
    },
    // butt hits the floor
    { t: HIT + 0.9, sharp: true, pose: sitFall },
    // back slams down, head bounces
    { t: HIT + 1.18, sharp: true, pose: lyingBent },
    { t: HIT + 1.3, pose: merge(lyingBent, { p: [0, 0.16, LZ], j: { head: [-0.35, 0.2, 0] } }) },
    { t: HIT + 1.42, sharp: true, pose: merge(lyingBent, { j: { head: [0.15, 0.3, 0] } }) },
    ...up.keys,
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing', color: '#38bdf8' },
    { t: 0.58, name: 'Feint tangan kiri', color: '#a3e635' },
    { t: 0.98, name: 'Coil pinggul - CROSS!', color: '#facc15' },
    { t: HIT, name: 'CROSS KENA WAJAH! 💥', color: '#ef4444' },
    { t: HIT + 0.2, name: 'Kepala tersentak, terhuyung', color: '#f97316' },
    { t: HIT + 0.55, name: 'Lutut lemas - jatuh', color: '#f43f5e' },
    { t: HIT + 1.15, name: 'Terbanting - POWER OFF 🔌', color: '#64748b' },
    { t: up.bootT, name: 'REBOOTING... 🔄', color: '#22c55e' },
    { t: T0 + 2.6, name: 'Bangkit (mekanis)', color: '#14b8a6' },
    { t: up.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
    { t: T0 + 5.4, name: 'Siaga lagi! 🤖', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 0.9, END: up.end, attacker, victim, phases, powerDown: [HIT + 1.2, up.bootT] as [number, number] };
}

// ================================================================
// HOOK - jab feint, dip, pivot through
// ================================================================
function makeHook() {
  const HIT = 1.3;
  const T = vHead([-0.105, 0.01, 0.02]);
  const E = T.clone().add(new THREE.Vector3(0.34, 0.02, -0.15));
  const hook = aim(plant({
    p: [0, 0.9, 0.28], r: [0.06, -0.55, 0],
    j: {
      chest: [0, -0.22, 0], head: [-0.05, 0.62, 0],
      shoulderL: [-0.15, -0.6, 1.45], elbowL: [-1.6, 0, 0],
      shoulderR: [-0.9, 0, -0.3], elbowR: [-2.2, 0, 0],
      hipL: [-0.5, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.45, 0, 0],
    },
  }), 'L', T, { elbow: E, rootZ: true });
  const load = plant(merge(guard, {
    p: [0.04, 0.88, 0.12], r: [0.06, 0.32, -0.1],
    j: { chest: [0, 0.12, 0], head: [-0.05, -0.35, 0.08], shoulderL: [-0.85, 0, 0.65], elbowL: [-1.8, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.62, 0, 0] },
  }));
  const zf = -0.3;
  const rise = riseFromFours(HIT + 2.9, zf);
  const attacker: Key[] = [
    ...bounceIn,
    // quick jab feint
    { t: 0.6, sharp: true, pose: plant(merge(gDown(0.06), { r: [0.04, -0.15, 0], j: { shoulderL: [-1.45, 0, 0.1], elbowL: [-0.65, 0, 0], head: [-0.08, 0.15, 0] } })) },
    { t: 0.8, pose: gUp(0.08) },
    // dip to the lead side, coil
    { t: 1.02, pose: load },
    { t: 1.2, pose: chain(load, hook, 'L', 0.75, 0.42) },
    { t: HIT, sharp: true, pose: hook },
    // pivot follow-through
    { t: HIT + 0.14, pose: plant(merge(hook, { r: [0.06, -0.78, 0.04], j: { chest: [0, -0.36, 0], head: [-0.05, 0.75, 0] } })) },
    { t: HIT + 0.38, pose: plant(merge(gDown(hook.p[2] - 0.05), { r: [0.04, -0.15, 0] })) },
    ...attackerOutro(HIT + 0.38, hook.p[2] - 0.05, rise.standT, rise.end),
  ];
  const victim: Key[] = [
    ...victimIntro(HIT),
    // head rotates violently
    {
      t: HIT + 0.09,
      pose: plant(merge(vIdle, {
        p: [0, 0.95, -0.03], r: [0, 0.15, 0.04],
        j: { neck: [0, 0.35, 0.12], head: [-0.1, 0.95, 0.35], chest: [0, 0.1, 0], shoulderL: [-0.7, 0, 0.7], elbowL: [-1.2, 0, 0], shoulderR: [-0.8, 0, -0.75], elbowR: [-1.3, 0, 0] },
      })),
    },
    // torso follows the head, arms fling out
    {
      t: HIT + 0.28,
      pose: plant(merge(vIdle, {
        p: [0, 0.92, -0.08], r: [0.02, 0.55, 0.08],
        j: { neck: [0, 0.2, 0.1], head: [0.1, 0.6, 0.25], chest: [0, 0.25, 0], shoulderL: [-0.2, 0, 1.2], elbowL: [-0.4, 0, 0], shoulderR: [-0.5, 0, -0.5], elbowR: [-0.6, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [-0.2, 0, -0.1], kneeR: [0.7, 0, 0] },
      })),
    },
    // legs tangle and give out
    {
      t: HIT + 0.52,
      pose: plant({
        p: [0, 0.76, -0.16], r: [0.15, 0.85, 0.12],
        j: { spine: [0.15, 0, 0], head: [0.35, 0.4, 0.25], ...limp, hipL: [-0.85, 0, -0.05], kneeL: [1.15, 0, 0], hipR: [-0.55, 0, 0.05], kneeR: [1.3, 0, 0] },
      }),
    },
    { t: HIT + 0.8, sharp: true, pose: kneelP(zf + 0.05, 0.75, { head: [0.5, 0.2, 0] }) },
    { t: HIT + 1.1, sharp: true, pose: allFoursP(zf, 0.6) },
    { t: HIT + 1.45, pose: allFoursP(zf, 0.55, { head: [0.6, 0, 0] }) },
    { t: HIT + 2.15, pose: allFoursP(zf, 0.5, { head: [0.6, 0, 0] }) },
    { t: HIT + 2.35, sharp: true, pose: allFoursP(zf, 0.5, { head: [-0.3, 0.3, 0] }) },
    { t: HIT + 2.55, sharp: true, pose: allFoursP(zf, 0.5, { head: [-0.3, -0.3, 0] }) },
    ...rise.keys,
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing', color: '#38bdf8' },
    { t: 0.55, name: 'Feint jab', color: '#a3e635' },
    { t: 0.9, name: 'Dip & pivot - HOOK!', color: '#facc15' },
    { t: HIT, name: 'HOOK KENA PELIPIS! 💥', color: '#ef4444' },
    { t: HIT + 0.15, name: 'Kepala terputar, badan ikut', color: '#f97316' },
    { t: HIT + 0.5, name: 'Kaki terbelit, ambruk', color: '#f43f5e' },
    { t: HIT + 1.1, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
    { t: HIT + 2.25, name: 'REBOOTING... 🔄', color: '#22c55e' },
    { t: HIT + 2.9, name: 'Bangkit bertahap', color: '#14b8a6' },
    { t: rise.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
    { t: rise.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 0.8, END: rise.end, attacker, victim, phases, powerDown: [HIT + 1.15, HIT + 2.25] as [number, number] };
}

// ================================================================
// UPPERCUT - slip outside, sink, explode upward
// ================================================================
function makeUppercut() {
  const HIT = 1.3, LZ = -1.3, T0 = HIT + 1.78;
  const up = rebootFromBack(T0, LZ, true);
  const T = vHead([0, -0.095, 0.07]);
  const E = T.clone().add(new THREE.Vector3(-0.05, -0.36, -0.12));
  const upc = aim(plant({
    p: [0, 0.96, 0.4], r: [-0.04, 0.32, 0],
    j: {
      chest: [-0.08, 0.12, 0], head: [-0.1, -0.35, 0],
      shoulderR: [-0.9, 0, 0.1], elbowR: [-1.75, 0, 0],
      shoulderL: [-0.8, 0, 0.3], elbowL: [-2.2, 0, 0],
      hipL: [-0.45, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.1, 0, 0],
    },
  }), 'R', T, { elbow: E, rootZ: true });
  const dip = plant(merge(guard, {
    p: [-0.03, 0.82, 0.18], r: [0.14, -0.3, 0.1],
    j: { spine: [0.12, 0, 0], head: [-0.25, 0.3, -0.05], shoulderR: [-0.25, 0, -0.25], elbowR: [-1.95, 0, 0], hipL: [-0.78, 0, 0.1], kneeL: [1.1, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [1.0, 0, 0] },
  }));
  const sR = upc.j.shoulderR!;
  const attacker: Key[] = [
    ...bounceIn,
    // slip outside (head off the centre line)
    { t: 0.66, sharp: true, pose: plant(merge(gDown(0.08), { p: [0.05, 0.89, 0.08], r: [0.1, -0.1, -0.16], j: { spine: [0.08, 0, -0.06], head: [-0.15, 0.1, 0.1] } })) },
    // sink onto the rear leg
    { t: 0.92, pose: dip },
    { t: 1.08, pose: merge(dip, { p: [-0.03, 0.8, 0.2] }) },
    // explode up: legs & hips drive first
    { t: 1.2, pose: plant(merge(chain(dip, upc, 'R', 0.72, 0.35), { j: { elbowR: [-1.85, 0, 0] } })) },
    { t: HIT, sharp: true, pose: upc },
    { t: HIT + 0.15, pose: plant(merge(upc, { p: [upc.p[0], upc.p[1] + 0.03, upc.p[2]], r: [-0.08, 0.4, 0], j: { shoulderR: [sR[0] - 0.4, sR[1], sR[2]] } })) },
    { t: HIT + 0.4, pose: gDown(upc.p[2] - 0.05) },
    ...attackerOutro(HIT + 0.4, upc.p[2] - 0.05, up.standT, up.end),
  ];
  const victim: Key[] = [
    ...victimIntro(HIT),
    {
      t: HIT + 0.12,
      pose: {
        p: [0, 1.04, -0.08], r: [-0.12, 0, 0],
        j: {
          chest: [-0.3, 0, 0], neck: [-0.4, 0, 0], head: [-0.9, 0, 0],
          shoulderL: [-1.2, 0, 0.9], elbowL: [-0.3, 0, 0], shoulderR: [-1.3, 0, -0.8], elbowR: [-0.3, 0, 0],
          hipL: [-0.05, 0, 0.06], kneeL: [0.05, 0, 0], ankleL: [0.55, 0, 0],
          hipR: [0, 0, -0.06], kneeR: [0.08, 0, 0], ankleR: [0.5, 0, 0],
        },
      },
    },
    {
      t: HIT + 0.45,
      pose: {
        p: [0, 1.0, -0.5], r: [-0.5, 0.05, 0],
        j: {
          chest: [-0.2, 0, 0], neck: [-0.25, 0, 0], head: [-0.5, 0.1, 0],
          shoulderL: [-2.2, 0, 0.6], elbowL: [-0.2, 0, 0], shoulderR: [-2.3, 0, -0.6], elbowR: [-0.2, 0, 0],
          hipL: [-0.3, 0, 0.1], kneeL: [0.2, 0, 0], ankleL: [0.4, 0, 0],
          hipR: [-0.15, 0, -0.1], kneeR: [0.3, 0, 0], ankleR: [0.4, 0, 0],
        },
      },
    },
    {
      t: HIT + 0.8,
      pose: {
        p: [0, 0.6, -1.0], r: [-1.05, 0.08, 0],
        j: {
          head: [0.2, 0.1, 0],
          shoulderL: [-1.8, 0, 1.0], elbowL: [-0.1, 0, 0], shoulderR: [-1.8, 0, -1.0], elbowR: [-0.1, 0, 0],
          hipL: [-0.4, 0, 0.12], kneeL: [0.3, 0, 0], ankleL: [0.3, 0, 0],
          hipR: [-0.4, 0, -0.12], kneeR: [0.3, 0, 0], ankleR: [0.3, 0, 0],
        },
      },
    },
    { t: HIT + 1.08, sharp: true, pose: merge(lyingAt(LZ, true), { j: { hipL: [-0.35, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [-0.35, 0, -0.12], kneeR: [0.3, 0, 0] } }) },
    { t: HIT + 1.25, pose: merge(lyingAt(LZ, true), { p: [0, 0.2, LZ - 0.05], r: [-Math.PI / 2 + 0.1, 0.05, 0], j: { head: [-0.2, 0, 0] } }) },
    { t: HIT + 1.48, sharp: true, pose: lyingAt(LZ, true) },
    ...up.keys,
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing', color: '#38bdf8' },
    { t: 0.6, name: 'Slip ke luar', color: '#a3e635' },
    { t: 0.88, name: 'Turun, tumpu kaki belakang', color: '#facc15' },
    { t: 1.15, name: 'Ledakkan ke atas!', color: '#f97316' },
    { t: HIT, name: 'UPPERCUT KENA DAGU! 💥', color: '#ef4444' },
    { t: HIT + 0.15, name: 'Unit terangkat & terlempar', color: '#f43f5e' },
    { t: HIT + 1.08, name: 'Menghantam lantai', color: '#dc2626' },
    { t: HIT + 1.45, name: 'KO - POWER OFF 🔌', color: '#64748b' },
    { t: up.bootT, name: 'REBOOTING... 🔄', color: '#22c55e' },
    { t: up.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
    { t: T0 + 5.4, name: 'Siaga lagi! 🤖', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 1.08, END: up.end, attacker, victim, phases, powerDown: [HIT + 1.12, up.bootT] as [number, number] };
}

// ================================================================
// OVERHAND - bob & weave, then loop over the top
// ================================================================
function makeOverhand() {
  const HIT = 1.38;
  const T = vHead([0.09, 0.03, 0.05]);
  const E = T.clone().add(new THREE.Vector3(-0.25, 0.17, -0.2));
  const ovh = aim(plant({
    p: [0, 0.86, 0.45], r: [0.25, 0.52, -0.08],
    j: {
      spine: [0.1, 0, 0], chest: [0.05, 0.15, 0], head: [-0.4, -0.5, 0],
      shoulderR: [-2.2, 3.0, 0.45], elbowR: [-1.0, 0, 0],
      shoulderL: [-0.6, 0, 0.4], elbowL: [-2.3, 0, 0],
      hipL: [-0.85, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [0.35, 0, -0.1], kneeR: [0.35, 0, 0],
    },
  }), 'R', T, { elbow: E, rootZ: true });
  const load = plant(merge(guard, {
    p: [0.05, 0.88, 0.14], r: [0.08, -0.35, -0.08],
    j: { chest: [0, -0.18, 0], head: [-0.1, 0.38, 0], shoulderR: [-1.45, 0, -1.05], elbowR: [-1.9, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.72, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.62, 0, 0] },
  }));
  const sR = ovh.j.shoulderR!;
  const zk = -0.3, zp = zk + 0.42;
  const rise = riseFromFours(HIT + 3.5, zk);
  const attacker: Key[] = [
    ...bounceIn,
    // bob: level change under an imaginary jab
    { t: 0.66, pose: plant(merge(guard, { p: [0, 0.8, 0.06], r: [0.22, 0, 0.1], j: { spine: [0.15, 0, 0], head: [-0.35, 0, 0], hipL: [-0.75, 0, 0.1], kneeL: [1.15, 0, 0], hipR: [-0.35, 0, -0.1], kneeR: [1.05, 0, 0] } })) },
    // weave out to the lead side
    { t: 0.9, pose: plant(merge(guard, { p: [0.06, 0.83, 0.1], r: [0.16, -0.25, -0.14], j: { spine: [0.1, 0, 0], head: [-0.25, 0.25, 0.1], hipL: [-0.65, 0, 0.1], kneeL: [0.95, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [0.85, 0, 0] } })) },
    // rise & cock the rear arm high
    { t: 1.1, pose: load },
    { t: 1.26, pose: plant(merge(chain(load, ovh, 'R', 0.72, 0.45), { p: [0.02, 0.9, (load.p[2] + ovh.p[2]) / 2] })) },
    { t: HIT, sharp: true, pose: ovh },
    // body weight falls through
    { t: HIT + 0.16, pose: plant(merge(ovh, { r: [0.34, 0.64, -0.08], j: { shoulderR: [sR[0] + 0.45, sR[1], sR[2]] } })) },
    { t: HIT + 0.42, pose: gDown(ovh.p[2] - 0.1) },
    ...attackerOutro(HIT + 0.42, ovh.p[2] - 0.1, rise.standT, rise.end, 0.5),
  ];
  const victim: Key[] = [
    ...victimIntro(HIT),
    // head driven down & sideways
    {
      t: HIT + 0.1,
      pose: plant(merge(vIdle, {
        p: [0, 0.87, -0.06], r: [0.16, -0.2, -0.1],
        j: { neck: [0.3, 0, 0], head: [0.6, -0.4, -0.28], spine: [0.2, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.7, 0, 0], shoulderR: [-0.3, 0, -0.6], elbowR: [-0.5, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.85, 0, 0], hipR: [-0.35, 0, -0.1], kneeR: [0.85, 0, 0] },
      })),
    },
    // legs drop straight down
    {
      t: HIT + 0.36,
      pose: plant({
        p: [0, 0.64, -0.2], r: [0.2, -0.15, 0],
        j: { spine: [0.25, 0, 0], head: [0.5, -0.2, 0], ...limp, hipL: [-1.1, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-1.1, 0, -0.1], kneeR: [1.6, 0, 0] },
      }),
    },
    { t: HIT + 0.58, sharp: true, pose: kneelP(zk, -0.1, { head: [0.5, 0, 0] }) },
    {
      t: HIT + 0.92,
      pose: {
        p: [0, 0.4, zk + 0.28], r: [0.95, -0.05, 0],
        j: {
          head: [0.3, 0.3, 0], ...limp, shoulderL: [-0.4, 0, 0.3], shoulderR: [-0.4, 0, -0.3],
          hipL: [-0.6, 0, 0.1], kneeL: [0.9, 0, 0], ankleL: [1.2, 0, 0],
          hipR: [-0.6, 0, -0.1], kneeR: [0.9, 0, 0], ankleR: [1.2, 0, 0],
        },
      },
    },
    { t: HIT + 1.18, sharp: true, pose: proneP(zp) },
    { t: HIT + 1.32, pose: merge(proneP(zp), { p: [0, 0.16, zp], r: [Math.PI / 2 - 0.07, 0, 0] }) },
    { t: HIT + 1.52, sharp: true, pose: proneP(zp) },
    { t: HIT + 2.15, pose: proneP(zp) },
    { t: HIT + 2.35, sharp: true, pose: proneP(zp, { head: [-0.3, 0.2, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.2, 0, 0] }) },
    { t: HIT + 2.55, sharp: true, pose: proneP(zp, { head: [-0.3, -0.2, 0] }) },
    {
      t: HIT + 2.95,
      pose: {
        p: [0, 0.3, zp - 0.05], r: [1.45, 0, 0],
        j: {
          head: [-0.3, 0, 0],
          shoulderL: [-1.3, 0, 0.15], elbowL: [-0.4, 0, 0], wristL: [-0.9, 0, 0],
          shoulderR: [-1.3, 0, -0.15], elbowR: [-0.4, 0, 0], wristR: [-0.9, 0, 0],
          hipL: [-0.3, 0, 0.1], kneeL: [0.4, 0, 0], ankleL: [1.3, 0, 0],
          hipR: [-0.3, 0, -0.1], kneeR: [0.4, 0, 0], ankleR: [1.3, 0, 0],
        },
      },
    },
    { t: HIT + 3.25, pose: allFoursP(zk, 0, { head: [-0.2, 0, 0] }) },
    ...rise.keys,
  ];
  const phases: Phase[] = [
    { t: 0, name: 'Bouncing', color: '#38bdf8' },
    { t: 0.55, name: 'Bob - merunduk', color: '#a3e635' },
    { t: 0.82, name: 'Weave ke samping', color: '#84cc16' },
    { t: 1.05, name: 'Angkat lengan - OVERHAND!', color: '#facc15' },
    { t: HIT, name: 'OVERHAND MENGHANTAM! 💥', color: '#ef4444' },
    { t: HIT + 0.15, name: 'Kaki lawan runtuh', color: '#f97316' },
    { t: HIT + 0.58, name: 'Jatuh berlutut', color: '#f43f5e' },
    { t: HIT + 1.18, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
    { t: HIT + 2.25, name: 'REBOOTING... 🔄', color: '#22c55e' },
    { t: HIT + 3.5, name: 'Bangkit bertahap', color: '#14b8a6' },
    { t: rise.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
    { t: rise.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
  ];
  return { HIT, IMPACT: HIT + 0.58, END: rise.end, attacker, victim, phases, powerDown: [HIT + 1.22, HIT + 2.25] as [number, number] };
}

// ================================================================
// FREESTYLE / ALI SHUFFLE - footwork showcase (no hit)
// ================================================================
function makeFreestyle(variant: 0 | 1) {
  const side = 1;
  const lowHands: J = {
    shoulderL: [-0.55, 0, 0.22], elbowL: [-1.55, 0, 0], wristL: [0.15, 0, 0],
    shoulderR: [-0.65, 0, -0.28], elbowR: [-1.85, 0, 0], wristR: [0.15, 0, 0],
  };
  const baseJ: J = { ...guard.j, ...lowHands };
  const legs = (lead: 'L' | 'R', spread: number, bend: number): J => {
    const f = -0.25 - spread, b = 0.05 + spread * 0.4;
    const LL = lead === 'L';
    return {
      hipL: [LL ? f : b, 0, 0.1], kneeL: [0.3 + bend, 0, 0],
      hipR: [LL ? b : f, 0, -0.1], kneeR: [0.25 + bend, 0, 0],
    };
  };
  const pose = (o: { x?: number; z?: number; air?: number; lead?: 'L' | 'R'; spread?: number; bend?: number; yaw?: number; roll?: number; j?: J }): Pose => {
    const air = o.air ?? 0, bend = o.bend ?? 0.1;
    const P = plant({
      p: [(o.x ?? 0) * side, 0.955 - bend * 0.12 + air, o.z ?? 0],
      r: [0.04, (o.yaw ?? 0) * side, (o.roll ?? 0) * side],
      j: { ...baseJ, ...legs(o.lead ?? 'L', o.spread ?? 0.1, bend), ...(o.j ?? {}) },
    });
    if (air > 0) {
      // airborne on the toes: point the feet
      const k = Math.min(1, air / 0.05) * 0.35;
      P.j.ankleL = [P.j.ankleL![0] + k, 0, 0];
      P.j.ankleR = [P.j.ankleR![0] + k, 0, 0];
    }
    return P;
  };

  const keys: Key[] = [{ t: 0, pose: guard }];
  let t = 0.05;
  const marks: number[] = [];
  const push = (dt: number, p: Pose, sharp = false) => { t += dt; keys.push({ t, pose: p, sharp }); };

  // 1) bouncing on the toes
  marks.push(t);
  for (let i = 0; i < 8; i++) push(0.17, i % 2 === 0 ? pose({ bend: 0.32 }) : pose({ air: 0.05, bend: 0.05 }));

  // 2) ALI SHUFFLE - feet switch rapidly in the air
  const shuffle = (n: number, extra: J = {}) => {
    let lead: 'L' | 'R' = 'L';
    for (let i = 0; i < n; i++) {
      const next: 'L' | 'R' = lead === 'L' ? 'R' : 'L';
      push(0.095, pose({ air: 0.045, lead, spread: 0, bend: 0.05, j: { ...extra, head: [-0.05, 0, (i % 2 ? 1 : -1) * 0.1] } }));
      push(0.095, pose({ lead: next, spread: 0.2, bend: 0.24, j: extra }));
      lead = next;
    }
  };
  marks.push(t);
  shuffle(8);

  // 3) lateral hops with head slips
  const lateral = () => {
    marks.push(t);
    let px = 0;
    for (const x of [0.18, 0, -0.18, 0]) {
      const dir = Math.sign(x - px);
      push(0.15, pose({ air: 0.06, x: (px + x) / 2, bend: 0.05, roll: -dir * 0.04 }));
      push(0.17, pose({ x, bend: 0.3, roll: dir * 0.07, j: { spine: [0.06, 0, dir * 0.12], head: [0, 0, dir * 0.18] } }));
      px = x;
    }
  };
  // 4) flicking jabs in the air while hopping back
  const jabs = () => {
    marks.push(t);
    const jabJ: J = { shoulderL: [-1.5, 0, 0.05], elbowL: [-0.12, 0, 0], wristL: [0, 0, 0], head: [-0.05, 0.2, 0] };
    push(0.16, pose({ air: 0.05, z: -0.08, bend: 0.05 }));
    push(0.14, pose({ z: -0.1, bend: 0.28 }));
    push(0.1, pose({ z: -0.06, bend: 0.2, yaw: -0.2, j: jabJ }), true);
    push(0.12, pose({ z: -0.08, bend: 0.2 }));
    push(0.1, pose({ z: -0.05, bend: 0.2, yaw: -0.2, j: jabJ }), true);
    push(0.14, pose({ air: 0.04, z: -0.08, bend: 0.1 }));
    push(0.12, pose({ z: -0.06, bend: 0.25, yaw: 0.35, j: { shoulderR: [-1.5, 0, 0.1], elbowR: [-0.12, 0, 0], chest: [0, 0.15, 0], head: [-0.05, -0.3, 0], hipR: [0.25, 0, -0.1] } }), true);
    push(0.16, pose({ z: -0.08, bend: 0.25 }));
    push(0.16, pose({ air: 0.05, z: -0.04, bend: 0.05 }));
    push(0.16, pose({ z: 0, bend: 0.3 }));
  };
  if (variant === 0) { lateral(); jabs(); } else { jabs(); lateral(); }

  // 5) showboat: hands dropped, head bobbing, then another shuffle
  marks.push(t);
  const down: J = { shoulderL: [0.05, 0, 0.2], elbowL: [-0.45, 0, 0], shoulderR: [0.05, 0, -0.2], elbowR: [-0.45, 0, 0] };
  for (let i = 0; i < 6; i++) {
    const d = i % 2 ? 1 : -1;
    push(0.17, pose({ air: i % 2 ? 0.05 : 0, bend: i % 2 ? 0.05 : 0.3, j: { ...down, head: [-0.15, 0, d * 0.25], chest: [0, 0, d * 0.08] } }));
  }
  shuffle(4, down);

  // 6) back to guard
  marks.push(t);
  push(0.2, gDown(0));
  push(0.25, gUp(0));
  push(0.3, guard);
  return { keys, end: t, marks };
}

// ================================================================
// =====================  COMBOS & TAUNTS  ========================
// ================================================================
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** point on the victim (victim pose) expressed in attacker space */
function vPoint(pose: Pose, part: 'head' | 'chest', off: V3) {
  setPose(pose);
  const obj = part === 'head' ? SK.headC : SK.map.chest!;
  const w = obj.localToWorld(new THREE.Vector3(...off));
  return new THREE.Vector3(-w.x, w.y, 1.3 - w.z);
}
/** point on the robot's own body (same space as the pose) */
function ownPoint(pose: Pose, obj: THREE.Object3D, off: V3) {
  setPose(pose);
  return obj.localToWorld(new THREE.Vector3(...off));
}

const IMP: Record<string, J> = {
  jab: { head: [-9, -3, 0], neck: [-4, 0, 0], chest: [-2, 0, 0], shoulderL: [0, 0, 3], shoulderR: [0, 0, -3] },
  cross: { head: [-14, 5, 3], neck: [-6, 0, 0], chest: [-4, 1, 0], shoulderL: [0, 0, 7], shoulderR: [0, 0, -7], elbowL: [4, 0, 0], elbowR: [4, 0, 0] },
  hook: { head: [-2, 16, 6], neck: [0, 6, 2], chest: [0, 4, 0], shoulderL: [0, 0, 6], shoulderR: [0, 0, -4] },
  body: { spine: [6, 0, 0], chest: [5, -3, 0], head: [5, -2, 0], shoulderR: [0, 0, -4], shoulderL: [2, 0, 0] },
  upper: { head: [-18, 0, 0], neck: [-8, 0, 0], chest: [-5, 0, 0], shoulderL: [-4, 0, 6], shoulderR: [-4, 0, -6] },
  guard: { head: [-3, 0, 0], chest: [-1.5, 0, 0], shoulderL: [-4, 0, 2], shoulderR: [-4, 0, -2], elbowL: [3, 0, 0], elbowR: [3, 0, 0] },
  over: { head: [12, -5, -6], neck: [5, 0, 0], chest: [3, 0, 0], shoulderL: [0, 0, 4], shoulderR: [0, 0, -4] },
};

// ---------- attacker punch base poses ----------
const jabBase = (z: number): Pose => plant({ p: [0, 0.93, z], r: [0.06, -0.25, 0], j: { spine: [0.06, 0, 0], chest: [0, -0.12, 0], head: [-0.05, 0.28, 0], shoulderL: [-1.6, 0, 0.05], elbowL: [-0.04, 0, 0], shoulderR: [-0.85, 0, -0.25], elbowR: [-2.2, 0, 0], hipL: [-0.62, 0, 0.1], kneeL: [0.55, 0, 0], hipR: [0.14, 0, -0.1], kneeR: [0.3, 0, 0] } });
const crossBaseP = (z: number): Pose => plant({ p: [0, 0.89, z], r: [0.11, 0.52, 0], j: { spine: [0.08, 0, 0], chest: [0, 0.18, 0], head: [-0.12, -0.52, 0], shoulderR: [-1.6, 0, 0.15], elbowR: [-0.04, 0, 0], shoulderL: [-0.6, 0, 0.38], elbowL: [-2.3, 0, 0], hipL: [-0.78, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [0.32, 0, -0.1], kneeR: [0.2, 0, 0] } });
const hookBase = (z: number): Pose => plant({ p: [0, 0.9, z], r: [0.06, -0.55, 0], j: { chest: [0, -0.22, 0], head: [-0.05, 0.62, 0], shoulderL: [-0.15, -0.6, 1.45], elbowL: [-1.6, 0, 0], shoulderR: [-0.9, 0, -0.3], elbowR: [-2.2, 0, 0], hipL: [-0.5, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.45, 0, 0] } });
const upcBase = (z: number): Pose => plant({ p: [0, 0.96, z], r: [-0.04, 0.32, 0], j: { chest: [-0.08, 0.12, 0], head: [-0.1, -0.35, 0], shoulderR: [-0.9, 0, 0.1], elbowR: [-1.75, 0, 0], shoulderL: [-0.8, 0, 0.3], elbowL: [-2.2, 0, 0], hipL: [-0.45, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.1, 0, 0] } });
const ovhBase = (z: number): Pose => plant({ p: [0, 0.86, z], r: [0.25, 0.52, -0.08], j: { spine: [0.1, 0, 0], chest: [0.05, 0.15, 0], head: [-0.4, -0.5, 0], shoulderR: [-2.2, 3.0, 0.45], elbowR: [-1.0, 0, 0], shoulderL: [-0.6, 0, 0.4], elbowL: [-2.3, 0, 0], hipL: [-0.85, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [0.35, 0, -0.1], kneeR: [0.35, 0, 0] } });

// ---------- victim knockdown sequences (after the final hit H, starting from z0) ----------
function fallSpin(H: number, z0: number) {
  const zf = z0 - 0.3;
  const rise = riseFromFours(H + 2.9, zf);
  const keys: Key[] = [
    { t: H + 0.09, pose: plant(merge(vIdle, { p: [0, 0.95, z0 - 0.03], r: [0, 0.15, 0.04], j: { neck: [0, 0.35, 0.12], head: [-0.1, 0.95, 0.35], chest: [0, 0.1, 0], shoulderL: [-0.7, 0, 0.7], elbowL: [-1.2, 0, 0], shoulderR: [-0.8, 0, -0.75], elbowR: [-1.3, 0, 0] } })) },
    { t: H + 0.28, pose: plant(merge(vIdle, { p: [0, 0.92, z0 - 0.08], r: [0.02, 0.55, 0.08], j: { neck: [0, 0.2, 0.1], head: [0.1, 0.6, 0.25], chest: [0, 0.25, 0], shoulderL: [-0.2, 0, 1.2], elbowL: [-0.4, 0, 0], shoulderR: [-0.5, 0, -0.5], elbowR: [-0.6, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [-0.2, 0, -0.1], kneeR: [0.7, 0, 0] } })) },
    { t: H + 0.52, pose: plant({ p: [0, 0.76, z0 - 0.16], r: [0.15, 0.85, 0.12], j: { spine: [0.15, 0, 0], head: [0.35, 0.4, 0.25], ...limp, hipL: [-0.85, 0, -0.05], kneeL: [1.15, 0, 0], hipR: [-0.55, 0, 0.05], kneeR: [1.3, 0, 0] } }) },
    { t: H + 0.8, sharp: true, pose: kneelP(zf + 0.05, 0.75, { head: [0.5, 0.2, 0] }) },
    { t: H + 1.1, sharp: true, pose: allFoursP(zf, 0.6) },
    { t: H + 1.45, pose: allFoursP(zf, 0.55, { head: [0.6, 0, 0] }) },
    { t: H + 2.15, pose: allFoursP(zf, 0.5, { head: [0.6, 0, 0] }) },
    { t: H + 2.35, sharp: true, pose: allFoursP(zf, 0.5, { head: [-0.3, 0.3, 0] }) },
    { t: H + 2.55, sharp: true, pose: allFoursP(zf, 0.5, { head: [-0.3, -0.3, 0] }) },
    ...rise.keys,
  ];
  return { keys, standT: rise.standT, end: rise.end, impact: H + 0.8, powerDown: [H + 1.15, H + 2.25] as [number, number] };
}

function fallLaunch(H: number, z0: number) {
  const LZ = z0 - 1.3, T0 = H + 1.78;
  const up = rebootFromBack(T0, LZ, true);
  const keys: Key[] = [
    { t: H + 0.12, pose: { p: [0, 1.04, z0 - 0.08], r: [-0.12, 0, 0], j: { chest: [-0.3, 0, 0], neck: [-0.4, 0, 0], head: [-0.9, 0, 0], shoulderL: [-1.2, 0, 0.9], elbowL: [-0.3, 0, 0], shoulderR: [-1.3, 0, -0.8], elbowR: [-0.3, 0, 0], hipL: [-0.05, 0, 0.06], kneeL: [0.05, 0, 0], ankleL: [0.55, 0, 0], hipR: [0, 0, -0.06], kneeR: [0.08, 0, 0], ankleR: [0.5, 0, 0] } } },
    { t: H + 0.45, pose: { p: [0, 1.0, z0 - 0.5], r: [-0.5, 0.05, 0], j: { chest: [-0.2, 0, 0], neck: [-0.25, 0, 0], head: [-0.5, 0.1, 0], shoulderL: [-2.2, 0, 0.6], elbowL: [-0.2, 0, 0], shoulderR: [-2.3, 0, -0.6], elbowR: [-0.2, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: [0.2, 0, 0], ankleL: [0.4, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.3, 0, 0], ankleR: [0.4, 0, 0] } } },
    { t: H + 0.8, pose: { p: [0, 0.6, z0 - 1.0], r: [-1.05, 0.08, 0], j: { head: [0.2, 0.1, 0], shoulderL: [-1.8, 0, 1.0], elbowL: [-0.1, 0, 0], shoulderR: [-1.8, 0, -1.0], elbowR: [-0.1, 0, 0], hipL: [-0.4, 0, 0.12], kneeL: [0.3, 0, 0], ankleL: [0.3, 0, 0], hipR: [-0.4, 0, -0.12], kneeR: [0.3, 0, 0], ankleR: [0.3, 0, 0] } } },
    { t: H + 1.08, sharp: true, pose: merge(lyingAt(LZ, true), { j: { hipL: [-0.35, 0, 0.12], kneeL: [0.3, 0, 0], hipR: [-0.35, 0, -0.12], kneeR: [0.3, 0, 0] } }) },
    { t: H + 1.25, pose: merge(lyingAt(LZ, true), { p: [0, 0.2, LZ - 0.05], r: [-Math.PI / 2 + 0.1, 0.05, 0], j: { head: [-0.2, 0, 0] } }) },
    { t: H + 1.48, sharp: true, pose: lyingAt(LZ, true) },
    ...up.keys,
  ];
  return { keys, standT: up.standT, end: up.end, impact: H + 1.08, powerDown: [H + 1.12, up.bootT] as [number, number] };
}

function fallCrumple(H: number, z0: number) {
  const zk = z0 - 0.3, zp = zk + 0.42;
  const rise = riseFromFours(H + 3.5, zk);
  const keys: Key[] = [
    { t: H + 0.1, pose: plant(merge(vIdle, { p: [0, 0.87, z0 - 0.06], r: [0.16, -0.2, -0.1], j: { neck: [0.3, 0, 0], head: [0.6, -0.4, -0.28], spine: [0.2, 0, 0], shoulderL: [-0.4, 0, 0.6], elbowL: [-0.7, 0, 0], shoulderR: [-0.3, 0, -0.6], elbowR: [-0.5, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.85, 0, 0], hipR: [-0.35, 0, -0.1], kneeR: [0.85, 0, 0] } })) },
    { t: H + 0.36, pose: plant({ p: [0, 0.64, z0 - 0.2], r: [0.2, -0.15, 0], j: { spine: [0.25, 0, 0], head: [0.5, -0.2, 0], ...limp, hipL: [-1.1, 0, 0.1], kneeL: [1.6, 0, 0], hipR: [-1.1, 0, -0.1], kneeR: [1.6, 0, 0] } }) },
    { t: H + 0.58, sharp: true, pose: kneelP(zk, -0.1, { head: [0.5, 0, 0] }) },
    { t: H + 0.92, pose: { p: [0, 0.4, zk + 0.28], r: [0.95, -0.05, 0], j: { head: [0.3, 0.3, 0], ...limp, shoulderL: [-0.4, 0, 0.3], shoulderR: [-0.4, 0, -0.3], hipL: [-0.6, 0, 0.1], kneeL: [0.9, 0, 0], ankleL: [1.2, 0, 0], hipR: [-0.6, 0, -0.1], kneeR: [0.9, 0, 0], ankleR: [1.2, 0, 0] } } },
    { t: H + 1.18, sharp: true, pose: proneP(zp) },
    { t: H + 1.32, pose: merge(proneP(zp), { p: [0, 0.16, zp], r: [Math.PI / 2 - 0.07, 0, 0] }) },
    { t: H + 1.52, sharp: true, pose: proneP(zp) },
    { t: H + 2.15, pose: proneP(zp) },
    { t: H + 2.35, sharp: true, pose: proneP(zp, { head: [-0.3, 0.2, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.2, 0, 0] }) },
    { t: H + 2.55, sharp: true, pose: proneP(zp, { head: [-0.3, -0.2, 0] }) },
    { t: H + 2.95, pose: { p: [0, 0.3, zp - 0.05], r: [1.45, 0, 0], j: { head: [-0.3, 0, 0], shoulderL: [-1.3, 0, 0.15], elbowL: [-0.4, 0, 0], wristL: [-0.9, 0, 0], shoulderR: [-1.3, 0, -0.15], elbowR: [-0.4, 0, 0], wristR: [-0.9, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: [0.4, 0, 0], ankleL: [1.3, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [0.4, 0, 0], ankleR: [1.3, 0, 0] } } },
    { t: H + 3.25, pose: allFoursP(zk, 0, { head: [-0.2, 0, 0] }) },
    ...rise.keys,
  ];
  return { keys, standT: rise.standT, end: rise.end, impact: H + 0.58, powerDown: [H + 1.22, H + 2.25] as [number, number] };
}

interface ComboData { attacker: Key[]; victim: Key[]; hits: Hit[]; phases: Phase[]; end: number; impact: number; powerDown?: [number, number]; hitPart: 'head' | 'chest' }

// ---------------- JURUS 1: 1-2-3 (Jab - Cross - Hook) ----------------
function makeCombo123(): ComboData {
  const J1 = 0.95, J2 = 1.22, J3 = 1.55;
  const vC: Pose = plant(merge(vIdle, { p: [0, 0.95, -0.06], r: [-0.03, 0, 0], j: { head: [-0.15, -0.08, 0], shoulderL: [-0.9, 0, 0.5], elbowL: [-1.8, 0, 0], shoulderR: [-0.9, 0, -0.55], elbowR: [-1.8, 0, 0] } }));
  const vH: Pose = plant(merge(vIdle, { p: [0, 0.93, -0.2], r: [-0.05, -0.05, 0], j: { head: [-0.3, 0.15, 0.05], chest: [-0.08, 0, 0], shoulderL: [-0.5, 0, 0.6], elbowL: [-1.0, 0, 0], shoulderR: [-0.5, 0, -0.6], elbowR: [-1.0, 0, 0] } }));
  const jab = aim(jabBase(0.22), 'L', vPoint(vPre, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
  const cross = aim(crossBaseP(0.35), 'R', vPoint(vC, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
  const Th = vPoint(vH, 'head', [-0.105, 0.01, 0.02]);
  const hook = aim(hookBase(0.4), 'L', Th, { elbow: Th.clone().add(V(0.34, 0.02, -0.15)), rootZ: true });
  const pre = plant(merge(gDown(0.08), { r: [0.04, 0.1, 0], j: { head: [-0.1, -0.1, 0] } }));
  const mid = plant(merge(gDown(jab.p[2]), { r: [0.05, -0.25, 0], j: { chest: [0, -0.12, 0], head: [-0.08, 0.25, 0], shoulderR: [-0.65, 0, -0.38], elbowR: [-2.25, 0, 0] } }));
  const hookLoad = plant(merge(guard, { p: [0.03, 0.89, cross.p[2]], r: [0.07, 0.38, -0.06], j: { chest: [0, 0.15, 0], head: [-0.05, -0.38, 0.06], shoulderL: [-0.85, 0, 0.65], elbowL: [-1.8, 0, 0], shoulderR: [-1.0, 0, -0.3], elbowR: [-2.1, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.1, 0, -0.1], kneeR: [0.6, 0, 0] } }));
  const fall = fallSpin(J3, -0.2);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.64, pose: gDown(0.04) },
    { t: 0.82, pose: pre },
    { t: 0.9, pose: chain(pre, jab, 'L', 0.75, 0.45) },
    { t: J1, sharp: true, pose: jab },
    { t: J1 + 0.1, pose: mid },
    { t: J2 - 0.07, pose: chain(mid, cross, 'R', 0.8, 0.4) },
    { t: J2, sharp: true, pose: cross },
    { t: J2 + 0.13, pose: hookLoad },
    { t: J3 - 0.09, pose: chain(hookLoad, hook, 'L', 0.75, 0.42) },
    { t: J3, sharp: true, pose: hook },
    { t: J3 + 0.14, pose: plant(merge(hook, { r: [0.06, -0.78, 0.04], j: { chest: [0, -0.36, 0], head: [-0.05, 0.75, 0] } })) },
    { t: J3 + 0.4, pose: plant(merge(gDown(hook.p[2] - 0.05), { r: [0.04, -0.15, 0] })) },
    ...attackerOutro(J3 + 0.4, hook.p[2] - 0.05, fall.standT, fall.end),
  ];
  const victim: Key[] = [
    ...victimIntro(J1),
    { t: J1 + 0.08, pose: plant(merge(vIdle, { p: [0, 0.95, -0.04], r: [-0.07, -0.04, 0], j: { neck: [-0.18, 0, 0], head: [-0.4, -0.15, 0.05], shoulderL: [-0.85, 0, 0.55], elbowL: [-1.7, 0, 0], shoulderR: [-0.8, 0, -0.6], elbowR: [-1.6, 0, 0] } })) },
    { t: J2, sharp: true, pose: vC },
    { t: J2 + 0.1, pose: plant(merge(vIdle, { p: [0, 0.95, -0.14], r: [-0.12, 0.05, 0], j: { neck: [-0.3, 0, 0], head: [-0.7, 0.25, 0.1], chest: [-0.15, 0.05, 0], shoulderL: [-0.5, 0, 0.9], elbowL: [-0.6, 0, 0], shoulderR: [-0.6, 0, -1.0], elbowR: [-0.5, 0, 0] } })) },
    { t: J3, sharp: true, pose: vH },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    hits: [
      { t: J1, hand: 'L', impulse: IMP.jab, dir: [1, 0.15, 0], big: 0.6 },
      { t: J2, hand: 'R', impulse: IMP.cross, dir: [1, 0.2, 0], big: 0.9 },
      { t: J3, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 1.25 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.8, name: '1 - JAB!', color: '#facc15' },
      { t: J2 - 0.1, name: '2 - CROSS!', color: '#f97316' },
      { t: J3 - 0.12, name: '3 - HOOK!', color: '#ef4444' },
      { t: J3 + 0.05, name: '💥 KOMBO 1-2-3 MASUK!', color: '#dc2626' },
      { t: J3 + 1.1, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
      { t: J3 + 2.25, name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------------- JURUS 2: Liver Hook -> Uppercut ----------------
function makeComboLiver(): ComboData {
  const H1 = 1.05, H2 = 1.48;
  // right-side rib surface (chest box half-width 0.2, half-depth 0.115)
  const Tb = vPoint(vPre, 'chest', [-0.2, 0.05, 0.08]);
  const body = aim(plant({ p: [0, 0.8, 0.25], r: [0.15, -0.5, 0], j: { spine: [0.15, 0, 0], chest: [0, -0.2, 0], head: [-0.3, 0.55, 0], shoulderL: [-0.4, -0.5, 1.2], elbowL: [-1.5, 0, 0], shoulderR: [-0.95, 0, -0.3], elbowR: [-2.2, 0, 0], hipL: [-0.85, 0, 0.1], kneeL: [1.05, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [0.95, 0, 0] } }), 'L', Tb, { elbow: Tb.clone().add(V(0.3, -0.02, -0.12)), rootZ: true });
  const vFold1: Pose = plant({ p: [0, 0.9, -0.04], r: [0.15, -0.25, 0.06], j: { spine: [0.2, 0, 0.08], chest: [0.1, -0.1, 0], head: [0.1, -0.1, 0], shoulderL: [-0.8, 0, 0.3], elbowL: [-1.9, 0, 0], shoulderR: [-0.3, 0, -0.1], elbowR: [-2.3, 0, 0], hipL: [-0.5, 0, 0.1], kneeL: [0.7, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [0.75, 0, 0] } });
  const vFold: Pose = plant({ p: [0, 0.84, -0.06], r: [0.32, -0.1, 0], j: { spine: [0.3, 0, 0], chest: [0.15, 0, 0], head: [0.05, 0, 0], shoulderL: [-0.5, 0, 0.15], elbowL: [-1.6, 0, 0], shoulderR: [-0.4, 0, -0.15], elbowR: [-1.3, 0, 0], hipL: [-0.75, 0, 0.1], kneeL: [0.95, 0, 0], hipR: [-0.6, 0, -0.1], kneeR: [0.9, 0, 0] } });
  const Tc = vPoint(vFold, 'head', [0, -0.095, 0.07]);
  const upc = aim(upcBase(0.4), 'R', Tc, { elbow: Tc.clone().add(V(-0.05, -0.36, -0.12)), rootZ: true });
  const dip = plant(merge(guard, { p: [0.04, 0.82, 0.1], r: [0.12, 0.3, -0.08], j: { spine: [0.12, 0, 0], head: [-0.25, -0.3, 0], shoulderL: [-0.8, 0, 0.6], elbowL: [-1.8, 0, 0], hipL: [-0.7, 0, 0.1], kneeL: [1.0, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [0.9, 0, 0] } }));
  const upLoad = plant(merge(guard, { p: [-0.02, 0.81, body.p[2]], r: [0.13, -0.38, 0.06], j: { spine: [0.12, 0, 0], head: [-0.25, 0.32, 0], shoulderL: [-1.0, 0, 0.3], elbowL: [-1.9, 0, 0], shoulderR: [-0.25, 0, -0.25], elbowR: [-1.95, 0, 0], hipL: [-0.8, 0, 0.1], kneeL: [1.1, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.0, 0, 0] } }));
  const fall = fallLaunch(H2, -0.06);
  const sR = upc.j.shoulderR!;
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.62, pose: gDown(0.04) },
    { t: 0.84, pose: dip },
    { t: H1 - 0.08, pose: chain(dip, body, 'L', 0.75, 0.42) },
    { t: H1, sharp: true, pose: body },
    { t: H1 + 0.18, pose: upLoad },
    { t: H2 - 0.1, pose: chain(upLoad, upc, 'R', 0.72, 0.35) },
    { t: H2, sharp: true, pose: upc },
    { t: H2 + 0.15, pose: plant(merge(upc, { p: [upc.p[0], upc.p[1] + 0.03, upc.p[2]], r: [-0.08, 0.4, 0], j: { shoulderR: [sR[0] - 0.4, sR[1], sR[2]] } })) },
    { t: H2 + 0.4, pose: gDown(upc.p[2] - 0.05) },
    ...attackerOutro(H2 + 0.4, upc.p[2] - 0.05, fall.standT, fall.end),
  ];
  const victim: Key[] = [
    ...victimIntro(H1),
    { t: H1 + 0.12, pose: vFold1 },
    { t: H2, sharp: true, pose: vFold },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'chest',
    hits: [
      { t: H1, hand: 'L', impulse: IMP.body, dir: [0.7, 0, 0.8], big: 1 },
      { t: H2, hand: 'R', impulse: IMP.upper, dir: [0.5, 1.3, 0], big: 1.35 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.7, name: 'Turun level - incar rusuk', color: '#a3e635' },
      { t: H1, name: '💥 LIVER HOOK KENA RUSUK!', color: '#f97316' },
      { t: H1 + 0.1, name: 'Badan lawan terlipat...', color: '#fb923c' },
      { t: H2 - 0.12, name: 'Sambung UPPERCUT!', color: '#facc15' },
      { t: H2, name: '💥 UPPERCUT KENA DAGU!', color: '#ef4444' },
      { t: H2 + 0.2, name: 'Unit terlempar', color: '#f43f5e' },
      { t: H2 + 1.45, name: 'KO - POWER OFF 🔌', color: '#64748b' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.25, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------------- JURUS 3: Rapid Fire (3 jabs pound the guard -> Overhand over the top) ----------------
function makeComboRapid(): ComboData {
  const J = [0.82, 0.98, 1.14], OH = 1.6;
  const vt = [vTight(0.0), vTight(-0.06), vTight(-0.12)];
  /** front face of the victim's two gloves held in front of the face (in attacker space) */
  const glove = (pose: Pose) => {
    setPose(pose);
    const l = SK.L.wr.localToWorld(new THREE.Vector3(0, -0.065, 0));
    const r = SK.R.wr.localToWorld(new THREE.Vector3(0, -0.065, 0));
    const m = l.add(r).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, 0.06));
    return new THREE.Vector3(-m.x, m.y, 1.3 - m.z);
  };
  const jabs = vt.map((v, i) => aim(jabBase(0.2 + i * 0.04), 'L', glove(v), { lockElbow: true, rootZ: true }));
  const vPeek = plant(merge(vTight(-0.18), { j: { head: [0.05, 0, 0], shoulderL: [-1.0, 0, 0.35], elbowL: [-2.1, 0, 0], shoulderR: [-1.0, 0, -0.35], elbowR: [-2.1, 0, 0] } }));
  const To = vPoint(vPeek, 'head', [0.09, 0.03, 0.05]);
  const ovh = aim(ovhBase(0.45), 'R', To, { elbow: To.clone().add(V(-0.25, 0.17, -0.2)), rootZ: true });
  const load = plant(merge(guard, { p: [0.05, 0.88, jabs[2].p[2]], r: [0.08, -0.35, -0.08], j: { chest: [0, -0.18, 0], head: [-0.1, 0.38, 0], shoulderR: [-1.45, 0, -1.05], elbowR: [-1.9, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.72, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.62, 0, 0] } }));
  const retract = (p: Pose) => merge(p, { j: { shoulderL: [-1.05, 0, 0.25], elbowL: [-1.85, 0, 0] } });
  const fall = fallCrumple(OH, -0.18);
  const sR = ovh.j.shoulderR!;
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.62, pose: gDown(0.06) },
    { t: 0.74, pose: plant(merge(gDown(0.1), { r: [0.04, -0.1, 0] })) },
    { t: J[0], sharp: true, pose: jabs[0] },
    { t: J[0] + 0.07, pose: retract(jabs[0]) },
    { t: J[1], sharp: true, pose: jabs[1] },
    { t: J[1] + 0.07, pose: retract(jabs[1]) },
    { t: J[2], sharp: true, pose: jabs[2] },
    { t: J[2] + 0.1, pose: retract(jabs[2]) },
    { t: OH - 0.22, pose: load },
    { t: OH - 0.1, pose: plant(merge(chain(load, ovh, 'R', 0.72, 0.45), { p: [0.02, 0.9, (load.p[2] + ovh.p[2]) / 2] })) },
    { t: OH, sharp: true, pose: ovh },
    { t: OH + 0.16, pose: plant(merge(ovh, { r: [0.34, 0.64, -0.08], j: { shoulderR: [sR[0] + 0.45, sR[1], sR[2]] } })) },
    { t: OH + 0.42, pose: gDown(ovh.p[2] - 0.1) },
    ...attackerOutro(OH + 0.42, ovh.p[2] - 0.1, fall.standT, fall.end, 0.5),
  ];
  const victim: Key[] = [
    { t: 0, pose: vIdle },
    { t: 0.35, pose: gDown(0, vIdle) },
    { t: 0.65, pose: vTight(0.01) },
    { t: J[0], sharp: true, pose: vt[0] },
    { t: J[0] + 0.07, pose: vTight(-0.04) },
    { t: J[1], sharp: true, pose: vt[1] },
    { t: J[1] + 0.07, pose: vTight(-0.1) },
    { t: J[2], sharp: true, pose: vt[2] },
    { t: J[2] + 0.08, pose: vTight(-0.16) },
    { t: OH, sharp: true, pose: vPeek },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    hits: [
      { t: J[0], hand: 'L', impulse: IMP.guard, dir: [1, 0.2, 0], big: 0.45 },
      { t: J[1], hand: 'L', impulse: IMP.guard, dir: [1, 0.2, 0], big: 0.45 },
      { t: J[2], hand: 'L', impulse: IMP.guard, dir: [1, 0.2, 0], big: 0.45 },
      { t: OH, hand: 'R', impulse: IMP.over, dir: [0.8, -0.7, -0.2], big: 1.35 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.7, name: 'RAPID FIRE - jab beruntun!', color: '#facc15' },
      { t: J[2] + 0.05, name: 'Guard lawan terbuka...', color: '#a3e635' },
      { t: OH - 0.22, name: 'OVERHAND dari atas!', color: '#f97316' },
      { t: OH, name: '💥 FINISH!', color: '#ef4444' },
      { t: OH + 0.58, name: 'Lawan ambruk', color: '#f43f5e' },
      { t: OH + 1.18, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
      { t: OH + 2.25, name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------------- TAUNTS ----------------
interface TauntData { attacker: Key[]; victim: Key[]; phases: Phase[]; end: number }

function bounceKeys(t0: number, t1: number, base = vIdle, z = 0): Key[] {
  const out: Key[] = [];
  let i = 0;
  for (let t = t0; t < t1 - 0.12; t += 0.3, i++) out.push({ t, pose: i % 2 ? gUp(z, base) : gDown(z, base) });
  return out;
}
const legsTall: J = { hipL: [-0.15, 0, 0.12], kneeL: [0.12, 0, 0], hipR: [-0.05, 0, -0.12], kneeR: [0.1, 0, 0] };
const shrugP = (z: number, tilt: number): Pose => plant({
  p: [0, 0.97, z], r: [0, 0, 0],
  j: { clavL: [0, 0, 0.28], clavR: [0, 0, -0.28], shoulderL: [-0.3, 0, 0.45], elbowL: [-1.45, 0, 0], shoulderR: [-0.3, 0, -0.45], elbowR: [-1.45, 0, 0], head: [-0.1, 0, tilt], hipL: [-0.15, 0, 0.1], kneeL: [0.15, 0, 0], hipR: [-0.1, 0, -0.1], kneeR: [0.15, 0, 0] },
});

// TAUNT 1: "Ayo Maju!" - beckoning + dusting off the shoulder
function makeTauntBeckon(): TauntData {
  const proud = (j: J = {}): Pose => plant({ p: [0, 0.97, 0.04], r: [0.02, 0, 0], j: { chest: [-0.04, 0, 0], head: [-0.12, 0, 0], shoulderL: [-0.05, 0, 0.12], elbowL: [-0.2, 0, 0], shoulderR: [-0.05, 0, -0.12], elbowR: [-0.2, 0, 0], ...legsTall, ...j } });
  const armOut: J = { shoulderR: [-1.35, 0, -0.1], elbowR: [-0.2, 0, 0], wristR: [-0.3, 0, 0] };
  const curl: J = { shoulderR: [-1.3, 0, -0.1], elbowR: [-1.85, 0, 0], wristR: [-0.9, 0, 0] };
  const both = (c: boolean): J => ({ shoulderR: [-1.3, 0, -0.25], elbowR: [c ? -1.85 : -0.25, 0, 0], wristR: [c ? -0.9 : -0.3, 0, 0], shoulderL: [-1.3, 0, 0.25], elbowL: [c ? -1.85 : -0.25, 0, 0], wristL: [c ? -0.9 : -0.3, 0, 0] });
  const dust0 = proud({ head: [-0.2, -0.4, 0] });
  const shPt = ownPoint(dust0, SK.R.sh, [0, 0.08, 0.06]);
  const dustA = aim(dust0, 'L', shPt.clone().add(V(0.02, 0.02, 0.04)), { elbow: shPt.clone().add(V(0.25, -0.2, 0.15)) });
  const dustB = aim(dust0, 'L', shPt.clone().add(V(-0.14, -0.05, 0.06)), { elbow: shPt.clone().add(V(0.2, -0.25, 0.15)) });
  const attacker: Key[] = [
    { t: 0, pose: guard }, { t: 0.25, pose: gDown(0) },
    { t: 0.55, pose: proud() },
    { t: 0.9, pose: proud(armOut) },
    { t: 1.12, pose: proud(curl) }, { t: 1.34, pose: proud(armOut) },
    { t: 1.56, pose: proud(curl) }, { t: 1.78, pose: proud(armOut) },
    { t: 2.0, pose: proud(curl) },
    { t: 2.35, pose: proud(both(false)) },
    { t: 2.57, pose: proud(both(true)) }, { t: 2.79, pose: proud(both(false)) },
    { t: 3.01, pose: proud(both(true)) },
    { t: 3.3, pose: proud({ head: [-0.15, 0.2, 0.12] }) },
    { t: 3.58, pose: dustA }, { t: 3.74, pose: dustB },
    { t: 3.9, pose: dustA }, { t: 4.06, pose: dustB },
    { t: 4.35, pose: proud() },
    { t: 4.6, pose: gDown(0) }, { t: 4.9, pose: gUp(0) }, { t: 5.2, pose: guard },
  ];
  const gb0 = plant(merge(vIdle, { p: [0, 0.94, 0.05], r: [0.06, 0, 0] }));
  const P = ownPoint(gb0, SK.map.chest!, [0, 0.12, 0.38]);
  const gbHit = aim(aim(gb0, 'L', P.clone().add(V(0.05, 0, 0))), 'R', P.clone().add(V(-0.05, 0, 0)));
  const gbOpen = aim(aim(gb0, 'L', P.clone().add(V(0.15, 0.02, -0.02))), 'R', P.clone().add(V(-0.15, 0.02, -0.02)));
  const victim: Key[] = [
    ...bounceKeys(0, 1.0),
    { t: 1.0, pose: plant(merge(vIdle, { p: [0, 0.94, 0.06], r: [0.08, 0, 0], j: { head: [0.1, 0, 0.15] } })) },
    { t: 1.5, pose: gbOpen }, { t: 1.68, pose: gbHit },
    { t: 1.86, pose: gbOpen }, { t: 2.04, pose: gbHit },
    { t: 2.3, pose: vTight(0.05) },
    ...bounceKeys(2.6, 4.9, vIdle, 0.04),
    { t: 5.2, pose: vIdle },
  ];
  return {
    attacker, victim, end: 5.2,
    phases: [
      { t: 0, name: 'Berdiri tegap, dagu terangkat 😏', color: '#38bdf8' },
      { t: 0.8, name: '👋 "AYO MAJU SINI!"', color: '#facc15' },
      { t: 2.3, name: 'Dua tangan memanggil', color: '#f97316' },
      { t: 3.15, name: 'Kibas debu di bahu 💅', color: '#e879f9' },
      { t: 4.3, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// TAUNT 2: "Pukul Sini!" - offers the chin, pulls back from the jab, shakes head & shrugs
function makeTauntChin(): TauntData {
  const down: J = { shoulderL: [0.08, 0, 0.18], elbowL: [-0.3, 0, 0], shoulderR: [0.08, 0, -0.18], elbowR: [-0.3, 0, 0] };
  const offer = plant({ p: [0, 0.9, 0.32], r: [0.18, 0, 0], j: { spine: [0.08, 0, 0], chest: [0.05, 0, 0], neck: [-0.15, 0, 0], head: [-0.35, 0, 0], ...down, hipL: [-0.65, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [0.05, 0, -0.1], kneeR: [0.3, 0, 0] } });
  const chin = ownPoint(offer, SK.headC, [0, -0.1, 0.13]);
  const eHint = chin.clone().add(V(-0.08, -0.3, 0.05));
  const tapA = aim(offer, 'R', chin.clone().add(V(0, -0.02, 0.07)), { elbow: eHint });
  const tapB = aim(offer, 'R', chin.clone().add(V(0, -0.01, 0.015)), { elbow: eHint });
  const pull = plant({ p: [0, 0.93, 0.16], r: [-0.13, 0, 0], j: { spine: [-0.04, 0, 0], chest: [-0.03, 0, 0], head: [0.08, 0, 0], ...down, hipL: [-0.15, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.45, 0, 0] } });
  const headNo = (y: number): Pose => plant({ p: [0, 0.97, 0.12], r: [0, 0, 0], j: { ...down, head: [-0.15, y, 0], ...legsTall } });
  const attacker: Key[] = [
    { t: 0, pose: guard }, { t: 0.25, pose: gDown(0) }, { t: 0.5, pose: gUp(0.05) },
    { t: 0.85, pose: plant(merge(gDown(0.15), { j: down })) },
    { t: 1.2, pose: offer },
    { t: 1.45, pose: tapA }, { t: 1.62, pose: tapB },
    { t: 1.79, pose: tapA }, { t: 1.96, pose: tapB },
    { t: 2.18, pose: offer },
    { t: 2.44, pose: pull },
    { t: 2.72, pose: pull },
    { t: 2.98, pose: headNo(0.35) }, { t: 3.18, pose: headNo(-0.35) },
    { t: 3.38, pose: headNo(0.3) }, { t: 3.6, pose: headNo(0) },
    { t: 3.85, pose: shrugP(0.12, 0.22) }, { t: 4.2, pose: shrugP(0.12, 0.22) },
    { t: 4.5, pose: gDown(0.06) }, { t: 4.8, pose: gUp(0.02) }, { t: 5.1, pose: guard },
  ];
  const chinV = V(-chin.x, chin.y, 1.3 - chin.z);
  const vJab = aim(jabBase(0.3), 'L', chinV, { lockElbow: true, rootZ: true });
  const victim: Key[] = [
    ...bounceKeys(0, 1.2),
    { t: 1.35, pose: vTight(0.02) },
    { t: 1.9, pose: vTight(0.06) },
    { t: 2.22, pose: plant(merge(gDown(0.12, vIdle), { r: [0.04, 0.1, 0] })) },
    { t: 2.42, sharp: true, pose: vJab },
    { t: 2.56, pose: plant(merge(vJab, { p: [vJab.p[0], vJab.p[1] - 0.02, vJab.p[2] + 0.05], r: [0.14, -0.3, 0] })) },
    { t: 2.85, pose: vTight(0.15) },
    { t: 3.3, pose: plant(merge(vTight(0.1), { j: { head: [0.2, 0, 0.2] } })) },
    ...bounceKeys(3.7, 4.8, vIdle, 0.06),
    { t: 5.1, pose: vIdle },
  ];
  return {
    attacker, victim, end: 5.1,
    phases: [
      { t: 0, name: 'Tangan diturunkan... 😏', color: '#38bdf8' },
      { t: 1.15, name: '👉 "PUKUL SINI!" - sodorkan dagu', color: '#facc15' },
      { t: 2.25, name: 'Lawan jab...', color: '#f97316' },
      { t: 2.42, name: '😎 PULL BACK - meleset!', color: '#ef4444' },
      { t: 2.9, name: 'Geleng kepala "nggak kena"', color: '#e879f9' },
      { t: 3.8, name: 'Angkat bahu 🤷', color: '#a855f7' },
      { t: 4.5, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// TAUNT 3: "Pamer Otot" - double biceps flex, chest thumps, point & fist up
function makeTauntFlex(): TauntData {
  const legs: J = { hipL: [-0.12, 0, 0.16], kneeL: [0.12, 0, 0], hipR: [-0.12, 0, -0.16], kneeR: [0.12, 0, 0] };
  const flex = (sq: number, tilt = 0): Pose => plant({ p: [0, 0.96, 0], r: [0.02, 0, 0], j: { chest: [-0.05, 0, 0], head: [-0.1, 0, tilt], shoulderL: [0, 0, 1.5], elbowL: [0, 0, 1.6 + sq], shoulderR: [0, 0, -1.5], elbowR: [0, 0, -1.6 - sq], ...legs } });
  const base = plant({ p: [0, 0.96, 0], r: [0.02, 0, 0], j: { chest: [-0.04, 0, 0], head: [-0.08, 0, 0], shoulderL: [-0.6, 0, 0.3], elbowL: [-1.8, 0, 0], shoulderR: [-0.6, 0, -0.3], elbowR: [-1.8, 0, 0], ...legs } });
  const cL = ownPoint(base, SK.map.chest!, [0.09, 0.14, 0.14]);
  const cR = ownPoint(base, SK.map.chest!, [-0.09, 0.14, 0.14]);
  const eL = cL.clone().add(V(0.25, -0.12, 0.12)), eR = cR.clone().add(V(-0.25, -0.12, 0.12));
  const pL = aim(aim(base, 'L', cL, { elbow: eL }), 'R', cR.clone().add(V(-0.05, 0, 0.2)), { elbow: eR });
  const pR = aim(aim(base, 'R', cR, { elbow: eR }), 'L', cL.clone().add(V(0.05, 0, 0.2)), { elbow: eL });
  const point = plant(merge(base, { r: [-0.04, 0.15, 0], j: { shoulderR: [-1.55, 0, 0.1], elbowR: [-0.02, 0, 0], head: [-0.2, -0.15, 0] } }));
  const fistUp = plant(merge(base, { j: { chest: [-0.06, 0, 0], head: [-0.15, 0, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.35, 0, 0] } }));
  const attacker: Key[] = [
    { t: 0, pose: guard }, { t: 0.28, pose: gDown(0) }, { t: 0.58, pose: gUp(0) },
    { t: 0.88, pose: base },
    { t: 1.18, pose: flex(0) },
    { t: 1.42, pose: flex(0.35, 0.12) }, { t: 1.66, pose: flex(0) },
    { t: 1.9, pose: flex(0.35, -0.12) },
    { t: 2.2, pose: base },
    { t: 2.4, pose: pL }, { t: 2.6, pose: pR },
    { t: 2.8, pose: pL }, { t: 3.0, pose: pR },
    { t: 3.2, pose: point }, { t: 3.6, pose: merge(point, { j: { head: [-0.25, -0.15, 0.15] } }) },
    { t: 3.9, pose: fistUp }, { t: 4.25, pose: fistUp },
    { t: 4.6, pose: gDown(0) }, { t: 4.9, pose: gUp(0) }, { t: 5.2, pose: guard },
  ];
  const victim: Key[] = [
    ...bounceKeys(0, 1.1),
    { t: 1.3, pose: shrugP(0, -0.2) }, { t: 1.7, pose: shrugP(0, -0.2) },
    { t: 2.0, pose: vIdle },
    ...bounceKeys(2.3, 3.4),
    { t: 3.5, pose: plant(merge(vTight(0.03), { j: { head: [0.2, 0, -0.15] } })) },
    { t: 3.9, pose: vTight(0.05) },
    ...bounceKeys(4.15, 4.9),
    { t: 5.2, pose: vIdle },
  ];
  return {
    attacker, victim, end: 5.2,
    phases: [
      { t: 0, name: 'Berdiri santai...', color: '#38bdf8' },
      { t: 1.0, name: '💪 PAMER OTOT - double biceps!', color: '#facc15' },
      { t: 2.3, name: '🦍 Pukul-pukul dada', color: '#f97316' },
      { t: 3.15, name: '👉 Tunjuk lawan', color: '#ef4444' },
      { t: 3.85, name: '✊ Kepalan ke atas - "AKU JUARA"', color: '#e879f9' },
      { t: 4.5, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// ================================================================
// =========  REAL STEEL PACK: 4 COMBOS + 4 TAUNTS  ===============
// ================================================================
const CENTRAL: JointName[] = ['pelvis', 'waist', 'spine', 'chest', 'neck', 'head'];
/** mirror a pose's spin direction (used for falls that spin the other way) */
function flipSpin(p: Pose): Pose {
  const j: J = { ...p.j };
  for (const n of CENTRAL) { const v = j[n]; if (v) j[n] = [v[0], -v[1], -v[2]]; }
  return { p: [-p.p[0], p.p[1], p.p[2]], r: [p.r[0], -p.r[1], -p.r[2]], j };
}
const vJabbed = plant(merge(vIdle, { p: [0, 0.95, -0.04], r: [-0.07, -0.04, 0], j: { neck: [-0.18, 0, 0], head: [-0.4, -0.15, 0.05], shoulderL: [-0.85, 0, 0.55], elbowL: [-1.7, 0, 0], shoulderR: [-0.8, 0, -0.6], elbowR: [-1.6, 0, 0] } }));
const preJab = plant(merge(gDown(0.08), { r: [0.04, 0.1, 0], j: { head: [-0.1, -0.1, 0] } }));
const hookLoadAt = (z: number) => plant(merge(guard, { p: [0.03, 0.89, z], r: [0.07, 0.38, -0.06], j: { chest: [0, 0.15, 0], head: [-0.05, -0.38, 0.06], shoulderL: [-0.85, 0, 0.65], elbowL: [-1.8, 0, 0], shoulderR: [-1.0, 0, -0.3], elbowR: [-2.1, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.1, 0, -0.1], kneeR: [0.6, 0, 0] } }));
const upLoadAt = (z: number) => plant(merge(guard, { p: [-0.03, 0.82, z], r: [0.14, -0.3, 0.08], j: { spine: [0.12, 0, 0], head: [-0.25, 0.3, 0], shoulderL: [-1.0, 0, 0.3], elbowL: [-1.9, 0, 0], shoulderR: [-0.25, 0, -0.25], elbowR: [-1.95, 0, 0], hipL: [-0.8, 0, 0.1], kneeL: [1.1, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [1.0, 0, 0] } }));
const rhookBase = (z: number): Pose => plant({ p: [0, 0.9, z], r: [0.06, 0.55, 0], j: { chest: [0, 0.22, 0], head: [-0.05, -0.62, 0], shoulderR: [-0.15, 0.6, -1.45], elbowR: [-1.6, 0, 0], shoulderL: [-0.9, 0, 0.3], elbowL: [-2.2, 0, 0], hipL: [-0.7, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [0.25, 0, -0.1], kneeR: [0.3, 0, 0] } });

// ---------- KOMBO 4: ATOM RALLY (Jab - Cross - Hook - Uppercut) ----------
function makeComboAtom(): ComboData {
  const J1 = 0.95, J2 = 1.2, J3 = 1.5, J4 = 1.86;
  const vC = plant(merge(vIdle, { p: [0, 0.95, -0.07], r: [-0.03, 0, 0], j: { head: [-0.15, -0.08, 0], shoulderL: [-0.9, 0, 0.5], elbowL: [-1.8, 0, 0], shoulderR: [-0.9, 0, -0.55], elbowR: [-1.8, 0, 0] } }));
  const vCx = plant(merge(vIdle, { p: [0, 0.95, -0.15], r: [-0.12, 0.05, 0], j: { neck: [-0.3, 0, 0], head: [-0.7, 0.25, 0.1], chest: [-0.15, 0.05, 0], shoulderL: [-0.5, 0, 0.9], elbowL: [-0.6, 0, 0], shoulderR: [-0.6, 0, -1.0], elbowR: [-0.5, 0, 0] } }));
  const vH = plant(merge(vIdle, { p: [0, 0.93, -0.2], r: [-0.05, -0.05, 0], j: { head: [-0.3, 0.15, 0.05], chest: [-0.08, 0, 0], shoulderL: [-0.5, 0, 0.6], elbowL: [-1.0, 0, 0], shoulderR: [-0.5, 0, -0.6], elbowR: [-1.0, 0, 0] } }));
  const vHk = plant(merge(vIdle, { p: [0, 0.93, -0.23], r: [0, 0.3, 0.05], j: { neck: [0, 0.3, 0.1], head: [-0.1, 0.85, 0.3], chest: [0, 0.12, 0], shoulderL: [-0.4, 0, 0.9], elbowL: [-0.8, 0, 0], shoulderR: [-0.6, 0, -0.7], elbowR: [-1.0, 0, 0] } }));
  const vSl = plant({ p: [0, 0.88, -0.27], r: [0.2, 0.2, 0.04], j: { spine: [0.15, 0, 0], chest: [0.05, 0, 0], head: [0.15, 0.25, 0.1], ...limp, hipL: [-0.5, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [-0.4, 0, -0.1], kneeR: [0.8, 0, 0] } });
  const jab = aim(jabBase(0.22), 'L', vPoint(vPre, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
  const cross = aim(crossBaseP(0.35), 'R', vPoint(vC, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
  const Th = vPoint(vH, 'head', [-0.105, 0.01, 0.02]);
  const hook = aim(hookBase(0.4), 'L', Th, { elbow: Th.clone().add(V(0.34, 0.02, -0.15)), rootZ: true });
  const Tc = vPoint(vSl, 'head', [0, -0.095, 0.07]);
  const upc = aim(upcBase(0.45), 'R', Tc, { elbow: Tc.clone().add(V(-0.05, -0.36, -0.12)), rootZ: true });
  const mid = plant(merge(gDown(jab.p[2]), { r: [0.05, -0.25, 0], j: { chest: [0, -0.12, 0], head: [-0.08, 0.25, 0], shoulderR: [-0.65, 0, -0.38], elbowR: [-2.25, 0, 0] } }));
  const hL = hookLoadAt(cross.p[2]);
  const uL = upLoadAt(hook.p[2]);
  const sR = upc.j.shoulderR!;
  const fall = fallLaunch(J4, -0.27);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.64, pose: gDown(0.04) },
    { t: 0.82, pose: preJab },
    { t: 0.9, pose: chain(preJab, jab, 'L', 0.75, 0.45) },
    { t: J1, sharp: true, pose: jab },
    { t: J1 + 0.1, pose: mid },
    { t: J2 - 0.07, pose: chain(mid, cross, 'R', 0.8, 0.4) },
    { t: J2, sharp: true, pose: cross },
    { t: J2 + 0.13, pose: hL },
    { t: J3 - 0.09, pose: chain(hL, hook, 'L', 0.75, 0.42) },
    { t: J3, sharp: true, pose: hook },
    { t: J3 + 0.15, pose: uL },
    { t: J4 - 0.1, pose: chain(uL, upc, 'R', 0.72, 0.35) },
    { t: J4, sharp: true, pose: upc },
    { t: J4 + 0.15, pose: plant(merge(upc, { p: [upc.p[0], upc.p[1] + 0.03, upc.p[2]], r: [-0.08, 0.4, 0], j: { shoulderR: [sR[0] - 0.4, sR[1], sR[2]] } })) },
    { t: J4 + 0.4, pose: gDown(upc.p[2] - 0.05) },
    ...attackerOutro(J4 + 0.4, upc.p[2] - 0.05, fall.standT, fall.end),
  ];
  const victim: Key[] = [
    ...victimIntro(J1),
    { t: J1 + 0.08, pose: vJabbed },
    { t: J2, sharp: true, pose: vC },
    { t: J2 + 0.1, pose: vCx },
    { t: J3, sharp: true, pose: vH },
    { t: J3 + 0.12, pose: vHk },
    { t: J4, sharp: true, pose: vSl },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    hits: [
      { t: J1, hand: 'L', impulse: IMP.jab, dir: [1, 0.15, 0], big: 0.6 },
      { t: J2, hand: 'R', impulse: IMP.cross, dir: [1, 0.2, 0], big: 0.9 },
      { t: J3, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 1.0 },
      { t: J4, hand: 'R', impulse: IMP.upper, dir: [0.5, 1.3, 0], big: 1.4 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.8, name: '1 - JAB', color: '#facc15' },
      { t: J2 - 0.1, name: '2 - CROSS', color: '#fb923c' },
      { t: J3 - 0.12, name: '3 - HOOK', color: '#f97316' },
      { t: J4 - 0.14, name: '4 - UPPERCUT!', color: '#ef4444' },
      { t: J4 + 0.05, name: '💥 ATOM RALLY - 4 HIT!', color: '#dc2626' },
      { t: J4 + 1.45, name: 'KO - POWER OFF 🔌', color: '#64748b' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.25, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------- KOMBO 5: BODY → HEAD (Cross ke dada, Hook ke kepala) ----------
function makeComboBodyHead(): ComboData {
  const H1 = 1.05, H2 = 1.42;
  const Tb = vPoint(vPre, 'chest', [0.04, 0.1, 0.118]);
  const bodyX = aim(plant({ p: [0, 0.8, 0.35], r: [0.22, 0.5, 0], j: { spine: [0.12, 0, 0], chest: [0, 0.15, 0], head: [-0.35, -0.5, 0], shoulderR: [-1.3, 0, 0.15], elbowR: [-0.05, 0, 0], shoulderL: [-0.85, 0, 0.35], elbowL: [-2.2, 0, 0], hipL: [-0.95, 0, 0.1], kneeL: [1.0, 0, 0], hipR: [0.15, 0, -0.1], kneeR: [0.55, 0, 0] } }), 'R', Tb, { lockElbow: true, rootZ: true });
  const vB = plant({ p: [0, 0.88, -0.06], r: [0.28, 0.12, 0], j: { spine: [0.25, 0, 0], chest: [0.12, 0, 0], head: [0.1, 0.05, 0], shoulderL: [-0.6, 0, 0.2], elbowL: [-1.9, 0, 0], shoulderR: [-0.6, 0, -0.2], elbowR: [-1.9, 0, 0], hipL: [-0.65, 0, 0.1], kneeL: [0.85, 0, 0], hipR: [-0.5, 0, -0.1], kneeR: [0.85, 0, 0] } });
  const Th = vPoint(vB, 'head', [-0.105, 0.01, 0.02]);
  const hook = aim(hookBase(0.3), 'L', Th, { elbow: Th.clone().add(V(0.34, 0.02, -0.15)), rootZ: true });
  const dip = plant(merge(guard, { p: [0, 0.84, 0.12], r: [0.14, -0.3, 0], j: { spine: [0.1, 0, 0], head: [-0.25, 0.3, 0], shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0], hipL: [-0.75, 0, 0.1], kneeL: [1.0, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [0.9, 0, 0] } }));
  const hL = plant(merge(hookLoadAt(bodyX.p[2]), { p: [0.03, 0.86, bodyX.p[2]] }));
  const fall = fallSpin(H2, -0.06);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.62, pose: gDown(0.05) },
    { t: 0.86, pose: dip },
    { t: H1 - 0.08, pose: chain(dip, bodyX, 'R', 0.8, 0.4) },
    { t: H1, sharp: true, pose: bodyX },
    { t: H1 + 0.14, pose: hL },
    { t: H2 - 0.09, pose: chain(hL, hook, 'L', 0.75, 0.42) },
    { t: H2, sharp: true, pose: hook },
    { t: H2 + 0.14, pose: plant(merge(hook, { r: [0.06, -0.78, 0.04], j: { chest: [0, -0.36, 0], head: [-0.05, 0.75, 0] } })) },
    { t: H2 + 0.4, pose: gDown(hook.p[2] - 0.05) },
    ...attackerOutro(H2 + 0.4, hook.p[2] - 0.05, fall.standT, fall.end),
  ];
  const victim: Key[] = [
    ...victimIntro(H1),
    { t: H1 + 0.13, pose: merge(vB, { p: [0, 0.87, -0.08], r: [0.33, 0.1, 0] }) },
    { t: H2, sharp: true, pose: vB },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'chest',
    hits: [
      { t: H1, hand: 'R', impulse: IMP.body, dir: [1, 0, 0.2], big: 1.0 },
      { t: H2, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 1.3 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.7, name: 'Turun level...', color: '#a3e635' },
      { t: H1, name: '💥 CROSS KE DADA!', color: '#f97316' },
      { t: H1 + 0.1, name: 'Guard lawan turun', color: '#fb923c' },
      { t: H2 - 0.1, name: 'Naik ke kepala - HOOK!', color: '#facc15' },
      { t: H2, name: '💥 HOOK KENA PELIPIS!', color: '#ef4444' },
      { t: H2 + 1.1, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------- KOMBO 6: DOUBLE HOOK (kiri - kanan) ----------
function makeComboDoubleHook(): ComboData {
  const H1 = 1.05, H2 = 1.4;
  const Th1 = vPoint(vPre, 'head', [-0.105, 0.01, 0.02]);
  const hookL = aim(hookBase(0.28), 'L', Th1, { elbow: Th1.clone().add(V(0.34, 0.02, -0.15)), rootZ: true });
  const vK1 = plant(merge(vIdle, { p: [0, 0.94, -0.05], r: [0, 0.25, 0.04], j: { neck: [0, 0.3, 0.1], head: [-0.1, 0.85, 0.3], chest: [0, 0.12, 0], shoulderL: [-0.6, 0, 0.75], elbowL: [-1.2, 0, 0], shoulderR: [-0.7, 0, -0.7], elbowR: [-1.3, 0, 0] } }));
  const vK2 = plant(merge(vIdle, { p: [0, 0.93, -0.1], r: [0, 0.12, 0.02], j: { neck: [0, 0.15, 0.05], head: [-0.05, 0.35, 0.12], chest: [0, 0.06, 0], shoulderL: [-0.7, 0, 0.6], elbowL: [-1.4, 0, 0], shoulderR: [-0.8, 0, -0.6], elbowR: [-1.5, 0, 0] } }));
  const Th2 = vPoint(vK2, 'head', [0.105, 0.01, 0.02]);
  const hookR = aim(rhookBase(0.35), 'R', Th2, { elbow: Th2.clone().add(V(-0.34, 0.02, -0.15)), rootZ: true });
  const loadL = plant(merge(guard, { p: [0.04, 0.88, 0.12], r: [0.06, 0.32, -0.1], j: { chest: [0, 0.12, 0], head: [-0.05, -0.35, 0.08], shoulderL: [-0.85, 0, 0.65], elbowL: [-1.8, 0, 0], hipL: [-0.55, 0, 0.1], kneeL: [0.8, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.62, 0, 0] } }));
  const loadR = plant(merge(guard, { p: [-0.03, 0.88, hookL.p[2]], r: [0.07, -0.45, 0.06], j: { chest: [0, -0.2, 0], head: [-0.05, 0.45, -0.05], shoulderR: [-0.8, 0, -0.65], elbowR: [-1.9, 0, 0], shoulderL: [-1.0, 0, 0.3], elbowL: [-2.1, 0, 0], hipL: [-0.5, 0, 0.1], kneeL: [0.7, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.62, 0, 0] } }));
  const fall = fallSpin(H2, -0.1);
  fall.keys = fall.keys.map((k, i) => (i < 9 ? { ...k, pose: flipSpin(k.pose) } : k));
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.64, pose: gDown(0.05) },
    { t: 0.86, pose: loadL },
    { t: H1 - 0.08, pose: chain(loadL, hookL, 'L', 0.75, 0.42) },
    { t: H1, sharp: true, pose: hookL },
    { t: H1 + 0.13, pose: loadR },
    { t: H2 - 0.09, pose: chain(loadR, hookR, 'R', 0.75, 0.42) },
    { t: H2, sharp: true, pose: hookR },
    { t: H2 + 0.14, pose: plant(merge(hookR, { r: [0.06, 0.78, -0.04], j: { chest: [0, 0.36, 0], head: [-0.05, -0.75, 0] } })) },
    { t: H2 + 0.4, pose: gDown(hookR.p[2] - 0.05) },
    ...attackerOutro(H2 + 0.4, hookR.p[2] - 0.05, fall.standT, fall.end),
  ];
  const victim: Key[] = [
    ...victimIntro(H1),
    { t: H1 + 0.1, pose: vK1 },
    { t: H2, sharp: true, pose: vK2 },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    hits: [
      { t: H1, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 1.0 },
      { t: H2, hand: 'R', impulse: { head: [-2, -16, -6], neck: [0, -6, -2], chest: [0, -4, 0], shoulderL: [0, 0, 4], shoulderR: [0, 0, -6] }, dir: [0.6, 0.2, -0.9], big: 1.3 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.75, name: 'HOOK KIRI!', color: '#facc15' },
      { t: H1, name: '💥 Kepala terputar ke kanan', color: '#f97316' },
      { t: H1 + 0.12, name: 'HOOK KANAN!', color: '#fb923c' },
      { t: H2, name: '💥 DOUBLE HOOK - kepala bolak-balik!', color: '#ef4444' },
      { t: H2 + 1.1, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------- KOMBO 7: ZEUS HAMMER (Uppercut kiri - Overhand kanan) ----------
function makeComboZeus(): ComboData {
  const H1 = 1.05, H2 = 1.45;
  const Tc = vPoint(vPre, 'head', [0, -0.095, 0.07]);
  const lup = aim(plant({ p: [0, 0.95, 0.3], r: [-0.03, -0.3, 0], j: { chest: [-0.06, -0.12, 0], head: [-0.1, 0.3, 0], shoulderL: [-0.9, 0, -0.1], elbowL: [-1.75, 0, 0], shoulderR: [-0.85, 0, -0.3], elbowR: [-2.2, 0, 0], hipL: [-0.5, 0, 0.1], kneeL: [0.4, 0, 0], hipR: [0.05, 0, -0.1], kneeR: [0.3, 0, 0] } }), 'L', Tc, { elbow: Tc.clone().add(V(0.05, -0.36, -0.12)), rootZ: true });
  const vU: Pose = { p: [0, 1.0, -0.07], r: [-0.1, 0, 0], j: { chest: [-0.25, 0, 0], neck: [-0.35, 0, 0], head: [-0.75, 0, 0], shoulderL: [-1.1, 0, 0.8], elbowL: [-0.4, 0, 0], shoulderR: [-1.15, 0, -0.75], elbowR: [-0.4, 0, 0], hipL: [-0.1, 0, 0.06], kneeL: [0.1, 0, 0], ankleL: [0.4, 0, 0], hipR: [-0.05, 0, -0.06], kneeR: [0.12, 0, 0], ankleR: [0.35, 0, 0] } };
  const vU2 = plant(merge(vIdle, { p: [0, 0.94, -0.14], r: [-0.06, 0, 0], j: { neck: [-0.15, 0, 0], head: [-0.3, 0.05, 0], chest: [-0.1, 0, 0], shoulderL: [-0.6, 0, 0.6], elbowL: [-1.0, 0, 0], shoulderR: [-0.6, 0, -0.6], elbowR: [-1.0, 0, 0] } }));
  const To = vPoint(vU2, 'head', [0.09, 0.03, 0.05]);
  const ovh = aim(ovhBase(0.45), 'R', To, { elbow: To.clone().add(V(-0.25, 0.17, -0.2)), rootZ: true });
  const dip = plant(merge(guard, { p: [0.03, 0.83, 0.12], r: [0.14, 0.2, -0.08], j: { spine: [0.12, 0, 0], head: [-0.25, -0.2, 0.05], shoulderL: [-0.35, 0, 0.2], elbowL: [-1.9, 0, 0], hipL: [-0.78, 0, 0.1], kneeL: [1.1, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [1.0, 0, 0] } }));
  const load = plant(merge(guard, { p: [0.05, 0.88, lup.p[2]], r: [0.08, -0.35, -0.08], j: { chest: [0, -0.18, 0], head: [-0.1, 0.38, 0], shoulderR: [-1.45, 0, -1.05], elbowR: [-1.9, 0, 0], shoulderL: [-1.0, 0, 0.3], elbowL: [-2.0, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.72, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.62, 0, 0] } }));
  const sR = ovh.j.shoulderR!;
  const fall = fallCrumple(H2, -0.14);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.64, pose: gDown(0.05) },
    { t: 0.86, pose: dip },
    { t: H1 - 0.08, pose: chain(dip, lup, 'L', 0.72, 0.38) },
    { t: H1, sharp: true, pose: lup },
    { t: H1 + 0.17, pose: load },
    { t: H2 - 0.1, pose: plant(merge(chain(load, ovh, 'R', 0.72, 0.45), { p: [0.02, 0.9, (load.p[2] + ovh.p[2]) / 2] })) },
    { t: H2, sharp: true, pose: ovh },
    { t: H2 + 0.16, pose: plant(merge(ovh, { r: [0.34, 0.64, -0.08], j: { shoulderR: [sR[0] + 0.45, sR[1], sR[2]] } })) },
    { t: H2 + 0.42, pose: gDown(ovh.p[2] - 0.1) },
    ...attackerOutro(H2 + 0.42, ovh.p[2] - 0.1, fall.standT, fall.end, 0.5),
  ];
  const victim: Key[] = [
    ...victimIntro(H1),
    { t: H1 + 0.12, pose: vU },
    { t: H2, sharp: true, pose: vU2 },
    ...fall.keys,
  ];
  return {
    attacker, victim, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    hits: [
      { t: H1, hand: 'L', impulse: IMP.upper, dir: [0.5, 1.3, 0], big: 1.0 },
      { t: H2, hand: 'R', impulse: IMP.over, dir: [0.8, -0.7, -0.2], big: 1.45 },
    ],
    phases: [
      { t: 0, name: 'Bouncing', color: '#38bdf8' },
      { t: 0.75, name: 'Merunduk...', color: '#a3e635' },
      { t: H1, name: '💥 UPPERCUT KIRI - kepala terdongak!', color: '#f97316' },
      { t: H1 + 0.15, name: 'Angkat palu... OVERHAND!', color: '#facc15' },
      { t: H2, name: '⚡ ZEUS HAMMER!', color: '#ef4444' },
      { t: H2 + 0.58, name: 'Lawan ambruk', color: '#f43f5e' },
      { t: H2 + 1.18, name: 'Tersungkur - POWER OFF 🔌', color: '#64748b' },
      { t: H2 + 2.25, name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.standT + 1.2, name: 'Siaga lagi! 🤖', color: '#6366f1' },
    ],
  };
}

// ---------- TAUNT 4: ROBOT DANCE (gaya Atom) ----------
function makeTauntDance(): TauntData {
  const armA: J = { shoulderL: [-1.57, 0, 0.25], elbowL: [-1.57, 0, 0], wristL: [0, 0, 0], shoulderR: [0.1, 0, -0.25], elbowR: [-1.57, 0, 0] };
  const armB: J = { shoulderR: [-1.57, 0, -0.25], elbowR: [-1.57, 0, 0], wristR: [0, 0, 0], shoulderL: [0.1, 0, 0.25], elbowL: [-1.57, 0, 0] };
  const dance = (x: number, arms: J): Pose => plant({
    p: [x, 0.925, 0.02], r: [0.03, -x * 1.5, -x * 0.6],
    j: { spine: [0.04, 0, x * 0.8], chest: [0, -x * 2, 0], head: [-0.05, x * 2, -x * 1.2], ...arms, hipL: [-0.42, 0, 0.12], kneeL: [0.62, 0, 0], hipR: [-0.32, 0, -0.12], kneeR: [0.55, 0, 0] },
  });
  const keys: Key[] = [{ t: 0, pose: guard }, { t: 0.3, pose: gDown(0) }];
  let prev = gDown(0);
  for (let i = 0; i < 8; i++) {
    const t = 0.62 + i * 0.3;
    const p = dance(i % 2 ? 0.08 : -0.08, i % 2 ? armB : armA);
    const m = mixPose(prev, p, 0.5);
    m.p = [m.p[0], m.p[1] + 0.035, m.p[2]];
    keys.push({ t: t - 0.15, pose: plant(m) }, { t, pose: p });
    prev = p;
  }
  const point = plant(merge(guard, { p: [0, 0.96, 0.04], r: [0.02, 0.15, 0], j: { shoulderR: [-1.55, 0, 0.05], elbowR: [-0.02, 0, 0], shoulderL: [-0.3, 0, 0.2], elbowL: [-1.6, 0, 0], head: [-0.1, -0.15, 0], hipL: [-0.25, 0, 0.1], kneeL: [0.3, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.25, 0, 0] } }));
  const core = ownPoint(point, SK.map.chest!, [0, 0.11, 0.16]);
  const tapA = aim(point, 'R', core.clone().add(V(0, 0, 0.07)), { elbow: core.clone().add(V(-0.2, -0.2, 0.15)) });
  const tapB = aim(point, 'R', core, { elbow: core.clone().add(V(-0.2, -0.2, 0.15)) });
  keys.push(
    { t: 3.05, pose: point }, { t: 3.45, pose: point },
    { t: 3.75, pose: tapA }, { t: 3.92, pose: tapB }, { t: 4.09, pose: tapA }, { t: 4.26, pose: tapB },
    { t: 4.6, pose: gDown(0) }, { t: 4.9, pose: gUp(0) }, { t: 5.2, pose: guard },
  );
  const victim: Key[] = [
    ...bounceKeys(0, 1.4),
    { t: 1.6, pose: plant(merge(vIdle, { j: { head: [0.05, 0, 0.25] } })) },
    { t: 2.3, pose: plant(merge(vIdle, { j: { head: [0.05, 0, -0.2] } })) },
    { t: 2.8, pose: vIdle },
    { t: 3.3, pose: shrugP(0, 0.2) }, { t: 3.7, pose: shrugP(0, 0.2) },
    { t: 4.0, pose: vTight(0.02) },
    ...bounceKeys(4.3, 5.0),
    { t: 5.2, pose: vIdle },
  ];
  return {
    attacker: keys, victim, end: 5.2,
    phases: [
      { t: 0, name: 'Musik nyala... 🎵', color: '#38bdf8' },
      { t: 0.45, name: '🕺 ROBOT DANCE ala Atom!', color: '#facc15' },
      { t: 3.0, name: '👉 Tunjuk lawan', color: '#f97316' },
      { t: 3.65, name: '🔵 Ketuk core dada - "ini mesinku"', color: '#22d3ee' },
      { t: 4.5, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// ---------- TAUNT 5: GAUNTLET SLAM (gaya Noisy Boy) ----------
function makeTauntSlam(): TauntData & { hits: Hit[] } {
  const stance = (j: J = {}, low = 0): Pose => plant({ p: [0, 0.94 - low, 0.03], r: [0.04, 0, 0], j: { chest: [-0.03, 0, 0], head: [-0.1, 0, 0], hipL: [-0.4 - low * 2, 0, 0.2], kneeL: [0.45 + low * 3, 0, 0], hipR: [-0.3 - low * 2, 0, -0.2], kneeR: [0.45 + low * 3, 0, 0], ...j } });
  const spread = stance({ shoulderL: [-0.35, 0, 2.1], elbowL: [-0.35, 0, 0], shoulderR: [-0.35, 0, -2.1], elbowR: [-0.35, 0, 0], head: [-0.18, 0, 0] });
  const base = stance({ shoulderL: [-1.0, 0, 0.4], elbowL: [-1.6, 0, 0], shoulderR: [-1.0, 0, -0.4], elbowR: [-1.6, 0, 0] });
  const P = ownPoint(base, SK.map.chest!, [0, 0.13, 0.42]);
  const slam = aim(aim(base, 'L', P.clone().add(V(0.055, 0, 0))), 'R', P.clone().add(V(-0.055, 0, 0)));
  const open = aim(aim(base, 'L', P.clone().add(V(0.24, 0.03, -0.04))), 'R', P.clone().add(V(-0.24, 0.03, -0.04)));
  const power = stance({ shoulderL: [-0.5, 0, 0.55], elbowL: [-0.9, 0, 0], shoulderR: [-0.5, 0, -0.55], elbowR: [-0.9, 0, 0], spine: [0.1, 0, 0], head: [-0.05, 0, 0] }, 0.07);
  const S = [1.62, 1.97, 2.32];
  const attacker: Key[] = [
    { t: 0, pose: guard }, { t: 0.28, pose: gDown(0) }, { t: 0.55, pose: base },
    { t: 0.95, pose: spread }, { t: 1.25, pose: merge(spread, { j: { head: [-0.22, 0.15, 0] } }) },
    { t: 1.45, pose: open }, { t: S[0], sharp: true, pose: slam },
    { t: 1.8, pose: open }, { t: S[1], sharp: true, pose: slam },
    { t: 2.15, pose: open }, { t: S[2], sharp: true, pose: slam },
    { t: 2.6, pose: slam },
    { t: 3.0, pose: power }, { t: 3.35, pose: merge(power, { j: { head: [-0.05, 0.25, 0] } }) },
    { t: 3.7, pose: gDown(0) }, { t: 4.0, pose: gUp(0) }, { t: 4.3, pose: guard },
  ];
  const victim: Key[] = [
    ...bounceKeys(0, 1.45),
    { t: S[0] + 0.06, pose: vTight(0, 0.92) },
    { t: S[1] + 0.06, pose: vTight(-0.03, 0.92) },
    { t: S[2] + 0.06, pose: vTight(-0.05, 0.92) },
    { t: 2.9, pose: plant(merge(vTight(-0.05), { j: { head: [0.1, 0.3, 0] } })) },
    ...bounceKeys(3.2, 4.1, vIdle, -0.02),
    { t: 4.3, pose: vIdle },
  ];
  return {
    attacker, victim, end: 4.3,
    hits: S.map((t) => ({ t, hand: 'L' as const, impulse: {}, dir: [0, 1, 0] as V3, big: 0.45 })),
    phases: [
      { t: 0, name: 'Siaga...', color: '#38bdf8' },
      { t: 0.8, name: '🦾 Rentangkan lengan lebar', color: '#facc15' },
      { t: 1.45, name: '💥 GAUNTLET SLAM! (adu tinju sendiri)', color: '#ef4444' },
      { t: 2.8, name: 'Kuda-kuda power 😤', color: '#f97316' },
      { t: 3.6, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// ---------- TAUNT 6: HEAD SPIN 360° ----------
function makeTauntSpin(): TauntData {
  const stand = (head: V3, j: J = {}): Pose => plant({ p: [0, 0.97, 0.02], r: [0, 0, 0], j: { head, shoulderL: [-0.05, 0, 0.12], elbowL: [-1.57, 0, 0], shoulderR: [-0.05, 0, -0.12], elbowR: [-1.57, 0, 0], ...legsTall, ...j } });
  const keys: Key[] = [{ t: 0, pose: guard }, { t: 0.28, pose: gDown(0) }, { t: 0.6, pose: stand([0, 0, 0]) }];
  for (let i = 1; i <= 8; i++) {
    const t0 = 0.6 + (i - 1) * 0.27;
    keys.push({ t: t0 + 0.11, pose: stand([0, (i * Math.PI) / 4, 0]) }, { t: t0 + 0.27, pose: stand([0, (i * Math.PI) / 4, 0]) });
  }
  const s0 = stand([0, 0, 0]);
  const eye = ownPoint(s0, SK.headC, [-0.03, 0.02, 0.22]);
  const watch = aim(s0, 'R', eye, { elbow: eye.clone().add(V(-0.2, -0.25, 0.08)) });
  const point = stand([-0.05, 0, 0], { shoulderR: [-1.55, 0, 0.05], elbowR: [-0.02, 0, 0] });
  keys.push(
    { t: 3.15, pose: stand([0, 0, 0]) },
    { t: 3.4, pose: stand([0, 0, 0.35]) }, { t: 3.6, pose: stand([0, 0, -0.35]) }, { t: 3.8, pose: stand([0, 0, 0]) },
    { t: 4.1, pose: watch }, { t: 4.4, pose: watch },
    { t: 4.7, pose: point }, { t: 5.0, pose: point },
    { t: 5.3, pose: gDown(0) }, { t: 5.6, pose: guard },
  );
  const victim: Key[] = [
    ...bounceKeys(0, 1.3),
    { t: 1.5, pose: plant(merge(vIdle, { j: { head: [0.05, 0, 0.28] } })) },
    { t: 2.3, pose: plant(merge(vIdle, { j: { head: [0.05, 0, -0.25] } })) },
    { t: 2.8, pose: vIdle },
    { t: 3.25, pose: vTight(-0.04) },
    ...bounceKeys(3.6, 4.6, vIdle, -0.03),
    { t: 4.8, pose: shrugP(-0.02, 0.15) },
    { t: 5.2, pose: shrugP(-0.02, 0.15) },
    { t: 5.6, pose: vIdle },
  ];
  return {
    attacker: keys, victim, end: 5.6,
    phases: [
      { t: 0, name: 'Berdiri kaku...', color: '#38bdf8' },
      { t: 0.65, name: '🔄 KEPALA BERPUTAR 360° - scan!', color: '#facc15' },
      { t: 2.75, name: 'Rewind cepat ⏪', color: '#f97316' },
      { t: 3.3, name: 'Patahkan leher kiri-kanan', color: '#e879f9' },
      { t: 4.0, name: '👀 "Aku mengawasimu"', color: '#22d3ee' },
      { t: 4.65, name: '👉 Tunjuk lawan', color: '#ef4444' },
      { t: 5.25, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// ---------- TAUNT 7: ZEUS THRONE (tangan bersilang, gorok leher) ----------
function makeTauntThrone(): TauntData {
  const legsWide: J = { hipL: [-0.1, 0, 0.22], kneeL: [0.12, 0, 0], hipR: [-0.1, 0, -0.22], kneeR: [0.12, 0, 0] };
  const base = plant({ p: [0, 0.955, 0.02], r: [0.02, 0, 0], j: { chest: [-0.03, 0, 0], head: [-0.1, 0, 0], shoulderL: [-0.8, 0, 0.25], elbowL: [-1.9, 0, 0], shoulderR: [-0.8, 0, -0.25], elbowR: [-1.9, 0, 0], ...legsWide } });
  const c = SK.map.chest!;
  const pL = ownPoint(base, c, [-0.13, 0.1, 0.17]), eL = ownPoint(base, c, [0.24, 0.02, 0.2]);
  const pR = ownPoint(base, c, [0.13, 0.13, 0.22]), eR = ownPoint(base, c, [-0.24, 0.05, 0.25]);
  const crossed = aim(aim(base, 'L', pL, { elbow: eL }), 'R', pR, { elbow: eR });
  const slashBase = merge(base, { j: { head: [-0.15, 0, 0] } });
  const nk = SK.map.neck!;
  const s1 = ownPoint(slashBase, nk, [0.08, 0.05, 0.09]), s2 = ownPoint(slashBase, nk, [-0.12, 0.05, 0.09]);
  const slashA = aim(slashBase, 'R', s1, { elbow: s1.clone().add(V(-0.25, -0.15, 0.15)) });
  const slashB = aim(slashBase, 'R', s2, { elbow: s2.clone().add(V(-0.3, -0.12, 0.12)) });
  const pointDown = plant(merge(base, { j: { shoulderR: [-0.55, 0, 0.05], elbowR: [-0.05, 0, 0], head: [0.3, 0, 0], spine: [0.06, 0, 0] } }));
  const attacker: Key[] = [
    { t: 0, pose: guard }, { t: 0.28, pose: gDown(0) }, { t: 0.55, pose: base },
    { t: 0.95, pose: crossed },
    { t: 1.35, pose: merge(crossed, { j: { head: [-0.15, 0, 0.18] } }) },
    { t: 1.75, pose: merge(crossed, { j: { head: [-0.15, 0, 0.18] } }) },
    { t: 2.1, pose: merge(crossed, { j: { head: [-0.05, 0.25, 0] } }) },
    { t: 2.45, pose: crossed },
    { t: 2.75, pose: slashA }, { t: 3.08, pose: slashB }, { t: 3.25, pose: slashB },
    { t: 3.65, pose: pointDown }, { t: 4.05, pose: pointDown },
    { t: 4.4, pose: gDown(0) }, { t: 4.7, pose: gUp(0) }, { t: 5.0, pose: guard },
  ];
  const victim: Key[] = [
    ...bounceKeys(0, 2.6),
    { t: 2.8, pose: vIdle },
    { t: 3.15, pose: vTight(-0.02) },
    { t: 3.7, pose: plant(merge(vTight(-0.03), { j: { head: [0.25, 0, 0] } })) },
    { t: 4.1, pose: plant(merge(vIdle, { j: { head: [0.05, 0.35, 0] } })) },
    ...bounceKeys(4.4, 4.85),
    { t: 5.0, pose: vIdle },
  ];
  return {
    attacker, victim, end: 5.0,
    phases: [
      { t: 0, name: 'Berdiri lebar...', color: '#38bdf8' },
      { t: 0.85, name: '👑 ZEUS THRONE - tangan bersilang', color: '#facc15' },
      { t: 1.95, name: 'Tatap lawan dari atas', color: '#a855f7' },
      { t: 2.6, name: '🔪 Gerakan gorok leher', color: '#ef4444' },
      { t: 3.5, name: '👇 "Kamu akan jatuh di sini"', color: '#f97316' },
      { t: 4.3, name: 'Kembali siaga', color: '#6366f1' },
    ],
  };
}

// ================================================================
// ⚡ OVERDRIVE - grab the head with the left, killer right, head rips off
// ================================================================
function makeOverdrive() {
  const GRAB = 0.98, PULL = GRAB + 0.24, WIND0 = 1.45, HIT = 2.55;
  const LZ = -0.72;

  // ---------- victim poses ----------
  const vGrab0 = plant(merge(vIdle, { p: [0, 0.95, 0.02], j: { head: [-0.05, 0, 0], shoulderL: [-1.1, 0, 0.45], elbowL: [-1.7, 0, 0], shoulderR: [-1.1, 0, -0.45], elbowR: [-1.7, 0, 0] } }));
  // head pulled DOWN by the grip to the attacker's shoulder height -> the killer punch is a level straight
  const grabbedJ = (aL: number, aR: number): J => ({
    spine: [0.12, 0, 0], neck: [-0.05, 0, 0], head: [-0.34, 0, 0],
    shoulderL: [-1.3 + aL, 0, 0.32], elbowL: [-1.25 - aL, 0, 0],
    shoulderR: [-1.3 + aR, 0, -0.32], elbowR: [-1.25 - aR, 0, 0],
    hipL: [-0.32, 0, 0.1], kneeL: [0.42, 0, 0], hipR: [-0.12, 0, -0.1], kneeR: [0.38, 0, 0],
  });
  const vG = (aL = 0, aR = 0): Pose => plant({ p: [0, 0.91, 0.12], r: [0.34, 0, 0], j: grabbedJ(aL, aR) });
  const vGrab = vG();

  // ---------- targets (attacker space) ----------
  const G0 = vPoint(vGrab0, 'head', [-0.15, 0.03, 0.0]);
  const G = vPoint(vGrab, 'head', [-0.15, 0.03, 0.0]);
  const P = vPoint(vGrab, 'head', [0, 0.0, 0.112]);

  // ---------- attacker poses ----------
  const legsDeep = (d: number): J => ({ hipL: [-0.62 - d * 0.3, 0, 0.12], kneeL: [0.85 + d * 0.4, 0, 0], hipR: [-0.2 - d * 0.15, 0, -0.12], kneeR: [0.8 + d * 0.4, 0, 0] });
  const reachBase = plant({
    p: [0, 0.9, 0.38], r: [0.06, -0.25, 0],
    j: { spine: [0.06, 0, 0], chest: [0, -0.15, 0], head: [-0.1, 0.25, 0], shoulderL: [-1.45, 0, 0.1], elbowL: [-0.4, 0, 0], shoulderR: [-0.85, 0, -0.3], elbowR: [-2.2, 0, 0], ...legsDeep(0) },
  });
  const grab = aim(reachBase, 'L', G0, { rootZ: true });
  const pull = aim(plant(merge(reachBase, { p: [0, 0.9, grab.p[2] - 0.04], r: [0.0, -0.3, 0], j: { chest: [-0.04, -0.18, 0] } })), 'L', G, { rootZ: true });
  const zW = pull.p[2];
  // straight-punch chamber: fist cocked at the cheek, elbow back, hips & shoulders coiled far back
  const wind = (d: number, tremble = 0): Pose => aim(plant({
    p: [0.02, 0.89 - d * 0.03, zW - 0.04 - d * 0.04], r: [0.06, -0.5 - d * 0.22, 0],
    j: {
      spine: [0.06, 0, 0], chest: [0, -0.22 - d * 0.12, 0], head: [-0.1, 0.62 + d * 0.2, tremble],
      shoulderL: [-1.45, 0, 0.1], elbowL: [-0.4, 0, 0],
      shoulderR: [-0.55 - d * 0.05, 0, -0.62 - d * 0.18], elbowR: [-2.4, 0, 0], wristR: [0.1, 0, 0],
      ...legsDeep(0.35 + d * 0.45),
    },
  }), 'L', G);
  const wind1 = wind(0), wind2 = wind(0.6, 0.03), wind3 = wind(1, -0.03);
  // STRAIGHT: arm fully extended & level, hips + shoulders fully rotated through
  let imp = aim(plant({
    p: [0, 0.92, zW + 0.05], r: [0.08, 0.4, 0],
    j: {
      spine: [0.06, 0, 0], chest: [0, 0.15, 0], head: [-0.12, -0.42, 0],
      shoulderL: [-1.45, 0, 0.15], elbowL: [-0.5, 0, 0],
      shoulderR: [-1.57, 0, 0.12], elbowR: [-0.04, 0, 0],
      hipL: [-0.75, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [0.32, 0, -0.12], kneeR: [0.18, 0, 0],
    },
  }), 'R', P, { lockElbow: true, rootZ: true });
  imp = aim(imp, 'L', G);
  const sR = imp.j.shoulderR!;
  const follow = plant(merge(imp, {
    p: [imp.p[0], imp.p[1] - 0.01, imp.p[2] + 0.06], r: [0.15, 0.55, 0],
    j: { chest: [0, 0.28, 0], shoulderR: [sR[0] - 0.2, sR[1], sR[2]], elbowR: [-0.05, 0, 0], shoulderL: [-0.7, 0, 1.0], elbowL: [-0.4, 0, 0], head: [-0.25, -0.5, 0] },
  }));
  const zA = imp.p[2] - 0.08;
  const victory = plant({
    p: [0, 0.97, zA], r: [0, 0.2, 0],
    j: { chest: [-0.05, 0.1, 0], head: [-0.2, -0.15, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.3, 0, 0], shoulderL: [-0.2, 0, 0.25], elbowL: [-0.8, 0, 0], hipL: [-0.2, 0, 0.14], kneeL: [0.2, 0, 0], hipR: [-0.1, 0, -0.14], kneeR: [0.18, 0, 0] },
  });

  const T0 = HIT + 3.5; // reboot start (after the head is back)
  const up = rebootFromBack(T0, LZ);
  const R0 = HIT + 2.45, R1 = HIT + 3.3;

  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.62, pose: gDown(0.06) },
    // lunge in, left hand opens toward the head
    { t: 0.84, pose: plant(merge(gUp(grab.p[2] * 0.6), { r: [0.04, -0.15, 0], j: { shoulderL: [-1.25, 0, 0.2], elbowL: [-1.3, 0, 0], head: [-0.08, 0.15, 0], hipL: [-0.8, 0, 0.1], kneeL: [0.85, 0, 0] } }), ['R']) },
    { t: GRAB, sharp: true, pose: grab },
    { t: PULL, pose: pull },
    { t: WIND0, pose: wind1 },
    { t: 1.85, pose: wind2 },
    { t: 2.2, pose: wind3 },
    { t: HIT - 0.16, pose: wind3 },
    { t: HIT - 0.07, pose: chain(wind3, imp, 'R', 0.82, 0.42) },
    { t: HIT, sharp: true, pose: imp },
    { t: HIT + 0.16, pose: follow },
    { t: HIT + 0.55, pose: plant(merge(gDown(zA), { r: [0.04, 0.35, 0], j: { head: [-0.1, -0.45, 0] } })) },
    { t: HIT + 1.2, pose: victory },
    { t: HIT + 2.0, pose: merge(victory, { j: { head: [-0.25, 0.1, 0.1] } }) },
    ...attackerOutro(HIT + 2.0, zA, up.standT, up.end),
  ];

  const sitFall: Pose = {
    p: [0, 0.16, LZ + 0.02], r: [-0.35, 0.06, 0],
    j: {
      spine: [0.15, 0, 0],
      shoulderL: [0.25, 0, 0.45], elbowL: [-0.3, 0, 0], shoulderR: [0.25, 0, -0.5], elbowR: [-0.3, 0, 0],
      hipL: [-1.25, 0, 0.15], kneeL: [0.9, 0, 0], ankleL: [0.4, 0, 0],
      hipR: [-1.1, 0, -0.15], kneeR: [0.7, 0, 0], ankleR: [0.4, 0, 0],
    },
  };
  const lying = merge(lyingAt(LZ, true), { j: { hipL: [-0.4, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [0.4, 0, 0] } });
  const victim: Key[] = [
    { t: 0, pose: vIdle },
    { t: 0.35, pose: gDown(0, vIdle) },
    { t: 0.7, pose: gUp(0.01, vIdle) },
    { t: GRAB, sharp: true, pose: vGrab0 },
    { t: PULL, sharp: true, pose: vGrab },
    // struggling: only arms & legs move -> the head stays exactly in the grip
    { t: 1.5, pose: vG(0.25, -0.1) },
    { t: 1.75, pose: vG(-0.1, 0.25) },
    { t: 2.0, pose: vG(0.2, -0.05) },
    { t: 2.25, pose: vG(-0.05, 0.2) },
    { t: HIT - 0.1, pose: vGrab },
    { t: HIT, sharp: true, pose: vGrab },
    // headless body: thrown back, arms fly out
    {
      t: HIT + 0.12,
      pose: plant({ p: [0, 0.95, 0.0], r: [-0.3, 0.05, 0], j: { chest: [-0.15, 0, 0], neck: [-0.4, 0, 0], shoulderL: [-1.0, 0, 1.2], elbowL: [-0.25, 0, 0], shoulderR: [-1.1, 0, -1.1], elbowR: [-0.25, 0, 0], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.05, 0, -0.1], kneeR: [0.25, 0, 0] } }),
    },
    {
      t: HIT + 0.45,
      pose: plant({ p: [0, 0.9, -0.3], r: [-0.25, 0.12, 0.05], j: { neck: [-0.2, 0, 0], ...limp, shoulderL: [-0.4, 0, 0.7], shoulderR: [-0.4, 0, -0.7], hipL: [-0.5, 0, 0.12], kneeL: [0.35, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.45, 0, 0] } }),
    },
    {
      t: HIT + 0.78,
      pose: plant({ p: [0, 0.6, LZ + 0.2], r: [-0.08, 0.1, 0.03], j: { spine: [0.1, 0, 0], ...limp, hipL: [-1.25, 0, 0.12], kneeL: [1.75, 0, 0], hipR: [-1.1, 0, -0.12], kneeR: [1.75, 0, 0] } }),
    },
    { t: HIT + 1.02, sharp: true, pose: sitFall },
    { t: HIT + 1.3, sharp: true, pose: lying },
    { t: HIT + 1.42, pose: merge(lying, { p: [0, 0.16, LZ] }) },
    { t: HIT + 1.55, sharp: true, pose: lying },
    // electric twitches of the headless body
    { t: HIT + 1.9, sharp: true, pose: merge(lying, { j: { shoulderR: [0.3, 0, -0.6], elbowR: [-1.2, 0, 0] } }) },
    { t: HIT + 2.05, sharp: true, pose: lying },
    { t: HIT + 2.25, sharp: true, pose: merge(lying, { j: { kneeL: [1.0, 0, 0], hipL: [-0.7, 0, 0.12] } }) },
    { t: HIT + 2.4, pose: lying },
    { t: T0 - 0.05, pose: lyingAt(LZ) },
    ...up.keys,
  ];

  const phases: Phase[] = [
    { t: 0, name: 'Siaga', color: '#38bdf8' },
    { t: 0.6, name: 'Melesat maju!', color: '#a3e635' },
    { t: GRAB, name: '✊ CENGKERAM KEPALA LAWAN!', color: '#facc15' },
    { t: PULL, name: 'Tarik mendekat...', color: '#fb923c' },
    { t: WIND0, name: '⚡ OVERDRIVE - ancang-ancang penuh!', color: '#f97316' },
    { t: HIT - 0.1, name: '💀 STRAIGHT MEMATIKAN!', color: '#ef4444' },
    { t: HIT + 0.05, name: '💥 KEPALA TERLEPAS!', color: '#dc2626' },
    { t: HIT + 0.7, name: 'Badan tanpa kepala ambruk', color: '#f43f5e' },
    { t: HIT + 1.4, name: 'POWER OFF 🔌', color: '#64748b' },
    { t: R0, name: '🧲 Kepala ditarik magnet kembali...', color: '#22d3ee' },
    { t: T0 + 1.0, name: 'REBOOTING... 🔄', color: '#22c55e' },
    { t: up.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
    { t: up.end - 1.0, name: 'Siaga lagi 🤖', color: '#6366f1' },
  ];

  const slowmo: [number, number][] = [
    [0, 1], [WIND0, 1], [WIND0 + 0.25, 0.55], [HIT - 0.2, 0.55], [HIT - 0.12, 1], [HIT, 1],
    [HIT + 0.02, 0.15], [HIT + 0.5, 0.22], [HIT + 1.0, 1],
  ];

  const atk: Attack = {
    id: 'overdrive', kind: 'hit', name: 'OVERDRIVE', target: 'Kepala Lepas', icon: '💀', hand: 'R',
    desc: 'Pukulan pamungkas: tangan kiri mencengkeram kepala lawan, ancang-ancang penuh tenaga, tangan kanan menghantam sampai kepala robot lawan terlepas!',
    duration: up.end, hitTime: HIT, impactTime: HIT + 1.02, hitPart: 'head', sparkDir: [1, 0.5, 0],
    impulse: {}, recoil: { head: [-2, 0, 0], chest: [-1.5, 0, 0] },
    hits: [{ t: HIT, hand: 'R', impulse: { chest: [-6, 0, 0], spine: [-3, 0, 0], shoulderL: [-3, 0, 6], shoulderR: [-3, 0, -6] }, dir: [1, 0.5, 0], big: 1.6 }],
    powerDown: [HIT + 0.05, T0 + 1.0],
    detach: { t: HIT, reattach: [R0, R1], vel: [3.9, 1.5, 0] },
    lock: [GRAB - 0.05, HIT],
    odCharge: [WIND0, HIT],
    slowmo, phases, category: 'special',
    attacker: buildTrack(attacker), victim: buildTrack(victim),
  };
  return atk;
}

// ================================================================
// =========  LEGEND COMBOS (finisher rips the head off)  =========
// ================================================================
/** headless body after a decapitating finisher at H, starting from z0 */
function headlessFall(H: number, z0: number) {
  const LZ = z0 - 0.75;
  const T0 = H + 3.5;
  const up = rebootFromBack(T0, LZ);
  const sitFall: Pose = {
    p: [0, 0.16, LZ + 0.02], r: [-0.35, 0.06, 0],
    j: { spine: [0.15, 0, 0], shoulderL: [0.25, 0, 0.45], elbowL: [-0.3, 0, 0], shoulderR: [0.25, 0, -0.5], elbowR: [-0.3, 0, 0], hipL: [-1.25, 0, 0.15], kneeL: [0.9, 0, 0], ankleL: [0.4, 0, 0], hipR: [-1.1, 0, -0.15], kneeR: [0.7, 0, 0], ankleR: [0.4, 0, 0] },
  };
  const lying = merge(lyingAt(LZ, true), { j: { hipL: [-0.4, 0, 0.12], kneeL: [0.6, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [0.4, 0, 0] } });
  const keys: Key[] = [
    { t: H + 0.12, pose: plant({ p: [0, 0.95, z0 - 0.1], r: [-0.3, 0.05, 0], j: { chest: [-0.15, 0, 0], neck: [-0.4, 0, 0], shoulderL: [-1.0, 0, 1.2], elbowL: [-0.25, 0, 0], shoulderR: [-1.1, 0, -1.1], elbowR: [-0.25, 0, 0], hipL: [-0.2, 0, 0.1], kneeL: [0.2, 0, 0], hipR: [0.05, 0, -0.1], kneeR: [0.25, 0, 0] } }) },
    { t: H + 0.45, pose: plant({ p: [0, 0.9, z0 - 0.4], r: [-0.25, 0.12, 0.05], j: { neck: [-0.2, 0, 0], ...limp, shoulderL: [-0.4, 0, 0.7], shoulderR: [-0.4, 0, -0.7], hipL: [-0.5, 0, 0.12], kneeL: [0.35, 0, 0], hipR: [0.3, 0, -0.1], kneeR: [0.45, 0, 0] } }) },
    { t: H + 0.78, pose: plant({ p: [0, 0.6, LZ + 0.2], r: [-0.08, 0.1, 0.03], j: { spine: [0.1, 0, 0], ...limp, hipL: [-1.25, 0, 0.12], kneeL: [1.75, 0, 0], hipR: [-1.1, 0, -0.12], kneeR: [1.75, 0, 0] } }) },
    { t: H + 1.02, sharp: true, pose: sitFall },
    { t: H + 1.3, sharp: true, pose: lying },
    { t: H + 1.42, pose: merge(lying, { p: [0, 0.16, LZ] }) },
    { t: H + 1.55, sharp: true, pose: lying },
    { t: H + 1.9, sharp: true, pose: merge(lying, { j: { shoulderR: [0.3, 0, -0.6], elbowR: [-1.2, 0, 0] } }) },
    { t: H + 2.05, sharp: true, pose: lying },
    { t: H + 2.25, sharp: true, pose: merge(lying, { j: { kneeL: [1.0, 0, 0], hipL: [-0.7, 0, 0.12] } }) },
    { t: H + 2.4, pose: lying },
    { t: T0 - 0.05, pose: lyingAt(LZ) },
    ...up.keys,
  ];
  return { keys, standT: up.standT, end: up.end, impact: H + 1.02, powerDown: [H + 0.05, T0 + 1.0] as [number, number], reattach: [H + 2.45, H + 3.3] as [number, number] };
}

const victoryAt = (z: number): Pose => plant({
  p: [0, 0.97, z], r: [0, 0.2, 0],
  j: { chest: [-0.05, 0.1, 0], head: [-0.2, -0.15, 0], shoulderR: [-3.0, 0, -0.15], elbowR: [-0.3, 0, 0], shoulderL: [-0.2, 0, 0.25], elbowL: [-0.8, 0, 0], hipL: [-0.2, 0, 0.14], kneeL: [0.2, 0, 0], hipR: [-0.1, 0, -0.14], kneeR: [0.18, 0, 0] },
});

/** victim head rocked sideways by a hook. dir +1 = after a LEFT hook, -1 = after a RIGHT hook */
const vRock = (dir: number, z: number, amt: number): Pose => plant(merge(vIdle, {
  p: [0, 0.93 - 0.02 * amt, z], r: [0.02, dir * 0.22 * amt, dir * 0.05 * amt],
  j: {
    neck: [0, dir * 0.25 * amt, dir * 0.08 * amt], head: [-0.06, dir * 0.75 * amt, dir * 0.25 * amt], chest: [0, dir * 0.12 * amt, 0],
    shoulderL: [-0.95 + 0.4 * amt, 0, 0.42 + 0.3 * amt], elbowL: [-1.95 + 0.8 * amt, 0, 0],
    shoulderR: [-0.95 + 0.4 * amt, 0, -0.42 - 0.3 * amt], elbowR: [-1.95 + 0.8 * amt, 0, 0],
    hipL: [-0.4, 0, 0.1], kneeL: [0.6, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.55, 0, 0],
  },
}));

/** Ippo peek-a-boo weave: low, body swings to `side` (+1 = attacker's left) */
const weave = (side: number, z: number, deep = 0): Pose => plant(merge(guard, {
  p: [side * 0.1, 0.82 - deep * 0.05, z], r: [0.18 + deep * 0.05, -side * 0.25, side * 0.2],
  j: {
    spine: [0.12, 0, side * 0.08], head: [-0.3, side * 0.25, -side * 0.15],
    shoulderL: [-1.15, 0, 0.2], elbowL: [-2.3, 0, 0], shoulderR: [-1.15, 0, -0.2], elbowR: [-2.3, 0, 0],
    hipL: [-0.75 - deep * 0.2, 0, 0.12], kneeL: [1.1 + deep * 0.3, 0, 0], hipR: [-0.35 - deep * 0.2, 0, -0.12], kneeR: [1.0 + deep * 0.3, 0, 0],
  },
}));

const IMP_RHOOK: J = { head: [-2, -16, -6], neck: [0, -6, -2], chest: [0, -4, 0], shoulderL: [0, 0, 4], shoulderR: [0, 0, -6] };

/** hook aimed exactly at the victim's temple in pose v (rolling through from the weave) */
function hookAt(hand: 'L' | 'R', v: Pose, z: number): Pose {
  if (hand === 'L') {
    const Th = vPoint(v, 'head', [-0.105, 0.01, 0.02]);
    return aim(merge(hookBase(z), { p: [0.05, 0.89, z] }), 'L', Th, { elbow: Th.clone().add(V(0.34, 0.02, -0.15)), rootZ: true });
  }
  const Th = vPoint(v, 'head', [0.105, 0.01, 0.02]);
  return aim(merge(rhookBase(z), { p: [-0.05, 0.89, z] }), 'R', Th, { elbow: Th.clone().add(V(-0.34, 0.02, -0.15)), rootZ: true });
}

// ---------- 🥊 HAJIME NO IPPO: Gazelle Punch → Dempsey Roll ----------
function makeComboIppo() {
  const G = 1.12, H = [1.52, 1.8, 2.08, 2.36], F = 2.95;
  const hands: ('L' | 'R')[] = ['R', 'L', 'R', 'L'];
  const vUp: Pose = { p: [0, 1.0, -0.1], r: [-0.1, 0, 0], j: { chest: [-0.25, 0, 0], neck: [-0.35, 0, 0], head: [-0.75, 0, 0], shoulderL: [-1.1, 0, 0.8], elbowL: [-0.4, 0, 0], shoulderR: [-1.15, 0, -0.75], elbowR: [-0.4, 0, 0], hipL: [-0.1, 0, 0.06], kneeL: [0.1, 0, 0], ankleL: [0.4, 0, 0], hipR: [-0.05, 0, -0.06], kneeR: [0.12, 0, 0], ankleR: [0.35, 0, 0] } };
  const vh = [merge(vRock(0, -0.14, 0), { j: { head: [-0.3, 0, 0] } }), vRock(-1, -0.18, 0.55), vRock(1, -0.22, 0.55), vRock(-1, -0.26, 0.55)];
  const vAfter = [vRock(-1, -0.17, 1), vRock(1, -0.21, 1), vRock(-1, -0.25, 1), vRock(1, -0.29, 1)];
  const vF = vRock(0.6, -0.31, 0.5);

  // Gazelle: deepest crouch, then leap up-and-forward with a rising left
  const gazCrouch = plant(merge(guard, {
    p: [0, 0.74, 0.12], r: [0.25, 0, 0],
    j: { spine: [0.15, 0, 0], head: [-0.45, 0, 0], shoulderL: [-1.2, 0, 0.2], elbowL: [-2.3, 0, 0], shoulderR: [-1.2, 0, -0.2], elbowR: [-2.3, 0, 0], hipL: [-1.05, 0, 0.12], kneeL: [1.55, 0, 0], hipR: [-0.7, 0, -0.12], kneeR: [1.45, 0, 0] },
  }));
  const Tc = vPoint(vPre, 'head', [0, -0.095, 0.07]);
  const gazelle = aim(plant({
    p: [0, 1.0, 0.4], r: [-0.06, -0.35, 0],
    j: { chest: [-0.08, -0.15, 0], head: [-0.15, 0.3, 0], shoulderL: [-0.95, 0, -0.1], elbowL: [-1.6, 0, 0], shoulderR: [-1.15, 0, -0.2], elbowR: [-2.3, 0, 0], hipL: [-0.35, 0, 0.1], kneeL: [0.15, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.1, 0, 0] },
  }), 'L', Tc, { elbow: Tc.clone().add(V(0.06, -0.34, -0.12)), rootZ: true });
  gazelle.j.ankleL = [gazelle.j.ankleL![0] + 0.4, 0, 0];
  gazelle.j.ankleR = [gazelle.j.ankleR![0] + 0.4, 0, 0];

  const hooks: Pose[] = [];
  let z = gazelle.p[2];
  for (let i = 0; i < 4; i++) { const hp = hookAt(hands[i], vh[i], z); hooks.push(hp); z = hp.p[2]; }
  const fin = hookAt('R', vF, z);
  const fs = fin.j.shoulderR!;
  const fall = headlessFall(F, -0.31);
  const za = fin.p[2] - 0.08;

  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.66, pose: weave(0, 0.04) },
    { t: 0.92, pose: gazCrouch },
    { t: G - 0.08, pose: chain(gazCrouch, gazelle, 'L', 0.8, 0.4) },
    { t: G, sharp: true, pose: gazelle },
  ];
  let prevT = G, prevPose = gazelle;
  for (let i = 0; i < 4; i++) {
    const w = weave(hands[i] === 'R' ? 1 : -1, prevPose.p[2]);
    attacker.push({ t: prevT + 0.13, pose: w });
    attacker.push({ t: H[i] - 0.07, pose: chain(w, hooks[i], hands[i], 0.75, 0.42) });
    attacker.push({ t: H[i], sharp: true, pose: hooks[i] });
    prevT = H[i]; prevPose = hooks[i];
  }
  const wDeep0 = weave(1, prevPose.p[2], 0.5), wDeep = weave(1, prevPose.p[2], 1);
  attacker.push(
    { t: H[3] + 0.14, pose: wDeep0 },
    { t: F - 0.28, pose: wDeep },
    { t: F - 0.08, pose: chain(wDeep, fin, 'R', 0.8, 0.4) },
    { t: F, sharp: true, pose: fin },
    { t: F + 0.16, pose: plant(merge(fin, { r: [0.06, fin.r[1] + 0.3, -0.04], j: { chest: [0, 0.36, 0], head: [-0.05, -0.75, 0], shoulderR: [fs[0], fs[1], fs[2] - 0.2] } })) },
    { t: F + 0.6, pose: gDown(fin.p[2] - 0.05) },
    { t: F + 1.3, pose: victoryAt(za) },
    { t: F + 2.1, pose: merge(victoryAt(za), { j: { head: [-0.25, 0.1, 0.1] } }) },
    ...attackerOutro(F + 2.1, za, fall.standT, fall.end),
  );

  const victim: Key[] = [
    ...victimIntro(G),
    { t: G + 0.12, pose: vUp },
  ];
  for (let i = 0; i < 4; i++) {
    victim.push({ t: H[i], sharp: true, pose: vh[i] }, { t: H[i] + 0.09, pose: vAfter[i] });
  }
  victim.push(
    { t: H[3] + 0.32, pose: vRock(0.3, -0.3, 0.7) },
    { t: F, sharp: true, pose: vF },
    ...fall.keys,
  );

  const hits: Hit[] = [
    { t: G, hand: 'L', impulse: IMP.upper, dir: [0.5, 1.3, 0], big: 1.0 },
    ...H.map((t, i) => ({ t, hand: hands[i], impulse: hands[i] === 'L' ? IMP.hook : IMP_RHOOK, dir: (hands[i] === 'L' ? [0.6, 0.2, 0.9] : [0.6, 0.2, -0.9]) as V3, big: 0.8 })),
    { t: F, hand: 'R', impulse: IMP_RHOOK, dir: [0.6, 0.3, -0.9], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Peek-a-boo...', color: '#38bdf8' },
      { t: 0.8, name: 'Merunduk sangat dalam...', color: '#a3e635' },
      { t: G - 0.06, name: '🦌 GAZELLE PUNCH!', color: '#facc15' },
      { t: G + 0.15, name: '♾️ DEMPSEY ROLL!', color: '#f97316' },
      { t: F - 0.3, name: 'Ayunan terakhir...', color: '#fb923c' },
      { t: F, name: '💀 FINISH!', color: '#ef4444' },
      { t: F + 0.05, name: '💥 KEPALA TERLEPAS!', color: '#dc2626' },
      { t: F + 0.7, name: 'Badan tanpa kepala ambruk', color: '#f43f5e' },
      { t: F + 1.4, name: 'POWER OFF 🔌', color: '#64748b' },
      { t: fall.reattach[0], name: '🧲 Kepala ditarik kembali...', color: '#22d3ee' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.end - 1.0, name: 'Siaga lagi 🤖', color: '#6366f1' },
    ],
  };
  return { d, detach: { t: F, reattach: fall.reattach, vel: [2.4, 2.3, -2.6] as V3 } };
}

// ---------- 🦋 MUHAMMAD ALI: Shuffle → Lightning Jabs → Pull-back → Phantom Punch ----------
function makeComboAli() {
  const J = [1.25, 1.4, 1.55], P = 2.3;
  const vRec = (z: number) => plant(merge(vIdle, { p: [0, 0.95, z], j: { head: [-0.15, -0.05, 0] } }));
  const vSnap = (z: number) => plant(merge(vJabbed, { p: [0, 0.95, z] }));
  const vHit = [vPre, vRec(-0.06), vRec(-0.1)];
  const vLoad = plant(merge(vIdle, { p: [0, 0.92, -0.1], r: [0.05, -0.4, 0.05], j: { chest: [0, -0.2, 0], head: [-0.05, 0.4, 0], shoulderR: [-0.85, 0, -0.65], elbowR: [-1.9, 0, 0] } }));
  const vSwing = rhookBase(0.26);
  const vMiss = plant(merge(rhookBase(0.3), { r: [0.12, 0.85, 0], j: { chest: [0, 0.32, 0], head: [-0.05, -0.6, 0], shoulderR: [-0.3, 0.6, -1.3], elbowR: [-1.2, 0, 0] } }));
  const Tph = vPoint(vMiss, 'head', [0, -0.01, 0.1]);

  const aliArms: J = { shoulderL: [-0.55, 0, 0.22], elbowL: [-1.5, 0, 0], shoulderR: [-0.7, 0, -0.28], elbowR: [-1.9, 0, 0] };
  const aliStance = (z: number, lead: 'L' | 'R', air = 0): Pose => {
    const LL = lead === 'L';
    const p = plant({ p: [0, 0.95 + air, z], r: [0.03, 0, 0], j: { ...aliArms, head: [-0.05, 0, 0], hipL: [LL ? -0.4 : 0.05, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [LL ? 0.05 : -0.4, 0, -0.1], kneeR: [0.3, 0, 0] } });
    if (air > 0) { p.j.ankleL = [p.j.ankleL![0] + 0.3, 0, 0]; p.j.ankleR = [p.j.ankleR![0] + 0.3, 0, 0]; }
    return p;
  };
  const jabs = vHit.map((v, i) => aim(merge(jabBase(0.2 + i * 0.03), { j: { shoulderR: [-0.7, 0, -0.28], elbowR: [-1.9, 0, 0] } }), 'L', vPoint(v, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true }));
  const retract = (p: Pose) => merge(p, { j: { shoulderL: [-0.7, 0, 0.2], elbowL: [-1.6, 0, 0] } });
  const zl = jabs[2].p[2] - 0.12;
  const leanBack = plant({ p: [0, 0.93, zl], r: [-0.22, 0, 0], j: { ...aliArms, spine: [-0.08, 0, 0], head: [0.1, 0, 0], hipL: [-0.15, 0, 0.1], kneeL: [0.35, 0, 0], hipR: [0.22, 0, -0.1], kneeR: [0.5, 0, 0] } });
  const crossLoad = plant(merge(guard, { p: [0, 0.9, zl + 0.05], r: [0.05, -0.32, 0], j: { chest: [0, -0.14, 0], head: [-0.08, 0.32, 0], shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0], shoulderL: [-1.05, 0, 0.22], elbowL: [-1.8, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.66, 0, 0] } }));
  const phantom = aim(crossBaseP(0.35), 'R', Tph, { lockElbow: true, rootZ: true });
  const fall = headlessFall(P, 0.3);
  const za = phantom.p[2] - 0.08;

  const attacker: Key[] = [{ t: 0, pose: guard }, { t: 0.28, pose: aliStance(0, 'L') }];
  let t = 0.28;
  let lead: 'L' | 'R' = 'L';
  for (let i = 0; i < 4; i++) {
    t += 0.095; attacker.push({ t, pose: aliStance(0, lead, 0.045) });
    lead = lead === 'L' ? 'R' : 'L';
    t += 0.095; attacker.push({ t, pose: aliStance(0, lead) });
  }
  attacker.push(
    { t: 1.14, pose: aliStance(0.08, 'L') },
    { t: J[0], sharp: true, pose: jabs[0] }, { t: J[0] + 0.07, pose: retract(jabs[0]) },
    { t: J[1], sharp: true, pose: jabs[1] }, { t: J[1] + 0.07, pose: retract(jabs[1]) },
    { t: J[2], sharp: true, pose: jabs[2] },
    { t: J[2] + 0.12, pose: aliStance(jabs[2].p[2], 'L') },
    { t: 1.8, pose: leanBack },
    { t: 2.0, pose: merge(leanBack, { j: { head: [0.05, 0, 0.18] } }) },
    { t: 2.14, pose: crossLoad },
    { t: P - 0.07, pose: chain(crossLoad, phantom, 'R', 0.8, 0.4) },
    { t: P, sharp: true, pose: phantom },
    { t: P + 0.14, pose: plant(merge(phantom, { r: [0.14, 0.66, 0], j: { chest: [0, 0.26, 0], elbowR: [-0.3, 0, 0] } })) },
    { t: P + 0.6, pose: gDown(phantom.p[2] - 0.05) },
    { t: P + 1.3, pose: victoryAt(za) },
    { t: P + 2.1, pose: merge(victoryAt(za), { j: { head: [-0.25, 0.1, 0.1] } }) },
    ...attackerOutro(P + 2.1, za, fall.standT, fall.end),
  );

  const victim: Key[] = [
    ...victimIntro(J[0]),
    { t: J[0] + 0.06, pose: vSnap(-0.04) },
    { t: J[1], sharp: true, pose: vHit[1] }, { t: J[1] + 0.06, pose: vSnap(-0.09) },
    { t: J[2], sharp: true, pose: vHit[2] }, { t: J[2] + 0.07, pose: vSnap(-0.13) },
    { t: 1.75, pose: vLoad },
    { t: 1.93, pose: vSwing },
    { t: 2.08, pose: vMiss },
    { t: P, sharp: true, pose: vMiss },
    ...fall.keys,
  ];
  const hits: Hit[] = [
    ...J.map((t) => ({ t, hand: 'L' as const, impulse: IMP.jab, dir: [1, 0.15, 0] as V3, big: 0.5 })),
    { t: P, hand: 'R', impulse: IMP.cross, dir: [1, 0.3, 0], big: 1.55 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Tangan turun ala Ali...', color: '#38bdf8' },
      { t: 0.3, name: '🦋 ALI SHUFFLE!', color: '#facc15' },
      { t: 1.15, name: '⚡ Jab kilat bertubi-tubi', color: '#a3e635' },
      { t: 1.7, name: 'Lawan membalas hook...', color: '#fb923c' },
      { t: 1.82, name: '😎 Pull-back - meleset!', color: '#e879f9' },
      { t: 2.12, name: '💀 PHANTOM PUNCH!', color: '#ef4444' },
      { t: P + 0.05, name: '💥 KEPALA TERLEPAS!', color: '#dc2626' },
      { t: P + 0.7, name: 'Badan tanpa kepala ambruk', color: '#f43f5e' },
      { t: P + 1.4, name: 'POWER OFF 🔌', color: '#64748b' },
      { t: fall.reattach[0], name: '🧲 Kepala ditarik kembali...', color: '#22d3ee' },
      { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
      { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
      { t: fall.end - 1.0, name: 'Siaga lagi 🤖', color: '#6366f1' },
    ],
  };
  return { d, detach: { t: P, reattach: fall.reattach, vel: [3.8, 1.7, 0.2] as V3 } };
}

function legendAttack(id: AttackId, name: string, target: string, icon: string, desc: string, m: { d: ComboData; detach: { t: number; reattach: [number, number]; vel: V3 } }): Attack {
  const a = comboAttack(id, name, target, icon, desc, m.d);
  const H = m.detach.t;
  a.detach = m.detach;
  a.slowmo = [[0, 1], [H - 0.05, 1], [H + 0.02, 0.18], [H + 0.45, 0.25], [H + 0.95, 1]];
  return a;
}

// ================================================================
// =====  MIKE TYSON x3  +  MAYWEATHER  +  SUGAR RAY LEONARD  =====
// ================================================================
const IMP_RBODY: J = { spine: [6, 0, 0], chest: [5, 3, 0], head: [5, 2, 0], shoulderL: [0, 0, 4], shoulderR: [-2, 0, 0] };

/** body hook landing exactly on the victim's rib surface */
function bodyHookAt(hand: 'L' | 'R', v: Pose, z: number): Pose {
  const s = hand === 'L' ? 1 : -1;
  const T = vPoint(v, 'chest', [-0.2 * s, 0.05, 0.08]);
  const j: J = { spine: [0.15, 0, 0], chest: [0, -0.2 * s, 0], head: [-0.3, 0.55 * s, 0], hipL: [-0.85, 0, 0.1], kneeL: [1.05, 0, 0], hipR: [-0.3, 0, -0.1], kneeR: [0.95, 0, 0] };
  if (hand === 'L') { j.shoulderL = [-0.4, -0.5, 1.2]; j.elbowL = [-1.5, 0, 0]; j.shoulderR = [-0.95, 0, -0.3]; j.elbowR = [-2.2, 0, 0]; }
  else { j.shoulderR = [-0.4, 0.5, -1.2]; j.elbowR = [-1.5, 0, 0]; j.shoulderL = [-0.95, 0, 0.3]; j.elbowL = [-2.2, 0, 0]; }
  return aim(plant({ p: [0.03 * s, 0.8, z], r: [0.15, -0.5 * s, 0], j }), hand, T, { elbow: T.clone().add(V(0.3 * s, -0.02, -0.12)), rootZ: true });
}
/** uppercut landing under the chin (wide = bolo-style sweep from the side) */
function upcAt(hand: 'L' | 'R', v: Pose, z: number, wide = 0): Pose {
  const Tc = vPoint(v, 'head', [0, -0.095, 0.07]);
  if (hand === 'R') return aim(upcBase(z), 'R', Tc, { elbow: Tc.clone().add(V(-0.05 - wide, -0.36 + wide * 0.25, -0.12 + wide * 0.2)), rootZ: true });
  const base = plant({ p: [0, 0.95, z], r: [-0.03, -0.3, 0], j: { chest: [-0.06, -0.12, 0], head: [-0.1, 0.3, 0], shoulderL: [-0.9, 0, -0.1], elbowL: [-1.75, 0, 0], shoulderR: [-0.85, 0, -0.3], elbowR: [-2.2, 0, 0], hipL: [-0.5, 0, 0.1], kneeL: [0.4, 0, 0], hipR: [0.05, 0, -0.1], kneeR: [0.3, 0, 0] } });
  return aim(base, 'L', Tc, { elbow: Tc.clone().add(V(0.05 + wide, -0.36, -0.12)), rootZ: true });
}
const ovhAt = (v: Pose, z: number) => { const To = vPoint(v, 'head', [0.09, 0.03, 0.05]); return aim(ovhBase(z), 'R', To, { elbow: To.clone().add(V(-0.25, 0.17, -0.2)), rootZ: true }); };
const straightAt = (v: Pose, z: number) => aim(crossBaseP(z), 'R', vPoint(v, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
const jabAt = (v: Pose, z: number) => aim(jabBase(z), 'L', vPoint(v, 'head', [0, -0.01, 0.1]), { lockElbow: true, rootZ: true });
const crossLoadAt = (z: number) => plant(merge(guard, { p: [0, 0.9, z], r: [0.05, -0.32, 0], j: { chest: [0, -0.14, 0], head: [-0.08, 0.32, 0], shoulderR: [-0.6, 0, -0.38], elbowR: [-2.3, 0, 0], shoulderL: [-1.05, 0, 0.22], elbowL: [-1.8, 0, 0], hipL: [-0.52, 0, 0.1], kneeL: [0.75, 0, 0], hipR: [-0.15, 0, -0.1], kneeR: [0.66, 0, 0] } }));

/** victim folding around a body hook (hand = attacker's hand) */
const vBodyHit = (hand: 'L' | 'R', z: number, amt = 1): Pose => {
  const s = hand === 'L' ? 1 : -1;
  return plant({
    p: [0, 0.9 - 0.04 * amt, z], r: [0.15 + 0.12 * amt, -0.25 * s * amt, 0.06 * s * amt],
    j: { spine: [0.05 + 0.2 * amt, 0, 0.08 * s * amt], chest: [0.1 * amt, -0.1 * s * amt, 0], head: [0.1 * amt, -0.1 * s * amt, 0], shoulderL: [-0.8, 0, 0.3], elbowL: [-1.9, 0, 0], shoulderR: [-0.5, 0, -0.15], elbowR: [-2.2, 0, 0], hipL: [-0.5 - 0.15 * amt, 0, 0.1], kneeL: [0.7 + 0.2 * amt, 0, 0], hipR: [-0.4 - 0.15 * amt, 0, -0.1], kneeR: [0.75 + 0.15 * amt, 0, 0] },
  });
};
/** victim head snapped up by an uppercut */
const vUpAt = (z: number): Pose => ({ p: [0, 1.0, z], r: [-0.1, 0, 0], j: { chest: [-0.25, 0, 0], neck: [-0.35, 0, 0], head: [-0.75, 0, 0], shoulderL: [-1.1, 0, 0.8], elbowL: [-0.4, 0, 0], shoulderR: [-1.15, 0, -0.75], elbowR: [-0.4, 0, 0], hipL: [-0.1, 0, 0.06], kneeL: [0.1, 0, 0], ankleL: [0.4, 0, 0], hipR: [-0.05, 0, -0.06], kneeR: [0.12, 0, 0], ankleR: [0.35, 0, 0] } });

function finisherOutro(F: number, fin: Pose, fall: { standT: number; end: number }): Key[] {
  const za = fin.p[2] - 0.08;
  return [
    { t: F + 0.6, pose: gDown(fin.p[2] - 0.05) },
    { t: F + 1.3, pose: victoryAt(za) },
    { t: F + 2.1, pose: merge(victoryAt(za), { j: { head: [-0.25, 0.1, 0.1] } }) },
    ...attackerOutro(F + 2.1, za, fall.standT, fall.end),
  ];
}
const tailPhases = (F: number, fall: ReturnType<typeof headlessFall>): Phase[] => [
  { t: F + 0.05, name: '💥 KEPALA TERLEPAS!', color: '#dc2626' },
  { t: F + 0.7, name: 'Badan tanpa kepala ambruk', color: '#f43f5e' },
  { t: F + 1.4, name: 'POWER OFF 🔌', color: '#64748b' },
  { t: fall.reattach[0], name: '🧲 Kepala ditarik kembali...', color: '#22d3ee' },
  { t: fall.powerDown[1], name: 'REBOOTING... 🔄', color: '#22c55e' },
  { t: fall.standT, name: 'Kalibrasi sistem', color: '#3b82f6' },
  { t: fall.end - 1.0, name: 'Siaga lagi 🤖', color: '#6366f1' },
];

// ---------- 🐯 TYSON 1: "IRON MIKE 8-6" - right hook to the body, right uppercut (head flies UP) ----------
function makeTyson86() {
  const H1 = 1.12, H2 = 1.5;
  const w1 = weave(-1, 0.05), w2 = weave(1, 0.12, 0.6);
  const bodyR = bodyHookAt('R', vPre, 0.25);
  const v1 = vBodyHit('R', -0.06, 1.0);
  const v2 = vBodyHit('R', -0.09, 1.35);
  const uL = upLoadAt(bodyR.p[2]);
  const upc = upcAt('R', v2, bodyR.p[2] + 0.06);
  const sR = upc.j.shoulderR!;
  const fall = headlessFall(H2, -0.09);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.62, pose: w1 },
    { t: 0.86, pose: w2 },
    { t: H1 - 0.08, pose: chain(w2, bodyR, 'R', 0.75, 0.42) },
    { t: H1, sharp: true, pose: bodyR },
    { t: H1 + 0.16, pose: uL },
    { t: H2 - 0.09, pose: chain(uL, upc, 'R', 0.72, 0.35) },
    { t: H2, sharp: true, pose: upc },
    { t: H2 + 0.16, pose: plant(merge(upc, { p: [upc.p[0], upc.p[1] + 0.03, upc.p[2]], r: [-0.08, 0.4, 0], j: { shoulderR: [sR[0] - 0.4, sR[1], sR[2]] } })) },
    ...finisherOutro(H2, upc, fall),
  ];
  const victim: Key[] = [...victimIntro(H1), { t: H1 + 0.12, pose: v1 }, { t: H2, sharp: true, pose: v2 }, ...fall.keys];
  const hits: Hit[] = [
    { t: H1, hand: 'R', impulse: IMP_RBODY, dir: [0.7, 0, -0.8], big: 1.1 },
    { t: H2, hand: 'R', impulse: IMP.upper, dir: [0.4, 1.4, 0], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Peek-a-boo - bob & weave', color: '#38bdf8' },
      { t: 0.55, name: 'Menyelinap masuk...', color: '#a3e635' },
      { t: H1 - 0.1, name: '🐯 HOOK KANAN KE RUSUK!', color: '#f97316' },
      { t: H1 + 0.1, name: 'Lawan terlipat...', color: '#fb923c' },
      { t: H2 - 0.12, name: '💀 UPPERCUT KANAN!', color: '#ef4444' },
      ...tailPhases(H2, fall),
    ],
  };
  return { d, detach: { t: H2, reattach: fall.reattach, vel: [1.3, 4.8, 0.2] as V3 } };
}

// ---------- 🐯 TYSON 2: "SLIP & RIP" (Berbick KO) - slip the jab, right uppercut, left hook ----------
function makeTysonSlip() {
  const VJ = 0.98, H1 = 1.28, H2 = 1.62;
  const aPeek = weave(0, 0.12);
  const aSlip = weave(-1, 0.16, 0.4);
  const vJab = aim(merge(jabBase(0.12), { j: { shoulderR: [-0.95, 0, -0.42], elbowR: [-1.95, 0, 0] } }), 'L', vPoint(aPeek, 'head', [0, 0, 0.12]), { lockElbow: true, rootZ: true });
  const vz = vJab.p[2] - 0.06;
  const vRec = plant(merge(vIdle, { p: [0, 0.94, vz], r: [0.04, -0.1, 0], j: { head: [-0.05, 0.1, 0], shoulderL: [-1.2, 0, 0.3], elbowL: [-1.0, 0, 0] } }));
  const upc = upcAt('R', vRec, 0.3);
  const vU = vUpAt(vz - 0.1);
  const vH2 = plant(mixPose(vU, plant(merge(vIdle, { p: [0, 0.95, vz - 0.14] })), 0.35));
  const hl = hookLoadAt(upc.p[2]);
  const hookL = hookAt('L', vH2, upc.p[2]);
  const fall = headlessFall(H2, vz - 0.14);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.66, pose: aPeek },
    { t: VJ - 0.12, pose: aPeek },
    { t: VJ - 0.01, sharp: true, pose: aSlip },
    { t: H1 - 0.09, pose: chain(aSlip, upc, 'R', 0.72, 0.35) },
    { t: H1, sharp: true, pose: upc },
    { t: H1 + 0.14, pose: hl },
    { t: H2 - 0.09, pose: chain(hl, hookL, 'L', 0.75, 0.42) },
    { t: H2, sharp: true, pose: hookL },
    { t: H2 + 0.15, pose: plant(merge(hookL, { r: [0.06, hookL.r[1] - 0.25, 0.04], j: { chest: [0, -0.36, 0], head: [-0.05, 0.75, 0] } })) },
    ...finisherOutro(H2, hookL, fall),
  ];
  const victim: Key[] = [
    { t: 0, pose: vIdle },
    { t: 0.35, pose: gDown(0, vIdle) },
    { t: 0.62, pose: gUp(0.01, vIdle) },
    { t: VJ - 0.14, pose: plant(merge(gDown(0.02, vIdle), { r: [0.04, 0.12, 0] })) },
    { t: VJ, sharp: true, pose: vJab },
    { t: VJ + 0.12, pose: merge(vJab, { j: { elbowL: [-0.7, 0, 0] } }) },
    { t: H1, sharp: true, pose: vRec },
    { t: H1 + 0.12, pose: vU },
    { t: H2, sharp: true, pose: vH2 },
    ...fall.keys,
  ];
  const hits: Hit[] = [
    { t: H1, hand: 'R', impulse: IMP.upper, dir: [0.5, 1.3, 0], big: 1.0 },
    { t: H2, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.25, 0.9], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Peek-a-boo...', color: '#38bdf8' },
      { t: VJ - 0.15, name: 'Lawan jab → SLIP!', color: '#a3e635' },
      { t: H1 - 0.1, name: '🐯 UPPERCUT KANAN dari bawah!', color: '#f97316' },
      { t: H1 + 0.1, name: 'Kepala lawan terdongak...', color: '#fb923c' },
      { t: H2 - 0.12, name: '💀 HOOK KIRI KE PELIPIS!', color: '#ef4444' },
      ...tailPhases(H2, fall),
    ],
  };
  return { d, detach: { t: H2, reattach: fall.reattach, vel: [2.2, 2.3, 2.7] as V3 } };
}

// ---------- 🐯 TYSON 3: "PEEK-A-BOO RUSH" - double left hook (body, head) → overhand right ----------
function makeTysonRush() {
  const H1 = 1.05, H2 = 1.32, H3 = 1.82;
  const w1 = weave(1, 0.05), w2 = weave(-1, 0.12, 0.5);
  const bodyL = bodyHookAt('L', vPre, 0.25);
  const v1 = vBodyHit('L', -0.05, 0.9);
  const v2 = vBodyHit('L', -0.07, 0.75);
  const hl = plant(merge(hookLoadAt(bodyL.p[2]), { p: [0.03, 0.86, bodyL.p[2]] }));
  const hookH = hookAt('L', v2, bodyL.p[2]);
  const v3 = vRock(1, -0.16, 1);
  const v4 = vRock(0.45, -0.22, 0.55);
  const wD = weave(1, hookH.p[2], 0.9);
  const ovh = ovhAt(v4, hookH.p[2] + 0.1);
  const load = plant(merge(guard, { p: [0.05, 0.86, hookH.p[2]], r: [0.1, -0.35, -0.08], j: { chest: [0, -0.18, 0], head: [-0.15, 0.38, 0], shoulderR: [-1.45, 0, -1.05], elbowR: [-1.9, 0, 0], hipL: [-0.6, 0, 0.1], kneeL: [0.85, 0, 0], hipR: [-0.2, 0, -0.1], kneeR: [0.75, 0, 0] } }));
  const sR = ovh.j.shoulderR!;
  const fall = headlessFall(H3, -0.22);
  const attacker: Key[] = [
    ...bounceIn,
    { t: 0.6, pose: w1 },
    { t: 0.84, pose: w2 },
    { t: H1 - 0.08, pose: chain(w2, bodyL, 'L', 0.75, 0.42) },
    { t: H1, sharp: true, pose: bodyL },
    { t: H1 + 0.11, pose: hl },
    { t: H2 - 0.07, pose: chain(hl, hookH, 'L', 0.75, 0.42) },
    { t: H2, sharp: true, pose: hookH },
    { t: H2 + 0.17, pose: wD },
    { t: H3 - 0.22, pose: load },
    { t: H3 - 0.1, pose: plant(merge(chain(load, ovh, 'R', 0.72, 0.45), { p: [0.02, 0.9, (load.p[2] + ovh.p[2]) / 2] })) },
    { t: H3, sharp: true, pose: ovh },
    { t: H3 + 0.16, pose: plant(merge(ovh, { r: [0.34, 0.64, -0.08], j: { shoulderR: [sR[0] + 0.45, sR[1], sR[2]] } })) },
    ...finisherOutro(H3, ovh, fall),
  ];
  const victim: Key[] = [
    ...victimIntro(H1),
    { t: H1 + 0.11, pose: v1 },
    { t: H2, sharp: true, pose: v2 },
    { t: H2 + 0.1, pose: v3 },
    { t: H2 + 0.3, pose: vRock(0.7, -0.2, 0.8) },
    { t: H3, sharp: true, pose: v4 },
    ...fall.keys,
  ];
  const hits: Hit[] = [
    { t: H1, hand: 'L', impulse: IMP.body, dir: [0.7, 0, 0.8], big: 0.9 },
    { t: H2, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 1.0 },
    { t: H3, hand: 'R', impulse: IMP.over, dir: [0.8, -0.7, -0.2], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Peek-a-boo...', color: '#38bdf8' },
      { t: 0.55, name: 'Bob & weave menyerbu!', color: '#a3e635' },
      { t: H1 - 0.1, name: '🐯 HOOK KIRI KE RUSUK', color: '#facc15' },
      { t: H2 - 0.1, name: '🐯 HOOK KIRI KE KEPALA (double!)', color: '#f97316' },
      { t: H2 + 0.15, name: 'Merunduk dalam...', color: '#fb923c' },
      { t: H3 - 0.22, name: '💀 OVERHAND KANAN!', color: '#ef4444' },
      ...tailPhases(H3, fall),
    ],
  };
  return { d, detach: { t: H3, reattach: fall.reattach, vel: [2.9, 0.5, -1.3] as V3 } };
}

// ---------- 🛡️ FLOYD MAYWEATHER: Philly Shell → pull-back → shoulder roll → counter right → check hook → right ----------
function makeMayweather() {
  const VJ = 0.9, VC = 1.32, H1 = 1.5, H2 = 1.78, H3 = 2.12;
  const shell = (z: number, extra: J = {}): Pose => plant({
    p: [0, 0.93, z], r: [0.04, -0.4, 0],
    j: { chest: [0, -0.1, 0], head: [-0.08, 0.4, 0.05], clavL: [0, 0, 0.15], shoulderL: [-0.45, 0.4, 0.2], elbowL: [-1.55, 0, 0], shoulderR: [-1.0, 0, -0.5], elbowR: [-2.35, 0, 0], hipL: [-0.4, 0, 0.1], kneeL: [0.55, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.48, 0, 0], ...extra },
  });
  const s0 = shell(0.08);
  const pullB = plant(merge(s0, { p: [0, 0.92, 0.02], r: [-0.22, -0.4, 0], j: { spine: [-0.08, 0, 0], head: [0.12, 0.4, 0.05], hipL: [-0.15, 0, 0.1], kneeL: [0.4, 0, 0], hipR: [0.2, 0, -0.1], kneeR: [0.55, 0, 0] } }));
  const roll = plant(merge(s0, { p: [0, 0.9, 0.06], r: [-0.06, -0.85, 0.06], j: { clavL: [0, 0, 0.38], head: [0.15, 0.7, -0.08], spine: [-0.04, 0, 0], hipL: [-0.35, 0, 0.1], kneeL: [0.65, 0, 0], hipR: [0, 0, -0.1], kneeR: [0.7, 0, 0] } }));
  // opponent's punches aimed where Floyd's head WAS
  const vJab = aim(merge(jabBase(0.1), { j: { shoulderR: [-0.95, 0, -0.42], elbowR: [-1.95, 0, 0] } }), 'L', vPoint(s0, 'head', [0, 0, 0.12]), { lockElbow: true, rootZ: true });
  const vCross = aim(crossBaseP(0.2), 'R', vPoint(s0, 'head', [0.02, 0, 0.1]), { lockElbow: true, rootZ: true });
  const vHold = merge(vCross, { j: { elbowR: [-0.45, 0, 0] } });
  const zv = vCross.p[2];
  const counter = straightAt(vHold, 0.3);
  const vAfterC = plant(merge(vIdle, { p: [0, 0.95, zv - 0.14], r: [-0.12, 0.05, 0], j: { neck: [-0.3, 0, 0], head: [-0.7, 0.25, 0.1], chest: [-0.15, 0.05, 0], shoulderL: [-0.5, 0, 0.9], elbowL: [-0.6, 0, 0], shoulderR: [-0.6, 0, -1.0], elbowR: [-0.5, 0, 0] } }));
  const vH2 = plant(merge(vIdle, { p: [0, 0.94, zv - 0.18], j: { head: [-0.35, 0.1, 0.05], shoulderL: [-0.6, 0, 0.6], elbowL: [-1.1, 0, 0], shoulderR: [-0.6, 0, -0.6], elbowR: [-1.1, 0, 0] } }));
  const hl = hookLoadAt(counter.p[2]);
  const hookL = hookAt('L', vH2, counter.p[2]);
  const vF = vRock(0.4, zv - 0.25, 0.5);
  const cl = crossLoadAt(hookL.p[2]);
  const fin = straightAt(vF, hookL.p[2]);
  const fall = headlessFall(H3, zv - 0.25);
  const attacker: Key[] = [
    { t: 0, pose: guard },
    { t: 0.3, pose: s0 },
    { t: 0.55, pose: merge(s0, { p: [0, 0.91, 0.08] }) },
    { t: VJ - 0.12, pose: s0 },
    { t: VJ, pose: pullB },
    { t: VJ + 0.25, pose: s0 },
    { t: VC - 0.1, pose: s0 },
    { t: VC + 0.02, sharp: true, pose: roll },
    { t: H1 - 0.06, pose: chain(roll, counter, 'R', 0.8, 0.4) },
    { t: H1, sharp: true, pose: counter },
    { t: H1 + 0.12, pose: hl },
    { t: H2 - 0.08, pose: chain(hl, hookL, 'L', 0.75, 0.42) },
    { t: H2, sharp: true, pose: hookL },
    { t: H2 + 0.13, pose: cl },
    { t: H3 - 0.07, pose: chain(cl, fin, 'R', 0.8, 0.4) },
    { t: H3, sharp: true, pose: fin },
    { t: H3 + 0.14, pose: plant(merge(fin, { r: [0.14, 0.66, 0], j: { chest: [0, 0.26, 0], elbowR: [-0.3, 0, 0] } })) },
    ...finisherOutro(H3, fin, fall),
  ];
  const victim: Key[] = [
    { t: 0, pose: vIdle },
    { t: 0.35, pose: gDown(0, vIdle) },
    { t: 0.6, pose: gUp(0.02, vIdle) },
    { t: VJ - 0.14, pose: gDown(0.05, vIdle) },
    { t: VJ, sharp: true, pose: vJab },
    { t: VJ + 0.14, pose: gDown(0.08, vIdle) },
    { t: VC - 0.16, pose: plant(merge(vIdle, { p: [0, 0.91, 0.08], r: [0.05, -0.3, 0], j: { chest: [0, -0.14, 0], head: [-0.08, 0.3, 0], shoulderR: [-0.6, 0, -0.4], elbowR: [-2.3, 0, 0] } })) },
    { t: VC, sharp: true, pose: vCross },
    { t: H1, sharp: true, pose: vHold },
    { t: H1 + 0.1, pose: vAfterC },
    { t: H2, sharp: true, pose: vH2 },
    { t: H2 + 0.1, pose: vRock(1, zv - 0.22, 1) },
    { t: H3, sharp: true, pose: vF },
    ...fall.keys,
  ];
  const hits: Hit[] = [
    { t: H1, hand: 'R', impulse: IMP.cross, dir: [1, 0.2, 0], big: 1.0 },
    { t: H2, hand: 'L', impulse: IMP.hook, dir: [0.6, 0.2, 0.9], big: 0.9 },
    { t: H3, hand: 'R', impulse: IMP.cross, dir: [1, 0.3, 0], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: '🛡️ PHILLY SHELL - santai...', color: '#38bdf8' },
      { t: VJ - 0.12, name: 'Lawan jab → PULL BACK', color: '#a3e635' },
      { t: VC - 0.14, name: 'Lawan cross → SHOULDER ROLL!', color: '#facc15' },
      { t: H1 - 0.06, name: '⚡ COUNTER KANAN!', color: '#f97316' },
      { t: H2 - 0.08, name: 'Check hook kiri!', color: '#fb923c' },
      { t: H3 - 0.08, name: '💀 STRAIGHT PENUTUP!', color: '#ef4444' },
      ...tailPhases(H3, fall),
    ],
  };
  return { d, detach: { t: H3, reattach: fall.reattach, vel: [3.9, 1.5, 0.3] as V3 } };
}

// ---------- 🌀 SUGAR RAY LEONARD: BOLO PUNCH - windmill showboat, surprise jab, sweeping bolo ----------
function makeLeonardBolo() {
  const W0 = 0.62, STEP = 0.075, N = 12, W1 = W0 + STEP * N, J1 = W1 + 0.18, B = J1 + 0.45;
  const wind = (th: number): Pose => plant(merge(guard, {
    p: [0, 0.94, 0.04], r: [0.03, 0.2, 0],
    j: { chest: [0, 0.1, 0], head: [-0.08, -0.15, 0], shoulderR: [-1.0 + 0.85 * Math.cos(th), 0, -0.55 + 0.5 * Math.sin(th)], elbowR: [-0.35, 0, 0], wristR: [0, 0, 0], shoulderL: [-1.05, 0, 0.3], elbowL: [-1.9, 0, 0], hipL: [-0.3, 0, 0.1], kneeL: [0.42, 0, 0], hipR: [-0.05, 0, -0.1], kneeR: [0.38, 0, 0] },
  }));
  const vLook = (y: number, z = 0): Pose => plant(merge(vIdle, { p: [0, 0.95, z], j: { head: [0.05, y, 0] } }));
  const vD = vLook(-0.3, 0.02);
  const jab = jabAt(vD, 0.2);
  const vJ = plant(merge(vJabbed, { p: [0, 0.95, -0.06] }));
  const vB = plant(merge(vIdle, { p: [0, 0.94, -0.1], j: { head: [-0.2, -0.1, 0], shoulderL: [-0.85, 0, 0.55], elbowL: [-1.7, 0, 0], shoulderR: [-0.8, 0, -0.6], elbowR: [-1.6, 0, 0] } }));
  const bolo = upcAt('R', vB, jab.p[2] + 0.12, 0.28);
  const boloLoad = plant(merge(guard, { p: [0, 0.84, jab.p[2]], r: [0.12, -0.45, 0.05], j: { chest: [0, -0.15, 0], head: [-0.2, 0.4, 0], shoulderR: [0.45, 0, -0.65], elbowR: [-0.5, 0, 0], shoulderL: [-1.1, 0, 0.25], elbowL: [-1.9, 0, 0], hipL: [-0.75, 0, 0.1], kneeL: [1.05, 0, 0], hipR: [-0.25, 0, -0.1], kneeR: [0.95, 0, 0] } }));
  const sR = bolo.j.shoulderR!;
  const fall = headlessFall(B, -0.1);
  const attacker: Key[] = [...bounceIn];
  for (let k = 0; k <= N; k++) attacker.push({ t: W0 + k * STEP, pose: wind((k * Math.PI) / 3) });
  attacker.push(
    { t: J1 - 0.08, pose: plant(merge(gDown(0.1), { j: { shoulderR: [-0.9, 0, -0.35], elbowR: [-1.6, 0, 0] } })) },
    { t: J1, sharp: true, pose: jab },
    { t: J1 + 0.13, pose: boloLoad },
    { t: B - 0.1, pose: chain(boloLoad, bolo, 'R', 0.72, 0.35) },
    { t: B, sharp: true, pose: bolo },
    { t: B + 0.16, pose: plant(merge(bolo, { p: [bolo.p[0], bolo.p[1] + 0.03, bolo.p[2]], r: [-0.08, 0.45, 0], j: { shoulderR: [sR[0] - 0.4, sR[1], sR[2]] } })) },
    ...finisherOutro(B, bolo, fall),
  );
  const victim: Key[] = [{ t: 0, pose: vIdle }, { t: 0.3, pose: gDown(0, vIdle) }, { t: 0.55, pose: vLook(0) }];
  for (let k = 1; k <= N; k += 2) victim.push({ t: W0 + k * STEP + 0.04, pose: vLook(0.32 * Math.sin((k * Math.PI) / 3) - 0.05, 0.01) });
  victim.push(
    { t: J1 - 0.1, pose: vD },
    { t: J1, sharp: true, pose: vD },
    { t: J1 + 0.08, pose: vJ },
    { t: B, sharp: true, pose: vB },
    ...fall.keys,
  );
  const hits: Hit[] = [
    { t: J1, hand: 'L', impulse: IMP.jab, dir: [1, 0.15, 0], big: 0.6 },
    { t: B, hand: 'R', impulse: IMP.upper, dir: [0.3, 1.3, -0.4], big: 1.6 },
  ];
  const d: ComboData = {
    attacker, victim, hits, end: fall.end, impact: fall.impact, powerDown: fall.powerDown, hitPart: 'head',
    phases: [
      { t: 0, name: 'Siaga', color: '#38bdf8' },
      { t: W0, name: '🌀 BOLO - putar lengan kanan, pamer!', color: '#facc15' },
      { t: W1 - 0.3, name: 'Lawan terpaku melihat...', color: '#e879f9' },
      { t: J1 - 0.08, name: '⚡ JAB KIRI MENDADAK!', color: '#a3e635' },
      { t: J1 + 0.1, name: 'Ayun lebar dari bawah...', color: '#f97316' },
      { t: B - 0.02, name: '💀 BOLO PUNCH!', color: '#ef4444' },
      ...tailPhases(B, fall),
    ],
  };
  return { d, detach: { t: B, reattach: fall.reattach, vel: [1.8, 3.9, -1.5] as V3 } };
}

function comboAttack(id: AttackId, name: string, target: string, icon: string, desc: string, d: ComboData): Attack {
  return {
    id, kind: 'hit', name, target, icon, desc, hand: d.hits[d.hits.length - 1].hand,
    duration: d.end, hitTime: d.hits[0].t, impactTime: d.impact, hitPart: d.hitPart,
    sparkDir: d.hits[0].dir, impulse: d.hits[0].impulse, recoil: { head: [-1.5, 0, 0] },
    powerDown: d.powerDown, hits: d.hits, phases: d.phases, category: 'combo',
    attacker: buildTrack(d.attacker), victim: buildTrack(d.victim),
  };
}
function tauntAttack(id: AttackId, name: string, icon: string, desc: string, d: TauntData): Attack {
  return {
    id, kind: 'show', name, target: 'Taunt', icon, desc, hand: 'R',
    duration: d.end, hitTime: 999, impactTime: 999, hitPart: 'none', sparkDir: [0, 1, 0],
    impulse: {}, recoil: {}, phases: d.phases, category: 'taunt',
    attacker: buildTrack(d.attacker), victim: buildTrack(d.victim),
  };
}

// ================= track building (monotone cubic) =================
const NCH = 6 + JOINTS.length * 3;

function toArr(p: Pose): number[] {
  const a = [...p.p, ...p.r];
  for (const n of JOINTS) {
    const v = p.j[n] ?? Z3;
    a.push(v[0], v[1], v[2]);
  }
  return a;
}

function buildTrack(keys: Key[]): Track {
  const n = keys.length;
  const times = keys.map((k) => k.t);
  const vals = keys.map((k) => toArr(k.pose));
  const mIn = vals.map(() => new Array(NCH).fill(0));
  const mOut = vals.map(() => new Array(NCH).fill(0));
  for (let k = 1; k < n - 1; k++) {
    const h0 = times[k] - times[k - 1];
    const h1 = times[k + 1] - times[k];
    for (let c = 0; c < NCH; c++) {
      const d0 = (vals[k][c] - vals[k - 1][c]) / h0;
      const d1 = (vals[k + 1][c] - vals[k][c]) / h1;
      if (keys[k].sharp) {
        mIn[k][c] = d0 * 1.1;
        mOut[k][c] = d1 * 1.0;
      } else {
        let m = 0;
        if (d0 * d1 > 0) {
          const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
          m = (w1 + w2) / (w1 / d0 + w2 / d1);
        }
        mIn[k][c] = m;
        mOut[k][c] = m;
      }
    }
  }
  return { times, vals, mIn, mOut };
}

export function sampleTrack(tr: Track, t: number, out: number[]): number[] {
  const { times, vals, mIn, mOut } = tr;
  const n = times.length;
  if (t <= times[0]) { for (let c = 0; c < NCH; c++) out[c] = vals[0][c]; return out; }
  if (t >= times[n - 1]) { for (let c = 0; c < NCH; c++) out[c] = vals[n - 1][c]; return out; }
  let k = 0;
  while (k < n - 2 && t > times[k + 1]) k++;
  const h = times[k + 1] - times[k];
  const s = (t - times[k]) / h;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const a = vals[k], b = vals[k + 1], ma = mOut[k], mb = mIn[k + 1];
  for (let c = 0; c < NCH; c++) out[c] = h00 * a[c] + h10 * h * ma[c] + h01 * b[c] + h11 * h * mb[c];
  return out;
}

export const CHANNELS = NCH;
export const jointChannel = (n: JointName) => 6 + JOINTS.indexOf(n) * 3;

// ================= exported attacks =================
const cl = makeClash();
const clashTrack = buildTrack(cl.keys);
const fsA = makeFreestyle(0);
const fsB = makeFreestyle(1);
const fsPhases: Phase[] = [
  { t: 0, name: 'Bouncing di ujung kaki', color: '#38bdf8' },
  { t: fsA.marks[1], name: '⚡ ALI SHUFFLE!', color: '#facc15' },
  { t: fsA.marks[2], name: 'Lompat ke samping + slip kepala', color: '#a3e635' },
  { t: fsA.marks[3], name: 'Jab kilat di udara', color: '#f97316' },
  { t: fsA.marks[4], name: 'Showboat - tangan turun 😎', color: '#e879f9' },
  { t: fsA.marks[5], name: 'Kembali siaga', color: '#6366f1' },
];
const jb = makeJab();
const cr = makeCross();
const hk = makeHook();
const uc = makeUppercut();
const oh = makeOverhand();

export const ATTACKS: Record<AttackId, Attack> = <Record<AttackId, Attack>>{
  clash: {
    id: 'clash', kind: 'clash', name: 'Arm-to-Arm Clash', target: 'Lengan vs Lengan', icon: '⚔️', hand: 'R',
    desc: 'Benturan lengan bawah vs lengan bawah (Arm-to-Arm Clash) khas duel legendaris — saling adu tenaga dan bertahan terkunci sama-sama kuat, lalu saling dorong memisah.',
    duration: cl.END, hitTime: cl.HIT, impactTime: cl.IMPACT, hitPart: 'fist', sparkDir: [0, 1, 0],
    impulse: { head: [-3.5, 0, 0], neck: [-1.5, 0, 0], shoulderL: [0, 0, 1.5] },
    recoil: { head: [-3.5, 0, 0], neck: [-1.5, 0, 0], shoulderL: [0, 0, 1.5] },
    slowmo: cl.slowmo, press: cl.press, release: cl.release,
    phases: cl.phases, attacker: clashTrack, victim: clashTrack,
  },
  freestyle: {
    id: 'freestyle', kind: 'show', name: 'Ali Shuffle', target: 'Footwork', icon: '🕺', hand: 'L',
    desc: 'Lompat-lompat kecil khas Muhammad Ali: bouncing, Ali shuffle, lompat samping + slip, jab di udara, showboat.',
    duration: Math.max(fsA.end, fsB.end), hitTime: 999, impactTime: 999, hitPart: 'none', sparkDir: [0, 1, 0],
    impulse: {}, recoil: {},
    phases: fsPhases, attacker: buildTrack(fsA.keys), victim: buildTrack(fsB.keys),
  },
  jab: {
    id: 'jab', kind: 'hit', name: 'Jab', target: 'Wajah', icon: '👊', hand: 'L',
    desc: 'Jab kilat tangan depan, tarik di jalur yang sama lalu slip kepala.',
    duration: jb.END, hitTime: jb.HIT, impactTime: jb.IMPACT, hitPart: 'head', sparkDir: [1, 0.15, 0],
    impulse: { head: [-9, -3, 0], neck: [-4, 0, 0], chest: [-2, 0, 0], shoulderL: [0, 0, 3], shoulderR: [0, 0, -3] },
    recoil: { head: [-1.5, 0, 0] },
    stun: jb.stun, phases: jb.phases, attacker: buildTrack(jb.attacker), victim: buildTrack(jb.victim),
  },
  cross: {
    id: 'cross', kind: 'hit', name: 'Cross', target: 'Wajah', icon: '💥', hand: 'R',
    desc: 'Feint kiri, coil pinggul, cross penuh putaran - lawan lemas & terbanting.',
    duration: cr.END, hitTime: cr.HIT, impactTime: cr.IMPACT, hitPart: 'head', sparkDir: [1, 0.2, 0],
    impulse: { head: [-14, 5, 3], neck: [-6, 0, 0], chest: [-4, 1, 0], shoulderL: [0, 0, 7], shoulderR: [0, 0, -7], elbowL: [4, 0, 0], elbowR: [4, 0, 0] },
    recoil: { head: [-2, 0, 0] },
    powerDown: cr.powerDown, phases: cr.phases, attacker: buildTrack(cr.attacker), victim: buildTrack(cr.victim),
  },
  hook: {
    id: 'hook', kind: 'hit', name: 'Hook', target: 'Pelipis', icon: '🪝', hand: 'L',
    desc: 'Feint, dip & pivot - kepala lawan terputar, kaki terbelit, ambruk.',
    duration: hk.END, hitTime: hk.HIT, impactTime: hk.IMPACT, hitPart: 'head', sparkDir: [0.6, 0.2, 0.9],
    impulse: { head: [-2, 16, 6], neck: [0, 6, 2], chest: [0, 4, 0], shoulderL: [0, 0, 6], shoulderR: [0, 0, -4] },
    recoil: { head: [0, 2, 0] },
    powerDown: hk.powerDown, phases: hk.phases, attacker: buildTrack(hk.attacker), victim: buildTrack(hk.victim),
  },
  uppercut: {
    id: 'uppercut', kind: 'hit', name: 'Uppercut', target: 'Dagu', icon: '⬆️', hand: 'R',
    desc: 'Slip ke luar, turun, ledakkan ke atas - lawan terangkat & terlempar.',
    duration: uc.END, hitTime: uc.HIT, impactTime: uc.IMPACT, hitPart: 'head', sparkDir: [0.5, 1.3, 0],
    impulse: { head: [-18, 0, 0], neck: [-8, 0, 0], chest: [-5, 0, 0], shoulderL: [-4, 0, 6], shoulderR: [-4, 0, -6] },
    recoil: { head: [-2, 0, 0] },
    powerDown: uc.powerDown, phases: uc.phases, attacker: buildTrack(uc.attacker), victim: buildTrack(uc.victim),
  },
  overhand: {
    id: 'overhand', kind: 'hit', name: 'Overhand', target: 'Kepala Atas', icon: '🔨', hand: 'R',
    desc: 'Bob & weave, lengan melengkung dari atas - kaki lawan runtuh.',
    duration: oh.END, hitTime: oh.HIT, impactTime: oh.IMPACT, hitPart: 'head', sparkDir: [0.8, -0.7, -0.2],
    impulse: { head: [12, -5, -6], neck: [5, 0, 0], chest: [3, 0, 0], shoulderL: [0, 0, 4], shoulderR: [0, 0, -4] },
    recoil: { head: [1.5, 0, 0] },
    powerDown: oh.powerDown, phases: oh.phases, attacker: buildTrack(oh.attacker), victim: buildTrack(oh.victim),
  },
};

ATTACKS.combo123 = comboAttack('combo123', '1-2-3', 'Jab·Cross·Hook', '🔥', 'Jab kiri, cross kanan, hook kiri penutup - lawan berputar & tersungkur.', makeCombo123());
ATTACKS.comboLiver = comboAttack('comboLiver', 'Liver → Upper', 'Rusuk·Dagu', '🎯', 'Turun level, hook ke rusuk bikin lawan terlipat, lalu uppercut ke dagu - terlempar KO.', makeComboLiver());
ATTACKS.comboRapid = comboAttack('comboRapid', 'Rapid Fire', 'Guard·Kepala', '⚡', 'Tiga jab kilat menggedor guard, guard terbuka, overhand dari atas menghabisi.', makeComboRapid());
ATTACKS.tauntBeckon = tauntAttack('tauntBeckon', 'Ayo Maju!', '👋', 'Berdiri tegap dagu terangkat, melambai "sini", lalu kibas debu di bahu.', makeTauntBeckon());
ATTACKS.tauntChin = tauntAttack('tauntChin', 'Pukul Sini!', '😏', 'Tangan turun, sodorkan & tepuk dagu, hindari jab lawan dengan pull-back, geleng kepala & angkat bahu.', makeTauntChin());
ATTACKS.tauntFlex = tauntAttack('tauntFlex', 'Pamer Otot', '💪', 'Double biceps, pukul-pukul dada, tunjuk lawan, kepalan ke atas.', makeTauntFlex());

ATTACKS.comboAtom = comboAttack('comboAtom', 'Atom Rally', '4 Hit', '🤖', 'Jab, cross, hook, uppercut - rentetan 4 pukulan ala Atom di ronde terakhir, lawan terlempar KO.', makeComboAtom());
ATTACKS.comboBodyHead = comboAttack('comboBodyHead', 'Body → Head', 'Dada·Pelipis', '🎯', 'Cross rendah ke dada bikin guard turun, langsung hook ke pelipis.', makeComboBodyHead());
ATTACKS.comboDoubleHook = comboAttack('comboDoubleHook', 'Double Hook', 'Kiri·Kanan', '🪝', 'Hook kiri lalu hook kanan - kepala lawan terputar bolak-balik.', makeComboDoubleHook());
ATTACKS.comboZeus = comboAttack('comboZeus', 'Zeus Hammer', 'Dagu·Kepala', '⚡', 'Uppercut kiri membuat kepala terdongak, overhand kanan menghantam seperti palu.', makeComboZeus());
ATTACKS.tauntDance = tauntAttack('tauntDance', 'Robot Dance', '🕺', 'Joget robot ala Atom - lengan bergantian, pinggul goyang, tunjuk lawan, ketuk core dada.', makeTauntDance());
const slamData = makeTauntSlam();
ATTACKS.tauntSlam = { ...tauntAttack('tauntSlam', 'Gauntlet Slam', '🦾', 'Gaya Noisy Boy - rentangkan lengan, adu tinju sendiri 3x sampai memercik, kuda-kuda power.', slamData), hits: slamData.hits };
ATTACKS.tauntSpin = tauntAttack('tauntSpin', 'Head Spin 360°', '🔄', 'Kepala berputar 360° patah-patah lalu rewind, patahkan leher, "aku mengawasimu".', makeTauntSpin());
ATTACKS.tauntThrone = tauntAttack('tauntThrone', 'Zeus Throne', '👑', 'Tangan bersilang angkuh, tatap dari atas, gorok leher, tunjuk ke lantai.', makeTauntThrone());

ATTACKS.overdrive = makeOverdrive();
ATTACKS.comboIppo = legendAttack('comboIppo', 'Dempsey Roll', 'Ala Ippo', '♾️', 'Ala Hajime no Ippo: peek-a-boo, GAZELLE PUNCH melompat, lalu DEMPSEY ROLL - weaving angka 8 dengan hook kiri-kanan bertubi-tubi, hook terakhir mencopot kepala lawan!', makeComboIppo());
ATTACKS.comboAli = legendAttack('comboAli', 'Phantom Punch', 'Ala Ali', '🦋', 'Ala Muhammad Ali: Ali Shuffle, jab kilat beruntun, pull-back menghindari hook lawan, lalu PHANTOM PUNCH secepat kilat - kepala lawan terlepas!', makeComboAli());

ATTACKS.tyson86 = legendAttack('tyson86', 'Iron Mike 8-6', 'Rusuk·Dagu', '🐯', 'Ala Mike Tyson: bob & weave masuk, hook kanan ke rusuk lalu uppercut kanan dengan tangan yang sama - kepala lawan terlempar ke atas!', makeTyson86());
ATTACKS.tysonSlip = legendAttack('tysonSlip', 'Slip & Rip', 'Dagu·Pelipis', '🐯', 'Ala Tyson vs Berbick: slip jab lawan, uppercut kanan dari bawah, hook kiri ke pelipis - kepala terlepas ke samping!', makeTysonSlip());
ATTACKS.tysonRush = legendAttack('tysonRush', 'Peek-a-Boo Rush', 'Rusuk·Kepala', '🐯', 'Ala Tyson: menyerbu dengan bob & weave, double hook kiri (rusuk lalu kepala), overhand kanan menghabisi!', makeTysonRush());
ATTACKS.mayweather = legendAttack('mayweather', 'Shoulder Roll', 'Ala Mayweather', '🛡️', 'Ala Floyd Mayweather: Philly Shell, pull-back hindari jab, shoulder roll tangkis cross, counter kanan, check hook, straight penutup!', makeMayweather());
ATTACKS.leonardBolo = legendAttack('leonardBolo', 'Bolo Punch', 'Ala Sugar Ray', '🌀', 'Ala Sugar Ray Leonard: putar lengan kanan pamer seperti kincir, lawan terpaku, jab kiri mendadak, BOLO PUNCH lebar dari bawah!', makeLeonardBolo());

export const ATTACK_ORDER: AttackId[] = [
  'overdrive', 'comboIppo', 'comboAli', 'tyson86', 'tysonSlip', 'tysonRush', 'mayweather', 'leonardBolo', 'clash', 'freestyle', 'jab', 'cross', 'hook', 'uppercut', 'overhand',
  'combo123', 'comboLiver', 'comboRapid', 'comboAtom', 'comboBodyHead', 'comboDoubleHook', 'comboZeus',
  'tauntBeckon', 'tauntChin', 'tauntFlex', 'tauntDance', 'tauntSlam', 'tauntSpin', 'tauntThrone',
];
export const CATEGORIES: { name: string; ids: AttackId[] }[] = [
  { name: '💀 Pamungkas', ids: ['overdrive'] },
  { name: '👑 Jurus Legenda (Kepala Lepas)', ids: ['comboIppo', 'comboAli'] },
  { name: '🐯 Mike Tyson (Kepala Lepas)', ids: ['tyson86', 'tysonSlip', 'tysonRush'] },
  { name: '🏆 Mayweather & Sugar Ray (Kepala Lepas)', ids: ['mayweather', 'leonardBolo'] },
  { name: 'Spesial', ids: ['clash', 'freestyle'] },
  { name: 'Pukulan Tunggal', ids: ['jab', 'cross', 'hook', 'uppercut', 'overhand'] },
  { name: '🔥 Jurus Kombo', ids: ['combo123', 'comboLiver', 'comboRapid', 'comboAtom', 'comboBodyHead', 'comboDoubleHook', 'comboZeus'] },
  { name: '😏 Taunting', ids: ['tauntBeckon', 'tauntChin', 'tauntFlex', 'tauntDance', 'tauntSlam', 'tauntSpin', 'tauntThrone'] },
];

export function phaseAt(a: Attack, t: number) {
  let p = a.phases[0];
  for (const ph of a.phases) if (t >= ph.t) p = ph;
  return p;
}
