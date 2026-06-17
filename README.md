# ✉️ KlikSurat Desktop - SDN Mojogemi 02

Aplikasi manajemen dan administrasi persuratan digital canggih yang dirancang khusus untuk SDN Mojogemi 02. Dibangun menggunakan **Electron.js** untuk kecepatan dan performa *desktop*, dipadukan dengan **SQLite** untuk kelancaran penggunaan secara *offline*, dan dihubungkan ke **Google Apps Script** untuk sinkronisasi data ke *cloud*.

![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)
![Electron](https://img.shields.io/badge/Electron-Desktop-12101E?logo=electron)
![License](https://img.shields.io/badge/License-ISC-green.svg)

---

## ✨ Fitur Utama

*   **⚡ Mode Offline & Online:** Dapat diakses secara lancar tanpa internet, namun otomatis mencadangkan (*sync*) data persuratan ke *Cloud* saat internet tersedia.
*   **📑 Cetak Dokumen Presisi (Print Preview):** Sistem cetak *fullscreen* dengan format khusus (tanpa menggunakan format bawaan sistem operasi) menjamin ukuran margin, kop, stempel, dan tanda tangan 100% konsisten.
*   **⚙️ Konfigurasi Surat Dinamis:** Format penomoran otomatis hingga teks kop (Kode Dinas, Provinsi, NPSN, dsb) sepenuhnya dikendalikan via antarmuka pengaturan *(UI Settings)*.
*   **🎨 Mode Malam (Dark Mode):** Desain modern dan ramah mata dengan dukungan peralihan tema gelap dan terang.
*   **🔄 Pembaruan Otomatis (Auto-Updater):** Mengunduh dan memasang versi aplikasi terbaru di latar belakang (didukung oleh *GitHub Releases*).

## 🚀 Panduan Pengembangan (*Development*)

Jika Anda ingin memodifikasi atau mengembangkan aplikasi ini lebih lanjut, ikuti panduan berikut:

### Prasyarat
Pastikan komputer Anda sudah terinstal [Node.js](https://nodejs.org/) (versi LTS direkomendasikan).

### Instalasi Dependensi
Jalankan perintah ini di dalam folder proyek untuk mengunduh semua library yang diperlukan:
```bash
npm install
```

### Menjalankan Aplikasi (Mode Uji Coba)
Untuk menguji coba aplikasi tanpa harus membuat file `.exe`, jalankan:
```bash
npm start
```

## 📦 Panduan Build & Rilis (*Auto-Update*)

Proses pembuatan file instalasi (.exe) menggunakan `electron-builder` telah diatur dengan level kompresi maksimum agar menghemat penyimpanan.

**Langkah Membangun File .exe Manual:**
```bash
npm run build
```
File `.exe` akan secara otomatis muncul di dalam folder `dist/`.

### Mekanisme Rilis dan Pembaruan Otomatis (Auto-Update)

Aplikasi ini dilengkapi dengan fitur *Auto-Updater* yang memantau repositori GitHub `fahmy009/klikSuratElectron`. Jika Anda ingin menyebarkan pembaruan kepada semua guru/staf secara serentak tanpa perlu membagikan file `.exe` dari grup ke grup, lakukan langkah ini:

1. Ubah nomor `"version"` di dalam file `package.json` (Misal: dari `"4.0.0"` menjadi `"4.0.1"`).
2. Pastikan Anda memiliki *Personal Access Token* GitHub yang tersimpan di environment komputer Anda (`GH_TOKEN`).
3. Jalankan perintah pelepasan *(publish)*:
   ```bash
   GH_TOKEN="token_github_anda" npm run publish
   ```
4. `electron-builder` akan otomatis mengkompilasi file `.exe` lalu **mengunggahnya ke halaman Releases di GitHub** secara mandiri!
5. Guru-guru yang menyalakan aplikasi versi `4.0.0` akan mendapati notifikasi bahwa versi `4.0.1` sudah siap, mengunduhnya di latar belakang, dan meminta mereka untuk *Restart*.

---
**Developer:** Muhammad Fahmy  
**Sistem:** Electron / Node.js / SQLite
