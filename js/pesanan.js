/* ================================================
   RAS-REPAIR — pesanan.js
   Semua function pakai prefix "pes" / "pes-"
   Client Supabase: window._pesDb
   ================================================ */

// ── Konfigurasi Supabase ─────────────────────────
const PES_SUPABASE_URL = 'https://hwkhkgimarefsombgmwn.supabase.co';
const PES_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a2hrZ2ltYXJlZnNvbWJnbXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTc0ODEsImV4cCI6MjA5MTU3MzQ4MX0.icCN7QfuKdXuTUU5G2DNB_Xed4BeLRJI1TY_VZusNBU';

(function pesInitSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.warn('[pesanan.js] Supabase CDN belum di-load!');
    return;
  }
  window._pesDb = window.supabase.createClient(PES_SUPABASE_URL, PES_SUPABASE_KEY);
})();

// ================================================
// 📋 KONSTANTA
// ================================================
const PES_STATUS_LIST = ['masuk', 'proses perbaikan', 'siap diambil', 'selesai'];

const PES_STATUS_LABELS = {
  'masuk'            : 'Masuk',
  'proses perbaikan' : 'Proses Perbaikan',
  'siap diambil'     : 'Siap Diambil',
  'selesai'          : 'Selesai',
};

const PES_STATUS_CSS = {
  'masuk'            : 'pes-status-blue',
  'proses perbaikan' : 'pes-status-yellow',
  'siap diambil'     : 'pes-status-purple',
  'selesai'          : 'pes-status-green',
};

const PES_NOTA_STATUS_STYLE = {
  'masuk'            : 'background:var(--pes-blue-50);color:var(--pes-blue-700);border-color:var(--pes-blue-200)',
  'proses perbaikan' : 'background:var(--pes-yellow-50);color:var(--pes-yellow-600);border-color:var(--pes-yellow-100)',
  'siap diambil'     : 'background:var(--pes-purple-50);color:var(--pes-purple-600);border-color:var(--pes-purple-100)',
  'selesai'          : 'background:var(--pes-green-50);color:var(--pes-green-600);border-color:var(--pes-green-100)',
};

const PES_PER_PAGE = 10;

// ── State ────────────────────────────────────────
let _pesAllOrders   = [];   // semua data dari Supabase
let _pesFiltered    = [];   // setelah filter tab + search
let _pesCurrentPage = 1;
let _pesActiveTab   = 'semua';

// ================================================
// 🛠️  HELPERS
// ================================================
function pesSetTeks(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function pesShowEl(id, display = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

function pesHideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function pesVisible(id) {
  document.getElementById(id)?.classList.add('pes-visible');
}

function pesSembEl(id) {
  document.getElementById(id)?.classList.remove('pes-visible');
}

function pesEscHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function pesBuildTimelineHtml(o) {
  const waktuMap = {
    'masuk'            : o.waktu_masuk,
    'proses perbaikan' : o.waktu_proses,
    'siap diambil'     : o.waktu_siap,
    'selesai'          : o.waktu_selesai,
  };

  const idxAktif = PES_STATUS_LIST.indexOf(o.status);

  const timelineHtml = PES_STATUS_LIST.map((s, idx) => {
    let state = 'tl-pending';
    if (idx < idxAktif)   state = 'tl-done';
    if (idx === idxAktif) state = 'tl-active';

    const dotIsi    = state === 'tl-done' ? '✓' : (idx + 1);
    const waktuTeks = waktuMap[s] ? pesFormatTanggal(waktuMap[s]) : '—';

    return `
      <div class="pes-tl-item">
        <div class="pes-tl-dot ${state}">${dotIsi}</div>
        <span class="pes-tl-label ${state === 'tl-pending' ? 'tl-pending' : ''}">
          ${PES_STATUS_LABELS[s]}
        </span>
        <span class="pes-tl-waktu ${state}">${waktuTeks}</span>
      </div>
    `;
  }).join('');

  return `<div class="pes-timeline-inner">${timelineHtml}</div>`;
}

function pesFormatTanggal(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta', hour12: false,
  }) + ' WIB';
}

function pesToast(msg, tipe = 'ok') {
  const el = document.getElementById('pes-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `pes-toast pes-visible pes-toast-${tipe}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('pes-visible'), 3500);
}

function pesCopyResi(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); pesToast('✓ Resi ' + text + ' disalin!'); }
    catch { pesToast('Gagal menyalin', 'err'); }
    document.body.removeChild(ta);
  };
  if (!navigator.clipboard) { fallback(); return; }
  navigator.clipboard.writeText(text)
    .then(() => pesToast('✓ Resi ' + text + ' disalin!'))
    .catch(fallback);
}

// ================================================
// 📦 LOAD DATA
// ================================================
async function pesMuatOrder() {
  pesHideEl('pes-table-wrap');
  pesSembEl('pes-empty');
  pesHideEl('pes-pagination');
  pesVisible('pes-loading');

  const { data, error } = await window._pesDb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  pesSembEl('pes-loading');

  if (error) {
    pesToast('Gagal memuat data: ' + error.message, 'err');
    return;
  }

  _pesAllOrders = data || [];
  // Expose ke global supaya biaya.js bisa akses dari tombol 💰
  window._pesAllOrders = _pesAllOrders;
  pesUpdateBadges(_pesAllOrders);
  pesFilter();
}

// ── Update angka badge di tab ────────────────────
function pesUpdateBadges(orders) {
  pesSetTeks('pes-badge-semua',   orders.length);
  pesSetTeks('pes-badge-masuk',   orders.filter(o => o.status === 'masuk').length);
  pesSetTeks('pes-badge-proses',  orders.filter(o => o.status === 'proses perbaikan').length);
  pesSetTeks('pes-badge-siap',    orders.filter(o => o.status === 'siap diambil').length);
  pesSetTeks('pes-badge-selesai', orders.filter(o => o.status === 'selesai').length);
}

// ================================================
// 🔍 FILTER (tab + search)
// ================================================
function pesFilter() {
  const kw = (document.getElementById('pes-search')?.value || '').toLowerCase().trim();

  // 1. Filter by tab
  let hasil = _pesActiveTab === 'semua'
    ? [..._pesAllOrders]
    : _pesAllOrders.filter(o => o.status === _pesActiveTab);

  // 2. Filter by search keyword
  if (kw) {
    hasil = hasil.filter(o =>
      o.resi.toLowerCase().includes(kw)           ||
      o.nama_customer.toLowerCase().includes(kw)  ||
      o.nama_device.toLowerCase().includes(kw)    ||
      o.layanan.toLowerCase().includes(kw)        ||
      o.keluhan.toLowerCase().includes(kw)
    );
  }

  _pesFiltered    = hasil;
  _pesCurrentPage = 1; // reset ke halaman 1 setiap filter berubah
  pesRenderHalaman();
}

// ================================================
// 📄 TAB
// ================================================
/**
 * Aktifkan tab yang diklik
 * @param {HTMLElement} tabEl
 */
function pesPilihTab(tabEl) {
  // Update state
  _pesActiveTab = tabEl.dataset.filter;

  // Update visual active
  document.querySelectorAll('.pes-tab').forEach(t => t.classList.remove('pes-tab-active'));
  tabEl.classList.add('pes-tab-active');

  // Reset search & filter ulang
  const searchEl = document.getElementById('pes-search');
  if (searchEl) searchEl.value = '';

  pesFilter();
}

// ================================================
// 📊 RENDER TABEL + PAGINATION
// ================================================
function pesRenderHalaman() {
  const total      = _pesFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PES_PER_PAGE));

  // Guard: pastikan halaman tidak melebihi total
  if (_pesCurrentPage > totalPages) _pesCurrentPage = totalPages;

  const start   = (_pesCurrentPage - 1) * PES_PER_PAGE;
  const end     = Math.min(start + PES_PER_PAGE, total);
  const pageData= _pesFiltered.slice(start, end);

  // Update info
  const infoEl = document.getElementById('pes-result-info');
  if (infoEl) {
    infoEl.textContent = total === 0
      ? 'Tidak ada data'
      : `Menampilkan ${start + 1}–${end} dari ${total} pesanan`;
  }

  // Empty state
  if (total === 0) {
    pesHideEl('pes-table-wrap');
    pesHideEl('pes-pagination');
    pesVisible('pes-empty');
    return;
  }

  pesSembEl('pes-empty');
  pesShowEl('pes-table-wrap');
  pesShowEl('pes-pagination', 'flex');

  pesRenderBaris(pageData, start);
  pesRenderPaginasi(totalPages);
}

/**
 * Render baris tabel dari slice data
 * @param {Array} data - Potongan data untuk halaman ini
 * @param {number} offset - Nomor urut awal (untuk kolom #)
 */
function pesRenderBaris(data, offset) {
  const tbody   = document.getElementById('pes-tbody');
  if (!tbody) return;

  tbody.innerHTML = data.map((o, i) => {
    return `
  <tr id="pes-row-${o.id}">
    <td style="color:var(--pes-gray-400); font-size:0.8rem; font-weight:600;">
      ${offset + i + 1}
    </td>
    <td>
      <div class="pes-resi-cell">
        <code class="pes-resi-code">${pesEscHtml(o.resi)}</code>
        <button class="pes-btn-copy" onclick="pesCopyResi('${pesEscHtml(o.resi)}')" title="Salin resi">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    </td>
    <td>${pesEscHtml(o.nama_customer)}</td>
    <td>${pesEscHtml(o.nama_device)}</td>
    <td>${pesEscHtml(o.layanan)}</td>
    <td>
      <span class="pes-keluhan-cell" title="${pesEscHtml(o.keluhan)}">
        ${pesEscHtml(o.keluhan)}
      </span>
    </td>
    <td>
      <span class="pes-status-badge ${PES_STATUS_CSS[o.status] || ''}">
        ${PES_STATUS_LABELS[o.status] || o.status}
      </span>
    </td>
    <td>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="white-space:nowrap; color:var(--pes-gray-400); font-size:0.78rem;">
          ${pesFormatTanggal(o.created_at)}
        </span>
        <button
          class="pes-expand-btn"
          id="pes-exp-btn-${o.id}"
          onclick="pesBukaTimelineModal(${o.id})"
          title="Lihat timeline status"
        >▶</button>
      </div>
    </td>
    <td>
      <div class="d-flex gap-1 flex-wrap">
        <button class="pes-btn pes-btn-secondary pes-btn-sm"
          onclick="pesBukaModal(${o.id})">Edit</button>
        <button class="pes-btn pes-btn-danger pes-btn-sm"
          onclick="pesHapus(${o.id}, '${pesEscHtml(o.resi)}')">Hapus</button>
        <button class="pes-btn pes-btn-print pes-btn-sm"
          onclick="pesCetakNota(${o.id})">🖨️</button>
        <button class="pes-btn pes-btn-secondary pes-btn-sm"
          onclick="biayaBukaModalById(${o.id})">💰</button>
      </div>
    </td>
  </tr>
`;
  }).join('');
}

// ================================================
// ⏱️  MODAL TIMELINE
// ================================================
function pesBukaTimelineModal(id) {
  const o = _pesAllOrders.find(x => x.id === id);
  if (!o) return;

  pesSetTeks('pes-tl-resi', o.resi || '');
  pesSetTeks('pes-tl-nama', o.nama_customer || '');
  pesSetTeks('pes-tl-device', o.nama_device || '');

  const statusEl = document.getElementById('pes-tl-status');
  if (statusEl) {
    statusEl.textContent = PES_STATUS_LABELS[o.status] || o.status || '';
    statusEl.className = `pes-status-badge ${PES_STATUS_CSS[o.status] || ''}`;
  }

  const wrap = document.getElementById('pes-timeline-content');
  if (wrap) wrap.innerHTML = pesBuildTimelineHtml(o);

  pesVisible('pes-timeline-overlay');
  document.body.style.overflow = 'hidden';
}

function pesTutupTimelineModal(e) {
  if (e && e.target !== document.getElementById('pes-timeline-overlay')) return;
  pesSembEl('pes-timeline-overlay');
  document.body.style.overflow = '';
}
/**
 * Render tombol-tombol halaman pagination
 * @param {number} totalPages
 */
function pesRenderPaginasi(totalPages) {
  const infoEl = document.getElementById('pes-pag-info');
  const btnsEl = document.getElementById('pes-pag-btns');
  if (!infoEl || !btnsEl) return;

  infoEl.textContent = `Halaman ${_pesCurrentPage} dari ${totalPages}`;

  // Tentukan range halaman yang tampil (maks 5 tombol)
  let startPage = Math.max(1, _pesCurrentPage - 2);
  let endPage   = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

  let html = '';

  // Tombol Prev
  html += `<button class="pes-page-btn" onclick="pesGantiHalaman(${_pesCurrentPage - 1})"
    ${_pesCurrentPage === 1 ? 'disabled' : ''}>‹</button>`;

  // Tombol nomor halaman
  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="pes-page-btn ${p === _pesCurrentPage ? 'pes-page-active' : ''}"
      onclick="pesGantiHalaman(${p})">${p}</button>`;
  }

  // Tombol Next
  html += `<button class="pes-page-btn" onclick="pesGantiHalaman(${_pesCurrentPage + 1})"
    ${_pesCurrentPage === totalPages ? 'disabled' : ''}>›</button>`;

  btnsEl.innerHTML = html;
}

/**
 * Ganti halaman aktif
 * @param {number} page
 */
function pesGantiHalaman(page) {
  const totalPages = Math.ceil(_pesFiltered.length / PES_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  _pesCurrentPage = page;
  pesRenderHalaman();

  // Scroll ke atas tabel
  document.getElementById('pes-table-wrap')?.scrollIntoView({
    behavior: 'smooth', block: 'nearest',
  });
}

// ================================================
// ✏️  MODAL EDIT
// ================================================
/**
 * Buka modal edit dan isi dengan data order
 * @param {number} id
 */
function pesBukaModal(id) {
  const o = _pesAllOrders.find(o => o.id === id);
  if (!o) return;

  document.getElementById('pes-edit-id').value      = o.id;
  document.getElementById('pes-edit-resi').value    = o.resi;
  document.getElementById('pes-edit-nama').value    = o.nama_customer;
  document.getElementById('pes-edit-device').value  = o.nama_device;
  document.getElementById('pes-edit-layanan').value = o.layanan;
  document.getElementById('pes-edit-keluhan').value = o.keluhan;
  document.getElementById('pes-edit-status').value  = o.status;

  pesSembEl('pes-edit-error');
  pesVisible('pes-modal-overlay');
  document.body.style.overflow = 'hidden';
}

/**
 * Tutup modal edit
 * @param {Event} e - Jika click overlay, tutup hanya jika klik di luar modal
 */
function pesTutupModal(e) {
  if (e && e.target !== document.getElementById('pes-modal-overlay')) return;
  pesSembEl('pes-modal-overlay');
  document.body.style.overflow = '';
}

/**
 * Submit form edit — UPDATE ke Supabase
 */
async function pesSubmitEdit(e) {
  if (e) e.preventDefault();
  pesSembEl('pes-edit-error');

  const id      = document.getElementById('pes-edit-id').value;
  const nama    = document.getElementById('pes-edit-nama').value.trim();
  const device  = document.getElementById('pes-edit-device').value.trim();
  const layanan = document.getElementById('pes-edit-layanan').value.trim();
  const keluhan = document.getElementById('pes-edit-keluhan').value.trim();
  const status  = document.getElementById('pes-edit-status').value;

  // Validasi
  if (!nama)    { pesShowError('Nama customer wajib diisi!'); return; }
  if (!device)  { pesShowError('Nama perangkat wajib diisi!'); return; }
  if (!layanan) { pesShowError('Jenis layanan wajib diisi!'); return; }
  if (!keluhan) { pesShowError('Keluhan wajib diisi!'); return; }

  const btn = document.getElementById('pes-edit-save-btn');
  const ori = btn.textContent;
  btn.textContent = 'Menyimpan...';
  btn.disabled    = true;

  const kolomWaktu = {
    'masuk'            : 'waktu_masuk',
    'proses perbaikan' : 'waktu_proses',
    'siap diambil'     : 'waktu_siap',
    'selesai'          : 'waktu_selesai',
  };
  
  const orderLama    = window._pesAllOrders.find(o => o.id === parseInt(id));
  const statusBerubah = orderLama && orderLama.status !== status;
  
  const payload = { nama_customer: nama, nama_device: device, layanan, keluhan, status };
  
  if (statusBerubah) {
    const kolom = kolomWaktu[status];
    if (kolom) payload[kolom] = new Date().toISOString();
  }
  
  const { error } = await window._pesDb
    .from('orders')
    .update(payload)
    .eq('id', parseInt(id));

  btn.textContent = ori;
  btn.disabled    = false;

  if (error) {
    pesShowError('Gagal menyimpan: ' + error.message);
    return;
  }

  pesToast('✓ Order berhasil diperbarui!');
  pesTutupModal();
  pesMuatOrder(); // reload data
}

function pesShowError(msg) {
  const el = document.getElementById('pes-edit-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('pes-visible');
}

// ================================================
// 🗑️  HAPUS
// ================================================
async function pesHapus(id, resi) {
  // Legacy: sebelumnya pakai confirm(). Sekarang gunakan modal.
  pesBukaHapusModal(id, resi);
}

let _pesPendingDelete = null; // { id, resi }

function pesBukaHapusModal(id, resi) {
  _pesPendingDelete = { id, resi };
  pesSetTeks('pes-del-resi', resi || '');
  pesSembEl('pes-del-error');
  pesVisible('pes-del-overlay');
  document.body.style.overflow = 'hidden';
}

function pesTutupHapusModal(e) {
  if (e && e.target !== document.getElementById('pes-del-overlay')) return;
  pesSembEl('pes-del-overlay');
  document.body.style.overflow = '';
  _pesPendingDelete = null;
}

async function pesHapusKonfirmasi() {
  if (!_pesPendingDelete) return;
  pesSembEl('pes-del-error');

  const okBtn = document.getElementById('pes-del-ok-btn');
  const cancelBtn = document.getElementById('pes-del-cancel-btn');
  const oriOk = okBtn?.textContent;
  if (okBtn) { okBtn.textContent = 'Menghapus...'; okBtn.disabled = true; }
  if (cancelBtn) cancelBtn.disabled = true;

  const { id } = _pesPendingDelete;

  const { error } = await window._pesDb
    .from('orders').delete().eq('id', id);

  if (okBtn) { okBtn.textContent = oriOk || 'Hapus'; okBtn.disabled = false; }
  if (cancelBtn) cancelBtn.disabled = false;

  if (error) {
    const el = document.getElementById('pes-del-error');
    if (el) {
      el.textContent = 'Gagal menghapus: ' + error.message;
      el.classList.add('pes-visible');
    } else {
      pesToast('Gagal menghapus!', 'err');
    }
    return;
  }

  pesToast('✓ Order berhasil dihapus!');
  pesTutupHapusModal();
  pesMuatOrder();
}

// ================================================
// 🖨️  CETAK NOTA
// ================================================
function pesCetakNota(id) {
  const o = _pesAllOrders.find(o => o.id === id);
  if (!o) return;

  document.getElementById('pes-nota-resi').textContent    = o.resi;
  document.getElementById('pes-nota-nama').textContent    = o.nama_customer;
  document.getElementById('pes-nota-device').textContent  = o.nama_device;
  document.getElementById('pes-nota-layanan').textContent = o.layanan;
  document.getElementById('pes-nota-keluhan').textContent = o.keluhan;
  document.getElementById('pes-nota-tgl').textContent     = pesFormatTanggal(o.created_at);

  const statusEl = document.getElementById('pes-nota-status');
  statusEl.textContent   = PES_STATUS_LABELS[o.status] || o.status;
  statusEl.style.cssText = PES_NOTA_STATUS_STYLE[o.status] || '';

  pesVisible('pes-nota-overlay');
  document.body.style.overflow = 'hidden';
}

function pesTutupNota(e) {
  if (e && e.target !== document.getElementById('pes-nota-overlay')) return;
  pesSembEl('pes-nota-overlay');
  document.body.style.overflow = '';
}

async function pesDownloadNota() {
  const el  = document.getElementById('pes-nota-wrap');
  const btn = document.getElementById('pes-nota-dl-btn');

  btn.textContent = 'Memproses...';
  btn.disabled    = true;

  try {
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
    });
    const resi    = document.getElementById('pes-nota-resi').textContent || 'nota';
    const link    = document.createElement('a');
    link.download = `nota-${resi}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    pesToast('Gagal membuat gambar nota!', 'err');
    console.error('[pesDownloadNota]', err);
  } finally {
    btn.textContent = '⬇️ Download';
    btn.disabled    = false;
  }
}

// ================================================
// 🔗 LINK DARI ADMIN.HTML
// ================================================
/**
 * admin.html mengirim filter aktif via URL parameter:
 * pesanan.html?filter=masuk
 * pesanan.html?filter=proses+perbaikan
 * dll.
 *
 * Fungsi ini membaca param dan mengaktifkan tab yang sesuai.
 */
function pesAmbilFilterDariURL() {
  const params = new URLSearchParams(window.location.search);
  const filter = params.get('filter');
  if (!filter) return;

  const tabEl = document.querySelector(`.pes-tab[data-filter="${filter}"]`);
  if (tabEl) pesPilihTab(tabEl);
}

// ================================================
// 🚀 INIT
// ================================================
document.addEventListener('DOMContentLoaded', async function pesInit() {
  if (!document.getElementById('pes-tbody')) return;

  // Cek login — halaman ini butuh auth
  const { data: { session } } = await window._pesDb.auth.getSession();
  if (!session) {
    // Redirect ke login jika belum login
    window.location.href = 'admin.html';
    return;
  }

  // Baca filter dari URL (dari klik stat card di admin)
  pesAmbilFilterDariURL();

  // Muat data
  pesMuatOrder();
});
