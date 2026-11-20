// Ashtatic Internet Solution - Tracking Status Script
import { trackRegistration, saveWifiConfiguration } from "./firebase-config.js";
import { showToast } from "./toast.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("trackForm");
  const input = document.getElementById("trackInput");
  const resultContainer = document.getElementById("trackingResult");
  const notFoundContainer = document.getElementById("trackingNotFound");
  const loadingIndicator = document.getElementById("trackingLoading");

  let currentActiveRecord = null;
  let isPasswordRevealed = false;

  // Setup WiFi UI Action Listeners
  setupWifiSectionActions();

  // Periksa apakah ada parameter 'ticket' di URL (e.g. /tracking?ticket=ASH-2611-1024)
  const urlParams = new URLSearchParams(window.location.search);
  const ticketParam = urlParams.get("ticket");
  if (ticketParam && input) {
    input.value = ticketParam;
    executeTracking(ticketParam);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) {
        showToast("Silakan masukkan Nomor Tiket Pendaftaran atau Nomor WhatsApp Anda.", "warning");
        return;
      }
      executeTracking(val);
    });
  }

  async function executeTracking(queryStr) {
    if (loadingIndicator) loadingIndicator.classList.remove("hidden");
    if (resultContainer) resultContainer.classList.add("hidden");
    if (notFoundContainer) notFoundContainer.classList.add("hidden");

    try {
      showToast(`Mencari data untuk "${queryStr}"...`, "info", 1800);
      const res = await trackRegistration(queryStr);
      if (loadingIndicator) loadingIndicator.classList.add("hidden");

      if (res.success && res.data) {
        showToast("Data pendaftaran berhasil ditemukan!", "success");
        currentActiveRecord = res.data;
        renderTrackingDetails(res.data);
      } else {
        showToast("Data pendaftaran tidak ditemukan.", "error");
        if (notFoundContainer) {
          notFoundContainer.classList.remove("hidden");
          const msgElem = document.getElementById("notFoundMessage");
          if (msgElem) msgElem.innerText = res.message || "Data pendaftaran tidak ditemukan.";
        }
      }
    } catch (err) {
      console.error("Tracking error:", err);
      if (loadingIndicator) loadingIndicator.classList.add("hidden");
      showToast("Terjadi kendala saat melacak tiket pendaftaran.", "error");
      if (notFoundContainer) {
        notFoundContainer.classList.remove("hidden");
        const msgElem = document.getElementById("notFoundMessage");
        if (msgElem) msgElem.innerText = "Terjadi gangguan saat melacak pendaftaran. Silakan coba kembali.";
      }
    }
  }

  function renderTrackingDetails(data) {
    if (!resultContainer) return;

    // Field Pengisian Header Box
    document.getElementById("resTicketId").innerText = data.ticketId || "-";
    document.getElementById("resName").innerText = data.fullName || "-";
    document.getElementById("resPhone").innerText = data.phone || "-";
    document.getElementById("resEmail").innerText = data.email || "-";
    document.getElementById("resPackage").innerText = `${data.packageName || 'Paket Internet'} (${data.packageSpeed || ''})`;
    document.getElementById("resPrice").innerText = data.packagePrice ? `Rp ${data.packagePrice.toLocaleString('id-ID')} / Bulan` : "Rp 180.000 / Bulan";
    document.getElementById("resAddress").innerText = data.address || "-";
    document.getElementById("resDate").innerText = data.createdAtReadable || (data.createdAt ? new Date(data.createdAt).toLocaleString('id-ID') : "-");
    
    // Teknisi & Catatan
    const techElem = document.getElementById("resTechnician");
    if (techElem) {
      techElem.innerText = data.technician ? `Petugas Teknisi: ${data.technician}` : "Teknisi: Menunggu penugasan tim lapangan";
    }
    const notesElem = document.getElementById("resAdminNotes");
    if (notesElem) {
      if (data.notes || data.adminNotes) {
        notesElem.classList.remove("hidden");
        notesElem.innerText = `Catatan: ${data.adminNotes || data.notes}`;
      } else {
        notesElem.classList.add("hidden");
      }
    }

    // Render WiFi Configuration Section (Khusus Terverifikasi ke atas)
    renderWifiConfigSection(data);

    // Setup Status Timeline
    renderTimelineSteps(data.status);

    // Tampilkan container hasil
    resultContainer.classList.remove("hidden");
    resultContainer.scrollIntoView({ behavior: "smooth" });
  }

  function getStatusWeights() {
    return {
      "menunggu_verifikasi": 1,
      "pending": 1,
      "terverifikasi": 2,
      "survey": 3,
      "verifikasi": 3,
      "jadwal_teknisi": 4,
      "scheduled": 4,
      "pemasangan": 5,
      "in_progress": 5,
      "selesai": 6,
      "aktif": 6,
      "ditolak": -1,
      "batal": -1
    };
  }

  function getStatusTitle(status) {
    switch (status) {
      case "menunggu_verifikasi":
      case "pending":
        return "Menunggu Verifikasi Data";
      case "terverifikasi":
        return "Data Terverifikasi & Disetujui (Silakan Set WiFi)";
      case "survey":
      case "verifikasi":
        return "Survey & Uji Sinyal Wifi AirPro";
      case "jadwal_teknisi":
      case "scheduled":
        return "Jadwal Teknisi Ditentukan";
      case "pemasangan":
      case "in_progress":
        return "Sedang Dilakukan Pemasangan di Lokasi";
      case "selesai":
      case "aktif":
        return "Pemasangan Selesai & Internet Aktif";
      case "ditolak":
      case "batal":
        return "Pendaftaran Dibatalkan / Di Luar Jangkauan";
      default:
        return "Dalam Proses";
    }
  }

  // ========================================================
  // RENDER PENGATURAN WIFI (SSID & PASSWORD)
  // ========================================================
  function renderWifiConfigSection(data) {
    const wifiSection = document.getElementById("wifiConfigSection");
    const wifiDisplay = document.getElementById("wifiDisplayBox");
    const wifiForm = document.getElementById("wifiSetupForm");
    const wifiBadge = document.getElementById("wifiBadgeStatus");
    const btnCancel = document.getElementById("btnCancelEditWifi");

    if (!wifiSection) return;

    const weights = getStatusWeights();
    const currentWeight = weights[data.status] || 1;

    // Bagian konfigurasi WiFi HANYA MUNCUL jika status pendaftaran adalah TERVERIFIKASI atau di atasnya (weight >= 2)
    if (currentWeight >= 2) {
      wifiSection.classList.remove("hidden");

      if (data.wifiSSID) {
        // Jika pelanggan sudah pernah mengisi nama WiFi
        if (wifiDisplay) wifiDisplay.classList.remove("hidden");
        if (wifiForm) wifiForm.classList.add("hidden");

        const dispSSID = document.getElementById("dispWifiSSID");
        const dispPass = document.getElementById("dispWifiPass");
        if (dispSSID) dispSSID.innerText = data.wifiSSID;
        if (dispPass) dispPass.innerText = isPasswordRevealed ? data.wifiPassword : "••••••••";

        if (wifiBadge) {
          wifiBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full"><i class="fa-solid fa-circle-check text-xs"></i> Sudah Dikonfigurasi</span>`;
        }

        // Isi form edit
        const inputSSID = document.getElementById("inputWifiSSID");
        const inputPass = document.getElementById("inputWifiPassword");
        if (inputSSID) inputSSID.value = data.wifiSSID;
        if (inputPass) inputPass.value = data.wifiPassword || "";
        if (btnCancel) btnCancel.classList.remove("hidden");

      } else {
        // Jika belum diisi, tampilkan form langsung agar user segera mengisi
        if (wifiDisplay) wifiDisplay.classList.add("hidden");
        if (wifiForm) wifiForm.classList.remove("hidden");

        if (wifiBadge) {
          wifiBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-amber-300 font-bold bg-amber-950/70 border border-amber-500/40 px-2.5 py-0.5 rounded-full animate-pulse"><i class="fa-solid fa-bell text-xs"></i> Perlu Diisi Sekarang</span>`;
        }

        const inputSSID = document.getElementById("inputWifiSSID");
        if (inputSSID && !inputSSID.value) {
          const cleanFirstName = (data.fullName || "User").trim().split(" ")[0].replace(/[^a-zA-Z0-9]/g, "");
          inputSSID.value = `Ashtatic-${cleanFirstName}`;
        }
        if (btnCancel) btnCancel.classList.add("hidden");
      }

    } else {
      // Jika status masih menunggu_verifikasi atau ditolak, sembunyikan section WiFi
      wifiSection.classList.add("hidden");
    }
  }

  // ========================================================
  // SETUP EVENT LISTENERS UNTUK FITUR WIFI
  // ========================================================
  function setupWifiSectionActions() {
    const wifiForm = document.getElementById("wifiSetupForm");
    const wifiDisplay = document.getElementById("wifiDisplayBox");
    const btnToggleEdit = document.getElementById("btnToggleEditWifi");
    const btnCancel = document.getElementById("btnCancelEditWifi");
    const btnToggleInputPass = document.getElementById("btnToggleInputPass");
    const btnToggleShowPass = document.getElementById("btnToggleShowPass");
    const btnCopySSID = document.getElementById("btnCopySSID");
    const btnCopyPass = document.getElementById("btnCopyPass");

    // Toggle Edit Form
    if (btnToggleEdit && wifiDisplay && wifiForm) {
      btnToggleEdit.addEventListener("click", () => {
        wifiDisplay.classList.add("hidden");
        wifiForm.classList.remove("hidden");
        if (btnCancel) btnCancel.classList.remove("hidden");
        const inputSSID = document.getElementById("inputWifiSSID");
        if (inputSSID) inputSSID.focus();
      });
    }

    // Cancel Edit Form
    if (btnCancel && wifiDisplay && wifiForm) {
      btnCancel.addEventListener("click", () => {
        if (currentActiveRecord && currentActiveRecord.wifiSSID) {
          wifiDisplay.classList.remove("hidden");
          wifiForm.classList.add("hidden");
        }
      });
    }

    // Toggle Mata Password di Input Form
    if (btnToggleInputPass) {
      btnToggleInputPass.addEventListener("click", () => {
        const inputPass = document.getElementById("inputWifiPassword");
        if (inputPass) {
          const isPass = inputPass.getAttribute("type") === "password";
          inputPass.setAttribute("type", isPass ? "text" : "password");
          btnToggleInputPass.innerHTML = isPass ? `<i class="fa-regular fa-eye-slash text-cyan-400"></i>` : `<i class="fa-regular fa-eye"></i>`;
        }
      });
    }

    // Toggle Mata Password di Display Box
    if (btnToggleShowPass) {
      btnToggleShowPass.addEventListener("click", () => {
        isPasswordRevealed = !isPasswordRevealed;
        const dispPass = document.getElementById("dispWifiPass");
        if (dispPass && currentActiveRecord) {
          dispPass.innerText = isPasswordRevealed ? (currentActiveRecord.wifiPassword || "-") : "••••••••";
        }
        btnToggleShowPass.innerHTML = isPasswordRevealed ? `<i class="fa-regular fa-eye-slash text-amber-300"></i>` : `<i class="fa-regular fa-eye"></i>`;
      });
    }

    // Salin SSID
    if (btnCopySSID) {
      btnCopySSID.addEventListener("click", () => {
        if (currentActiveRecord && currentActiveRecord.wifiSSID) {
          navigator.clipboard.writeText(currentActiveRecord.wifiSSID);
          showToast(`Nama WiFi "${currentActiveRecord.wifiSSID}" disalin!`, "info");
        }
      });
    }

    // Salin Password
    if (btnCopyPass) {
      btnCopyPass.addEventListener("click", () => {
        if (currentActiveRecord && currentActiveRecord.wifiPassword) {
          navigator.clipboard.writeText(currentActiveRecord.wifiPassword);
          showToast("Kata Sandi WiFi berhasil disalin!", "info");
        }
      });
    }

    // Submit Form Simpan WiFi
    if (wifiForm) {
      wifiForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentActiveRecord) return;

        const ssid = document.getElementById("inputWifiSSID").value.trim();
        const pass = document.getElementById("inputWifiPassword").value;

        if (ssid.length < 3) {
          showToast("Nama WiFi (SSID) minimal harus 3 karakter.", "warning");
          return;
        }

        if (pass.length < 8) {
          showToast("Kata sandi WiFi minimal harus 8 karakter.", "warning");
          return;
        }

        const btnSave = document.getElementById("btnSaveWifi");
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
        btnSave.disabled = true;

        try {
          showToast("Menyimpan konfigurasi WiFi ke sistem...", "info", 2000);
          const result = await saveWifiConfiguration(currentActiveRecord.ticketId, ssid, pass);

          if (result.success) {
            showToast("Nama WiFi (SSID) & Kata Sandi berhasil disimpan!", "success");
            currentActiveRecord.wifiSSID = ssid;
            currentActiveRecord.wifiPassword = pass;
            currentActiveRecord.wifiConfiguredAt = new Date().toISOString();
            renderWifiConfigSection(currentActiveRecord);
          } else {
            showToast("Gagal menyimpan konfigurasi WiFi. Silakan coba beberapa saat lagi.", "error");
          }
        } catch (err) {
          console.error("Gagal simpan WiFi:", err);
          showToast("Terjadi kendala saat menyimpan data WiFi.", "error");
        } finally {
          btnSave.innerHTML = originalText;
          btnSave.disabled = false;
        }
      });
    }
  }

  // ========================================================
  // RENDER TAHAPAN TIMELINE
  // ========================================================
  function renderTimelineSteps(currentStatus) {
    const steps = [
      { id: "step1", key: "menunggu_verifikasi", title: "Pendaftaran Diterima", desc: "Data masuk ke sistem dan tiket registrasi resmi telah diterbitkan." },
      { id: "step2", key: "terverifikasi", title: "Data Terverifikasi & Disetujui", desc: "Data pendaftaran telah disetujui tim. Anda dapat mengatur Nama WiFi & Sandi." },
      { id: "step3", key: "survey", title: "Survey & Uji Sinyal Wifi AirPro", desc: "Tim jaringan memastikan stabilitas sinyal Wifi AirPro di koordinat lokasi." },
      { id: "step4", key: "jadwal_teknisi", title: "Jadwal Pemasangan", desc: "Teknisi ditugaskan untuk mengunjungi lokasi pemasangan sesuai jadwal." },
      { id: "step5", key: "pemasangan", title: "Instalasi Modem AirPro", desc: "Proses pemasangan perangkat Wifi AirPro tanpa kabel dan aktivasi jaringan." },
      { id: "step6", key: "selesai", title: "Selesai & Internet Aktif", desc: "Layanan aktif! Anda siap menikmati koneksi super cepat & stabil." }
    ];

    const weights = getStatusWeights();
    const currentWeight = weights[currentStatus] || 1;
    const badgeStatusElem = document.getElementById("resStatusBadge");

    if (currentWeight === -1) {
      if (badgeStatusElem) {
        badgeStatusElem.className = "px-3 py-1 rounded-full text-xs font-bold bg-red-900/60 border border-red-500 text-red-300";
        badgeStatusElem.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Dibatalkan / Perlu Penyesuaian`;
      }
    } else {
      if (badgeStatusElem) {
        badgeStatusElem.className = "px-3 py-1 rounded-full text-xs font-bold bg-cyan-950/80 border border-cyan-400 text-cyan-300";
        badgeStatusElem.innerHTML = `<i class="fa-solid fa-signal mr-1"></i> ${getStatusTitle(currentStatus)}`;
      }
    }

    const timelineContainer = document.getElementById("timelineContainer");
    if (!timelineContainer) return;

    let html = "";
    steps.forEach((step, idx) => {
      const stepNum = idx + 1;
      let stateClass = "";
      let icon = stepNum;

      if (currentWeight === -1) {
        stateClass = "opacity-40";
      } else if (stepNum < currentWeight) {
        stateClass = "text-emerald-400 border-emerald-500";
        icon = `<i class="fa-solid fa-check"></i>`;
      } else if (stepNum === currentWeight) {
        stateClass = "text-cyan-400 border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(0,240,255,0.6)]";
        icon = `<i class="fa-solid fa-circle-dot animate-ping text-xs"></i>`;
      } else {
        stateClass = "text-slate-500 border-slate-700 bg-slate-900/40";
        icon = stepNum;
      }

      html += `
        <div class="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6 relative">
          ${idx < steps.length - 1 ? `
            <div class="absolute left-4 sm:left-5 top-10 w-0.5 h-12 ${stepNum < currentWeight ? 'bg-emerald-500' : 'bg-slate-700'}"></div>
          ` : ''}
          <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 z-10 ${stateClass}">
            ${icon}
          </div>
          <div>
            <h4 class="font-bold text-sm sm:text-base ${stepNum <= currentWeight ? 'text-white' : 'text-slate-400'}">${step.title}</h4>
            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">${step.desc}</p>
          </div>
        </div>
      `;
    });

    timelineContainer.innerHTML = html;
  }
});
