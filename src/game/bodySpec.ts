/**
 * ============================================================================
 *  DESAIN BENTUK & UKURAN BADAN ROBOT — "SIMPLE REAL STEEL CHASSIS"
 * ============================================================================
 *  Satu-satunya sumber kebenaran untuk BENTUK (primitif apa) dan UKURAN (berapa
 *  besar, di mana) setiap bagian badan robot Steel Titans. Dokumen manusianya
 *  ada di DESAIN_ROBOT.md — tabel di sana adalah tabel di file ini.
 *
 *  ATURAN DESAIN (hasil keputusan 2026-10-13):
 *   1. BENTUK 100% mengikuti rig Real Steel Simulator (src/sim/rig.ts): satu
 *      bagian = 1..3 primitif datar (box / cyl / sph / cone / torus). Tidak ada
 *      lagi lathe otot, arcPlate berlapis, gril 15 bilah, atau sirip 11 lembar.
 *   2. UKURAN mengikuti rasio Real Steel Simulator per segmen (K_SEG di bawah),
 *      KECUALI empat hal yang dibekukan karena dipakai sistem lain:
 *        a. tulang & pivot (src/game/rig.ts) — tidak disentuh sama sekali,
 *        b. jejak boot (SOLE 0.21 / TOE_Z 1.24 / HEEL_Z 0.62) — dipakai IK kaki,
 *        c. lambung sarung tinju — diukur harness test:clash dari mesh nyata,
 *        d. lambung dada/pauldron/kepala — dipakai probe lantai & BODY_R.
 *   3. Hull (kotak pembungkus) tiap segmen dijaga dalam toleransi HULL_TOL dari
 *      badan ATLAS lama, jadi probe lantai, jatuh-bangkit, dan kamera tidak
 *      berubah sedikit pun. `npm run test:size` yang menegakkan aturan ini.
 *
 *  Satuan: unit robot Steel Titans (1 unit = 1 m di dunia game).
 *  Sumbu: +x = kanan robot, +y = atas, +z = depan (wajah).
 */

/** Badan mana yang dibangun. `simple` = desain Real Steel ini (bawaan).
 *  `atlas` = badan lama yang detail (masih utuh di build.ts, tinggal dipakai
 *  lagi untuk membandingkan — tidak ada kode yang dibuang). */
export const CHASSIS: 'simple' | 'atlas' = 'simple';

// ============================================================================
// 1. REFERENSI — ukuran terukur rig Real Steel Simulator (src/sim/rig.ts)
//    diukur dengan `npm run test:size`, meter, tinggi berdiri 1.924 m, 89 mesh.
// ============================================================================
export const RS_REF = {
  tinggiBerdiri: 1.924,
  mesh: 89,
  tulang: { pinggulLutut: 0.44, lututMataKaki: 0.42, bahuSiku: 0.28, sikuPergelangan: 0.26, leherKepala: 0.09, panggulLeher: 0.57 },
  bagian: {
    //  nama                 lebar   tinggi   dalam
    pelvis: [0.3, 0.13, 0.23],
    waist: [0.19, 0.13, 0.19],
    spine: [0.27, 0.14, 0.2],
    chest: [0.4, 0.28, 0.29],
    neck: [0.1, 0.11, 0.1],
    head: [0.28, 0.3, 0.26],
    clav: [0.15, 0.05, 0.07],
    shoulder: [0.16, 0.36, 0.16],
    elbow: [0.1, 0.27, 0.1],
    wrist: [0.1, 0.15, 0.14],
    hip: [0.14, 0.44, 0.14],
    knee: [0.11, 0.41, 0.13],
    ankle: [0.12, 0.11, 0.26],
  } as Record<string, [number, number, number]>,
};

// ============================================================================
// 2. FAKTOR MAPPING — tulang Real Steel × K_SEG = tulang Steel Titans (BEKU)
//    K_SEG = panjang tulang game / panjang tulang Real Steel.
// ============================================================================
export const K_SEG = {
  torso: 2.14 / RS_REF.tulang.panggulLeher, //  3.75×   panggul → leher
  arm: 1.05 / RS_REF.tulang.bahuSiku, //        3.75×   bahu → siku
  fore: 0.975 / RS_REF.tulang.sikuPergelangan, // 3.75× siku → pergelangan
  thigh: 2.0 / RS_REF.tulang.pinggulLutut, //   4.55×   pinggul → lutut
  shin: 1.92 / RS_REF.tulang.lututMataKaki, // 4.57×    lutut → mata kaki
  head: 0.36 / RS_REF.tulang.leherKepala, //   4.00×    leher → kepala
};

/** Hull badan ATLAS lama (terukur, `npm run test:size` bagian A-legacy) dan
 *  toleransi yang diizinkan untuk badan simple. Angka ini yang menjaga supaya
 *  probe lantai, test:feet, test:pose dan kamera tidak bergeser. */
export const HULL_TOL = { w: 0.22, h: 0.12, d: 0.34 };
/** Hull badan ATLAS lama, diukur dari mesh nyata (FX aditif tidak ikut) dengan `npm run test:size`.
 *  Badan simple harus tetap di dalam HULL_TOL dari angka-angka ini supaya probe lantai, jatuh-bangkit,
 *  IK kaki dan framing kamera tidak berubah. */
export const HULL_ATLAS = {
  pelvis: [1.6, 0.91, 0.99],
  waist: [1.16, 0.32, 1.16],
  chest: [2.92, 2.1, 1.83],
  neck: [0.67, 0.63, 0.68],
  head: [0.93, 1.3, 0.96],
  clav: [0.7, 0.24, 0.44],
  cap: [0.79, 0.63, 0.89],
  arm: [0.78, 1.42, 0.87],
  fore: [0.7, 1.34, 0.71],
  fist: [1.06, 1.18, 1.01],
  hip: [0.44, 0.5, 0.51],
  thigh: [0.93, 1.56, 0.98], // ruang model (grup paha diskalakan L1/1.5)
  knee: [0.9, 0.49, 0.59],
  kneecap: [0.58, 0.7, 0.76],
  shin: [0.7, 1.44, 0.81], // ruang model (grup betis diskalakan L2/1.42)
  boot: [0.86, 0.46, 1.88],
} as Record<string, [number, number, number]>;

/** Pengecualian yang disengaja: pelat tempurung ATLAS melingkar sampai ke BELAKANG lutut (0.76 dalam),
 *  padahal bagian itu tersembunyi di dalam sendi. Yang dipakai sistem lain hanyalah JANGKAUAN DEPANNYA
 *  (probe lutut di z +0.62), jadi hanya itu yang dijaga — lihat KNEECAP_REACH. */
export const HULL_EXEMPT: Record<string, ('w' | 'h' | 'd')[]> = { kneecap: ['d'] };
export const KNEECAP_REACH = 0.621; // z depan tempurung relatif sendi lutut, diukur dari badan ATLAS

/** Badan ATLAS lama sebagai plafon kesederhanaan (terukur, non-FX) */
export const ATLAS_MESHES = 133;
export const ATLAS_TRIS = 141640;
export const ATLAS_VERTS = 423626;

// ============================================================================
// 3. FORMAT SPEC
// ============================================================================
export type Prim = 'box' | 'cyl' | 'sph' | 'cone' | 'torus' | 'cap';
export type MatKey = 'main' | 'sec' | 'dark' | 'steel' | 'accent' | 'glow' | 'joint' | 'rubber' | 'visor' | 'core';

export interface SpecPart {
  /** nama bagian — label yang sama dipakai di DESAIN_ROBOT.md dan di debug */
  n: string;
  /** primitif: box(w,h,d,[r]) · cyl(rAtas,rBawah,h,[seg]) · sph(r) · cone(r,h,[seg]) · torus(R,r,[seg]) · cap(r,h) */
  g: Prim;
  s: number[];
  /** posisi di ruang joint induk */
  p: [number, number, number];
  /** rotasi euler XYZ (radian) */
  r?: [number, number, number];
  /** material dari Ctx */
  m: MatKey;
  /** skala tambahan (dikalikan faktor Opt) */
  sc?: [number, number, number];
  /** bagian berpasangan kiri/kanan.
   *  · di segmen tengah (pinggul/dada/kepala/…) → dibangun dua kali, x dan rotasi y/z dibalik,
   *  · di segmen anggota (lengan/kaki) → x dan rotasi y/z mengikuti tanda sisi anggota itu. */
  mirror?: boolean;
  /** faktor Opt yang mengalikan ukuran: 'th' lengan · 'lt' kaki · 'cw' dada · 'fs' tinju */
  f?: 'th' | 'lt' | 'cw' | 'fs';
  /** ulangi sebanyak count dengan langkah posisi (dipakai gril rahang & gelang leher) */
  repeat?: { count: number; dx?: number; dy?: number; dz?: number };
}

// ============================================================================
// 4. BADAN SIMPLE — setiap bagian, bentuknya dan ukurannya
// ============================================================================

/** PINGGUL — hull beku 1.60 × 0.91 × 0.99 (y 2.53…3.44), sendi paha di ±0.74 / y 2.85 */
export const PELVIS_PARTS: SpecPart[] = [
  { n: 'inti panggul', g: 'box', s: [1.56, 0.8, 0.9], p: [0, 3.0, 0], m: 'sec' },
  { n: 'celana depan', g: 'box', s: [1.0, 0.62, 0.14], p: [0, 3.02, 0.42], m: 'main' },
  { n: 'celana belakang', g: 'box', s: [1.0, 0.62, 0.14], p: [0, 3.02, -0.42], m: 'main' },
  { n: 'sabuk baja', g: 'box', s: [1.6, 0.14, 0.96], p: [0, 3.37, 0], m: 'steel' },
  { n: 'garis sabuk', g: 'box', s: [0.96, 0.03, 0.05, 0.02, 1], p: [0, 3.43, 0.45], m: 'glow' },
  { n: 'sumbu pinggul', g: 'cyl', s: [0.24, 0.24, 0.3], p: [0.66, 2.85, 0], r: [0, 0, Math.PI / 2], m: 'joint', mirror: true },
];

/** PINGGANG — hull beku 1.16 × 0.32 × 1.16 */
export const WAIST_PARTS: SpecPart[] = [
  { n: 'drum pinggang', g: 'cyl', s: [0.48, 0.52, 0.3], p: [0, 0.06, 0.02], sc: [1, 1, 0.86], m: 'joint' },
  { n: 'cincin pinggang', g: 'torus', s: [0.5, 0.05, 20], p: [0, 0.2, 0.02], r: [Math.PI / 2, 0, 0], m: 'steel' },
];

/** DADA — lebar mengikuti rentang bahu BEKU (clav ±0.88, shoulder ±1.68);
 *  dalam & tinggi dari rasio Real Steel (0.575 × lebar, tulang dada 1.79).
 *  Reaktor arc dipertahankan persis di koordinat lama: itu identitas ATLAS + anchor FX. */
export const CHEST_PARTS: SpecPart[] = [
  { n: 'perut inti', g: 'box', s: [1.4, 0.72, 1.2], p: [0, 0.3, 0], m: 'sec', f: 'cw' },
  { n: 'rusuk inti', g: 'box', s: [2.1, 1.0, 1.5], p: [0, 1.0, -0.02], m: 'sec', f: 'cw' },
  { n: 'kuk bahu', g: 'box', s: [2.8, 0.62, 1.4], p: [0, 1.6, -0.04], m: 'main', f: 'cw' },
  { n: 'pelat pektoral', g: 'box', s: [1.06, 0.72, 0.18], p: [0.55, 1.12, 0.66], r: [-0.08, 0, 0], m: 'main', mirror: true, f: 'cw' },
  { n: 'trim pektoral', g: 'box', s: [1.0, 0.07, 0.06, 0.02, 1], p: [0.55, 0.78, 0.7], m: 'accent', mirror: true, f: 'cw' },
  { n: 'lunas sternum', g: 'box', s: [0.36, 1.1, 0.14], p: [0, 1.05, 0.66], m: 'dark' },
  { n: 'pelat perut', g: 'box', s: [0.52, 0.54, 0.12], p: [0.34, 0.42, 0.58], m: 'main', mirror: true, f: 'cw' },
  // ---- reaktor arc (ukuran & posisi TIDAK diubah — identitas + anchor FX) ----
  { n: 'bezel reaktor', g: 'cyl', s: [0.25, 0.275, 0.08, 8], p: [0, 1.06, 0.59], r: [Math.PI / 2, 0, 0], m: 'steel' },
  { n: 'ruang reaktor', g: 'cyl', s: [0.2, 0.2, 0.036], p: [0, 1.06, 0.63], r: [Math.PI / 2, 0, 0], m: 'dark' },
  { n: 'cincin plasma', g: 'cyl', s: [0.165, 0.165, 0.032], p: [0, 1.06, 0.652], r: [Math.PI / 2, 0, 0], m: 'glow' },
  { n: 'kerah reaktor', g: 'torus', s: [0.185, 0.02, 24], p: [0, 1.06, 0.655], m: 'accent' },
  { n: 'inti reaktor', g: 'cyl', s: [0.085, 0.095, 0.04], p: [0, 1.06, 0.67], r: [Math.PI / 2, 0, 0], m: 'core' },
  // ---- punggung ----
  { n: 'pelat punggung', g: 'box', s: [2.0, 1.3, 0.22], p: [0, 1.05, -0.72], m: 'main', f: 'cw' },
  { n: 'belikat', g: 'box', s: [0.56, 0.66, 0.18], p: [0.72, 1.3, -0.86], m: 'main', mirror: true, f: 'cw' },
  { n: 'trapezius', g: 'box', s: [0.92, 0.4, 0.8], p: [0.78, 1.72, -0.1], r: [0, 0, -0.3], m: 'main', mirror: true, f: 'cw' },
];

/** LEHER — sudah sesederhana Real Steel (1 tabung + 3 gelang), ukuran beku 0.67 × 0.63 × 0.68 */
export const NECK_PARTS: SpecPart[] = [
  { n: 'kolom leher', g: 'cyl', s: [0.27, 0.34, 0.5, 14], p: [0, 0.02, -0.04], m: 'joint' },
  { n: 'gelang leher', g: 'torus', s: [0.29, 0.035, 18], p: [0, -0.1, -0.04], r: [Math.PI / 2, 0, 0], m: 'rubber', repeat: { count: 3, dy: 0.1 } },
  { n: 'batang cahaya', g: 'cyl', s: [0.04, 0.04, 0.6, 6], p: [0.2, 0.1, 0.16], m: 'glow', mirror: true },
];

/** KEPALA — daftar bagian persis rig Real Steel (tengkorak, dahi miring, alis V,
 *  visor, rahang gril, pipi, sirip, tanduk, piston telinga, knalpot).
 *  Hull beku 0.93 × 1.30; optik mata tetap di (±0.155, −0.02, 0.43) supaya
 *  semua FX mata (iris, pupil, scan bar, flare, lock-on ring, streak) tidak berubah. */
export const HEAD_PARTS: SpecPart[] = [
  { n: 'tengkorak', g: 'box', s: [0.66, 0.66, 0.78, 0.08], p: [0, 0.1, -0.04], m: 'main' },
  { n: 'dahi miring', g: 'box', s: [0.72, 0.2, 0.5, 0.05], p: [0, 0.42, 0.08], r: [0.5, 0, 0], m: 'main' },
  { n: 'alis V', g: 'box', s: [0.36, 0.1, 0.16, 0.03], p: [0.17, 0.3, 0.34], r: [0, 0, 0.38], m: 'accent', mirror: true },
  { n: 'trim alis', g: 'box', s: [0.6, 0.05, 0.07, 0.02, 1], p: [0, 0.2, 0.4], m: 'steel' },
  { n: 'visor gelap', g: 'box', s: [0.6, 0.22, 0.1, 0.03], p: [0, 0.0, 0.36], m: 'dark' },
  { n: 'rahang', g: 'box', s: [0.54, 0.26, 0.44, 0.05], p: [0, -0.22, 0.1], m: 'joint' },
  { n: 'gigi gril', g: 'box', s: [0.05, 0.15, 0.05, 0.02, 1], p: [-0.2, -0.22, 0.33], m: 'accent', repeat: { count: 5, dx: 0.1 } },
  { n: 'dagu', g: 'box', s: [0.44, 0.22, 0.18, 0.05], p: [0, -0.42, 0.26], m: 'main' },
  { n: 'pelindung pipi', g: 'box', s: [0.12, 0.4, 0.5, 0.04], p: [0.33, -0.02, 0.02], r: [0, 0.4, 0.08], m: 'main', mirror: true },
  { n: 'piston telinga', g: 'cyl', s: [0.13, 0.13, 0.14], p: [0.36, 0.06, -0.04], r: [0, 0, Math.PI / 2], m: 'steel', mirror: true },
  { n: 'inti telinga', g: 'cyl', s: [0.07, 0.07, 0.18, 12], p: [0.4, 0.06, -0.04], r: [0, 0, Math.PI / 2], m: 'glow', mirror: true },
  { n: 'sirip puncak', g: 'box', s: [0.09, 0.28, 0.74, 0.03], p: [0, 0.62, -0.06], r: [0.15, 0, 0], m: 'accent' },
  { n: 'tanduk', g: 'cone', s: [0.09, 0.52, 8], p: [0.3, 0.54, -0.08], r: [-0.7, 0, -0.55], m: 'accent', mirror: true },
  { n: 'knalpot belakang', g: 'box', s: [0.38, 0.24, 0.16, 0.04], p: [0, 0.1, -0.44], m: 'joint' },
  { n: 'kerah leher', g: 'box', s: [0.34, 0.2, 0.24, 0.05], p: [0, -0.3, -0.12], m: 'joint' },
];

/** PAULDRON (grup cap) — hull beku 0.79 × 0.63 × 0.89 */
export const CAP_PARTS: SpecPart[] = [
  { n: 'deltoid', g: 'sph', s: [0.3, 16, 12], p: [0, -0.02, 0], sc: [1, 0.86, 1.04], m: 'joint', f: 'th' },
  { n: 'pelat pauldron', g: 'box', s: [0.78, 0.34, 0.84, 0.07], p: [0, 0.06, 0], m: 'main', f: 'th' },
  { n: 'bawah pauldron', g: 'box', s: [0.66, 0.2, 0.72, 0.06], p: [0, -0.2, 0], m: 'sec', f: 'th' },
  { n: 'pita pauldron', g: 'box', s: [0.7, 0.06, 0.76, 0.02, 1], p: [0, 0.27, 0], m: 'accent', f: 'th' },
];

/** LENGAN ATAS — tulang beku 1.05; rasio Real Steel 0.34 → dipakai 0.63 (chassis minimum) */
export const ARM_PARTS: SpecPart[] = [
  { n: 'bola bahu', g: 'sph', s: [0.3, 16, 12], p: [0, 0, 0], m: 'joint', f: 'th' },
  { n: 'tabung lengan', g: 'cyl', s: [0.33, 0.28, 0.98], p: [0, -0.52, 0], m: 'sec', f: 'th' },
  { n: 'pelat bisep', g: 'box', s: [0.5, 0.58, 0.16, 0.04], p: [0, -0.48, 0.24], m: 'main', f: 'th' },
  { n: 'pelat trisep', g: 'box', s: [0.46, 0.54, 0.14, 0.04], p: [0, -0.52, -0.24], m: 'main', f: 'th' },
  { n: 'batang piston', g: 'cyl', s: [0.08, 0.08, 0.9, 10], p: [0, -0.5, -0.34], m: 'steel', f: 'th' },
  { n: 'garis lengan', g: 'box', s: [0.04, 0.44, 0.04, 0.02, 1], p: [0.26, -0.5, 0.08], m: 'glow', mirror: true, f: 'th' },
];

/** LENGAN BAWAH — tulang beku 0.975; rasio Real Steel 0.385 → dipakai 0.60 */
export const FORE_PARTS: SpecPart[] = [
  { n: 'sendi siku', g: 'sph', s: [0.26, 14, 10], p: [0, 0, 0], m: 'joint', f: 'th' },
  { n: 'cakram siku', g: 'cyl', s: [0.2, 0.2, 0.1, 12], p: [0.26, 0, 0], r: [0, 0, Math.PI / 2], m: 'steel', mirror: true, f: 'th' },
  { n: 'tabung lengan bawah', g: 'cyl', s: [0.29, 0.25, 0.9], p: [0, -0.48, 0], m: 'sec', f: 'th' },
  { n: 'bracer depan', g: 'box', s: [0.48, 0.62, 0.16, 0.05], p: [0, -0.46, 0.22], m: 'main', f: 'th' },
  { n: 'bracer belakang', g: 'box', s: [0.44, 0.56, 0.14, 0.04], p: [0, -0.48, -0.22], m: 'main', f: 'th' },
  { n: 'garis bracer', g: 'box', s: [0.04, 0.46, 0.04, 0.02, 1], p: [0.26, -0.46, 0.06], m: 'glow', mirror: true, f: 'th' },
  { n: 'kerah pergelangan', g: 'cyl', s: [0.3, 0.36, 0.14], p: [0, -0.87, 0], m: 'steel', f: 'th' },
];

/** PINGGUL→PAHA — grup paha tetap diskalakan L1/1.5 (bone stretch) seperti badan lama */
export const HIP_PARTS: SpecPart[] = [
  { n: 'drum pinggul', g: 'cyl', s: [0.24, 0.24, 0.36, 16], p: [0, 0, 0], r: [0, 0, Math.PI / 2], m: 'steel', f: 'lt' },
  { n: 'sumbu pinggul', g: 'sph', s: [0.22, 14, 10], p: [0, 0, 0], m: 'joint', f: 'lt' },
];

/** PAHA (ruang model 1.5, dunia ×L1/1.5) — hull beku 0.93 × 1.56 × 0.98 */
export const THIGH_PARTS: SpecPart[] = [
  { n: 'inti paha', g: 'box', s: [0.84, 1.46, 0.84, 0.1], p: [0, -0.75, 0], m: 'sec', f: 'lt' },
  { n: 'pelat quad', g: 'box', s: [0.64, 1.14, 0.14, 0.05], p: [0, -0.7, 0.42], m: 'main', f: 'lt' },
  { n: 'pelat hamstring', g: 'box', s: [0.6, 1.06, 0.14, 0.05], p: [0, -0.74, -0.42], m: 'main', f: 'lt' },
  { n: 'pita pinggul', g: 'box', s: [0.88, 0.1, 0.88, 0.03, 1], p: [0, -0.16, 0], m: 'accent', f: 'lt' },
];

/** LUTUT — hull beku 0.90 × 0.49 × 0.59 */
export const KNEE_PARTS: SpecPart[] = [
  { n: 'gandar lutut', g: 'cyl', s: [0.24, 0.24, 0.86, 16], p: [0, 0, 0], r: [0, 0, Math.PI / 2], m: 'steel', f: 'lt' },
  { n: 'pelat belakang lutut', g: 'box', s: [0.58, 0.42, 0.16, 0.04], p: [0, -0.02, -0.24], m: 'main', f: 'lt' },
];

/** TEMPURUNG LUTUT (grup yang dianimasikan robot.ts: rotation.x = −fleksi × 0.4) */
export const KNEECAP_PARTS: SpecPart[] = [
  { n: 'pelat tempurung', g: 'box', s: [0.54, 0.64, 0.36, 0.08], p: [0, 0, 0.17], m: 'main', f: 'lt' },
  { n: 'inti tempurung', g: 'box', s: [0.16, 0.2, 0.06, 0.02, 1], p: [0, 0.02, 0.36], m: 'glow', f: 'lt' },
];

/** BETIS (ruang model 1.42, dunia ×L2/1.42) — hull beku 0.70 × 1.44 × 0.81 */
export const SHIN_PARTS: SpecPart[] = [
  { n: 'inti betis', g: 'box', s: [0.64, 1.38, 0.66, 0.09], p: [0, -0.7, 0], m: 'sec', f: 'lt' },
  { n: 'pelat greave', g: 'box', s: [0.5, 1.06, 0.12, 0.04], p: [0, -0.62, 0.34], m: 'main', f: 'lt' },
  { n: 'pelat betis belakang', g: 'box', s: [0.46, 0.76, 0.12, 0.04], p: [0, -0.5, -0.32], m: 'main', f: 'lt' },
  { n: 'garis betis', g: 'box', s: [0.05, 0.66, 0.04, 0.02, 1], p: [0, -0.6, 0.41], m: 'glow', f: 'lt' },
  { n: 'kerah mata kaki', g: 'box', s: [0.66, 0.2, 0.7, 0.05], p: [0, -1.32, 0.02], m: 'main', f: 'lt' },
];

/** BOOT — JEJAK BEKU: sol 0.21 di bawah mata kaki, ujung jari z +1.24, tumit z −0.62
 *  (dipakai IK kaki & test:feet §9 "setiap vertex boot menyentuh kanvas"). */
export const BOOT_PARTS: SpecPart[] = [
  { n: 'rumah mata kaki', g: 'box', s: [0.5, 0.3, 0.46, 0.08], p: [0, -0.02, 0.06], m: 'dark', f: 'lt' },
  { n: 'gandar mata kaki', g: 'cyl', s: [0.19, 0.19, 0.5, 14], p: [0, 0.06, 0], r: [0, 0, Math.PI / 2], m: 'steel', f: 'lt' },
  { n: 'sol', g: 'box', s: [0.8, 0.07, 1.84, 0.03, 1], p: [0, -0.175, 0.32], m: 'rubber' },
  { n: 'dek boot', g: 'box', s: [0.78, 0.3, 1.4, 0.06], p: [0, 0.02, 0.22], m: 'main', f: 'lt' },
  { n: 'kerah boot', g: 'box', s: [0.7, 0.2, 0.6, 0.05], p: [0, 0.16, -0.12], m: 'main', f: 'lt' },
  { n: 'ujung jari', g: 'box', s: [0.7, 0.16, 0.34, 0.05], p: [0, -0.05, 1.02], m: 'main', f: 'lt' },
  { n: 'taji tumit', g: 'box', s: [0.3, 0.12, 0.18, 0.04, 1], p: [0, 0.0, -0.51], m: 'steel' },
];

/** Tulang selangka — 1 balok, ukuran beku (dipakai rentang bahu) */
export const CLAV_PARTS: SpecPart[] = [
  { n: 'tulang selangka', g: 'box', s: [0.7, 0.24, 0.44, 0.1], p: [0.3, 0, 0], m: 'joint', mirror: true },
];

/** Total bagian badan simple (dihitung, dipakai harness & dokumen) */
export const SIMPLE_PART_COUNT =
  PELVIS_PARTS.length + WAIST_PARTS.length + CHEST_PARTS.length + NECK_PARTS.length + HEAD_PARTS.length +
  CLAV_PARTS.length * 2 + CAP_PARTS.length * 2 + ARM_PARTS.length * 2 + FORE_PARTS.length * 2 +
  (HIP_PARTS.length + THIGH_PARTS.length + KNEE_PARTS.length + KNEECAP_PARTS.length + SHIN_PARTS.length + BOOT_PARTS.length) * 2;

/** Bagian yang berpasangan (mirror) dihitung dua kali untuk angka dunia nyata */
export function realPartCount(list: SpecPart[]): number {
  let n = 0;
  for (const p of list) {
    const rep = p.repeat?.count ?? 1;
    n += (p.mirror ? 2 : 1) * rep;
  }
  return n;
}

export const SIMPLE_MESH_COUNT =
  realPartCount(PELVIS_PARTS) + realPartCount(WAIST_PARTS) + realPartCount(CHEST_PARTS) +
  realPartCount(NECK_PARTS) + realPartCount(HEAD_PARTS) +
  2 * (realPartCount(CLAV_PARTS) + realPartCount(CAP_PARTS) + realPartCount(ARM_PARTS) + realPartCount(FORE_PARTS) +
       realPartCount(HIP_PARTS) + realPartCount(THIGH_PARTS) + realPartCount(KNEE_PARTS) +
       realPartCount(KNEECAP_PARTS) + realPartCount(SHIN_PARTS) + realPartCount(BOOT_PARTS));
