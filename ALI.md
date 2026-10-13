# 🦋 ALI STYLE — tekan **Y**, gaya bertarung Muhammad Ali

Sekali tekan **Y**, gaya bertarungmu berubah jadi gaya Ali: **tangan turun**, badan **melayang**, kepala
**selalu bergerak**, dan yang paling khas — **ALI SHUFFLE**: kaki berdansa di tempat. Tekan **Y** lagi untuk kembali
ke guard biasa. Semua mode, **player-only** (lawan tetap pakai gayanya sendiri), dan ini **stance, bukan buff**.

> **Y sekarang nyala di mana saja** — termasuk **di lobby**. Sebelum bertanding, tekan Y dan robot hero di layar
> menu langsung joget shuffle. Di dalam tarung, tombol yang sama menukar gayanya saat itu juga.

---

## 0. Kenapa versi pertama terasa "tidak ada bedanya"

Versi pertama punya tiga masalah nyata, dan ketiganya sudah dibetulkan:

1. **Y cuma hidup di dalam tarung.** Di lobby tombolnya diam — dan justru di lobby kebanyakan orang coba menekannya.
2. **Gayanya butuh berdiri diam.** Begitu kamu jalan, stance-nya hilang, jadi bagian terbesar permainan tidak pernah
   kelihatan.
3. **Amplitudonya terlalu kecil** untuk terbaca dari kamera siaran.

Versi ini: Y hidup di mana saja, stance-nya **ikut terbawa saat jalan**, dan gerakannya **dibesarkan supaya kelihatan**.

---

## 1. Tiga hal yang membentuk gayanya

### a. Guard rendah & longgar (`ALI_GUARD`)

| | Guard biasa | ALI STYLE v2 |
|---|---|---|
| `sx` (tinggi tangan) | −0,72 | **−0,16** → tangan benar-benar turun ke dada bawah |
| `sy` (kunci dalam) | −0,50 | **−0,20** → dagu tidak lagi disembunyikan di balik sarung tangan |
| `sz` (lebar siku) | 0,04 | **0,34** → siku terbuka paling lebar |
| `ex` (lipatan siku) | −2,00 | **−1,34** → kepalan jauh dari wajah |

Plus **`ALI_GUARD_DRIFT 0,12`**: guard rendah-nya sendiri naik-turun pelan, jadi tangan yang turun itu tidak pernah
beku seperti patung.

**Ini sengaja guard yang lebih longgar** — skor liputan **1,36** vs 3,18 milik guard tinggi. Kalau suatu hari gaya ini
lebih tertutup dari guard biasa, dia jadi upgrade gratis dan toggle-nya kehilangan arti. Harness mengunci itu.

### b. The float (`aliWeave` / `aliRoll` / `aliHead` / `aliFloat`)

Badan atas tidak pernah diam, dan sekarang **jauh lebih besar**:

| | v1 | v2 |
|---|---|---|
| bahu meliuk menyilang garis tengah (`ALI_WEAVE`) | ±0,09 rad | **±0,17 rad** ← puncak-ke-puncak ~0,34 rad |
| panggul mengguling (`ALI_TILT`) | ±0,05 | **±0,12** |
| kepala ikut bergerak (`ALI_HEAD`) | ±0,10 | **±0,22** ← kepala yang bergerak itu intinya |
| badan naik-turun (`ALI_FLOAT`) | 0–0,04 | **0–0,09** |

Satu liukan penuh ≈ **1,21 detik** (`ALI_FLOAT_RATE 5,2` rad/s) — lebih cepat dari v1, jadi terbaca hidup, bukan
mengambang pelan. Ketiganya beda fase, jadi terbaca sebagai *drift*, bukan metronom.

### c. The ALI SHUFFLE (di `robot.ts`)

Saat berdiri (tidak jalan, tidak mukul, tidak kena pukul), kaki **berdansa**:

- **irama**: satu tap setiap **0,150 s** dan tap-nya juga **0,150 s** (≈**6,7 tap/detik**) — gantian kiri-kanan
  tanpa jeda, jadi selalu ada kaki yang bergerak;
- **bentuknya**: tap **jauh keluar** dari stance lalu balik — **0,52 unit** dari stance selebar ~1,2 (v1: 0,3),
  terangkat **0,15**;
- **bobotnya (THE ROCK)**: setiap tap melempar badan — **sway −0,22**, **roll +0,14**, **yaw −0,10**. Inilah yang
  bikin lagunya kelihatan, bukan cuma kakinya;
- **bob**: badan naik-turun di **2,2 Hz** dan makin besar saat shuffle (`+0,085` m) — kepala ikut menari;
- **batasnya**: tidak pernah dua kaki melangkah bersamaan, tidak pernah menyeberang, dan **langsung pudar** begitu
  kamu benar-benar berjalan cepat / dash / kena pukulan;
- **tanpa teleport**: tap-nya jalan lewat solver kaki yang sama dengan semua langkah lain (plant & clear sama).

### d. Terbawa saat jalan (`ALI_CARRY 0,55`)

v1 stance-nya cuma 100% saat berdiri diam (dan masih dikalikan bob idle, jadi praktis hilang). Sekarang:

| keadaan | bobot gaya |
|---|---|
| berdiri (idle) | **1,00** — penuh, plus shuffle |
| **jalan** | **0,55** (`ALI_CARRY`) — tangan tetap di bawah, liukan tetap jalan, dipakai untuk semua kecepatan jalan |
| blocking / mukul / kena pukul | 0 — animasi jurus yang menang, stance-nya minggir |

Jadi kalau kamu jalan mondar-mandir sambil menunggu, tanganmu **tetap** gaya Ali.

---

## 2. Tombolnya sekarang menjawab keras

Dulu toggle-nya diam. Sekarang tiap tekan Y menjawab dengan:

- **banner** — `🦋 ALI STYLE ON — FLOAT LIKE A BUTTERFLY` / `... OFF` (band besar di tengah layar);
- **popup** di atas robot;
- **suara** crowd (`sfx.cheer`) + kilat layar, plus **ring + spark + trauma kamera** (efek dunia ini cuma muncul
  saat sudah di dalam ring — di menu tidak ada FX dunia, tapi banner & suaranya tetap ada);
- **badge HUD berdenyut**: `🦋 ALI STYLE · ALI SHUFFLE` + `GUARD RENDAH`.

**Lobby**: roboh **hero di menu** menjalankan stance + shuffle yang sama (tangan ke `aliIdlePose`, weave/roll/float
×0,9, kepala menoleh, shuffle 1) — tapi hanya saat hero-nya berdiri santai; pose kemenangan / taunt yang kamu pilih
di menu tidak diutak-atik.

**Jalan pintas sentuh**: di lobby ada **chip `🦋 ALI STYLE`** di kanan bawah yang bisa diklik, dan di dalam tarung
tombol sentuh **🦋** muncul di sebelah GAYA. Tidak ada tombol baru untuk keyboard — tetap **Y** saja.

> Catatan jujur: di **STAR MODE** auto-guard-nya mati saat ALI STYLE nyala (guard naik dan guard turun tidak bisa
> hidup bersamaan). Menahan **G** tetap memblok seperti biasa — gaya ini tidak pernah mencabut guard manualmu.

## 3. Tampilannya, dalam angka

Diukur langsung dari rig (forward kinematics, 4 detik idle, satuan meter):

| | guard biasa | ALI STYLE + SHUFFLE |
|---|---|---|
| tinggi kepalan | 5,69 m | **4,53 m** → **1,16 m lebih rendah** |
| kepalan bergoyang kiri-kanan | 0,22 m | **1,57 m** → **7,3×** |
| kepala bergerak kiri-kanan | 0,27 m | **2,23 m** → **8,1×** |
| satu boot berdansa (4 s) | 0,00 m | **0,51 m** |

Ketiga baris itu **dikunci di tes** (§7 `alitest.mjs`), jadi gaya ini tidak bisa diam-diam menyusut kembali.

---

## 4. Kenapa ini bukan buff

Satu-satunya angka gameplay yang bergeser: **pace footwork +8%** (`ALI_SPEED`) — karena "float like a butterfly" itu
klaim soal kaki. Selebihnya **tidak disentuh sama sekali**, dan itu dikunci di tes:

- tabel dodge (`DODGE_CFG`) **sama persis**: evade 13 stam/0,34 s · fwd 10/0,30 · back 12/0,34 · side 11/0,32 · `STAM_SCALE 0.6`;
- damage buku jurus tidak berubah (jab 7 · cross 11 · hook 13 · upper 15 · bolt 32), tell, stamina, knockback — sama;
- tidak ada `Math.random` di seluruh blok gaya;
- guard-nya lebih longgar dari guard biasa (lihat tabel di atas).

## 5. Tombol

- **Y** = nyala/mati ALI STYLE — di lobby, saat jalan ke ring, di dalam tarung, maupun saat pause.
- Pose freestyle yang dulu di **Y** (seperti "angkat sabuk" yang dulu di N) **lepas tombolnya** tapi tetap ada di
  buku pose — tekan tombol **GAYA** untuk memutar pose-nya. Jadi tidak ada pose yang hilang.
- Panduan (`PANDUAN`) dapat baris baru untuk Y (termasuk keterangan lobby).

## 6. Verifikasi

```bash
npm run test:ali    # 7 seksi: stance · float · shuffle · "stance bukan buff" · tombol · wiring · diukur di rig → ALL PASS
npm test            # feet/pose/cam/crowd/zeus/balance/star/combo/swing/ali PASS
npx tsc --noEmit    # bersih
npm run build       # ✓ 1.767,43 kB / gzip 495,87 kB
```

Yang **dikunci** harness-nya: tangan benar-benar turun & lebih longgar dari guard; ketiga istilah float bergerak,
terbatas, dan **tidak sefase**; cadence shuffle cepat tapi masuk akal + kakinya tidak pernah menyeberang + pudar
saat jalan/kena pukul; **Y dibaca sebelum gerbang tarung** (jadi di lobby hidup) dan hanya punya satu arti;
toggle-nya benar-benar memanggil banner/suara/burst; **hero lobby** memakai stance-nya sedangkan pose pilihan menu
tidak tersentuh; dodge economy & buku jurus **tidak tersentuh**; dan yang terakhir — **jarak yang benar-benar
ditempuh kepalan, kepala dan boot** diukur dari rig aslinya.
