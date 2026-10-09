import * as THREE from 'three';
import type { Robot } from './robot';

// ============================================================================
// 100% ZEUS MODEL GEOMETRY GENERATORS (IDENTICAL TO HALO-SIMPLE ASSET)
// ============================================================================

type N3 = [number, number, number];
type P2 = [number, number];

export function blob(e = 0.5, seg = 48) {
  const g = new THREE.SphereGeometry(1, seg, seg / 2);
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
  const g = new THREE.BoxGeometry(1, 1, 1, 32, 32, 2);
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
    bevelSegments: 5,
    curveSegments: 8,
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

export function lathe(pts: P2[], seg = 40) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function cyl(rt: number, rb: number, h: number, seg = 32) {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}

// ============================================================================
// MATERIALS & TEXTURES (MATCHING REAL ZEUS ASSET)
// ============================================================================

export function createZeusMaterials(themeColor = '#22ff44') {
  const themeCol = new THREE.Color(themeColor);

  const gun = new THREE.MeshPhysicalMaterial({
    color: 0x33373b,
    metalness: 0.9,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const gunL = new THREE.MeshPhysicalMaterial({
    color: 0x50555a,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const blk = new THREE.MeshPhysicalMaterial({
    color: 0x121314,
    metalness: 0.6,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const blkM = new THREE.MeshStandardMaterial({
    color: 0x050505,
    metalness: 0.3,
    roughness: 0.6,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce0,
    metalness: 1,
    roughness: 0.08,
  });
  const eye = new THREE.MeshStandardMaterial({
    color: themeCol.clone().lerp(new THREE.Color(0xffffff), 0.35),
    emissive: themeCol,
    emissiveIntensity: 6,
    toneMapped: false,
  });
  const crystal = new THREE.MeshPhysicalMaterial({
    color: themeCol.clone().multiplyScalar(0.6),
    emissive: themeCol.clone().multiplyScalar(0.3),
    emissiveIntensity: 0.6,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.6,
    thickness: 0.6,
    ior: 1.5,
    clearcoat: 1,
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
// MOUNT 100% REAL ZEUS PARTS ONTO ROBOT SKELETON
// ============================================================================

/**
 * Remove all Zeus parts and reveal default meshes if any
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

const LS_ZEUS_PROP = 'steel_titans_zeus_prop_v1';

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

/**
 * Mount 100% of Zeus parts from the 3D model asset in halo-simple.zip
 * directly onto the corresponding joints of the Steel Titans robot.
 * Proportions of head, chest, arms, and legs match the authentic Zeus asset.
 */
export function mount100PercentZeus(
  r: Robot,
  themeHex = '#22ff44',
  proportions?: ZeusProportions,
) {
  unmount100PercentZeus(r);

  const prop = proportions ?? loadZeusProportions();

  // Hide generic robot meshes so only 100% Zeus is shown
  r.root.traverse((node) => {
    if (node instanceof THREE.Mesh && !node.userData.isZeus) {
      if (node.userData.wasHiddenByZeus === undefined) {
        node.userData.wasHiddenByZeus = node.visible;
      }
      node.visible = false;
    }
  });

  const { gun, gunL, blk, blkM, chrome, eye, crystal, glowTex, themeCol } = createZeusMaterials(themeHex);
  const B = blob(0.5), B3 = blob(0.3), B7 = blob(0.75), S = blob(1);

  // Helper to add a mesh tagged as Zeus
  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    p: N3 = [0, 0, 0],
    rot: N3 = [0, 0, 0],
    scl: N3 = [1, 1, 1],
    parent: THREE.Object3D = r.root,
  ) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scl);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isZeus = true;
    parent.add(mesh);
    return mesh;
  };

  const pair = (parent: THREE.Object3D, fn: (g: THREE.Group, side: number) => void) => {
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      g.scale.x = s;
      g.userData.isZeus = true;
      parent.add(g);
      fn(g, s);
    }
  };

  // --------------------------------------------------------------------------
  // 1. KEPALA (HEAD) — Scaled to match authentic Zeus head-to-torso ratio
  // In ZeusViewer: head scale was 0.72 inside base height ~11.85.
  // --------------------------------------------------------------------------
  const headRoot = new THREE.Group();
  headRoot.name = 'zeus_100_head';
  headRoot.userData.isZeus = true;
  const headUniform = 0.39 * prop.headScale;
  headRoot.scale.setScalar(headUniform);
  headRoot.position.set(0, 0.12, 0.05);
  r.head.add(headRoot);

  add(B7, gun, [0, 0.45, -0.15], [0, 0, 0], [0.85, 1.1, 0.95], headRoot);
  add(B7, gunL, [0, 0.5, -0.15], [0, 0, 0], [0.2, 1.17, 1.02], headRoot);
  pair(headRoot, (g) => {
    add(B7, gun, [0.36, 0.46, -0.15], [0, 0, 0.06], [0.11, 1.08, 1.0], g);
    add(B7, blk, [0.22, 0.48, -0.15], [0, 0, 0.03], [0.07, 1.1, 1.0], g);
  });
  pair(headRoot, (g) => {
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
  add(B, gunL, [0, 0.0, 0.95], [0, 0, 0], [0.09, 0.18, 0.1], headRoot);
  add(B, blkM, [0, -0.23, 0.62], [0, 0, 0], [0.82, 0.15, 0.3], headRoot);
  pair(headRoot, (g) => {
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
    const l = new THREE.PointLight(themeCol, 1.2, 1.5);
    l.position.set(0.4, -0.22, 1.2);
    l.userData.isZeus = true;
    g.add(l);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: themeCol,
        map: glowTex,
        transparent: true,
        opacity: 0.55,
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
  add(panel({ w: 1.3, h: 1.15, d: 0.55, bottom: 0.6, bendX: 0.9, bulge: 0.1 }), blk, [0, -0.85, 0.45], [0, 0, 0], [1, 1, 1], headRoot);
  add(panel({ w: 0.18, h: 0.6, d: 0.32, bottom: 2.8, bulge: 0.12 }), gunL, [0, -0.55, 0.92], [-0.18, 0, 0], [1, 1, 1], headRoot);
  add(B, gunL, [0, -0.86, 1.02], [0.15, 0, 0], [0.32, 0.12, 0.16], headRoot);
  pair(headRoot, (g) => {
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
  add(B, blkM, [0, -1.13, 1.0], [0, 0, 0], [0.24, 0.045, 0.05], headRoot);
  for (let i = -2; i <= 2; i++) {
    add(B3, chrome, [i * 0.08, -1.13, 1.03], [0, 0, 0], [0.025, 0.035, 0.02], headRoot);
  }
  add(B3, gunL, [0, -1.42, 0.82], [0.15, 0, 0], [0.32, 0.17, 0.25], headRoot);
  add(B, blkM, [0, -1.42, 1.07], [0, 0, 0], [0.012, 0.13, 0.02], headRoot);
  add(cyl(0.45, 0.55, 1.0), blk, [0, -1.75, 0.1], [0, 0, 0], [1, 1, 1], headRoot);

  // --------------------------------------------------------------------------
  // 2. DADA & TORSO (CHEST) — Mounted on r.chest
  // --------------------------------------------------------------------------
  const chestRoot = new THREE.Group();
  chestRoot.name = 'zeus_100_chest';
  chestRoot.userData.isZeus = true;
  const chestUniform = 0.54 * prop.chestScale;
  chestRoot.scale.set(chestUniform, chestUniform, chestUniform);
  chestRoot.position.set(0, -4.0, -0.06);
  r.chest.add(chestRoot);

  // Inner black core
  add(
    lathe([[0, 10.9], [1.6, 10.8], [2.0, 10.1], [1.85, 8.9], [1.3, 7.7], [0.9, 7.3], [0, 7.25]], 48),
    blk,
    [0, 0, -0.1],
    [0, 0, 0],
    [1, 1, 0.68],
    chestRoot,
  );

  // Green crystal core (12 central octahedrons)
  const crys = (p: N3, rot: N3, scl: N3, parent: THREE.Object3D = chestRoot) =>
    add(new THREE.OctahedronGeometry(0.5, 0), crystal, p, rot, scl, parent);

  for (let i = 0; i < 12; i++) {
    const y = 10.2 - i * 0.2;
    const w = 0.55 * (1 - i / 14);
    crys([((i % 3) - 1) * w * 0.6, y, 1.05], [0.2 * i, i * 0.9, 0.15 * (i % 2 ? 1 : -1)], [0.45, 0.9, 0.35], chestRoot);
  }
  pair(chestRoot, (g) => {
    for (let i = 0; i < 6; i++) {
      crys([0.85 + (i % 2) * 0.25, 8.9 - i * 0.22, 1.05 - (i % 2) * 0.1], [0.3, 0.4, 0.9 + i * 0.08], [0.32, 0.85, 0.28], g);
    }
    crys([1.25, 8.4, 0.85], [0.2, 0.5, 1.1], [0.35, 1.0, 0.3], g);
  });
  const coreLight = new THREE.PointLight(themeCol, 2.2, 3.5);
  coreLight.position.set(0, 9.0, 1.8);
  coreLight.userData.isZeus = true;
  chestRoot.add(coreLight);

  pair(chestRoot, (g) => {
    // Big curved V pec plate
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

    // Inner dark bevel edge along the V
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

    // Upper collar plate near neck
    add(
      bend(front([[0.4, 10.6], [1.9, 10.85], [2.0, 11.15], [0.55, 11.0]], 0.6, 0.08, 0.3), 2.0),
      gunL,
      [0, 0, 0.55],
      [0, 0, 0],
      [1, 1, 1],
      g,
    );

    // Side black rib frame
    add(side([[-0.6, 10.2], [0.75, 10.0], [0.65, 8.4], [0.1, 7.6], [-0.6, 7.9]], 0.5, 0.08, 0.25), blk, [1.95, 0, 0], [0, 0, -0.08], [1, 1, 1], g);
  });

  // Lower black frame
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
    chestRoot,
  );

  // Central sternum clasp
  add(front([[-0.28, 8.6], [0.28, 8.6], [0.35, 7.7], [0.18, 7.3], [-0.18, 7.3], [-0.35, 7.7]], 0.4, 0.06, 0.2), blk, [0, 0, 1.25], [0, 0, 0], [1, 1, 1], chestRoot);
  add(front([[-0.07, 8.4], [0.07, 8.4], [0.07, 7.6], [-0.07, 7.6]], 0.1, 0.02, 0.3), blkM, [0, 0, 1.5], [0, 0, 0], [1, 1, 1], chestRoot);

  // Side clamp teeth
  pair(chestRoot, (g) => {
    for (let i = 0; i < 2; i++) {
      add(front([[0, 0.25], [0.22, 0.25], [0.22, -0.25], [0, -0.25]], 0.25, 0.04, 0.3), blk, [0.62 + i * 0.32, 7.2, 1.2], [0, 0, 0], [1, 1, 1], g);
    }
  });
  // Upper back armor
  add(B, gun, [0, 9.2, -0.9], [0, 0, 0], [1.9, 1.6, 0.7], chestRoot);

  // --------------------------------------------------------------------------
  // 3. PINGGUL & WAIST — Mounted on r.waist and r.pelvis
  // --------------------------------------------------------------------------
  const waistRoot = new THREE.Group();
  waistRoot.name = 'zeus_100_waist';
  waistRoot.userData.isZeus = true;
  const waistUniform = 0.54 * prop.chestScale;
  waistRoot.scale.set(waistUniform, waistUniform, waistUniform);
  waistRoot.position.set(0, -3.7, 0);
  r.waist.add(waistRoot);

  add(lathe([[0, 7.6], [0.85, 7.55], [0.95, 7.3], [0.7, 7.0], [0.78, 6.7], [0, 6.6]]), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], waistRoot);

  const pelvisRoot = new THREE.Group();
  pelvisRoot.name = 'zeus_100_pelvis';
  pelvisRoot.userData.isZeus = true;
  const pelvisUniform = 0.54 * prop.legScale;
  pelvisRoot.scale.set(pelvisUniform, pelvisUniform, pelvisUniform);
  pelvisRoot.position.set(0, -0.15, 0);
  r.pelvis.add(pelvisRoot);

  add(B, blk, [0, 6.45, 0.05], [0, 0, 0], [1.15, 0.42, 0.78], pelvisRoot);
  add(panel({ w: 0.9, h: 0.9, d: 0.3, bottom: 0.6, bendX: 1.5, bulge: 0.08 }), gunL, [0, 6.2, 0.75], [0, 0, 0], [1, 1, 1], pelvisRoot);

  // --------------------------------------------------------------------------
  // 4. BAHU & PAULDRONS — Mounted on r.caps[0] (Right) and r.caps[1] (Left)
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const cap = r.caps[i];
    if (!cap) continue;
    const s = i === 0 ? 1 : -1;
    const capRoot = new THREE.Group();
    capRoot.name = `zeus_100_cap_${i}`;
    capRoot.userData.isZeus = true;
    const capUniform = 0.54 * prop.chestScale;
    capRoot.scale.set(capUniform * s, capUniform, capUniform);
    capRoot.position.set(0, 0.08, 0);
    cap.add(capRoot);

    add(S, blk, [-0.15, -0.45, 0], [0, 0, 0], [0.8, 0.8, 0.8], capRoot);
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
      capRoot,
    );
    add(
      front([[-0.7, 0.1], [0.1, 0.4], [0.9, 0.2], [0.85, 0.0], [0.1, 0.2], [-0.7, -0.08]], 2.05, 0.06, 0.2),
      gunL,
      [0.1, 0.25, 0],
      [0, 0, 0],
      [1, 1, 1],
      capRoot,
    );
    add(
      front([[1.0, -0.3], [1.1, -1.05], [0.95, -1.05], [0.88, -0.3]], 1.6, 0.03, 0.2),
      blkM,
      [0.06, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
      capRoot,
    );
    for (const z of [0.75, -0.75]) {
      add(cyl(0.07, 0.07, 0.1, 12), chrome, [1.42, -0.5, z], [0, 0, Math.PI / 2], [1, 1, 1], capRoot);
    }
  }

  // --------------------------------------------------------------------------
  // 5. LENGAN ATAS (UPPER ARMS) — Mounted on r.shoulders[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const sh = r.shoulders[i];
    if (!sh) continue;
    const s = i === 0 ? 1 : -1;
    const armRoot = new THREE.Group();
    armRoot.name = `zeus_100_arm_${i}`;
    armRoot.userData.isZeus = true;
    const armUniform = 0.54 * prop.armScale;
    armRoot.scale.set(armUniform * s, armUniform * 0.92, armUniform);
    armRoot.position.set(0, 0, 0);
    sh.add(armRoot);

    add(cyl(0.5, 0.5, 1.2, 32), blk, [-0.1, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], armRoot);
    add(
      lathe([[0, 0], [0.48, -0.05], [0.6, -0.6], [0.62, -1.1], [0.52, -1.8], [0.42, -2.3], [0, -2.4]]),
      blk,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1.05],
      armRoot,
    );
    add(
      side([[-0.55, -0.1], [0.45, -0.05], [0.68, -0.45], [0.6, -1.2], [0.25, -1.45], [-0.5, -1.35], [-0.62, -0.7]], 1.15, 0.1, 0.25),
      gun,
      [0.05, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
      armRoot,
    );
    add(side([[0.2, -0.9], [0.75, -1.05], [0.72, -1.75], [0.3, -2.0]], 0.7, 0.06, 0.2), blk, [-0.1, 0, 0], [0, 0, 0], [1, 1, 1], armRoot);
    add(side([[-0.6, -1.2], [-0.15, -1.3], [-0.2, -2.1], [-0.6, -2.0]], 0.8, 0.06, 0.2), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], armRoot);
    for (let k = 0; k < 6; k++) {
      add(B3, gunL, [0.68, -0.35 - k * 0.2, -0.05], [0, 0, 0], [0.1, 0.07, 0.4], armRoot);
    }
  }

  // --------------------------------------------------------------------------
  // 6. SIKU & LENGAN BAWAH (FOREARMS) — Mounted on r.elbows[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const el = r.elbows[i];
    if (!el) continue;
    const s = i === 0 ? 1 : -1;
    const foreRoot = new THREE.Group();
    foreRoot.name = `zeus_100_fore_${i}`;
    foreRoot.userData.isZeus = true;
    const foreUniform = 0.54 * prop.armScale;
    foreRoot.scale.set(foreUniform * s, foreUniform, foreUniform);
    foreRoot.position.set(0, 0, 0);
    el.add(foreRoot);

    // Elbow hinge ball and axle
    add(S, blk, [0, 0, 0], [0, 0, 0], [0.48, 0.48, 0.5], foreRoot);
    for (const sx of [0.42, -0.42]) {
      add(side([[-0.45, 0.45], [0.35, 0.35], [0.5, -0.15], [0.2, -0.55], [-0.4, -0.45]], 0.16, 0.05, 0.25), blk, [sx, 0, 0], [0, 0, 0], [1, 1, 1], foreRoot);
    }
    add(cyl(0.2, 0.2, 1.05, 24), chrome, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], foreRoot);

    // Forearm grey armor
    add(
      side([[-0.5, -0.25], [0.35, -0.2], [0.62, -0.45], [0.6, -1.85], [0.35, -2.2], [-0.4, -2.2], [-0.55, -1.5]], 1.0, 0.12, 0.2),
      gun,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
      foreRoot,
    );

    // Iconic forward vent fin with 5 holes
    add(side([[0.5, -0.35], [1.0, -0.5], [1.05, -1.55], [0.55, -1.75]], 0.18, 0.05, 0.2), gunL, [0.3, 0, 0], [0, 0, 0], [1, 1, 1], foreRoot);
    for (let k = 0; k < 5; k++) {
      add(cyl(0.055, 0.055, 0.32, 12), blkM, [0.3, -0.65 - k * 0.2, 0.82], [0, 0, Math.PI / 2], [1, 1, 1], foreRoot);
    }
    add(side([[-0.3, -0.5], [0.2, -0.5], [0.25, -1.8], [-0.25, -1.8]], 1.06, 0.03, 0.3), blk, [-0.02, 0, -0.05], [0, 0, 0], [1, 1, 1], foreRoot);
    add(cyl(0.34, 0.26, 0.3, 24), chrome, [0, -2.3, 0.05], [0, 0, 0], [1, 1, 1], foreRoot);
    for (let k = 0; k < 2; k++) {
      add(cyl(0.5, 0.5, 0.12, 32), k % 2 ? blk : gunL, [0, -2.5 - k * 0.13, 0.05], [0, 0, 0], [1, 1, 1], foreRoot);
    }
  }

  // --------------------------------------------------------------------------
  // 7. TINJU (FISTS) — Mounted on r.fists[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const fist = r.fists[i];
    if (!fist) continue;
    const s = i === 0 ? 1 : -1;
    const fistRoot = new THREE.Group();
    fistRoot.name = `zeus_100_fist_${i}`;
    fistRoot.userData.isZeus = true;
    const fistUniform = 0.54 * prop.armScale;
    fistRoot.scale.set(fistUniform * s, fistUniform, fistUniform);
    fistRoot.position.set(0, -0.16, 0.04);
    fist.add(fistRoot);

    // Hammer fist black top and forward striking block
    add(side([[-0.6, 0.75], [0.3, 0.78], [0.5, 0.4], [0.85, 0.25], [0.9, -0.15], [-0.6, -0.15]], 1.25, 0.12, 0.22), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], fistRoot);
    add(side([[-0.6, -0.1], [0.95, -0.1], [1.08, -0.45], [0.98, -1.0], [-0.45, -1.0], [-0.62, -0.6]], 1.32, 0.12, 0.2), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], fistRoot);
    add(side([[0.45, 0.35], [0.8, 0.22], [0.82, 0.0], [0.45, 0.05]], 1.3, 0.03, 0.3), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], fistRoot);
    for (let k = 0; k < 3; k++) {
      add(B, blkM, [-0.4 + k * 0.4, -0.55, 1.14], [0, 0, 0], [0.02, 0.32, 0.03], fistRoot);
    }
    add(side([[0.1, 0.55], [0.45, 0.5], [0.5, 0.15], [0.1, 0.2]], 0.3, 0.06, 0.3), blk, [-0.6, 0, 0.1], [0, 0, 0], [1, 1, 1], fistRoot);
  }

  // --------------------------------------------------------------------------
  // 8. PAHA (THIGHS) — Mounted on r.hipJ[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const hip = r.hipJ[i];
    if (!hip) continue;
    const s = i === 0 ? 1 : -1;
    const thighRoot = new THREE.Group();
    thighRoot.name = `zeus_100_thigh_${i}`;
    thighRoot.userData.isZeus = true;
    const legUniform = 0.54 * prop.legScale;
    thighRoot.scale.set(legUniform * s, legUniform * 0.95, legUniform);
    thighRoot.position.set(0, 0, 0);
    hip.add(thighRoot);

    add(S, blk, [0, 0, 0], [0, 0, 0], [0.62, 0.58, 0.62], thighRoot);
    add(cyl(0.22, 0.22, 1.4, 24), gunL, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], thighRoot);
    add(
      lathe([[0, 0], [0.55, -0.12], [0.62, -0.6], [0.55, -1.4], [0.4, -2.25], [0, -2.4]], 40),
      blk,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1.05],
      thighRoot,
    );
    add(
      bend(front([[-0.5, -0.15], [0.35, -0.1], [0.72, -0.35], [0.66, -1.35], [0.32, -2.05], [-0.15, -2.1], [-0.42, -1.4], [-0.58, -0.6]], 0.16, 0.08, 0.2), 0.7),
      gun,
      [0, 0, 0.55],
      [0, 0, 0],
      [1, 1, 1],
      thighRoot,
    );
    add(side([[-0.45, -0.25], [0.45, -0.3], [0.38, -1.5], [-0.3, -1.7]], 0.14, 0.05, 0.25), gunL, [0.72, 0, 0], [0, 0, 0.04], [1, 1, 1], thighRoot);
    add(front([[-0.66, -0.35], [0.66, -0.3], [0.86, -0.45], [0.84, -0.88], [0.62, -1.0], [-0.66, -0.97]], 1.38, 0.08, 0.2), gunL, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], thighRoot);
    add(front([[-0.5, -0.6], [0.6, -0.58], [0.6, -0.68], [-0.5, -0.7]], 1.42, 0.01, 0.4), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], thighRoot);
    for (const [xx, yy] of [
      [0.35, -0.47],
      [0.35, -0.82],
      [0.6, -0.47],
      [0.6, -0.82],
    ]) {
      add(new THREE.SphereGeometry(0.05, 10, 6), chrome, [xx, yy, 0.82], [0, 0, 0], [1, 1, 1], thighRoot);
    }
    add(new THREE.SphereGeometry(0.15, 16, 8), chrome, [-0.42, -0.3, 0.62], [0, 0, 0], [1, 1, 1], thighRoot);
    add(cyl(0.16, 0.16, 0.7, 20), chrome, [-0.42, -0.75, 0.66], [0.06, 0, 0], [1, 1, 1], thighRoot);
    add(cyl(0.2, 0.2, 0.08, 20), blk, [-0.42, -1.1, 0.68], [0.06, 0, 0], [1, 1, 1], thighRoot);
    add(cyl(0.085, 0.085, 1.3, 16), chrome, [-0.42, -1.75, 0.7], [0.06, 0, 0], [1, 1, 1], thighRoot);
    add(cyl(0.18, 0.15, 0.3, 16), chrome, [-0.42, -2.45, 0.72], [0, 0, 0], [1, 1, 1], thighRoot);
  }

  // --------------------------------------------------------------------------
  // 9. LUTUT & BETIS (KNEES & SHINS) — Mounted on r.kneeJ[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const knee = r.kneeJ[i];
    if (!knee) continue;
    const s = i === 0 ? 1 : -1;
    const shinRoot = new THREE.Group();
    shinRoot.name = `zeus_100_shin_${i}`;
    shinRoot.userData.isZeus = true;
    const legUniform = 0.54 * prop.legScale;
    shinRoot.scale.set(legUniform * s, legUniform * 0.95, legUniform);
    shinRoot.position.set(0, 0, 0);
    knee.add(shinRoot);

    // Knee joint ball and axle
    add(S, blk, [0, 0, 0], [0, 0, 0], [0.52, 0.48, 0.55], shinRoot);
    add(cyl(0.22, 0.22, 1.3, 24), gunL, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], shinRoot);
    for (const sx of [0.66, -0.66]) {
      add(cyl(0.14, 0.14, 0.06, 16), chrome, [sx, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], shinRoot);
    }
    // V-shaped knee guard
    add(bend(front([[-0.45, 0.35], [0.45, 0.35], [0.5, 0.0], [0.0, -0.45], [-0.5, 0.0]], 0.2, 0.08, 0.2), 0.6), gun, [0, 0, 0.55], [-0.08, 0, 0], [1, 1, 1], shinRoot);
    add(front([[-0.06, 0.2], [0.06, 0.2], [0.03, -0.25], [-0.03, -0.25]], 0.1, 0.015, 0.3), blkM, [0, 0, 0.78], [-0.08, 0, 0], [1, 1, 1], shinRoot);

    // Calf lathe core
    add(lathe([[0, -0.25], [0.42, -0.35], [0.48, -1.0], [0.36, -2.6], [0, -2.7]], 40), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], shinRoot);

    // Main shin shield
    const shinPtsRel: P2[] = [
      [-0.5, -0.3],
      [0.0, -0.22],
      [0.5, -0.3],
      [0.66, -0.8],
      [0.55, -1.25],
      [0.66, -1.7],
      [0.48, -2.4],
      [0.25, -2.7],
      [-0.25, -2.7],
      [-0.48, -2.4],
      [-0.66, -1.7],
      [-0.55, -1.25],
      [-0.66, -0.8],
    ];
    add(bend(front(shinPtsRel, 0.2, 0.1, 0.2), 0.6), gun, [0, 0, 0.45], [0, 0, 0], [1, 1, 1], shinRoot);

    // Layered side armor wings
    add(bend(front([[0.42, -0.5], [0.78, -0.75], [0.8, -1.95], [0.45, -2.5]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], shinRoot);
    add(bend(front([[-0.42, -0.5], [-0.78, -0.75], [-0.8, -1.95], [-0.45, -2.5]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], shinRoot);

    // Center ridge with slot + arrow tip
    add(bend(front([[-0.28, -0.55], [0.28, -0.55], [0.34, -1.0], [0.2, -2.15], [0, -2.45], [-0.2, -2.15], [-0.34, -1.0]], 0.1, 0.05, 0.25), 0.7), gunL, [0, 0, 0.73], [0, 0, 0], [1, 1, 1], shinRoot);
    add(front([[-0.09, -0.75], [0.09, -0.75], [0.09, -1.65], [-0.09, -1.65]], 0.12, 0.025, 0.35), blkM, [0, 0, 0.88], [0, 0, 0], [1, 1, 1], shinRoot);
    add(B, blkM, [0.3, -1.95, 0.74], [0, 0, 0.55], [0.17, 0.018, 0.03], shinRoot);
    add(B, blkM, [-0.3, -1.95, 0.74], [0, 0, -0.55], [0.17, 0.018, 0.03], shinRoot);

    // Calf muscle armor back and rear piston
    add(side([[-0.3, -0.4], [-0.78, -0.8], [-0.72, -1.7], [-0.35, -2.3]], 0.8, 0.08, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], shinRoot);
    add(cyl(0.07, 0.07, 1.6, 12), chrome, [0, -1.5, -0.7], [-0.12, 0, 0], [1, 1, 1], shinRoot);
  }

  // --------------------------------------------------------------------------
  // 10. KAKI & BOOTS (FEET) — Mounted on r.footJ[0..1]
  // --------------------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const foot = r.footJ[i];
    if (!foot) continue;
    const s = i === 0 ? 1 : -1;
    const bootRoot = new THREE.Group();
    bootRoot.name = `zeus_100_boot_${i}`;
    bootRoot.userData.isZeus = true;
    const legUniform = 0.54 * prop.legScale;
    bootRoot.scale.set(legUniform * s, legUniform, legUniform);
    bootRoot.position.set(0, 0, 0);
    foot.add(bootRoot);

    add(S, blk, [0, 0, 0], [0, 0, 0], [0.38, 0.3, 0.38], bootRoot);
    add(cyl(0.16, 0.16, 1.0, 16), chrome, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], bootRoot);
    add(side([[-0.55, 0.0], [0.25, 0.0], [1.15, -0.28], [1.3, -0.65], [-0.6, -0.65]], 1.0, 0.1, 0.25), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], bootRoot);
    add(side([[0.25, -0.02], [0.75, -0.15], [0.78, -0.32], [0.25, -0.2]], 0.92, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], bootRoot);
    add(side([[0.8, -0.18], [1.15, -0.3], [1.2, -0.42], [0.82, -0.34]], 0.88, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], bootRoot);
    add(side([[-0.55, -0.15], [-0.85, -0.4], [-0.8, -0.65], [-0.5, -0.65]], 0.6, 0.05, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], bootRoot);
    add(side([[-0.6, -0.58], [1.3, -0.58], [1.28, -0.67], [-0.62, -0.67]], 1.04, 0.02, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], bootRoot);
  }

  // Tag robot as currently wearing Zeus 100%
  r.ctx.style.isZeus100 = true;
}
