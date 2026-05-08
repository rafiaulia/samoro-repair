/* ================================================
   RAS-REPAIR — timeline.js
   Modal Timeline Status — prefix "tl"
   Dipakai di admin.html dan pesanan.html
   Load SEBELUM admin.js dan pesanan.js
   ================================================ */

// ── Konstanta ────────────────────────────────────
const TL_STATUS_LIST = ["masuk", "proses perbaikan", "siap diambil", "selesai"];

const TL_STATUS_LABELS = {
  masuk: "Masuk",
  "proses perbaikan": "Proses Perbaikan",
  "siap diambil": "Siap Diambil",
  selesai: "Selesai",
};

// ── Helper ───────────────────────────────────────
function tlFormatWaktu(dateStr) {
  if (!dateStr) return null;
  return (
    new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
      hour12: false,
    }) + " WIB"
  );
}

// ── Buka Modal ───────────────────────────────────
/**
 * Buka modal timeline untuk sebuah order
 * @param {number} id - ID order
 */
function tlBukaModal(id) {
  // Cari order dari cache yang tersedia
  const orders = window._admOrders || window._pesAllOrders || [];
  const o = orders.find((o) => o.id === id);
  if (!o) return;

  // Isi header info
  document.getElementById("tl-modal-resi").textContent = o.resi;
  document.getElementById("tl-modal-nama").textContent = o.nama_customer;
  document.getElementById("tl-modal-device").textContent = o.nama_device;

  // Map status → kolom waktu
  const waktuMap = {
    masuk: o.waktu_masuk || o.created_at, // ← fallback ke created_at
    "proses perbaikan": o.waktu_proses,
    "siap diambil": o.waktu_siap,
    selesai: o.waktu_selesai,
  };
  const idxAktif = TL_STATUS_LIST.indexOf(o.status);

  // Render timeline steps
  const wrap = document.getElementById("tl-timeline-wrap");
  wrap.innerHTML = TL_STATUS_LIST.map((status, idx) => {
    let state = "tl-pending";
    if (idx < idxAktif) state = "tl-done";
    if (idx === idxAktif) state = "tl-active";

    const isLast = idx === TL_STATUS_LIST.length - 1;
    const dotIsi = state === "tl-done" ? "✓" : idx + 1;
    const waktu = tlFormatWaktu(waktuMap[status]);

    const connector = !isLast ? `<div class="tl-connector"></div>` : "";

    const waktuHtml = waktu
      ? `<p class="tl-step-waktu"><i class="bi bi-calendar-fill"></i> ${waktu}</p>`
      : `<p class="tl-step-waktu">Belum tercapai</p>`;

    const nowHtml =
      state === "tl-active"
        ? `<p class="tl-step-now">✦ Status Saat Ini</p>`
        : "";

    return `
      <div class="tl-step ${state}">
        <div class="tl-step-left">
          <div class="tl-dot ${state}">${dotIsi}</div>
          ${connector}
        </div>
        <div class="tl-step-info">
          <p class="tl-step-label">${TL_STATUS_LABELS[status]}</p>
          ${waktuHtml}
          ${nowHtml}
        </div>
      </div>
    `;
  }).join("");

  // Tampilkan overlay
  document.getElementById("tl-overlay").classList.add("tl-visible");
  document.body.style.overflow = "hidden";
}

// ── Tutup Modal ──────────────────────────────────
function tlTutupModal(e) {
  if (e && e.target !== document.getElementById("tl-overlay")) return;
  document.getElementById("tl-overlay").classList.remove("tl-visible");
  document.body.style.overflow = "";
}
