# 💪 PANJER — tahan tombol pukulannya, lepas, hajar 2×

> **PANJER**: *tombol pukulan ditahan lebih dari 1 detik, lalu dilepas.* Pukulan yang keluar = **2× lebih kuat** dan
> **hajarnya 2× lebih jauh**. Di bawah 1 detik? Pukulan biasa, persis seperti sebelumnya.

Berlaku untuk empat pukulan dasar: **H** (jab) · **J / C** (hook) · **K / V** (uppercut) · **X** (straight).
Kerja di semua mode, dan lawan bisa melakukannya juga ke kamu.

---

## 1. Aturannya

| Tombol ditahan | Yang keluar saat dilepas | Damage | Hajar (knockback) |
|---|---|---|---|
| **< 1 detik** (tap biasa) | pukulan normal — sama persis seperti dulu | **×1** | **×1** |
| **≥ 1 detik** | **PANJER** | **×2** | **×2** |

Angka nyatanya, pakai buku jurus yang sudah ada:

| Pukulan | Normal | **PANJER** |
|---|---|---|
| JAB (H) | 7 dmg · hajar 4 | **14 dmg · hajar 8** |
| STRAIGHT (X) | 11 dmg · hajar 6 | **22 dmg · hajar 12** |
| HOOK (J/C) | 13 dmg · hajar 7 | **26 dmg · hajar 14** |
| UPPERCUT (K/V) | 15 dmg · hajar 8 | **30 dmg · hajar 16** |

Batasnya **tepat 1,00 detik** — 0,99 detik masih pukulan biasa, 1,00 detik sudah PANJER. Dan waktunya dihitung pakai
**jam**, bukan hitungan frame, jadi tombol yang kamu tahan 1,01 detik tetap dihitung 1,01 detik.

Hajar 2× berlaku untuk **dua-duanya**: dorongan saat lawan tetap berdiri, **dan** lemparan saat lawan sampai
terpental-jatuh (plafon jarak lemparnya ikut dibuka 2× — kalau tidak, "2×" cuma jadi angka di layar).

## 2. Apa yang kamu bayar

Satu detik berdiri dengan **tangan ditarik ke belakang**. Dan itu kelihatan:

- tangan pukulnya mundur ke **pose ancang-ancang pukulan itu sendiri** (bukan pose karangan baru) dan makin dalam
  sepanjang detiknya;
- ada **getaran menahan** di bahu yang makin kuat, bahu berputar menjauh dari lawan, dan panggul turun;
- tubihnya **menyala** makin terang, dan begitu load-nya penuh ada **percikan api di kepalan** + suara;
- di HUD ada **bar PANJER** dan tulisan `TAHAN TOMBOLNYA… x%` → `SIAP — LEPAS TOMBOLNYA! 2× PUKULAN`.

Jadi lawan bisa melihat kamu sedang mengisi pukulan — dan jawabannya sederhana: **jangan ada di situ**, atau
**pukul duluan**. Kalau kamu kena pukul / terpental / jatuh / angkat guard / bel / pause / window-nya kehilangan
fokus: **load-nya hangus**, bukan tersimpan.

## 3. Yang berubah di inputnya (jujur)

Empat tombol pukulan itu sekarang **tidak memukul saat ditekan** — mereka **memuat** saat ditahan, dan pukulannya
keluar **saat tombol dilepas**:

```
DULU : H ditekan ──────────────► pukulan keluar seketika
SEKARANG : H ditekan ─── [memuat] ─── H dilepas ─► pukulan keluar
```

Tap cepat tetap keluar pukulan biasa (delay-nya sepanjang jari kamu sendiri menekan tombol, ±0,1 detik), dan
sistem antrian lama tetap jalan: kalau kamu melepas tombol saat pukulan sebelumnya masih diputar, pukulan itu
masuk antrian dan keluar di jendela cancel seperti biasa.

Yang **sengaja tidak ikut berubah**, karena memang harus instan:

| Tombol | Kenapa tetap seperti dulu |
|---|---|
| **L** (COUNTER) | dia jawaban buat pukulan yang **sudah melayang** — mustahil kalau harus ditahan 1 detik dulu |
| **P** (GRAB/banting) | itu bantingan, bukan pukulan |
| **N** (kombo otomatis) & **R** (Overdrive) | keduanya skrip, bukan pukulan yang kamu ayun sendiri |
| **SPACE / G / WASD** | dodge, blok, dan jalan: tidak tersentuh |

Dan load **tidak bisa menumpang** ke jurus: melepas pukulan lalu Overdrive-nya keluar duluan (misalnya dari bantuan
STAR MODE) tidak bikin Overdrive jadi 2× — load-nya yang diambil alih, bukan diwariskan.

## 4. Lawan (AI) juga bisa

Supaya ini seimbang dan bukan cuma kartu milikmu: lawan **memuat pukulan dengan aturan yang sama** — 1 detik, 2×,
dan tell yang sama. Bedanya dia kasih tahu lewat layarmu:

- `⚠️ PANJER MUSUH!` muncul saat load-nya penuh;
- dia hanya berani kalau tenaganya masih banyak (>40), dan jarang (≈0,3–0,85 kali/detik peluang, plus jeda 7–13 detik
  setelah satu) — pukulan yang di-load harus tetap jadi peristiwa yang bisa kamu baca, bukan ritme yang menggilas;
- makin tinggi level (dan makin loyo kamu), makin sering dia coba;
- **tidak ada angka AI khusus**: 2×-nya angka yang sama (`PANJER_DMG` / `PANJER_KNOCK`).

## 5. Yang TIDAK diubah

Sesuai permintaan: **cuma damage dan hajar**. Jadi sengaja tidak diubah:

- **stun / poise / kesempatan jatuh** — sama seperti pukulan biasa (kekuatan pembacaan gim ini tidak dilipatgandakan
  diam-diam);
- **tell, reach, durasi, cancel window** setiap pukulan — tidak disentuh;
- **economy dodge** dan **buku jurus** — sama persis;
- **stamina**: biaya pukulan tetap biaya normal;
- pukulan yang di-load **tidak jadi unblockable** — tetap bisa diblok, dihindari, dan di-counter seperti biasa.

## 6. Verifikasi

```bash
npm run test:panjer   # 7 seksi: aturan · tombol · tell · bayaran · komitmen · AI · "yang lain tidak bergerak" → ALL PASS
npm test              # feet/pose/cam/crowd/zeus/balance/star/combo/swing/ali/panjer PASS
npx tsc --noEmit      # bersih
npm run build         # ✓ 1.772,78 kB / gzip 497,56 kB
```

Yang dikunci harness-nya: **tepat di 1,00 detik** batasnya (`panjerShot(0.999)` = pukulan biasa, `panjerShot(1.0)` =
2×), waktu load pakai jam bukan frame, enam tombol pukulan benar-benar melepas `tryAttack` dari jalur `press`,
pukulan keluar dari jalur `release`, counter (L) tetap instan, tell-nya lengkap (pose + getaran + glow + percikan +
bar HUD), damage ×2 dan hajar ×2 di **kedua** jalur (lemparan & dorongan) dengan plafonnya ikut dibuka, load mati
oleh pukulan/guard/jatuh/bel/pause/blur, kombo-N menghabiskan load, auto-guard STAR MODE minggir saat ada load, dan
AI memakai aturan + angka yang sama dengan peluang yang dibatasi.
