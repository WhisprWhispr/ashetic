// Ashtatic Internet Solution - Tracking Status Script
import { trackRegistration, saveWifiConfiguration } from "./firebase-config.js";
import { showToast } from "./toast.js";
import { ASHTATIC_LOGO_PNG } from "./ashtatic-logo-data.js";

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
  // Setup Kontrak Berlangganan 2 Tahun (PDF & Modal)
  setupContractSectionActions();

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

    // Render Dokumen Kontrak & ID Langganan (Khusus Selesai / Aktif)
    renderContractSection(data);

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
        return "Selesai & Internet Aktif";
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
    } else if (currentStatus === "selesai" || currentStatus === "aktif") {
      if (badgeStatusElem) {
        badgeStatusElem.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 border border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]";
        badgeStatusElem.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1.5"></i> Selesai & Internet Aktif`;
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
      } else if (currentWeight >= 6 && stepNum === 6) {
        // Status Selesai: Tahap ke-6 selesai tuntas & centang hijau bersinar
        stateClass = "text-emerald-400 border-emerald-400 bg-emerald-950/80 shadow-[0_0_18px_rgba(52,211,153,0.6)]";
        icon = `<i class="fa-solid fa-check text-sm font-black"></i>`;
      } else if (stepNum < currentWeight) {
        stateClass = "text-emerald-400 border-emerald-500 bg-emerald-950/40";
        icon = `<i class="fa-solid fa-check"></i>`;
      } else if (stepNum === currentWeight) {
        stateClass = "text-cyan-400 border-cyan-400 bg-cyan-950/50 shadow-[0_0_15px_rgba(0,240,255,0.6)]";
        icon = `<i class="fa-solid fa-circle-dot animate-ping text-xs"></i>`;
      } else {
        stateClass = "text-slate-500 border-slate-700 bg-slate-900/40";
        icon = stepNum;
      }

      const isLineActive = (currentWeight >= 6) ? true : (stepNum < currentWeight);

      html += `
        <div class="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6 relative">
          ${idx < steps.length - 1 ? `
            <div class="absolute left-4 sm:left-5 top-10 w-0.5 h-12 ${isLineActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-700'}"></div>
          ` : ''}
          <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 z-10 ${stateClass}">
            ${icon}
          </div>
          <div>
            <h4 class="font-bold text-sm sm:text-base ${stepNum <= currentWeight ? (currentWeight >= 6 && stepNum === 6 ? 'text-emerald-300 font-extrabold flex items-center gap-2' : 'text-white') : 'text-slate-400'}">
              ${step.title}
              ${currentWeight >= 6 && stepNum === 6 ? '<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/90 text-emerald-300 border border-emerald-400/60 uppercase font-bold tracking-wider">Aktif</span>' : ''}
            </h4>
            <p class="text-xs ${currentWeight >= 6 && stepNum === 6 ? 'text-emerald-400/90 font-medium' : 'text-slate-400'} mt-0.5 leading-relaxed">${step.desc}</p>
          </div>
        </div>
      `;
    });

    timelineContainer.innerHTML = html;
  }

  // ========================================================
  // RENDER SEKSI KONTRAK & ID LANGGANAN (KHUSUS STATUS SELESAI / AKTIF)
  // ========================================================
  function renderContractSection(data) {
    const contractSection = document.getElementById("subscriptionContractSection");
    if (!contractSection) return;

    const isCompleted = (data.status === "selesai" || data.status === "aktif");

    if (isCompleted) {
      // Generate ID Langganan resmi (format: ASH-SUB-YYMM-XXXX) jika belum ada
      const subId = data.subscriptionId || `ASH-SUB-${(data.ticketId || '').replace(/[^0-9]/g, '')}`;
      data.subscriptionId = subId;

      const subElem = document.getElementById("resSubscriptionId");
      if (subElem) subElem.innerText = subId;

      const priceElem = document.getElementById("contractPackagePrice");
      if (priceElem) {
        priceElem.innerText = data.packagePrice ? `Rp ${data.packagePrice.toLocaleString('id-ID')} / bln` : 'Rp 180.000 / bln';
      }

      contractSection.classList.remove("hidden");
    } else {
      contractSection.classList.add("hidden");
    }
  }

  // ========================================================
  // SETUP ACTIONS KONTRAK BERLANGGANAN 2 TAHUN & UNDUH PDF
  // ========================================================
  function setupContractSectionActions() {
    const btnCopySubId = document.getElementById("btnCopySubId");
    const btnOpenModal = document.getElementById("btnOpenContractModal");
    const btnCloseModal = document.getElementById("btnCloseContractModal");
    const modal = document.getElementById("contractModal");
    const btnDownload = document.getElementById("btnDownloadContractPdf");
    const btnModalDownload = document.getElementById("btnModalDownloadPdf");
    const btnModalPrint = document.getElementById("btnModalPrintDoc");

    // Salin ID Langganan
    if (btnCopySubId) {
      btnCopySubId.addEventListener("click", () => {
        if (currentActiveRecord && currentActiveRecord.subscriptionId) {
          navigator.clipboard.writeText(currentActiveRecord.subscriptionId);
          showToast(`ID Langganan "${currentActiveRecord.subscriptionId}" berhasil disalin!`, "info");
        }
      });
    }

    // Buka Modal Pratinjau Dokumen Kontrak
    if (btnOpenModal && modal) {
      btnOpenModal.addEventListener("click", () => {
        if (!currentActiveRecord) return;
        populateContractData(currentActiveRecord);
        modal.classList.remove("hidden");
        modal.classList.add("flex");
      });
    }

    // Tutup Modal
    if (btnCloseModal && modal) {
      btnCloseModal.addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      });
    }

    // Unduh File Kontrak PDF - Dibuat langsung dengan jsPDF (100% pasti berisi, tanpa html2canvas)
    const handlePdfDownload = async () => {
      if (!currentActiveRecord) {
        showToast("Silakan lacak nomor tiket Anda terlebih dahulu.", "warning");
        return;
      }
      populateContractData(currentActiveRecord);
      const data = currentActiveRecord;
      const ticket = data.ticketId || "Dokumen";
      showToast("Sedang menyusun dokumen kontrak...", "info", 3000);

      // Tunggu jsPDF tersedia
      await new Promise(resolve => setTimeout(resolve, 300));

      const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
      
      if (!jsPDFClass) {
        // Fallback: buka pratinjau modal untuk print
        const modal = document.getElementById("contractModal");
        if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
        showToast("Gunakan tombol Cetak di pratinjau dokumen.", "info");
        return;
      }

      const subId = data.subscriptionId || `ASH-SUB-${(ticket).replace(/[^0-9]/g, '')}`;
      
      let dateStr = "";
      if (data.createdAt) {
        try {
          const d = data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);
          if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch(e) {}
      }
      if (!dateStr) dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      const docNumber = `KTR/ASH-2026/${ticket.replace('ASH-', '')}`;
      const customerName = data.fullName || "-";
      const phone = data.phone || "-";
      const address = data.address || "-";
      const packageStr = `${data.packageName || 'Paket AirPro'} (${data.packageSpeed || 'AirPro'})`;
      const priceStr = data.packagePrice ? `Rp ${data.packagePrice.toLocaleString('id-ID')} / Bulan (Bulan Pertama Rp 0)` : "Rp 180.000 / Bulan (Bulan Pertama Rp 0)";
      const ssid = data.wifiSSID || "Ashtatic-AirPro";

      // Buat PDF A4 dengan jsPDF
      const doc = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });

      const W = 210; // lebar A4 mm
      const ML = 15; // margin kiri
      const MR = 15; // margin kanan
      const contentW = W - ML - MR; // 180mm
      let y = 15; // posisi Y awal

      // =====================================================
      // 1. MUAT LOGO ASHTATIC
      // =====================================================
      let logoDataUrl = (typeof ASHTATIC_LOGO_PNG !== "undefined") ? ASHTATIC_LOGO_PNG : null;

      // =====================================================
      // HEADER / KOP SURAT
      // =====================================================
      // Kotak header biru gelap
      doc.setFillColor(4, 8, 22); // #040816
      doc.roundedRect(ML, y, contentW, 25, 2.5, 2.5, "F");

      // Wadah Logo Icon di kiri
      const logoBoxX = ML + 3.5;
      const logoBoxY = y + 3.5;
      const logoBoxSize = 18;

      // Render Logo Resmi Ashtatic (PNG Resolusi Tinggi)
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);
        } catch (imgErr) {
          console.warn("Gagal render addImage logo:", imgErr);
        }
      } else {
        // Fallback wadah & monogram jika logo belum termuat
        doc.setFillColor(6, 12, 32);
        doc.setDrawColor(0, 240, 255);
        doc.setLineWidth(0.4);
        doc.roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 2, 2, "FD");
        doc.setTextColor(0, 240, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("A", logoBoxX + logoBoxSize / 2, logoBoxY + 12.5, { align: "center" });
      }

      // Nama perusahaan & info di samping logo
      const textX = ML + 25;
      doc.setTextColor(0, 240, 255); // cyan
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("ASHTATIC INTERNET SOLUTION", textX, y + 8);

      doc.setTextColor(96, 165, 250); // biru muda
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Koneksi Cepat, Aktivitas Tanpa Batas!  |  Solusi Wifi AirPro Tanpa Kabel", textX, y + 13.5);
      doc.text("PT Ashtatic Internet Solution  |  Layanan Telekomunikasi Broadband Digital  |  www.ashtatic.net", textX, y + 18.5);

      // Nomor dokumen kanan atas
      doc.setTextColor(200, 230, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("DOKUMEN RESMI KONTRAK", W - MR - 4, y + 7, { align: "right" });
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.text(docNumber, W - MR - 4, y + 12, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Tanggal: ${dateStr}`, W - MR - 4, y + 17, { align: "right" });

      y += 30;

      // =====================================================
      // JUDUL DOKUMEN
      // =====================================================
      doc.setTextColor(15, 23, 42); // hampir hitam
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SURAT PERJANJIAN & KONTRAK BERLANGGANAN LAYANAN INTERNET", W / 2, y, { align: "center" });
      y += 5;

      // Badge jangka waktu
      doc.setFillColor(224, 242, 254); // biru sangat muda
      doc.roundedRect(ML + 20, y, contentW - 40, 6, 1.5, 1.5, "F");
      doc.setTextColor(3, 105, 161);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("JANGKA WAKTU KONTRAK BERLANGGANAN RESMI: 24 BULAN (2 TAHUN)", W / 2, y + 4, { align: "center" });
      y += 10;

      // =====================================================
      // PARAGRAF PEMBUKA
      // =====================================================
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const paraText = `Pada hari ini, telah disepakati perjanjian berlangganan layanan telekomunikasi internet Wifi AirPro antara PT ASHTATIC INTERNET SOLUTION dan Pelanggan yang tercantum dalam rincian data di bawah ini:`;
      const paraLines = doc.splitTextToSize(paraText, contentW);
      doc.text(paraLines, ML, y);
      y += paraLines.length * 4 + 3;

      // =====================================================
      // TABEL I: DATA IDENTITAS PELANGGAN
      // =====================================================
      // Header tabel
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(ML, y, contentW, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("I. DATA IDENTITAS PELANGGAN & PARAMETER LAYANAN", ML + 3, y + 4);
      doc.setTextColor(52, 211, 153); // hijau
      doc.text("● STATUS: TERVERIFIKASI & AKTIF", W - MR - 3, y + 4, { align: "right" });
      y += 6;

      // Baris tabel
      const rows = [
        ["ID Langganan Resmi", subId, "Nomor Tiket", ticket],
        ["Nama Lengkap", customerName, "No. WhatsApp", phone],
        ["Paket & Kecepatan", packageStr, "Biaya Bulanan", priceStr],
        ["Nama WiFi (SSID)", ssid, "Perangkat Terpasang", "1 Unit Modem Wifi AirPro"],
        ["Alamat Pemasangan", address, "", ""],
      ];

      const colW1 = 38, colW2 = 52, colW3 = 36, colW4 = contentW - colW1 - colW2 - colW3;

      rows.forEach((row, i) => {
        const rowH = 6.5;
        const isEven = i % 2 === 0;
        
        // Background baris berselang
        doc.setFillColor(248, 250, 252);
        doc.rect(ML, y, colW1, rowH, "F");
        if (row[2]) {
          doc.setFillColor(248, 250, 252);
          doc.rect(ML + colW1 + colW2, y, colW3, rowH, "F");
        }
        // Baris data putih
        doc.setFillColor(255, 255, 255);
        doc.rect(ML + colW1, y, colW2, rowH, "F");
        if (row[2]) {
          doc.rect(ML + colW1 + colW2 + colW3, y, colW4, rowH, "F");
        } else {
          // Kolom alamat full width
          doc.rect(ML + colW1, y, colW2 + colW3 + colW4, rowH, "F");
        }

        // Garis border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(ML, y, contentW, rowH);
        doc.line(ML + colW1, y, ML + colW1, y + rowH);
        if (row[2]) {
          doc.line(ML + colW1 + colW2, y, ML + colW1 + colW2, y + rowH);
          doc.line(ML + colW1 + colW2 + colW3, y, ML + colW1 + colW2 + colW3, y + rowH);
        }

        // Label kolom kiri
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(row[0], ML + 2, y + 4.3);

        // Nilai kolom data kiri
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        const val1Lines = doc.splitTextToSize(row[1], colW2 - 4);
        doc.text(val1Lines[0] || "", ML + colW1 + 2, y + 4.3);

        if (row[2]) {
          // Label & nilai kolom kanan
          doc.setTextColor(71, 85, 105);
          doc.setFont("helvetica", "bold");
          doc.text(row[2], ML + colW1 + colW2 + 2, y + 4.3);
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
          const val2Lines = doc.splitTextToSize(row[3], colW4 - 2);
          doc.text(val2Lines[0] || "", ML + colW1 + colW2 + colW3 + 2, y + 4.3);
        }

        y += rowH;
      });

      y += 6;

      // =====================================================
      // TABEL II: KETENTUAN DAN PASAL PERJANJIAN
      // =====================================================
      doc.setFillColor(15, 23, 42);
      doc.rect(ML, y, contentW, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("II. KETENTUAN DAN PASAL PERJANJIAN", ML + 3, y + 4);
      y += 8;

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);

      const pasal1 = `Pasal 1 - Jangka Waktu Kontrak: Pelanggan mengikatkan diri dalam kontrak berlangganan layanan internet Wifi AirPro selama masa kontrak minimal 24 (dua puluh empat) bulan berturut-turut terhitung sejak tanggal aktivasi layanan dinyatakan selesai dan online.`;
      const pasal2 = `Pasal 2 - Skema Biaya & Pembayaran: Pelanggan berhak atas promo Bebas Biaya Instalasi dan Gratis Berlangganan Bulan Pertama (Rp 0). Tagihan bulanan reguler mulai berlaku pada bulan kedua dan wajib dibayarkan sebelum tanggal 20 setiap bulannya.`;
      const pasal4 = `Pasal 4 - Jaminan Kualitas Layanan: Ashtatic Internet Solution menjamin kestabilan koneksi sinyal Wifi AirPro dan memberikan perbaikan teknisi gratis selama masa kontrak aktif.`;
      const pasal5 = `Pasal 5 - Ketentuan Hukum & Keabsahan: Perjanjian ini dibuat dan diterbitkan secara sah melalui sistem digital PT Ashtatic Internet Solution dan memiliki kekuatan hukum yang sah dan mengikat antara penyedia layanan dan Pelanggan sesuai UU Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik (UU ITE) Republik Indonesia.`;

      [pasal1, pasal2].forEach(p => {
        const lines = doc.splitTextToSize(p, contentW);
        const fst = lines[0];
        const rest = lines.slice(1);
        // Bold teks pasal di awal
        doc.setFont("helvetica", "bold");
        doc.text(fst, ML, y);
        doc.setFont("helvetica", "normal");
        if (rest.length) doc.text(rest, ML, y + 4);
        y += lines.length * 4 + 2;
      });

      y += 1;

      // =====================================================
      // KOTAK MERAH PASAL 3 - PENALTI Rp 1.500.000,-
      // =====================================================
      const pasal3Judul = "Pasal 3 - Klausul Pengakhiran Dini & Biaya Penalti Rp 1.500.000,- (PENTING):";
      const pasal3Isi = `Apabila Pelanggan memutuskan, membatalkan, menonaktifkan, atau berhenti berlangganan sebelum jangka waktu kontrak 2 (dua) tahun (24 bulan) berakhir dengan alasan apa pun, maka Pelanggan DIWAJIBKAN MEMBAYAR BIAYA PENALTI PENGAKHIRAN DINI (EARLY TERMINATION FEE) SEBESAR RP 1.500.000,- (SATU JUTA LIMA RATUS RIBU RUPIAH) secara penuh dan seketika kepada PT Ashtatic Internet Solution, serta wajib mengembalikan seluruh unit perangkat Modem Wifi AirPro beserta kelengkapannya dalam kondisi baik dan berfungsi normal.`;

      const judulLines = doc.splitTextToSize(pasal3Judul, contentW - 6);
      const isiLines = doc.splitTextToSize(pasal3Isi, contentW - 6);
      const boxH = (judulLines.length + isiLines.length) * 4 + 7;

      doc.setFillColor(254, 242, 242); // merah sangat muda
      doc.setDrawColor(239, 68, 68);   // merah
      doc.setLineWidth(0.5);
      doc.roundedRect(ML, y, contentW, boxH, 1.5, 1.5, "FD");

      doc.setTextColor(153, 27, 27); // merah gelap
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("⚠ " + pasal3Judul, ML + 3, y + 5);
      
      doc.setTextColor(69, 10, 10); // merah sangat gelap
      doc.setFont("helvetica", "normal");
      const p3Start = y + 5 + judulLines.length * 4;
      doc.text(isiLines, ML + 3, p3Start);

      y += boxH + 4;

      // Pasal 4 & 5
      [pasal4, pasal5].forEach(p => {
        const lines = doc.splitTextToSize(p, contentW);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        doc.text(lines[0], ML, y);
        doc.setFont("helvetica", "normal");
        if (lines.length > 1) doc.text(lines.slice(1), ML, y + 4);
        y += lines.length * 4 + 2;
      });

      y += 5;

      // =====================================================
      // GARIS PEMISAH TANDA TANGAN
      // =====================================================
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(ML, y, ML + contentW, y);
      y += 8;

      // =====================================================
      // KOLOM TANDA TANGAN (2 KOLOM) - TANPA SEBUTAN PIHAK PERTAMA / KEDUA / LABEL
      // =====================================================
      const colMid = ML + contentW / 2;
      const signW = contentW / 2 - 5;
      const leftCX = ML + signW / 2;
      const rightCX = colMid + 5 + signW / 2;

      // Langsung nama perusahaan di kiri & nama pelanggan di kanan
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("PT ASHTATIC INTERNET SOLUTION", leftCX, y, { align: "center" });
      doc.text(customerName, rightCX, y, { align: "center" });
      y += 5;

      // Stempel bulat kiri (Ashtatic)
      const stampCX = leftCX;
      const stampCY = y + 13;
      const stampR = 12;
      doc.setDrawColor(2, 132, 199); // biru
      doc.setLineWidth(0.8);
      doc.circle(stampCX, stampCY, stampR, "D");
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.3);
      doc.circle(stampCX, stampCY, stampR - 1.8, "D");
      doc.setTextColor(2, 132, 199);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", "bold");
      doc.text("ASHTATIC", stampCX, stampCY - 3.5, { align: "center" });
      doc.setFontSize(7);
      doc.text("VERIFIED", stampCX, stampCY + 0.5, { align: "center" });
      doc.setFontSize(5);
      doc.text("RESMI 2026", stampCX, stampCY + 4, { align: "center" });
      doc.setDrawColor(2, 132, 199);
      doc.setLineWidth(0.3);
      doc.line(stampCX - 7, stampCY - 1.2, stampCX + 7, stampCY - 1.2);
      doc.line(stampCX - 7, stampCY + 1.8, stampCX + 7, stampCY + 1.8);

      // Tanda tangan kanan (pelanggan)
      const signRCX = rightCX;
      const signRCY = y + 13;
      doc.setTextColor(5, 150, 105); // hijau
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("[TERVERIFIKASI & AKTIF]", signRCX, signRCY, { align: "center" });
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.4);
      doc.roundedRect(signRCX - 25, signRCY - 6.5, 50, 10, 1.5, 1.5, "D");

      y += 28;

      // Nama di bawah tanda tangan
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Direktur Layanan Jaringan", stampCX, y, { align: "center" });
      const customerLines = doc.splitTextToSize(customerName, signW);
      doc.text(customerLines[0], signRCX, y, { align: "center" });
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text("PT Ashtatic Internet Solution", stampCX, y, { align: "center" });
      doc.text("Pelanggan Wifi AirPro", signRCX, y, { align: "center" });

      y += 10;

      // =====================================================
      // FOOTER DOKUMEN
      // =====================================================
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + contentW, y);
      y += 4;
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("Dokumen kontrak resmi diterbitkan secara otomatis oleh sistem digital PT Ashtatic Internet Solution.", ML, y);
      doc.text("Halaman 1 dari 1", ML + contentW, y, { align: "right" });

      // Simpan PDF
      doc.save(`Kontrak-Berlangganan-Ashtatic-${ticket}.pdf`);
      showToast("Dokumen Kontrak Berlangganan PDF berhasil diunduh!", "success");
    };

    if (btnDownload) {
      btnDownload.addEventListener("click", handlePdfDownload);
    }
    if (btnModalDownload) {
      btnModalDownload.addEventListener("click", handlePdfDownload);
    }

    // Cetak Dokumen Langsung
    if (btnModalPrint) {
      btnModalPrint.addEventListener("click", () => {
        window.print();
      });
    }
  }

  // Populate data ke elemen lembar kertas A4 dokumen kontrak
  function populateContractData(data) {
    const subId = data.subscriptionId || `ASH-SUB-${(data.ticketId || '').replace(/[^0-9]/g, '')}`;
    
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val || "-";
    };

    setTxt("pdfDocNumber", `KTR/ASH-2026/${(data.ticketId || '').replace('ASH-', '')}`);
    
    let dateStr = "";
    if (data.createdAt) {
      try {
        const d = (data.createdAt.seconds) ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }
      } catch (e) {}
    }
    if (!dateStr) {
      dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    setTxt("pdfPrintDate", `Tanggal: ${dateStr}`);
    setTxt("pdfSubId", subId);
    setTxt("pdfTicketId", data.ticketId);
    setTxt("pdfName", data.fullName);
    setTxt("pdfPhone", data.phone);
    setTxt("pdfEmail", data.email || "-");
    setTxt("pdfAddress", data.address);
    setTxt("pdfPackage", `${data.packageName || 'Paket Internet'} (${data.packageSpeed || 'AirPro'})`);
    setTxt("pdfPrice", data.packagePrice ? `Rp ${data.packagePrice.toLocaleString('id-ID')} / Bulan (Bulan Pertama Rp 0)` : "Rp 180.000 / Bulan (Bulan Pertama Rp 0)");
    setTxt("pdfSSID", data.wifiSSID || "Ashtatic-AirPro");
    setTxt("pdfSignCustomerName", data.fullName);
    setTxt("pdfSignNameUnderline", data.fullName);
  }
});
