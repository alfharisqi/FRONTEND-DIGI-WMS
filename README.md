# FRONTEND DIGI WMS (React.js + Tailwind CSS + EMQX MQTT WebSocket)

Repositori Frontend Web untuk sistem **DIGI WMS (RFID Warehouse, Inventory & POS Integration)** yang dirancang untuk kolaborasi **4 Anggota Tim** (*Vertical Slicing*).

## Pembagian Modul Tim (`src/modules/`)
1. **Orang 1 (`src/modules/orang1-inbound/InboundTaggingPage.jsx`):** Penerimaan Barang (Inbound GRN), Master SKU & Encoding Tag RFID Meja.
2. **Orang 2 (`src/modules/orang2-inventory/InventoryLedgerPage.jsx`):** Denah Rak, Putaway & Buku Besar Mutasi Stok (*Immutable Ledger* + Live EMQX).
3. **Orang 3 (`src/modules/orang3-opname/HandheldOpnamePage.jsx`):** Stock Opname Handheld RFID & Rekonsiliasi Selisih (*Match / Missing / Salah Rak*).
4. **Orang 4 (`src/modules/orang4-dashboard/DashboardOverviewPage.jsx`):** Dashboard KPI Utama, Status Server & Monitor Broker EMQX.

## Development lokal

Siapkan Node.js dengan npm dan instal PostgreSQL 16 lokal beserta `initdb`, `pg_ctl`, dan `pg_controldata`. Launcher Windows mencari binari di `C:/Program Files/PostgreSQL/16/bin`. Jika berbeda, isi `DIGIWMS_DEV_PG_BIN` dengan path folder `bin`.

Letakkan kedua checkout yang sudah memuat perubahan Development di bawah folder induk yang sama. Checkout `main` dapat digunakan setelah perubahan ini tersedia di kedua repo.

```text
digiwms/
  BACKEND-DIGI-WMS/
  FRONTEND-DIGI-WMS/
```

Dari folder induk, jalankan:

```powershell
Set-Location BACKEND-DIGI-WMS
npm ci
Set-Location ../FRONTEND-DIGI-WMS
npm ci
npm run dev
```

Buka **http://localhost:3000**. Login dengan `admin.dev` dan gunakan password dari file lokal yang dicetak launcher. Fastify memakai port 5102 dan PostgreSQL Development memakai port 55436 secara default. Tekan **Ctrl+C** dari terminal launcher. Jalankan `npm run dev` kembali untuk membuka data Development yang sama.

Jika backend berada di folder lain, set `DIGIWMS_DEV_BACKEND_DIR` ke path checkout tersebut sebelum startup. Launcher memeriksa isi checkout yang dipilih dan mencetak path-nya. Jika checkout belum lengkap, startup berhenti dengan pesan file atau dependensi yang kurang.
