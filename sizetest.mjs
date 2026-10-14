// ============================================================================
//  test:size — PENGUKUR BENTUK & UKURAN BADAN ROBOT (chassis REAL STEEL)
// ============================================================================
//     npm run test:size
//
//  Badan game sekarang ADALAH robot mode Real Steel: geometri & joint diambil dari
//  createRig() di src/sim/rig.ts (lihat buildRealSteelChassis di src/game/build.ts).
//  Harness ini mengukur badan NYATA dan menegakkan aturan desain DESAIN_ROBOT.md §11:
//
//   §A  hull tiap segmen harus sama dengan hull rig mode Real Steel (skala lokal sama)
//       — bentuk & ukuran yang terlihat di game = yang terlihat di mode sim.
//   §B  badan tetap sederhana: mesh = mesh rig + stack FX mata, segitiga < 25.000
//       (ATLAS lama 141.640).
//   §C  skeleton Real Steel DIBEKUKAN: offset joint persis RS_SKEL, tinggi 7.55 m +-0.2,
//       rasio proporsi manusia (bahu 21.8%, kaki 48.3% tinggi) = rasio rig sim.
//   §D  setiap tulang game = tulang sim x K (faktor tunggal +-0.1%).
//   §E  titik anchor animasi (stance tinju) — dicetak, bukan diasumsikan.
import * as THREE from 'three';
import { Robot } from './.__robot.mjs';
import { createRig } from './.__simrig.mjs';
import { RS_REF, RS_SKEL, RS_K } from './.__bodyspec.mjs';

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
const V = new THREE.Vector3();

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
  const sz = b.getSize(new THREE.Vector3());
  return { w: sz.x, h: sz.y, d: sz.z, min: b.min, max: b.max };
}

const STYLE = { variant: 'atom', main: 0x8a8f98, secondary: 0x3a3f47, accent: 0x1e9bff, glow: 0x63e0ff };
const mkRobot = () => {
  const r = new Robot(STYLE, 1);
  r.snapFeet();
  r.root.updateMatrixWorld(true);
  return r;
};
const r = mkRobot();
const K = RS_K;

// rig mode Real Steel mentah (tanpa marker/label) sebagai referensi bentuk
const sim = createRig({ armor: 0x8a8f98, accent: 0x1e9bff, frame: 0x1e2026, glow: 0x63e0ff, glove: 0x3a3f47, joint: 0xff00ff }, 'ref', false);
const SJ = sim.joints;

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §A  HULL TIAP SEGMEN vs RIG MODE REAL STEEL (ruang lokal joint)');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('   segmen             game (l x t x d)       sim x K (l x t x d)      selisih');
const ROWS = [
  ['pinggul', () => segBox(r.pelvis, [r.waist, ...r.hipJ]), () => segBox(SJ.pelvis, [SJ.waist, SJ.hipL, SJ.hipR])],
  ['pinggang', () => segBox(r.waist, [r.chest]), () => segBox(SJ.waist, [SJ.spine])],
  ['dada', () => segBox(r.chest, [r.neck, ...r.clavs]), () => segBox(SJ.spine, [SJ.neck, SJ.clavL, SJ.clavR])],
  ['leher', () => segBox(r.neck, [r.head]), () => segBox(SJ.neck, [SJ.head])],
  ['kepala', () => segBox(r.head, []), () => segBox(SJ.head, [])],
  ['selangka', () => segBox(r.clavs[0], [r.caps[0], r.shoulders[0]]), () => segBox(SJ.clavL, [SJ.shoulderL])],
  ['lengan atas', () => segBox(r.shoulders[0], [r.elbows[0]]), () => segBox(SJ.shoulderL, [SJ.elbowL])],
  ['lengan bawah', () => segBox(r.elbows[0], [r.wrists[0]]), () => segBox(SJ.elbowL, [SJ.wristL])],
  ['paha+sendi', () => segBox(r.hipJ[0], [r.kneeJ[0]]), () => segBox(SJ.hipL, [SJ.kneeL])],
  ['lutut+betis', () => segBox(r.kneeJ[0], [r.footJ[0], r.kneeCaps[0]]), () => segBox(SJ.kneeL, [SJ.ankleL])],
  ['boot', () => segBox(r.footJ[0], []), () => segBox(SJ.ankleL, [])],
  ['sarung tinju', () => segBox(r.fists[0], []), () => { const g = SJ.wristL.children.find((o) => o.isMesh && Math.abs(o.position.y + 0.065) < 1e-6); return segBox(g, []); }],
];
for (const [label, gm, sm] of ROWS) {
  const g = gm(), sref = sm();
  if (!g || !sref) { ok(`hull ${label} terukur`, false, 'tidak ada geometri'); continue; }
  const mul = label === 'sarung tinju' ? 1 : K; // glove diukur di ruang mesh (tanpa skala joint)
  const rw = sref.w * mul, rh = sref.h * mul, rd = sref.d * mul;
  console.log(`   ${label.padEnd(18)} ${`${f(g.w)} x ${f(g.h)} x ${f(g.d)}`.padEnd(24)} ${`${f(rw)} x ${f(rh)} x ${f(rd)}`.padEnd(24)} ${pct(g.w, rw)} / ${pct(g.h, rh)} / ${pct(g.d, rd)}`);
  const within = (v, ref) => Math.abs(v / ref - 1) <= 0.03 + 1e-6;
  ok(`hull ${label} = Real Steel x K`, within(g.w, rw) && within(g.h, rh) && within(g.d, rd), 'toleransi +-3%');
}

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §B  KESEDERHANAAN (badan = 89 mesh rig + stack FX mata)');
console.log('═══════════════════════════════════════════════════════════════════════════');
{
  let mesh = 0, tris = 0, verts = 0;
  r.root.traverse((o) => {
    if (!o.isMesh || isFx(o) || !o.geometry?.attributes?.position) return;
    mesh++;
    const g = o.geometry;
    verts += g.attributes.position.count;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  console.log(`   mesh padat   ${mesh}   (rig sim ${sim.meshes.length}; FX mata aditif di luar hitungan)`);
  console.log(`   segitiga     ${tris}   (ATLAS lama 141640)`);
  console.log(`   vertex       ${verts}   (ATLAS lama 423626)`);
  ok('mesh padat = mesh rig Real Steel', mesh === sim.meshes.length, `${mesh} mesh (FX mata aditif tidak dihitung)`);
  ok('segitiga jauh di bawah ATLAS (< 25.000)', tris < 25000, `${tris} tris`);
  ok('stack FX mata lengkap untuk Game.ts', r.eyeOptics.length === 2 && r.eyeLights.length === 2 && r.eyeIris.length === 2 && r.eyePupils.length === 2 && r.eyeScanners.length === 2 && r.eyeFlares.length === 2 && r.eyePulses.length === 2 && r.eyeBeams.length === 2, '');
  ok('tinju & tempurung tetap ada untuk animasi/probe', r.fists.length === 2 && r.kneeCaps.length === 2 && r.caps.length === 2, '');
}

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §C  SKELETON REAL STEEL YANG DIBEKUKAN (offset joint persis RS_SKEL)');
console.log('═══════════════════════════════════════════════════════════════════════════');
{
  const S = RS_SKEL;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const J = (label, cond) => ok(label, cond, cond ? '' : 'offset bergeser!');
  J('pinggul  (+-HIP_X, HIP_Y, 0)', near(r.hipJ[0].position.x, S.HIP_X) && near(r.hipJ[0].position.y, S.HIP_Y) && near(r.hipJ[1].position.x, -S.HIP_X));
  J('lutut    (0, -L1, 0)', near(r.kneeJ[0].position.y, -S.L1) && near(r.kneeJ[1].position.y, -S.L1));
  J('mata kaki(0, -L2, 0)', near(r.footJ[0].position.y, -S.L2) && near(r.footJ[1].position.y, -S.L2));
  J('pinggang (0, WAIST_Y, 0)', near(r.waist.position.y, S.WAIST_Y));
  J('dada     (0, CY, 0)', near(r.chest.position.y, S.CY));
  J('leher    (0, NECK_Y, 0)', near(r.neck.position.y, S.NECK_Y));
  J('kepala   (0, HEAD_Y, 0)', near(r.head.position.y, S.HEAD_Y));
  J('selangka (+-CLAV_X, CLAV_Y, 0)', near(r.clavs[0].position.x, S.CLAV_X) && near(r.clavs[0].position.y, S.CLAV_Y) && near(r.clavs[1].position.x, -S.CLAV_X));
  J('bahu     (+-SH_X, 0, 0)', near(r.shoulders[0].position.x, S.SH_X) && near(r.shoulders[1].position.x, -S.SH_X));
  J('siku     (0, -ELBOW_Y, 0)', near(r.elbows[0].position.y, -S.ELBOW_Y));
  J('pergelang(0, -WRIST_Y, 0)', near(r.wrists[0].position.y, -S.WRIST_Y));
  J('tempurung(0, 0, KNEECAP_Z)', near(r.kneeCaps[0].position.z, S.KNEECAP_Z));

  const headBox = segBox(r.head, []);
  const footBox = segBox(r.footJ[0], []);
  const top = r.head.localToWorld(new THREE.Vector3(0, headBox.max.y, 0)).y;
  const bottom = r.footJ[0].localToWorld(new THREE.Vector3(0, footBox.min.y, 0)).y;
  const tinggiLokal = (top - bottom) / r.root.scale.x;
  console.log(`   tinggi berdiri       ${f(top - bottom)} m   (target 7.55 m, root scale ${f(r.root.scale.x, 3)})`);
  ok('tinggi berdiri 7.55 m +-0.2', Math.abs(top - bottom - 7.55) < 0.2, f(top - bottom) + ' m');
  const bahuGame = (2 * (S.CLAV_X + S.SH_X)) / tinggiLokal;
  const bahuSim = 0.42 / RS_REF.tinggiBerdiri;
  const kakiGame = (S.L1 + S.L2 + S.SOLE) / tinggiLokal;
  const kakiSim = (0.44 + 0.42 + 0.07) / RS_REF.tinggiBerdiri;
  ok('rasio rentang bahu = Real Steel', Math.abs(bahuGame - bahuSim) < 0.005, `${f(bahuGame * 100, 1)}% vs ${f(bahuSim * 100, 1)}%`);
  ok('rasio kaki = Real Steel', Math.abs(kakiGame - kakiSim) < 0.005, `${f(kakiGame * 100, 1)}% vs ${f(kakiSim * 100, 1)}%`);
}

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' §D  SETIAP TULANG GAME = TULANG SIM x K (faktor tunggal)');
console.log('═══════════════════════════════════════════════════════════════════════════');
{
  const S = RS_SKEL, T = RS_REF.tulang;
  const rows = [
    ['pinggul -> leher', S.WAIST_Y + S.CY + S.NECK_Y - S.HIP_Y, T.panggulLeher + 0.05],
    ['bahu -> siku', S.ELBOW_Y, T.bahuSiku],
    ['siku -> pergelangan', S.WRIST_Y, T.sikuPergelangan],
    ['pinggul -> lutut', S.L1, T.pinggulLutut],
    ['lutut -> mata kaki', S.L2, T.lututMataKaki],
    ['leher -> kepala', S.HEAD_Y, T.leherKepala],
  ];
  console.log('   tulang                 faktor game/sim   vs K = ' + f(K, 4));
  for (const [label, g, sv] of rows) {
    console.log(`   ${label.padEnd(22)} ${f(g / sv, 4).padStart(9)}   ${pct(g / sv, K)}`);
    ok(`tulang ${label} = sim x K`, Math.abs(g / sv / K - 1) < 0.001, '');
  }
}

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
    ['reaktor arc', wy(bot.chest) + 0.11 * RS_SKEL.K * S],
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
