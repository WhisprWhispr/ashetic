// Ashtatic Internet Solution - Admin Dashboard Script
import { getAdminRegistrations, updateRegistrationStatus, deleteRegistrationPermanently } from "./firebase-config.js";
import { showToast, showCustomConfirm } from "./toast.js";

let adminRegistrations = [];
let currentFilter = "all";
let currentSearch = "";
let selectedTicketForModal = null;

const ADMIN_PASS_KEY = "ashtatic_admin_token";
const DEFAULT_PIN = "ashtatic2026";

document.addEventListener("DOMContentLoaded", () => {
  setupAdminAuth();
  setupFilterTabs();
  setupSearch();
  setupModalEvents();
  setupExport();
  setupManualAdd();
});

// Autentikasi Admin Sederhana & Aman
function setupAdminAuth() {
  const loginModal = document.getElementById("adminLoginModal");
  const adminMain = document.getElementById("adminMainContent");
  const loginForm = document.getElementById("adminLoginForm");
  const pinInput = document.getElementById("adminPinInput");
  const logoutBtn = document.getElementById("btnLogoutAdmin");
  const errorMsg = document.getElementById("loginErrorMsg");

  const savedToken = sessionStorage.getItem(ADMIN_PASS_KEY);
  if (savedToken === DEFAULT_PIN) {
    showDashboard();
  } else {
    showLoginModal();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      if (enteredPin === DEFAULT_PIN) {
        sessionStorage.setItem(ADMIN_PASS_KEY, enteredPin);
        if (errorMsg) errorMsg.classList.add("hidden");
        showToast("Login Admin berhasil!", "success");
        showDashboard();
      } else {
        if (errorMsg) {
          errorMsg.innerText = "PIN Admin salah!";
          errorMsg.classList.remove("hidden");
        }
        showToast("PIN Admin yang Anda masukkan salah!", "error");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_PASS_KEY);
      location.reload();
    });
  }

  function showLoginModal() {
    if (loginModal) loginModal.classList.remove("hidden");
    if (adminMain) adminMain.classList.add("hidden");
  }

  function showDashboard() {
    if (loginModal) loginModal.classList.add("hidden");
    if (adminMain) adminMain.classList.remove("hidden");
    loadRegistrations();
  }
}

// Memuat data pendaftaran
async function loadRegistrations() {
  const token = sessionStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_PIN;
  const refreshBtn = document.getElementById("btnRefreshData");
  if (refreshBtn) refreshBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat...`;

  try {
    adminRegistrations = await getAdminRegistrations(token);
    renderMetrics(adminRegistrations);
    renderTable();
  } catch (err) {
    console.error("Gagal memuat pendaftaran:", err);
    showToast("Gagal memuat data pendaftaran dari database.", "error");
  } finally {
    if (refreshBtn) refreshBtn.innerHTML = `<i class="fa-solid fa-rotate-right mr-1"></i> Segarkan Data`;
  }
}

// Render Kartu Metrik / KPI
function renderMetrics(data) {
  const total = data.length;
  const pending = data.filter(d => d.status === "menunggu_verifikasi" || d.status === "pending").length;
  const inProgress = data.filter(d => ["survey", "verifikasi", "jadwal_teknisi", "scheduled", "pemasangan", "in_progress"].includes(d.status)).length;
  const completed = data.filter(d => d.status === "selesai" || d.status === "aktif").length;
  const totalOmzet = data.filter(d => d.status === "selesai" || d.status === "aktif")
                         .reduce((acc, curr) => acc + (curr.packagePrice || 0), 0);

  const elTotal = document.getElementById("metricTotal");
  const elPending = document.getElementById("metricPending");
  const elInProgress = document.getElementById("metricInProgress");
  const elCompleted = document.getElementById("metricCompleted");
  const elOmzet = document.getElementById("metricOmzet");

  if (elTotal) elTotal.innerText = total;
  if (elPending) elPending.innerText = pending;
  if (elInProgress) elInProgress.innerText = inProgress;
  if (elCompleted) elCompleted.innerText = completed;
  if (elOmzet) elOmzet.innerText = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
}

// Setup Filter Tabs
function setupFilterTabs() {
  const tabs = document.querySelectorAll(".filter-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        t.classList.remove("bg-cyan-500", "text-black", "font-bold");
        t.classList.add("text-slate-400", "hover:text-white");
      });
      tab.classList.remove("text-slate-400", "hover:text-white");
      tab.classList.add("bg-cyan-500", "text-black", "font-bold");

      currentFilter = tab.getAttribute("data-filter") || "all";
      renderTable();
    });
  });

  const refreshBtn = document.getElementById("btnRefreshData");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      showToast("Menyegarkan data registrasi...", "info", 1500);
      loadRegistrations();
    });
  }
}

// Setup Search
function setupSearch() {
  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderTable();
    });
  }
}

// Render Tabel Pendaftar (Desktop & Mobile)
function renderTable() {
  const tbody = document.getElementById("adminTableBody");
  const mobileContainer = document.getElementById("adminMobileCards");
  const emptyState = document.getElementById("tableEmptyState");

  let filtered = adminRegistrations;

  // Filter Status
  if (currentFilter !== "all") {
    if (currentFilter === "pending") {
      filtered = filtered.filter(d => d.status === "menunggu_verifikasi" || d.status === "pending");
    } else if (currentFilter === "terverifikasi") {
      filtered = filtered.filter(d => d.status === "terverifikasi");
    } else if (currentFilter === "survey") {
      filtered = filtered.filter(d => d.status === "survey" || d.status === "verifikasi");
    } else if (currentFilter === "scheduled") {
      filtered = filtered.filter(d => d.status === "jadwal_teknisi" || d.status === "scheduled");
    } else if (currentFilter === "in_progress") {
      filtered = filtered.filter(d => d.status === "pemasangan" || d.status === "in_progress");
    } else if (currentFilter === "completed") {
      filtered = filtered.filter(d => d.status === "selesai" || d.status === "aktif");
    } else if (currentFilter === "cancelled") {
      filtered = filtered.filter(d => d.status === "ditolak" || d.status === "batal");
    }
  }

  // Filter Search
  if (currentSearch) {
    filtered = filtered.filter(d => 
      (d.ticketId && d.ticketId.toLowerCase().includes(currentSearch)) ||
      (d.fullName && d.fullName.toLowerCase().includes(currentSearch)) ||
      (d.phone && d.phone.toLowerCase().includes(currentSearch)) ||
      (d.address && d.address.toLowerCase().includes(currentSearch)) ||
      (d.packageName && d.packageName.toLowerCase().includes(currentSearch))
    );
  }

  if (filtered.length === 0) {
    if (tbody) tbody.innerHTML = "";
    if (mobileContainer) mobileContainer.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  let desktopHtml = "";
  let mobileHtml = "";

  filtered.forEach(item => {
    const statusBadge = getStatusBadge(item.status);
    const dateFormatted = item.createdAtReadable || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : "-");

    // WhatsApp Direct Link
    const cleanPhone = (item.phone || "").replace(/\D/g, "");
    const waPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
    const waMessage = encodeURIComponent(
      `Halo Bapak/Ibu ${item.fullName},\n\nKami dari Ashtatic Internet Solution menginformasikan status pendaftaran Anda:\n` +
      `Nomor Tiket: ${item.ticketId}\n` +
      `Paket: ${item.packageName || item.packageSpeed}\n` +
      `Status Terkini: ${getStatusText(item.status)}\n` +
      (item.technician ? `Teknisi: ${item.technician}\n` : '') +
      (item.adminNotes ? `Catatan: ${item.adminNotes}\n` : '') +
      `\nAda yang dapat kami bantu lebih lanjut?`
    );

    // Desktop Table Row
    desktopHtml += `
      <tr class="border-b border-slate-800/80 hover:bg-slate-900/60 transition">
        <td class="px-4 py-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
          ${item.ticketId}
        </td>
        <td class="px-4 py-3">
          <div class="font-bold text-white">${item.fullName}</div>
          <div class="text-[11px] text-slate-400">${item.email || '-'}</div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <a href="https://wa.me/${waPhone}?text=${waMessage}" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            <i class="fa-brands fa-whatsapp text-sm"></i> ${item.phone}
          </a>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <span class="inline-block px-2.5 py-0.5 rounded text-xs font-bold ${item.packageId === '150mbps' ? 'bg-purple-950/70 border border-purple-500/50 text-purple-300' : 'bg-cyan-950/70 border border-cyan-500/50 text-cyan-300'}">
            ${item.packageName || 'Paket'}
          </span>
          <div class="text-[11px] text-slate-400 mt-0.5">Rp ${(item.packagePrice || 0).toLocaleString('id-ID')}/bln</div>
        </td>
        <td class="px-4 py-3 max-w-xs truncate text-xs text-slate-300" title="${item.address}">
          ${item.address}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          ${item.wifiSSID ? `
            <div class="space-y-0.5">
              <div class="font-mono text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                <i class="fa-solid fa-wifi text-cyan-400 text-[10px]"></i> ${item.wifiSSID}
              </div>
              <div class="font-mono text-amber-300 text-[11px] flex items-center gap-1">
                <i class="fa-solid fa-key text-[9px] text-amber-400"></i> ${item.wifiPassword || '-'}
              </div>
            </div>
          ` : `
            <span class="text-slate-500 text-[11px] italic flex items-center gap-1">
              <i class="fa-solid fa-clock text-[10px]"></i> Belum disetel
            </span>
          `}
        </td>
        <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
          ${dateFormatted}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition text-xs btn-view-detail" data-ticket="${item.ticketId}" title="Lihat Detail Lengkap">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 transition text-xs font-semibold px-2.5 btn-edit-status" data-ticket="${item.ticketId}" title="Update Status Pendaftaran">
              <i class="fa-solid fa-pen-to-square mr-1"></i> Ubah
            </button>
            <button class="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition text-xs btn-delete-reg" data-ticket="${item.ticketId}" title="Hapus Data">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;

    // Mobile Card Layout
    mobileHtml += `
      <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="font-mono font-bold text-cyan-400 text-xs">${item.ticketId}</span>
            <div class="font-bold text-white text-sm">${item.fullName}</div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Paket:</span>
            <span class="font-semibold text-cyan-300">${item.packageName || 'Paket'} (Rp ${(item.packagePrice || 0).toLocaleString('id-ID')})</span>
          </div>
          <div class="text-slate-400 pt-0.5 truncate leading-snug">
            <i class="fa-solid fa-location-dot text-[11px] text-cyan-400 mr-1"></i> ${item.address}
          </div>
        </div>

        ${item.wifiSSID ? `
          <div class="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-xs space-y-1">
            <div class="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
              <i class="fa-solid fa-wifi"></i> WiFi Pelanggan (AirPro):
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono pt-0.5">
              <div><span class="text-slate-400 text-[10px] block">SSID:</span> <span class="text-white font-bold">${item.wifiSSID}</span></div>
              <div><span class="text-slate-400 text-[10px] block">Sandi:</span> <span class="text-amber-300 font-bold">${item.wifiPassword || '-'}</span></div>
            </div>
          </div>
        ` : `
          <div class="text-[11px] text-slate-500 italic flex items-center gap-1 px-1">
            <i class="fa-solid fa-wifi text-[10px] text-slate-600"></i> WiFi: Belum diatur pelanggan
          </div>
        `}

        <div class="flex items-center justify-between pt-1 gap-2">
          <a href="https://wa.me/${waPhone}?text=${waMessage}" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30">
            <i class="fa-brands fa-whatsapp text-sm"></i> Chat WA
          </a>

          <div class="flex items-center gap-1.5">
            <button class="p-2 rounded-lg bg-slate-800 text-cyan-400 text-xs btn-view-detail" data-ticket="${item.ticketId}" title="Detail">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold btn-edit-status" data-ticket="${item.ticketId}" title="Ubah Status">
              <i class="fa-solid fa-pen-to-square mr-1"></i> Ubah
            </button>
            <button class="p-2 rounded-lg bg-red-950/40 text-red-400 text-xs btn-delete-reg" data-ticket="${item.ticketId}" title="Hapus">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  if (tbody) tbody.innerHTML = desktopHtml;
  if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
  bindTableActions();
}

function getStatusBadge(status) {
  switch (status) {
    case "menunggu_verifikasi":
    case "pending":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Verifikasi Baru</span>`;
    case "terverifikasi":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-400 flex items-center gap-1.5 w-fit shadow-[0_0_12px_rgba(0,240,255,0.4)]"><i class="fa-solid fa-circle-check text-cyan-400 text-[10px]"></i> Terverifikasi</span>`;
    case "survey":
    case "verifikasi":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/70 text-blue-300 border border-blue-500/50 flex items-center gap-1.5 w-fit"><i class="fa-solid fa-satellite-dish text-[10px]"></i> Survey</span>`;
    case "jadwal_teknisi":
    case "scheduled":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-500/50 flex items-center gap-1.5 w-fit"><i class="fa-solid fa-calendar-check text-[10px]"></i> Jadwal Dibuat</span>`;
    case "pemasangan":
    case "in_progress":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/70 text-purple-300 border border-purple-500/50 flex items-center gap-1.5 w-fit"><i class="fa-solid fa-wrench text-[10px]"></i> Sedang Pasang</span>`;
    case "selesai":
    case "aktif":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 w-fit"><i class="fa-solid fa-circle-check text-[10px]"></i> Selesai & Internet Aktif</span>`;
    case "ditolak":
    case "batal":
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-950/70 text-red-300 border border-red-500/50 flex items-center gap-1.5 w-fit"><i class="fa-solid fa-ban text-[10px]"></i> Dibatalkan</span>`;
    default:
      return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300">${status}</span>`;
  }
}

function getStatusText(status) {
  switch (status) {
    case "menunggu_verifikasi": case "pending": return "Menunggu Verifikasi Data";
    case "terverifikasi": return "Data Terverifikasi & Disetujui (Silakan Atur WiFi)";
    case "survey": case "verifikasi": return "Survey & Cek Sinyal Wifi AirPro";
    case "jadwal_teknisi": case "scheduled": return "Jadwal Kunjungan Teknisi Ditentukan";
    case "pemasangan": case "in_progress": return "Sedang Dilakukan Pemasangan Modem di Lokasi";
    case "selesai": case "aktif": return "Selesai & Internet Aktif";
    case "ditolak": case "batal": return "Pendaftaran Dibatalkan";
    default: return status;
  }
}

// Setup Event Listeners untuk Tombol di Setiap Baris Tabel & Kartu Mobile
function bindTableActions() {
  // Detail button
  document.querySelectorAll(".btn-view-detail").forEach(btn => {
    btn.addEventListener("click", () => {
      const ticket = btn.getAttribute("data-ticket");
      const item = adminRegistrations.find(d => d.ticketId === ticket);
      if (item) showDetailModal(item);
    });
  });

  // Edit status button
  document.querySelectorAll(".btn-edit-status").forEach(btn => {
    btn.addEventListener("click", () => {
      const ticket = btn.getAttribute("data-ticket");
      const item = adminRegistrations.find(d => d.ticketId === ticket);
      if (item) showEditStatusModal(item);
    });
  });

  // Delete button dengan Custom Confirmation Dialog (Hapus Permanen)
  document.querySelectorAll(".btn-delete-reg").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ticket = btn.getAttribute("data-ticket");
      const confirmed = await showCustomConfirm(
        "Hapus Data Permanen?",
        `Apakah Anda yakin ingin menghapus tiket ${ticket} secara PERMANEN? Data ini akan langsung dimusnahkan dari sistem database selamanya.`,
        "Ya, Hapus Permanen",
        "Batal"
      );

      if (confirmed) {
        await deleteRegistration(ticket);
      }
    });
  });
}

// Modal Detail Pendaftar
function showDetailModal(item) {
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  document.getElementById("modalDetTicket").innerText = item.ticketId;
  document.getElementById("modalDetName").innerText = item.fullName;
  document.getElementById("modalDetPhone").innerText = item.phone;
  document.getElementById("modalDetEmail").innerText = item.email || "-";
  document.getElementById("modalDetPackage").innerText = `${item.packageName} (${item.packageSpeed}) - Rp ${(item.packagePrice || 0).toLocaleString('id-ID')}/bln`;
  document.getElementById("modalDetAddress").innerText = item.address;
  document.getElementById("modalDetCoords").innerText = item.coordinates || "Tidak disertakan";
  document.getElementById("modalDetProperty").innerText = item.propertyType || "Rumah Pribadi";
  document.getElementById("modalDetSchedule").innerText = item.preferredSchedule || "Secepatnya";
  document.getElementById("modalDetNotes").innerText = item.notes || "Tidak ada catatan pemesan";
  document.getElementById("modalDetStatus").innerHTML = getStatusBadge(item.status);
  document.getElementById("modalDetTech").innerText = item.technician || "Belum ditugaskan";
  document.getElementById("modalDetAdminNotes").innerText = item.adminNotes || "Tidak ada";

  const ssidEl = document.getElementById("modalDetSSID");
  const passEl = document.getElementById("modalDetPass");
  if (ssidEl) ssidEl.innerText = item.wifiSSID || "Belum diatur oleh pelanggan";
  if (passEl) passEl.innerText = item.wifiPassword || "Belum diatur";

  const subBox = document.getElementById("modalDetSubBox");
  const subEl = document.getElementById("modalDetSubId");
  if (item.status === "selesai" || item.status === "aktif") {
    const subId = item.subscriptionId || `ASH-SUB-${(item.ticketId || '').replace(/[^0-9]/g, '')}`;
    if (subEl) subEl.innerText = subId;
    if (subBox) subBox.classList.remove("hidden");
  } else {
    if (subBox) subBox.classList.add("hidden");
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

// Template Catatan Standar Berdasarkan Kategori Status Pemasangan
const STATUS_NOTE_TEMPLATES = {
  menunggu_verifikasi: "Menunggu verifikasi identitas dan validasi jangkauan area oleh tim CS.",
  pending: "Menunggu verifikasi identitas dan validasi jangkauan area oleh tim CS.",
  terverifikasi: "Data pendaftaran telah terverifikasi & disetujui. Pelanggan dapat mengatur Nama WiFi (SSID) & Kata Sandi melalui menu Tracking Tiket.",
  survey: "Tim lapangan sedang melakukan validasi jangkauan frekuensi dan uji kuat sinyal Wifi AirPro di sekitar titik koordinat lokasi.",
  verifikasi: "Tim lapangan sedang melakukan validasi jangkauan frekuensi dan uji kuat sinyal Wifi AirPro di sekitar titik koordinat lokasi.",
  jadwal_teknisi: "Jadwal kunjungan teknisi telah ditentukan. Teknisi membawa unit Modem Wifi AirPro dan perlengkapan instalasi.",
  scheduled: "Jadwal kunjungan teknisi telah ditentukan. Teknisi membawa unit Modem Wifi AirPro dan perlengkapan instalasi.",
  pemasangan: "Teknisi sedang berada di lokasi untuk melakukan proses instalasi dan aktivasi perangkat Modem Wifi AirPro.",
  in_progress: "Teknisi sedang berada di lokasi untuk melakukan proses instalasi dan aktivasi perangkat Modem Wifi AirPro.",
  selesai: "Instalasi modem Wifi AirPro selesai, redaman sinyal sangat bagus dan koneksi internet telah aktif normal. Pelanggan puas.",
  aktif: "Instalasi modem Wifi AirPro selesai, redaman sinyal sangat bagus dan koneksi internet telah aktif normal. Pelanggan puas.",
  ditolak: "Pendaftaran dibatalkan atau ditunda sementara dikarenakan kendala jangkauan sinyal atau permohonan pelanggan.",
  batal: "Pendaftaran dibatalkan atau ditunda sementara dikarenakan kendala jangkauan sinyal atau permohonan pelanggan."
};

// Modal Edit Status
function showEditStatusModal(item) {
  selectedTicketForModal = item.ticketId;
  const modal = document.getElementById("editStatusModal");
  if (!modal) return;

  document.getElementById("editModalTicket").innerText = item.ticketId;
  document.getElementById("editModalCustomer").innerText = item.fullName;
  
  const selectStatus = document.getElementById("selectNewStatus");
  selectStatus.value = item.status;
  
  document.getElementById("inputTechnician").value = item.technician || "";
  
  // Tampilkan data WiFi Pelanggan di Modal Ubah Status
  const editSSID = document.getElementById("editModalSSID");
  const editPass = document.getElementById("editModalPass");
  const editBadge = document.getElementById("editModalWifiBadge");

  if (item.wifiSSID) {
    if (editSSID) editSSID.innerText = item.wifiSSID;
    if (editPass) editPass.innerText = item.wifiPassword || "-";
    if (editBadge) editBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle-check text-[10px]"></i> Sudah Dikonfigurasi</span>`;
  } else {
    if (editSSID) editSSID.innerText = "Belum diatur oleh pelanggan";
    if (editPass) editPass.innerText = "Belum diatur";
    if (editBadge) editBadge.innerHTML = `<span class="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-clock text-[10px]"></i> Belum Diatur</span>`;
  }

  const noteInput = document.getElementById("inputAdminNotes");
  // Tampilkan catatan yang tersimpan, atau jika kosong otomatis isi sesuai statusnya
  noteInput.value = item.adminNotes || STATUS_NOTE_TEMPLATES[item.status] || "";

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

// Setup Event Handlers untuk Modal
function setupModalEvents() {
  // Tutup Modal Detail
  const btnCloseDet = document.getElementById("btnCloseDetailModal");
  const detModal = document.getElementById("detailModal");
  if (btnCloseDet && detModal) {
    btnCloseDet.onclick = () => {
      detModal.classList.add("hidden");
      detModal.classList.remove("flex");
    };
  }

  // Tutup Modal Edit
  const btnCloseEdit = document.getElementById("btnCloseEditModal");
  const editModal = document.getElementById("editStatusModal");
  if (btnCloseEdit && editModal) {
    btnCloseEdit.onclick = () => {
      editModal.classList.add("hidden");
      editModal.classList.remove("flex");
    };
  }

  // SINKRONISASI OTOMATIS: Catatan Internal Menyesuaikan Kategori Status yang Dipilih
  const selectStatus = document.getElementById("selectNewStatus");
  const noteInput = document.getElementById("inputAdminNotes");
  const btnApplyTemplate = document.getElementById("btnApplyTemplateNote");

  if (selectStatus && noteInput) {
    selectStatus.addEventListener("change", () => {
      const selected = selectStatus.value;
      if (STATUS_NOTE_TEMPLATES[selected]) {
        noteInput.value = STATUS_NOTE_TEMPLATES[selected];

        // Efek visual highlight pada textarea
        noteInput.classList.add("border-cyan-400", "bg-cyan-950/40");
        setTimeout(() => {
          noteInput.classList.remove("border-cyan-400", "bg-cyan-950/40");
        }, 600);
      }
    });
  }

  if (btnApplyTemplate && selectStatus && noteInput) {
    btnApplyTemplate.addEventListener("click", () => {
      const selected = selectStatus.value;
      if (STATUS_NOTE_TEMPLATES[selected]) {
        noteInput.value = STATUS_NOTE_TEMPLATES[selected];
        showToast("Catatan berhasil disesuaikan dengan kategori status!", "info");
      }
    });
  }

  // Submit Form Edit Status
  const editForm = document.getElementById("editStatusForm");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedTicketForModal) return;

      const newStatus = document.getElementById("selectNewStatus").value;
      const technician = document.getElementById("inputTechnician").value.trim();
      const notes = document.getElementById("inputAdminNotes").value.trim();
      const token = sessionStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_PIN;

      const saveBtn = editForm.querySelector("button[type='submit']");
      const origText = saveBtn.innerHTML;
      saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
      saveBtn.disabled = true;

      try {
        await updateRegistrationStatus(selectedTicketForModal, newStatus, technician, notes, token);

        // Update local state
        const item = adminRegistrations.find(d => d.ticketId === selectedTicketForModal);
        if (item) {
          item.status = newStatus;
          item.technician = technician;
          item.adminNotes = notes;
        }

        editModal.classList.add("hidden");
        editModal.classList.remove("flex");
        renderMetrics(adminRegistrations);
        renderTable();
        showToast(`Status tiket ${selectedTicketForModal} berhasil diperbarui!`, "success");
      } catch (err) {
        console.error("Gagal update status:", err);
        showToast("Gagal memperbarui status. Periksa jaringan Anda.", "error");
      } finally {
        saveBtn.innerHTML = origText;
        saveBtn.disabled = false;
      }
    });
  }
}

// Hapus Registrasi Secara Permanen
async function deleteRegistration(ticketId) {
  const token = sessionStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_PIN;
  showToast(`Menghapus data tiket ${ticketId} secara permanen...`, "info", 2000);

  try {
    const res = await deleteRegistrationPermanently(ticketId, token);
    if (res.success) {
      adminRegistrations = adminRegistrations.filter(d => d.ticketId !== ticketId);
      renderMetrics(adminRegistrations);
      renderTable();
      showToast(`Data tiket ${ticketId} telah terhapus PERMANEN dari sistem database!`, "success", 4000);
    } else {
      showToast("Gagal menghapus data tiket secara permanen.", "error");
    }
  } catch (err) {
    console.error("Gagal menghapus permanen:", err);
    showToast("Terjadi kendala saat menghapus data permanen.", "error");
  }
}

// Export ke format CSV
function setupExport() {
  const exportBtn = document.getElementById("btnExportCsv");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (adminRegistrations.length === 0) {
        showToast("Belum ada data registrasi untuk diexport.", "warning");
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Nomor Tiket,Nama Lengkap,No WhatsApp,Email,Paket,Harga,Alamat,Status,Teknisi,Catatan,Tanggal\n";

      adminRegistrations.forEach(r => {
        const row = [
          `"${r.ticketId || ''}"`,
          `"${r.fullName || ''}"`,
          `"${r.phone || ''}"`,
          `"${r.email || ''}"`,
          `"${r.packageName || ''}"`,
          `"${r.packagePrice || ''}"`,
          `"${(r.address || '').replace(/"/g, '""')}"`,
          `"${r.status || ''}"`,
          `"${r.technician || ''}"`,
          `"${(r.adminNotes || r.notes || '').replace(/"/g, '""')}"`,
          `"${r.createdAt || ''}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `pendaftaran_ashtatic_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Data pendaftaran berhasil diexport ke CSV!", "success");
    });
  }
}

// Tambah Manual Registrasi oleh Admin
function setupManualAdd() {
  const openBtn = document.getElementById("btnOpenManualAdd");
  const modal = document.getElementById("manualAddModal");
  const closeBtn = document.getElementById("btnCloseManualModal");
  const form = document.getElementById("manualAddForm");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      const manStatus = document.getElementById("manStatus");
      const manNotes = document.getElementById("manNotes");
      if (manStatus && manNotes && !manNotes.value) {
        manNotes.value = STATUS_NOTE_TEMPLATES[manStatus.value] || "";
      }
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  }

  const manStatus = document.getElementById("manStatus");
  const manNotes = document.getElementById("manNotes");
  if (manStatus && manNotes) {
    manStatus.addEventListener("change", () => {
      manNotes.value = STATUS_NOTE_TEMPLATES[manStatus.value] || "";
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = new Date();
      const ticketId = `ASH-${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const pkg = document.getElementById("manPackage").value;
      let pkgName = "Paket 150 Mbps";
      let pkgPrice = 180000;
      let pkgSpeed = "150 Mbps";

      if (pkg === "100mbps") {
        pkgName = "Paket 100 Mbps";
        pkgPrice = 105000;
        pkgSpeed = "100 Mbps";
      } else if (pkg === "200mbps") {
        pkgName = "Paket 200 Mbps";
        pkgPrice = 205000;
        pkgSpeed = "200 Mbps";
      }

      const newEntry = {
        ticketId: ticketId,
        fullName: document.getElementById("manName").value.trim(),
        phone: document.getElementById("manPhone").value.trim(),
        email: document.getElementById("manEmail").value.trim() || "-",
        packageId: pkg,
        packageName: pkgName,
        packageSpeed: pkgSpeed,
        packagePrice: pkgPrice,
        address: document.getElementById("manAddress").value.trim(),
        status: document.getElementById("manStatus").value,
        technician: document.getElementById("manTechnician").value.trim(),
        adminNotes: document.getElementById("manNotes").value.trim(),
        createdAt: new Date().toISOString(),
        createdAtReadable: new Date().toLocaleDateString('id-ID', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      };

      try {
        const token = sessionStorage.getItem(ADMIN_PASS_KEY) || DEFAULT_PIN;
        await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEntry)
        });

        adminRegistrations.unshift(newEntry);
        renderMetrics(adminRegistrations);
        renderTable();

        form.reset();
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        showToast(`Registrasi manual ${ticketId} berhasil ditambahkan!`, "success");
      } catch (err) {
        showToast("Gagal menambahkan registrasi.", "error");
      }
    });
  }
}
