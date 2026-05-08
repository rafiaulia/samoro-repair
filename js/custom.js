
// load navbar
document.addEventListener("DOMContentLoaded", () => {

  fetch("navbar.html")
    .then(res => res.text())
    .then(data => {
      const nav = document.getElementById("navbar-placeholder");
      if (nav) nav.innerHTML = data;
    });

  fetch("footer.html")
    .then(res => res.text())
    .then(data => {
      const foot = document.getElementById("footer-placeholder");
      if (foot) foot.innerHTML = data;
    });

});

  /* Dropdown desktop */
  function toggleDropdown(id, btn) {
    const item = document.getElementById(id);
    const isOpen = item.classList.contains('navnew__item--open');
    // Tutup semua dulu
    document.querySelectorAll('.navnew__item--open').forEach(el => {
      el.classList.remove('navnew__item--open');
      el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('navnew__item--open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  /* Tutup dropdown kalau klik di luar */
  document.addEventListener('click', e => {
    if (!e.target.closest('.navnew__item')) {
      document.querySelectorAll('.navnew__item--open').forEach(el => {
        el.classList.remove('navnew__item--open');
        el.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  /* Mobile toggle */
  function toggleMobile() {
    const toggle = document.getElementById('navnew-toggle');
    const mobile = document.getElementById('navnew-mobile');
    const isOpen = toggle.classList.contains('navnew__toggle--active');
    toggle.classList.toggle('navnew__toggle--active', !isOpen);
    mobile.classList.toggle('navnew__mobile--open', !isOpen);
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  /* Scrolled shadow */
  window.addEventListener('scroll', () => {
    document.getElementById('navnew').classList.toggle('navnew--scrolled', window.scrollY > 10);
  });
// ── RESET MOBILE MENU SAAT RESIZE KE DESKTOP ──
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    const toggle = document.getElementById('navnew-toggle');
    const mobile = document.getElementById('navnew-mobile');
    if (!toggle || !mobile) return;

    toggle.classList.remove('navnew__toggle--active');
    mobile.classList.remove('navnew__mobile--open');
    document.body.style.overflow = '';
  }
});
  // ── ACTIVE NAV LINK ──
function setActiveNavLink() {
  const path = window.location.pathname;

  const linkMap = {
    '/lacak.html':           'a[href="/lacak.html"]',
    '/syaratketentuan.html': 'a[href="/syaratketentuan.html"]',
    '/pertanyaan.html':      'a[href="/pertanyaan.html"]',
    '/admin.html':           'a[href="/admin.html"]',
    '/konsultasi.html':      'a[href="/konsultasi.html"]',
  };

  const selector = linkMap[path];
  if (!selector) return;

  const el = document.querySelector(selector);
  if (el) el.classList.add('navnew__link--active');
}

// Cek preferensi yang tersimpan saat halaman load
// 🔹 Apply theme + update UI
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  const icon  = document.querySelector('.dark-toggle-icon');
  const label = document.querySelector('.dark-toggle-label');

  if (icon)  icon.textContent  = theme === 'dark' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// Inisialisasi saat pertama kali load
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Jika ada di storage pakai itu, jika tidak cek preferensi OS
  const theme = saved ? saved : (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
})();

// Fungsi Toggle untuk Button
function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';

  applyTheme(newTheme);
}