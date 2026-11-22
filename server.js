import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || "ashtatic2026";
const DATA_FILE = path.join(__dirname, "data", "registrations.json");
const REPORTS_FILE = path.join(__dirname, "data", "reports.json");

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, "public")));

// Helper: Membaca data registrasi dari file JSON
async function readRegistrations() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
      return [];
    }
    console.error("Error reading registrations:", err);
    return [];
  }
}

// Helper: Menyimpan data registrasi ke file JSON
async function saveRegistrations(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error saving registrations:", err);
    return false;
  }
}

// Helper: Membaca data laporan gangguan dari file JSON
async function readReports() {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.writeFile(REPORTS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    console.error("Error reading reports:", err);
    return [];
  }
}

// Helper: Menyimpan data laporan gangguan ke file JSON
async function saveReports(data) {
  try {
    await fs.writeFile(REPORTS_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error saving reports:", err);
    return false;
  }
}

// Helper: Validasi Admin Token
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace("Bearer ", "").trim() : "";

  if (token === ADMIN_PIN) {
    return next();
  }
  return res.status(401).json({ success: false, message: "Akses ditolak: PIN / Token Admin tidak valid." });
}

// ========================================================
// API ROUTES
// ========================================================

// 1. Simpan Pendaftaran Baru (POST /api/register)
app.post("/api/register", async (req, res) => {
  try {
    const {
      ticketId,
      fullName,
      phone,
      email,
      packageId,
      packageName,
      packageSpeed,
      packagePrice,
      address,
      city,
      coordinates,
      propertyType,
      preferredSchedule,
      notes
    } = req.body;

    if (!fullName || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Nama, nomor telepon/WhatsApp, dan alamat wajib diisi."
      });
    }

    const newTicketId = ticketId || `ASH-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      ticketId: newTicketId,
      fullName,
      phone,
      email: email || "-",
      packageId: packageId || "150mbps",
      packageName: packageName || "Paket 150 Mbps",
      packageSpeed: packageSpeed || "150 Mbps",
      packagePrice: packagePrice ? Number(packagePrice) : 180000,
      address,
      city: city || "Area Layanan Ashtatic",
      coordinates: coordinates || "",
      propertyType: propertyType || "Rumah Pribadi",
      preferredSchedule: preferredSchedule || "Secepatnya",
      notes: notes || "",
      status: "menunggu_verifikasi",
      statusLabel: "Menunggu Verifikasi Data",
      technician: "",
      adminNotes: "",
      createdAt: new Date().toISOString(),
      createdAtReadable: new Date().toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    };

    const currentList = await readRegistrations();
    // Prepend to top
    currentList.unshift(newRecord);
    await saveRegistrations(currentList);

    console.log(`[REGISTRASI BARU] Tiket: ${newTicketId} | Pemohon: ${fullName} | Telp: ${phone}`);

    return res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil disimpan ke sistem.",
      data: newRecord
    });
  } catch (error) {
    console.error("API Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal pada server."
    });
  }
});

// 2. Lacak Status Registrasi (GET /api/track/:query)
app.get("/api/track/:query", async (req, res) => {
  try {
    const rawQuery = decodeURIComponent(req.params.query).trim();
    const query = rawQuery.toUpperCase();
    const cleanPhone = rawQuery.replace(/\D/g, "");

    const list = await readRegistrations();

    // Cari by Ticket ID, Phone, atau Email
    const matched = list.find(item => {
      const itemTicket = (item.ticketId || "").toUpperCase();
      const itemPhoneClean = (item.phone || "").replace(/\D/g, "");
      const itemEmail = (item.email || "").toUpperCase();

      return itemTicket === query || 
             (cleanPhone.length >= 8 && itemPhoneClean.endsWith(cleanPhone.slice(-8))) ||
             (itemEmail.length > 3 && itemEmail === query);
    });

    if (matched) {
      return res.json({
        success: true,
        registration: matched
      });
    }

    return res.status(404).json({
      success: false,
      message: "Nomor tiket atau nomor telepon tidak ditemukan di data pendaftaran."
    });
  } catch (error) {
    console.error("API Track error:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});

// 2b. Simpan Pengaturan WiFi SSID & Password oleh User (POST /api/tracking/wifi-config/:ticketId)
app.post("/api/tracking/wifi-config/:ticketId", async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { wifiSSID, wifiPassword } = req.body;

    if (!wifiSSID || !wifiPassword) {
      return res.status(400).json({
        success: false,
        message: "Nama WiFi (SSID) dan Kata Sandi (Password) wajib diisi."
      });
    }

    if (wifiPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Kata sandi WiFi minimal harus 8 karakter."
      });
    }

    const list = await readRegistrations();
    const index = list.findIndex(d => (d.ticketId || "").toUpperCase() === ticketId.toUpperCase());

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Tiket tidak ditemukan." });
    }

    list[index].wifiSSID = wifiSSID.trim();
    list[index].wifiPassword = wifiPassword;
    list[index].wifiConfiguredAt = new Date().toISOString();
    list[index].updatedAt = new Date().toISOString();

    await saveRegistrations(list);
    console.log(`[WIFI CONFIG] Tiket ${ticketId} mengatur SSID: "${wifiSSID}"`);

    return res.json({
      success: true,
      message: "Nama WiFi (SSID) dan Kata Sandi berhasil disimpan!",
      data: list[index]
    });
  } catch (error) {
    console.error("API WiFi Config error:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan internal pada server." });
  }
});

// 2c. Cek Pengguna WiFi berdasarkan ID Langganan / Tiket (GET /api/wifi/devices/:query)
app.get("/api/wifi/devices/:query", async (req, res) => {
  try {
    const rawQuery = decodeURIComponent(req.params.query).trim().toUpperCase();
    const cleanNumbers = rawQuery.replace(/[^0-9]/g, "");

    const list = await readRegistrations();
    const matched = list.find(item => {
      const itemTicket = (item.ticketId || "").toUpperCase();
      const itemSubId = (item.subscriptionId || `ASH-SUB-${itemTicket.replace(/[^0-9]/g, '')}`).toUpperCase();
      const itemTicketNum = itemTicket.replace(/[^0-9]/g, "");

      return itemTicket === rawQuery ||
             itemSubId === rawQuery ||
             (cleanNumbers.length >= 4 && (itemSubId.includes(cleanNumbers) || itemTicketNum.endsWith(cleanNumbers)));
    });

    if (matched) {
      // Pastikan ID Langganan ada
      if (!matched.subscriptionId) {
        matched.subscriptionId = `ASH-SUB-${(matched.ticketId || '').replace(/[^0-9]/g, '')}`;
      }
      return res.json({
        success: true,
        registration: {
          ticketId: matched.ticketId,
          subscriptionId: matched.subscriptionId,
          fullName: matched.fullName,
          packageName: matched.packageName || "Paket AirPro",
          packageSpeed: matched.packageSpeed || "150 Mbps",
          wifiSSID: matched.wifiSSID || "Ashtatic-AirPro",
          wifiPassword: matched.wifiPassword || "ashtatic2026",
          status: matched.status,
          wifiDevices: matched.wifiDevices || []
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: "ID Langganan atau Nomor Tiket tidak ditemukan. Silakan periksa kembali."
    });
  } catch (error) {
    console.error("API Get WiFi Devices error:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});

// 2d. Update Nama WiFi & Password via ID Langganan (POST /api/wifi/update-credentials)
app.post("/api/wifi/update-credentials", async (req, res) => {
  try {
    const { query, wifiSSID, wifiPassword } = req.body;
    if (!query || !wifiSSID || !wifiPassword) {
      return res.status(400).json({ success: false, message: "ID Langganan, Nama WiFi, dan Kata Sandi wajib diisi." });
    }
    if (wifiPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Kata sandi WiFi minimal harus 8 karakter." });
    }

    const cleanQuery = query.trim().toUpperCase();
    const list = await readRegistrations();
    const index = list.findIndex(item => {
      const itemTicket = (item.ticketId || "").toUpperCase();
      const itemSubId = (item.subscriptionId || `ASH-SUB-${itemTicket.replace(/[^0-9]/g, '')}`).toUpperCase();
      return itemTicket === cleanQuery || itemSubId === cleanQuery;
    });

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Data langganan tidak ditemukan." });
    }

    list[index].wifiSSID = wifiSSID.trim();
    list[index].wifiPassword = wifiPassword;
    list[index].wifiConfiguredAt = new Date().toISOString();
    list[index].updatedAt = new Date().toISOString();

    await saveRegistrations(list);
    return res.json({
      success: true,
      message: "Nama WiFi (SSID) & Kata Sandi berhasil diperbarui!",
      data: {
        ticketId: list[index].ticketId,
        subscriptionId: list[index].subscriptionId,
        wifiSSID: list[index].wifiSSID,
        wifiPassword: list[index].wifiPassword
      }
    });
  } catch (error) {
    console.error("API Update WiFi Credentials error:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui data WiFi." });
  }
});

// 2e. Toggle Blokir / Putuskan Perangkat oleh Pelanggan (POST /api/wifi/toggle-block-device)
app.post("/api/wifi/toggle-block-device", async (req, res) => {
  try {
    const { query, deviceId } = req.body;
    if (!query || !deviceId) {
      return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
    }

    const cleanQuery = query.trim().toUpperCase();
    const list = await readRegistrations();
    const index = list.findIndex(item => {
      const itemTicket = (item.ticketId || "").toUpperCase();
      const itemSubId = (item.subscriptionId || `ASH-SUB-${itemTicket.replace(/[^0-9]/g, '')}`).toUpperCase();
      return itemTicket === cleanQuery || itemSubId === cleanQuery;
    });

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan." });
    }

    const devices = list[index].wifiDevices || [];
    const devIndex = devices.findIndex(d => d.id === deviceId);
    if (devIndex === -1) {
      return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan di daftar." });
    }

    devices[devIndex].status = (devices[devIndex].status === "Diblokir") ? "Aktif" : "Diblokir";
    list[index].wifiDevices = devices;
    list[index].updatedAt = new Date().toISOString();

    await saveRegistrations(list);
    return res.json({
      success: true,
      message: `Status perangkat "${devices[devIndex].name}" berhasil diubah menjadi ${devices[devIndex].status}.`,
      devices
    });
  } catch (error) {
    console.error("API Toggle Block error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengubah status perangkat." });
  }
});

// 2f. Admin: Simpan / Kelola Daftar Pengguna WiFi Pelanggan (POST /api/admin/wifi-devices/:ticketId)
app.post("/api/admin/wifi-devices/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { wifiDevices } = req.body;

    if (!Array.isArray(wifiDevices)) {
      return res.status(400).json({ success: false, message: "Daftar perangkat harus berupa array." });
    }

    const list = await readRegistrations();
    const index = list.findIndex(d => (d.ticketId || "").toUpperCase() === ticketId.toUpperCase());

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Tiket pelanggan tidak ditemukan." });
    }

    list[index].wifiDevices = wifiDevices;
    list[index].updatedAt = new Date().toISOString();

    await saveRegistrations(list);
    console.log(`[ADMIN WIFI DEVICES] Diperbarui ${wifiDevices.length} perangkat untuk tiket ${ticketId}`);

    return res.json({
      success: true,
      message: `Berhasil menyimpan ${wifiDevices.length} daftar pengguna WiFi untuk tiket ${ticketId}.`,
      wifiDevices: list[index].wifiDevices
    });
  } catch (error) {
    console.error("API Admin WiFi Devices error:", error);
    return res.status(500).json({ success: false, message: "Gagal menyimpan data perangkat pengguna." });
  }
});

// 3. Admin: Ambil Semua Registrasi (GET /api/admin/registrations)
app.get("/api/admin/registrations", verifyAdmin, async (req, res) => {
  try {
    const list = await readRegistrations();
    return res.json({
      success: true,
      count: list.length,
      registrations: list
    });
  } catch (error) {
    console.error("API Admin registrations error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data." });
  }
});

// 4. Admin: Update Status Pendaftaran (PUT /api/admin/update-status/:ticketId)
app.put("/api/admin/update-status/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    const { status, technician, notes } = req.body;

    const list = await readRegistrations();
    const index = list.findIndex(d => d.ticketId === ticketId);

    if (index === -1) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan." });
    }

    if (status) list[index].status = status;
    if (technician !== undefined) list[index].technician = technician;
    if (notes !== undefined) list[index].adminNotes = notes;
    list[index].updatedAt = new Date().toISOString();

    await saveRegistrations(list);

    console.log(`[UPDATE STATUS] Tiket: ${ticketId} -> Status: ${status}`);

    return res.json({
      success: true,
      message: "Status pendaftaran berhasil diperbarui.",
      data: list[index]
    });
  } catch (error) {
    console.error("API Update status error:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui status." });
  }
});

// 5. Admin: Hapus Registrasi (DELETE /api/admin/delete/:ticketId)
app.delete("/api/admin/delete/:ticketId", verifyAdmin, async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    let list = await readRegistrations();
    const initialLen = list.length;
    list = list.filter(d => d.ticketId !== ticketId);

    if (list.length === initialLen) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan." });
    }

    await saveRegistrations(list);
    return res.json({ success: true, message: "Data pendaftaran berhasil dihapus." });
  } catch (error) {
    console.error("API Delete error:", error);
    return res.status(500).json({ success: false, message: "Gagal menghapus data." });
  }
});

// 6. Public Summary Stats (GET /api/stats)
app.get("/api/stats", async (req, res) => {
  try {
    const list = await readRegistrations();
    return res.json({
      success: true,
      total: list.length,
      active: list.filter(d => d.status === "selesai" || d.status === "aktif").length
    });
  } catch (err) {
    return res.json({ success: false, total: 0, active: 0 });
  }
});

// ========================================================
// API ROUTES UNTUK LAPOR GANGGUAN JARINGAN
// ========================================================

// 1. Submit Laporan Baru (POST /api/reports/submit)
app.post("/api/reports/submit", async (req, res) => {
  try {
    const {
      subscriptionId,
      ticketId,
      customerName,
      phone,
      category,
      categoryLabel,
      description,
      urgency,
      customSSID,
      customPassword
    } = req.body;

    if (!phone || !category) {
      return res.status(400).json({
        success: false,
        message: "Nomor WhatsApp dan Kategori Gangguan wajib diisi."
      });
    }

    const yy = new Date().getFullYear().toString().slice(-2);
    const mm = (new Date().getMonth() + 1).toString().padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const reportId = `ASH-LPR-${yy}${mm}-${rand}`;

    const newReport = {
      reportId,
      subscriptionId: subscriptionId || "-",
      ticketId: ticketId || "-",
      customerName: customerName || "Pelanggan Ashtatic",
      phone: phone || "-",
      category: category || "lainnya",
      categoryLabel: categoryLabel || "Kendala Jaringan",
      description: description || "Tidak ada rincian tambahan",
      urgency: urgency || "sedang",
      status: "menunggu", // menunggu | proses | selesai
      technician: "",
      adminNotes: "",
      customSSID: customSSID || "",
      customPassword: customPassword || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const reports = await readReports();
    reports.unshift(newReport);
    await saveReports(reports);

    return res.status(201).json({
      success: true,
      message: "Laporan gangguan berhasil dibuat dan diteruskan ke teknisi.",
      reportId,
      data: newReport
    });
  } catch (err) {
    console.error("API submit report error:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server saat memproses laporan." });
  }
});

// 2. Cari Laporan Berdasarkan ID Langganan / No Tiket / No Laporan (GET /api/reports/:query)
app.get("/api/reports/:query", async (req, res) => {
  try {
    const query = req.params.query.trim().toUpperCase();
    const reports = await readReports();

    const matches = reports.filter(r => {
      const repId = (r.reportId || "").toUpperCase();
      const subId = (r.subscriptionId || "").toUpperCase();
      const tId = (r.ticketId || "").toUpperCase();
      const ph = (r.phone || "").replace(/[^0-9]/g, "");
      const cleanQ = query.replace(/[^0-9]/g, "");

      return (
        repId === query ||
        subId === query ||
        tId === query ||
        (cleanQ.length >= 8 && ph.includes(cleanQ))
      );
    });

    return res.json({
      success: true,
      data: matches
    });
  } catch (err) {
    console.error("API get reports error:", err);
    return res.status(500).json({ success: false, message: "Gagal mengambil data laporan." });
  }
});

// 3. Admin: Ambil Semua Laporan Gangguan (GET /api/admin/reports)
app.get("/api/admin/reports", verifyAdmin, async (req, res) => {
  try {
    const reports = await readReports();
    return res.json({
      success: true,
      data: reports
    });
  } catch (err) {
    console.error("API admin get reports error:", err);
    return res.status(500).json({ success: false, message: "Gagal memuat laporan admin." });
  }
});

// 4. Admin: Update Status Laporan Gangguan (PUT /api/admin/reports/:reportId)
app.put("/api/admin/reports/:reportId", verifyAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, technician, adminNotes } = req.body;

    const reports = await readReports();
    const idx = reports.findIndex(r => r.reportId === reportId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan." });
    }

    if (status) reports[idx].status = status;
    if (technician !== undefined) reports[idx].technician = technician;
    if (adminNotes !== undefined) reports[idx].adminNotes = adminNotes;
    reports[idx].updatedAt = new Date().toISOString();

    await saveReports(reports);

    return res.json({
      success: true,
      message: "Status laporan berhasil diperbarui.",
      data: reports[idx]
    });
  } catch (err) {
    console.error("API update report error:", err);
    return res.status(500).json({ success: false, message: "Gagal memperbarui status laporan." });
  }
});

// 5. Admin: Hapus Laporan Gangguan (DELETE /api/admin/reports/:reportId)
app.delete("/api/admin/reports/:reportId", verifyAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    let reports = await readReports();
    const initialLen = reports.length;
    reports = reports.filter(r => r.reportId !== reportId);

    if (reports.length === initialLen) {
      return res.status(404).json({ success: false, message: "Laporan tidak ditemukan." });
    }

    await saveReports(reports);
    return res.json({ success: true, message: "Laporan gangguan berhasil dihapus." });
  } catch (err) {
    console.error("API delete report error:", err);
    return res.status(500).json({ success: false, message: "Gagal menghapus laporan." });
  }
});

// Clean Page Routes
app.get("/tracking", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tracking.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get(["/wifi", "/wifi-manager"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "wifi.html"));
});

app.get(["/lapor", "/lapor-jaringan"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lapor.html"));
});

// Catch-all route to index.html for SPA-friendly behavior
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Ashtatic Internet Solution Web Server Aktif!`);
  console.log(`📡 URL Utama     : http://localhost:${PORT}`);
  console.log(`🔍 Lacak Status  : http://localhost:${PORT}/tracking`);
  console.log(`🔒 Panel Admin   : http://localhost:${PORT}/admin (PIN: ${ADMIN_PIN})`);
  console.log(`⚡ Slogan        : Koneksi Cepat, Aktivitas Tanpa Batas!`);
  console.log(`=======================================================`);
});
