# 🥊 AYUNAN — sistem serangan ala Boxing Star (dinamis & mantep)

Game ini sudah punya data jurus yang bagus (`MOVES[*].keys`: coil → extension → overshoot → settle), tapi yang bikin
pukulan **terasa** mantep di Boxing Star bukan cuma lengannya — **seluruh mesin yang melempar**. Pass ini menambah
lapisan itu: **SWING DYNAMICS**, satu rantai kinetik yang jalan di atas data jurus yang sudah ada.

**Tidak ada tombol baru, tidak ada jurus baru, dan angka balance tidak disentuh.** Yang berubah cuma *rasanya*.

---

## 1. Satu jam untuk seluruh rantai — `swingPhase`

Semua istilah di bawah digerakkan oleh satu jam: **0 sebelum ancang-ancang, tepat 1 di frame pukulan mendarat,
kembali 0 saat lengan pulang ke guard.** Karena satu jam, semuanya memuncak **bersamaan** — itu yang bikin pukulan
terbaca sebagai satu ledakan, bukan beberapa gerakan yang kebetulan bersamaan.

## 2. `swingStiff` — piston keluar, pegas steel balik

| Fase | Spring lengan | Kenapa |
|---|---|---|
| **Release** (+45%) | 75 → **108,75** | spring yang lebih kaku membuat kepalan **sampai di titik ekstensi TEPAT di frame impact**. Sebelumnya kepalan datang telat 2–3 frame (kalah sama lag spring), jadi pukulan mendarat "lembut" dan snap-nya terjadi *setelah* kontak (ketutup hitstop) |
| **Recoil** (−30%) | 75 → **52,5** | lengan kembali seperti baja berpegas — ada ayunan balik yang bisa dilihat, bukan kaku seperti aktuator |

Base-nya tidak diubah: `75` (dan `92` di Rage Mode) tetap angka yang dulu. Yang berubah hanya *bentuk* ayunannya.
Rantai tubuh di atasnya (pelvis ω12 → pinggang ω9 → dada ω7,5 → badan ω10,5) **tidak disentuh** — di situlah berat
mesinnya, dan itu yang bikin pukulan tidak terasa ringan.

## 3. `offArmCounter` — tangan satunya menjawab

Tangan yang **tidak** memukul sekarang bergerak menurut jenis pukulannya (sebelumnya cuma `GUARD` + sedikit noise):

- **Straight** (jab/cross/counter/bolt/finisher): ditarik **balik ke dagu**, siku mengunci rapat (`sy −0,22`, `ex −0,20`).
- **Arc** (hook): melintas **lebih jauh ke seberang dada** (`sy −0,30`) — inilah counter-rotation yang paling kelihatan.
- **Uppercut** (upper/skyhook/slam): **turun ke tulang rusuk** lalu mengunci (`sx +0,26`) — menutup badan yang ditinggal naik.

Ini perubahan visual paling besar: pukulan satu tangan selalu terlihat kaku, dan Boxing Star tidak pernah begitu.
Deltanya ditulis di ruang *mirrored* milik rig, jadi tangan kiri dan kanan otomatis melakukan hal yang sama.

## 4. `swingRoll` — badan ikut melempar

Tubuh **miring ke arah pukulan** saat commit: straight `0,12 rad`, hook **1,6× lebih keras** (hook itu pukulan yang
menggulingkan), uppercut `0,7×` (vertikal, energinya di angkatan). Sisi kiri/kanan otomatis bercermin.

## 5. `trailWidthFor` — pita kepalan

Lebar jejak kepalan sekarang **naik turun mengikuti kekuatan pukulan**, lebih lebar di pukulan melengkung, dan
**dibatasi 0,8 m** supaya tidak ada pukulan yang menutupi seluruh layar:

| | sebelum | sekarang |
|---|---|---|
| jab | 0,28 | **0,34** |
| cross | 0,28 | **0,38** |
| hook (arc) | 0,28 | **0,53** |
| uppercut | 0,28 | **0,42** |
| Overdrive / mematikan | 0,41 | **0,70** |

Jendela emisinya juga maju sedikit (mulai `strikeAt − 0,06`) supaya blur *seluruh* release tertangkap, bukan cuma
ujungnya.

## 6. Efek pukulan

- **SWING STREAK**: kipas percikan tipis yang direntangkan sepanjang garis pukulan, muncul tepat saat pukulan lepas
  (pasangan visual dari suara *whoosh* yang sudah ada) — ukurannya ikut kekuatan pukulan, emas untuk Overdrive.
- **Kick lensa**: pukulan dengan `power ≥ 0,6` (hook, uppercut, semua Overdrive) sekarang menyentuh kamera sedikit
  saat dilepas. **Jab tidak** — jab dilempar sepuluh kali per ronde, dan menggetarkan kamera tiap jab akan mengubah
  jab jadi haymaker.

## 7. Adil untuk dua sisi

Seluruh rantai ini **murni fungsi matematis** tanpa `isPlayer` dan tanpa `Math.random`, dipakai oleh **jalur pose yang
sama** untuk pemain dan AI. Tidak ada "ayunan versi AI" — kalau AI memutar badan, itu rantai yang sama persis.
Harness `swingtest.mjs` §7 memeriksa **source-nya langsung**, bukan cuma janji di komentar.

## 8. Verifikasi

```bash
npm run test:swing   # 7 seksi: jam · snap · tangan bebas · roll · pita · follow-through · keadilan → ALL PASS
npm test             # feet/pose/cam/crowd/zeus/balance/star/combo/swing PASS
npx tsc --noEmit     # bersih
npm run build        # ✓
```

Yang **dikunci** harness-nya supaya ayunan tidak pelan-pelan jadi lemas lagi:

- tiap pukulan **memuncak tepat 1 di frame impact** dan nol lagi di akhir jurus;
- spring lengan **lebih kaku saat keluar daripada saat balik** (asimetrinya nyata, bukan kosmetik);
- tangan bebas **bergerak ≥ 0,20 rad** dan arahnya sesuai jenis pukulan (bukan nol, bukan asal);
- pita **naik seiring power**, arc lebih lebar, dan **selalu ≤ 0,8 m**;
- **tidak ada pukulan yang langsung balik dari frame kontak** — empat pukulan dasar benar-benar overshoot melewati
  target, dan dua yang memang *menahan* (counter = setengah Overdrive, mematikan = kata terakhir) dikunci sebagai
  pengecualian yang disengaja;
- tiap pukulan **memuat (coil) minimal sedalam guard** sebelum dilepas — coil itulah tell-nya.
