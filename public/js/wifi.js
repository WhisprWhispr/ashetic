// Ashtatic Internet Solution - WiFi Manager & Connected Devices Script
import { getWifiDevicesBySubscription, updateWifiCredentials, saveWifiDevices } from "./firebase-config.js";
import { showToast } from "./toast.js";

document.addEventListener("DOMContentLoaded", () => {
  const formSearch = document.getElementById("wifiSearchForm");
  const inputSearch = document.getElementById("inputSubscriptionId");
  const loading = document.getElementById("wifiLoading");
  const notFound = document.getElementById("wifiNotFound");
  const resultContainer = document.getElementById("wifiResultContainer");

  // State
  let currentRecord = null;
  let isPasswordHidden = true;
  let isEditPasswordHidden = true;

  // Cek parameter URL (e.g. /wifi-manager?subId=ASH-SUB-2611-2275 atau ?ticket=ASH-2611-2275)
  const urlParams = new URLSearchParams(window.location.search);
  const paramQuery = urlParams.get("subId") || urlParams.get("ticket") || urlParams.get("id");
  if (paramQuery && inputSearch) {
    inputSearch.value = paramQuery;
    executeWifiSearch(paramQuery);
  }

  // Handle Submit Form Pencarian ID Langganan
  if (formSearch) {
    formSearch.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = inputSearch.value.trim();
      if (!query) {
        showToast("Masukkan ID Langganan atau Nomor Tiket Anda.", "warning");
        return;
      }
      executeWifiSearch(query);
    });
  }

  // Fungsi Eksekusi Pencarian
  async function executeWifiSearch(query) {
    if (loading) loading.classList.remove("hidden");
    if (notFound) notFound.classList.add("hidden");
    if (resultContainer) resultContainer.classList.add("hidden");

    try {
      const res = await getWifiDevicesBySubscription(query);

      if (loading) loading.classList.add("hidden");

      if (res.success && res.registration) {
        currentRecord = res.registration;
        showToast("Data WiFi & Router berhasil terhubung!", "success");
        renderWifiDetails(currentRecord);
      } else {
        showToast(res.message || "ID Langganan tidak ditemukan.", "error");
        if (notFound) {
          notFound.classList.remove("hidden");
          const msgEl = document.getElementById("wifiNotFoundMsg");
          if (msgEl) msgEl.innerText = res.message || "ID Langganan tidak ditemukan di sistem kami. Pastikan nomor tiket sudah sesuai.";
        }
      }
    } catch (err) {
      console.error("WiFi Search error:", err);
      if (loading) loading.classList.add("hidden");
      showToast("Terjadi kendala saat menghubungkan ke router.", "error");
    }
  }

  // Render Seluruh Informasi WiFi & Perangkat
  function renderWifiDetails(data) {
    if (!resultContainer) return;

    const subId = data.subscriptionId || `ASH-SUB-${(data.ticketId || '').replace(/[^0-9]/g, '')}`;
    
    // Header & Identitas
    const elName = document.getElementById("dispCustomerName");
    const elSub = document.getElementById("dispSubId");
    if (elName) elName.innerText = data.fullName || "Pelanggan Wifi AirPro";
    if (elSub) elSub.innerText = subId;

    // WiFi Info Box
    const elSSID = document.getElementById("currWifiSSID");
    const elPass = document.getElementById("currWifiPass");
    const elPkg = document.getElementById("currPackage");

    const activeSSID = data.wifiSSID || "Ashtatic-AirPro";
    const activePass = data.wifiPassword || "ashtatic2026";

    if (elSSID) elSSID.innerText = activeSSID;
    if (elPass) elPass.innerText = isPasswordHidden ? "••••••••" : activePass;
    if (elPkg) elPkg.innerText = `${data.packageName || 'Paket AirPro'} (${data.packageSpeed || '150 Mbps'})`;

    // Form Update Default Values
    const inputSSID = document.getElementById("editWifiSSID");
    const inputPass = document.getElementById("editWifiPassword");
    if (inputSSID) inputSSID.value = activeSSID;
    if (inputPass) inputPass.value = activePass;

    // Render Daftar Perangkat
    renderConnectedDevices(data.wifiDevices || []);

    // Tampilkan Hasil
    resultContainer.classList.remove("hidden");
    resultContainer.scrollIntoView({ behavior: "smooth" });
  }

  // Render List Perangkat Terhubung
  function renderConnectedDevices(devices) {
    const listContainer = document.getElementById("devicesListContainer");
    const emptyState = document.getElementById("devicesEmptyState");
    const badgeCount = document.getElementById("badgeDeviceCount");

    if (!listContainer) return;

    const count = Array.isArray(devices) ? devices.length : 0;
    if (badgeCount) badgeCount.innerText = `${count} Perangkat Terhubung`;

    if (!Array.isArray(devices) || devices.length === 0) {
      listContainer.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    let html = "";
    devices.forEach((dev, idx) => {
      const isBlocked = (dev.status === "Diblokir");
      const iconClass = getDeviceIcon(dev.type || "smartphone");
      const statusBadge = isBlocked
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-500/50"><i class="fa-solid fa-ban text-[9px]"></i> Diblokir</span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50"><i class="fa-solid fa-circle text-[7px] text-emerald-400 animate-pulse"></i> Aktif Terhubung</span>`;

      html += `
        <div class="p-4 rounded-xl bg-slate-950/80 border ${isBlocked ? 'border-red-500/40 bg-red-950/10' : 'border-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-cyan-500/40">
          <div class="flex items-start sm:items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${isBlocked ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40'} flex items-center justify-center text-lg shrink-0">
              <i class="${iconClass}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-white text-sm sm:text-base">${escapeHtml(dev.name || 'Perangkat Tanpa Nama')}</h4>
                ${statusBadge}
              </div>
              <div class="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                <span>IP: <strong class="text-slate-200">${dev.ip || '192.168.1.100'}</strong></span>
                <span>MAC: <strong class="text-slate-200">${dev.mac || '-'}</strong></span>
                <span class="text-cyan-400 font-semibold">${dev.frequency || '5.8 GHz'}</span>
                ${dev.bandwidth ? `<span class="text-emerald-400"><i class="fa-solid fa-gauge-high mr-1"></i>${dev.bandwidth}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 w-full sm:w-auto justify-end">
            <button type="button" class="btn-toggle-block px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${isBlocked ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60' : 'bg-red-950/70 text-red-300 border border-red-500/40 hover:bg-red-900/60'}" data-index="${idx}" data-id="${dev.id || idx}">
              <i class="${isBlocked ? 'fa-solid fa-check' : 'fa-solid fa-ban'}"></i>
              <span>${isBlocked ? 'Buka Blokir' : 'Blokir / Putuskan'}</span>
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    // Attach Event Listener ke Tombol Blokir / Buka Blokir
    document.querySelectorAll(".btn-toggle-block").forEach(btn => {
      btn.addEventListener("click", handleToggleBlockDevice);
    });
  }

  // Handle Toggle Blokir Perangkat
  async function handleToggleBlockDevice(e) {
    if (!currentRecord) return;
    const btn = e.currentTarget;
    const idx = parseInt(btn.getAttribute("data-index"), 10);
    const devices = currentRecord.wifiDevices || [];

    if (!devices[idx]) return;

    const dev = devices[idx];
    const willBlock = (dev.status !== "Diblokir");
    const confirmMsg = willBlock
      ? `Apakah Anda yakin ingin memblokir perangkat "${dev.name}" dari jaringan WiFi Anda? Perangkat ini tidak akan bisa mengakses internet.`
      : `Buka blokir untuk perangkat "${dev.name}" agar dapat terhubung kembali?`;

    if (!confirm(confirmMsg)) return;

    dev.status = willBlock ? "Diblokir" : "Aktif";
    showToast(`Memperbarui status perangkat "${dev.name}"...`, "info", 1500);

    try {
      // Simpan perubahan ke Firestore & Server
      const saveRes = await saveWifiDevices(currentRecord.ticketId, devices);
      if (saveRes.success) {
        showToast(`Perangkat "${dev.name}" berhasil ${willBlock ? 'diblokir' : 'diaktifkan kembali'}!`, "success");
        renderConnectedDevices(devices);
      } else {
        showToast("Gagal memperbarui status perangkat di server.", "error");
      }
    } catch (err) {
      console.error("Gagal toggle blokir:", err);
      showToast("Terjadi kendala saat mengubah status perangkat.", "error");
    }
  }

  // Form Submit Ganti Nama WiFi & Password
  const formUpdateWifi = document.getElementById("formUpdateWifi");
  if (formUpdateWifi) {
    formUpdateWifi.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentRecord) return;

      const newSSID = document.getElementById("editWifiSSID").value.trim();
      const newPass = document.getElementById("editWifiPassword").value;

      if (newSSID.length < 3) {
        showToast("Nama WiFi (SSID) minimal harus 3 karakter.", "warning");
        return;
      }
      if (newPass.length < 8) {
        showToast("Kata sandi WiFi minimal harus 8 karakter.", "warning");
        return;
      }

      const btnSubmit = document.getElementById("btnSubmitChangeWifi");
      const origText = btnSubmit.innerHTML;
      btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
      btnSubmit.disabled = true;

      try {
        showToast("Memperbarui Nama WiFi & Kata Sandi ke Router AirPro...", "info", 2500);

        const subId = currentRecord.subscriptionId || currentRecord.ticketId;
        const res = await updateWifiCredentials(subId, newSSID, newPass);

        if (res.success) {
          currentRecord.wifiSSID = newSSID;
          currentRecord.wifiPassword = newPass;

          // Update UI
          const elSSID = document.getElementById("currWifiSSID");
          const elPass = document.getElementById("currWifiPass");
          if (elSSID) elSSID.innerText = newSSID;
          if (elPass) elPass.innerText = isPasswordHidden ? "••••••••" : newPass;

          showToast("Nama WiFi & Kata Sandi berhasil diperbarui!", "success");
        } else {
          showToast("Gagal memperbarui WiFi. Silakan coba kembali.", "error");
        }
      } catch (err) {
        console.error("Update credentials error:", err);
        showToast("Terjadi kesalahan saat menyimpan pengaturan WiFi.", "error");
      } finally {
        btnSubmit.innerHTML = origText;
        btnSubmit.disabled = false;
      }
    });
  }

  // Tombol Refresh Perangkat
  const btnRefresh = document.getElementById("btnRefreshDevices");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      if (!currentRecord) return;
      const subId = currentRecord.subscriptionId || currentRecord.ticketId;
      showToast("Menyinkronkan data router terbaru...", "info", 1500);
      executeWifiSearch(subId);
    });
  }

  // Toggle Password Visibility di Info Box
  const btnToggleShowPass = document.getElementById("btnToggleShowPass");
  if (btnToggleShowPass) {
    btnToggleShowPass.addEventListener("click", () => {
      if (!currentRecord) return;
      isPasswordHidden = !isPasswordHidden;
      const elPass = document.getElementById("currWifiPass");
      if (elPass) elPass.innerText = isPasswordHidden ? "••••••••" : (currentRecord.wifiPassword || "ashtatic2026");
      btnToggleShowPass.innerHTML = isPasswordHidden ? `<i class="fa-regular fa-eye"></i>` : `<i class="fa-regular fa-eye-slash text-amber-400"></i>`;
    });
  }

  // Toggle Password Visibility di Form Edit
  const btnToggleEditPass = document.getElementById("btnToggleEditPass");
  if (btnToggleEditPass) {
    btnToggleEditPass.addEventListener("click", () => {
      const input = document.getElementById("editWifiPassword");
      if (!input) return;
      isEditPasswordHidden = !isEditPasswordHidden;
      input.type = isEditPasswordHidden ? "password" : "text";
      btnToggleEditPass.innerHTML = isEditPasswordHidden ? `<i class="fa-regular fa-eye"></i>` : `<i class="fa-regular fa-eye-slash text-amber-400"></i>`;
    });
  }

  // Copy SSID & Password
  const btnCopySSID = document.getElementById("btnCopyCurrSSID");
  if (btnCopySSID) {
    btnCopySSID.addEventListener("click", () => {
      if (!currentRecord) return;
      navigator.clipboard.writeText(currentRecord.wifiSSID || "Ashtatic-AirPro");
      showToast("Nama WiFi (SSID) berhasil disalin!", "success");
    });
  }

  const btnCopyPass = document.getElementById("btnCopyCurrPass");
  if (btnCopyPass) {
    btnCopyPass.addEventListener("click", () => {
      if (!currentRecord) return;
      navigator.clipboard.writeText(currentRecord.wifiPassword || "ashtatic2026");
      showToast("Kata Sandi WiFi berhasil disalin!", "success");
    });
  }

  // Helpers
  function getDeviceIcon(type) {
    switch ((type || "").toLowerCase()) {
      case "laptop": return "fa-solid fa-laptop";
      case "tv": case "smart_tv": return "fa-solid fa-tv";
      case "tablet": return "fa-solid fa-tablet-screen-button";
      case "desktop": case "pc": return "fa-solid fa-desktop";
      case "iot": case "cctv": return "fa-solid fa-microchip";
      case "console": return "fa-solid fa-gamepad";
      default: return "fa-solid fa-mobile-screen";
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }
});
