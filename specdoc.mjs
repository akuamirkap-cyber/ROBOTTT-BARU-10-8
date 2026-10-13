// ============================================================================
//  doc:spec — mencetak ulang tabel BENTUK & UKURAN untuk DESAIN_ROBOT.md §4
// ============================================================================
//     npm run doc:spec
//
//  Tabel di DESAIN_ROBOT.md §4 TIDAK ditulis tangan: ia dicetak dari
//  src/game/bodySpec.ts oleh skrip ini, jadi dokumen tidak mungkin melenceng
//  dari kode. Ubah spec → jalankan skrip ini → tempel hasilnya ke §4.
import * as S from './.__bodyspec.mjs';

const d = (r) => (r === undefined ? '—' : `${Math.round((r * 180) / Math.PI)}°`);
const num = (v) => (Math.round(v * 1000) / 1000).toString();
/** ukuran yang bisa dibaca tukang animasi: diameter untuk tabung/bola, bukan angka mentah */
function dims(p) {
  const s = p.s;
  switch (p.g) {
    case 'box': return `${num(s[0])} × ${num(s[1])} × ${num(s[2])} · sudut ${num(s[3] ?? 0.04)} · seg ${s[4] ?? 2}`;
    case 'cyl': return `Ø${num(2 * s[0])} → Ø${num(2 * s[1])} · t ${num(s[2])} · seg ${s[3] ?? 16}`;
    case 'sph': return `r ${num(s[0])} · seg ${s[1] ?? 16}×${s[2] ?? 12}`;
    case 'cone': return `r ${num(s[0])} · t ${num(s[1])} · seg ${s[2] ?? 8}`;
    case 'torus': return `R ${num(s[0])} · r ${num(s[1])} · seg ${s[2] ?? 20}`;
    case 'cap': return `r ${num(s[0])} · t ${num(s[1])}`;
  }
}
const pos = (p) => `${num(p.p[0])}, ${num(p.p[1])}, ${num(p.p[2])}`;
const rot = (p) => (p.r ? `${d(p.r[0])} / ${d(p.r[1])} / ${d(p.r[2])}` : '—');
const PRIM = { box: 'kotak', cyl: 'silinder', sph: 'bola', cone: 'kerucut', torus: 'cincin', cap: 'kapsul' };

function table(title, note, list) {
  console.log(`\n#### ${title}`);
  if (note) console.log(`\n${note}`);
  console.log('\n| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |');
  console.log('|---|--------|----------|-----------------|--------------|--------------|----------|------|');
  list.forEach((p, i) => {
    const side = p.mirror ? 'kiri+kanan' : 'tengah';
    console.log(`| ${i + 1} | ${p.n} | ${PRIM[p.g]} | ${dims(p)} | ${pos(p)} | ${rot(p)} | \`${p.m}\`${p.f ? ` ×${p.f}` : ''} | ${side} |`);
  });
  const n = S.realPartCount(list);
  console.log(`\n*${list.length} entri spec → ${n} bagian di dunia (yang \`kiri+kanan\` dibangun dua kali).*`);
}

console.log('<!-- ==== mulai tabel yang dihasilkan `npm run doc:spec` ==== -->');
console.log(`\nChassis: **${S.CHASSIS}** · total bagian badan: **${S.SIMPLE_MESH_COUNT}** · rig Real Steel Simulator: ${S.RS_REF.mesh} bagian.`);
table('4.1 Panggul (parent: `pelvis`)', 'Hull beku 1.60 × 0.91 × 0.99 · sendi paha di (±0.74, 2.85, 0).', S.PELVIS_PARTS);
table('4.2 Pinggang (parent: `waist`, y = 3.45 di ruang panggul)', 'Hull beku 1.16 × 0.32 × 1.16.', S.WAIST_PARTS);
table('4.3 Dada (parent: `chest`, y = +CY 0.35 dari pinggang)', 'Lebar mengikuti rentang bahu BEKU (selangka ±0.88, bahu ±1.68). Reaktor arc tidak digeser.', S.CHEST_PARTS);
table('4.4 Leher (parent: `neck`, y = 2.14 − CY, z = 0.08)', 'Sudah sesederhana Real Steel sejak awal → ukuran tidak diubah.', S.NECK_PARTS);
table('4.5 Kepala (parent: `head`, y = 0.36 z = 0.06, skala grup 1.04)', 'Daftar bagian persis rig Real Steel. Optik mata TETAP di (±0.155, −0.02, 0.43).', S.HEAD_PARTS);
table('4.6 Tulang selangka (parent: `clav`, (±0.88, 1.55, 0) di ruang dada)', 'Hull beku 0.70 × 0.24 × 0.44.', S.CLAV_PARTS);
table('4.7 Pauldron (parent: `cap`, posisi = posisi bahu)', 'Hull beku 0.79 × 0.63 × 0.89.', S.CAP_PARTS);
table('4.8 Lengan atas (parent: `shoulder`, tulang 1.05)', 'Rasio Real Steel 0.34 → dipakai 0.63 (chassis minimum, lihat §3).', S.ARM_PARTS);
table('4.9 Lengan bawah (parent: `elbow`, y = −1.05 dari bahu; tulang 0.975)', 'Pergelangan di y = −0.975.', S.FORE_PARTS);
table('4.10 Sendi pinggul (parent: `hipJ`, (±0.74, 2.85, 0))', '', S.HIP_PARTS);
table('4.11 Paha (parent: grup `thigh`, skala y = L1/1.5)', 'Dimodelkan sepanjang 1.5 lalu diregangkan ke tulang 2.00 — cara lama dipertahankan.', S.THIGH_PARTS);
table('4.12 Lutut (parent: `kneeJ`, y = −L1)', '', S.KNEE_PARTS);
table('4.13 Tempurung lutut (parent: `kneeCaps`, z = 0.28 × lt; dianimasikan robot.ts)', 'Jangkauan depan dijaga 0.62 dari lutut (probe lantai duduk di situ).', S.KNEECAP_PARTS);
table('4.14 Betis (parent: grup `shin`, skala y = L2/1.42)', 'Dimodelkan sepanjang 1.42 lalu diregangkan ke tulang 1.92.', S.SHIN_PARTS);
table('4.15 Boot (parent: `footJ`, y = −L2)', 'JEJAK BEKU: sol −0.21, ujung jari +1.24, tumit −0.62 (dipakai IK kaki & test:feet §9).', S.BOOT_PARTS);
console.log('\n<!-- ==== akhir tabel yang dihasilkan ==== -->');
