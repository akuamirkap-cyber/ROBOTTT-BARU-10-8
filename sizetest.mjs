// ============================================================================
//  test:size — PENGUKUR BENTUK & UKURAN BADAN ROBOT
// ============================================================================
//     npm run test:size
//
//  Harness ini mengukur BADAN NYATA yang dibangun src/game/build.ts (bukan angka
//  di atas kertas) dan menegakkan tiga aturan desain DESAIN_ROBOT.md:
//
//   §A  hull (kotak pembungkus) tiap segmen tidak boleh menyimpang lebih dari
//       HULL_TOL dari badan ATLAS yang dibekukan → probe lantai, jatuh-bangkit,
//       IK kaki, test:feet / test:pose dan framing kamera tidak bergeser.
//   §B  badan simple harus LEBIH SEDERHANA dari badan ATLAS: jumlah mesh &
//       segitiga tidak boleh naik (angka legacy dikunci di bawah).
//   §C  angka beku yang dipakai sistem lain harus tetap persis: sol boot 0.21 di
//       bawah mata kaki, ujung jari +1.24, tumit −0.62, pivot tulang (rig.ts),
//       dan posisi optik mata (±0.155, −0.02, 0.43).
//
//  Bagian D mencetak tabel pembanding: ukuran rig Real Steel Simulator
//  (src/sim/rig.ts), faktor mapping K_SEG, dan hasil di badan Steel Titans —
//  tabel yang sama dengan DESAIN_ROBOT.md §3.
import * as THREE from 'three';
import { Robot } from './.__robot.mjs';
import { createRig } from './.__simrig.mjs';
import { HULL_ATLAS, HULL_TOL, HULL_EXEMPT, KNEECAP_REACH, RS_REF, K_SEG, SIMPLE_MESH_COUNT, ATLAS_MESHES, ATLAS_TRIS, ATLAS_VERTS } from './.__bodyspec.mjs';

// three's CSS2DObject touches the DOM; stub just enough of it for the offline rig
const elStub = () => ({
  style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, getAttribute: () => null,
  addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {}, textContent: '', className: '',
});
globalThis.document = globalThis.document || { createElement: elStub, createElementNS: elStub, body: elStub() };

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' : ''}${info}`);
};
const f = (v, n = 2) => v.toFixed(n);
const pct = (a, b) => `${f(((a / b - 1) * 100), 1)}%`;

/** FX aditif (flare/streak mata) bukan badan padat — jangan ikut menghitung hull */
const isFx = (o) => {
  const m = o.material;
  return !m || m.blending === THREE.AdditiveBlending || o.isLight || o.isSprite;
};

/** union bbox di ruang lokal `node` dari mesh milik segmen itu (joint turunan dilewati) */
function segBox(node, skip = []) {
  node.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const b = new THREE.Box3();
  const skipped = new Set(skip);
  const walk = (o, blocked) => {
    if (skipped.has(o)) return;
    const stop = blocked || skipped.has(o);
    if (o.isMesh && o.geometry?.attributes?.position && !stop && !isFx(o)) {
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      b.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv));
    }
    for (const ch of o.children) walk(ch, stop);
  };
  walk(node, false);
  if (b.isEmpty()) return null;
  const s = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3());
  return { w: s.x, h: s.y, d: s.z, min: b.min, max: b.max, c };
}

const STYLE = { variant: 'atom', main: 0x8a8f98, secondary: 0x3a3f47, accent: 0x1e9bff, glow: 0x63e0ff };
const mkRobot = () => {
  const r = new Robot(STYLE, 1);
  r.snapFeet();
  r.root.updateMatrixWorld(true);
  return r;
};
const r = mkRobot();
const thighG = (i) => r.hipJ[i].children.find((ch) => ch !== r.kneeJ[i] && ch.isGroup);
const shinG = (i) => r.kneeJ[i].children.find((ch) => ch !== r.footJ[i] && ch !== r.kneeCaps[i] && ch.isGroup);

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §A  HULL TIAP SEGMEN vs BADAN ATLAS YANG DIBEKUKAN');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('   segmen             terukur (l × t × d)      ATLAS (l × t × d)        selisih');
const SEGMENTS = [
  ['pelvis', 'pinggul', () => segBox(r.pelvis, [r.waist, ...r.hipJ])],
  ['waist', 'pinggang', () => segBox(r.waist, [r.chest])],
  ['chest', 'dada', () => segBox(r.chest, [r.neck, ...r.clavs])],
  ['neck', 'leher', () => segBox(r.neck, [r.head])],
  ['head', 'kepala', () => segBox(r.head, [])],
  ['clav', 'selangka', () => segBox(r.clavs[0], [r.caps[0], r.shoulders[0]])],
  ['cap', 'pauldron', () => segBox(r.caps[0], [])],
  ['arm', 'lengan atas', () => segBox(r.shoulders[0], [r.elbows[0]])],
  ['fore', 'lengan bawah', () => segBox(r.elbows[0], [r.wrists[0]])],
  ['fist', 'sarung tinju', () => segBox(r.fists[0], [])],
  ['hip', 'sendi pinggul', () => segBox(r.hipJ[0], [r.kneeJ[0], thighG(0)])],
  ['thigh', 'paha', () => segBox(thighG(0), [])],
  ['knee', 'lutut', () => segBox(r.kneeJ[0], [r.footJ[0], r.kneeCaps[0], shinG(0)])],
  ['kneecap', 'tempurung', () => segBox(r.kneeCaps[0], [])],
  ['shin', 'betis', () => segBox(shinG(0), [])],
  ['boot', 'boot', () => segBox(r.footJ[0], [])],
];
for (const [key, label, measure] of SEGMENTS) {
  const m = measure();
  const a = HULL_ATLAS[key];
  if (!m || !a) { ok(`${label} terukur`, false, 'tidak ada geometri'); continue; }
  console.log(`   ${label.padEnd(18)} ${`${f(m.w)} × ${f(m.h)} × ${f(m.d)}`.padEnd(24)} ${`${f(a[0])} × ${f(a[1])} × ${f(a[2])}`.padEnd(22)} ${pct(m.w, a[0])} / ${pct(m.h, a[1])} / ${pct(m.d, a[2])}`);
  const within = (v, ref, tol) => v >= ref * (1 - tol) - 1e-6 && v <= ref * (1 + tol) + 1e-6;
  const ex = HULL_EXEMPT[key] ?? [];
  ok(
    `hull ${label} dalam toleransi${ex.length ? ` (kecuali ${ex.join('/')})` : ''}`,
    (ex.includes('w') || within(m.w, a[0], HULL_TOL.w)) &&
    (ex.includes('h') || within(m.h, a[1], HULL_TOL.h)) &&
    (ex.includes('d') || within(m.d, a[2], HULL_TOL.d)),
    `toleransi ±${HULL_TOL.w * 100}% l / ±${HULL_TOL.h * 100}% t / ±${HULL_TOL.d * 100}% d`,
  );
}

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §B  LEBIH SEDERHANA DARI BADAN ATLAS (mesh & segitiga)');
console.log('═══════════════════════════════════════════════════════════════════════════');
let meshes = 0, tris = 0, verts = 0;
r.root.traverse((o) => {
  if (!o.isMesh || isFx(o)) return;
  meshes++;
  const g = o.geometry;
  if (!g) return;
  const idx = g.index;
  const vn = g.attributes.position?.count ?? 0;
  const t = idx ? idx.count / 3 : vn / 3;
  if (o.visible) { tris += t; verts += vn; }
});
console.log(`   mesh (gabungan)     ${meshes}   (ATLAS ${ATLAS_MESHES})`);
console.log(`   segitiga            ${Math.round(tris)}   (ATLAS ${ATLAS_TRIS})`);
console.log(`   vertex              ${verts}   (ATLAS ${ATLAS_VERTS})`);
console.log(`   bagian di spec      ${SIMPLE_MESH_COUNT}   (rig Real Steel ${RS_REF.mesh})`);
console.log(`   pengurangan         mesh ${pct(meshes, ATLAS_MESHES)} · segitiga ${pct(tris, ATLAS_TRIS)} · vertex ${pct(verts, ATLAS_VERTS)}`);
ok('mesh tidak lebih banyak dari badan ATLAS', meshes <= ATLAS_MESHES, `${meshes} vs ${ATLAS_MESHES}`);
ok('segitiga tidak lebih banyak dari badan ATLAS', tris <= ATLAS_TRIS, `${Math.round(tris)} vs ${ATLAS_TRIS}`);
ok('jumlah bagian badan setara rig Real Steel (≤ 2×)', SIMPLE_MESH_COUNT <= RS_REF.mesh * 2, `${SIMPLE_MESH_COUNT} vs ${RS_REF.mesh}`);

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §C  ANGKA BEKU YANG DIPAKAI SISTEM LAIN');
console.log('═══════════════════════════════════════════════════════════════════════════');
const V = new THREE.Vector3();
const local = (node, pt) => { node.updateWorldMatrix(true, false); return new THREE.Vector3(...pt).applyMatrix4(node.matrixWorld); };
const rel = (child, parent, pt) => {
  child.updateWorldMatrix(true, false); parent.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  return new THREE.Vector3(...pt).applyMatrix4(child.matrixWorld).applyMatrix4(inv);
};
// boot: sol / jari / tumit di ruang mata kaki
let soleY = Infinity, toeZ = -Infinity, heelZ = Infinity;
for (const foot of r.footJ) {
  foot.updateWorldMatrix(true, true);
  foot.traverse((o) => {
    if (!o.isMesh || isFx(o)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const l = V.clone().applyMatrix4(new THREE.Matrix4().copy(foot.matrixWorld).invert());
      soleY = Math.min(soleY, l.y); toeZ = Math.max(toeZ, l.z); heelZ = Math.min(heelZ, l.z);
    }
  });
}
console.log(`   sol boot            ${f(soleY, 3)}   (harus −0.210)`);
console.log(`   ujung jari          ${f(toeZ, 3)}   (harus ≈ +1.240)`);
console.log(`   tumit               ${f(heelZ, 3)}   (harus ≈ −0.620)`);
ok('sol boot tepat 0.21 di bawah mata kaki (SOLE)', Math.abs(soleY + 0.21) < 0.005, f(soleY, 3));
ok('ujung jari boot tetap di +1.24 (TOE_Z)', Math.abs(toeZ - 1.24) < 0.06, f(toeZ, 3));
ok('tumit boot tetap di −0.62 (HEEL_Z)', Math.abs(heelZ + 0.62) < 0.06, f(heelZ, 3));

// pivot tulang (rig.ts) — tidak boleh bergeser satu milimeter pun
const piv = [
  ['pinggul  (hipJ)', rel(r.hipJ[0], r.pelvis, [0, 0, 0]), [0.74, 2.85, 0]],
  ['lutut    (kneeJ)', rel(r.kneeJ[0], r.hipJ[0], [0, 0, 0]), [0, -2.0, 0]],
  ['mata kaki (footJ)', rel(r.footJ[0], r.kneeJ[0], [0, 0, 0]), [0, -1.92, 0]],
  ['pinggang (waist)', rel(r.waist, r.pelvis, [0, 0, 0]), [0, 3.45, 0]],
  ['dada     (chest)', rel(r.chest, r.waist, [0, 0, 0]), [0, 0.35, 0]],
  ['leher    (neck)', rel(r.neck, r.chest, [0, 0, 0]), [0, 1.79, 0.08]],
  ['kepala   (head)', rel(r.head, r.neck, [0, 0, 0]), [0, 0.36, 0.06]],
  ['selangka (clav)', rel(r.clavs[0], r.chest, [0, 0, 0]), [0.88, 1.55, 0]],
  ['bahu     (shoulder)', rel(r.shoulders[0], r.clavs[0], [0, 0, 0]), [0.8, -0.32, 0]],
  ['siku     (elbow)', rel(r.elbows[0], r.shoulders[0], [0, 0, 0]), [0, -1.05, 0]],
  ['pergelangan (wrist)', rel(r.wrists[0], r.elbows[0], [0, 0, 0]), [0, -0.975, 0]],
  ['tempurung (kneeCap)', rel(r.kneeCaps[0], r.kneeJ[0], [0, 0, 0]), [0, 0, 0.2296]],
];
for (const [label, got, want] of piv) {
  const d = Math.max(Math.abs(got.x - want[0]), Math.abs(got.y - want[1]), Math.abs(got.z - want[2]));
  console.log(`   ${label.padEnd(22)} (${f(got.x, 3)}, ${f(got.y, 3)}, ${f(got.z, 3)})`);
  ok(`pivot ${label.trim()} tidak bergeser`, d < 1e-4, `Δ ${f(d, 5)}`);
}
// jangkauan depan tempurung lutut (probe lutut duduk di z +0.62)
{
  r.kneeJ[0].updateWorldMatrix(true, true);
  r.kneeCaps[0].updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(r.kneeJ[0].matrixWorld).invert();
  const bb = new THREE.Box3();
  r.kneeCaps[0].traverse((o) => { if (o.isMesh && !isFx(o)) { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv)); } });
  console.log(`   tempurung depan      ${f(bb.max.z, 3)}   (ATLAS ${f(KNEECAP_REACH, 3)})`);
  ok('jangkauan depan tempurung lutut tetap (probe z +0.62)', Math.abs(bb.max.z - KNEECAP_REACH) < 0.03, f(bb.max.z, 3));
}

// optik mata
const eye = r.eyeOptics[0];
const ep = rel(eye, r.head, [0, 0, 0]);
console.log(`   optik mata           (${f(ep.x, 3)}, ${f(ep.y, 3)}, ${f(ep.z, 3)})   (harus 0.155 / −0.020 / 0.430)`);
ok('optik mata tetap di koordinat lama', Math.abs(ep.x - 0.155) < 1e-4 && Math.abs(ep.y + 0.02) < 1e-4 && Math.abs(ep.z - 0.43) < 1e-4, '');
ok('semua FX mata masih terpasang', r.eyeOptics.length === 2 && r.eyeIris.length === 2 && r.eyePupils.length === 2 && r.eyeScanners.length === 2 && r.eyeFlares.length === 2 && r.eyePulses.length === 2 && r.eyeBeams.length === 2 && r.eyeLights.length === 2, `${r.eyeOptics.length} optik`);
ok('tempurung lutut & pergelangan tetap ada untuk animasi', r.kneeCaps.length === 2 && r.fists.length === 2 && r.caps.length === 2, '');

// tinggi berdiri
const headBox = segBox(r.head, []);
const footBox = segBox(r.footJ[0], []);
const top = local(r.head, [0, headBox.max.y, 0]).y;
const bottom = local(r.footJ[0], [0, footBox.min.y, 0]).y;
console.log(`   tinggi berdiri       ${f(top - bottom)} m   (root scale ${f(r.root.scale.x, 3)})`);
ok('tinggi berdiri tidak berubah (7.55 m ± 2%)', Math.abs(top - bottom - 7.55) < 0.16, f(top - bottom) + ' m');

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §D  TABEL MAPPING — Real Steel Simulator → Steel Titans');
console.log('═══════════════════════════════════════════════════════════════════════════');
const rig = createRig({ armor: 0x8a8f98, accent: 0x1e9bff, frame: 0x2c3038, glow: 0x63e0ff, glove: 0xc1121f, joint: 0xffcc00 }, 'sim');
rig.root.updateMatrixWorld(true);
const J = rig.joints;
const MAP = [
  ['dada', () => segBox(r.chest, [r.neck, ...r.clavs]), () => segBox(J.chest, [J.neck, J.clavL, J.clavR]), K_SEG.torso],
  ['kepala', () => segBox(r.head, []), () => segBox(J.head, []), K_SEG.head],
  ['lengan atas', () => segBox(r.shoulders[0], [r.elbows[0]]), () => segBox(J.shoulderL, [J.elbowL]), K_SEG.arm],
  ['lengan bawah', () => segBox(r.elbows[0], [r.wrists[0]]), () => segBox(J.elbowL, [J.wristL]), K_SEG.arm],
  ['paha', () => segBox(thighG(0), []), () => segBox(J.hipL, [J.kneeL]), K_SEG.thigh],
  ['betis', () => segBox(shinG(0), []), () => segBox(J.kneeL, [J.ankleL]), K_SEG.shin],
  ['tinju', () => segBox(r.fists[0], []), () => segBox(J.wristL, []), K_SEG.arm],
];
console.log('   segmen          Real Steel (m)      K_SEG   → hasil ×K       Steel Titans      rasio tercapai');
for (const [label, gm, sm, K] of MAP) {
  const G = gm(), S = sm();
  if (!G || !S) continue;
  const wantW = S.w * K;
  console.log(`   ${label.padEnd(15)} ${`${f(S.w, 3)} × ${f(S.h, 3)} × ${f(S.d, 3)}`.padEnd(20)} ${f(K).padEnd(7)} lebar ${f(wantW).padEnd(10)} ${`${f(G.w)} × ${f(G.h)} × ${f(G.d)}`.padEnd(18)} ${pct(G.w, wantW)}`);
}
console.log(`   tinggi berdiri  ${f(RS_REF.tinggiBerdiri, 3)} m           ${f(7.55 / RS_REF.tinggiBerdiri).padEnd(7)}            ${f(top - bottom)} m`);


console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §E  TITIK ANCHOR ANIMASI (stance tinju, terukur — bukan angka kertas)');
console.log('═══════════════════════════════════════════════════════════════════════════');
{
  const D = 1 / 60;
  const bot = mkRobot();
  const a = {
    arms: [{ sx: 0, sy: 0, sz: 0, ex: -1.2 }, { sx: 0, sy: 0, sz: 0, ex: -1.2 }],
    twist: 0, lean: 0.08, lunge: 0, dip: 0.12, roll: 0,
    vf: 0, vl: 0, af: 0, al: 0, yawRate: 0,
    hit: 0, hitSign: 1, hitUp: 0, fall: 0, air: 0, time: 0,
    glow: 0, flash: 0, tilt: 0, dash: 0, dashF: 0, dashL: 0,
  };
  for (let i = 0; i < Math.round(1.4 / D); i++) { a.time = i * D; bot.animate(a, D); }
  bot.root.position.set(0, 0, 0);
  bot.root.updateMatrixWorld(true);
  const S = bot.root.scale.x;
  const wy = (o) => { o.getWorldPosition(V); return V.y; };
  const fistBox = (i) => {
    const bb = new THREE.Box3();
    bot.fists[i].updateWorldMatrix(true, true);
    bot.fists[i].traverse((o) => { if (o.isMesh && !isFx(o)) { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    return bb;
  };
  const fb0 = fistBox(0), fb1 = fistBox(1);
  const bootLow = (() => {
    let m = Infinity;
    for (const foot of bot.footJ) foot.traverse((o) => {
      if (!o.isMesh || isFx(o)) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (V.y < m) m = V.y; }
    });
    return m;
  })();
  const headBoxW = (() => {
    const bb = new THREE.Box3();
    bot.head.updateWorldMatrix(true, true);
    bot.head.traverse((o) => { if (o.isMesh && !isFx(o)) { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    return bb;
  })();
  const rows = [
    ['sol boot (lantai)', bootLow],
    ['mata kaki', wy(bot.footJ[0])],
    ['lutut', wy(bot.kneeJ[0])],
    ['pinggul (hipJ)', wy(bot.hipJ[0])],
    ['panggul (pelvis)', wy(bot.pelvis)],
    ['pinggang', wy(bot.waist)],
    ['dada', wy(bot.chest)],
    ['reaktor arc', wy(bot.chest) + 1.06 * S],
    ['leher', wy(bot.neck)],
    ['kepala (pivot)', wy(bot.head)],
    ['puncak kepala', headBoxW.max.y],
    ['bahu', wy(bot.shoulders[0])],
    ['siku', wy(bot.elbows[0])],
    ['pergelangan', wy(bot.wrists[0])],
    ['pusat tinju KIRI', fb0.getCenter(new THREE.Vector3()).y],
    ['pusat tinju KANAN', fb1.getCenter(new THREE.Vector3()).y],
  ];
  console.log('   titik                        dunia (m)   lokal (unit)');
  for (const [label, y] of rows) console.log(`   ${label.padEnd(26)} ${f(y).padStart(9)}   ${f(y / S).padStart(9)}`);
  const c0 = fb0.getCenter(new THREE.Vector3()), c1 = fb1.getCenter(new THREE.Vector3());
  console.log(`   jarak kedua tinju (guard)  ${f(c0.distanceTo(c1))} m`);
  bot.chest.getWorldPosition(V); const chestW = V.clone();
  console.log(`   tinju kiri → tengah dada   ${f(c0.distanceTo(chestW))} m`);
  console.log(`   tinju kiri → paling depan  z ${f(fb0.max.z)} m   (tebal sarung ${f(fb0.max.z - fb0.min.z)} m)`);
  console.log(`   tinggi berdiri di stance   ${f(headBoxW.max.y - bootLow)} m`);
}

console.log(fails === 0 ? '\nSIZE: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
