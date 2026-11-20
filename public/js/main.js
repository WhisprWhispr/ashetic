// Ashtatic Internet Solution - Main Client Script
import { submitRegistration } from "./firebase-config.js";
import { showToast, showCustomAlert } from "./toast.js";

// Data Paket Internet Sesuai Poster
export const PACKAGES = {
  "100mbps": {
    id: "100mbps",
    name: "Paket 100 Mbps",
    speed: "100 Mbps",
    price: 105000,
    priceFormatted: "Rp 105.000 / Bulan",
    color: "#00f0ff",
    badge: "Hemat & Terlaris",
    devices: "3 - 5 Perangkat",
    features: [
      "Kecepatan Simetris hingga 100 Mbps",
      "Unlimited Kuota Tanpa FUP Ketat",
      "Termasuk Modem Wifi AirPro Tanpa Kabel",
      "Bulan Pertama GRATIS!",
      "Gratis Biaya Instalasi Pemasangan",
      "Ideal untuk Streaming HD & Browsing"
    ]
  },
  "150mbps": {
    id: "150mbps",
    name: "Paket 150 Mbps",
    speed: "150 Mbps",
    price: 180000,
    priceFormatted: "Rp 180.000 / Bulan",
    color: "#a855f7",
    badge: "Paling Favorit Keluarga",
    devices: "5 - 8 Perangkat",
    features: [
      "Kecepatan Tinggi hingga 150 Mbps",
      "Unlimited Kuota Bebas Hambatan",
      "Termasuk Modem Wifi AirPro Dual Band",
      "Bulan Pertama GRATIS!",
      "Gratis Biaya Instalasi Pemasangan",
      "Optimal untuk Streaming 4K & Online Meeting",
      "Low Latency Gaming Support"
    ]
  },
  "200mbps": {
    id: "200mbps",
    name: "Paket 200 Mbps",
    speed: "200 Mbps",
    price: 205000,
    priceFormatted: "Rp 205.000 / Bulan",
    color: "#0072ff",
    badge: "Ultra Speed Bisnis & Gamer",
    devices: "10+ Perangkat",
    features: [
      "Kecepatan Maksimum hingga 200 Mbps",
      "Unlimited Kuota Tanpa Batas",
      "Termasuk Modem Wifi AirPro High-Gain",
      "Bulan Pertama GRATIS!",
      "Gratis Biaya Instalasi Pemasangan",
      "Prioritas Jaringan & CS Fast Response",
      "Ideal untuk Konten Kreator, Gamers & Usaha"
    ]
  }
};

// Generate Unique Ticket ID: ASH-YYMM-XXXX
function generateTicketId() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ASH-${year}${month}-${random}`;
}

// Inisialisasi saat DOM siap
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupRegistrationModal();
  setupPosterLightbox();
  setupGeolocation();
  setupCoverageChecker();
});

// Mobile navigation
function setupNavigation() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenu = document.getElementById("mobileMenu");

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isClosed = mobileMenu.classList.contains("hidden");
      mobileMenu.classList.toggle("hidden");
      
      const icon = mobileMenuBtn.querySelector("i");
      if (icon) {
        if (isClosed) {
          icon.className = "fa-solid fa-xmark";
        } else {
          icon.className = "fa-solid fa-bars";
        }
      }
    });

    // Tutup menu saat link diklik
    const links = mobileMenu.querySelectorAll("a, button");
    links.forEach(l => {
      l.addEventListener("click", () => {
        mobileMenu.classList.add("hidden");
        const icon = mobileMenuBtn.querySelector("i");
        if (icon) icon.className = "fa-solid fa-bars";
      });
    });

    // Tutup menu saat klik di luar
    document.addEventListener("click", (e) => {
      if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        if (!mobileMenu.classList.contains("hidden")) {
          mobileMenu.classList.add("hidden");
          const icon = mobileMenuBtn.querySelector("i");
          if (icon) icon.className = "fa-solid fa-bars";
        }
      }
    });
  }
}

// Modal Pendaftaran Pasang Baru
function setupRegistrationModal() {
  const modal = document.getElementById("registerModal");
  const openButtons = document.querySelectorAll(".btn-open-register");
  const closeButtons = document.querySelectorAll(".btn-close-register");
  const packageSelect = document.getElementById("regPackage");
  const form = document.getElementById("registrationForm");

  // Buka modal dari tombol
  openButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const selectedPkg = btn.getAttribute("data-package") || "150mbps";
      if (packageSelect) {
        packageSelect.value = selectedPkg;
      }
      openModal();
    });
  });

  // Tutup modal
  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => closeModal());
  });

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function openModal() {
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      document.body.style.overflow = "auto";
    }
  }

  // Handle Form Submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      const originalText = submitBtn.innerHTML;

      // Disable button & loading spinner
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Mengirim Pendaftaran...`;

      try {
        const ticketId = generateTicketId();
        const pkgKey = packageSelect ? packageSelect.value : "150mbps";
        const pkgInfo = PACKAGES[pkgKey] || PACKAGES["150mbps"];

        const formData = {
          ticketId: ticketId,
          fullName: document.getElementById("regName").value.trim(),
          phone: document.getElementById("regPhone").value.trim(),
          email: document.getElementById("regEmail").value.trim(),
          packageId: pkgKey,
          packageName: pkgInfo.name,
          packageSpeed: pkgInfo.speed,
          packagePrice: pkgInfo.price,
          address: document.getElementById("regAddress").value.trim(),
          city: document.getElementById("regCity")?.value?.trim() || "Area Layanan Ashtatic",
          coordinates: document.getElementById("regCoords")?.value?.trim() || "",
          propertyType: document.getElementById("regPropertyType")?.value || "Rumah Pribadi",
          preferredSchedule: document.getElementById("regSchedule")?.value || "Secepatnya",
          notes: document.getElementById("regNotes")?.value?.trim() || "",
          status: "menunggu_verifikasi",
          statusLabel: "Menunggu Verifikasi Tim Ashtatic",
          technician: "",
          adminNotes: "",
          createdAt: new Date().toISOString(),
          createdAtReadable: new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        };

        // Kirim ke Firebase & Server
        const res = await submitRegistration(formData);

        if (res.success) {
          form.reset();
          closeModal();
          showToast("Pendaftaran berhasil disimpan ke sistem!", "success");
          showSuccessModal(formData);
        } else {
          showToast(res.message || "Gagal mengirim data. Silakan coba kembali.", "error");
        }
      } catch (err) {
        console.error("Submission error:", err);
        showToast("Terjadi kendala saat memproses pendaftaran. Silakan coba lagi.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

// Menampilkan Modal Sukses Pendaftaran
function showSuccessModal(data) {
  const successModal = document.getElementById("successModal");
  if (!successModal) return;

  const ticketElem = document.getElementById("successTicketId");
  const nameElem = document.getElementById("successName");
  const pkgElem = document.getElementById("successPackage");
  const trackBtn = document.getElementById("btnSuccessTrack");

  if (ticketElem) ticketElem.innerText = data.ticketId;
  if (nameElem) nameElem.innerText = data.fullName;
  if (pkgElem) pkgElem.innerText = `${data.packageName} (${data.packageSpeed} - Rp ${data.packagePrice.toLocaleString('id-ID')}/bln)`;

  // Link ke Lacak Status
  if (trackBtn) {
    trackBtn.href = `/tracking?ticket=${data.ticketId}`;
  }

  // Setup tombol copy
  const copyBtn = document.getElementById("btnCopyTicket");
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.ticketId).then(() => {
        showToast(`Nomor Tiket ${data.ticketId} berhasil disalin!`, "success");
        copyBtn.innerHTML = `<i class="fa-solid fa-check text-green-400 mr-1"></i> Tersalin!`;
        setTimeout(() => {
          copyBtn.innerHTML = `<i class="fa-regular fa-copy mr-1"></i> Salin Tiket`;
        }, 2000);
      });
    };
  }

  successModal.classList.remove("hidden");
  successModal.classList.add("flex");
  document.body.style.overflow = "hidden";

  const closeSuccessBtn = document.getElementById("btnCloseSuccessModal");
  if (closeSuccessBtn) {
    closeSuccessBtn.onclick = () => {
      successModal.classList.add("hidden");
      successModal.classList.remove("flex");
      document.body.style.overflow = "auto";
    };
  }
}

// Fitur Geolocation / GPS Otomatis
function setupGeolocation() {
  const geoBtn = document.getElementById("btnGetLocation");
  const coordsInput = document.getElementById("regCoords");

  if (geoBtn && coordsInput) {
    geoBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast("Peramban Anda tidak mendukung deteksi lokasi otomatis.", "warning");
        return;
      }

      const origText = geoBtn.innerHTML;
      geoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mendeteksi...`;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          coordsInput.value = `${lat}, ${lng} (https://maps.google.com/?q=${lat},${lng})`;
          geoBtn.innerHTML = `<i class="fa-solid fa-check text-green-400 mr-1"></i> Lokasi Terkunci`;
          showToast("Koordinat lokasi pemasangan berhasil didapatkan!", "success");
        },
        (err) => {
          console.warn("Geolocation error:", err);
          showToast("Izin lokasi tidak dapat diakses. Anda dapat mengisi alamat secara manual.", "warning");
          geoBtn.innerHTML = origText;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}

// Lightbox untuk Poster Resmi
function setupPosterLightbox() {
  const posterThumb = document.getElementById("posterThumbnail");
  const posterModal = document.getElementById("posterModal");
  const closePoster = document.getElementById("btnClosePosterModal");

  if (posterThumb && posterModal) {
    posterThumb.addEventListener("click", () => {
      posterModal.classList.remove("hidden");
      posterModal.classList.add("flex");
      document.body.style.overflow = "hidden";
    });

    if (closePoster) {
      closePoster.addEventListener("click", () => {
        posterModal.classList.add("hidden");
        posterModal.classList.remove("flex");
        document.body.style.overflow = "auto";
      });
    }

    posterModal.addEventListener("click", (e) => {
      if (e.target === posterModal) {
        posterModal.classList.add("hidden");
        posterModal.classList.remove("flex");
        document.body.style.overflow = "auto";
      }
    });
  }
}

// Coverage Checker Widget
function setupCoverageChecker() {
  const checkBtn = document.getElementById("btnCheckCoverage");
  const areaInput = document.getElementById("coverageAreaInput");
  const resultBox = document.getElementById("coverageResult");

  if (checkBtn && areaInput && resultBox) {
    checkBtn.addEventListener("click", () => {
      const val = areaInput.value.trim();
      if (!val) {
        showToast("Silakan ketikkan nama kecamatan atau kota Anda terlebih dahulu.", "warning");
        return;
      }

      showToast(`Memeriksa jangkauan sinyal di "${val}"...`, "info", 2000);

      resultBox.classList.remove("hidden");
      resultBox.innerHTML = `
        <div class="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 flex items-start gap-3">
          <i class="fa-solid fa-circle-check text-cyan-400 text-xl mt-1 shrink-0"></i>
          <div>
            <h4 class="font-bold text-white">Wilayah Siap Terlayani Sinyal Wifi AirPro!</h4>
            <p class="text-xs sm:text-sm text-cyan-200/80 mt-1">Area <strong class="text-cyan-400">"${val}"</strong> sudah tercover jaringan internet nirkabel Ashtatic AirPro. Anda bisa langsung melakukan pendaftaran pasang baru.</p>
            <button class="mt-3 px-4 py-1.5 rounded-lg btn-neon-cyan text-xs font-bold btn-open-register" data-package="150mbps">
              Daftar Pasang Sekarang
            </button>
          </div>
        </div>
      `;

      // Re-bind click event untuk tombol di dalam result
      const newBtn = resultBox.querySelector(".btn-open-register");
      if (newBtn) {
        newBtn.addEventListener("click", () => {
          const pkgSelect = document.getElementById("regPackage");
          if (pkgSelect) pkgSelect.value = "150mbps";
          const modal = document.getElementById("registerModal");
          if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
          }
        });
      }
    });
  }
}
