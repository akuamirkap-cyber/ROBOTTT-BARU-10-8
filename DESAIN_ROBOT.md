# 🤖 DESAIN BENTUK & UKURAN ROBOT — *SIMPLE REAL STEEL CHASSIS*

Desain resmi badan robot **Steel Titans: WRC** setelah dirombak jadi **sesimple rig Real Steel 100%**:
setiap bagian = 1 primitif datar (kotak / silinder / bola / kerucut / cincin), dengan ukuran yang tertulis
angka pasti, supaya **konfigurasi animasi bisa dikerjakan pakai penggaris, bukan pakai perasaan**.

- **Sumber kebenaran bentuk & ukuran:** [`src/game/bodySpec.ts`](src/game/bodySpec.ts) (data murni, tidak ada logika)
- **Penerjemahnya jadi geometri:** `buildSimpleChassis()` di [`src/game/build.ts`](src/game/build.ts)
- **Pengukurnya (harness):** [`sizetest.mjs`](sizetest.mjs) → `npm run test:size`
- **Pencetak tabel §4 dokumen ini:** `npm run doc:spec` → [`specdoc.mjs`](specdoc.mjs)
- **Referensi bentuk:** rig Real Steel Simulator [`src/sim/rig.ts`](src/sim/rig.ts)

> Semua angka di dokumen ini **terukur dari mesh nyata**, bukan dari sketsa. Kalau spec diubah, jalankan
> `npm run test:size` (mengukur ulang + menegakkan aturan) dan `npm run doc:spec` (mencetak ulang §4).

---

## 1. Keputusan desain

Di repo ini ada **dua tubuh robot** yang ukurannya tidak saling kenal:

|  | **Steel Titans** (game utama, `src/game/`) | **Real Steel Simulator** (`src/sim/`) |
|---|---|---|
| Tinggi berdiri | **7.55 m** (root scale 0.94, 1 unit = 1 m) | **1.924 m** (skala manusia) |
| Bagian | ~600 primitif: `lathe` otot, `arcPlate` berlapis, gril 15 bilah, sirip 11 lembar | **89 mesh**: kotak + silinder, 20 joint berlabel |
| Tulang | `L1 2.00` · `L2 1.92` · `HIP_Y 2.85` · pinggang 3.45 · dada +0.35 · leher 1.79 | pinggul→lutut 0.44 · lutut→mata kaki 0.42 · bahu→siku 0.28 · siku→pergelangan 0.26 |

Keputusan (2026-10-13):

| # | Keputusan | Akibat |
|---|-----------|--------|
| 1 | **BENTUK** badan Steel Titans mengikuti 100% daftar bagian rig Real Steel Simulator | badan jadi pelat datar + sendi terbuka, tidak ada lagi ukiran organik |
| 2 | **UKURAN** mengikuti rasio Real Steel per segmen (`K_SEG`, §3) | lengan & kaki lebih ramping, kepala lebih padat |
| 3 | **SKELETON & ANGKA GAMEPLAY DIBEKUKAN** (`rig.ts`, reach, kamera, `BODY_R`, probe lantai) | tidak ada satu pun sistem yang perlu di-retune; semua harness tetap sama persis |
| 4 | **HULL (kotak pembungkus) tiap segmen dijaga** dalam toleransi `HULL_TOL` dari badan ATLAS lama | jatuh-bangkit, IK kaki, `test:feet`, `test:pose` dan framing kamera tidak bergeser |

Badan ATLAS lama **tidak dihapus** — ia tetap utuh di `build.ts` dan bisa dipakai lagi dengan mengganti
satu baris: `CHASSIS = 'atlas'` di `bodySpec.ts`.

---

## 2. Referensi terukur

### 2.1 Real Steel Simulator (bentuk yang ditiru) — `src/sim/rig.ts`

Tinggi berdiri **1.924 m**, **89 mesh**, 20 joint berlabel. Ukuran tiap segmen (lebar × tinggi × dalam, meter):

| Segmen | Ukuran | Tulang | Rasio lebar/tulang |
|---|---|---|---|
| pelvis | 0.300 × 0.130 × 0.230 | — | — |
| waist | 0.190 × 0.130 × 0.190 | 0.08 | — |
| spine | 0.270 × 0.140 × 0.200 | 0.12 | — |
| chest | 0.400 × 0.280 × 0.293 | 0.25 (dada→leher) | — |
| neck | 0.100 × 0.110 × 0.100 | 0.09 (leher→kepala) | — |
| head | 0.281 × 0.304 × 0.256 | — | — |
| clav | 0.150 × 0.050 × 0.070 | — | — |
| shoulder (bahu + lengan atas) | 0.157 × 0.360 × 0.160 | 0.28 | tabung Ø0.096 → **0.34** |
| elbow (lengan bawah) | 0.100 × 0.269 × 0.100 | 0.26 | **0.38** |
| wrist (tinju) | 0.100 × 0.147 × 0.137 | — | — |
| hip (paha) | 0.136 × 0.438 × 0.135 | 0.44 | **0.31** |
| knee (betis) | 0.110 × 0.405 × 0.135 | 0.42 | **0.26** |
| ankle (boot) | 0.115 × 0.110 × 0.260 | — | panjang/tinggi badan 0.135 |

Daftar bagian kepalanya (yang sekarang ditiru 1:1): tengkorak · dahi miring · alis V · visor gelap ·
rahang gril 5 gigi · pelindung pipi · sirip puncak · tanduk menyapu · piston telinga + inti menyala · knalpot belakang.

### 2.2 Steel Titans (tulang yang dibekukan) — `src/game/rig.ts`

| Konstanta | Nilai | Arti |
|---|---|---|
| `L1` | 2.00 | pinggul → lutut |
| `L2` | 1.92 | lutut → mata kaki |
| `HIP_Y` | 2.85 | tinggi sendi pinggul di ruang panggul |
| `UP` | 0.71 | offset pivot badan atas |
| `CY` | 0.35 | dada di atas pinggang |
| `SOLE` | 0.21 | sol boot di bawah mata kaki |
| `TOE_Z` / `HEEL_Z` | 1.24 / 0.62 | ujung jari / tumit dari mata kaki |
| `ANKLE_H` | 0.23 | tinggi mata kaki saat kaki datar |
| `STAND_Y` | 2.88 + UP×0.95 + 0.56 | tinggi pinggul berdiri |
| root scale | 0.94 | unit lokal → meter dunia |
| rentang bahu | selangka ±0.88, bahu ±1.68 → **3.36** (luar pauldron ~4.16) | **beku** |
| tinggi berdiri | **7.55 m** (bind) / 7.36 m (stance tinju) | = 3.92× tinggi rig Real Steel |

---

## 3. Faktor mapping ukuran

### 3.1 Kenapa tidak bisa satu faktor saja

Kalau seluruh rig Real Steel diperbesar seragam 3.92× (7.55 / 1.924), lebarnya jadi benar untuk **lengan**
(tulang sim 0.28 × 3.92 = 1.10 ≈ tulang game 1.05) tapi salah untuk **bahu**: rig sim punya rentang
bahu 0.61 m = 0.32× tingginya, sedangkan Steel Titans punya 4.16 m = **0.55×** tingginya (bahu heroik,
dan posisinya beku di `clav ±0.88`). Jadi satu faktor seragam tidak mungkin — dipakai **faktor per segmen**:

`K_SEG = panjang tulang Steel Titans ÷ panjang tulang Real Steel`

| Segmen | Tulang Real Steel | Tulang Steel Titans (beku) | **K_SEG** |
|---|---|---|---|
| torso (panggul → leher) | 0.57 | 2.14 | **3.75×** |
| lengan atas (bahu → siku) | 0.28 | 1.05 | **3.75×** |
| lengan bawah (siku → pergelangan) | 0.26 | 0.975 | **3.75×** |
| paha (pinggul → lutut) | 0.44 | 2.00 | **4.55×** |
| betis (lutut → mata kaki) | 0.42 | 1.92 | **4.57×** |
| kepala (leher → kepala) | 0.09 | 0.36 | **4.00×** |
| tinggi berdiri | 1.924 | 7.55 | 3.92× |

### 3.2 Ukuran yang dipakai (rasio Real Steel × tulang beku), dan 4 pengecualian

| Segmen | Real Steel murni | ATLAS lama | **Dipakai sekarang** | Alasan |
|---|---|---|---|---|
| lebar dada | 1.50 | 2.92 | **2.80** | ⚠️ **pengecualian 1** — rentang bahu beku: dada harus menutup selangka di ±0.88 |
| lebar kepala | 1.12 | 0.93 | **0.98** | hull kepala + probe lantai di ±0.45 dijaga |
| lengan atas | 0.36 | 0.78 | **0.66** | chassis minimum: probe bahu duduk di ±0.50 |
| lengan bawah | 0.38 | 0.70 | **0.72** | kerah pergelangan Ø0.72 dipertahankan (sarung tinju beku) |
| paha | 0.62 | 0.93 | **0.88** | pita kit skin 10/11 melingkar di Ø0.94 |
| betis | 0.50 | 0.70 | **0.66** | pita kit skin 10/11 melingkar di Ø0.76 |
| tinju | 0.38 | 1.06 | **1.06** | ⚠️ **pengecualian 2** — BEKU: `test:clash` mengukur jarak permukaan dari mesh sarung nyata |
| panjang boot | 1.02 | 1.88 | **1.84** | ⚠️ **pengecualian 3** — BEKU: `SOLE`/`TOE_Z`/`HEEL_Z` dipakai IK kaki & `test:feet §9` |
| tebal tempurung lutut | — | 0.76 | **0.40** | ⚠️ **pengecualian 4** — setengah belakang pelat ATLAS terbenam di dalam sendi; yang dijaga **jangkauan depannya** (0.620 vs 0.621) karena probe lantai duduk di sana |

> `pengecualian 1..4` inilah satu-satunya tempat desain menyimpang dari Real Steel murni, dan semuanya
> karena ada sistem lain yang memegang angka itu. Sisanya 100% rasio Real Steel.

---

## 4. Tabel bentuk & ukuran setiap bagian

Dihasilkan dari `src/game/bodySpec.ts` oleh `npm run doc:spec` — jangan diedit tangan.
Satuan = unit robot (1 unit = 1 m dunia setelah root scale 0.94). Sumbu: `+x` kanan robot, `+y` atas, `+z` depan.
Material: `main` pelat utama · `sec` under-suit · `dark` rongga · `steel` baja poles · `accent` aksen ·
`glow` menyala · `joint` mekanik · `rubber` karet · `core` inti putih. `×th/×lt/×cw/×fs` = ukuran ikut
faktor varian (`ATOM_OPT`/`BRUTE_OPT`), jadi varian brute otomatis lebih besar tanpa spec kedua.

<!-- ==== mulai tabel yang dihasilkan `npm run doc:spec` ==== -->

Chassis: **simple** · total bagian badan: **147** · rig Real Steel Simulator: 89 bagian.

#### 4.1 Panggul (parent: `pelvis`)

Hull beku 1.60 × 0.91 × 0.99 · sendi paha di (±0.74, 2.85, 0).

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | inti panggul | kotak | 1.56 × 0.8 × 0.9 · sudut 0.04 · seg 2 | 0, 3, 0 | — | `sec` | tengah |
| 2 | celana depan | kotak | 1 × 0.62 × 0.14 · sudut 0.04 · seg 2 | 0, 3.02, 0.42 | — | `main` | tengah |
| 3 | celana belakang | kotak | 1 × 0.62 × 0.14 · sudut 0.04 · seg 2 | 0, 3.02, -0.42 | — | `main` | tengah |
| 4 | sabuk baja | kotak | 1.6 × 0.14 × 0.96 · sudut 0.04 · seg 2 | 0, 3.37, 0 | — | `steel` | tengah |
| 5 | garis sabuk | kotak | 0.96 × 0.03 × 0.05 · sudut 0.02 · seg 1 | 0, 3.43, 0.45 | — | `glow` | tengah |
| 6 | sumbu pinggul | silinder | Ø0.48 → Ø0.48 · t 0.3 · seg 16 | 0.66, 2.85, 0 | 0° / 0° / 90° | `joint` | kiri+kanan |

*6 entri spec → 7 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.2 Pinggang (parent: `waist`, y = 3.45 di ruang panggul)

Hull beku 1.16 × 0.32 × 1.16.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | drum pinggang | silinder | Ø0.96 → Ø1.04 · t 0.3 · seg 16 | 0, 0.06, 0.02 | — | `joint` | tengah |
| 2 | cincin pinggang | cincin | R 0.5 · r 0.05 · seg 20 | 0, 0.2, 0.02 | 90° / 0° / 0° | `steel` | tengah |

*2 entri spec → 2 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.3 Dada (parent: `chest`, y = +CY 0.35 dari pinggang)

Lebar mengikuti rentang bahu BEKU (selangka ±0.88, bahu ±1.68). Reaktor arc tidak digeser.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | perut inti | kotak | 1.4 × 0.72 × 1.2 · sudut 0.04 · seg 2 | 0, 0.3, 0 | — | `sec` ×cw | tengah |
| 2 | rusuk inti | kotak | 2.1 × 1 × 1.5 · sudut 0.04 · seg 2 | 0, 1, -0.02 | — | `sec` ×cw | tengah |
| 3 | kuk bahu | kotak | 2.8 × 0.62 × 1.4 · sudut 0.04 · seg 2 | 0, 1.6, -0.04 | — | `main` ×cw | tengah |
| 4 | pelat pektoral | kotak | 1.06 × 0.72 × 0.18 · sudut 0.04 · seg 2 | 0.55, 1.12, 0.66 | -5° / 0° / 0° | `main` ×cw | kiri+kanan |
| 5 | trim pektoral | kotak | 1 × 0.07 × 0.06 · sudut 0.02 · seg 1 | 0.55, 0.78, 0.7 | — | `accent` ×cw | kiri+kanan |
| 6 | lunas sternum | kotak | 0.36 × 1.1 × 0.14 · sudut 0.04 · seg 2 | 0, 1.05, 0.66 | — | `dark` | tengah |
| 7 | pelat perut | kotak | 0.52 × 0.54 × 0.12 · sudut 0.04 · seg 2 | 0.34, 0.42, 0.58 | — | `main` ×cw | kiri+kanan |
| 8 | bezel reaktor | silinder | Ø0.5 → Ø0.55 · t 0.08 · seg 8 | 0, 1.06, 0.59 | 90° / 0° / 0° | `steel` | tengah |
| 9 | ruang reaktor | silinder | Ø0.4 → Ø0.4 · t 0.036 · seg 16 | 0, 1.06, 0.63 | 90° / 0° / 0° | `dark` | tengah |
| 10 | cincin plasma | silinder | Ø0.33 → Ø0.33 · t 0.032 · seg 16 | 0, 1.06, 0.652 | 90° / 0° / 0° | `glow` | tengah |
| 11 | kerah reaktor | cincin | R 0.185 · r 0.02 · seg 24 | 0, 1.06, 0.655 | — | `accent` | tengah |
| 12 | inti reaktor | silinder | Ø0.17 → Ø0.19 · t 0.04 · seg 16 | 0, 1.06, 0.67 | 90° / 0° / 0° | `core` | tengah |
| 13 | pelat punggung | kotak | 2 × 1.3 × 0.22 · sudut 0.04 · seg 2 | 0, 1.05, -0.72 | — | `main` ×cw | tengah |
| 14 | belikat | kotak | 0.56 × 0.66 × 0.18 · sudut 0.04 · seg 2 | 0.72, 1.3, -0.86 | — | `main` ×cw | kiri+kanan |
| 15 | trapezius | kotak | 0.92 × 0.4 × 0.8 · sudut 0.04 · seg 2 | 0.78, 1.72, -0.1 | 0° / 0° / -17° | `main` ×cw | kiri+kanan |

*15 entri spec → 20 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.4 Leher (parent: `neck`, y = 2.14 − CY, z = 0.08)

Sudah sesederhana Real Steel sejak awal → ukuran tidak diubah.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | kolom leher | silinder | Ø0.54 → Ø0.68 · t 0.5 · seg 14 | 0, 0.02, -0.04 | — | `joint` | tengah |
| 2 | gelang leher | cincin | R 0.29 · r 0.035 · seg 18 | 0, -0.1, -0.04 | 90° / 0° / 0° | `rubber` | tengah |
| 3 | batang cahaya | silinder | Ø0.08 → Ø0.08 · t 0.6 · seg 6 | 0.2, 0.1, 0.16 | — | `glow` | kiri+kanan |

*3 entri spec → 6 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.5 Kepala (parent: `head`, y = 0.36 z = 0.06, skala grup 1.04)

Daftar bagian persis rig Real Steel. Optik mata TETAP di (±0.155, −0.02, 0.43).

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | tengkorak | kotak | 0.66 × 0.66 × 0.78 · sudut 0.08 · seg 2 | 0, 0.1, -0.04 | — | `main` | tengah |
| 2 | dahi miring | kotak | 0.72 × 0.2 × 0.5 · sudut 0.05 · seg 2 | 0, 0.42, 0.08 | 29° / 0° / 0° | `main` | tengah |
| 3 | alis V | kotak | 0.36 × 0.1 × 0.16 · sudut 0.03 · seg 2 | 0.17, 0.3, 0.34 | 0° / 0° / 22° | `accent` | kiri+kanan |
| 4 | trim alis | kotak | 0.6 × 0.05 × 0.07 · sudut 0.02 · seg 1 | 0, 0.2, 0.4 | — | `steel` | tengah |
| 5 | visor gelap | kotak | 0.6 × 0.22 × 0.1 · sudut 0.03 · seg 2 | 0, 0, 0.36 | — | `dark` | tengah |
| 6 | rahang | kotak | 0.54 × 0.26 × 0.44 · sudut 0.05 · seg 2 | 0, -0.22, 0.1 | — | `joint` | tengah |
| 7 | gigi gril | kotak | 0.05 × 0.15 × 0.05 · sudut 0.02 · seg 1 | -0.2, -0.22, 0.33 | — | `accent` | tengah |
| 8 | dagu | kotak | 0.44 × 0.22 × 0.18 · sudut 0.05 · seg 2 | 0, -0.42, 0.26 | — | `main` | tengah |
| 9 | pelindung pipi | kotak | 0.12 × 0.4 × 0.5 · sudut 0.04 · seg 2 | 0.33, -0.02, 0.02 | 0° / 23° / 5° | `main` | kiri+kanan |
| 10 | piston telinga | silinder | Ø0.26 → Ø0.26 · t 0.14 · seg 16 | 0.36, 0.06, -0.04 | 0° / 0° / 90° | `steel` | kiri+kanan |
| 11 | inti telinga | silinder | Ø0.14 → Ø0.14 · t 0.18 · seg 12 | 0.4, 0.06, -0.04 | 0° / 0° / 90° | `glow` | kiri+kanan |
| 12 | sirip puncak | kotak | 0.09 × 0.28 × 0.74 · sudut 0.03 · seg 2 | 0, 0.62, -0.06 | 9° / 0° / 0° | `accent` | tengah |
| 13 | tanduk | kerucut | r 0.09 · t 0.52 · seg 8 | 0.3, 0.54, -0.08 | -40° / 0° / -32° | `accent` | kiri+kanan |
| 14 | knalpot belakang | kotak | 0.38 × 0.24 × 0.16 · sudut 0.04 · seg 2 | 0, 0.1, -0.44 | — | `joint` | tengah |
| 15 | kerah leher | kotak | 0.34 × 0.2 × 0.24 · sudut 0.05 · seg 2 | 0, -0.3, -0.12 | — | `joint` | tengah |

*15 entri spec → 24 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.6 Tulang selangka (parent: `clav`, (±0.88, 1.55, 0) di ruang dada)

Hull beku 0.70 × 0.24 × 0.44.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | tulang selangka | kotak | 0.7 × 0.24 × 0.44 · sudut 0.1 · seg 2 | 0.3, 0, 0 | — | `joint` | kiri+kanan |

*1 entri spec → 2 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.7 Pauldron (parent: `cap`, posisi = posisi bahu)

Hull beku 0.79 × 0.63 × 0.89.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | deltoid | bola | r 0.3 · seg 16×12 | 0, -0.02, 0 | — | `joint` ×th | tengah |
| 2 | pelat pauldron | kotak | 0.78 × 0.34 × 0.84 · sudut 0.07 · seg 2 | 0, 0.06, 0 | — | `main` ×th | tengah |
| 3 | bawah pauldron | kotak | 0.66 × 0.2 × 0.72 · sudut 0.06 · seg 2 | 0, -0.2, 0 | — | `sec` ×th | tengah |
| 4 | pita pauldron | kotak | 0.7 × 0.06 × 0.76 · sudut 0.02 · seg 1 | 0, 0.27, 0 | — | `accent` ×th | tengah |

*4 entri spec → 4 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.8 Lengan atas (parent: `shoulder`, tulang 1.05)

Rasio Real Steel 0.34 → dipakai 0.63 (chassis minimum, lihat §3).

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | bola bahu | bola | r 0.3 · seg 16×12 | 0, 0, 0 | — | `joint` ×th | tengah |
| 2 | tabung lengan | silinder | Ø0.66 → Ø0.56 · t 0.98 · seg 16 | 0, -0.52, 0 | — | `sec` ×th | tengah |
| 3 | pelat bisep | kotak | 0.5 × 0.58 × 0.16 · sudut 0.04 · seg 2 | 0, -0.48, 0.24 | — | `main` ×th | tengah |
| 4 | pelat trisep | kotak | 0.46 × 0.54 × 0.14 · sudut 0.04 · seg 2 | 0, -0.52, -0.24 | — | `main` ×th | tengah |
| 5 | batang piston | silinder | Ø0.16 → Ø0.16 · t 0.9 · seg 10 | 0, -0.5, -0.34 | — | `steel` ×th | tengah |
| 6 | garis lengan | kotak | 0.04 × 0.44 × 0.04 · sudut 0.02 · seg 1 | 0.26, -0.5, 0.08 | — | `glow` ×th | kiri+kanan |

*6 entri spec → 7 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.9 Lengan bawah (parent: `elbow`, y = −1.05 dari bahu; tulang 0.975)

Pergelangan di y = −0.975.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | sendi siku | bola | r 0.26 · seg 14×10 | 0, 0, 0 | — | `joint` ×th | tengah |
| 2 | cakram siku | silinder | Ø0.4 → Ø0.4 · t 0.1 · seg 12 | 0.26, 0, 0 | 0° / 0° / 90° | `steel` ×th | kiri+kanan |
| 3 | tabung lengan bawah | silinder | Ø0.58 → Ø0.5 · t 0.9 · seg 16 | 0, -0.48, 0 | — | `sec` ×th | tengah |
| 4 | bracer depan | kotak | 0.48 × 0.62 × 0.16 · sudut 0.05 · seg 2 | 0, -0.46, 0.22 | — | `main` ×th | tengah |
| 5 | bracer belakang | kotak | 0.44 × 0.56 × 0.14 · sudut 0.04 · seg 2 | 0, -0.48, -0.22 | — | `main` ×th | tengah |
| 6 | garis bracer | kotak | 0.04 × 0.46 × 0.04 · sudut 0.02 · seg 1 | 0.26, -0.46, 0.06 | — | `glow` ×th | kiri+kanan |
| 7 | kerah pergelangan | silinder | Ø0.6 → Ø0.72 · t 0.14 · seg 16 | 0, -0.87, 0 | — | `steel` ×th | tengah |

*7 entri spec → 9 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.10 Sendi pinggul (parent: `hipJ`, (±0.74, 2.85, 0))

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | drum pinggul | silinder | Ø0.48 → Ø0.48 · t 0.36 · seg 16 | 0, 0, 0 | 0° / 0° / 90° | `steel` ×lt | tengah |
| 2 | sumbu pinggul | bola | r 0.22 · seg 14×10 | 0, 0, 0 | — | `joint` ×lt | tengah |

*2 entri spec → 2 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.11 Paha (parent: grup `thigh`, skala y = L1/1.5)

Dimodelkan sepanjang 1.5 lalu diregangkan ke tulang 2.00 — cara lama dipertahankan.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | inti paha | kotak | 0.84 × 1.46 × 0.84 · sudut 0.1 · seg 2 | 0, -0.75, 0 | — | `sec` ×lt | tengah |
| 2 | pelat quad | kotak | 0.64 × 1.14 × 0.14 · sudut 0.05 · seg 2 | 0, -0.7, 0.42 | — | `main` ×lt | tengah |
| 3 | pelat hamstring | kotak | 0.6 × 1.06 × 0.14 · sudut 0.05 · seg 2 | 0, -0.74, -0.42 | — | `main` ×lt | tengah |
| 4 | pita pinggul | kotak | 0.88 × 0.1 × 0.88 · sudut 0.03 · seg 1 | 0, -0.16, 0 | — | `accent` ×lt | tengah |

*4 entri spec → 4 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.12 Lutut (parent: `kneeJ`, y = −L1)

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | gandar lutut | silinder | Ø0.48 → Ø0.48 · t 0.86 · seg 16 | 0, 0, 0 | 0° / 0° / 90° | `steel` ×lt | tengah |
| 2 | pelat belakang lutut | kotak | 0.58 × 0.42 × 0.16 · sudut 0.04 · seg 2 | 0, -0.02, -0.24 | — | `main` ×lt | tengah |

*2 entri spec → 2 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.13 Tempurung lutut (parent: `kneeCaps`, z = 0.28 × lt; dianimasikan robot.ts)

Jangkauan depan dijaga 0.62 dari lutut (probe lantai duduk di situ).

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | pelat tempurung | kotak | 0.54 × 0.64 × 0.36 · sudut 0.08 · seg 2 | 0, 0, 0.17 | — | `main` ×lt | tengah |
| 2 | inti tempurung | kotak | 0.16 × 0.2 × 0.06 · sudut 0.02 · seg 1 | 0, 0.02, 0.36 | — | `glow` ×lt | tengah |

*2 entri spec → 2 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.14 Betis (parent: grup `shin`, skala y = L2/1.42)

Dimodelkan sepanjang 1.42 lalu diregangkan ke tulang 1.92.

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | inti betis | kotak | 0.64 × 1.38 × 0.66 · sudut 0.09 · seg 2 | 0, -0.7, 0 | — | `sec` ×lt | tengah |
| 2 | pelat greave | kotak | 0.5 × 1.06 × 0.12 · sudut 0.04 · seg 2 | 0, -0.62, 0.34 | — | `main` ×lt | tengah |
| 3 | pelat betis belakang | kotak | 0.46 × 0.76 × 0.12 · sudut 0.04 · seg 2 | 0, -0.5, -0.32 | — | `main` ×lt | tengah |
| 4 | garis betis | kotak | 0.05 × 0.66 × 0.04 · sudut 0.02 · seg 1 | 0, -0.6, 0.41 | — | `glow` ×lt | tengah |
| 5 | kerah mata kaki | kotak | 0.66 × 0.2 × 0.7 · sudut 0.05 · seg 2 | 0, -1.32, 0.02 | — | `main` ×lt | tengah |

*5 entri spec → 5 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

#### 4.15 Boot (parent: `footJ`, y = −L2)

JEJAK BEKU: sol −0.21, ujung jari +1.24, tumit −0.62 (dipakai IK kaki & test:feet §9).

| # | Bagian | Primitif | Ukuran (unit = m) | Posisi x,y,z | Rotasi x/y/z | Material | Sisi |
|---|--------|----------|-----------------|--------------|--------------|----------|------|
| 1 | rumah mata kaki | kotak | 0.5 × 0.3 × 0.46 · sudut 0.08 · seg 2 | 0, -0.02, 0.06 | — | `dark` ×lt | tengah |
| 2 | gandar mata kaki | silinder | Ø0.38 → Ø0.38 · t 0.5 · seg 14 | 0, 0.06, 0 | 0° / 0° / 90° | `steel` ×lt | tengah |
| 3 | sol | kotak | 0.8 × 0.07 × 1.84 · sudut 0.03 · seg 1 | 0, -0.175, 0.32 | — | `rubber` | tengah |
| 4 | dek boot | kotak | 0.78 × 0.3 × 1.4 · sudut 0.06 · seg 2 | 0, 0.02, 0.22 | — | `main` ×lt | tengah |
| 5 | kerah boot | kotak | 0.7 × 0.2 × 0.6 · sudut 0.05 · seg 2 | 0, 0.16, -0.12 | — | `main` ×lt | tengah |
| 6 | ujung jari | kotak | 0.7 × 0.16 × 0.34 · sudut 0.05 · seg 2 | 0, -0.05, 1.02 | — | `main` ×lt | tengah |
| 7 | taji tumit | kotak | 0.3 × 0.12 × 0.18 · sudut 0.04 · seg 1 | 0, 0, -0.51 | — | `steel` | tengah |

*7 entri spec → 7 bagian di dunia (yang `kiri+kanan` dibangun dua kali).*

<!-- ==== akhir tabel yang dihasilkan ==== -->

---

## 5. Yang dibekukan — dan buktinya

Tidak ada satu pun angka ini yang berubah. `npm run test:size §C` memeriksa semuanya setiap kali dijalankan
(semua Δ = 0.00000):

**Pivot tulang** (diukur relatif parent-nya):

| Joint | Posisi | Δ setelah rombak |
|---|---|---|
| pinggul `hipJ` | (±0.740, 2.850, 0) | 0.00000 |
| lutut `kneeJ` | (0, −2.000, 0) | 0.00000 |
| mata kaki `footJ` | (0, −1.920, 0) | 0.00000 |
| pinggang `waist` | (0, 3.450, 0) | 0.00000 |
| dada `chest` | (0, 0.350, 0) | 0.00000 |
| leher `neck` | (0, 1.790, 0.080) | 0.00000 |
| kepala `head` | (0, 0.360, 0.060) · skala 1.04 | 0.00000 |
| selangka `clav` | (±0.880, 1.550, 0) | 0.00000 |
| bahu `shoulder` | (±0.800, −0.320, 0) | 0.00000 |
| siku `elbow` | (0, −1.050, 0) | 0.00000 |
| pergelangan `wrist` | (0, −0.975, 0) | 0.00000 |
| tempurung `kneeCap` | (0, 0, 0.230) | 0.00000 |

**Angka sistem lain yang tidak disentuh:**

| Angka | Nilai | Siapa yang memakainya |
|---|---|---|
| `SOLE` / `TOE_Z` / `HEEL_Z` | 0.21 / 1.24 / 0.62 | IK kaki, `ankleLift()`, `test:feet §9` — terukur: sol −0.210, jari +1.240, tumit −0.600 |
| hull sarung tinju | 1.06 × 1.18 × 1.01 | `test:clash` (mengukur jarak permukaan mesh nyata) — selisih 0.1% |
| optik mata | (±0.155, −0.020, 0.430) | iris, pupil, scan bar, flare, lock-on ring, streak, `eyeLights` — semua masih 2× terpasang |
| reaktor arc | 5 lapis di (0, 1.06, 0.59…0.67) | identitas ATLAS + anchor FX |
| probe lantai | tidak diubah satu titik pun | `groundSolve()` → jatuh, bangkit, `test:pose` |
| `BODY_R` | 0.9 | batas tali ring di `Game.ts` (konservatif: badan baru lebih ramping, jadi tetap aman) |
| `MOVES` reach/hitY | jab 4.4 / hitY 4.5, dst | deteksi pukulan memang analitik (bukan mesh) → tidak terpengaruh bentuk |
| skin & Zeus | `helmetSkin 1..9`, `armorSkin 1..11`, `gloveSkin 1..11`, Zeus 100% | semua tetap ada; lihat §8 |

---

## 6. Hasilnya

| Ukuran | ATLAS lama | **Simple Real Steel** | Perubahan |
|---|---|---|---|
| Segitiga | 141.640 | **50.056** | **−64,7%** |
| Vertex | 423.626 | **148.874** | **−64,9%** |
| Mesh (draw call badan) | 133 | **107** | **−19,5%** |
| Bagian badan | ~600 primitif ukir | **147 primitif datar** | — |
| Tinggi berdiri | 7.55 m | **7.59 m** | +0,5% (dalam toleransi) |

Hull tiap segmen (terukur, `test:size §A` — semua dalam toleransi ±22% lebar / ±12% tinggi / ±34% dalam):

| Segmen | ATLAS | Simple | Selisih (l/t/d) |
|---|---|---|---|
| pinggul | 1.60 × 0.91 × 0.99 | 1.62 × 0.85 × 0.98 | +1,3% / −7,1% / −1,0% |
| pinggang | 1.16 × 0.32 × 1.16 | 1.10 × 0.34 × 1.10 | −5,2% / +6,3% / −5,2% |
| dada | 2.92 × 2.10 × 1.83 | 2.80 × 2.10 × 1.73 | −4,1% / −0,2% / −5,7% |
| leher | 0.67 × 0.63 × 0.68 | 0.66 × 0.63 × 0.68 | −1,1% / 0% / 0% |
| kepala | 0.93 × 1.30 × 0.96 | 0.98 × 1.34 × 0.97 | +5,4% / +3,0% / +0,8% |
| selangka | 0.70 × 0.24 × 0.44 | 0.70 × 0.24 × 0.44 | 0% |
| pauldron | 0.79 × 0.63 × 0.89 | 0.78 × 0.60 × 0.84 | −1,3% / −4,8% / −5,6% |
| lengan atas | 0.78 × 1.42 × 0.87 | 0.66 × 1.31 × 0.75 | −15,4% / −7,7% / −13,8% |
| lengan bawah | 0.70 × 1.34 × 0.71 | 0.72 × 1.20 × 0.72 | +2,9% / −10,4% / +1,4% |
| sarung tinju | 1.06 × 1.18 × 1.01 | 1.06 × 1.18 × 1.01 | ~0% (beku) |
| sendi pinggul | 0.44 × 0.50 × 0.51 | 0.44 × 0.48 × 0.48 | 0% / −4,0% / −5,9% |
| paha | 0.93 × 1.56 × 0.98 | 0.88 × 1.46 × 0.98 | −5,4% / −6,4% / 0% |
| lutut | 0.90 × 0.49 × 0.59 | 0.86 × 0.48 × 0.56 | −4,4% / −2,0% / −5,1% |
| tempurung | 0.58 × 0.70 × 0.76 | 0.54 × 0.64 × 0.40 | −6,9% / −8,6% / (dikecualikan, §3.2) |
| betis | 0.70 × 1.44 × 0.81 | 0.66 × 1.41 × 0.81 | −5,7% / −2,1% / 0% |
| boot | 0.86 × 0.46 × 1.88 | 0.80 × 0.47 × 1.84 | −7,0% / +2,2% / −2,1% |

**Bahasa bentuknya sekarang sama dengan Real Steel:** pelat datar berpaku pada volume inti, sendi terbuka
(gandar silinder di pinggul/lutut/mata kaki/siku, bola di bahu), garis cahaya tunggal per segmen, dan kepala
"marah" (alis V, visor cekung, rahang gril, tanduk menyapu, sirip puncak, piston telinga, knalpot belakang).

---

## 7. Konfigurasi animasi: angka yang sekarang bisa dipakai

### 7.1 Anchor tinggi (stance tinju, terukur — `test:size §E`)

| Titik | Dunia (m) | Lokal (unit) |
|---|---|---|
| sol boot (lantai) | 0.03 | 0.03 |
| mata kaki | 0.24 | 0.25 |
| lutut | 2.00 | 2.12 |
| pinggul (`hipJ`) | 3.67 | 3.91 |
| panggul (`pelvis`) | 1.00 | 1.06 |
| pinggang | 4.24 | 4.51 |
| dada | 4.57 | 4.86 |
| **reaktor arc** (target body shot) | **5.56** | 5.92 |
| leher | 6.22 | 6.61 |
| kepala (pivot) | 6.54 | 6.96 |
| puncak kepala | 7.39 | 7.86 |
| bahu | 5.71 | 6.07 |
| siku | 4.74 | 5.04 |
| pergelangan | 4.26 | 4.53 |
| **pusat tinju kiri / kanan** (guard) | **3.97 / 3.97** | 4.23 / 4.22 |

Turunan yang berguna untuk pose & kamera:

| Besaran | Nilai |
|---|---|
| jarak kedua tinju saat guard | **3.00 m** |
| tinju kiri → tengah dada | 2.07 m |
| tinju kiri → titik paling depan | z 2.14 m (tebal sarung 1.44 m) |
| tinggi berdiri di stance | 7.36 m |
| `MOVES.hitY` vs geometri nyata | `hitY` (4.1–4.8) dipakai `aimY()` untuk menaruh FX **ayunan** (air-cut ×0.7 & swing streak) di ketinggian kepalan yang melintas. Terukur: kepalan guard 3.97 m → streak kepala 4.5 m sudah 0.53 m di atasnya (masuk akal). Tapi untuk *kontak* di wajah angka itu kurang ~1.6 m: dagu ada di ≈6.1 m, pivot kepala 6.54 m. **Tidak saya ubah** (keputusan: angka gameplay beku) — ini angka yang perlu dipakai kalau nanti FX kontak mau dipasang di kepala sungguhan |
| target *body shot* yang benar | reaktor arc **5.56 m** (dunia) / 5.92 unit — bukan `hitY − AIM_DROP` (3.35 m = pertengahan paha) |

### 7.2 Memindahkan keyframe dari Real Steel Simulator ke Steel Titans

Rig sim memakai **meter manusia**; game memakai **unit robot**. Jangan pakai satu faktor seragam — pakai
`K_SEG` per segmen (§3.1):

```
jarak_game(segmen) = jarak_sim(segmen) × K_SEG(segmen)
sudut/rotasi       = SAMA (tidak diskalakan)
waktu/durasi       = SAMA (tidak diskalakan)
```

Contoh nyata: sebuah cross di sim menempelkan tinju 0.55 m dari dagu ke kontak → di game
0.55 × 3.75 = **2.06 m**. Langkah kaki 0.30 m di sim → 0.30 × 4.55 = **1.37 m** di game (langkah
`MOVES.step` yang dipakai sekarang: jab 1.35, cross 1.90 — cocok dengan faktor kaki, bukan faktor tinggi).

### 7.3 Peta joint sim → game

| Real Steel Simulator (`JOINTS`) | Steel Titans (`Robot`) | Catatan |
|---|---|---|
| `pelvis` | `pelvis` | sama |
| `waist` + `spine` | `waist` | **2 joint sim = 1 joint game** → bagi rotasi waist sim ke `waist` + `twist` |
| `chest` | `chest` | sama |
| `neck` | `neck` | sama |
| `head` | `head` | sama (grup diskalakan 1.04) |
| `clavL/R` | `clavs[0/1]` | sama (0 = kiri robot, +x) |
| — | `caps[0/1]` | pauldron: **tidak ada di sim**; ikut rotasi bahu ×0.38/0.36 (lihat `robot.ts`) |
| `shoulderL/R` | `shoulders[0/1]` | sama |
| `elbowL/R` | `elbows[0/1]` | sama |
| `wristL/R` | `wrists[0/1]` → `fists[0/1]` | mesh sarung ada di `fists`, bukan di `wrists` |
| `hipL/R` | `hipJ[0/1]` | sama |
| `kneeL/R` | `kneeJ[0/1]` (+ `kneeCaps[0/1]`) | tempurung dianimasikan otomatis: `rotation.x = −fleksi × 0.4` |
| `ankleL/R` | `footJ[0/1]` | sama; **tanpa jari terpisah** (boot simple = 7 bagian) |
| — | `faulds[0/1]` | opsional, saat ini kosong |

### 7.4 Aturan praktis untuk animator

1. **Rotasi tidak pernah diskalakan** — hanya jarak/posisi. Jadi pose dari sim bisa dipakai apa adanya,
   yang harus dikalikan hanya `position`/`lunge`/`step`.
2. **Grup paha & betis diskalakan otomatis** (`sy1 = L1/1.5`, `sy2 = L2/1.42`): bagian dimodelkan pada
   panjang 1.50 / 1.42 lalu diregangkan ke tulang sebenarnya. Kalau menambah bagian baru di paha/betis,
   tulis ukurannya dalam **ruang model**, bukan ruang dunia.
3. **Jangan pindahkan titik kontak sarung**: hull tinju beku (§3.2 pengecualian 2) karena `test:clash`
   mengukurnya. Bentuk sarung boleh diganti, volumenya tidak.
4. **Sol boot harus tetap di −0.21** dari mata kaki. Kalau tidak, `test:feet §9` ("setiap vertex boot
   menyentuh kanvas") langsung merah.
5. Bagian baru cukup **satu baris data** di `bodySpec.ts` → otomatis ikut hull-check, ikut dokumen
   (`npm run doc:spec`), ikut varian brute (lewat `f: 'th'|'lt'|'cw'`).

---

## 8. Skin, Zeus 100%, dan cara kembali

| Konten | Status |
|---|---|
| Chassis bawaan (helmetSkin 0, armorSkin 0, gloveSkin 0) | **simple Real Steel** (desain ini) |
| `helmetSkin 1..9` (Zeus Sovereign, Noisy Boy Shogun, …) | tetap helm detail lama — dibangun di atas pivot kepala yang sama |
| `armorSkin 1..11` | palet + detail pauldron/dada lama; skin 10 & 11 tetap memasang *body kit* (pita emas/spoiler) di paha, betis, lengan — itulah kenapa paha/betis dijaga di §3.2 |
| `gloveSkin 1..11` | tetap (sarung memang sudah sederhana) |
| **Zeus Real Steel 100%** (`isZeus100`) | **tidak disentuh**: 208 bagian Zeus tetap dipasang di joint yang sama, dan karena chassis simple lebih ringan, mount Zeus jadi lebih murah |
| Badan ATLAS lama | utuh di `build.ts`; set `CHASSIS = 'atlas'` di `bodySpec.ts` untuk membandingkan keduanya |

Catatan desain: dengan chassis simple, *armor skin* sekarang benar-benar terbaca sebagai **armor yang
dibautkan ke chassis**, bukan sebagai badan lain yang menggantikan — karena chassis-nya selalu sama.

---

## 9. Verifikasi

```bash
npm run test:size     # §A hull · §B kesederhanaan · §C angka beku · §D mapping · §E anchor animasi
npm run probe:hull    # cetak hull per segmen chassis yang aktif (+ tinggi berdiri & jangkauan tempurung)
npm run doc:spec      # cetak ulang tabel §4 dokumen ini
node runtests.mjs     # seluruh suite
npm run dev           # lihat robotnya (preview)
```

`hullprobe.mjs` adalah alat ukurnya: dengan `CHASSIS = 'atlas'` di `bodySpec.ts` ia mencetak kolom ATLAS
di §5–§6, dengan `CHASSIS = 'simple'` ia mencetak kolom SIMPLE. Jadi angka di dokumen ini bukan perkiraan
— semuanya keluaran alat itu (FX/aditif/light dikecualikan, sama seperti `sizetest.mjs`).

Status suite setelah rombakan:

| Harness | Sebelum | Sesudah |
|---|---|---|
| `test:size` | (belum ada) | **PASS** |
| `test:feet` · `test:pose` · `test:cam` · `test:crowd` · `test:zeus` · `test:balance` · `test:star` · `test:combo` · `test:spring`/`swing` · `test:ali` · `test:panjer` | PASS | **PASS** |
| `test:strike` | 2 FAIL | 2 FAIL — **keluaran identik karakter per karakter** |
| `test:clash` | 4 FAIL | 4 FAIL — **keluaran identik karakter per karakter** |

`test:strike` dan `test:clash` **sudah merah sebelum desain ini** (lihat komentar di `runtests.mjs`:
*"the strike checks are currently red"*). `diff` keluaran sebelum/sesudah hanya berbeda di baris ukuran
bundle esbuild — setiap baris assertion sama persis, jadi rombakan bentuk ini tidak menggeser apa pun.

---

## 10. Kalau nanti mau proporsi Real Steel yang sebenarnya

Desain ini mempertahankan tinggi 7.55 m karena skeleton dibekukan. Kalau suatu saat mau robot seukuran
manusia/Real Steel sungguhan (Zeus 8'6" = **2.59 m / 575 kg**, Atom 4'6" = **1.37 m**), yang harus ikut
di-retune: `L1/L2/HIP_Y/UP/CY` · `SOLE/TOE_Z/HEEL_Z` · `STAND_Y/RUN_HIP_LOW` · `BODY_R` · `MOVES.reach/step/hitY`
· `RING_IN` & tinggi tali (2.0/3.6/5.2 m) · seluruh preset kamera (`CAM_MODES`) · probe lantai ·
harness `test:feet/pose/clash/balance/star`. Jalur itu sengaja **tidak** diambil sekarang.
