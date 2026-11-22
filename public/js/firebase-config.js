// Ashtatic Internet Solution - Firebase Modular SDK Configuration & Firestore Helper
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Konfigurasi Firebase Resmi Ashtatic
export const firebaseConfig = {
  apiKey: "AIzaSyC01LisaEqLel1EN1Z39ECTvayuDUObO70",
  authDomain: "ashetic-93d32.firebaseapp.com",
  projectId: "ashetic-93d32",
  storageBucket: "ashetic-93d32.firebasestorage.app",
  messagingSenderId: "844269135935",
  appId: "1:844269135935:web:5e531b3d07aaf094ce308a",
  measurementId: "G-9VZM6F81SQ"
};

// Inisialisasi Firebase App
let app;
let db;
let analytics = null;
let isFirestoreAvailable = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirestoreAvailable = true;
  console.log("✅ Firebase initialized successfully for Ashtatic!");

  // Inisialisasi Analytics jika didukung di browser
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("📊 Firebase Analytics initialized:", firebaseConfig.measurementId);
    }
  }).catch(e => {
    console.log("Analytics note:", e.message);
  });
} catch (err) {
  console.warn("⚠️ Firebase init warning, fallback mode active:", err);
  isFirestoreAvailable = false;
}

export { app, db, analytics, isFirestoreAvailable };

/**
 * Menyimpan data pendaftaran baru ke Firestore (dengan sinkronisasi ke server Node.js)
 */
export async function submitRegistration(registrationData) {
  const result = {
    success: false,
    ticketId: registrationData.ticketId,
    firestore: false,
    server: false,
    message: ""
  };

  // 1. Coba simpan ke Firebase Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "registrations", registrationData.ticketId);
      await setDoc(docRef, {
        ...registrationData,
        createdAtFirestore: serverTimestamp()
      });
      result.firestore = true;
      console.log("✅ Data pendaftaran berhasil disimpan di Firebase Firestore:", registrationData.ticketId);
    } catch (fsError) {
      console.warn("⚠️ Gagal simpan ke Firestore (mungkin rules/database belum dibuat di Firebase Console):", fsError.message);
    }
  }

  // 2. Selalu simpan juga ke Server Backend Node.js sebagai backup / database sinkron
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registrationData)
    });
    const serverRes = await response.json();
    if (serverRes.success) {
      result.server = true;
      console.log("✅ Data pendaftaran berhasil disinkronkan ke Node.js Server:", serverRes.data.ticketId);
    }
  } catch (srvError) {
    console.warn("⚠️ Gagal sinkron ke server Node.js:", srvError.message);
  }

  if (result.firestore || result.server) {
    result.success = true;
    result.message = "Pendaftaran berhasil dikirim!";
  } else {
    result.message = "Gagal menyimpan data pendaftaran.";
  }

  return result;
}

/**
 * Melacak status pendaftaran berdasarkan Ticket ID atau Nomor WhatsApp
 */
export async function trackRegistration(searchQuery) {
  searchQuery = searchQuery.trim().toUpperCase();
  
  // 1. Coba lacak dari Firebase Firestore
  if (isFirestoreAvailable && db) {
    try {
      // Cari by Document ID (Ticket ID)
      const docRef = doc(db, "registrations", searchQuery);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log("✅ Data ditemukan di Firestore by Doc ID:", searchQuery);
        return { success: true, data: docSnap.data(), source: "firestore" };
      }

      // Jika bukan Doc ID, coba query by phone atau email
      const regCol = collection(db, "registrations");
      const qPhone = query(regCol, where("phone", "==", searchQuery));
      const qSnap = await getDocs(qPhone);
      if (!qSnap.empty) {
        return { success: true, data: qSnap.docs[0].data(), source: "firestore" };
      }
    } catch (fsError) {
      console.warn("⚠️ Firestore query error, falling back to server API:", fsError.message);
    }
  }

  // 2. Fallback / Sync ke Server Node.js API
  try {
    const res = await fetch(`/api/track/${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    if (data.success && data.registration) {
      return { success: true, data: data.registration, source: "server" };
    }
  } catch (err) {
    console.warn("⚠️ Server tracking error:", err);
  }

  return { success: false, message: "Data pendaftaran tidak ditemukan. Pastikan Nomor Tiket sudah sesuai." };
}

/**
 * Mengambil seluruh data pendaftaran untuk Panel Admin
 * UTAMA: Mengambil data real langsung dari Cloud Firestore!
 */
export async function getAdminRegistrations(adminToken = "") {
  let list = [];

  // 1. PRIORITAS UTAMA: Ambil langsung dari Firebase Firestore
  if (isFirestoreAvailable && db) {
    try {
      const colRef = collection(db, "registrations");
      let snapshot;
      try {
        const q = query(colRef, orderBy("createdAt", "desc"));
        snapshot = await getDocs(q);
      } catch (qErr) {
        // Fallback jika index belum dibuat
        snapshot = await getDocs(colRef);
      }

      snapshot.forEach(docSnap => {
        list.push(docSnap.data());
      });

      console.log(`✅ Dimuat ${list.length} data pendaftaran langsung dari Firebase Firestore.`);
      return list;
    } catch (fsErr) {
      console.warn("⚠️ Firestore admin fetch error:", fsErr);
    }
  }

  // 2. Fallback cadangan dari Server Node.js (jika Firestore offline)
  try {
    const res = await fetch("/api/admin/registrations", {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const resData = await res.json();
    if (resData.success && Array.isArray(resData.registrations)) {
      list = resData.registrations;
    }
  } catch (err) {
    console.warn("⚠️ Server admin fetch failed:", err);
  }

  return list;
}

/**
 * Update Status Pendaftaran oleh Admin
 */
export async function updateRegistrationStatus(ticketId, newStatus, technician = "", notes = "", adminToken = "") {
  let updated = false;

  // 1. Update ke Server Backend
  try {
    const res = await fetch(`/api/admin/update-status/${ticketId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: newStatus, technician, notes })
    });
    const data = await res.json();
    if (data.success) {
      updated = true;
    }
  } catch (err) {
    console.warn("⚠️ Gagal update status di server:", err);
  }

  // 2. Update di Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "registrations", ticketId);
      await updateDoc(docRef, {
        status: newStatus,
        technician: technician || "",
        notes: notes || "",
        updatedAt: new Date().toISOString()
      });
      updated = true;
    } catch (fsErr) {
      console.warn("⚠️ Gagal update status di Firestore:", fsErr);
    }
  }

  return updated;
}

/**
 * HAPUS DATA REGISTRASI SECARA PERMANEN
 * Menghapus dokumen dari Cloud Firestore dan menghapus data dari Server Backend Node.js
 */
export async function deleteRegistrationPermanently(ticketId, adminToken = "") {
  let deletedServer = false;
  let deletedFirestore = false;

  // 1. Hapus permanen dari Server Node.js (data/registrations.json)
  try {
    const res = await fetch(`/api/admin/delete/${ticketId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
      deletedServer = true;
      console.log(`[PERMANENT DELETE] Tiket ${ticketId} terhapus permanen dari server.`);
    }
  } catch (err) {
    console.error("Gagal hapus dari server:", err);
  }

  // 2. Hapus permanen dari Cloud Firestore Database
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "registrations", ticketId);
      await deleteDoc(docRef);
      deletedFirestore = true;
      console.log(`[PERMANENT DELETE] Dokumen ${ticketId} terhapus permanen dari Firebase Firestore.`);
    } catch (fsErr) {
      console.warn("⚠️ Gagal hapus dari Firestore (mungkin rules/koleksi belum aktif):", fsErr.message);
    }
  }

  return { success: deletedServer || deletedFirestore, deletedServer, deletedFirestore };
}

/**
 * SIMPAN PENGATURAN NAMA WIFI (SSID) & PASSWORD OLEH USER
 * Menyimpan ke Firebase Firestore & Sinkronisasi ke Server Node.js
 */
export async function saveWifiConfiguration(ticketId, wifiSSID, wifiPassword) {
  let savedFirestore = false;
  let savedServer = false;

  // 1. Simpan ke Firebase Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "registrations", ticketId);
      await updateDoc(docRef, {
        wifiSSID: wifiSSID.trim(),
        wifiPassword: wifiPassword,
        wifiConfiguredAt: new Date().toISOString()
      });
      savedFirestore = true;
      console.log(`✅ SSID & Password WiFi tersimpan di Firestore untuk tiket: ${ticketId}`);
    } catch (fsErr) {
      console.warn("⚠️ Gagal simpan WiFi ke Firestore:", fsErr.message);
    }
  }

  // 2. Simpan ke Server Backend Node.js
  try {
    const res = await fetch(`/api/tracking/wifi-config/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wifiSSID, wifiPassword })
    });
    const resData = await res.json();
    if (resData.success) {
      savedServer = true;
      console.log(`✅ SSID & Password WiFi tersinkron ke Server: ${ticketId}`);
    }
  } catch (err) {
    console.warn("⚠️ Gagal sinkron WiFi ke server:", err);
  }

  return {
    success: savedFirestore || savedServer,
    savedFirestore,
    savedServer
  };
}

/**
 * AMBIL PENGGUNA & PERANGKAT WIFI BERDASARKAN ID LANGGANAN / NOMOR TIKET
 */
export async function getWifiDevicesBySubscription(queryId) {
  const clean = (queryId || "").trim().toUpperCase();
  if (!clean) return { success: false, message: "ID Langganan tidak boleh kosong." };

  // 1. Cek langsung ke Firebase Firestore
  if (isFirestoreAvailable && db) {
    try {
      // Coba jika query adalah Ticket ID (Doc ID)
      const docRef = doc(db, "registrations", clean);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const item = snap.data();
        if (!item.subscriptionId) item.subscriptionId = `ASH-SUB-${item.ticketId.replace(/[^0-9]/g, '')}`;
        return { success: true, registration: item, source: "firestore" };
      }

      // Coba query berdasarkan field subscriptionId
      const regCol = collection(db, "registrations");
      const qSub = query(regCol, where("subscriptionId", "==", clean));
      const qSnap = await getDocs(qSub);
      if (!qSnap.empty) {
        return { success: true, registration: qSnap.docs[0].data(), source: "firestore" };
      }

      // Coba scan collection jika formatnya variasi (misal tiket tanpa prefix atau subId)
      const allDocs = await getDocs(regCol);
      for (const d of allDocs.docs) {
        const data = d.data();
        const tId = (data.ticketId || "").toUpperCase();
        const sId = (data.subscriptionId || `ASH-SUB-${tId.replace(/[^0-9]/g, '')}`).toUpperCase();
        if (tId === clean || sId === clean || (clean.length >= 4 && (sId.includes(clean) || tId.includes(clean)))) {
          if (!data.subscriptionId) data.subscriptionId = sId;
          return { success: true, registration: data, source: "firestore" };
        }
      }
    } catch (fsErr) {
      console.warn("⚠️ Firestore WiFi fetch error, fallback to API:", fsErr.message);
    }
  }

  // 2. Fallback ke API Server Node.js
  try {
    const res = await fetch(`/api/wifi/devices/${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (data.success && data.registration) {
      return { success: true, registration: data.registration, source: "server" };
    }
    return { success: false, message: data.message || "Data tidak ditemukan." };
  } catch (err) {
    console.warn("⚠️ Server WiFi fetch error:", err);
  }

  return { success: false, message: "ID Langganan atau Nomor Tiket tidak ditemukan." };
}

/**
 * SIMPAN DAFTAR PENGGUNA WIFI OLEH ADMIN
 */
export async function saveWifiDevices(ticketId, wifiDevices, adminToken = "") {
  let savedFirestore = false;
  let savedServer = false;

  // 1. Simpan ke Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "registrations", ticketId);
      await updateDoc(docRef, {
        wifiDevices: wifiDevices,
        updatedAt: new Date().toISOString()
      });
      savedFirestore = true;
      console.log(`✅ ${wifiDevices.length} Perangkat WiFi berhasil disimpan di Firestore: ${ticketId}`);
    } catch (fsErr) {
      console.warn("⚠️ Gagal simpan wifiDevices ke Firestore:", fsErr.message);
    }
  }

  // 2. Simpan ke Server Node.js
  try {
    const res = await fetch(`/api/admin/wifi-devices/${encodeURIComponent(ticketId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ wifiDevices })
    });
    const data = await res.json();
    if (data.success) {
      savedServer = true;
      console.log(`✅ ${wifiDevices.length} Perangkat WiFi berhasil disinkronkan ke server: ${ticketId}`);
    }
  } catch (err) {
    console.warn("⚠️ Gagal sinkron wifiDevices ke server:", err);
  }

  return {
    success: savedFirestore || savedServer,
    savedFirestore,
    savedServer
  };
}

/**
 * GANTI NAMA WIFI & SANDI OLEH PELANGGAN
 */
export async function updateWifiCredentials(queryId, wifiSSID, wifiPassword) {
  let savedFirestore = false;
  let savedServer = false;

  // 1. Simpan ke Server
  try {
    const res = await fetch("/api/wifi/update-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryId, wifiSSID, wifiPassword })
    });
    const data = await res.json();
    if (data.success) {
      savedServer = true;
    }
  } catch (err) {
    console.warn("⚠️ Gagal update wifi credentials ke server:", err);
  }

  // 2. Simpan ke Firestore jika ada ticketId
  if (isFirestoreAvailable && db) {
    try {
      // Cari dokumen yang cocok
      const clean = (queryId || "").toUpperCase();
      let targetTicket = clean;
      
      const docRef = doc(db, "registrations", targetTicket);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          wifiSSID: wifiSSID.trim(),
          wifiPassword: wifiPassword,
          wifiConfiguredAt: new Date().toISOString()
        });
        savedFirestore = true;
      } else {
        // Query by subscriptionId
        const regCol = collection(db, "registrations");
        const qSub = query(regCol, where("subscriptionId", "==", clean));
        const qSnap = await getDocs(qSub);
        if (!qSnap.empty) {
          await updateDoc(doc(db, "registrations", qSnap.docs[0].id), {
            wifiSSID: wifiSSID.trim(),
            wifiPassword: wifiPassword,
            wifiConfiguredAt: new Date().toISOString()
          });
          savedFirestore = true;
        }
      }
    } catch (fsErr) {
      console.warn("⚠️ Gagal simpan WiFi credentials ke Firestore:", fsErr.message);
    }
  }

  return { success: savedFirestore || savedServer };
}

// ========================================================
// FITUR LAPOR GANGGUAN JARINGAN (CUSTOMER SUPPORT TICKETING)
// ========================================================

/**
 * KIRIM LAPORAN KENDALA JARINGAN OLEH PELANGGAN
 */
export async function submitNetworkReport(reportData) {
  const yy = new Date().getFullYear().toString().slice(-2);
  const mm = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  const reportId = reportData.reportId || `ASH-LPR-${yy}${mm}-${rand}`;

  const payload = {
    reportId,
    subscriptionId: reportData.subscriptionId || "-",
    ticketId: reportData.ticketId || "-",
    customerName: reportData.customerName || "Pelanggan Ashtatic",
    phone: reportData.phone || "-",
    category: reportData.category || "lainnya",
    categoryLabel: reportData.categoryLabel || "Kendala Jaringan",
    description: reportData.description || "Tidak ada deskripsi tambahan",
    urgency: reportData.urgency || "sedang",
    status: "menunggu", // menunggu | proses | selesai
    technician: "",
    adminNotes: "",
    customSSID: reportData.customSSID || "",
    customPassword: reportData.customPassword || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let savedFirestore = false;
  let savedServer = false;

  // 1. Simpan ke Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "network_reports", reportId);
      await setDoc(docRef, payload);
      savedFirestore = true;
      console.log(`✅ Laporan kendala tersimpan di Firestore: ${reportId}`);
    } catch (fsErr) {
      console.warn("⚠️ Gagal simpan laporan ke Firestore:", fsErr.message);
    }
  }

  // 2. Simpan ke Server Backend
  try {
    const res = await fetch("/api/reports/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      savedServer = true;
      console.log(`✅ Laporan kendala tersinkron ke Server: ${reportId}`);
    }
  } catch (err) {
    console.warn("⚠️ Gagal sinkron laporan ke server:", err);
  }

  return {
    success: savedFirestore || savedServer,
    reportId,
    data: payload
  };
}

/**
 * AMBIL RIWAYAT LAPORAN BERDASARKAN ID LANGGANAN / NOMOR TIKET / NO LAPORAN
 */
export async function getReportsBySubscription(queryStr) {
  const clean = (queryStr || "").trim().toUpperCase();
  if (!clean) return { success: true, data: [] };

  const results = [];
  const seenIds = new Set();

  // 1. Ambil dari Firestore
  if (isFirestoreAvailable && db) {
    try {
      // Coba jika query adalah Report ID
      const directRef = doc(db, "network_reports", clean);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        const item = directSnap.data();
        results.push(item);
        seenIds.add(item.reportId);
      }

      // Query berdasarkan subscriptionId
      const repCol = collection(db, "network_reports");
      const qSub = query(repCol, where("subscriptionId", "==", clean));
      const qSubSnap = await getDocs(qSub);
      qSubSnap.forEach(d => {
        const item = d.data();
        if (!seenIds.has(item.reportId)) {
          results.push(item);
          seenIds.add(item.reportId);
        }
      });

      // Query berdasarkan ticketId
      const qTick = query(repCol, where("ticketId", "==", clean));
      const qTickSnap = await getDocs(qTick);
      qTickSnap.forEach(d => {
        const item = d.data();
        if (!seenIds.has(item.reportId)) {
          results.push(item);
          seenIds.add(item.reportId);
        }
      });

      // Jika belum ada hasil, scan semua koleksi (untuk pencocokan partial atau phone)
      if (results.length === 0) {
        const allSnap = await getDocs(repCol);
        allSnap.forEach(d => {
          const item = d.data();
          const repId = (item.reportId || "").toUpperCase();
          const subId = (item.subscriptionId || "").toUpperCase();
          const tId = (item.ticketId || "").toUpperCase();
          const ph = (item.phone || "").replace(/[^0-9]/g, "");
          const cleanQ = clean.replace(/[^0-9]/g, "");

          if (
            repId.includes(clean) ||
            subId.includes(clean) ||
            tId.includes(clean) ||
            (cleanQ.length >= 8 && ph.includes(cleanQ))
          ) {
            if (!seenIds.has(item.reportId)) {
              results.push(item);
              seenIds.add(item.reportId);
            }
          }
        });
      }
    } catch (fsErr) {
      console.warn("⚠️ Gagal mengambil laporan dari Firestore:", fsErr.message);
    }
  }

  // 2. Fallback / Tambahan dari Server API
  try {
    const res = await fetch(`/api/reports/${encodeURIComponent(clean)}`);
    const sData = await res.json();
    if (sData.success && Array.isArray(sData.data)) {
      sData.data.forEach(item => {
        if (!seenIds.has(item.reportId)) {
          results.push(item);
          seenIds.add(item.reportId);
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Gagal ambil laporan dari server:", err);
  }

  // Urutkan laporan dari yang paling baru
  results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return {
    success: true,
    data: results
  };
}

/**
 * ADMIN: AMBIL SEMUA LAPORAN GANGGUAN
 */
export async function getAdminNetworkReports(adminToken = "") {
  const reports = [];
  const seenIds = new Set();

  // 1. Coba Firestore
  if (isFirestoreAvailable && db) {
    try {
      const repCol = collection(db, "network_reports");
      const snap = await getDocs(repCol);
      snap.forEach(d => {
        const item = d.data();
        reports.push(item);
        seenIds.add(item.reportId);
      });
      console.log(`✅ Loaded ${reports.length} laporan dari Firestore.`);
    } catch (fsErr) {
      console.warn("⚠️ Gagal ambil laporan admin dari Firestore:", fsErr.message);
    }
  }

  // 2. Ambil dari API Server
  try {
    const res = await fetch("/api/admin/reports", {
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const sData = await res.json();
    if (sData.success && Array.isArray(sData.data)) {
      sData.data.forEach(item => {
        if (!seenIds.has(item.reportId)) {
          reports.push(item);
          seenIds.add(item.reportId);
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Gagal ambil laporan admin dari server:", err);
  }

  // Urutkan dari yang terbaru
  reports.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return { success: true, data: reports };
}

/**
 * ADMIN: UPDATE STATUS LAPORAN (Menunggu -> Proses -> Selesai)
 */
export async function updateReportStatus(reportId, status, technician = "", adminNotes = "", adminToken = "") {
  let updatedFirestore = false;
  let updatedServer = false;

  const updatePayload = {
    status,
    technician,
    adminNotes,
    updatedAt: new Date().toISOString()
  };

  // 1. Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "network_reports", reportId);
      await updateDoc(docRef, updatePayload);
      updatedFirestore = true;
    } catch (fsErr) {
      console.warn("⚠️ Gagal update status laporan di Firestore:", fsErr.message);
    }
  }

  // 2. Server API
  try {
    const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify(updatePayload)
    });
    const sData = await res.json();
    if (sData.success) updatedServer = true;
  } catch (err) {
    console.warn("⚠️ Gagal update status laporan di server:", err);
  }

  return { success: updatedFirestore || updatedServer };
}

/**
 * ADMIN: HAPUS LAPORAN PERMANEN
 */
export async function deleteReportPermanently(reportId, adminToken = "") {
  let deletedFirestore = false;
  let deletedServer = false;

  // 1. Firestore
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "network_reports", reportId);
      await deleteDoc(docRef);
      deletedFirestore = true;
    } catch (fsErr) {
      console.warn("⚠️ Gagal hapus laporan di Firestore:", fsErr.message);
    }
  }

  // 2. Server
  try {
    const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${adminToken}` }
    });
    const sData = await res.json();
    if (sData.success) deletedServer = true;
  } catch (err) {
    console.warn("⚠️ Gagal hapus laporan di server:", err);
  }

  return { success: deletedFirestore || deletedServer };
}
