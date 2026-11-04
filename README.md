# FRONTEND DIGI WMS (React.js + Tailwind CSS + EMQX MQTT WebSocket)

Repositori Frontend Web untuk sistem **DIGI WMS (RFID Warehouse, Inventory & POS Integration)** yang dirancang untuk kolaborasi **4 Anggota Tim** (*Vertical Slicing*).

## Pembagian Modul Tim (`src/modules/`)
1. **Orang 1 (`src/modules/orang1-inbound/InboundTaggingPage.jsx`):** Penerimaan Barang (Inbound GRN), Master SKU & Encoding Tag RFID Meja.
2. **Orang 2 (`src/modules/orang2-inventory/InventoryLedgerPage.jsx`):** Denah Rak, Putaway & Buku Besar Mutasi Stok (*Immutable Ledger* + Live EMQX).
3. **Orang 3 (`src/modules/orang3-opname/HandheldOpnamePage.jsx`):** Stock Opname Handheld RFID & Rekonsiliasi Selisih (*Match / Missing / Salah Rak*).
4. **Orang 4 (`src/modules/orang4-dashboard/DashboardOverviewPage.jsx`):** Dashboard KPI Utama, Status Server & Monitor Broker EMQX.

## Cara Menjalankan
```bash
npm install
npm run dev
```
Buka **`http://localhost:3000`** di browser.
