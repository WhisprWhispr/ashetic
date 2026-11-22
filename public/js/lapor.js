// Ashtatic Internet Solution - Lapor Gangguan Jaringan Script
import { getWifiDevicesBySubscription, submitNetworkReport, getReportsBySubscription } from "./firebase-config.js";
import { showToast } from "./toast.js";

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const searchForm = document.getElementById("searchCustomerForm");
  const inputCustomerId = document.getElementById("inputCustomerId");
  const customerVerifiedBox = document.getElementById("customerVerifiedBox");
  const btnResetCustomer = document.getElementById("btnResetCustomer");

  const categoryCards = document.querySelectorAll(".category-card");
  const selectedCategoryInput = document.getElementById("selectedCategory");
  const selectedCategoryLabelInput = document.getElementById("selectedCategoryLabel");
  const customWifiInputBox = document.getElementById("customWifiInputBox");

  const reportForm = document.getElementById("reportForm");
  const inputUrgency = document.getElementById("inputUrgency");
  const inputContactPhone = document.getElementById("inputContactPhone");
  const inputDescription = document.getElementById("inputDescription");
  const reqNewSSID = document.getElementById("reqNewSSID");
  const reqNewPass = document.getElementById("reqNewPass");
  const btnSubmitReport = document.getElementById("btnSubmitReport");

  // Success Modal Elements
  const successModal = document.getElementById("reportSuccessModal");
  const succReportId = document.getElementById("succReportId");
  const succCustomerName = document.getElementById("succCustomerName");
  const succCategoryLabel = document.getElementById("succCategoryLabel");
  const btnWhatsAppForward = document.getElementById("btnWhatsAppForward");
  const btnCopyReportId = document.getElementById("btnCopyReportId");
  const btnCloseSuccessModal = document.getElementById("btnCloseSuccessModal");

  // History Elements
  const reportHistorySection = document.getElementById("reportHistorySection");
  const reportHistoryCount = document.getElementById("reportHistoryCount");
  const reportHistoryList = document.getElementById("reportHistoryList");

  let verifiedCustomer = null;

  // Nomor WhatsApp Resmi CS Ashtatic
  const OFFICIAL_CS_PHONE = "6285709139884";

  // Check URL params (e.g. /lapor?id=ASH-SUB-2611-2275)
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get("id") || urlParams.get("sub") || urlParams.get("ticket");
  if (paramId && inputCustomerId) {
    inputCustomerId.value = paramId;
    verifyCustomerData(paramId);
  }

  // 1. Verifikasi Data Pelanggan
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = inputCustomerId.value.trim();
      if (!val) {
        showToast("Silakan masukkan ID Langganan atau No. Tiket Anda.", "warning");
        return;
      }
      verifyCustomerData(val);
    });
  }

  async function verifyCustomerData(queryStr) {
    showToast(`Mengecek data pelanggan "${queryStr}"...`, "info", 1800);
    const btnCheck = document.getElementById("btnCheckCustomer");
    const origText = btnCheck ? btnCheck.innerHTML : "";
    if (btnCheck) {
      btnCheck.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Memeriksa...`;
      btnCheck.disabled = true;
    }

    try {
      const res = await getWifiDevicesBySubscription(queryStr);
      if (res.success && res.registration) {
        verifiedCustomer = res.registration;
        showToast(`Pelanggan "${verifiedCustomer.fullName}" terverifikasi!`, "success");

        // Tampilkan kotak pelanggan terverifikasi
        document.getElementById("detCustomerName").innerText = verifiedCustomer.fullName || "Pelanggan";
        document.getElementById("detSubscriptionId").innerText = verifiedCustomer.subscriptionId || verifiedCustomer.ticketId || "-";
        document.getElementById("detPackageName").innerText = `${verifiedCustomer.packageName || 'Wifi AirPro'} (${verifiedCustomer.packageSpeed || ''})`;
        document.getElementById("detCustomerPhone").innerText = verifiedCustomer.phone || "-";

        if (inputContactPhone && !inputContactPhone.value) {
          inputContactPhone.value = verifiedCustomer.phone || "";
        }

        if (customerVerifiedBox) customerVerifiedBox.classList.remove("hidden");

        // Muat riwayat laporan pelanggan ini
        loadCustomerReports(verifiedCustomer.subscriptionId || verifiedCustomer.ticketId);

      } else {
        showToast("ID Langganan tidak ditemukan, tetapi Anda tetap dapat mengajukan laporan kendala.", "info", 4000);
        verifiedCustomer = {
          fullName: "Pelanggan Ashtatic",
          subscriptionId: queryStr.toUpperCase(),
          ticketId: queryStr.toUpperCase(),
          phone: ""
        };
        if (customerVerifiedBox) customerVerifiedBox.classList.add("hidden");
        loadCustomerReports(queryStr);
      }
    } catch (err) {
      console.error("Gagal verifikasi pelanggan:", err);
      showToast("Terjadi kendala saat memeriksa data. Silakan isi form di bawah.", "warning");
    } finally {
      if (btnCheck) {
        btnCheck.innerHTML = origText;
        btnCheck.disabled = false;
      }
    }
  }

  // Reset Pelanggan
  if (btnResetCustomer) {
    btnResetCustomer.addEventListener("click", () => {
      verifiedCustomer = null;
      if (customerVerifiedBox) customerVerifiedBox.classList.add("hidden");
      if (inputCustomerId) {
        inputCustomerId.value = "";
        inputCustomerId.focus();
      }
      if (reportHistorySection) reportHistorySection.classList.add("hidden");
    });
  }

  // 2. Pemilihan Kategori Gangguan
  categoryCards.forEach(card => {
    card.addEventListener("click", () => {
      categoryCards.forEach(c => {
        c.classList.remove("selected", "selected-rose");
      });

      const catKey = card.getAttribute("data-cat");
      const catLabel = card.getAttribute("data-label");

      if (catKey === "mati_total") {
        card.classList.add("selected-rose");
      } else {
        card.classList.add("selected");
      }

      selectedCategoryInput.value = catKey;
      selectedCategoryLabelInput.value = catLabel;

      // Jika kategori adalah ganti wifi, tampilkan input ganti wifi
      if (catKey === "ganti_wifi") {
        if (customWifiInputBox) customWifiInputBox.classList.remove("hidden");
      } else {
        if (customWifiInputBox) customWifiInputBox.classList.add("hidden");
      }
    });
  });

  // 3. Submit Laporan Gangguan
  if (reportForm) {
    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = selectedCategoryInput.value;
      const categoryLabel = selectedCategoryLabelInput.value;
      if (!category) {
        showToast("Silakan pilih salah satu Kategori Kendala di atas terlebih dahulu.", "warning");
        const catGrid = document.getElementById("categoryGrid");
        if (catGrid) catGrid.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const urgency = inputUrgency.value;
      const contactPhone = inputContactPhone.value.trim();
      const description = inputDescription.value.trim();

      if (!contactPhone) {
        showToast("Nomor WhatsApp wajib diisi agar teknisi dapat menghubungi Anda.", "warning");
        inputContactPhone.focus();
        return;
      }

      if (description.length < 5) {
        showToast("Mohon berikan rincian kendala minimal 5 karakter.", "warning");
        inputDescription.focus();
        return;
      }

      const customSSID = reqNewSSID ? reqNewSSID.value.trim() : "";
      const customPass = reqNewPass ? reqNewPass.value.trim() : "";

      const originalBtnText = btnSubmitReport.innerHTML;
      btnSubmitReport.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Mengirim Laporan ke Teknisi...`;
      btnSubmitReport.disabled = true;

      try {
        const payload = {
          subscriptionId: verifiedCustomer ? (verifiedCustomer.subscriptionId || verifiedCustomer.ticketId) : (inputCustomerId.value.trim().toUpperCase() || "-"),
          ticketId: verifiedCustomer ? (verifiedCustomer.ticketId || "") : "",
          customerName: verifiedCustomer ? verifiedCustomer.fullName : "Pelanggan Ashtatic",
          phone: contactPhone,
          category,
          categoryLabel,
          urgency,
          description,
          customSSID,
          customPassword: customPass
        };

        const res = await submitNetworkReport(payload);

        if (res.success) {
          showToast("Laporan gangguan berhasil dibuat dan diteruskan ke sistem!", "success", 4000);

          // Tampilkan Modal Sukses
          showReportSuccessModal(res.data || payload);

          // Reset Form
          reportForm.reset();
          categoryCards.forEach(c => c.classList.remove("selected", "selected-rose"));
          selectedCategoryInput.value = "";
          selectedCategoryLabelInput.value = "";
          if (customWifiInputBox) customWifiInputBox.classList.add("hidden");

          // Refresh Riwayat
          loadCustomerReports(payload.subscriptionId);

        } else {
          showToast("Gagal mengirim laporan. Silakan periksa koneksi internet Anda.", "error");
        }
      } catch (err) {
        console.error("Gagal kirim laporan:", err);
        showToast("Terjadi kendala saat mengirim laporan.", "error");
      } finally {
        btnSubmitReport.innerHTML = originalBtnText;
        btnSubmitReport.disabled = false;
      }
    });
  }

  // 4. Modal Sukses & Link WhatsApp
  function showReportSuccessModal(reportData) {
    if (!successModal) return;

    succReportId.innerText = reportData.reportId || "-";
    succCustomerName.innerText = reportData.customerName || "-";
    succCategoryLabel.innerText = reportData.categoryLabel || "-";

    // Format WhatsApp Message
    const cleanPhone = (reportData.phone || "").replace(/[^0-9]/g, "");
    let urgencyIcon = "🟡";
    if (reportData.urgency === "mendesak") urgencyIcon = "🔴";
    if (reportData.urgency === "standar") urgencyIcon = "🟢";

    let extraWifiInfo = "";
    if (reportData.customSSID || reportData.customPassword) {
      extraWifiInfo = `\n*Permintaan WiFi Baru:*\n- SSID: ${reportData.customSSID || '-'}\n- Password: ${reportData.customPassword || '-'}\n`;
    }

    const waText = 
      `*TIKET GANGGUAN JARINGAN ASHTATIC AIRPRO*\n` +
      `-----------------------------------------\n` +
      `*No. Tiket Laporan:* ${reportData.reportId}\n` +
      `*ID Langganan / Tiket:* ${reportData.subscriptionId}\n` +
      `*Nama Pelanggan:* ${reportData.customerName}\n` +
      `*No. WhatsApp:* ${reportData.phone}\n` +
      `*Kategori Kendala:* ${reportData.categoryLabel}\n` +
      `*Urgensi:* ${urgencyIcon} ${reportData.urgency.toUpperCase()}\n` +
      extraWifiInfo +
      `*Rincian Kendala:* \n"${reportData.description}"\n\n` +
      `Mohon bantuan pengecekan dan tindak lanjut dari tim teknisi Ashtatic. Terima kasih.`;

    const waUrl = `https://wa.me/${OFFICIAL_CS_PHONE}?text=${encodeURIComponent(waText)}`;
    if (btnWhatsAppForward) {
      btnWhatsAppForward.href = waUrl;
    }

    // Salin Report ID
    if (btnCopyReportId) {
      btnCopyReportId.onclick = () => {
        navigator.clipboard.writeText(reportData.reportId);
        showToast(`Nomor Tiket "${reportData.reportId}" disalin!`, "info");
      };
    }

    successModal.classList.remove("hidden");
  }

  if (btnCloseSuccessModal) {
    btnCloseSuccessModal.addEventListener("click", () => {
      successModal.classList.add("hidden");
    });
  }

  // 5. Muat Riwayat Laporan Sebelumnya
  async function loadCustomerReports(queryStr) {
    if (!queryStr || !reportHistorySection || !reportHistoryList) return;

    try {
      const res = await getReportsBySubscription(queryStr);
      if (res.success && res.data && res.data.length > 0) {
        reportHistoryCount.innerText = `${res.data.length} Laporan`;
        let html = "";

        res.data.forEach(item => {
          let badgeStatus = "";
          if (item.status === "selesai") {
            badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-400/50 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Selesai & Normal</span>`;
          } else if (item.status === "proses") {
            badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-400/50 flex items-center gap-1"><i class="fa-solid fa-screwdriver-wrench"></i> Sedang Ditangani</span>`;
          } else {
            badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-400/50 flex items-center gap-1"><i class="fa-solid fa-clock"></i> Menunggu Teknisi</span>`;
          }

          const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString("id-ID") : "-";

          html += `
            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-xs text-rose-300">${item.reportId}</span>
                  <span class="text-[11px] text-slate-400">• ${dateStr}</span>
                </div>
                ${badgeStatus}
              </div>
              <div class="text-xs">
                <span class="text-white font-bold">${item.categoryLabel || item.category}</span>
                <p class="text-slate-400 text-[11px] mt-0.5 italic">"${item.description || '-'}"</p>
              </div>
              ${item.technician || item.adminNotes ? `
                <div class="text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 space-y-0.5">
                  ${item.technician ? `<div><strong class="text-cyan-300">Teknisi:</strong> ${item.technician}</div>` : ''}
                  ${item.adminNotes ? `<div><strong class="text-emerald-300">Catatan Tindak Lanjut:</strong> ${item.adminNotes}</div>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        });

        reportHistoryList.innerHTML = html;
        reportHistorySection.classList.remove("hidden");
      } else {
        reportHistorySection.classList.add("hidden");
      }
    } catch (err) {
      console.warn("Gagal muat riwayat laporan:", err);
    }
  }

});
