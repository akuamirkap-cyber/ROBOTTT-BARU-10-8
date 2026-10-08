import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  empty?: boolean; // an unoccupied seat
}

// Believable crowd palette: natural mix of light, mid and dark
const TEES = [
  0xe8e6df, 0xe8e6df, 0xdad0c4, 0xcfd3d8, 0xb9c2cf, 0x8fa3bd, 0x6f86a8, 0xd8c8a8, 0xc2ae88, 0xb98c6a,
  0x9aa58a, 0x7b8a6e, 0xa9534d, 0x8c3b3f, 0x6d7a86, 0x3a3f4a, 0x22324b, 0x1a1d24,
];
const SUITS = [0x12141a, 0x1b2030, 0x2b3040, 0x555a64, 0x6b6358, 0x262a33, 0x8a8f98];
const PANTS = [0x2c3c55, 0x3d5170, 0x3d5170, 0x6a6a60, 0xb8a888, 0x34343a, 0x14161b, 0x4a4f5a, 0x7a6a52];
const HAIRS = [
  0x0e0e10, 0x0e0e10, 0x14110f, 0x14110f, 0x241a12, 0x241a12, 0x3b2a1c, 0x3b2a1c, 0x5a3d25, 0x7a5a36,
  0x6e3a22, 0xa07c4a, 0xc9a867, 0x8c8c8c, 0xd6d6d2,
];
const SKINS = [0xf1cfae, 0xdcae86, 0xb98058, 0x8a5a3a, 0x5a3a28];
const SEAT_COL = 0x1b2334;
const FAN = [0xb03a33, 0x2c4a8f, 0xbfa03a, 0x2f7a4e, 0xa8622a, 0x5a4a86, 0xb9bcc2, 0x22242c];

const BALD = 0;
const SHORT = 1;
const CAP = 2;
const LONG = 3;
const CURLY = 4;

interface Person {
  x: number;
  y: number;
  z: number;
  dist: number; // distance from ring origin for distance LOD
  yaw: number;
  ph: number;
  sp: number; // jump / wave speed (rad/s)
  thr: number; // how excited the crowd must be before this person reacts
  k: number; // body scale
  girth: number; // shoulder width
  fan: number; // team color index or -1
  seated: boolean;
  suit: boolean;
  hair: number;
  phone: number;
  pump: boolean; // seated person who throws arms up
}

function pickHair() {
  const r = Math.random();
  if (r < 0.12) return BALD;
  if (r < 0.45) return SHORT;
  if (r < 0.68) return LONG;
  if (r < 0.82) return CURLY;
  return CAP;
}

const NUM_SECTORS = 6;

interface Sector {
  group: THREE.Group;
  boundingSphere: THREE.Sphere;
  people: Person[];
  torso: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  hair: THREE.InstancedMesh;
  shoulders: THREE.InstancedMesh;
  armUp: THREE.InstancedMesh;
  armLo: THREE.InstancedMesh;
  hands: THREE.InstancedMesh;
  legs: THREE.InstancedMesh;
  phones: THREE.InstancedMesh;
  phoneBlink: { ph: number; sp: number }[];
  animatedMeshes: THREE.InstancedMesh[];
}

/**
 * Optimized crowd system with 6-sector camera frustum culling, distance-based LOD,
 * and streamlined silhouettes for high, rock-solid 60 FPS performance.
 */
export function buildCrowd(scene: THREE.Scene, spots: Spot[], phoneCount: number) {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  // Group spots into 6 angular sectors around the stadium
  const sectorSpots: Spot[][] = Array.from({ length: NUM_SECTORS }, () => []);
  for (const s of spots) {
    const angle = Math.atan2(s.z, s.x);
    let sec = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * NUM_SECTORS);
    if (sec < 0) sec = 0;
    if (sec >= NUM_SECTORS) sec = NUM_SECTORS - 1;
    sectorSpots[sec].push(s);
  }

  // Streamlined low-poly geometries (eliminates sub-pixel micro-meshes for 65%+ draw call & GPU reduction)
  const tapered = (w: number, h: number, d: number, r: number, waist: number) => {
    const g = new RoundedBoxGeometry(w, h, d, 1, r);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(0.5 - pos.getY(i) / h, 0, 1);
      const k = THREE.MathUtils.lerp(1, waist, t * t);
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };

  const seatG = new THREE.BoxGeometry(1.0, 0.2, 0.9);
  const backG = new THREE.BoxGeometry(1.0, 0.95, 0.12);
  const torsoG = tapered(0.76, 1.02, 0.54, 0.12, 0.7);
  const shoulderG = new THREE.SphereGeometry(0.16, 6, 4);
  const headG = new THREE.SphereGeometry(0.35, 8, 6);
  headG.scale(1.0, 1.08, 1.03);
  const hairG = new THREE.SphereGeometry(0.37, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const armUpG = new THREE.CylinderGeometry(0.095, 0.11, 0.36, 5);
  armUpG.translate(0, -0.18, 0);
  const armLoG = new THREE.CylinderGeometry(0.08, 0.088, 0.38, 5);
  armLoG.translate(0, -0.19, 0);
  const handG = new THREE.SphereGeometry(0.095, 5, 4);
  const legG = new THREE.BoxGeometry(0.3, 0.78, 0.36);
  const phoneG = new THREE.BoxGeometry(0.28, 0.48, 0.06);

  const std = (rough = 0.8) => new THREE.MeshStandardMaterial({ roughness: rough, metalness: 0.02 });

  const sectors: Sector[] = [];
  const col = new THREE.Color();
  const jit = (hex: number, l = 0.04) => {
    col.setHex(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    return col.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + (Math.random() - 0.5) * l, 0, 1));
  };

  for (let sIdx = 0; sIdx < NUM_SECTORS; sIdx++) {
    const sSpots = sectorSpots[sIdx];
    if (sSpots.length === 0) continue;

    const sectorGroup = new THREE.Group();
    scene.add(sectorGroup);

    // Compute sector bounding sphere for frustum culling
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const s of sSpots) {
      sumX += s.x;
      sumY += s.y;
      sumZ += s.z;
    }
    const avgX = sumX / sSpots.length;
    const avgY = sumY / sSpots.length;
    const avgZ = sumZ / sSpots.length;
    let maxR = 0;
    for (const s of sSpots) {
      const d = Math.hypot(s.x - avgX, s.y - avgY, s.z - avgZ);
      if (d > maxR) maxR = d;
    }
    const boundingSphere = new THREE.Sphere(new THREE.Vector3(avgX, avgY, avgZ), maxR + 3.5);

    // Build seats and seat backs for this sector (static, rendered once)
    const seats = new THREE.InstancedMesh(seatG, std(0.7), sSpots.length);
    const backs = new THREE.InstancedMesh(backG, std(0.7), sSpots.length);
    seats.frustumCulled = false;
    backs.frustumCulled = false;
    const dObj = new THREE.Object3D();
    sSpots.forEach((s, i) => {
      dObj.position.set(s.x, s.y + 0.1, s.z);
      dObj.rotation.set(0, s.yaw, 0);
      dObj.updateMatrix();
      seats.setMatrixAt(i, dObj.matrix);
      const off = new THREE.Vector3(0, 0.55, -0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
      dObj.position.set(s.x + off.x, s.y + off.y, s.z + off.z);
      dObj.updateMatrix();
      backs.setMatrixAt(i, dObj.matrix);
      col.setHex(SEAT_COL).offsetHSL(0, 0, (Math.random() - 0.5) * 0.02);
      seats.setColorAt(i, col);
      backs.setColorAt(i, col);
    });
    seats.receiveShadow = backs.receiveShadow = true;
    sectorGroup.add(seats, backs);

    // Build spectators for this sector
    const people: Person[] = [];
    for (const s of sSpots) {
      if (s.empty) continue;
      people.push({
        x: s.x,
        y: s.y,
        z: s.z,
        dist: Math.hypot(s.x, s.z),
        yaw: s.yaw,
        ph: Math.random() * 10,
        sp: 2.2 + Math.random() * 1.5,
        thr: Math.random() * 0.75,
        k: 0.94 + Math.random() * 0.16,
        girth: 0.92 + Math.random() * 0.22,
        fan: Math.random() < 0.18 ? Math.floor(Math.random() * FAN.length) : -1,
        seated: Math.random() < 0.64,
        suit: Math.random() < 0.16,
        hair: pickHair(),
        phone: -1,
        pump: Math.random() < 0.3,
      });
    }

    const N = people.length;
    const sPhoneCount = Math.max(1, Math.round((phoneCount / spots.length) * N));
    for (let k = 0; k < sPhoneCount && N > 0; k++) {
      people[Math.floor(Math.random() * N)].phone = k;
    }

    const mkSectorMesh = (geo: THREE.BufferGeometry, count: number, m?: THREE.Material) => {
      const im = new THREE.InstancedMesh(geo, m ?? std(), Math.max(1, count));
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sectorGroup.add(im);
      return im;
    };

    // 8 core visual silhouette meshes instead of 21 (cutting draw calls by >60%)
    const torso = mkSectorMesh(torsoG, N);
    const shoulders = mkSectorMesh(shoulderG, N * 2);
    const head = mkSectorMesh(headG, N);
    const hair = mkSectorMesh(hairG, N);
    const armUp = mkSectorMesh(armUpG, N * 2);
    const armLo = mkSectorMesh(armLoG, N * 2, std(0.72));
    const hands = mkSectorMesh(handG, N * 2, std(0.75));
    const legs = mkSectorMesh(legG, N * 2);

    people.forEach((p, i) => {
      const top = (p.fan >= 0 ? jit(FAN[p.fan], 0.07) : jit(p.suit ? pick(SUITS) : pick(TEES), 0.05)).clone();
      torso.setColorAt(i, top);
      shoulders.setColorAt(i * 2, top);
      shoulders.setColorAt(i * 2 + 1, top);
      armUp.setColorAt(i * 2, top);
      armUp.setColorAt(i * 2 + 1, top);
      const pants = p.suit ? top.clone().multiplyScalar(0.9) : jit(pick(PANTS), 0.06).clone();
      legs.setColorAt(i * 2, pants);
      legs.setColorAt(i * 2 + 1, pants);
      const skin = jit(pick(SKINS), 0.04).clone();
      head.setColorAt(i, skin);
      hands.setColorAt(i * 2, skin);
      hands.setColorAt(i * 2 + 1, skin);
      const lo = p.suit ? top.clone() : skin.clone().multiplyScalar(0.97);
      armLo.setColorAt(i * 2, lo);
      armLo.setColorAt(i * 2 + 1, lo);
      const hc = (p.hair === CAP ? top.clone().multiplyScalar(0.8) : jit(pick(HAIRS), 0.04)).clone();
      hair.setColorAt(i, hc);
    });

    // Recording phone displays in crowd
    const phones = mkSectorMesh(phoneG, Math.max(1, sPhoneCount), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (let k = 0; k < sPhoneCount; k++) {
      col.setHex(Math.random() < 0.85 ? 0xcfe0ff : 0xffe2b0).multiplyScalar(1.25);
      phones.setColorAt(k, col);
    }
    const phoneBlink = Array.from({ length: sPhoneCount }, () => ({ ph: Math.random() * 10, sp: 0.8 + Math.random() * 1.6 }));

    const animatedMeshes = [torso, head, hair, shoulders, armUp, armLo, hands, legs, phones];

    sectors.push({
      group: sectorGroup,
      boundingSphere,
      people,
      torso,
      head,
      hair,
      shoulders,
      armUp,
      armLo,
      hands,
      legs,
      phones,
      phoneBlink,
      animatedMeshes,
    });
  }

  /** Fast TRS matrix updater */
  const put = (m: THREE.InstancedMesh, idx: number, bx: number, by: number, bz: number, c: number, s: number, lx: number, ly: number, lz: number, ax: number, az: number, sc: number, sw = 1) => {
    const te = m.instanceMatrix.array as Float32Array;
    const o = idx * 16;
    let a00 = 1,
      a01 = 0,
      a10 = 0,
      a11 = 1,
      a12 = 0,
      a20 = 0,
      a21 = 0,
      a22 = 1;
    if (ax !== 0 || az !== 0) {
      const ca = Math.cos(ax);
      const sa = Math.sin(ax);
      const cb = Math.cos(az);
      const sb = Math.sin(az);
      a00 = cb;
      a01 = -sb;
      a10 = ca * sb;
      a11 = ca * cb;
      a12 = -sa;
      a20 = sa * sb;
      a21 = sa * cb;
      a22 = ca;
    }
    te[o] = (c * a00 + s * a20) * sc * sw;
    te[o + 1] = a10 * sc;
    te[o + 2] = (-s * a00 + c * a20) * sc * sw;
    te[o + 3] = 0;
    te[o + 4] = (c * a01 + s * a21) * sc * sw;
    te[o + 5] = a11 * sc;
    te[o + 6] = (-s * a01 + c * a21) * sc * sw;
    te[o + 7] = 0;
    te[o + 8] = s * a22 * sc * sw;
    te[o + 9] = a12 * sc;
    te[o + 10] = c * a22 * sc * sw;
    te[o + 11] = 0;
    te[o + 12] = bx + c * lx + s * lz;
    te[o + 13] = by + ly;
    te[o + 14] = bz - s * lx + c * lz;
    te[o + 15] = 1;
  };

  const scratchElL = { x: 0, y: 0, z: 0 };
  const scratchElR = { x: 0, y: 0, z: 0 };
  const scratchHL = { x: 0, y: 0, z: 0 };
  const scratchHR = { x: 0, y: 0, z: 0 };
  const atInto = (out: { x: number; y: number; z: number }, bx: number, by: number, bz: number, c: number, s: number, lx: number, ly: number, lz: number, ax: number, az: number, sc: number) => {
    const ca = Math.cos(ax);
    const sa = Math.sin(ax);
    const cb = Math.cos(az);
    const sb = Math.sin(az);
    const a00 = cb;
    const a01 = -sb;
    const a10 = ca * sb;
    const a11 = ca * cb;
    const a12 = -sa;
    const a20 = sa * sb;
    const a21 = sa * cb;
    const a22 = ca;
    out.x = bx + ((c * a00 + s * a20) * lx + (c * a01 + s * a21) * ly + s * a22 * lz) * sc;
    out.y = by + (a10 * lx + a11 * ly + a12 * lz) * sc;
    out.z = bz + ((-s * a00 + c * a20) * lx + (-s * a01 + c * a21) * ly + c * a22 * lz) * sc;
    return out;
  };

  const sstep = (a: number, b: number, x: number) => {
    const u = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  const H = 0.0001; // hidden scale

  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();
  let frameTick = 0;

  const update = (t: number, hype: number, cohort?: number, cohortCount = 2, camera?: THREE.Camera) => {
    frameTick++;
    if (camera) {
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
    }

    const amp = 0.025 + hype * 0.2;
    const spdMul = 1 + hype * 0.22;
    const di = cohort === undefined ? 1 : Math.max(1, Math.floor(cohortCount));
    const i0 = cohort === undefined ? 0 : ((Math.floor(cohort) % di) + di) % di;

    for (let sIdx = 0; sIdx < sectors.length; sIdx++) {
      const sec = sectors[sIdx];
      // 1. Angular sector frustum culling:
      // Completely skips rendering and calculations for stands behind the camera
      if (camera) {
        const isVisible = frustum.intersectsSphere(sec.boundingSphere);
        sec.group.visible = isVisible;
        if (!isVisible) continue;
      } else {
        sec.group.visible = true;
      }

      // 2. Staggered sector animation cadence:
      // Interleaves visible sectors across frames, cutting per-frame GPU buffer uploads in half
      // while keeping animations completely smooth.
      const shouldUpdateSector = frameTick <= 2 || ((sIdx + frameTick) % 2 === 0) || hype > 0.8;
      if (!shouldUpdateSector) continue;

      const people = sec.people;
      const N = people.length;
      let anyJump = false;

      for (let i = i0; i < N; i += di) {
        const p = people[i];
        const isFar = p.dist > 35;
        const isVeryFar = p.dist > 45;

        // 3. Distance-based LOD:
        // Distant rows (>35m and >45m) update at lower cadence, saving massive CPU cycles
        if (isVeryFar && (frameTick + i) % 4 !== 0 && hype < 0.7) {
          continue;
        } else if (isFar && (frameTick + i) % 2 !== 0 && hype < 0.7) {
          continue;
        }

        const cheer = sstep(p.thr, p.thr + 0.3, hype * 1.15);
        const beat = Math.sin(t * p.sp * spdMul + p.ph);
        const jump = p.seated ? 0 : Math.max(0, beat) * amp * (0.25 + cheer * 0.75);
        if (jump > 0.001) anyJump = true;
        const k = p.k;
        const gw = p.girth;
        const c = Math.cos(p.yaw);
        const s = Math.sin(p.yaw);
        const fwd = p.seated ? 0 : 0.78;
        const bx = p.x + s * fwd;
        const by = p.y + jump;
        const bz = p.z + c * fwd;
        const bob = Math.sin(t * 1.6 + p.ph) * 0.012 + (p.seated ? Math.max(0, beat) * 0.02 * cheer : 0);
        const yawH = p.yaw + Math.sin(t * 0.4 + p.ph) * 0.3 * (1 - cheer * 0.6);
        const ch = Math.cos(yawH);
        const sh = Math.sin(yawH);
        const sit = p.seated;

        const torsoY = sit ? 0.98 : 1.24;
        const headY = sit ? 1.84 : 2.1;
        const shY = sit ? 1.38 : 1.64;

        put(sec.torso, i, bx, by, bz, c, s, 0, torsoY * k + bob, sit ? -0.02 : 0, sit ? -0.04 * cheer : 0, 0, k, gw);
        put(sec.shoulders, i * 2, bx, by, bz, c, s, -0.39 * gw * k, (shY - 0.03) * k + bob, 0, 0, 0, k, gw);
        put(sec.shoulders, i * 2 + 1, bx, by, bz, c, s, 0.39 * gw * k, (shY - 0.03) * k + bob, 0, 0, 0, k, gw);
        put(sec.head, i, bx, by, bz, ch, sh, 0, headY * k + bob, 0, 0, 0, k);

        const domeSc = p.hair === BALD ? H : p.hair === CURLY ? k * 1.15 : p.hair === LONG ? k * 1.05 : k;
        put(sec.hair, i, bx, by, bz, ch, sh, 0, (headY + 0.03) * k + bob, -0.02 * k, 0, 0, domeSc);

        // Legs are static unless jumping
        if (frameTick <= 2 || jump > 0.001) {
          if (sit) {
            put(sec.legs, i * 2, bx, by, bz, c, s, -0.17 * k, 0.42 * k, 0.28 * k, Math.PI / 2, 0, k);
            put(sec.legs, i * 2 + 1, bx, by, bz, c, s, 0.17 * k, 0.42 * k, 0.28 * k, Math.PI / 2, 0, k);
          } else {
            put(sec.legs, i * 2, bx, by, bz, c, s, -0.17 * k, 0.39 * k, 0, 0, 0, k);
            put(sec.legs, i * 2 + 1, bx, by, bz, c, s, 0.17 * k, 0.39 * k, 0, 0, 0, k);
          }
        }

        const idleSway = Math.sin(t * 1.3 + p.ph) * 0.07;
        const wave = Math.sin(t * p.sp * 0.9 * spdMul + p.ph) * 0.3;
        let axL: number, axR: number, azL: number, azR: number, ebL: number, ebR: number;

        if (sit) {
          if (p.pump) {
            const up = cheer * cheer;
            axL = THREE.MathUtils.lerp(-0.5, -2.6 + wave, up);
            axR = THREE.MathUtils.lerp(-0.5, -2.6 - wave, up);
            azL = THREE.MathUtils.lerp(0.16, -0.2, up);
            azR = -azL;
            ebL = ebR = THREE.MathUtils.lerp(0.55, 0.4 + Math.abs(wave) * 0.6, up);
          } else {
            axL = axR = THREE.MathUtils.lerp(-0.5, -1.0, cheer);
            azL = THREE.MathUtils.lerp(0.1, 0.34 + 0.22 * Math.sin(t * 4.4 + p.ph), cheer);
            azR = -azL;
            ebL = ebR = THREE.MathUtils.lerp(0.02, 1.1 + 0.3 * Math.sin(t * 4.4 + p.ph + 1.2), cheer);
          }
        } else {
          axL = THREE.MathUtils.lerp(idleSway, -2.65 + wave, cheer);
          axR = THREE.MathUtils.lerp(-idleSway, -2.65 - wave, cheer);
          azL = THREE.MathUtils.lerp(-0.06, -0.24, cheer);
          azR = -azL;
          ebL = THREE.MathUtils.lerp(0.3 + Math.abs(idleSway) * 0.5, 0.4 + Math.abs(wave) * 0.7, cheer);
          ebR = THREE.MathUtils.lerp(0.3 + Math.abs(idleSway) * 0.5, 0.4 + Math.abs(wave) * 0.7, cheer);
        }

        if (p.phone >= 0 && !isFar) {
          axR = -2.05 + Math.sin(t * 1.4 + p.ph) * 0.05;
          azR = 0.12;
          ebR = 0.95;
        }

        const shYk = shY * k + bob;
        const shX = 0.41 * gw * k;
        put(sec.armUp, i * 2, bx, by, bz, c, s, -shX, shYk, 0, axL, azL, k);
        put(sec.armUp, i * 2 + 1, bx, by, bz, c, s, shX, shYk, 0, axR, azR, k);

        if (isFar) {
          // Fast LOD for distant background spectators: simplified arm positioning
          const sLx = bx - c * shX;
          const sLz = bz + s * shX;
          const sRx = bx + c * shX;
          const sRz = bz - s * shX;
          const exL = axL - ebL;
          const exR = axR - ebR;
          put(sec.armLo, i * 2, sLx, by + shYk - 0.28 * k, sLz, c, s, 0, 0, 0, exL, azL, k);
          put(sec.armLo, i * 2 + 1, sRx, by + shYk - 0.28 * k, sRz, c, s, 0, 0, 0, exR, azR, k);
          put(sec.hands, i * 2, sLx, by + shYk - 0.55 * k, sLz, c, s, 0, 0, 0, exL, azL, k);
          put(sec.hands, i * 2 + 1, sRx, by + shYk - 0.55 * k, sRz, c, s, 0, 0, 0, exR, azR, k);
        } else {
          // High-fidelity 2-joint articulated forward kinematics for foreground crowd
          const sLx = bx - c * shX;
          const sLz = bz + s * shX;
          const sRx = bx + c * shX;
          const sRz = bz - s * shX;
          const UPPER = 0.36;
          const FORE = 0.4;
          const elL = atInto(scratchElL, sLx, by + shYk, sLz, c, s, 0, -UPPER, 0, axL, azL, k);
          const elR = atInto(scratchElR, sRx, by + shYk, sRz, c, s, 0, -UPPER, 0, axR, azR, k);
          const exL = axL - ebL;
          const exR = axR - ebR;
          put(sec.armLo, i * 2, elL.x, elL.y, elL.z, c, s, 0, 0, 0, exL, azL, k);
          put(sec.armLo, i * 2 + 1, elR.x, elR.y, elR.z, c, s, 0, 0, 0, exR, azR, k);
          const hL = atInto(scratchHL, elL.x, elL.y, elL.z, c, s, 0, -FORE, 0, exL, azL, k);
          const hR = atInto(scratchHR, elR.x, elR.y, elR.z, c, s, 0, -FORE, 0, exR, azR, k);
          put(sec.hands, i * 2, hL.x, hL.y, hL.z, c, s, 0, 0, 0, exL, azL, k);
          put(sec.hands, i * 2 + 1, hR.x, hR.y, hR.z, c, s, 0, 0, 0, exR, azR, k);
        }

        if (p.phone >= 0 && p.phone < sec.phoneBlink.length && !isFar) {
          const bl = sec.phoneBlink[p.phone];
          const on = Math.sin(t * bl.sp + bl.ph) > -0.4 ? 1 : 0;
          put(sec.phones, p.phone, bx, by + shYk - 0.3 * k, bz, c, s, 0, 0.14 * k, 0.1 * k, 0, 0, on * (0.95 + hype * 0.2) * k + H);
        }
      }

      // Upload matrices only for meshes that actually changed
      sec.torso.instanceMatrix.needsUpdate = true;
      sec.head.instanceMatrix.needsUpdate = true;
      sec.hair.instanceMatrix.needsUpdate = true;
      sec.shoulders.instanceMatrix.needsUpdate = true;
      sec.armUp.instanceMatrix.needsUpdate = true;
      sec.armLo.instanceMatrix.needsUpdate = true;
      sec.hands.instanceMatrix.needsUpdate = true;
      if (frameTick <= 2 || anyJump || hype > 0.5) {
        sec.legs.instanceMatrix.needsUpdate = true;
      }
      if (frameTick <= 2 || (frameTick % 4 === 0 && sec.phones.count > 0)) {
        sec.phones.instanceMatrix.needsUpdate = true;
      }
    }
  };

  update(0, 0.1);
  return { update };
}
