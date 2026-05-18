## IDX Harmonic Pattern Scanner

Web app untuk scan pola harmonik (Gartley, Bat, Butterfly, Crab, Deep Crab, Shark, Cypher, AB=CD) pada saham IDX, dengan dukungan deteksi pattern yang sudah selesai dan yang sedang berkembang (developing CD leg).

### Stack
- **Frontend**: TanStack Start (React 19) + Tailwind + shadcn/ui (sudah terpasang)
- **Backend**: Server functions TanStack (`createServerFn`) — fetch data harga & jalankan scanner di server
- **Auth & DB**: Lovable Cloud (email/password login)
- **Data harga**: Yahoo Finance via suffix `.JK` (cth: `ASII.JK`) — endpoint `query1.finance.yahoo.com/v8/finance/chart` (tanpa API key)
- **Chart**: `lightweight-charts` (TradingView) untuk candlestick + overlay garis XABCD + zona PRZ

### Halaman & Flow
```
/login, /signup            → auth
/_authenticated/
  ├ dashboard              → tabs: Completed | Developing, filter (bullish/bearish, pola, confidence, timeframe), tombol "Scan Now"
  ├ watchlist              → kelola daftar saham (bulk paste: ASII, TLKM, ...)
  └ chart/$symbol          → detail candlestick + overlay XABCD + PRZ
```

### Database (Lovable Cloud)
- `watchlist_symbols(id, user_id, symbol, created_at)` — RLS per user
- `scan_runs(id, user_id, timeframe, started_at, finished_at, status)`
- `patterns(id, user_id, scan_run_id, symbol, timeframe, pattern_name, direction, status[completed|developing], confidence, x_date, x_price, a_date, a_price, b_date, b_price, c_date, c_price, d_date, d_price, prz_low, prz_high, invalidation, progress_pct, created_at)`
- Trigger auto-create row di `profiles` (opsional) — saya tanya: hanya butuh email/password tanpa profile tambahan, jadi skip table profiles.

### Scanner Engine (server function)
1. **Fetch OHLC** Yahoo Finance per symbol untuk timeframe (1d / 1wk / 1h untuk "4H" di-resample), simpan in-memory per scan.
2. **ZigZag swing detection** dengan threshold % konfigurable (default 3%) — hasilkan deret pivot high/low.
3. **Cek kombinasi 5 pivot terakhir (X-A-B-C-D)** untuk completed; **4 pivot terakhir (X-A-B-C) + harga berjalan** untuk developing.
4. **Validasi rasio Fibonacci** per pola dengan toleransi ±3% (configurable):
   - Gartley: AB=0.618 XA, BC=0.382–0.886 AB, CD=1.272–1.618 BC, AD=0.786 XA
   - Bat: AB=0.382–0.5 XA, BC=0.382–0.886, CD=1.618–2.618, AD=0.886
   - Butterfly: AB=0.786, AD=1.27–1.618
   - Crab: AB=0.382–0.618, AD=1.618
   - Deep Crab: AB=0.886, AD=1.618
   - Shark: 0.886/1.13 logic
   - Cypher: AB=0.382–0.618, BC=1.272–1.414, CD≈0.786 of XC
   - AB=CD: simetri AB & CD
5. **Confidence score** = rata-rata kedekatan setiap rasio terhadap target ideal (1.0 = persis, dikurangi penalti deviasi).
6. **Developing**: hitung target D dari rasio ideal (range PRZ), progress % = jarak harga sekarang dari C menuju target D, invalidation = level yang membatalkan pola (cth break X).
7. Simpan hasil ke `patterns`, update `scan_runs.status`.

### UI
- **Watchlist**: textarea bulk paste + chip list (hapus per item).
- **Dashboard**: 
  - Top bar: pilih timeframe (Daily/Weekly/4H), tombol "Scan Now" (memicu server fn, progress toast).
  - Tabs Completed / Developing — tabel: symbol, pola, arah (badge bull/bear), confidence bar, PRZ, tanggal/progress; klik baris → `/chart/$symbol`.
  - Filters: arah, jenis pola (multi), min confidence (slider), timeframe.
- **Chart page**: candlestick + line series XABCD + area PRZ (rectangle via overlay), info panel detail rasio.
- **Notifikasi**: toast (sonner) saat scan selesai + jumlah pola baru, plus `Audio` beep pendek (file kecil di `src/assets`).

### Catatan & batasan jujur
- **Yahoo `.JK` endpoint** tidak resmi tapi stabil; kadang rate-limit. Saya panggil dari server function (bukan browser) untuk hindari CORS dan sebar load.
- **4H IDX**: Yahoo hanya menyediakan intraday ~60 hari (interval `60m`), jadi "4H" di-resample dari `60m` bars (4 bar = 1 candle 4H). Saya tampilkan disclaimer.
- **Belum ada cron**: scan dipicu manual via tombol (sesuai pilihan).
- **Email/Telegram notifikasi**: di-skip sesuai pilihan; struktur kode tetap rapi agar mudah ditambah nanti.
- Ini bukan saran trading — saya tambahkan disclaimer di footer.

### Deliverable urutan implementasi
1. Enable Lovable Cloud + auth (email/password) + tabel di atas dengan RLS.
2. Route `_authenticated` guard, halaman login/signup.
3. Watchlist page (CRUD bulk).
4. Server function: `fetchOhlc`, `scanSymbol`, `runScan` (loop watchlist).
5. Pattern detection lib (`src/lib/harmonic/*`): zigzag, ratios, detectors, scoring.
6. Dashboard dengan tabs + filter + tombol Scan Now (memanggil `runScan`).
7. Chart detail dengan `lightweight-charts` + overlay XABCD + PRZ.
8. Toast + sound notification.
