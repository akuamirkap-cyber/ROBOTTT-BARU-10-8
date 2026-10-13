# ⭐ STAR MODE — konsep, kamera & sistemnya

Mode baru di lobby (kartu **STAR MODE ⭐ · Boxing Star Style**) yang bikin game ini senyaman game boxing mobile,
**tanpa satu pun tombol baru**. Kamu pakai tombol yang sudah ada: `W A S D` `H` `J` `K` `X` `P` `L` `SPACE` `G` `E` `U` `R` `Q` `Z`.

---

## 1. Konsepnya: satu otak di belakang, satu sistem di depan

Masalah game ini kalau dimainkan cepat: **kaki**. Semua pukulan punya jarak (`reach` 4.4 m untuk jab), jadi pemain
selalu sibuk mengatur jarak, bukan membaca lawan. Di Boxing Star, kaki itu urusan sistem — kamu hanya menebak:
*pukul* atau *hindar*.

Jadi STAR MODE = **satu flag** (`Game.setStarMode(true)`) yang menyalakan:

| # | Sistem | Apa yang dikerjakan | Tombol baru? |
|---|--------|---------------------|--------------|
| 1 | **AUTO-RANGE** | Kalau kamu tidak menekan arah, kaki berjalan sendiri ke jarak pukul (3,25 m) dengan kecepatan *shuffle* 72 % jalan normal, dan tidak goyang kalau sudah di posisi (±0,42 m) | ❌ tidak — arah tetap bisa dipegang kapan saja untuk menimpa |
| 2 | **AUTO-GUARD** | Diam = guard naik otomatis (regen tenaga 22/s) — **tapi versi lemah**: chip 22 % vs 10 % kalau kamu tahan `G` | ❌ tidak — `G` tetap guard kuat pilihanmu |
| 3 | **RANGE ASSIST** | Pukulan yang sudah dimulai kakinya ikut melangkah: jangkauan ×1,18 | ❌ tidak |
| 4 | **SMART SLIP** | `SPACE` tanpa arah sudah memilih hindaran sendiri (lawan memakai tangan mana, mana yang tidak mendekat ke tali). Hindaran PAS dapat jeda lambat sinematik 0,18 s | ❌ tidak — arah `SPACE` masih bisa dipaksa manual |
| 5 | **PUNCH BUFFER** | Tap saat pukulan masih jalan disimpan 0,5 s (biasanya 0,34 s) lalu lepas sendiri saat legal → kombo tidak pernah "hilang" | ❌ tidak |
| 6 | **FINISHER ASSIST** | Meter Overdrive penuh + lawan terbuka (stagger / sedang ancang-ancang / terjatuh) = `R` melepas sendiri. Tenaga tidak dikosongkan | ❌ tidak — `R` manual tetap bisa kapan pun |

**Semuanya hanya untuk pemain.** AI tetap pakai otaknya sendiri, dan mode lain (PLAY MATCH, RANK, TOURNAMENT,
TEAM MATCH, LAWAN ATLAS) **bit-per-bit sama** seperti sebelum mode ini ada — sudah dijaga oleh harness `test:star` §6
dan `test:balance` yang tetap ALL PASS.

---

## 2. Kameranya: **STAR** (preset ke-6, di belakang pundakmu)

Lensa baru di daftar kamera (`CAM_MODES`), persis resep "over the shoulder" game boxing mobile:

| Setelan | Nilai | Alasan |
|---|---|---|
| `fov` | **52** | lensa agak panjang: dua robot terasa besar & berat, bukan mainan lebar |
| `dist` / `minDist` | **4,1 m / 3,4 m** | nempel, tapi tidak pernah masuk ke dalam badan robot |
| `shoulderBack` / `shoulderLat` | **2,0 / 3,45** | kamera di belakang-kiri kamu (bukan 2,4/2,8 milik PUNDAK biasa) → kamu melihat *lewat* pundakmu, bukan dari samping |
| `height` | **4,5 m** | mata dada, bukan mata burung — lawan tampak "di depan wajah" |
| `margin` / `closeBias` | **1,06 / 0,22** | saat mereka masuk jarak, kamera *mendekat* — ketegangan naik sendiri |
| `hand` / `lead` | **0,6 / 0,16** | goyangan tangan kuat + sedikit lead ke arah aksi (rekaman, bukan robot kamera) |
| `ignoreSelf` | **true** | kamu boleh terpotong frame; lawan selalu di tengah, tidak pernah ketutupan badanmu |
| `koScale` | **1,12** | orbit KO sedikit lebih lebar — momen finisher terasa lega |

Preset ini **tidak dipakai** oleh mode lain, jadi tidak ada mode lama yang kameranya berubah.

### Hand-back kamera
- Masuk STAR MODE → kamera pindah ke STAR, dan preset lamamu **diingat**.
- Keluar STAR MODE (balik ke lobby, atau pindah mode) → kamera **kembali sendiri** ke preset lamamu.
- Kalau di tengah STAR MODE kamu ganti lensa manual (bilah kamera), pilihanmu dihormati — yang dipulihkan hanyalah
  preset saat kamu pertama masuk.

---

## 3. Sistem ekonominya: nyaman ≠ auto-pilot

Prinsip desainnya: **bantuan menghilangkan kerja teknis (kaki, timing window, guard dasar), bukan menghilangkan
keputusan.** Karena itu tiap bantuan punya harga:

- **AUTO-GUARD itu guard lemah.** Diamond saja = kena 22 % damage. Kalau kamu benar-benar mau bertahan, tahan `G`:
  10 % damage + regen 9/s. Jadi "diam saja" bukan strategi terbaik — sama seperti mode lain.
- **AUTO-RANGE hanya jalan kalau kamu tidak menekan arah.** Begitu kamu pegang `W/A/S/D`, kaki 100 % milikmu
  (harga penuh mobilitas tidak dikurangi). AI juga tetap bisa memotong jarak itu.
- **Hindaran tetap hindaran.** `SPACE` tetap memakan tenaga (tabel `DODGE_CFG` yang sudah di-balance), hindaran telat
  tetap kena hajar, dan *PERFECT slip* tetap lebih menguntungkan daripada hop biasa — cuma sekarang sudut lambatnya
  dipakai untuk satu beat sinematik.
- **Pukulan tetap punya komitmen.** *Whiff* tetap bikin badan keburu jalan, dan Overdrive assist menunggu lawan
  benar-benar terbuka (kalau tidak, meternya tidak dibuang sia-sia).

Ringkasnya: pemain baru bisa "hidup" di dalam mode ini dengan 4 tombol (`H J K X`) + `SPACE`, sementara pemain lama
yang mau menahan `G`, mengatur kaki sendiri, dan melepas `R` manual tetap dapat hasil yang lebih tinggi.

---

## 4. Sebagai mode lobby

- Kartu: **STAR MODE** — *Boxing Star Style · Auto-Range* · ikon ⭐ `#ffd34a`.
- Format: **satu bout, Best of 3 ronde**, lawan bebas kamu pilih (mode nyaman, bukan tangga peringkat).
- Hadiah: **+100 XP · +110 Pts** (tanpa Rank Points — RP tetap milik RANK MODE).
- Matchmaking dipercepat (search 1,2 s lalu langsung reveal).
- HUD: badge `⭐ STAR MODE · AUTO-RANGE` + indikator `GUARD OTOMATIS / MANUAL (G)` supaya kamu selalu tahu guard
  mana yang sedang aktif.
- Panduan (`PANDUAN`, panel utama) dapat 2 baris bintang yang menjelaskan sistem ini dengan tombol yang sama.

---

## 5. Bukti / cara mengujinya

```bash
npx tsc --noEmit     # bersih
npm run test:star    # 6 seksi: tombol, kamera, auto-range, auto-guard, angka kenyamanan, mode lobby → ALL PASS
npm test             # feet/pose/cam/crowd/zeus/balance/star PASS
npm run build        # ✓
```

`startest.mjs` sengaja mengunci janji-janji mode ini, termasuk yang paling penting: **tidak ada tombol baru**
(§1) dan **guard otomatis harus lebih lemah dari guard tahan `G`** (§4) — supaya bantuan ini tidak pernah berubah
menjadi cheat di pemutakhiran berikutnya.
