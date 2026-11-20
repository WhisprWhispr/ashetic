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

// Clean Page Routes
app.get("/tracking", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tracking.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
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
