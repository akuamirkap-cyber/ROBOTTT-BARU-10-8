# 🦋 ALI STYLE — tekan **Y**, gaya bertarung Muhammad Ali

Sekali tekan **Y**, gaya bertarungmu berubah jadi gaya Ali: **tangan turun**, badan **melayang**, dan yang paling khas —
**ALI SHUFFLE**: kaki berdansa di tempat. Tekan **Y** lagi untuk kembali ke guard tinggi.

Semua mode. **Player-only** (lawan tetap pakai gayanya sendiri), dan ini **stance, bukan buff**.

---

## 1. Tiga hal yang membentuk gayanya

### a. Guard rendah & longgar (`ALI_GUARD`)
| | Guard biasa | ALI STYLE |
|---|---|---|
| `sx` (tinggi tangan) | −0,72 | **−0,30** → tangan turun ke dada |
| `sy` (kunci dalam) | −0,50 | **−0,24** → tidak lagi menyembunyikan dagu di balik sarung tangan |
| `sz` (lebar siku) | 0,04 | **0,26** → siku lebih terbuka |
| `ex` (lipatan siku) | −2,00 | **−1,50** → kepalan lebih jauh dari wajah |

**Ini sengaja guard yang lebih longgar** — skor liputan 1,78 vs 3,18 milik guard tinggi. Kalau suatu hari gaya ini
lebih tertutup dari guard biasa, dia jadi upgrade gratis, dan toggle-nya kehilangan arti. Harness mengunci itu.

### b. The float (`aliWeave` / `aliRoll` / `aliHead` / `aliFloat`)
Badan atas tidak pernah diam: bahu **meliuk menyilang garis tengah** (±0,09 rad), panggul **mengguling** pelan
(±0,05 rad), **kepala ikut bergerak** (±0,10 rad — kepala yang bergerak itu intinya), dan badannya naik-turun halus
(0–0,04). Ketiganya beda fase, jadi terbaca sebagai *drift*, bukan metronom. Satu liukan penuh ≈ **1,4 detik**.

### c. The ALI SHUFFLE (di `robot.ts`)
Saat berdiri (tidak jalan, tidak mukul, tidak kena pukul), kaki **berdansa**:
- **irama**: satu tap setiap **0,17 s** (≈5,9 tap/detik) — cepat tapi tetap jujur secara fisik (satu tap juga 0,17 s);
- **bentuknya**: tap pendek **keluar dari stance lalu balik** (0,3 unit dari stance selebar ~1,2), gantian kiri-kanan;
- **bobotnya**: ada rock lateral yang kuat (sway 0,10 + roll 0,06 + yaw 0,05) — itulah "bacaan" shuffle-nya;
- **batasnya**: tidak pernah ada dua kaki melangkah bersamaan, tidak pernah menyeberang (guard jarak antar kaki yang
  sama seperti langkah biasa), dan **langsung pudar** begitu kamu benar-benar berjalan / kena pukulan / dash;
- **tanpa teleport**: tap-nya jalan lewat solver kaki yang sama dengan semua langkah lain (plant & clear sama).

## 2. Kenapa ini bukan buff

Satu-satunya angka gameplay yang bergeser: **pace footwork +8%** (`ALI_SPEED`) — karena "float like a butterfly" itu
klaim soal kaki. Selebihnya **tidak disentuh sama sekali**, dan itu dikunci di tes:

- tabel dodge (`DODGE_CFG`) **sama persis**: evade 13 stam/0,34 s · fwd 10/0,30 · back 12/0,34 · side 11/0,32 · `STAM_SCALE 0.6`;
- damage buku jurus tidak berubah (jab 7 · cross 11 · hook 13 · upper 15 · bolt 32), tell, stamina, knockback — sama;
- tidak ada `Math.random` di seluruh blok gaya;
- guard-nya lebih longgar dari guard biasa (lihat tabel di atas).

## 3. Tombol

- **Y** = nyala/mati ALI STYLE. Popup `🦋 ALI STYLE — FLOAT LIKE A BUTTERFLY` saat nyala, dan HUD menampilkan badge
  `🦋 ALI STYLE · FLOAT` + `GUARD RENDAH` supaya guard yang turun itu tidak pernah jadi misteri.
- Pose freestyle yang dulu di **Y** (seperti "angkat sabuk" yang dulu di N) **lepas tombolnya** tapi tetap ada di
  buku pose — tekan tombol **GAYA** untuk memutar pose-nya. Jadi tidak ada pose yang hilang.
- Panduan (`PANDUAN`) dapat baris baru untuk Y.

## 4. Verifikasi

```bash
npm run test:ali    # 6 seksi: stance · float · shuffle · "stance bukan buff" · tombol · wiring → ALL PASS
npm test            # feet/pose/cam/crowd/zeus/balance/star/combo/swing/ali PASS
npx tsc --noEmit    # bersih
npm run build       # ✓
```

Yang **dikunci** harness-nya: tangan benar-benar turun & lebih longgar dari guard; ketiga istilah float bergerak,
terbatas, dan **tidak sefase**; cadence shuffle cepat tapi masuk akal + kakinya tidak pernah menyeberang + pudar
saat jalan/kena pukul; dodge economy & buku jurus **tidak tersentuh**; dan seluruh jalurnya **dicek dari source**
(hanya untuk `isPlayer`, hanya lewat key Y, pose lamanya benar-benar melepas key).
