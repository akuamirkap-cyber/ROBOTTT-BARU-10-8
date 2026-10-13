# 🅝 TOMBOL N — kombo satu tombol & PUKULAN MEMATIKAN

Sekali tekan **N**, seluruh rangkaian jalan sendiri:

```
JAB  →  JAB  →  HOOK  →  HOOK  →  UPPERCUT  →  ☠️ PUKULAN MEMATIKAN
 H       H       J        J         K              (jurus baru, tanpa tombol sendiri)
```

Semuanya **tombol yang sudah ada** (H/J/K) plus satu tombol baru (N) yang dikhususkan untuk kombo ini. Aktif di **semua mode** — PLAY MATCH, STAR MODE, LAWAN ATLAS, RANK, TOURNAMENT, TEAM MATCH.

---

## 1. Aturan yang bikin ini bukan cheat

| Aturan | Kenapa |
|---|---|
| ❗ **Kombo PUTUS saat pukulannya kena balasan lawan** — keblokir, dihindari (slip peek-a-boo), di-samping, atau meleset | baca-bacaan tetap jadi inti: kombo bersih itu syarat, bukan jaminan |
| ⏱️ **Cooldown 1,4 detik** setelah kombo putus/selesai | N tidak bisa di-spam; total skrip ±6,6 detik |
| 🧾 **Pukulan mematikan BAYAR: setengah meter (50) + tenaga 30** | tidak ada jurus pamungkas gratis |
| 🔋 **Kalau meter tidak cukup, kombo berhenti di uppercut** (dan bilang kenapa di layar) | tidak ada yang bisa dipakai tanpa membayar |
| ✋ **Semua tombol serang/hindar manual milikmu** — pencet H/J/K/X/P/L/R/SPACE di tengah kombo = kombo dilepas, kamu ambil alih | kendali tidak pernah direbut sistem |

## 2. Kombo bersih membayar dirinya sendiri

Meter Overdrive diisi oleh pukulan yang masuk, dan jab mengisi paling cepat. Hitungannya (rumus game, lihat `meterGainFor`):

```
jab 7 dmg ×1,3 ×2,5 = 22,8      jab 22,8
hook 13 ×1,3      = 16,9        hook 16,9
upper 15 ×1,3     = 19,5
                        total bank = 98,8 meter
```
Jadi dari **meter kosong** pun, kombo bersih 5 pukulan sudah menabung **98,8** — cukup untuk membayar **50** milik si mematikan, sisa ±49 masih tersimpan. Artinya: **yang membayar si mematikan adalah kombo itu sendiri** — bukan meter tabunganmu. Kombo yang gagal = tidak ada mematikan, dan meternya juga tidak dibuang sia-sia.

## 3. PUKULAN MEMATIKAN (jurus baru)

- **Bentuknya**: hantaman dua kepalan ke dada (piston ganda), badan mengendap dalam-dalam → **dua tangan lepas bersama di satu garis lurus**, badan meluruk dari kaki belakang dan **bertahan di posisi ekstensi** sementara lawan terbang.
- **Damage 44** — pukulan paling keras di seluruh buku jurus (Skyhook 33, Windmill 35, Slam 34).
- **Tidak bisa diblok** (hanya bisa dihindari atau disampingkan) — sama seperti GRAB.
- **Mengirim lawan terbang** (launch).
- **Peringatan musuh PALING LAMA** di game (0,98 detik, lihat `TELL.finisher`) — jadi AI yang jeli masih bisa lolos dari pukulan terakhir, dan di situ meter kamu hangus. Pukulan pamungkas yang bisa dibaca, bukan pukulan yang tidak bisa dihindari.
- Punya FX sendiri: cincin dua lapis (emas + putih), semprotan percikan dua kepalan, debu kanvas, dan kamera yang mendorong masuk.

Overall satu kombo bersih ≈ **99 damage** (≈ setengah bar HP dengan `HP_SCALE 1.8`).

## 4. HUD & tombol

- Badge di atas meter Overdrive: **`KOMBO 3/6 · H-H-J-J-K`** (sedang jalan), **`☠️ MEMATIKAN SIAP`** (meter sudah cukup) atau **`METER 32/50`** (belum), dan **`N · KOMBO — TUNGGU`** saat cooldown.
- Panduan (`PANDUAN`) dapat satu baris baru untuk N.
- Pose **"angkat sabuk / I am the champion!"** yang dulu di N tetap ada — sekarang diambil lewat tombol **GAYA** (cycle) seperti pose freestyle lainnya.

## 5. Verifikasi

```bash
npm run test:combo   # 6 seksi: skrip, si mematikan, harga, keekonomian, aturan putus, tombol N → ALL PASS
npm test             # feet/pose/cam/crowd/zeus/balance/star/combo PASS
npx tsc --noEmit     # bersih
npm run build        # ✓
```

`combotest.mjs` mengunci kontraknya supaya tidak bisa pelan-pelan jadi curang: si mematikan harus tetap **pukulan terberat**, tetap **tidak bisa diblok**, tetap **berbayar setengah meter + tenaga**, dan kombo bersih tetap harus **menabung lebih dari harganya**.
