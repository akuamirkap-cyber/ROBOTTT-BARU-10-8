import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Robot } from './robot';
import { ZEUS_PRESET } from '../zeus/zeusPreset';

// ============================================================================
// 100% ZEUS MODEL GEOMETRY GENERATORS (IDENTICAL TO HALO-SIMPLE / ZEUSVIEWER)
// ============================================================================

type N3 = [number, number, number];
type P2 = [number, number];
type Adj = { p: N3; r: N3; s: N3; u: number; v?: N3; b?: [number, number] };

export function blob(e = 0.5, seg = 24) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.floor(seg / 2)));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
    p.setXYZ(i, f(p.getX(i)), f(p.getY(i)), f(p.getZ(i)));
  }
  g.computeVertexNormals();
  return g;
}

export function panel(o: {
  w: number;
  h: number;
  d?: number;
  bottom?: number;
  bendX?: number;
  bendY?: number;
  bulge?: number;
  skew?: number;
  tip?: number;
}) {
  const { w, h, d = 0.2, bottom = 1, bendX = 0, bendY = 0, bulge = 0.08, skew = 0, tip = 0 } = o;
  const g = new THREE.BoxGeometry(1, 1, 1, 14, 14, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let z = p.getZ(i);
    const y = p.getY(i);
    const t = y + 0.5;
    const nx = x * 2;
    const edge = Math.max(Math.abs(nx), Math.abs(y * 2));
    z = z * d * (1 - Math.pow(edge, 8) * 0.5);
    if (z > 0) z += bulge * (1 - nx * nx) * (1 - 4 * y * y);
    let yy = y * h;
    if (tip) yy -= tip * (1 - Math.abs(nx)) * (1 - t) * (1 - t);
    x = x * w * (bottom + (1 - bottom) * t) + skew * (t - 0.5);
    if (bendX) {
      const R = bendX;
      const a = x / R;
      const r = R + z;
      x = r * Math.sin(a);
      z = r * Math.cos(a) - R;
    }
    if (bendY) {
      const R = bendY;
      const a = yy / R;
      const r = R + z;
      yy = r * Math.sin(a);
      z = r * Math.cos(a) - R;
    }
    p.setXYZ(i, x, yy, z);
  }
  g.computeVertexNormals();
  return g;
}

export function shape(pts: P2[], round = 0.12) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const a: P2 = [p1[0] + (p0[0] - p1[0]) * round, p1[1] + (p0[1] - p1[1]) * round];
    const b: P2 = [p1[0] + (p2[0] - p1[0]) * round, p1[1] + (p2[1] - p1[1]) * round];
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

export function front(pts: P2[], depth: number, bevel = 0.1, round = 0.15) {
  const g = new THREE.ExtrudeGeometry(shape(pts, round), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 5,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export function side(pts: P2[], width: number, bevel = 0.1, round = 0.15) {
  const g = front(pts, width, bevel, round);
  g.rotateY(-Math.PI / 2);
  return g;
}

export function bend(g: THREE.BufferGeometry, R: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = x / R;
    const r = R + z;
    p.setXYZ(i, r * Math.sin(a), p.getY(i), r * Math.cos(a) - R);
  }
  g.computeVertexNormals();
  return g;
}

export function lathe(pts: P2[], seg = 24) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), Math.min(seg, 24));
}

export function cyl(rt: number, rb: number, h: number, seg = 20) {
  return new THREE.CylinderGeometry(rt, rb, h, Math.min(seg, 20));
}

// ============================================================================
// MATERIALS & TEXTURES (MATCHING REAL ZEUS ASSET)
// ============================================================================

export function createZeusMaterials(themeColor = '#22ff44') {
  const themeCol = new THREE.Color(themeColor);

  const gun = new THREE.MeshStandardMaterial({
    color: 0x33373b,
    metalness: 0.9,
    roughness: 0.22,
    envMapIntensity: 1.5,
  });
  const gunL = new THREE.MeshStandardMaterial({
    color: 0x50555a,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.6,
  });
  const blk = new THREE.MeshStandardMaterial({
    color: 0x121314,
    metalness: 0.65,
    roughness: 0.28,
    envMapIntensity: 1.4,
  });
  const blkM = new THREE.MeshStandardMaterial({
    color: 0x050505,
    metalness: 0.3,
    roughness: 0.6,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd8dce0,
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.8,
  });
  const eye = new THREE.MeshStandardMaterial({
    color: themeCol.clone().lerp(new THREE.Color(0xffffff), 0.35),
    emissive: themeCol,
    emissiveIntensity: 8,
    toneMapped: false,
  });
  const crystal = new THREE.MeshStandardMaterial({
    color: themeCol.clone().multiplyScalar(0.6),
    emissive: themeCol.clone().multiplyScalar(0.45),
    emissiveIntensity: 0.85,
    metalness: 0.15,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
  });

  [gun, gunL, blk, blkM, chrome, eye, crystal].forEach((m) => {
    m.side = THREE.DoubleSide;
  });

  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  return { gun, gunL, blk, blkM, chrome, eye, crystal, glowTex, themeCol };
}

// ============================================================================
// ZEUS SKELETON & PROPORTIONS CONFIGURATION
// ============================================================================

export interface ZeusProportions {
  headScale: number;
  chestScale: number;
  armScale: number;
  legScale: number;
}

export const DEFAULT_ZEUS_PROPORTIONS: ZeusProportions = {
  headScale: 1.0,
  chestScale: 1.0,
  armScale: 1.0,
  legScale: 1.0,
};

export interface ZeusRigMetrics {
  L1: number;
  L2: number;
  SOLE: number;
  ANKLE_H: number;
  STAND_Y: number;
  hipX: number;
}

export interface ZeusRuntimeLink {
  f: THREE.Mesh;
  l: THREE.Mesh;
  off: THREE.Matrix4;
}

interface OrigBonePositions {
  waist: THREE.Vector3;
  chest: THREE.Vector3;
  neck: THREE.Vector3;
  head: THREE.Vector3;
  clavs: THREE.Vector3[];
  caps: THREE.Vector3[];
  shoulders: THREE.Vector3[];
  elbows: THREE.Vector3[];
  wrists: THREE.Vector3[];
  fists: THREE.Vector3[];
  hipJ: THREE.Vector3[];
  kneeJ: THREE.Vector3[];
  footJ: THREE.Vector3[];
}

const LS_ZEUS_PROP = 'steel_titans_zeus_prop_v1';
const LS_ZEUS_THEME = 'steel_titans_zeus_theme';
const LS_VIEWER_THEME = 'zeus-theme-v1';
const LS_VIEWER_ADJ = 'zeus-part-adjust-v1';
const LS_VIEWER_HIDDEN = 'zeus-hidden-v1';
const LS_VIEWER_GROUPS = 'zeus-groups-v1';

// Master conversion factor from ZeusViewer native units (total height 12.31)
// to Steel Titans Robot local units. At K = 0.72, Zeus's native leg length
// (2.70 thigh + 2.90 shin = 5.60) equals 4.032 Robot units, matching the
// Robot's 4.00-unit leg rig while keeping 100% uniform scale across every
// body part and making Zeus tower over standard robots just like Real Steel.
export const ZEUS_MASTER_SCALE = 0.72;

export function loadZeusProportions(): ZeusProportions {
  try {
    const raw = localStorage.getItem(LS_ZEUS_PROP);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        headScale: Math.max(0.6, Math.min(1.6, Number(p.headScale) || 1.0)),
        chestScale: Math.max(0.6, Math.min(1.6, Number(p.chestScale) || 1.0)),
        armScale: Math.max(0.6, Math.min(1.6, Number(p.armScale) || 1.0)),
        legScale: Math.max(0.6, Math.min(1.6, Number(p.legScale) || 1.0)),
      };
    }
  } catch {}
  return { ...DEFAULT_ZEUS_PROPORTIONS };
}

export function saveZeusProportions(prop: ZeusProportions) {
  try {
    localStorage.setItem(LS_ZEUS_PROP, JSON.stringify(prop));
  } catch {}
}

function saveOrigBonesIfNeeded(r: Robot) {
  if (r.root.userData.origBonePos) return;
  const orig: OrigBonePositions = {
    waist: r.waist.position.clone(),
    chest: r.chest.position.clone(),
    neck: r.neck.position.clone(),
    head: r.head.position.clone(),
    clavs: r.clavs.map((o) => o.position.clone()),
    caps: r.caps.map((o) => o.position.clone()),
    shoulders: r.shoulders.map((o) => o.position.clone()),
    elbows: r.elbows.map((o) => o.position.clone()),
    wrists: r.wrists.map((o) => o.position.clone()),
    fists: r.fists.map((o) => o.position.clone()),
    hipJ: r.hipJ.map((o) => o.position.clone()),
    kneeJ: r.kneeJ.map((o) => o.position.clone()),
    footJ: r.footJ.map((o) => o.position.clone()),
  };
  r.root.userData.origBonePos = orig;
}

/**
 * Remove all Zeus parts, restore original robot bone positions, and reveal default meshes
 */
export function unmount100PercentZeus(r: Robot) {
  const gone: THREE.Object3D[] = [];
  r.root.traverse((node) => {
    if (node.userData.isZeus) gone.push(node);
  });
  for (const obj of gone) {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
    }
    obj.removeFromParent();
  }

  // Restore original skeleton bone positions
  const orig = r.root.userData.origBonePos as OrigBonePositions | undefined;
  if (orig) {
    r.waist.position.copy(orig.waist);
    r.chest.position.copy(orig.chest);
    r.neck.position.copy(orig.neck);
    r.head.position.copy(orig.head);
    r.clavs.forEach((o, i) => orig.clavs[i] && o.position.copy(orig.clavs[i]));
    r.caps.forEach((o, i) => orig.caps[i] && o.position.copy(orig.caps[i]));
    r.shoulders.forEach((o, i) => orig.shoulders[i] && o.position.copy(orig.shoulders[i]));
    r.elbows.forEach((o, i) => orig.elbows[i] && o.position.copy(orig.elbows[i]));
    r.wrists.forEach((o, i) => orig.wrists[i] && o.position.copy(orig.wrists[i]));
    r.fists.forEach((o, i) => orig.fists[i] && o.position.copy(orig.fists[i]));
    r.hipJ.forEach((o, i) => orig.hipJ[i] && o.position.copy(orig.hipJ[i]));
    r.kneeJ.forEach((o, i) => orig.kneeJ[i] && o.position.copy(orig.kneeJ[i]));
    r.footJ.forEach((o, i) => orig.footJ[i] && o.position.copy(orig.footJ[i]));
  }
  delete r.root.userData.zeusMetrics;
  delete r.root.userData.zeusLinks;

  // Restore visibility of standard meshes
  r.root.traverse((node) => {
    if (node instanceof THREE.Mesh && !node.userData.isZeus) {
      if (node.userData.wasHiddenByZeus !== undefined) {
        node.visible = node.userData.wasHiddenByZeus;
        delete node.userData.wasHiddenByZeus;
      }
    }
  });
}

/**
 * Mount 100% of Zeus parts from the 3D model asset in halo-simple.zip
 * WITH THE COMPLETE ZEUS_PRESET SCULPTED ADJUSTMENTS AND 1:1 BONE ALIGNMENT
 * directly onto the corresponding joints of the Steel Titans robot.
 */
export function mount100PercentZeus(
  r: Robot,
  themeHex?: string,
  proportions?: ZeusProportions,
) {
  saveOrigBonesIfNeeded(r);
  unmount100PercentZeus(r);

  const resolvedTheme =
    themeHex ||
    (() => {
      try {
        return localStorage.getItem(LS_ZEUS_THEME) || localStorage.getItem(LS_VIEWER_THEME) || '#22ff44';
      } catch {
        return '#22ff44';
      }
    })();

  const prop = proportions ?? loadZeusProportions();
  const K = ZEUS_MASTER_SCALE;

  // Hide generic robot meshes so only 100% Zeus is shown
  r.root.traverse((node) => {
    if (node instanceof THREE.Mesh && !node.userData.isZeus) {
      if (node.userData.wasHiddenByZeus === undefined) {
        node.userData.wasHiddenByZeus = node.visible;
      }
      node.visible = false;
    }
  });

  // --------------------------------------------------------------------------
  // ALIGN ROBOT SKELETON JOINTS TO AUTHENTIC ZEUS ANATOMICAL PIVOTS (AT SCALE K)
  // In ZeusViewer native coordinates:
  //   Hip (leg)    = (±1.00, 6.10, 0.00)
  //   Knee         = (±1.00, 3.40, 0.00) -> L1 = 2.70 * K
  //   Ankle        = (±1.00, 0.50, 0.00) -> L2 = 2.90 * K
  //   Sole bottom  = -0.17               -> SOLE = 0.67 * K
  //   Waist        = ( 0.00, 6.60, 0.00)
  //   Chest        = ( 0.00, 7.25, 0.00)
  //   Neck         = ( 0.00, 10.60, 0.10)
  //   Head         = ( 0.00, 11.35, 0.55)
  //   Pauldron(sh) = (±2.85, 10.35, 0.00)
  //   Shoulder(arm)= (±3.40, 9.60, 0.00)
  //   Elbow(fore)  = (±3.40, 7.35, 0.00) -> -2.50 * 0.90 = -2.25 * K below arm
  //   Fist         = (±3.40, 4.29, 0.09) -> -3.40 * 0.90 = -3.06 * K below fore
  // --------------------------------------------------------------------------
  const HIP_REF_Y = 2.68; // pelvis-local Y of hipJ
  const kHead = K * prop.headScale;
  const kChest = K * prop.chestScale;
  const kArm = K * prop.armScale;
  const kLeg = K * prop.legScale;

  const L1 = 2.70 * kLeg;
  const L2 = 2.90 * kLeg;
  const SOLE = 0.67 * kLeg;
  const ANKLE_H = SOLE + 0.02;
  const STAND_Y = ANKLE_H + (L1 + L2) * 0.985;
  const hipX = 1.00 * kLeg;

  const zeusMetrics: ZeusRigMetrics = { L1, L2, SOLE, ANKLE_H, STAND_Y, hipX };
  r.root.userData.zeusMetrics = zeusMetrics;

  r.waist.position.set(0, HIP_REF_Y + (6.60 - 6.10) * kChest, 0);
  r.chest.position.set(0, (7.25 - 6.60) * kChest, 0);
  r.neck.position.set(0, (10.60 - 7.25) * kChest, 0.10 * kChest);
  r.head.position.set(0, (11.35 - 10.60) * kChest, (0.55 - 0.10) * kChest);

  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    if (r.clavs[i]) r.clavs[i].position.set(s * 2.85 * kChest, (10.35 - 7.25) * kChest, 0);
    if (r.caps[i]) r.caps[i].position.set(0, 0, 0);
    if (r.shoulders[i]) r.shoulders[i].position.set(s * (3.40 - 2.85) * kChest, (9.60 - 10.35) * kChest, 0);
    if (r.elbows[i]) r.elbows[i].position.set(0, -2.50 * 0.90 * kArm, 0);
    if (r.wrists[i]) r.wrists[i].position.set(0, (-5.90 - -2.50) * 0.90 * kArm, 0.10 * 0.90 * kArm);
    if (r.fists[i]) r.fists[i].position.set(0, 0, 0);
    if (r.hipJ[i]) r.hipJ[i].position.set(s * hipX, HIP_REF_Y, 0);
    if (r.kneeJ[i]) r.kneeJ[i].position.set(0, -L1, 0);
    if (r.footJ[i]) r.footJ[i].position.set(0, -L2, 0);
  }

  // --------------------------------------------------------------------------
  // CREATE MOUNT GROUPS ON ROBOT JOINTS (WITH PIVOT-CENTERED INNER CONTAINERS)
  // --------------------------------------------------------------------------
  const mkGroup = (name: string, parent: THREE.Object3D, scl: N3, offset: N3 = [0, 0, 0]) => {
    const outer = new THREE.Group();
    outer.name = name;
    outer.userData.isZeus = true;
    outer.scale.set(...scl);
    parent.add(outer);

    const inner = new THREE.Group();
    inner.userData.isZeus = true;
    inner.position.set(...offset);
    outer.add(inner);
    return { outer, inner };
  };

  // Head & Neck
  const headMount = mkGroup('zeus_100_head', r.head, [0.72 * kHead, 0.72 * kHead, 0.72 * kHead], [0, 0, 0]);
  const neckMount = mkGroup('zeus_100_neck', r.neck, [kHead, kHead, kHead], [0, -10.60, -0.10]);

  // Chest, Waist & Pelvis
  const chestMount = mkGroup('zeus_100_chest', r.chest, [kChest, kChest, kChest], [0, -7.25, 0]);
  const waistMount = mkGroup('zeus_100_waist', r.waist, [kChest, kChest, kChest], [0, -6.60, 0]);
  const pelvisObj = new THREE.Group();
  pelvisObj.name = 'zeus_100_pelvis_anchor';
  pelvisObj.userData.isZeus = true;
  pelvisObj.position.set(0, HIP_REF_Y, 0);
  r.pelvis.add(pelvisObj);
  const pelvisMount = mkGroup('zeus_100_pelvis', pelvisObj, [kChest, kChest, kChest], [0, -6.10, 0]);

  // Left & Right Limb Mounts
  const capMounts: THREE.Group[] = [];
  const armMounts: THREE.Group[] = [];
  const foreMounts: THREE.Group[] = [];
  const fistMounts: THREE.Group[] = [];
  const thighMounts: THREE.Group[] = [];
  const shinMounts: THREE.Group[] = [];
  const bootMounts: THREE.Group[] = [];

  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    capMounts.push(mkGroup(`zeus_100_cap_${i}`, r.caps[i], [s * kChest, kChest, kChest], [0, 0, 0]).inner);
    armMounts.push(mkGroup(`zeus_100_arm_${i}`, r.shoulders[i], [s * kArm, 0.90 * kArm, kArm], [0, 0, 0]).inner);
    foreMounts.push(mkGroup(`zeus_100_fore_${i}`, r.elbows[i], [s * kArm, 0.90 * kArm, kArm], [0, 2.50, 0]).inner);
    fistMounts.push(mkGroup(`zeus_100_fist_${i}`, r.fists[i], [s * kArm, 0.90 * kArm, kArm], [0, 0, 0]).inner);
    thighMounts.push(mkGroup(`zeus_100_thigh_${i}`, r.hipJ[i], [s * kLeg, kLeg, kLeg], [0, 0, 0]).inner);
    shinMounts.push(mkGroup(`zeus_100_shin_${i}`, r.kneeJ[i], [s * kLeg, kLeg, kLeg], [0, 2.70, 0]).inner);
    bootMounts.push(mkGroup(`zeus_100_boot_${i}`, r.footJ[i], [s * kLeg, kLeg, kLeg], [0, 5.60, 0]).inner);
  }

  // --------------------------------------------------------------------------
  // BUILD ALL 208 ZEUS PARTS IN THE EXACT ZEUSVIEWER ORDER (p0 .. p207)
  // SO ZEUS_PRESET APPLIES 100% BIT-FOR-BIT IDENTICALLY TO HALO_SIMPLE
  // --------------------------------------------------------------------------
  const { gun, gunL, blk, blkM, chrome, eye, crystal, glowTex, themeCol } = createZeusMaterials(resolvedTheme);
  const B = blob(0.5);
  const B3 = blob(0.3);
  const B7 = blob(0.75);
  const S = blob(1);

  const parts: THREE.Mesh[] = [];
  const partById = new Map<string, THREE.Mesh>();
  const createdStack: THREE.Mesh[][] = [];
  let section = 'Kepala';

  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    p: N3,
    rot: N3 = [0, 0, 0],
    scl: N3 = [1, 1, 1],
    parent: THREE.Object3D = chestMount.inner,
  ) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scl);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isZeus = true;
    parent.add(mesh);
    const id = 'p' + parts.length;
    mesh.userData.id = id;
    mesh.userData.sec = section;
    parts.push(mesh);
    partById.set(id, mesh);
    createdStack.forEach((l) => l.push(mesh));
    return mesh;
  };

  const pair = (parent: THREE.Object3D, fn: (g: THREE.Group, sideIdx: number) => void) => {
    const lists: THREE.Mesh[][] = [];
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const s = sideIdx === 0 ? 1 : -1;
      const g = new THREE.Group();
      g.scale.x = s;
      g.userData.isZeus = true;
      parent.add(g);
      const list: THREE.Mesh[] = [];
      createdStack.push(list);
      fn(g, sideIdx);
      createdStack.pop();
      lists.push(list);
    }
    lists[0].forEach((m, i) => {
      const o = lists[1][i];
      if (o && !m.userData.mirror) {
        m.userData.mirror = o;
        o.userData.mirror = m;
        m.userData.side = 'Kanan';
        o.userData.side = 'Kiri';
      }
    });
  };

  // ================= 1. HEAD (p0 .. p43) =================
  const head = headMount.inner;
  add(B7, gun, [0, 0.45, -0.15], [0, 0, 0], [0.85, 1.1, 0.95], head);
  add(B7, gunL, [0, 0.5, -0.15], [0, 0, 0], [0.2, 1.17, 1.02], head);
  pair(head, (g) => {
    add(B7, gun, [0.36, 0.46, -0.15], [0, 0, 0.06], [0.11, 1.08, 1.0], g);
    add(B7, blk, [0.22, 0.48, -0.15], [0, 0, 0.03], [0.07, 1.1, 1.0], g);
  });
  pair(head, (g) => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.12);
    s.lineTo(0.78, 0.2);
    s.lineTo(0.8, 0.36);
    s.lineTo(0, 0.18);
    s.closePath();
    add(
      new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 }),
      gunL,
      [0, -0.05, 0.5],
      [0.12, 0.22, 0],
      [1, 1, 1],
      g,
    );
  });
  add(B, gunL, [0, 0.0, 0.95], [0, 0, 0], [0.09, 0.18, 0.1], head);
  add(B, blkM, [0, -0.23, 0.62], [0, 0, 0], [0.82, 0.15, 0.3], head);
  pair(head, (g) => {
    const s = new THREE.Shape();
    s.moveTo(0.06, -0.02);
    s.lineTo(0.66, 0.11);
    s.quadraticCurveTo(0.74, 0.04, 0.66, -0.05);
    s.lineTo(0.1, -0.08);
    s.closePath();
    add(
      new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }),
      eye,
      [0, -0.24, 0.85],
      [0, 0.2, -0.04],
      [1, 1, 1],
      g,
    );
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: themeCol,
        map: glowTex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sp.position.set(0.4, -0.22, 1.0);
    sp.scale.set(1.1, 0.55, 1);
    sp.userData.isZeus = true;
    g.add(sp);
    add(panel({ w: 0.62, h: 0.08, d: 0.08 }), gun, [0.38, -0.34, 0.9], [0, 0.22, 0.13], [1, 1, 1], g);
    add(panel({ w: 0.45, h: 0.5, d: 0.18, bottom: 0.5, bendX: 0.8, bulge: 0.06 }), gunL, [0.5, -0.6, 0.72], [0, 0.55, 0.15], [1, 1, 1], g);
  });
  add(panel({ w: 1.3, h: 1.15, d: 0.55, bottom: 0.6, bendX: 0.9, bulge: 0.1 }), blk, [0, -0.85, 0.45], [0, 0, 0], [1, 1, 1], head);
  add(panel({ w: 0.18, h: 0.6, d: 0.32, bottom: 2.8, bulge: 0.12 }), gunL, [0, -0.55, 0.92], [-0.18, 0, 0], [1, 1, 1], head);
  add(B, gunL, [0, -0.86, 1.02], [0.15, 0, 0], [0.32, 0.12, 0.16], head);
  pair(head, (g) => {
    add(B, blkM, [0.13, -0.9, 1.13], [0, 0, 0.3], [0.07, 0.035, 0.03], g);
    const s = new THREE.Shape();
    s.moveTo(0.05, 0.0);
    s.lineTo(0.62, 0.25);
    s.lineTo(0.7, -0.15);
    s.lineTo(0.45, -0.55);
    s.lineTo(0.05, -0.62);
    s.closePath();
    add(
      new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 }),
      gun,
      [0.02, -0.98, 0.7],
      [0.1, 0.42, 0],
      [1, 1, 1],
      g,
    );
    for (let i = 0; i < 3; i++) {
      add(B3, blkM, [0.22 + i * 0.13, -1.2 + i * 0.04, 1.0 - i * 0.08], [0, 0.42, -0.15], [0.02, 0.2, 0.03], g);
    }
    add(panel({ w: 0.36, h: 0.12, d: 0.12, bulge: 0.02 }), gunL, [0.18, -1.04, 1.03], [0, 0.3, -0.3], [1, 1, 1], g);
    add(B, gun, [0.72, -0.55, 0.05], [0, 0.2, 0.08], [0.2, 0.6, 0.6], g);
    add(cyl(0.18, 0.18, 0.1, 24), chrome, [0.9, -0.5, 0.05], [0, 0, Math.PI / 2], [1, 1, 1], g);
  });
  add(B, blkM, [0, -1.13, 1.0], [0, 0, 0], [0.24, 0.045, 0.05], head);
  for (let i = -2; i <= 2; i++) {
    add(B3, chrome, [i * 0.08, -1.13, 1.03], [0, 0, 0], [0.025, 0.035, 0.02], head);
  }
  add(B3, gunL, [0, -1.42, 0.82], [0.15, 0, 0], [0.32, 0.17, 0.25], head);
  add(B, blkM, [0, -1.42, 1.07], [0, 0, 0], [0.012, 0.13, 0.02], head);
  // p43: Neck cylinder
  add(cyl(0.45, 0.55, 1.0), blk, [0, 10.6, 0.1], [0, 0, 0], [1, 1, 1], neckMount.inner);

  // ================= 2. TORSO (p44 .. p89) =================
  section = 'Dada';
  const chest = chestMount.inner;
  // p44: inner black core (narrower at bottom -> V torso)
  add(lathe([[0, 10.9], [1.6, 10.8], [2.0, 10.1], [1.85, 8.9], [1.3, 7.7], [0.9, 7.3], [0, 7.25]], 48), blk, [0, 0, -0.1], [0, 0, 0], [1, 1, 0.68], chest);
  // p45..p56: central green crystals
  const crys = (p: N3, rot: N3, scl: N3, parent: THREE.Object3D = chest) =>
    add(new THREE.OctahedronGeometry(0.5, 0), crystal, p, rot, scl, parent);
  for (let i = 0; i < 12; i++) {
    const y = 10.2 - i * 0.2;
    const w = 0.55 * (1 - i / 14);
    crys([((i % 3) - 1) * w * 0.6, y, 1.05], [0.2 * i, i * 0.9, 0.15 * (i % 2 ? 1 : -1)], [0.45, 0.9, 0.35], chest);
  }
  // p57..p70: side rib crystals
  pair(chest, (g) => {
    for (let i = 0; i < 6; i++) {
      crys([0.85 + (i % 2) * 0.25, 8.9 - i * 0.22, 1.05 - (i % 2) * 0.1], [0.3, 0.4, 0.9 + i * 0.08], [0.32, 0.85, 0.28], g);
    }
    crys([1.25, 8.4, 0.85], [0.2, 0.5, 1.1], [0.35, 1.0, 0.3], g);
  });

  // p71..p78: V pec plate, inner bevel edge, upper collar plate, side black rib frame
  pair(chest, (g) => {
    const pec = front(
      [
        [0.32, 10.55],
        [1.3, 10.75],
        [2.25, 10.55],
        [2.35, 9.9],
        [2.1, 9.1],
        [1.55, 8.55],
        [1.0, 8.0],
        [0.5, 7.75],
        [0.42, 8.5],
        [0.55, 9.3],
        [0.4, 10.0],
      ],
      0.22,
      0.1,
      0.25,
    );
    add(bend(pec, 2.4), gun, [0, 0, 1.12], [0, 0, 0], [1, 1, 1], g);
    const edge = front(
      [
        [0.3, 10.5],
        [0.42, 10.0],
        [0.5, 9.3],
        [0.38, 8.5],
        [0.45, 7.75],
        [0.32, 7.8],
        [0.22, 8.5],
        [0.36, 9.3],
        [0.2, 10.0],
      ],
      0.3,
      0.04,
      0.3,
    );
    add(bend(edge, 2.4), blk, [0, 0, 1.12], [0, 0, 0], [1, 1, 1], g);
    add(bend(front([[0.4, 10.6], [1.9, 10.85], [2.0, 11.15], [0.55, 11.0]], 0.6, 0.08, 0.3), 2.0), gunL, [0, 0, 0.55], [0, 0, 0], [1, 1, 1], g);
    add(side([[-0.6, 10.2], [0.75, 10.0], [0.65, 8.4], [0.1, 7.6], [-0.6, 7.9]], 0.5, 0.08, 0.25), blk, [1.95, 0, 0], [0, 0, -0.08], [1, 1, 1], g);
  });
  // p79: lower black frame
  add(
    front(
      [
        [-1.35, 8.05],
        [-0.45, 7.75],
        [-0.2, 7.95],
        [0.2, 7.95],
        [0.45, 7.75],
        [1.35, 8.05],
        [1.3, 7.45],
        [0.95, 7.0],
        [0.55, 7.0],
        [0.4, 7.35],
        [-0.4, 7.35],
        [-0.55, 7.0],
        [-0.95, 7.0],
        [-1.3, 7.45],
      ],
      0.5,
      0.08,
      0.15,
    ),
    blk,
    [0, 0, 0.95],
    [0, 0, 0],
    [1, 1, 1],
    chest,
  );
  // p80, p81: central sternum clasp
  add(front([[-0.28, 8.6], [0.28, 8.6], [0.35, 7.7], [0.18, 7.3], [-0.18, 7.3], [-0.35, 7.7]], 0.4, 0.06, 0.2), blk, [0, 0, 1.25], [0, 0, 0], [1, 1, 1], chest);
  add(front([[-0.07, 8.4], [0.07, 8.4], [0.07, 7.6], [-0.07, 7.6]], 0.1, 0.02, 0.3), blkM, [0, 0, 1.5], [0, 0, 0], [1, 1, 1], chest);
  // p82..p85: side clamp teeth on frame
  pair(chest, (g) => {
    for (let i = 0; i < 2; i++) {
      add(front([[0, 0.25], [0.22, 0.25], [0.22, -0.25], [0, -0.25]], 0.25, 0.04, 0.3), blk, [0.62 + i * 0.32, 7.2, 1.2], [0, 0, 0], [1, 1, 1], g);
    }
  });
  // p86: upper back armor
  add(B, gun, [0, 9.2, -0.9], [0, 0, 0], [1.9, 1.6, 0.7], chest);
  // p87: waist lathe
  add(lathe([[0, 7.6], [0.85, 7.55], [0.95, 7.3], [0.7, 7.0], [0.78, 6.7], [0, 6.6]]), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], waistMount.inner);
  // p88, p89: pelvis block & front panel
  add(B, blk, [0, 6.45, 0.05], [0, 0, 0], [1.15, 0.42, 0.78], pelvisMount.inner);
  add(panel({ w: 0.9, h: 0.9, d: 0.3, bottom: 0.6, bendX: 1.5, bulge: 0.08 }), gunL, [0, 6.2, 0.75], [0, 0, 0], [1, 1, 1], pelvisMount.inner);

  // ================= 3. SHOULDERS + ARMS + FISTS (p90 .. p149) =================
  {
    const lists: THREE.Mesh[][] = [];
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const list: THREE.Mesh[] = [];
      createdStack.push(list);

      section = 'Bahu';
      const sh = capMounts[sideIdx];
      add(S, blk, [-0.15, -0.45, 0], [0, 0, 0], [0.8, 0.8, 0.8], sh);
      add(
        front(
          [
            [-1.0, 0.2],
            [0.1, 0.62],
            [1.05, 0.35],
            [1.35, -0.25],
            [1.25, -1.15],
            [0.85, -1.2],
            [0.8, -0.3],
            [0.2, 0.05],
            [-1.0, -0.2],
          ],
          1.9,
          0.14,
          0.22,
        ),
        gun,
        [0.1, 0, 0],
        [0, 0, 0],
        [1, 1, 1],
        sh,
      );
      add(front([[-0.7, 0.1], [0.1, 0.4], [0.9, 0.2], [0.85, 0.0], [0.1, 0.2], [-0.7, -0.08]], 2.05, 0.06, 0.2), gunL, [0.1, 0.25, 0], [0, 0, 0], [1, 1, 1], sh);
      add(front([[1.0, -0.3], [1.1, -1.05], [0.95, -1.05], [0.88, -0.3]], 1.6, 0.03, 0.2), blkM, [0.06, 0, 0], [0, 0, 0], [1, 1, 1], sh);
      for (const z of [0.75, -0.75]) {
        add(cyl(0.07, 0.07, 0.1, 12), chrome, [1.42, -0.5, z], [0, 0, Math.PI / 2], [1, 1, 1], sh);
      }

      section = 'Lengan';
      const arm = armMounts[sideIdx];
      const fore = foreMounts[sideIdx];
      // Upper arm (mounted on r.shoulders[sideIdx])
      add(cyl(0.5, 0.5, 1.2, 32), blk, [-0.1, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], arm);
      add(lathe([[0, 0], [0.48, -0.05], [0.6, -0.6], [0.62, -1.1], [0.52, -1.8], [0.42, -2.3], [0, -2.4]]), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1.05], arm);
      add(side([[-0.55, -0.1], [0.45, -0.05], [0.68, -0.45], [0.6, -1.2], [0.25, -1.45], [-0.5, -1.35], [-0.62, -0.7]], 1.15, 0.1, 0.25), gun, [0.05, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      add(side([[0.2, -0.9], [0.75, -1.05], [0.72, -1.75], [0.3, -2.0]], 0.7, 0.06, 0.2), blk, [-0.1, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      add(side([[-0.6, -1.2], [-0.15, -1.3], [-0.2, -2.1], [-0.6, -2.0]], 0.8, 0.06, 0.2), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      for (let i = 0; i < 6; i++) {
        add(B3, gunL, [0.68, -0.35 - i * 0.2, -0.05], [0, 0, 0], [0.1, 0.07, 0.4], arm);
      }
      // Elbow & Forearm (mounted on r.elbows[sideIdx], with foreInner at y = +2.50)
      add(S, blk, [0, -2.45, 0], [0, 0, 0], [0.48, 0.48, 0.5], fore);
      for (const sx of [0.42, -0.42]) {
        add(side([[-0.45, -2.0], [0.35, -2.1], [0.5, -2.6], [0.2, -3.0], [-0.4, -2.9]], 0.16, 0.05, 0.25), blk, [sx, 0, 0], [0, 0, 0], [1, 1, 1], fore);
      }
      add(cyl(0.2, 0.2, 1.05, 24), chrome, [0, -2.5, 0], [0, 0, Math.PI / 2], [1, 1, 1], fore);
      add(side([[-0.5, -2.75], [0.35, -2.7], [0.62, -2.95], [0.6, -4.35], [0.35, -4.7], [-0.4, -4.7], [-0.55, -4.0]], 1.0, 0.12, 0.2), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], fore);
      add(side([[0.5, -2.85], [1.0, -3.0], [1.05, -4.05], [0.55, -4.25]], 0.18, 0.05, 0.2), gunL, [0.3, 0, 0], [0, 0, 0], [1, 1, 1], fore);
      for (let i = 0; i < 5; i++) {
        add(cyl(0.055, 0.055, 0.32, 12), blkM, [0.3, -3.15 - i * 0.2, 0.82], [0, 0, Math.PI / 2], [1, 1, 1], fore);
      }
      add(side([[-0.3, -3.0], [0.2, -3.0], [0.25, -4.3], [-0.25, -4.3]], 1.06, 0.03, 0.3), blk, [-0.02, 0, -0.05], [0, 0, 0], [1, 1, 1], fore);
      add(cyl(0.34, 0.26, 0.3, 24), chrome, [0, -4.8, 0.05], [0, 0, 0], [1, 1, 1], fore);
      for (let i = 0; i < 2; i++) {
        add(cyl(0.5, 0.5, 0.12, 32), i % 2 ? blk : gunL, [0, -5.0 - i * 0.13, 0.05], [0, 0, 0], [1, 1, 1], fore);
      }

      section = 'Tinju';
      const fist = fistMounts[sideIdx];
      add(side([[-0.6, 0.75], [0.3, 0.78], [0.5, 0.4], [0.85, 0.25], [0.9, -0.15], [-0.6, -0.15]], 1.25, 0.12, 0.22), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], fist);
      add(side([[-0.6, -0.1], [0.95, -0.1], [1.08, -0.45], [0.98, -1.0], [-0.45, -1.0], [-0.62, -0.6]], 1.32, 0.12, 0.2), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], fist);
      add(side([[0.45, 0.35], [0.8, 0.22], [0.82, 0.0], [0.45, 0.05]], 1.3, 0.03, 0.3), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], fist);
      for (let i = 0; i < 3; i++) {
        add(B, blkM, [-0.4 + i * 0.4, -0.55, 1.14], [0, 0, 0], [0.02, 0.32, 0.03], fist);
      }
      add(side([[0.1, 0.55], [0.45, 0.5], [0.5, 0.15], [0.1, 0.2]], 0.3, 0.06, 0.3), blk, [-0.6, 0, 0.1], [0, 0, 0], [1, 1, 1], fist);

      createdStack.pop();
      lists.push(list);
    }
    lists[0].forEach((m, i) => {
      const o = lists[1][i];
      if (o && !m.userData.mirror) {
        m.userData.mirror = o;
        o.userData.mirror = m;
        m.userData.side = 'Kanan';
        o.userData.side = 'Kiri';
      }
    });
  }

  // ================= 4. LEGS (p150 .. p207) =================
  {
    const lists: THREE.Mesh[][] = [];
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const list: THREE.Mesh[] = [];
      createdStack.push(list);

      const thigh = thighMounts[sideIdx];
      const shin = shinMounts[sideIdx];
      const boot = bootMounts[sideIdx];

      section = 'Pinggul';
      add(S, blk, [0, 0, 0], [0, 0, 0], [0.62, 0.58, 0.62], thigh);
      add(cyl(0.22, 0.22, 1.4, 24), gunL, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], thigh);

      section = 'Paha';
      add(lathe([[0, 0], [0.55, -0.12], [0.62, -0.6], [0.55, -1.4], [0.4, -2.25], [0, -2.4]], 40), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1.05], thigh);
      add(bend(front([[-0.5, -0.15], [0.35, -0.1], [0.72, -0.35], [0.66, -1.35], [0.32, -2.05], [-0.15, -2.1], [-0.42, -1.4], [-0.58, -0.6]], 0.16, 0.08, 0.2), 0.7), gun, [0, 0, 0.55], [0, 0, 0], [1, 1, 1], thigh);
      add(side([[-0.45, -0.25], [0.45, -0.3], [0.38, -1.5], [-0.3, -1.7]], 0.14, 0.05, 0.25), gunL, [0.72, 0, 0], [0, 0, 0.04], [1, 1, 1], thigh);
      add(front([[-0.66, -0.35], [0.66, -0.3], [0.86, -0.45], [0.84, -0.88], [0.62, -1.0], [-0.66, -0.97]], 1.38, 0.08, 0.2), gunL, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], thigh);
      add(front([[-0.5, -0.6], [0.6, -0.58], [0.6, -0.68], [-0.5, -0.7]], 1.42, 0.01, 0.4), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], thigh);
      for (const [xx, yy] of [
        [0.35, -0.47],
        [0.35, -0.82],
        [0.6, -0.47],
        [0.6, -0.82],
      ]) {
        add(new THREE.SphereGeometry(0.05, 10, 6), chrome, [xx, yy, 0.82], [0, 0, 0], [1, 1, 1], thigh);
      }
      add(new THREE.SphereGeometry(0.15, 16, 8), chrome, [-0.42, -0.3, 0.62], [0, 0, 0], [1, 1, 1], thigh);
      add(cyl(0.16, 0.16, 0.7, 20), chrome, [-0.42, -0.75, 0.66], [0.06, 0, 0], [1, 1, 1], thigh);
      add(cyl(0.2, 0.2, 0.08, 20), blk, [-0.42, -1.1, 0.68], [0.06, 0, 0], [1, 1, 1], thigh);
      add(cyl(0.085, 0.085, 1.3, 16), chrome, [-0.42, -1.75, 0.7], [0.06, 0, 0], [1, 1, 1], thigh);
      add(cyl(0.18, 0.15, 0.3, 16), chrome, [-0.42, -2.45, 0.72], [0, 0, 0], [1, 1, 1], thigh);

      section = 'Lutut';
      add(S, blk, [0, -2.7, 0.0], [0, 0, 0], [0.52, 0.48, 0.55], shin);
      add(cyl(0.22, 0.22, 1.3, 24), gunL, [0, -2.7, 0], [0, 0, Math.PI / 2], [1, 1, 1], shin);
      for (const sx of [0.66, -0.66]) {
        add(cyl(0.14, 0.14, 0.06, 16), chrome, [sx, -2.7, 0], [0, 0, Math.PI / 2], [1, 1, 1], shin);
      }
      add(bend(front([[-0.45, -2.35], [0.45, -2.35], [0.5, -2.7], [0.0, -3.15], [-0.5, -2.7]], 0.2, 0.08, 0.2), 0.6), gun, [0, 0, 0.55], [-0.08, 0, 0], [1, 1, 1], shin);
      add(front([[-0.06, -2.5], [0.06, -2.5], [0.03, -2.95], [-0.03, -2.95]], 0.1, 0.015, 0.3), blkM, [0, 0, 0.78], [-0.08, 0, 0], [1, 1, 1], shin);

      section = 'Betis';
      add(lathe([[0, -2.95], [0.42, -3.05], [0.48, -3.7], [0.36, -5.3], [0, -5.4]], 40), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], shin);
      const shinPts: P2[] = [
        [-0.5, -3.0],
        [0.0, -2.92],
        [0.5, -3.0],
        [0.66, -3.5],
        [0.55, -3.95],
        [0.66, -4.4],
        [0.48, -5.1],
        [0.25, -5.4],
        [-0.25, -5.4],
        [-0.48, -5.1],
        [-0.66, -4.4],
        [-0.55, -3.95],
        [-0.66, -3.5],
      ];
      add(bend(front(shinPts, 0.2, 0.1, 0.2), 0.6), gun, [0, 0, 0.45], [0, 0, 0], [1, 1, 1], shin);
      add(bend(front([[0.42, -3.2], [0.78, -3.45], [0.8, -4.65], [0.45, -5.2]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], shin);
      add(bend(front([[-0.42, -3.2], [-0.78, -3.45], [-0.8, -4.65], [-0.45, -5.2]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], shin);
      add(bend(front([[-0.28, -3.25], [0.28, -3.25], [0.34, -3.7], [0.2, -4.85], [0, -5.15], [-0.2, -4.85], [-0.34, -3.7]], 0.1, 0.05, 0.25), 0.7), gunL, [0, 0, 0.73], [0, 0, 0], [1, 1, 1], shin);
      add(front([[-0.09, -3.45], [0.09, -3.45], [0.09, -4.35], [-0.09, -4.35]], 0.12, 0.025, 0.35), blkM, [0, 0, 0.88], [0, 0, 0], [1, 1, 1], shin);
      add(B, blkM, [0.3, -4.65, 0.74], [0, 0, 0.55], [0.17, 0.018, 0.03], shin);
      add(B, blkM, [-0.3, -4.65, 0.74], [0, 0, -0.55], [0.17, 0.018, 0.03], shin);
      add(side([[-0.3, -3.1], [-0.78, -3.5], [-0.72, -4.4], [-0.35, -5.0]], 0.8, 0.08, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], shin);
      add(cyl(0.07, 0.07, 1.6, 12), chrome, [0, -4.2, -0.7], [-0.12, 0, 0], [1, 1, 1], shin);

      section = 'Kaki';
      add(S, blk, [0, -5.6, 0], [0, 0, 0], [0.38, 0.3, 0.38], boot);
      add(cyl(0.16, 0.16, 1.0, 16), chrome, [0, -5.6, 0], [0, 0, Math.PI / 2], [1, 1, 1], boot);
      add(side([[-0.55, -5.6], [0.25, -5.6], [1.15, -5.88], [1.3, -6.25], [-0.6, -6.25]], 1.0, 0.1, 0.25), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], boot);
      add(side([[0.25, -5.62], [0.75, -5.75], [0.78, -5.92], [0.25, -5.8]], 0.92, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], boot);
      add(side([[0.8, -5.78], [1.15, -5.9], [1.2, -6.02], [0.82, -5.94]], 0.88, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], boot);
      add(side([[-0.55, -5.75], [-0.85, -6.0], [-0.8, -6.25], [-0.5, -6.25]], 0.6, 0.05, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], boot);
      add(side([[-0.6, -6.18], [1.3, -6.18], [1.28, -6.27], [-0.62, -6.27]], 1.04, 0.02, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], boot);

      createdStack.pop();
      lists.push(list);
    }
    lists[0].forEach((m, i) => {
      const o = lists[1][i];
      if (o && !m.userData.mirror) {
        m.userData.mirror = o;
        o.userData.mirror = m;
        m.userData.side = 'Kanan';
        o.userData.side = 'Kiri';
      }
    });
  }

  // --------------------------------------------------------------------------
  // APPLY ZEUS_PRESET (+ ANY SAVED 3D EDITOR ADJUSTMENTS)
  // EXACTLY AS ZEUSVIEWER.TSX DOES
  // --------------------------------------------------------------------------
  const D2R = Math.PI / 180;
  parts.forEach((m) => {
    m.userData.base = { p: m.position.clone(), r: m.rotation.clone(), s: m.scale.clone() };
  });

  const centerOf = (m: THREE.Mesh) => {
    if (!m.userData.center) {
      m.geometry.computeBoundingBox();
      m.userData.center = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
    }
    return m.userData.center as THREE.Vector3;
  };

  const pivotOf = (m: THREE.Mesh, a: Adj) => {
    const b = m.userData.base;
    const c = centerOf(m);
    const q = new THREE.Quaternion().setFromEuler(b.r);
    const v = a.v || [0, 0, 0];
    return c.clone().multiply(b.s).applyQuaternion(q).add(b.p).add(new THREE.Vector3(v[0], v[1], v[2]));
  };

  const applyBend = (m: THREE.Mesh, b?: [number, number]) => {
    const bh = b?.[0] || 0;
    const bv = b?.[1] || 0;
    if (!m.userData.orig) {
      if (!bh && !bv) return;
      centerOf(m);
      m.geometry = m.geometry.clone();
      m.userData.orig = (m.geometry.attributes.position.array as Float32Array).slice();
      m.geometry.computeBoundingBox();
      m.userData.size = m.geometry.boundingBox!.getSize(new THREE.Vector3());
    }
    const o = m.userData.orig as Float32Array;
    const c = centerOf(m);
    const sz = m.userData.size as THREE.Vector3;
    const pos = m.geometry.attributes.position;
    const kh = (bh * Math.PI) / Math.max(sz.x, 0.001);
    const kv = (bv * Math.PI) / Math.max(sz.y, 0.001);
    for (let i = 0; i < pos.count; i++) {
      let x = o[i * 3];
      let y = o[i * 3 + 1];
      let z = o[i * 3 + 2];
      if (kh) {
        const R = 1 / kh;
        const dz = z - c.z;
        const a = (x - c.x) * kh;
        x = c.x + (R + dz) * Math.sin(a);
        z = c.z - R + (R + dz) * Math.cos(a);
      }
      if (kv) {
        const R = 1 / kv;
        const dz = z - c.z;
        const a = (y - c.y) * kv;
        y = c.y + (R + dz) * Math.sin(a);
        z = c.z - R + (R + dz) * Math.cos(a);
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  };

  const applyAdj = (m: THREE.Mesh, a: Adj) => {
    const b = m.userData.base;
    const c = centerOf(m);
    const qb = new THREE.Quaternion().setFromEuler(b.r);
    const sAdj = new THREE.Vector3(a.s[0] * a.u, a.s[1] * a.u, a.s[2] * a.u);
    const pos0 = c.clone().sub(c.clone().multiply(sAdj)).multiply(b.s).applyQuaternion(qb).add(b.p);
    const P = pivotOf(m, a);
    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.r[0] * D2R, a.r[1] * D2R, a.r[2] * D2R));
    const pos = pos0.sub(P).applyQuaternion(qa).add(P);
    pos.add(new THREE.Vector3(a.p[0], a.p[1], a.p[2]));
    m.position.copy(pos);
    m.quaternion.copy(qa.multiply(qb));
    m.scale.copy(b.s.clone().multiply(sAdj));
    applyBend(m, a.b);
  };

  const adjMap = new Map<string, Adj>();
  const setAdj = (id: string, a: Adj, mirror: boolean) => {
    const m = partById.get(id);
    if (!m) return;
    adjMap.set(id, a);
    applyAdj(m, a);
    const o = m.userData.mirror as THREE.Mesh | undefined;
    if (mirror && o) {
      adjMap.set(o.userData.id, a);
      applyAdj(o, a);
    }
  };

  // 1) Apply built-in ZEUS_PRESET (raises face/jaw p6..p42 by +0.45, neck p43 by +0.324,
  //    widens torso p44 by 1.22x, rotates pauldrons p91 by [0, 180, 43] & p92 by [0, 0, -21],
  //    angles collar/ribs p71..p74, and tucks lower chest frame p79..p86)
  for (const e of ZEUS_PRESET.parts) {
    setAdj(
      e.id,
      {
        p: e.letak,
        r: e.kemiringan_deg,
        s: e.skala_xyz,
        u: e.ukuran ?? 1,
        v: e.titik_poin || [0, 0, 0],
        b: e.lengkung || [0, 0],
      },
      !!e.mirror,
    );
  }

  // 2) Apply any user-saved adjustments from ZeusViewer 3D Editor in localStorage
  try {
    const savedRaw = localStorage.getItem(LS_VIEWER_ADJ);
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (saved && typeof saved === 'object') {
        if (Array.isArray(saved.parts)) {
          for (const e of saved.parts) {
            setAdj(
              e.id,
              {
                p: e.letak,
                r: e.kemiringan_deg,
                s: e.skala_xyz,
                u: e.ukuran ?? 1,
                v: e.titik_poin || [0, 0, 0],
                b: e.lengkung || [0, 0],
              },
              !!e.mirror,
            );
          }
        } else {
          Object.entries(saved as Record<string, Adj>).forEach(([id, a]) => {
            if (a && Array.isArray(a.p) && Array.isArray(a.r) && Array.isArray(a.s)) {
              setAdj(id, a, false);
            }
          });
        }
      }
    }

    // 3) Apply user groups from zeus-groups-v1 and weld group followers to leaders
    const groupsRaw = localStorage.getItem(LS_VIEWER_GROUPS);
    let groupsDict: Record<string, string[]> = { ...ZEUS_PRESET.groups };
    if (groupsRaw) {
      try {
        const parsed = JSON.parse(groupsRaw);
        if (parsed && typeof parsed === 'object') {
          groupsDict = { ...groupsDict, ...parsed };
        }
      } catch {}
    }

    const runtimeLinks: ZeusRuntimeLink[] = [];
    r.root.updateMatrixWorld(true);

    Object.entries(groupsDict).forEach(([groupName, ids]) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      ids.forEach((id) => {
        const m = partById.get(id);
        if (m) {
          m.userData.group = groupName;
          const om = m.userData.mirror as THREE.Mesh | undefined;
          if (om) om.userData.group = groupName;
        }
      });

      // Weld group followers to the leader so their movements stay active and matching 1:1 in Steel Titans
      if (ids.length >= 2) {
        const leaderId = ids[ids.length - 1];
        const L = partById.get(leaderId);
        if (L) {
          for (const fid of ids.slice(0, -1)) {
            const F = partById.get(fid);
            if (!F || F === L) continue;
            if (F.parent && L.parent && F.parent !== L.parent) {
              const off = L.matrixWorld.clone().invert().multiply(F.matrixWorld);
              runtimeLinks.push({ f: F, l: L, off });
              const fm = F.userData.mirror as THREE.Mesh | undefined;
              const lm = L.userData.mirror as THREE.Mesh | undefined;
              if (fm && lm && fm.parent && lm.parent && fm.parent !== lm.parent) {
                const offM = lm.matrixWorld.clone().invert().multiply(fm.matrixWorld);
                runtimeLinks.push({ f: fm, l: lm, off: offM });
              }
            }
          }
        }
      }
    });

    if (runtimeLinks.length > 0) {
      r.root.userData.zeusLinks = runtimeLinks;
    } else {
      delete r.root.userData.zeusLinks;
    }

    // 4) Apply hidden/deleted parts
    const hiddenRaw = localStorage.getItem(LS_VIEWER_HIDDEN);
    if (hiddenRaw) {
      const hiddenIds = JSON.parse(hiddenRaw) as string[];
      if (Array.isArray(hiddenIds)) {
        const hiddenSet = new Set(hiddenIds);
        parts.forEach((m) => {
          if (hiddenSet.has(m.userData.id)) m.visible = false;
        });
      }
    }
  } catch {
    // ignore invalid localStorage data
  }

  // 5) Bake cross-bone group links directly onto leader bone groups & merge static meshes per (boneGroup, material)
  //    Reduces 208 individual draw calls per Zeus robot down to ~26 batched meshes for locked 60 FPS in Arena!
  r.root.updateMatrixWorld(true);
  const zl = r.root.userData.zeusLinks as ZeusRuntimeLink[] | undefined;
  if (zl && zl.length > 0) {
    for (const lk of zl) {
      if (lk.f && lk.l && lk.l.parent) {
        lk.l.parent.attach(lk.f);
      }
    }
    delete r.root.userData.zeusLinks;
  }

  const allBoneGroups: THREE.Group[] = [
    headMount.inner,
    neckMount.inner,
    chestMount.inner,
    waistMount.inner,
    pelvisMount.inner,
    ...capMounts,
    ...armMounts,
    ...foreMounts,
    ...fistMounts,
    ...thighMounts,
    ...shinMounts,
    ...bootMounts,
  ];

  r.root.updateMatrixWorld(true);
  for (const bg of allBoneGroups) {
    bg.updateWorldMatrix(true, true);
    const invBg = bg.matrixWorld.clone().invert();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const meshesToRemove: THREE.Mesh[] = [];

    bg.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      meshesToRemove.push(m);
      if (!m.visible) return;
      const mat = m.material as THREE.Material;
      const relMat = invBg.clone().multiply(m.matrixWorld);
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal') {
          g.deleteAttribute(k);
        }
      }
      g.applyMatrix4(relMat);
      if (!g.attributes.normal) {
        g.computeVertexNormals();
      }
      let list = byMat.get(mat);
      if (!list) {
        list = [];
        byMat.set(mat, list);
      }
      list.push(g);
    });

    for (const m of meshesToRemove) {
      m.removeFromParent();
    }

    for (const [mat, geoms] of byMat.entries()) {
      if (geoms.length === 0) continue;
      const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
      if (!merged) continue;
      const batchedMesh = new THREE.Mesh(merged, mat);
      batchedMesh.castShadow = mat !== eye && mat !== crystal;
      batchedMesh.receiveShadow = mat !== eye;
      batchedMesh.userData.isZeus = true;
      bg.add(batchedMesh);
    }
  }

  // Tag robot as currently wearing Zeus 100%
  r.ctx.style.isZeus100 = true;
}
