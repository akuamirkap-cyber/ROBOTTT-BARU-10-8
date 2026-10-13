# 💪 PANJER — dua cara pakai: **SHIFT** (otomatis) atau **tahan tombolnya** (manual)

> **Males nahan tombol?** Tekan **SHIFT** sekali → **PANJER OTOMATIS**: setiap pukulan (H/J/K/X) langsung
> **mentok maks** — **×2 damage & ×2 hajar** — dan keluar **seketika saat tombol ditekan**, kecepatan normal.
>
> **Mau atur sendiri?** Mode otomatisnya mati → **tahan** tombol pukulannya lalu **lepas**: sekelibat = pukulan
> biasa, makin lama ditahan makin kuat, sampai ×2 di 1 detik.

Berlaku untuk empat pukulan dasar: **H** (jab) · **J / C** (hook) · **K / V** (uppercut) · **X** (straight).
Kerja di semua mode, dan lawan bisa melakukannya juga ke kamu (dengan aturan yang sama).

---

## 0. PANJER OTOMATIS — tekan SHIFT

| | **PANJER OTOMATIS (SHIFT)** | **PANJER MANUAL (tahan)** |
|---|---|---|
| Cara pakai | tekan **SHIFT** sekali, lalu pukul seperti biasa | tahan tombol pukulannya, lepaskan |
| Kecepatan pukulan | **normal** — keluar saat tombol **ditekan** | sepanjang tahanan (0,4–1 detik) |
| Kekuatan | **mentok ×2** selalu | ×1 → ×2 sesuai lama tahanan |
| Ancang-ancang | tidak ada (pukulan langsung) | kelihatan jelas (tangan ditarik + menyala) |
| Kelebihan | cepat + maks, tidak perlu ditahan | bisa pilih kekuatan (×1,3 · ×1,5 · ×1,7 · ×2) |

- **SHIFT** bisa ditekan di mana saja: di lobby, saat jalan ke ring, di tarung, maupun saat jeda. Tekan lagi = mati.
- Ingatannya disimpan, jadi sekali dinyalakan dia tetap nyala besok-besok (sampai kamu matikan).
- **Kepalanmu menyala terus** selama mode ini hidup — itu pengganti ancang-ancangnya: lawan tetap bisa melihat
  bahwa tiap pukulanmu penuh. Ada juga badge **💪 PANJER OTOMATIS · ×2 MAKS** di HUD (di HP badge itu bisa ditap
  untuk nyala/mati).
- Selama mode ini hidup, bar pengisian manual tidak muncul (memang tidak ada yang diisi).
- ⚠️ **SPRINT pindah ke F** (dan tap-2× W lalu tahan). Satu tombol tidak bisa merangkap "lari" dan "semua pukulan
  mentok maks". Tombol RUN di HP tetap sama (F).
- ⚠️ Ini saklar **khusus pemain**: lawan tidak ikut dapat ×2 permanen — dia tetap memakai cara lamanya (sesekali
  memuat satu pukulan). Jadi pertandingan jadi lebih ringan buat kamu; bilang saja kalau mau lawannya disamakan.

---

## 1. PANJER MANUAL — aturannya (kalau mode otomatis mati)

| Ditahan | Yang keluar saat dilepas |
|---|---|
| **0 – 0,4 detik** (sekelibat / tap biasa, 0,1–0,3 dtk) | **pukulan normal** — ×1 damage, ×1 hajar, sama persis seperti dulu |
| **0,4 – 1 detik** | **naik terus, makin lama makin kuat**: ×1 → ×2 (lihat tabel di bawah) |
| **1 detik ke atas** | **mentok ×2** — dua detik bukan berarti 4× |

Kurvanya satu garis lurus dari 0,4 ke 1,0 detik, jadi gampang dirasakan: tambahan 0,1 detik = tambahan ±0,17× kekuatan.

| Ditahan | Kekuatan | Uppercut jadi |
|---|---|---|
| 0,30 s (sekelibat) | ×1,00 | 15 dmg · hajar 8 |
| 0,40 s | ×1,00 | 15 dmg · hajar 8 |
| 0,55 s | ×1,25 | 18,8 dmg · hajar 10 |
| 0,70 s | ×1,50 | 22,5 dmg · hajar 12 |
| 0,85 s | ×1,75 | 26,3 dmg · hajar 14 |
| **1,00 s** | **×2,00** | **30 dmg · hajar 16** |
| 1,50 s | ×2,00 | 30 dmg · hajar 16 |

Angka lengkap empat pukulan dasarnya, pakai buku jurus yang sudah ada:

| Pukulan | Normal | **PANJER** |
|---|---|---|
| JAB (H) | 7 dmg · hajar 4 | **14 dmg · hajar 8** |
| STRAIGHT (X) | 11 dmg · hajar 6 | **22 dmg · hajar 12** |
| HOOK (J/C) | 13 dmg · hajar 7 | **26 dmg · hajar 14** |
| UPPERCUT (K/V) | 15 dmg · hajar 8 | **30 dmg · hajar 16** |

Batas-batasnya **tepat**: 0,39 detik masih normal, 0,40 detik mulai naik, 0,99 detik = ×1,98, **1,00 detik = ×2,00**.
Dan waktunya dihitung pakai **jam** (`performance.now()`), bukan hitungan frame, jadi tombol yang kamu tahan 1,01 detik
tetap dihitung 1,01 detik (tidak bisa "ketelan" satu frame).

**Damage dan hajar naik bersama** — dua-duanya memakai angka yang sama (jadi di 0,7 detik kamu dapat ×1,5 damage
**dan** ×1,5 hajar). Hajar itu berlaku untuk **dua-duanya**: dorongan saat lawan tetap berdiri, **dan** lemparan saat
lawan terpental-jatuh (plafon jarak lemparnya ikut dibuka sebesar itu — kalau tidak, angkanya cuma jadi angka di layar).

## 2. Apa yang kamu bayar

Satu detik berdiri dengan **tangan ditarik ke belakang**. Dan itu kelihatan — **sebesar kekuatan yang sedang kamu
kumpulkan** (tap sekelibat hampir tidak kelihatan; makin lama, makin jelas):

- tangan pukulnya mundur ke **pose ancang-ancang pukulan itu sendiri** (bukan pose karangan baru) dan makin dalam
  seiring kekuatannya naik;
- ada **getaran menahan** di bahu yang makin kuat, bahu berputar menjauh dari lawan, dan panggul turun;
- tubuhnya **menyala** makin terang, dan begitu load-nya penuh ada **percikan api di kepalan** + suara;
- di HUD ada **bar PANJER** yang mengisi seiring naiknya kekuatan, dengan angka hidup di sebelahnya:
  `MAKIN LAMA MAKIN KUAT — SEKARANG ×1,4` → `SIAP — LEPAS! ×2,0 PUKULAN & HAJAR` (bar-nya baru muncul di atas
  0,4 detik, jadi tap sekelibat tidak bikin UI berkedip).

Jadi lawan bisa melihat kamu sedang mengisi pukulan — dan jawabannya sederhana: **jangan ada di situ**, atau
**pukul duluan**. Kalau kamu kena pukul / terpental / jatuh / angkat guard / bel / pause / window-nya kehilangan
fokus: **load-nya hangus**, bukan tersimpan.

## 3. Yang berubah di inputnya (jujur)

**Kalau PANJER OTOMATIS hidup**, tombol pukulan berfungsi seperti dulu lagi (pukul saat ditekan), cuma hasilnya
selalu maks. **Kalau mati**, empat tombol pukulan itu **tidak memukul saat ditekan** — mereka **memuat** saat
ditahan, dan pukulannya keluar **saat tombol dilepas**:

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
| **F** | sprint (dulu SHIFT — sekarang SHIFT = PANJER OTOMATIS) |

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
npm run test:panjer   # 7 seksi: aturan & kurva · tombol · tell · bayaran · komitmen · AI · "yang lain tidak bergerak"
npm test              # feet/pose/cam/crowd/zeus/balance/star/combo/swing/ali/panjer PASS
npx tsc --noEmit      # bersih
npm run build         # ✓
```

Yang dikunci harness-nya (`panjertest.mjs`, §1–§7):

- **tap sekelibat 0,05 / 0,1 / 0,2 / 0,3 detik semuanya ×1** (dan 0,39 detik juga), batas 0,4 detik mulai naik;
- **kurvanya naik terus**: tiap tambahan 0,05 detik dari 0,4 ke 1,0 selalu lebih kuat, di sampel 10 ms dari 0 sampai
  3 detik tidak pernah turun dan tidak pernah keluar dari [×1, ×2]; 0,55 s = ×1,25 · 0,7 s = ×1,5 · 0,85 s = ×1,75;
- **1,00 detik tepat ×2,00**, dan 3 detik / 30 detik tetap ×2 (mentok);
- **hajar memakai kurva yang sama** (0,7 detik = ×1,5 hajar, bukan ×2);
- waktu load pakai **jam** bukan frame;
- enam tombol pukulan benar-benar melepas `tryAttack` dari jalur `press`, pukulan keluar dari jalur `release`,
  counter (L) tetap instan;
- tell-nya lengkap dan **membaca kurva yang sama** dengan pukulannya (pose coil sedalam kekuatannya + getaran +
  glow + percikan + bar HUD dengan angka hidup);
- damage & hajar dikali angka load di **kedua** jalur (lemparan & dorongan) dengan plafonnya ikut dibuka;
- load mati oleh pukulan/guard/jatuh/bel/pause/blur, kombo-N menghabiskan load, dan **tidak bisa menumpang** ke
  Overdrive/grab/jurus skrip apa pun;
- auto-guard STAR MODE minggir saat ada load; dan AI memakai **kurva + angka yang sama** dengan peluang yang dibatasi;
- **PANJER OTOMATIS**: SHIFT dibaca sebelum gerbang tarung (jadi hidup di lobby juga), saat mode nyala pukulan keluar
  dari jalur **press** (bukan release) dengan pengali **mentok `PANJER_DMG`**, tidak ada load yang dibangun, ingatannya
  disimpan, tell-nya jadi STATE (kepalan menyala + badge HUD + tombol tap di HP), dan **SHIFT sudah bukan sprint lagi**
  (sprint = F, tombol RUN di HP tetap F).
