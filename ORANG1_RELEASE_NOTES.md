# Orang 1 — Catatan integrasi frontend

Tanggal: 11 November 2026, Asia/Jakarta. Branch: `feat/orang1-inbound`; tujuan `main`.

Modul `src/modules/orang1-inbound` mengintegrasikan Master SKU, GRN, dan RFID dengan API nyata. Mencakup loading/error, validasi, UUID utuh, detail dan riwayat, edit/hapus aman, verify/cancel, serta registrasi/deactivate RFID dalam mode simulasi. Helper `api.js` menangani envelope API dan normalisasi tipe tag native Supabase.

**PREVIOUSLY TESTED:** 11 tes helper frontend lulus pada 9 November; bukti text pada `tests/evidence/final-frontend-tests.txt`. Build, pemeriksaan browser QA dan Production read-only terdokumentasi pada laporan integrasi backend. Bukti Newman tersanitasi tersedia di repository backend `tests/postman/` (774 assertion PASS pada dua fixture QA dan tujuh GET Production, bukan hasil tes ulang release).

**PASSED sebelum sinkronisasi:** `npm run build`. Peringatan bundle >500 kB tidak menghalangi build. Build diulang setelah membawa routing, login/RBAC dan dashboard terbaru dari `main`; hasil final dicatat di PR/laporan release.

**NOT RUN selama release:** seluruh collection API, pengujian browser penuh, write/migrasi Production, hardware RFID dan deployment. Kode helper tidak diubah selama release ini; bukti tes sebelumnya tidak diklaim sebagai tes terhadap SHA commit merge.

Commit dibatasi ke modul Orang 1, script pengujian, bukti text terpilih dan dokumentasi. `App.jsx`, login/RBAC, dashboard, konfigurasi MQTT terbaru, serta modul Orang 2/3 dipertahankan dari `main`. Screenshot sesi lokal tetap disimpan lokal dan tidak dipublikasikan. Tidak ada `.env`, credential, atau build output dalam commit.
