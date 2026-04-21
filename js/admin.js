/* ================================================
   RAS-REPAIR — admin.js
   Semua function pakai prefix "adm" supaya tidak
   bentrok dengan custom.js / scripts.js yang lama.
   Client Supabase disimpan di window._admDb.
   ================================================ */

// ── Konfigurasi Supabase — wajib diisi ──────────
const ADM_SUPABASE_URL = 'https://hwkhkgimarefsombgmwn.supabase.co';
const ADM_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a2hrZ2ltYXJlZnNvbWJnbXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTc0ODEsImV4cCI6MjA5MTU3MzQ4MX0.icCN7QfuKdXuTUU5G2DNB_Xed4BeLRJI1TY_VZusNBU';

// Init client — disimpan di window._admDb supaya
// tidak bentrok dengan variabel "db" lain di custom.js
(function admInitSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.warn('[admin.js] Supabase CDN belum di-load!');
    return;
  }
  window._admDb = window.supabase.createClient(ADM_SUPABASE_URL, ADM_SUPABASE_KEY);
})();

// ================================================
// 📋 KONSTANTA STATUS
// ================================================
const ADM_STATUS_LIST = ['masuk', 'proses perbaikan', 'siap diambil', 'selesai'];

const ADM_STATUS_LABELS = {
  'masuk'            : 'Masuk',
  'proses perbaikan' : 'Proses Perbaikan',
  'siap diambil'     : 'Siap Diambil',
  'selesai'          : 'Selesai',
};

const ADM_STATUS_COLORS = {
  'masuk'            : 'adm-status-blue',
  'proses perbaikan' : 'adm-status-yellow',
  'siap diambil'     : 'adm-status-purple',
  'selesai'          : 'adm-status-green',
};

// Cache lokal data tabel
window._admOrders = [];  // dan semua referensi _admOrders → window._admOrders

// ================================================
// 🛠️  HELPER UTILITIES
// ================================================
function admSetTeks(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function admTampilError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('adm-visible');
}

function admSembError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('adm-visible');
}

function admToast(msg, tipe = 'ok') {
  const el = document.getElementById('adm-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `adm-toast adm-visible adm-toast-${tipe}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('adm-visible'), 3500);
}

function admEscHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Copy text to clipboard
 * @param {string} text
 */
function admCopyResi(text) {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      admToast('✓ Resi ' + text + ' berhasil disalin!', 'ok');
    } catch (err) {
      admToast('Gagal menyalin resi', 'err');
    }
    document.body.removeChild(textarea);
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    admToast('✓ Resi ' + text + ' berhasil disalin!', 'ok');
  }).catch(() => {
    admToast('Gagal menyalin resi', 'err');
  });
}

function admFormatTanggal(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day    : '2-digit',
    month  : 'short',
    year   : 'numeric',
    hour   : '2-digit',
    minute : '2-digit',
    timeZone      : 'Asia/Jakarta',
    hour12 : false,
  }) + ' WIB';
}

function admShowEl(id, display = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

function admHideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ================================================
// 🎰 GENERATE RESI
// ================================================
/**
 * Generate nomor resi unik format SAM-XXXXXXXX
 * Isi otomatis ke input#adm-resi
 */
function admGenerateResi() {
  const digits = Math.floor(10000000 + Math.random() * 90000000);
  const resi   = `SAM-${digits}`;
  const input  = document.getElementById('adm-resi');
  if (input) input.value = resi;
  return resi;
}

// ================================================
// 🔐 AUTH
// ================================================

/**
 * Handler submit form login
 */
async function admLogin(e) {
  e.preventDefault();
  admSembError('adm-login-error');

  const email    = document.getElementById('adm-email').value.trim();
  const password = document.getElementById('adm-password').value;
  const btn      = document.getElementById('adm-login-btn');

  if (!email || !password) {
    admTampilError('adm-login-error', 'Email dan password wajib diisi!');
    return;
  }

  btn.textContent = 'Memproses...';
  btn.disabled    = true;

  const { data, error } = await window._admDb.auth.signInWithPassword({ email, password });

  btn.textContent = 'Masuk ke Dashboard';
  btn.disabled    = false;

  if (error) {
    admTampilError('adm-login-error', 'Email atau password salah. Silakan coba lagi.');
    return;
  }

  admTampilDashboard(data.user);
}

/**
 * Handler tombol Keluar
 */
async function admLogout() {
  await window._admDb.auth.signOut();
  admHideEl('adm-dashboard-section');
  admShowEl('adm-login-section');
  document.getElementById('adm-email').value    = '';
  document.getElementById('adm-password').value = '';
}

/**
 * Tampilkan dashboard setelah login
 * @param {Object} user
 */
function admTampilDashboard(user) {
  admHideEl('adm-login-section');
  admShowEl('adm-dashboard-section');
  admSetTeks('adm-info-email', user.email);
  admMuatOrder();
  admGenerateResi();
}

// ================================================
// 📊 LOAD & RENDER DATA
// ================================================

/**
 * Ambil semua order dari Supabase
 * SELECT * FROM orders ORDER BY created_at DESC
 */
async function admMuatOrder() {
  admHideEl('adm-tbl-wrap');
  admHideEl('adm-tbl-empty');
  admShowEl('adm-tbl-loading', 'flex');

  const { data, error } = await window._admDb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  admHideEl('adm-tbl-loading');

  if (error) {
    admToast('Gagal memuat data: ' + error.message, 'err');
    console.error('[admin.js] Load error:', error);
    return;
  }

  // Sinkronkan cache lokal & global (dipakai oleh biaya.js)
  _admOrders = window._admOrders = data || [];
  admRenderTabel(_admOrders);
  admUpdateStats(_admOrders);
}

/**
 * Render baris tabel
 * @param {Array} orders
 */
function admRenderTabel(orders) {
  const tbody = document.getElementById('adm-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    admShowEl('adm-tbl-empty');
    admHideEl('adm-tbl-wrap');
    return;
  }

  admHideEl('adm-tbl-empty');
  admShowEl('adm-tbl-wrap');

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>
        <div class="adm-resi-cell">
          <code class="adm-resi-code">${admEscHtml(o.resi)}</code>
          <button class="adm-btn-copy" onclick="admCopyResi('${admEscHtml(o.resi)}')" title="Salin nomor resi">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </td>
      <td>${admEscHtml(o.nama_customer)}</td>
      <td>${admEscHtml(o.nama_device)}</td>
      <td>${admEscHtml(o.layanan)}</td>
      <td>
        <select
          class="adm-status-select ${ADM_STATUS_COLORS[o.status] || ''}"
          onchange="admQuickStatus(${o.id}, this.value)"
        >
          ${ADM_STATUS_LIST.map(s => `
            <option value="${s}" ${s === o.status ? 'selected' : ''}>
              ${ADM_STATUS_LABELS[s]}
            </option>
          `).join('')}
        </select>
      </td>
      <td style="white-space:nowrap; color:var(--adm-gray-400); font-size:0.82rem;">
        ${admFormatTanggal(o.created_at)}
      </td>
      <td>
<div class="d-flex gap-1">
  <button class="adm-btn adm-btn-secondary adm-btn-sm"
    onclick="admEditOrder(${o.id})">Edit</button>
  <button class="adm-btn adm-btn-danger adm-btn-sm"
    onclick="admHapusOrder(${o.id}, '${admEscHtml(o.resi)}')">Hapus</button>
  <button class="adm-btn adm-btn-print adm-btn-sm"
    onclick="admCetakNota(${o.id})">🖨️</button>
    <button class="adm-btn adm-btn-secondary adm-btn-sm"
  onclick="biayaBukaModalById(${o.id})">💰</button>
</div>
      </td>
    </tr>
  `).join('');
}

/**
 * Update angka statistik
 * @param {Array} orders
 */
function admUpdateStats(orders) {
  admSetTeks('adm-stat-total',   orders.length);
  admSetTeks('adm-stat-masuk',   orders.filter(o => o.status === 'masuk').length);
  admSetTeks('adm-stat-proses',  orders.filter(o => o.status === 'proses perbaikan').length);
  admSetTeks('adm-stat-siap',    orders.filter(o => o.status === 'siap diambil').length);
  admSetTeks('adm-stat-selesai', orders.filter(o => o.status === 'selesai').length);
}

// Buat stat card bisa diklik → ke pesanan.html dengan filter aktif
document.querySelectorAll('.adm-stat-card').forEach(card => {
  card.style.cursor = 'pointer';
});

document.getElementById('adm-stat-total')  ?.closest('.adm-stat-card')
  .addEventListener('click', () => location.href = 'pesanan.html');
document.getElementById('adm-stat-masuk')  ?.closest('.adm-stat-card')
  .addEventListener('click', () => location.href = 'pesanan.html?filter=masuk');
document.getElementById('adm-stat-proses') ?.closest('.adm-stat-card')
  .addEventListener('click', () => location.href = 'pesanan.html?filter=proses+perbaikan');
document.getElementById('adm-stat-siap')   ?.closest('.adm-stat-card')
  .addEventListener('click', () => location.href = 'pesanan.html?filter=siap+diambil');
document.getElementById('adm-stat-selesai')?.closest('.adm-stat-card')
  .addEventListener('click', () => location.href = 'pesanan.html?filter=selesai');
/**
 * Filter tabel berdasarkan pencarian
 */
function admFilterTabel() {
  const kw = document.getElementById('adm-search').value.toLowerCase();
  const filtered = _admOrders.filter(o =>
    o.resi.toLowerCase().includes(kw)           ||
    o.nama_customer.toLowerCase().includes(kw)  ||
    o.nama_device.toLowerCase().includes(kw)    ||
    o.layanan.toLowerCase().includes(kw)
  );
  admRenderTabel(filtered);
}

// ================================================
// 📝 FORM TAMBAH / EDIT
// ================================================

/**
 * Submit form order (tambah & edit)
 */
async function admSubmitOrder(e) {
  e.preventDefault();
  admSembError('adm-form-error');

  const id      = document.getElementById('adm-edit-id').value;
  const resi    = document.getElementById('adm-resi').value.trim();
  const nama    = document.getElementById('adm-nama').value.trim();
  const device  = document.getElementById('adm-device').value.trim();
  const layanan = document.getElementById('adm-layanan').value.trim();
  const keluhan = document.getElementById('adm-keluhan').value.trim();
  const status  = document.getElementById('adm-status').value;

  // Validasi
  if (!resi)    { admTampilError('adm-form-error', 'Nomor resi wajib di-generate!'); return; }
  if (!nama)    { admTampilError('adm-form-error', 'Nama customer wajib diisi!'); return; }
  if (!device)  { admTampilError('adm-form-error', 'Nama perangkat wajib diisi!'); return; }
  if (!layanan) { admTampilError('adm-form-error', 'Jenis layanan wajib diisi!'); return; }
  if (!keluhan) { admTampilError('adm-form-error', 'Keluhan wajib diisi!'); return; }

  const btn = document.getElementById('adm-submit-btn');
  const ori = btn.textContent;
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  const payload = {
    resi,
    nama_customer: nama,
    nama_device  : device,
    keluhan, layanan, status,
  };

  let error;

  if (id) {
    // UPDATE orders SET ... WHERE id = $id
    ({ error } = await window._admDb
      .from('orders').update(payload).eq('id', parseInt(id)));
  } else {
    // INSERT INTO orders (...) VALUES (...)
    ({ error } = await window._admDb
      .from('orders').insert([payload]));
  }

  btn.textContent = ori;
  btn.disabled    = false;

  if (error) {
    const isDup = error.message.includes('duplicate') || error.message.includes('unique');
    admTampilError('adm-form-error',
      isDup
        ? 'Nomor resi sudah digunakan! Silakan generate resi baru.'
        : 'Gagal menyimpan: ' + error.message
    );
    return;
  }

  admToast(id ? '✓ Order berhasil diperbarui!' : '✓ Order baru berhasil ditambahkan!');
  admResetForm();
  admMuatOrder();
}

/**
 * Update status langsung dari dropdown tabel
 * UPDATE orders SET status = $status WHERE id = $id
 */
async function admQuickStatus(id, status) {
  const { error } = await window._admDb
    .from('orders').update({ status }).eq('id', id);

  if (error) {
    admToast('Gagal update status!', 'err');
    admMuatOrder();
    return;
  }

  admToast('✓ Status diperbarui!');
  const order = _admOrders.find(o => o.id === id);
  if (order) {
    order.status = status;
    admUpdateStats(_admOrders);
  }
}

/**
 * Isi form dengan data order untuk diedit
 * @param {number} id
 */
function admEditOrder(id) {
  const o = _admOrders.find(o => o.id === id);
  if (!o) return;

  document.getElementById('adm-edit-id').value = o.id;
  document.getElementById('adm-resi').value    = o.resi;
  document.getElementById('adm-nama').value    = o.nama_customer;
  document.getElementById('adm-device').value  = o.nama_device;
  document.getElementById('adm-keluhan').value = o.keluhan;
  document.getElementById('adm-layanan').value = o.layanan;
  document.getElementById('adm-status').value  = o.status;

  admSetTeks('adm-form-title', '✎ Edit Order');
  document.getElementById('adm-cancel-btn').style.display  = 'inline-flex';
  document.getElementById('adm-submit-btn').textContent    = 'Perbarui Order';
  // Tampilkan tombol cetak saat mode edit
let printBtn = document.getElementById('adm-edit-print-btn');
if (!printBtn) {
  printBtn = document.createElement('button');
  printBtn.type      = 'button';
  printBtn.id        = 'adm-edit-print-btn';
  printBtn.className = 'adm-btn adm-btn-print adm-btn-sm';
  printBtn.textContent = '🖨️ Cetak Nota';
  printBtn.onclick   = () => admCetakNota(parseInt(document.getElementById('adm-edit-id').value));
  document.getElementById('adm-submit-btn').insertAdjacentElement('afterend', printBtn);
}
printBtn.style.display = 'inline-flex';
  admSembError('adm-form-error');

  document.getElementById('adm-form-card').scrollIntoView({
    behavior: 'smooth', block: 'start',
  });
}

/**
 * Batalkan mode edit
 */
function admBatalEdit() { admResetForm(); }

/**
 * Reset form ke kondisi tambah baru
 */
function admResetForm() {
  document.getElementById('adm-order-form').reset();
  document.getElementById('adm-edit-id').value              = '';
  document.getElementById('adm-cancel-btn').style.display   = 'none';
  document.getElementById('adm-submit-btn').textContent     = 'Simpan Order';
  admSetTeks('adm-form-title', 'Tambah Order Baru');
  admSembError('adm-form-error');
  admGenerateResi();
  // Sembunyikan tombol cetak saat kembali ke mode tambah
const printBtn = document.getElementById('adm-edit-print-btn');
if (printBtn) printBtn.style.display = 'none';
}

/**
 * Konfirmasi & hapus order
 * DELETE FROM orders WHERE id = $id
 */
async function admHapusOrder(id, resi) {
  if (!confirm(`Hapus order:\n${resi}\n\nTindakan ini tidak dapat dibatalkan.`)) return;

  const { error } = await window._admDb
    .from('orders').delete().eq('id', id);

  if (error) {
    admToast('Gagal menghapus!', 'err');
    return;
  }

  admToast('✓ Order berhasil dihapus!');
  admMuatOrder();
}
// ================================================
// 🖨️  CETAK NOTA
// ================================================

const ADM_NOTA_STATUS_COLORS = {
  'masuk'            : 'background:var(--adm-blue-50);color:var(--adm-blue-700);border-color:var(--adm-blue-200)',
  'proses perbaikan' : 'background:var(--adm-yellow-50);color:var(--adm-yellow-600);border-color:var(--adm-yellow-100)',
  'siap diambil'     : 'background:var(--adm-purple-50);color:var(--adm-purple-600);border-color:var(--adm-purple-100)',
  'selesai'          : 'background:var(--adm-green-50);color:var(--adm-green-600);border-color:var(--adm-green-100)',
};

/**
 * Buka modal preview nota lalu bisa cetak
 * @param {number} id
 */
function admCetakNota(id) {
  const o = _admOrders.find(o => o.id === id);
  if (!o) return;

  // Isi konten nota
  document.getElementById('adm-nota-resi').textContent    = o.resi;
  document.getElementById('adm-nota-nama').textContent    = o.nama_customer;
  document.getElementById('adm-nota-device').textContent  = o.nama_device;
  document.getElementById('adm-nota-layanan').textContent = o.layanan;
  document.getElementById('adm-nota-keluhan').textContent = o.keluhan;
  document.getElementById('adm-nota-tgl').textContent     = admFormatTanggal(o.created_at);

  const statusEl = document.getElementById('adm-nota-status');
  statusEl.textContent = ADM_STATUS_LABELS[o.status] || o.status;
  statusEl.style.cssText = ADM_NOTA_STATUS_COLORS[o.status] || '';

  // Tampilkan modal
  document.getElementById('adm-nota-overlay').classList.add('adm-visible');
  document.body.style.overflow = 'hidden';
}

/**
 * Tutup modal nota
 * @param {Event} e - Jika click di overlay (bukan modal), tutup
 */
function admTutupNota(e) {
  // Kalau dipanggil dari onclick overlay, tutup hanya jika klik di luar modal
  if (e && e.target !== document.getElementById('adm-nota-overlay')) return;

  document.getElementById('adm-nota-overlay').classList.remove('adm-visible');
  document.body.style.overflow = '';
}
/**
 * Download nota sebagai gambar PNG
 * Hasil visual sama persis dengan preview (html2canvas)
 */
async function admDownloadNota() {
  const el  = document.getElementById('adm-nota-wrap');
  const btn = document.getElementById('adm-nota-dl-btn');

  btn.textContent = 'Memproses...';
  btn.disabled    = true;

  try {
    const canvas = await html2canvas(el, {
      scale      : 2,          // 2x resolusi supaya tajam
      useCORS    : true,
      backgroundColor: '#ffffff',
    });

    // Ambil nama resi untuk nama file
    const resi = document.getElementById('adm-nota-resi').textContent || 'nota';

    const link    = document.createElement('a');
    link.download = `nota-${resi}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    admToast('Gagal membuat gambar nota!', 'err');
    console.error('[admDownloadNota]', err);
  } finally {
    btn.textContent = '⬇️ Download';
    btn.disabled    = false;
  }
}
// ================================================
// 🚀 INIT
// ================================================
document.addEventListener('DOMContentLoaded', async function admInit() {
  // Hanya jalankan di halaman yang ada elemen admin
  if (!document.getElementById('adm-login-section')) return;

  // Cek session yang sudah ada (user sebelumnya sudah login)
  const { data: { session } } = await window._admDb.auth.getSession();
  if (session) {
    admTampilDashboard(session.user);
  }
});
