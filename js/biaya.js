/* ================================================
   RAS-REPAIR — biaya.js
   Nota Biaya — prefix "biaya"
   Dipakai di admin.html DAN pesanan.html
   Pastikan Supabase sudah di-init sebelum file ini
   (window._admDb atau window._pesDb)
   ================================================

   ══════════════════════════════════════════════
   SQL — Jalankan sekali di Supabase SQL Editor:
   ══════════════════════════════════════════════

   CREATE TABLE order_biaya (
     id         BIGSERIAL PRIMARY KEY,
     order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     items      JSONB  NOT NULL DEFAULT '[]',
     total      BIGINT NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   ALTER TABLE order_biaya ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Admin full access" ON order_biaya
     FOR ALL TO authenticated USING (true) WITH CHECK (true);

   CREATE POLICY "Public read" ON order_biaya
     FOR SELECT TO anon USING (true);

   ══════════════════════════════════════════════
*/

// ================================================
// 🔌 AMBIL CLIENT SUPABASE
// Coba _admDb dulu, fallback ke _pesDb
// ================================================
function biayaGetDb() {
  return window._admDb || window._pesDb || null;
}

// ================================================
// 📋 KONSTANTA
// ================================================
const BIAYA_STATUS_LABELS = {
  'masuk'            : 'Masuk',
  'proses perbaikan' : 'Proses Perbaikan',
  'siap diambil'     : 'Siap Diambil',
  'selesai'          : 'Selesai',
};

// ── State modal ──────────────────────────────────
let _biayaOrderData  = null;  // data order yang sedang dibuka
let _biayaBiayaData  = null;  // data dari tabel order_biaya (null = belum ada)
let _biayaActiveTab  = 'input'; // 'input' | 'preview'
let _biayaItemCount  = 0;     // counter ID baris item

// ================================================
// 🛠️  HELPERS
// ================================================
function biayaRupiahFormat(angka) {
  return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function biayaParseRupiah(str) {
  // Hapus semua karakter non-digit
  return parseInt(String(str).replace(/\D/g, ''), 10) || 0;
}

function biayaFormatInput(inputEl) {
  // Saat user mengetik di input harga, format otomatis jadi "150.000"
  const raw = biayaParseRupiah(inputEl.value);
  inputEl.value = raw > 0 ? raw.toLocaleString('id-ID') : '';
}

function biayaEscHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function biayaFormatTanggal(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta', hour12: false,
  }) + ' WIB';
}

function biayaShowError(msg) {
  const el = document.getElementById('biaya-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('biaya-visible');
}

function biayaHideError() {
  document.getElementById('biaya-error')?.classList.remove('biaya-visible');
}

// ================================================
// 🚪 BUKA & TUTUP MODAL
// ================================================

/**
 * Buka modal nota biaya
 * @param {Object} order - Data order lengkap dari cache (_admOrders / _pesAllOrders)
 */
async function biayaBukaModal(order) {
  if (!order) return;

  _biayaOrderData = order;
  _biayaBiayaData = null;

  // Isi info header modal
  document.getElementById('biaya-modal-resi').textContent =
    order.resi + ' — ' + order.nama_customer;

  biayaHideError();

  // Cek apakah sudah ada data biaya di DB
  const db = biayaGetDb();
  const { data, error } = await db
    .from('order_biaya')
    .select('*')
    .eq('order_id', order.id)
    .maybeSingle();

  if (error) {
    console.error('[biaya.js] Load error:', error);
  }

  _biayaBiayaData = data || null;

  // Tampilkan tab yang sesuai
  if (_biayaBiayaData) {
    // Sudah ada data → langsung ke preview
    biayaPilihTab('preview');
  } else {
    // Belum ada → ke input form kosong
    biayaPilihTab('input');
  }

  document.getElementById('biaya-overlay').classList.add('biaya-visible');
  document.body.style.overflow = 'hidden';
}

/**
 * Tutup modal
 * @param {Event} e
 */
function biayaTutupModal(e) {
  if (e && e.target !== document.getElementById('biaya-overlay')) return;
  document.getElementById('biaya-overlay').classList.remove('biaya-visible');
  document.body.style.overflow = '';
  _biayaOrderData = null;
  _biayaBiayaData = null;
}

// ================================================
// 📑 TAB: INPUT ↔ PREVIEW
// ================================================
function biayaPilihTab(tab) {
  _biayaActiveTab = tab;

  // Update visual tab
  document.querySelectorAll('.biaya-tab').forEach(t => {
    t.classList.toggle('biaya-tab-active', t.dataset.tab === tab);
  });

  if (tab === 'input') {
    document.getElementById('biaya-input-section').style.display  = 'block';
    document.getElementById('biaya-preview-section').style.display = 'none';
    document.getElementById('biaya-footer-input').style.display   = 'flex';
    document.getElementById('biaya-footer-preview').style.display = 'none';
    biayaRenderInputForm();
  } else {
    document.getElementById('biaya-input-section').style.display  = 'none';
    document.getElementById('biaya-preview-section').style.display = 'block';
    document.getElementById('biaya-footer-input').style.display   = 'none';
    document.getElementById('biaya-footer-preview').style.display = 'flex';
    biayaRenderPreview();
  }
}

// ================================================
// ✏️  INPUT FORM
// ================================================

/**
 * Render form input item
 * Jika sudah ada data biaya → isi dengan data lama
 */
function biayaRenderInputForm() {
  const wrap = document.getElementById('biaya-items-wrap');
  if (!wrap) return;

  _biayaItemCount = 0;
  wrap.innerHTML  = '';

  const items = _biayaBiayaData?.items || [];

  if (items.length > 0) {
    items.forEach(item => biayaTambahBaris(item.nama, item.qty, item.harga));
  } else {
    // Default: 1 baris kosong
    biayaTambahBaris();
  }

  biayaHitungTotal();
}

/**
 * Tambah baris item ke form
 * @param {string} nama  - Nama item/jasa
 * @param {number} qty   - Jumlah
 * @param {number} harga - Harga satuan
 */
function biayaTambahBaris(nama = '', qty = 1, harga = 0) {
  const wrap = document.getElementById('biaya-items-wrap');
  if (!wrap) return;

  const id  = ++_biayaItemCount;
  const row = document.createElement('div');
  row.className   = 'biaya-item-row';
  row.id          = `biaya-row-${id}`;

  const hargaFmt = harga > 0 ? harga.toLocaleString('id-ID') : '';

  row.innerHTML = `
    <input
      type="text"
      class="biaya-item-input"
      id="biaya-nama-${id}"
      placeholder="Nama jasa / spare part"
      value="${biayaEscHtml(nama)}"
    >
    <input
      type="number"
      class="biaya-item-input"
      id="biaya-qty-${id}"
      placeholder="Qty"
      min="1"
      value="${qty}"
      oninput="biayaHitungTotal()"
    >
    <input
      type="text"
      class="biaya-item-input biaya-harga"
      id="biaya-harga-${id}"
      placeholder="0"
      value="${hargaFmt}"
      oninput="biayaFormatInput(this); biayaHitungTotal()"
    >
    <button class="biaya-del-btn" onclick="biayaHapusBaris(${id})" title="Hapus baris">✕</button>
  `;

  wrap.appendChild(row);
}

/**
 * Hapus baris item
 * @param {number} id
 */
function biayaHapusBaris(id) {
  document.getElementById(`biaya-row-${id}`)?.remove();
  biayaHitungTotal();
}

/**
 * Hitung total dari semua baris dan tampilkan
 */
function biayaHitungTotal() {
  const rows = document.querySelectorAll('.biaya-item-row');
  let total  = 0;

  rows.forEach(row => {
    const id     = row.id.replace('biaya-row-', '');
    const qty    = parseInt(document.getElementById(`biaya-qty-${id}`)?.value) || 0;
    const harga  = biayaParseRupiah(document.getElementById(`biaya-harga-${id}`)?.value);
    total += qty * harga;
  });

  const el = document.getElementById('biaya-total-display');
  if (el) el.textContent = biayaRupiahFormat(total);
}

/**
 * Ambil semua data item dari form
 * @returns {{ items: Array, total: number }}
 */
function biayaAmbilDataForm() {
  const rows = document.querySelectorAll('.biaya-item-row');
  const items = [];
  let total   = 0;

  rows.forEach(row => {
    const id    = row.id.replace('biaya-row-', '');
    const nama  = document.getElementById(`biaya-nama-${id}`)?.value.trim() || '';
    const qty   = parseInt(document.getElementById(`biaya-qty-${id}`)?.value) || 0;
    const harga = biayaParseRupiah(document.getElementById(`biaya-harga-${id}`)?.value);

    if (nama && qty > 0) {
      items.push({ nama, qty, harga });
      total += qty * harga;
    }
  });

  return { items, total };
}

// ================================================
// 💾 SIMPAN KE SUPABASE
// ================================================

/**
 * Simpan / update data biaya ke tabel order_biaya
 */
async function biayaSimpan() {
  biayaHideError();

  const { items, total } = biayaAmbilDataForm();

  if (items.length === 0) {
    biayaShowError('Tambahkan minimal 1 item biaya terlebih dahulu!');
    return;
  }

  const btn = document.getElementById('biaya-btn-simpan');
  const ori = btn.textContent;
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  const db      = biayaGetDb();
  const payload = {
    order_id  : _biayaOrderData.id,
    items,
    total,
    updated_at: new Date().toISOString(),
  };

  let error;

  if (_biayaBiayaData) {
    // UPDATE — sudah ada data sebelumnya
    ({ error } = await db
      .from('order_biaya')
      .update(payload)
      .eq('id', _biayaBiayaData.id)
    );
  } else {
    // INSERT — data baru
    let newData;
    ({ data: newData, error } = await db
      .from('order_biaya')
      .insert([payload])
      .select()
      .single()
    );
    if (!error) _biayaBiayaData = newData;
  }

  btn.textContent = ori;
  btn.disabled    = false;

  if (error) {
    biayaShowError('Gagal menyimpan: ' + error.message);
    console.error('[biaya.js] Save error:', error);
    return;
  }

  // Update cache biaya
  if (_biayaBiayaData) {
    _biayaBiayaData.items  = items;
    _biayaBiayaData.total  = total;
  }

  // Pindah ke tab preview
  biayaPilihTab('preview');
}

// ================================================
// 👁️  PREVIEW NOTA BIAYA
// ================================================
function biayaRenderPreview() {
  const previewEl = document.getElementById('biaya-preview-content');
  if (!previewEl || !_biayaBiayaData || !_biayaOrderData) return;

  const o     = _biayaOrderData;
  const items = _biayaBiayaData.items || [];
  const total = _biayaBiayaData.total || 0;

  // Baris tabel item
  const barisTabel = items.map((item, i) => `
    <tr>
      <td style="color:#94A3B8; font-weight:600; font-size:0.78rem;">${i + 1}</td>
      <td>${biayaEscHtml(item.nama)}</td>
      <td style="text-align:center;">${item.qty}</td>
      <td style="text-align:right;">${biayaRupiahFormat(item.harga)}</td>
      <td style="text-align:right; font-weight:700; color:#1D4ED8;">
        ${biayaRupiahFormat(item.qty * item.harga)}
      </td>
    </tr>
  `).join('');

  previewEl.innerHTML = `
    <div class="biaya-preview-header">
      <p class="biaya-preview-brand">SAMORO REPAIR</p>
      <p class="biaya-preview-alamat">
        Kabunan RT6 RW1 Ngadiwarno Kec. Sukorejo Kab. Kendal 51363<br>
        Telp. 083162294652
      </p>
      <p class="biaya-preview-sub">Nota Biaya Servis</p>
      <p class="biaya-preview-sub">${biayaFormatTanggal(_biayaBiayaData.updated_at || _biayaBiayaData.created_at)}</p>
    </div>

    <div class="biaya-preview-resi">
      <p class="biaya-preview-resi-label">No. Resi</p>
      <p class="biaya-preview-resi-val">${biayaEscHtml(o.resi)}</p>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; gap:1rem; flex-wrap:wrap; font-size:0.82rem; color:#475569;">
        <span><strong>Customer:</strong> ${biayaEscHtml(o.nama_customer)}</span>
        <span><strong>Perangkat:</strong> ${biayaEscHtml(o.nama_device)}</span>
        <span><strong>Layanan:</strong> ${biayaEscHtml(o.layanan)}</span>
      </div>
    </div>

    <table class="biaya-preview-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Item / Jasa</th>
          <th style="text-align:center; width:60px;">Qty</th>
          <th style="text-align:right; width:120px;">Harga</th>
          <th style="text-align:right; width:120px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${barisTabel}</tbody>
    </table>

    <div class="biaya-preview-total">
      <span class="biaya-preview-total-label">Total Biaya</span>
      <span class="biaya-preview-total-val">${biayaRupiahFormat(total)}</span>
    </div>

    <div class="biaya-preview-footer">
      <p>Terima kasih telah mempercayakan servis Anda kepada kami!</p>
      <p>Simpan nota ini sebagai bukti pembayaran. 🙏</p>
    </div>
  `;
}

// ================================================
// 🖨️  CETAK & DOWNLOAD
// ================================================
function biayaCetak() {
  // Salin konten preview ke area print tersembunyi
  const printEl   = document.getElementById('biaya-print-area');
  const previewEl = document.getElementById('biaya-preview-content');
  if (!printEl || !previewEl) return;

  printEl.innerHTML = previewEl.innerHTML;
  window.print();
}

async function biayaDownload() {
  const el  = document.getElementById('biaya-preview-content');
  const btn = document.getElementById('biaya-btn-download');
  if (!el || !btn) return;

  const ori        = btn.textContent;
  btn.textContent  = 'Memproses...';
  btn.disabled     = true;

  try {
    const canvas  = await html2canvas(el, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
    });
    const resi    = _biayaOrderData?.resi || 'nota-biaya';
    const link    = document.createElement('a');
    link.download = `nota-biaya-${resi}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('[biaya.js] Download error:', err);
    alert('Gagal membuat gambar. Coba lagi.');
  } finally {
    btn.textContent = ori;
    btn.disabled    = false;
  }
}

// ================================================
// 🔗 FUNGSI PUBLIK — dipanggil dari tabel admin/pesanan
// ================================================

/**
 * Dipanggil dari tombol di baris tabel
 * Cari order dari cache yang tersedia (_admOrders atau _pesAllOrders)
 * @param {number} id - ID order
 */
function biayaBukaModalById(id) {
  // Coba ambil dari cache admin dulu, lalu pesanan
  const orders = window._admOrders || window._pesAllOrders || [];
  const order  = orders.find(o => o.id === id);

  if (!order) {
    alert('Data order tidak ditemukan. Coba refresh halaman.');
    return;
  }

  biayaBukaModal(order);
}
