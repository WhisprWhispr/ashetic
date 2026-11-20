# 🚀 Ashtatic Internet Solution — Website Resmi

Website resmi **Ashtatic Internet Solution** berbasis Node.js & Express dengan integrasi **Firebase Firestore**, pelacakan status pendaftaran (*Tracking Status*), dan **Panel Admin**. Desain tampilan disesuaikan 100% dengan poster dan logo resmi: tema futuristik neon cyber blue/cyan, router Wifi AirPro tanpa kabel, serta pilihan paket lengkap.

---

## 🎨 Spesifikasi Tampilan & Paket Internet Sesuai Poster

- **Warna Identitas**: Electric Cyan (`#00f0ff`), Deep Cyber Navy (`#040816`), Neon Blue (`#0072ff`), Purple Glow (`#7928ca`), dan Promo Gold (`#facc15`).
- **Slogan**: *"Koneksi Cepat, Aktivitas Tanpa Batas!"*
- **Tagline**: *"Internet Cepat & Stabil - Untuk Aktivitas Online Tanpa Hambatan!"*
- **Teknologi**: **WiFi AirPro Tanpa Kabel!** — Praktis, fleksibel, tanpa ribet tarik kabel tiang optik.
- **Promo Unggulan**: **Bulan Pertama GRATIS! + Gratis Biaya Instalasi Pemasangan!**
- **Daftar Pilihan Paket Internet**:
  1. **Paket 100 Mbps**: **Rp 105.000 / Bulan** (Border Neon Cyan, Speedometer)
  2. **Paket 150 Mbps**: **Rp 180.000 / Bulan** (Border Neon Purple, Paling Favorit Keluarga)
  3. **Paket 200 Mbps**: **Rp 205.000 / Bulan** (Border Neon Blue, Ultra High Speed Bisnis & Gaming)
- **Kontak Sales WhatsApp**: **+62 831-6288-4330** (Dilengkapi floating button & tombol interaktif dengan pesan otomatis).

---

## ✨ Fitur-Fitur Utama

1. **Formulir Pendaftaran Pasang Baru (Modal Popup & Direct Action)**:
   - Input: Nama Lengkap, Nomor Telepon/WhatsApp, Email, Paket yang dipilih, Alamat Lengkap, Koordinat GPS otomatis via Geolocation, Tipe Bangunan, Jadwal Pemasangan, dan Catatan.
   - Otomatis menghasilkan **Nomor Tiket Registrasi Unik** (contoh: `ASH-2611-XXXX`).
   - Tersimpan langsung ke **Firebase Firestore** (Koleksi: `registrations`) dan sinkron ke database server Node.js.
   - Tombol langsung untuk konfirmasi ke WhatsApp Sales resmi (+62 831-6288-4330).

2. **Lacak Status Pendaftaran (Tracking System)**:
   - URL: `/tracking` atau `/tracking.html`
   - Pelanggan cukup mengetik Nomor Tiket atau Nomor WhatsApp mereka.
   - Menampilkan visual progress tahapan real-time:
     1. *Pendaftaran Diterima (Tiket Aktif)*
     2. *Verifikasi & Survey Sinyal Wifi AirPro*
     3. *Penjadwalan Kunjungan Teknisi*
     4. *Proses Instalasi Perangkat Modem AirPro*
     5. *Internet Aktif & Online*
   - Menampilkan informasi petugas teknisi dan catatan khusus.
   - Tombol tanya progress langsung via WhatsApp ke CS.

3. **Panel Admin Pengelola (Admin Dashboard)**:
   - URL: `/admin` atau `/admin.html`
   - Terproteksi PIN/Kata Sandi (Default: `ashtatic2026`).
   - Kartu Metrik KPI: Total Pendaftar, Antrian Verifikasi Baru, Dalam Proses, Selesai Terpasang, Estimasi Omzet Bulanan.
   - Filter Status Tab (Semua, Verifikasi Baru, Survey Sinyal, Jadwal Teknisi, Sedang Pasang, Selesai, Dibatalkan).
   - Pencarian Instan (Live search by ticket, nama, alamat, no hp).
   - Fitur Aksi:
     - **Detail Lengkap**: Melihat seluruh data pelanggan & koordinat lokasi.
     - **Ubah Status**: Memperbarui status, menugaskan teknisi, dan menulis catatan.
     - **Chat WhatsApp 1-Klik**: Menghubungi pelanggan dengan pesan otomatis berisi nomor tiket dan status terbaru.
     - **Tambah Manual**: Mendaftarkan pelanggan offline / via telepon.
     - **Export CSV**: Mengunduh rekap pendaftar ke file Excel/CSV.
     - **Hapus Data**: Menghapus tiket pendaftaran.

4. **Logo & Favicon Web**:
   - Vektor SVG resmi Ashtatic (`public/images/logo.svg`, `public/images/logo-icon.svg`).
   - Favicon browser (`public/favicon.svg`).
   - Poster resmi dalam format modal lightbox (`public/images/poster.jpg`).

---

## 🔒 Konfigurasi Firebase Firestore & Security Rules

### Konfigurasi Firebase SDK (Modular v10)
Telah terpasang pada `public/js/firebase-config.js` dengan konfigurasi proyek Anda:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC01LisaEqLel1EN1Z39ECTvayuDUObO70",
  authDomain: "ashetic-93d32.firebaseapp.com",
  projectId: "ashetic-93d32",
  storageBucket: "ashetic-93d32.firebasestorage.app",
  messagingSenderId: "844269135935",
  appId: "1:844269135935:web:5e531b3d07aaf094ce308a",
  measurementId: "G-9VZM6F81SQ"
};
```

### Aturan Keamanan Firestore (`firestore.rules`)
Buka **Firebase Console** -> **Firestore Database** -> Tab **Rules**, lalu tempel aturan berikut:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /registrations/{docId} {
      // 1. Publik diizinkan mendaftar baru dengan field wajib
      allow create: if request.resource.data.keys().hasAll([
                        'ticketId', 'fullName', 'phone', 'email', 'packageId', 
                        'address', 'status', 'createdAt'
                      ])
                      && request.resource.data.fullName is string 
                      && request.resource.data.fullName.size() >= 3
                      && request.resource.data.phone is string 
                      && request.resource.data.phone.size() >= 9;

      // 2. Publik diizinkan membaca 1 tiket untuk melacak status
      allow get: if true;

      // 3. Hanya Admin / Server yang diizinkan mengambil seluruh list pendaftar
      allow list: if true; // Bisa disetel ke request.auth != null jika memakai Firebase Auth

      // 4. Update & Delete diizinkan untuk operasional Admin
      allow update, delete: if true; // Bisa disetel ke request.auth != null
    }
  }
}
```

---

## 💻 Cara Menjalankan Website

1. Pastikan dependensi sudah terpasang:
   ```bash
   npm install
   ```

2. Jalankan server Node.js:
   ```bash
   npm start
   ```

3. Buka di browser:
   - **Halaman Utama**: [http://localhost:3000](http://localhost:3000)
   - **Lacak Status**: [http://localhost:3000/tracking](http://localhost:3000/tracking)
   - **Panel Admin**: [http://localhost:3000/admin](http://localhost:3000/admin) (PIN: `ashtatic2026`)
