import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  ClipboardList,
  Database,
  HelpCircle,
  Layers,
  MapPin,
  Package,
  Radio,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Siren,
  Tag,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const DOC_GROUPS = [
  {
    group: 'Pengenalan & Arsitektur',
    items: [
      { id: 'overview', title: 'Pengenalan & Arsitektur', icon: BookOpen },
      { id: 'rbac', title: 'Hak Akses & Keamanan (RBAC)', icon: ShieldCheck },
    ],
  },
  {
    group: 'SOP Operasional Gudang',
    items: [
      { id: 'inbound', title: 'Inbound, GRN & Tagging', icon: Truck },
      { id: 'master-box', title: 'Master Box & Break-Pack', icon: Boxes },
      { id: 'racks-putaway', title: 'Penyimpanan Rak & Stok', icon: MapPin },
      { id: 'picking-outbound', title: 'Picking, Packing & Outbound', icon: ClipboardList },
    ],
  },
  {
    group: 'POS, Opname & Gerbang',
    items: [
      { id: 'pos-retur', title: 'Kasir POS & Retur Barang', icon: ShoppingCart },
      { id: 'opname-gate', title: 'Opname Handheld & Gate Alarm', icon: Siren },
    ],
  },
  {
    group: 'Referensi Teknis & FAQ',
    items: [
      { id: 'tech-ref', title: 'API, EMQX MQTT & Supabase', icon: Database },
      { id: 'faq', title: 'FAQ & Troubleshooting', icon: HelpCircle },
    ],
  },
];

function Callout({ tone = 'info', title, children }) {
  const styles =
    tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
      : tone === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
      : 'border-primary/30 bg-primary/5 text-foreground';

  return (
    <div className={`rounded-xl border p-4 text-xs leading-relaxed ${styles}`}>
      {title && <p className="font-bold mb-1">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export default function HelpDocsPage({ switchTab }) {
  const [activeDoc, setActiveDoc] = useState('overview');
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_GROUPS;
    return DOC_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          g.group.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const jumpButton = (tabId, label) =>
    switchTab ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => switchTab(tabId)}
        className="gap-1.5"
      >
        <span>Buka {label}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                Dokumentasi & Panduan DIGI WMS
              </h2>
              <Badge variant="outline">v2.0 Lengkap</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pusat dokumentasi SOP operasional gudang, siklus RFID UHF Gen2, Master Box, Kasir POS, dan referensi teknis.
            </p>
          </div>
        </div>
      </div>

      {/* Main Fumadocs-style 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left Doc Sidebar */}
        <Card className="lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari topik panduan..."
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {filteredGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.group}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeDoc === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveDoc(item.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                Topik tidak ditemukan.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Reading Pane */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-6 text-sm leading-relaxed">
            {activeDoc === 'overview' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Pengenalan & Arsitektur</Badge>
                    <h3 className="text-xl font-bold text-foreground">
                      Apa itu DIGI WMS?
                    </h3>
                  </div>
                  {jumpButton('dashboard', 'Dashboard Utama')}
                </div>

                <p className="text-muted-foreground">
                  <strong className="text-foreground">DIGI WMS</strong> adalah sistem manajemen pergudangan (<em>Warehouse Management System</em>), kasir (<em>POS</em>), dan pengawasan keamanan gerbang keluar (<em>RFID Gate Security</em>) berbasis <strong className="text-foreground">RFID UHF Gen2 (920–923 MHz)</strong>, <strong className="text-foreground">Immutable Stock Ledger</strong>, <strong className="text-foreground">EMQX MQTT</strong>, dan <strong className="text-foreground">Supabase PostgreSQL</strong>.
                </p>

                <div className="space-y-2">
                  <h4 className="font-bold text-foreground text-base">
                    Siklus Hidup Status Tag RFID (6 Tahap Resmi)
                  </h4>
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left font-semibold text-muted-foreground">
                          <th className="p-3">Tahap</th>
                          <th className="p-3">Status Tag</th>
                          <th className="p-3">Lokasi Fisik</th>
                          <th className="p-3">Penjelasan Operasional</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr><td className="p-3 font-bold">1</td><td className="p-3 font-mono">UNASSIGNED</td><td className="p-3">Gulungan Label</td><td className="p-3 text-muted-foreground">Tag kosong, belum ditautkan ke SKU barang apa pun.</td></tr>
                        <tr><td className="p-3 font-bold">2</td><td className="p-3 font-mono">ENCODED</td><td className="p-3">Meja Inbound / INB01</td><td className="p-3 text-muted-foreground">Tag sudah ditulis EPC 96-bit dan ditautkan ke SKU & GRN.</td></tr>
                        <tr><td className="p-3 font-bold">3</td><td className="p-3 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">IN_STOCK</td><td className="p-3">Rak Gudang (A1, B1, ...)</td><td className="p-3 text-muted-foreground">Sudah di-Putaway ke rak dan sah menjadi stok siap jual.</td></tr>
                        <tr><td className="p-3 font-bold">4</td><td className="p-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">RESERVED</td><td className="p-3">Keranjang Picking</td><td className="p-3 text-muted-foreground">Dialokasikan ke order Picking atau transaksi yang sedang diproses.</td></tr>
                        <tr><td className="p-3 font-bold">5</td><td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-semibold">AUTHORIZED_OUT</td><td className="p-3">Meja Packing / Kasir</td><td className="p-3 text-muted-foreground">Sudah lunas POS / selesai Packing / punya Gate Pass aktif.</td></tr>
                        <tr><td className="p-3 font-bold">6</td><td className="p-3 font-mono">EXITED</td><td className="p-3">Luar Gudang</td><td className="p-3 text-muted-foreground">Sah melewati sensor antena gerbang keluar tanpa alarm.</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border p-4 bg-muted/30">
                    <p className="font-bold text-foreground mb-1">1. Desktop USB Encoder</p>
                    <p className="text-xs text-muted-foreground">Jarak dekat (2–5 cm) di meja Inbound atau meja Kasir POS untuk registrasi & checkout EPC satuan maupun Box.</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 bg-muted/30">
                    <p className="font-bold text-foreground mb-1">2. Handheld Scanner</p>
                    <p className="text-xs text-muted-foreground">Jarak 1–4 meter untuk Putaway, Picking, dan Stock Opname massal per zona rak.</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 bg-muted/30">
                    <p className="font-bold text-foreground mb-1">3. Portal Gate Reader</p>
                    <p className="text-xs text-muted-foreground">Antena pintu keluar otomatis meloloskan barang <code>AUTHORIZED_OUT</code> & membunyikan sirine jika masih <code>IN_STOCK</code>.</p>
                  </div>
                </div>
              </>
            )}

            {activeDoc === 'rbac' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Keamanan Sistem</Badge>
                    <h3 className="text-xl font-bold text-foreground">Hak Akses Pengguna (RBAC)</h3>
                  </div>
                  {jumpButton('users', 'Manajemen User')}
                </div>
                <p className="text-muted-foreground">
                  Setiap akun memiliki peran (<em>role</em>) dengan pembatasan akses di level UI maupun otorisasi JWT Backend:
                </p>
                <div className="rounded-xl border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left font-semibold text-muted-foreground">
                        <th className="p-3">Role</th>
                        <th className="p-3">Akses Utama</th>
                        <th className="p-3">Batasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="p-3 font-mono font-bold">ADMIN</td><td className="p-3">Akses penuh seluruh modul, Manajemen User, dan Pengaturan Sistem.</td><td className="p-3 text-muted-foreground">-</td></tr>
                      <tr><td className="p-3 font-mono font-bold">SUPERVISOR</td><td className="p-3">Persetujuan selisih Stock Opname, Pengaturan Sistem, Pembatalan GRN/Picking, & Manajemen User.</td><td className="p-3 text-muted-foreground">-</td></tr>
                      <tr><td className="p-3 font-mono font-bold">WAREHOUSE_STAFF</td><td className="p-3">Penerimaan, Tagging, Master Box, Putaway, Picking/Packing, Outbound, POS, & Opname.</td><td className="p-3 text-muted-foreground">Tidak dapat mengelola User / Pengaturan Sistem (View).</td></tr>
                      <tr><td className="p-3 font-mono font-bold">SECURITY</td><td className="p-3">Terminal Keamanan & Pass, Monitor Gate & Alarm Live, serta melihat Stok per Rak & Ledger.</td><td className="p-3 text-muted-foreground">Mode Lihat (Read-Only) pada menu operasional gudang & POS.</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeDoc === 'inbound' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">SOP Gudang — Tahap 1</Badge>
                    <h3 className="text-xl font-bold text-foreground">Inbound, GRN & Tag Encoding</h3>
                  </div>
                  <div className="flex gap-2">
                    {jumpButton('penerimaan', 'Penerimaan')}
                    {jumpButton('rfid-tag', 'Tag & Encoding')}
                  </div>
                </div>
                <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Buat Master SKU (Stok Barang):</strong> Daftarkan SKU, nama produk, kategori (mendukung tambah kategori kustom), harga, dan batas minimum stok.</li>
                  <li><strong className="text-foreground">Catat Dokumen GRN (Penerimaan):</strong> Masukkan nomor PO/Ref, supplier, tanggal masuk, dan rincian SKU + jumlah unit diterima.</li>
                  <li><strong className="text-foreground">Verifikasi Fisik GRN:</strong> Klik <em>Verifikasi</em> dan konfirmasi jumlah hitung fisik per SKU agar GRN berstatus <code>SELESAI</code> dan siap di-tagging.</li>
                  <li><strong className="text-foreground">Registrasi / Encoding Tag RFID:</strong> Di menu <em>Tag & Encoding</em>, pilih GRN terverifikasi (atau tujuan non-GRN <code>ASSET</code>/<code>SPECIAL</code> untuk Supervisor), lalu buat 1 tag atau batch hingga 100 tag sekaligus dengan status <code>ENCODED</code>.</li>
                  <li><strong className="text-foreground">Koreksi Tag Rusak:</strong> Gunakan tombol <em>Tandai Rusak</em> (<code>DAMAGED</code>) atau <em>Ganti EPC</em> untuk mengganti label sebelum Putaway.</li>
                </ol>
              </>
            )}

            {activeDoc === 'master-box' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">SOP Gudang — Kemasan Karton</Badge>
                    <h3 className="text-xl font-bold text-foreground">Master Box (Karton) & Break-Pack 2 Tahap</h3>
                  </div>
                  {jumpButton('master-box', 'Master Box')}
                </div>
                <p className="text-muted-foreground">
                  Untuk barang berjumlah banyak, Anda tidak perlu menempel tag RFID satuan saat masuk gudang. Cukup tempel <strong>1 Master EPC</strong> pada kardus besar (<code>MASTER</code>) atau dus kecil (<code>INNER</code>):
                </p>
                <div className="space-y-2">
                  <h4 className="font-bold text-foreground">Alur Kemasan Bertingkat:</h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                    <li><strong className="text-foreground">Registrasi Master Carton:</strong> Tentukan jumlah <em>Inner Box</em> (mis. 25 dus) dan isi per Inner Box (mis. 10 pcs) → total otomatis 250 unit tercatat di ledger.</li>
                    <li><strong className="text-foreground">Putaway Box ke Rak:</strong> Box dapat langsung dipindahkan ke rak penyimpanan (<code>IN_RACK</code>) dari halaman <em>Master Box</em> maupun <em>Penyimpanan Rak</em>.</li>
                    <li><strong className="text-foreground">Break-Pack Tahap 1 (Master → Inner Box):</strong> Pecah 1 Master Carton menjadi N Inner Box baru berstatus sama (<code>IN_RACK</code>/<code>SEALED</code>).</li>
                    <li><strong className="text-foreground">Break-Pack Tahap 2 (Inner Box → Tag Satuan):</strong> Pecah Inner Box menjadi tag RFID satuan berstatus <code>IN_STOCK</code> di rak tersebut (dapat juga dilakukan langsung dari dalam dialog <em>Picking</em> atau modal <em>Detail Rak</em>!).</li>
                    <li><strong className="text-foreground">Jual / Kirim Box Utuh:</strong> Box <code>IN_RACK</code> bisa langsung di-scan di <em>Kasir POS</em> atau dikirim lewat <em>Pengiriman Outbound (Stok Bebas)</em> tanpa perlu dipecah terlebih dahulu.</li>
                  </ul>
                </div>
              </>
            )}

            {activeDoc === 'racks-putaway' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">SOP Gudang — Tahap 2</Badge>
                    <h3 className="text-xl font-bold text-foreground">Penyimpanan Rak, Putaway & Konsistensi Stok</h3>
                  </div>
                  <div className="flex gap-2">
                    {jumpButton('penyimpanan', 'Penyimpanan Rak')}
                    {jumpButton('stok-rak', 'Stok per Rak')}
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Detail Isi Rak (Klik Kartu Rak):</strong> Klik kartu rak mana saja di halaman <em>Penyimpanan Rak</em> untuk melihat ringkasan produk, daftar Box, dan daftar Tag RFID satuan di dalamnya.</li>
                  <li><strong className="text-foreground">Edit, Hapus & Aksi Cepat Rak:</strong> Di dalam modal detail rak, Anda dapat mengedit kapasitas/nama rak, menghapus rak yang sedang kosong (<code>0 unit</code>), memecah Box, atau memindahkan Box/Tag langsung ke rak lain (<em>rack-to-rack transfer</em>).</li>
                  <li><strong className="text-foreground">Arti 3 Angka Stok di Sistem:</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li><strong className="text-foreground">Siap di Rak (In-Rack):</strong> Jumlah fisik unit siap jual/kirim yang sudah berada di rak (Tag <code>IN_STOCK</code> + Box <code>IN_RACK</code>).</li>
                      <li><strong className="text-foreground">Staging / Belum Putaway:</strong> Tag <code>ENCODED</code> atau Box <code>SEALED</code> yang masih berada di meja Inbound / <code>INB01</code>.</li>
                      <li><strong className="text-foreground">Saldo Ledger (Total):</strong> Total akumulasi mutasi masuk/keluar pada buku besar append-only <code>stock_movements</code>.</li>
                    </ul>
                  </li>
                </ul>
              </>
            )}

            {activeDoc === 'picking-outbound' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">SOP Gudang — Tahap 3</Badge>
                    <h3 className="text-xl font-bold text-foreground">Picking, Packing & Pengiriman Outbound</h3>
                  </div>
                  <div className="flex gap-2">
                    {jumpButton('picking', 'Picking & Packing')}
                    {jumpButton('pengiriman', 'Pengiriman')}
                  </div>
                </div>
                <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Buat Order Picking:</strong> Pilih produk dan jumlah pesanan di halaman <em>Picking & Packing</em>.</li>
                  <li><strong className="text-foreground">Scan EPC / Pecah Box:</strong> Validasi EPC yang diambil dari rak. Jika stok di rak masih berupa Box, klik tombol <em>Pecah Box & Ambil EPC</em> langsung di dalam dialog Picking.</li>
                  <li><strong className="text-foreground">Checklist & Selesai Packing:</strong> Centang 5 item verifikasi packing lalu klik <em>Konfirmasi Selesai Packing</em> — seluruh EPC otomatis berstatus <code>AUTHORIZED_OUT</code>.</li>
                  <li><strong className="text-foreground">Buat Pengiriman & Gate Pass (1-Langkah):</strong> Di menu <em>Pengiriman</em>, pilih sumber (<code>Picking & Packing</code>, <code>Penjualan POS</code>, atau <code>Stok Bebas</code> termasuk kemasan Box utuh). Sistem menerbitkan <strong>Gate Pass ACTIVE</strong> dan dokumen <strong>Surat Jalan</strong> siap cetak.</li>
                </ol>
              </>
            )}

            {activeDoc === 'pos-retur' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Kasir & Purnajual</Badge>
                    <h3 className="text-xl font-bold text-foreground">Kasir POS & Retur Barang</h3>
                  </div>
                  <div className="flex gap-2">
                    {jumpButton('pos', 'Kasir POS')}
                    {jumpButton('retur', 'Retur POS')}
                  </div>
                </div>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Scan RFID Live di Meja Kasir:</strong> Kasir POS terhubung real-time ke EMQX WebSocket (topik <code>wms/pos/live-scan</code>) atau input/scan EPC manual.</li>
                  <li><strong className="text-foreground">Mendukung Unit & Box Utuh:</strong> Scan Tag satuan (<code>IN_STOCK</code>) maupun Master EPC Box (<code>IN_RACK</code>) untuk masuk ke keranjang sesuai harga produk.</li>
                  <li><strong className="text-foreground">Checkout Otomatis Otorisasi Gerbang:</strong> Saat pembayaran selesai, status item berubah menjadi <code>AUTHORIZED_OUT</code> (dan Box menjadi <code>SHIPPED</code>) serta menerbitkan Gate Pass otomatis sehingga pelanggan bisa langsung melewati gerbang keluar.</li>
                  <li><strong className="text-foreground">Retur Barang (Pos Retur):</strong> Barang yang dikembalikan pelanggan dapat diproses melalui menu <em>Retur POS</em> untuk mengembalikan statusnya ke <code>IN_STOCK</code> dan mencatat mutasi <code>RETURN_RESTOCK</code> di ledger.</li>
                </ul>
              </>
            )}

            {activeDoc === 'opname-gate' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Audit & Keamanan Fisik</Badge>
                    <h3 className="text-xl font-bold text-foreground">Opname Handheld & Portal Gate Security</h3>
                  </div>
                  <div className="flex gap-2">
                    {jumpButton('rfid-opname', 'Opname Handheld')}
                    {jumpButton('gate-security', 'Keamanan & Pass')}
                  </div>
                </div>
                <div className="space-y-4 text-muted-foreground">
                  <div>
                    <h4 className="font-bold text-foreground mb-1">1. Stock Opname Handheld (Per Zona)</h4>
                    <p>Pilih zona rak lalu mulai sesi Opname. Sistem menghitung ekspektasi gabungan <strong>Tag Satuan (<code>IN_STOCK</code>) + Box (<code>IN_RACK</code>)</strong> di zona tersebut. Hasil scan otomatis mendeteksi barang <code>MATCH</code>, <code>MISSING</code>, dan <code>MISPLACED</code> (salah zona), lalu menunggu persetujuan <code>SUPERVISOR</code> untuk rekonsiliasi ledger.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">2. Sensor Gerbang RFID & Gate Pass</h4>
                    <p>Di menu <em>Keamanan & Pass</em>, petugas dapat memverifikasi Gate Pass atau langsung memindai EPC barang/Box dari Meja Packing & Kasir:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li><strong className="text-emerald-600 dark:text-emerald-400">Lampu Hijau (AUTHORIZED_OUT / Box SHIPPED):</strong> Barang resmi keluar (<code>EXITED</code>) dan Gate Pass ditandai <code>USED</code> jika seluruh muatan sudah keluar.</li>
                      <li><strong className="text-destructive">Alarm Sirine Breach (IN_STOCK / RESERVED / Box IN_RACK):</strong> Mengaktifkan insiden <code>CRITICAL</code> ke tabel <code>alarms</code> & broadcast MQTT <code>wms/gate/alarm</code>.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {activeDoc === 'tech-ref' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Arsitektur Teknis</Badge>
                    <h3 className="text-xl font-bold text-foreground">API, EMQX MQTT & Supabase PostgreSQL</h3>
                  </div>
                </div>
                <div className="space-y-4">
                  <Callout title="Koneksi Database & Broker">
                    Backend Fastify berjalan di <code>http://localhost:5000</code> dengan koneksi <strong>Supabase Cloud Pooler (port 6543)</strong> yang dilengkapi <em>TCP Keep-Alive & auto-retry</em>, serta broker <strong>EMQX MQTT</strong> (TCP <code>1883</code> & WebSocket <code>8083</code>).
                  </Callout>
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left font-semibold text-muted-foreground">
                          <th className="p-3">Topik MQTT / Endpoint</th>
                          <th className="p-3">Kegunaan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono">
                        <tr><td className="p-3">wms/stock/realtime</td><td className="p-3 font-sans text-muted-foreground">Pembaruan stok langsung setelah Putaway, Box, Outbound, & Opname.</td></tr>
                        <tr><td className="p-3">wms/pos/live-scan</td><td className="p-3 font-sans text-muted-foreground">Stream pembacaan RFID Desktop langsung ke keranjang Kasir POS.</td></tr>
                        <tr><td className="p-3">wms/gate/alarm & wms/gate/exit</td><td className="p-3 font-sans text-muted-foreground">Notifikasi real-time insiden sirine breach atau barang sah keluar gerbang.</td></tr>
                        <tr><td className="p-3">GET /api/dashboard/summary</td><td className="p-3 font-sans text-muted-foreground">KPI stok konsisten (In-Rack, Staging, Ledger), grafik 7/30 hari, & analitik real-time.</td></tr>
                        <tr><td className="p-3">GET/PUT/DELETE /api/locations</td><td className="p-3 font-sans text-muted-foreground">Denah rak beserta isi Box & Tag, edit kapasitas, dan hapus rak kosong.</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeDoc === 'faq' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">Bantuan Cepat</Badge>
                    <h3 className="text-xl font-bold text-foreground">FAQ & Troubleshooting</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <Callout title="Q: Mengapa barang yang baru di-tagging belum bisa di-Picking atau dijual di POS?">
                    Barang baru di-encode berstatus <code>ENCODED</code> (masih di Staging Inbound). Lakukan <strong>Putaway</strong> terlebih dahulu di menu <em>Penyimpanan Rak</em> (atau <em>Master Box</em> untuk kemasan karton) hingga berstatus <code>IN_STOCK</code> / <code>IN_RACK</code>.
                  </Callout>
                  <Callout title="Q: Kenapa angka Saldo Ledger berbeda dengan Siap di Rak?">
                    <strong>Siap di Rak</strong> hanya menghitung unit fisik yang tersedia di rak saat ini (<code>IN_STOCK</code> + <code>IN_RACK</code>), sedangkan <strong>Saldo Ledger</strong> mencatat total akumulasi histori mutasi termasuk barang di Staging atau yang sudah dialokasikan (<code>RESERVED</code>).
                  </Callout>
                  <Callout tone="warn" title="Q: Muncul Alarm Sirine saat uji gerbang, bagaimana mengatasinya?">
                    Pastikan barang sudah melewati proses <strong>Checkout POS</strong>, <strong>Selesai Packing</strong>, atau diterbitkan <strong>Pengiriman & Gate Pass</strong> agar statusnya berubah menjadi <code>AUTHORIZED_OUT</code> sebelum melintasi portal gerbang.
                  </Callout>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
