/* ================================================
   RAS-REPAIR — lacak.js
   Semua function pakai prefix "lacak" supaya tidak
   bentrok dengan custom.js / scripts.js yang lama.

   ══════════════════════════════════════════════
   CARA PAKAI:
   Paste isi file ini ke js/custom.js kamu,
   ATAU biarkan sebagai js/lacak.js terpisah
   (sudah di-load di lacak.html paling bawah).
   ══════════════════════════════════════════════

   KONFIGURASI SUPABASE — wajib diisi:
   ================================================ */

const LACAK_SUPABASE_URL = 'https://hwkhkgimarefsombgmwn.supabase.co';
const LACAK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3a2hrZ2ltYXJlZnNvbWJnbXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTc0ODEsImV4cCI6MjA5MTU3MzQ4MX0.icCN7QfuKdXuTUU5G2DNB_Xed4BeLRJI1TY_VZusNBU';

// ── Inisialisasi Supabase ────────────────────────
// Gunakan window._lacakDb supaya tidak bentrok
// dengan variabel "db" / "supabase" yang mungkin
// sudah ada di custom.js
(function lacakInitSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.warn('[lacak.js] Supabase CDN belum di-load!');
    return;
  }
  window._lacakDb = window.supabase.createClient(
    LACAK_SUPABASE_URL,
    LACAK_SUPABASE_KEY
  );
})();

// ================================================
// 📋 KONSTANTA STATUS
// ================================================
const LACAK_STATUS_LIST = [
  'masuk',
  'proses perbaikan',
  'siap diambil',
  'selesai',
];

const LACAK_STATUS_LABELS = {
  'masuk'            : 'Masuk',
  'proses perbaikan' : 'Proses Perbaikan',
  'siap diambil'     : 'Siap Diambil',
  'selesai'          : 'Selesai',
};

// ================================================
// 🛠️  HELPER UTILITIES
// ================================================
function lacakTampilEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('lacak-visible');
}

function lacakSembEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('lacak-visible');
}

function lacakSetTeks(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function lacakTampilError(msg) {
  const el = document.getElementById('lacak-msg-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('lacak-visible');
}

function lacakSembError() {
  const el = document.getElementById('lacak-msg-error');
  if (el) el.classList.remove('lacak-visible');
}

/**
 * Escape HTML — mencegah XSS
 */
function lacakEscHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Toast notification
 * @param {string} msg
 * @param {'ok'|'err'} tipe
 */
function lacakToast(msg, tipe = 'ok') {
  const el = document.getElementById('lacak-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `lacak-toast lacak-visible lacak-toast-${tipe}`;
  clearTimeout(el._lacakTimer);
  el._lacakTimer = setTimeout(() => {
    el.classList.remove('lacak-visible');
  }, 3500);
}

// ================================================
// 🔍 CARI ORDER — fungsi utama tracking
// ================================================
/**
 * Cari order berdasarkan nomor resi.
 * Dipanggil dari: onclick button & Enter key.
 */
async function lacakCariOrder() {
  const inputEl = document.getElementById('lacak-input-resi');
  const resi    = inputEl.value.trim().toUpperCase();

  // Reset semua state
  lacakSembError();
  lacakSembEl('lacak-result-card');
  lacakSembEl('lacak-not-found');
  lacakSembEl('lacak-loading');

  // ── Validasi ─────────────────────────────────
  if (!resi) {
    lacakTampilError('Nomor resi tidak boleh kosong!');
    inputEl.focus();
    return;
  }

  if (!/^SAM-\d{8}$/.test(resi)) {
    lacakTampilError(
      'Format resi tidak valid. Gunakan format SAM-XXXXXXXX (contoh: SAM-12345678)'
    );
    inputEl.focus();
    return;
  }

  // ── Tampilkan loading ─────────────────────────
  lacakTampilEl('lacak-loading');
  const btnEl    = document.getElementById('lacak-btn-cari');
  if (btnEl) { btnEl.textContent = 'Mencari...'; btnEl.disabled = true; }

  // ── Query Supabase ────────────────────────────
  // SELECT * FROM orders WHERE resi = $resi
  const { data, error } = await window._lacakDb
    .from('orders')
    .select('*')
    .eq('resi', resi)
    .maybeSingle(); // null jika tidak ketemu, tidak throw error

  // ── Reset loading ─────────────────────────────
  lacakSembEl('lacak-loading');
  if (btnEl) { btnEl.textContent = 'Lacak'; btnEl.disabled = false; }

  // ── Handle error koneksi ──────────────────────
  if (error) {
    lacakTampilError(
      'Terjadi kesalahan koneksi. Periksa konfigurasi Supabase dan coba lagi.'
    );
    console.error('[lacak.js] Supabase error:', error);
    return;
  }

  // ── Tidak ditemukan ───────────────────────────
  if (!data) {
    lacakTampilEl('lacak-not-found');
    return;
  }

  // ── Tampilkan hasil ───────────────────────────
  lacakTampilHasil(data);
}

// ================================================
// 🖥️  TAMPILKAN HASIL
// ================================================
/**
 * Render data order ke result card
 * @param {Object} order - Data dari Supabase
 */
function lacakTampilHasil(order) {
  lacakSetTeks('lacak-val-resi',    order.resi);
  lacakSetTeks('lacak-val-nama',    order.nama_customer);
  lacakSetTeks('lacak-val-device',  order.nama_device);
  lacakSetTeks('lacak-val-layanan', order.layanan);
  lacakSetTeks('lacak-val-keluhan', order.keluhan);

  // Status badge di header
  const badge = document.getElementById('lacak-val-status-badge');
  if (badge) {
    badge.textContent = LACAK_STATUS_LABELS[order.status] || order.status;
  }

  lacakRenderTimeline(order.status);
  lacakTampilEl('lacak-result-card');

  // Scroll halus ke result card
  setTimeout(() => {
    document.getElementById('lacak-result-card')?.scrollIntoView({
      behavior : 'smooth',
      block    : 'nearest',
    });
  }, 100);
}

// ================================================
// ⏱️  RENDER TIMELINE
// ================================================
/**
 * Render progress timeline berdasarkan status saat ini
 * @param {string} statusSaatIni
 */
function lacakRenderTimeline(statusSaatIni) {
  const container = document.getElementById('lacak-timeline');
  if (!container) return;

  const idxAktif = LACAK_STATUS_LIST.indexOf(statusSaatIni);

  container.innerHTML = LACAK_STATUS_LIST.map((status, idx) => {
    let state = 'lacak-step-pending';
    if (idx < idxAktif)  state = 'lacak-step-done';
    if (idx === idxAktif) state = 'lacak-step-active';

    const isLast    = idx === LACAK_STATUS_LIST.length - 1;
    const dotIsi    = state === 'lacak-step-done' ? '✓' : (idx + 1);
    const connector = !isLast
      ? '<div class="lacak-timeline-connector"></div>'
      : '';

    return `
      <div class="lacak-timeline-step ${state}">
        <div class="lacak-timeline-left">
          <div class="lacak-timeline-dot">${dotIsi}</div>
          ${connector}
        </div>
        <div class="lacak-timeline-info">
          <p class="lacak-timeline-label">
            ${lacakEscHtml(LACAK_STATUS_LABELS[status] || status)}
          </p>
          ${state === 'lacak-step-active'
            ? '<p class="lacak-timeline-now">✦ Status Saat Ini</p>'
            : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ================================================
// 🚀 INISIALISASI HALAMAN
// ================================================
document.addEventListener('DOMContentLoaded', function lacakInit() {

  // Hanya jalankan di halaman yang ada elemen lacak
  const inputEl = document.getElementById('lacak-input-resi');
  if (!inputEl) return;

  // Enter = cari
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') lacakCariOrder();
  });

  // Auto-uppercase saat mengetik
  inputEl.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });

  // Cek apakah Supabase sudah terinisialisasi
  if (!window._lacakDb) {
    console.error(
      '[lacak.js] _lacakDb belum tersedia. ' +
      'Pastikan CDN Supabase di-load sebelum lacak.js ' +
      'dan LACAK_SUPABASE_URL / LACAK_SUPABASE_KEY sudah diisi.'
    );
  }
});
