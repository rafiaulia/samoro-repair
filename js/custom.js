document.addEventListener("DOMContentLoaded", () => {
  const counters = document.querySelectorAll(".rafiaja-stat-number[data-target]");

  counters.forEach(counter => {
    const target = +counter.getAttribute("data-target");
    let current = 0;

    // Atur kecepatan berbeda berdasarkan nilai target
    let increment;
    let delay;

    if (target === 6) {
      increment = 0.05; // lebih kecil, jadi lambat banget
      delay = 10;
    } else if (target === 2000000) {
      increment = target / 300; // cepat
      delay = 10;
    } else {
      increment = target / 200;
      delay = 20;
    }

    const updateCount = () => {
      if (current < target) {
        current += increment;
        counter.innerText = new Intl.NumberFormat('id-ID').format(Math.floor(current));
        setTimeout(updateCount, delay);
      } else {
        counter.innerText = new Intl.NumberFormat('id-ID').format(target);
      }
    };

    updateCount();
  });
});


const nominalInput = document.getElementById('nominal');
const totalOutput = document.getElementById('total');
const alertBox = document.getElementById('alert');

nominalInput.addEventListener('input', function () {
  let rawValue = this.value.replace(/\./g, '');
  let numericValue = parseInt(rawValue) || 0;

  // Maksimal 2 juta
  if (numericValue > 2000000) {
    alertBox.style.display = 'block';
    this.value = formatRupiah(rawValue.slice(0, -1)); // hapus angka terakhir
    return;
  } else {
    alertBox.style.display = 'none';
  }

  this.value = formatRupiah(numericValue.toString());
});

function formatRupiah(angka) {
  return angka.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function hitungTotal() {
  let input = nominalInput.value.replace(/\./g, '');
  let nominal = parseInt(input) || 0;
  let admin = 0;

  if (nominal < 10000) {
    admin = 1000;
  } else if (nominal <= 200000) {
    admin = 2000;
  } else if (nominal <= 1500000) {
    let biaya = nominal * 0.01;
    admin = Math.round(biaya / 1000) * 1000;
  } else if (nominal <= 2000000) {
    admin = 15000;
  }

  let total = nominal + admin;
  totalOutput.value = formatRupiah(total.toString());

  // Tambahkan ini:
  const adminInfo = document.getElementById('admin-info');
  adminInfo.textContent = `(Biaya Admin ${formatRupiah(admin.toString())})`;
}


function resetForm() {
  nominalInput.value = '';
  totalOutput.value = '';
  alertBox.style.display = 'none';
  document.getElementById('admin-info').textContent = '';

}


// load navbar
document.addEventListener("DOMContentLoaded", () => {

  fetch("/navbar.html")
    .then(res => res.text())
    .then(data => {
      const nav = document.getElementById("navbar-placeholder");
      if (nav) nav.innerHTML = data;
    });

  fetch("/footer.html")
    .then(res => res.text())
    .then(data => {
      const foot = document.getElementById("footer-placeholder");
      if (foot) foot.innerHTML = data;
    });

});



