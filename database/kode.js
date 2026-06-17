/**
 * ====================================================================
 * SYSTEM ENGINE BACKEND - APLIKASI SURAT SDN MOJOGEMI 02 v4.9
 * (Integrated: Single-Save Engine, Auto-Numbering, Archives & Templates)
 * ====================================================================
 */

// --- KONFIGURASI GLOBAL ---
// Gunakan Project Settings > Script Properties untuk mengisi nilai-nilai ini di production
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || "ID_SPREADSHEET_ANDA";
const FOLDER_LOGO_ID = PropertiesService.getScriptProperties().getProperty('FOLDER_LOGO_ID') || "ID_FOLDER_DRIVE_ANDA";
const FOLDER_MASUK_ID = PropertiesService.getScriptProperties().getProperty('FOLDER_MASUK_ID') || "ID_FOLDER_SURAT_MASUK_ANDA";
const NPSN_SEKOLAH = PropertiesService.getScriptProperties().getProperty('NPSN_SEKOLAH') || "00000000";

// Nama-nama Sheet
const SHEET_PENGATURAN = "Pengaturan";
const SHEET_USERS = "Database_Users";
const SHEET_LOG = "Log_Surat";
const SHEET_TEMPLATES = "Database_Templates";
const SHEET_KLASIFIKASI = "Kode_Klasifikasi";
const SHEET_SISWA = "Database_Siswa";
const SHEET_GURU = "Database_Guru";
const SHEET_LOG_MASUK = "Log_Surat_Masuk";

/**
 * Fungsi Utama untuk menjalankan Web App
 */
function doGet(e) {
    const template = HtmlService.createTemplateFromFile('index');

    // Kirim parameter URL ke dalam file HTML agar bisa dibaca JavaScript frontend
    template.urlParams = e.parameter;
    // Pastikan URL bersih dari /dev jika sedang dalam mode pengembangan
    let serviceUrl = ScriptApp.getService().getUrl();
    if (!serviceUrl) serviceUrl = "";
    template.scriptUrl = serviceUrl.replace(/\/dev$/, "/exec");

    // Ambil pengaturan global agar tersedia di halaman publik
    try {
        const config = ambilPengaturan() || {};
        template.appLogo = config ? (config.Logo_Kanan_Url || config.Logo_Kiri_Url) : "";
        template.appName = config ? (config.App_Name || "KlikSurat SDN Mojogemi 02") : "KlikSurat SDN Mojogemi 02";
    } catch (err) {
        template.appLogo = "";
        template.appName = "KlikSurat";
    }

    return template.evaluate()
        .setTitle(template.appName)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .setFaviconUrl('https://i.postimg.cc/FK7R0fTb/logo-jember3.png');
}

/**
 * API Endpoint: Menerima HTTP POST request dari Aplikasi Electron (Desktop)
 */
function doPost(e) {
    try {
        // Pastikan database dan dummy data terinisialisasi
        inisialisasiDatabase();

        // Pastikan ada payload yang dikirimkan
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("Payload kosong atau request tidak valid.");
        }

        // Parse data JSON dari Electron
        const request = JSON.parse(e.postData.contents);
        const action = request.action;
        const payload = request.payload;

        let responseData = null;

        // ROUTER: Arahkan ke fungsi GAS yang sesuai berdasarkan 'action'
        switch (action) {
            case "ambilSemuaUser":
                responseData = { status: "SUCCESS", data: ambilSemuaUser() };
                break;
            case "ambilSemuaSiswa":
                responseData = { status: "SUCCESS", data: ambilSemuaSiswa() };
                break;
            case "simpanSiswaBaru":
                responseData = simpanSiswaBaru(payload);
                break;
            case "hapusSiswa":
                responseData = hapusSiswa(payload); // payload berisi string NISN
                break;
            case "ambilSemuaGuru":
                responseData = { status: "SUCCESS", data: ambilSemuaGuru() };
                break;
            case "simpanGuruBaru":
                responseData = simpanGuruBaru(payload);
                break;
            case "hapusGuru":
                responseData = hapusGuru(payload); // payload berisi string NIP
                break;
            case "simpanPaketSuratLengkap":
                responseData = simpanPaketSuratLengkap(payload);
                break;
            case "dapatkanRiwayatArsip":
                responseData = { status: "SUCCESS", data: dapatkanRiwayatArsip() };
                break;
            case "ambilPengaturan":
                responseData = { status: "SUCCESS", data: ambilPengaturan() };
                break;
            case "simpanPengaturanKop":
                responseData = simpanPengaturanKop(payload);
                break;
            case "simpanPengaturanTtd":
                responseData = simpanPengaturanTtd(payload);
                break;
            case "dapatkanRiwayatSuratMasuk":
                responseData = { status: "SUCCESS", data: dapatkanRiwayatSuratMasuk() };
                break;
            case "simpanSuratMasukOCR":
                responseData = simpanSuratMasukOCR(payload.metadata, payload.base64Data, payload.mimeType);
                break;
            case "ambilSemuaTemplate":
                responseData = { status: "SUCCESS", data: ambilSemuaTemplate() };
                break;
            case "simpanTemplateDinamis":
                responseData = simpanTemplateDinamis(payload);
                break;
            case "hapusTemplateSatu":
                responseData = hapusTemplateSatu(payload);
                break;
            case "hapusSemuaTemplate":
                responseData = hapusSemuaTemplate();
                break;
            case "hapusDataArsip":
                responseData = hapusDataArsip(payload.id, payload.nomor);
                break;
            case "imporSiswaBatch":
                responseData = imporSiswaBatch(payload);
                break;
            case "imporGuruBatch":
                responseData = imporGuruBatch(payload);
                break;
            case "ambilKodeKlasifikasiSurat":
                responseData = { status: "SUCCESS", data: ambilKodeKlasifikasiSurat() };
                break;
            case "tambahKodeKlasifikasiSurat":
                responseData = tambahKodeKlasifikasiSurat(payload);
                break;
            case "hapusKodeKlasifikasi":
                responseData = hapusKodeKlasifikasi(payload);
                break;
            case "simpanDatabaseUser":
                responseData = simpanDatabaseUser(payload);
                break;
            case "perbaruiProfilUser":
                responseData = perbaruiProfilUser(payload.usernameLama, payload.dataBaru);
                break;
            case "hapusUserDatabase":
                responseData = hapusUserDatabase(payload);
                break;
            case "imporTemplatesBatch":
                responseData = imporTemplatesBatch(payload);
                break;
            case "uploadFileLogoKeDrive":
                responseData = uploadFileLogoKeDrive(payload.dataMime, payload.base64Data, payload.namaKomponen);
                break;
            default:
                responseData = { status: "ERROR", message: `Aksi '${action}' tidak didukung oleh server backend.` };
        }

        // Kembalikan respons dalam format JSON ke Electron
        return ContentService.createTextOutput(JSON.stringify(responseData))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", message: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Fungsi pembantu untuk menyisipkan file HTML lain ke dalam template utama
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Mendapatkan URL Web App secara dinamis untuk link verifikasi QR
 */
function dapatkanUrlSkrip() {
    return ScriptApp.getService().getUrl();
}

/**
 * UTILITY: Membuat URL pemendek (Short Link) via TinyURL agar QR Code sederhana
 */
function getShortUrl(longUrl) {
    // Fitur TinyURL dinonaktifkan, langsung mengembalikan URL panjang (asli)
    return longUrl;
}

/**
 * Utility: Membuka Spreadsheet secara terpusat
 */
let _cachedSs = null;
function dapatkanSpreadsheetHost() {
    if (_cachedSs) return _cachedSs;
    try {
        if (SPREADSHEET_ID && SPREADSHEET_ID !== "ID_SPREADSHEET_ANDA") {
            _cachedSs = SpreadsheetApp.openById(SPREADSHEET_ID);
        } else {
            _cachedSs = SpreadsheetApp.getActiveSpreadsheet();
        }
        return _cachedSs;
    } catch (error) {
        throw new Error("Gagal membuka Spreadsheet. Periksa SPREADSHEET_ID di Kode.gs atau pastikan skrip menempel pada Spreadsheet.");
    }
}

/**
 * UTILITY: Hashing password menggunakan SHA-256
 */
function hashPassword(password) {
    return password || "";
}


/**
 * Inisialisasi Database: Membuat sheet dan kolom yang sesuai
 * (Updated: Mendukung 3 Struktur Tanda Tangan)
 */
function inisialisasiDatabase() {
    const ss = dapatkanSpreadsheetHost();

    // 1. Sheet Pengaturan
    let sheetSetting = ss.getSheetByName(SHEET_PENGATURAN);
    if (!sheetSetting) {
        sheetSetting = ss.insertSheet(SHEET_PENGATURAN);
        sheetSetting.appendRow(["Parameter", "Value"]);
        const defaultSettings = [
            ["App_Name", "KlikSurat SDN Mojogemi 02"],
            ["Kop_Daerah", "PEMERINTAH KABUPATEN ..."],
            ["Kop_Sub_Dinas", "DINAS ..."],
            ["Kop_Sekolah", "NAMA SEKOLAH ANDA"],
            ["Kop_Alamat", "ALAMAT LENGKAP SEKOLAH"],
            ["Kop_Kontak", "Email: sekolah@example.com | NPSN: " + NPSN_SEKOLAH],
            ["NPSN_Sekolah", NPSN_SEKOLAH],
            ["Kode_Provinsi", "35"],
            ["Kode_Kabupaten", "09"],
            ["Kode_Dinas", "310"],
            ["Kode_Kecamatan", "24"],
            ["Logo_Kiri_Url", ""], ["Logo_Kanan_Url", ""],
            ["Ukuran_Kertas", "size-a4"], ["Pilihan_Font", "font-serif-official"],
            ["Line_Spacing", "1.6"],
            ["Satuan_Margin", "mm"], ["Margin_Atas", "10"], ["Margin_Bawah", "10"], ["Margin_Kiri", "10"], ["Margin_Kanan", "10"],

            ["Ttd_Mode_Aktif", "kanan-bawah"], // Contoh mode: 'tunggal', 'ganda', atau 'tiga-kolom'
            ["Layout_Type", "standard"],

            ["Ttd_Frasa_Ditetapkan", "Ditetapkan di"],
            ["Ttd_Frasa_Tanggal", "Pada Tanggal"],
            ["Ttd_Height", "80"],
            ["Ttd_Gunakan_Materai", "TIDAK"],
            ["Ttd_Gunakan_Foto", "TIDAK"],

            // Data TTD Pejabat 1 (Utama)
            ["Ttd_Jabatan_1", "Kepala Sekolah"],
            ["Ttd_Nama_1", "NAMA KEPALA SEKOLAH"],
            ["Ttd_Pangkat_1", "PANGKAT/GOLONGAN"],
            ["Ttd_Nip_1", "00000000 000000 0 000"],

            // Data TTD Pejabat 2
            ["Ttd_Jabatan_2", "Ketua Komite"],
            ["Ttd_Nama_2", "-"],
            ["Ttd_Pangkat_2", "-"],
            ["Ttd_Nip_2", "-"],

            // Data TTD Pejabat 3
            ["Ttd_Jabatan_3", "Bendahara Sekolah"],
            ["Ttd_Nama_3", "-"],
            ["Ttd_Pangkat_3", "-"],
            ["Ttd_Nip_3", "-"]
        ];
        sheetSetting.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
    }
    sheetSetting.getRange("A:B").setNumberFormat("@");

    // 2. Sheet Users
    let shUsers = ss.getSheetByName(SHEET_USERS);
    if (!shUsers) {
        shUsers = ss.insertSheet(SHEET_USERS);
        shUsers.appendRow(["Username", "Password", "Nama_Lengkap", "Role"]);
    }
    ss.getSheetByName(SHEET_USERS).getRange("A:D").setNumberFormat("@");
    if (shUsers.getLastRow() <= 1) {
        shUsers.appendRow(["admin", "admin123", "Administrator Utama", "Operator Utama"]);
    }

    // 3. Sheet Log Arsip
    let shLog = ss.getSheetByName(SHEET_LOG);
    if (!shLog) {
        shLog = ss.insertSheet(SHEET_LOG);
        shLog.appendRow(["Timestamp", "Operator", "Tanggal_Surat", "Nomor_Surat", "Perihal", "Penerima", "Lampiran", "Pembuka", "Isi_Surat", "Tembusan", "Serial_ID", "Layout", "Ref_ID"]);
    }
    shLog.getRange("B:M").setNumberFormat("@");
    if (shLog.getLastRow() <= 1) {
        const dummyLog = [
            ["2026-06-15 14:00:00", "admin", "2026-06-15", "005/012/SDN.02/2026", "Undangan Rapat Wali Murid Kelas VI", "Wali Murid Kelas VI SDN Mojogemi 02", "1 Berkas", "Dengan hormat,", "Mengharap kehadiran Bapak/Ibu Wali Murid Kelas VI pada hari Sabtu tanggal 20 Juni 2026 untuk Rapat Sosialisasi Ujian Sekolah...", "1. Komite Sekolah\n2. Arsip", "V6F3B2A", "standard", ""]
        ];
        shLog.getRange(2, 1, dummyLog.length, dummyLog[0].length).setValues(dummyLog);
    }

    // 4. Sheet Database Templates
    let shTemplates = ss.getSheetByName(SHEET_TEMPLATES);
    if (!shTemplates) {
        shTemplates = ss.insertSheet(SHEET_TEMPLATES);
        shTemplates.appendRow(["Nama_Template", "Tanggal_Default", "Nomor", "Perihal", "Penerima", "Lampiran", "Pembuka", "Isi_Surat", "Tembusan", "Layout"]);
    }
    shTemplates.getRange("A:J").setNumberFormat("@");
    if (shTemplates.getLastRow() <= 1) {
        const dummyTemplates = [
            [
                "Surat Undangan Wali Murid",
                "Jember, [tanggal]",
                "005/[no_urut]/SDN.02/[tahun]",
                "Undangan Rapat Wali Murid",
                "Kepada Yth.\nBapak/Ibu Wali Murid\ndi Tempat",
                "1 Lembar",
                "Dengan hormat,",
                "<p>Sehubungan dengan pelaksanaan Ujian Sekolah tahun ajaran 2025/2026, kami mengharap kehadiran Bapak/Ibu Wali Murid kelas VI pada:</p><table><tr><td style=\"width: 120px;\">Hari / Tanggal</td><td style=\"width: 15px;\">:</td><td>Sabtu, 20 Juni 2026</td></tr><tr><td>Waktu</td><td>:</td><td>08.00 WIB - Selesai</td></tr><tr><td>Tempat</td><td>:</td><td>Ruang Kelas VI SDN Mojogemi 02</td></tr><tr><td>Acara</td><td>:</td><td>Rapat Sosialisasi Ujian Sekolah</td></tr></table><p>Demikian undangan ini kami sampaikan, atas kehadiran Bapak/Ibu kami ucapkan terima kasih.</p>",
                "Arsip",
                "standard"
            ],
            [
                "Surat Tugas PBM Guru",
                "Jember, [tanggal]",
                "800/[no_urut]/SDN.02/[tahun]",
                "Surat Tugas Mengajar",
                "Kepada Yth.\n[nama_guru]\nNIP. [nip_guru]\ndi Tempat",
                "-",
                "Dengan hormat,",
                "<p>Kepala Sekolah Dasar Negeri Mojogemi 02 Kecamatan Sukowono dengan ini menugaskan kepada:</p><table><tr><td style=\"width: 120px;\">Nama</td><td style=\"width: 15px;\">:</td><td><b>{{nama_guru}}</b></td></tr><tr><td>NIP</td><td>:</td><td>{{nip_guru}}</td></tr><tr><td>Pangkat/Gol</td><td>:</td><td>{{pangkat_guru}}</td></tr><tr><td>Jabatan</td><td>:</td><td>{{jabatan_guru}}</td></tr></table><p>Untuk melaksanakan tugas pembelajaran dan pembimbingan siswa kelas VI tahun ajaran 2025/2026 di SDN Mojogemi 02.</p><p>Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.</p>",
                "Arsip",
                "standard"
            ],
            [
                "Surat Keterangan Kelakuan Baik",
                "Jember, [tanggal]",
                "421.3/[no_urut]/SDN.02/[tahun]",
                "Surat Keterangan Kelakuan Baik",
                "Kepada Yth.\nKepala SMP Negeri 1 Sukowono\ndi Tempat",
                "-",
                "Dengan hormat,",
                "<p>Yang bertanda tangan di bawah ini Kepala SDN Mojogemi 02 menerangkan bahwa:</p><table><tr><td style=\"width: 120px;\">Nama Siswa</td><td style=\"width: 15px;\">:</td><td><b>{{nama_siswa}}</b></td></tr><tr><td>NIS / NISN</td><td>:</td><td>{{nis_siswa}} / {{nisn_siswa}}</td></tr><tr><td>Kelas</td><td>:</td><td>{{kelas_siswa}}</td></tr></table><p>Adalah benar-benar siswa SDN Mojogemi 02 yang berkelakuan baik dan tidak pernah melakukan pelanggaran tata tertib sekolah.</p>",
                "Arsip",
                "standard"
            ]
        ];
        shTemplates.getRange(2, 1, dummyTemplates.length, dummyTemplates[0].length).setValues(dummyTemplates);
    }

    // 5. Sheet Kode Klasifikasi Surat
    if (!ss.getSheetByName(SHEET_KLASIFIKASI)) {
        let sh = ss.insertSheet(SHEET_KLASIFIKASI);
        sh.appendRow(["Kode", "Nama_Klasifikasi", "Aktif"]);
        sh.getRange("A:C").setNumberFormat("@");
        sh.getRange(2, 1, 8, 3).setValues([
            ["400.3.5", "Administrasi Sekolah", "YA"],
            ["005", "Undangan", "YA"],
            ["421.2", "Pendidikan Dasar", "YA"],
            ["421.3", "Kesiswaan", "YA"],
            ["421.5", "Kurikulum", "YA"],
            ["800", "Kepegawaian", "YA"],
            ["900", "Keuangan", "YA"],
            ["045", "Arsip/Dokumentasi", "YA"]
        ]);
    }
    ss.getSheetByName(SHEET_KLASIFIKASI).getRange("A:C").setNumberFormat("@");

    // 6. Sheet Database Siswa
    let shSiswa = ss.getSheetByName(SHEET_SISWA);
    if (!shSiswa) {
        shSiswa = ss.insertSheet(SHEET_SISWA);
        const headers = [
            "Nama", "NIS", "NISN", "Tempat_Lahir", "Tanggal_Lahir", "Dusun", "Desa", "RT", "RW", "Kecamatan", "Kabupaten", "Nama_Ayah", "Nama_Ibu", "Kelas", "Tahun_Ajaran", "VA_PIP", "Rek_PIP", "Nomor_Ijazah", "Ket_Lulus",
            "Pendidikan Agama dan Budi Pekerti", "Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "Ilmu Pengetahuan Alam dan Sosial", "Pendidikan Jasmani, Olahraga, dan Kesehatan", "Seni dan Budaya", "Bahasa Inggris", "Bahasa Madura", "Baca Tulis Al Quran (BTA)"
        ];
        shSiswa.appendRow(headers);
        shSiswa.getRange("A:AC").setNumberFormat("@");
    }
    if (shSiswa.getLastRow() <= 1) {
        const dummySiswa = [
            ["BUDI SANTOSO", "12345", "0123456789", "Jember", "2012-05-14", "Krajan", "Mojogemi", "01", "02", "Sukowono", "Jember", "Ahmad Santoso", "Siti Aminah", "VI", "2025/2026", "1234567890", "987654321", "IJZ-12345", "LULUS", "85", "80", "88", "75", "82", "90", "84", "78", "80", "85"],
            ["SITI AISYAH", "12346", "0123456790", "Jember", "2012-08-20", "Dusun Timur", "Mojogemi", "02", "02", "Sukowono", "Jember", "Muhammad Ridho", "Lailatul Qomariyah", "VI", "2025/2026", "1234567891", "987654322", "IJZ-12346", "LULUS", "90", "85", "92", "88", "89", "85", "90", "85", "88", "92"],
            ["RUDI HERMAWAN", "12347", "0123456791", "Jember", "2012-11-02", "Krajan", "Mojogemi", "01", "02", "Sukowono", "Jember", "Herwan", "Susi Susanti", "VI", "2025/2026", "-", "-", "IJZ-12347", "LULUS", "80", "78", "82", "80", "80", "85", "82", "80", "78", "80"]
        ];
        shSiswa.getRange(2, 1, dummySiswa.length, dummySiswa[0].length).setValues(dummySiswa);
    }

    // 7. Sheet Database Guru
    let shGuru = ss.getSheetByName(SHEET_GURU);
    if (!shGuru) {
        shGuru = ss.insertSheet(SHEET_GURU);
        const headers = ["Nama", "NIP", "NUPTK", "Jabatan", "Pangkat_Golongan", "Unit_Kerja", "Tugas_Utama", "Tugas_Tambahan"];
        shGuru.appendRow(headers);
        shGuru.getRange("A:H").setNumberFormat("@");
    }
    if (shGuru.getLastRow() <= 1) {
        const dummyGuru = [
            ["Drs. Heri Susanto", "197508122005011002", "1234567890123456", "Kepala Sekolah / Pembina", "Penata Tingkat I / IVa", "SDN Mojogemi 02", "Memimpin Sekolah", "Kepala Sekolah"],
            ["Sri Wahyuni, S.Pd.", "198203152008022005", "6543210987654321", "Guru Kelas / Penata", "Penata / IIIc", "SDN Mojogemi 02", "Mengajar Kelas VI", "Wakil Kepala Sekolah / Kurikulum"],
            ["Ahmad Fauzi, S.Pd.", "199012252018011003", "9876543210987654", "Guru Penjasorkes", "Penata Muda / IIIa", "SDN Mojogemi 02", "Mengajar Olahraga", "Pembina Pramuka"]
        ];
        shGuru.getRange(2, 1, dummyGuru.length, dummyGuru[0].length).setValues(dummyGuru);
    }

    // 8. Sheet Log Surat Masuk
    let shLogMasuk = ss.getSheetByName(SHEET_LOG_MASUK);
    if (!shLogMasuk) {
        shLogMasuk = ss.insertSheet(SHEET_LOG_MASUK);
        shLogMasuk.appendRow(["Timestamp", "Operator", "Tanggal_Terima", "Asal_Surat", "Nomor_Surat_Asal", "Perihal", "Isi_OCR", "Link_File"]);
        shLogMasuk.getRange("A:H").setNumberFormat("@");
    }
    if (shLogMasuk.getLastRow() <= 1) {
        const dummyLogMasuk = [
            ["2026-06-15 10:00:00", "admin", "2026-06-14", "Dinas Pendidikan Kabupaten Jember", "420/1234/413/2026", "Undangan Rapat Koordinasi BOS", "Kepada Yth. Kepala SDN Mojogemi 02 Sukowono. Dinas Pendidikan mengundang menghadiri Rapat Koordinasi Teknis BOS pada hari Rabu...", "https://drive.google.com/open?id=123"],
            ["2026-06-16 09:30:00", "admin", "2026-06-15", "Kecamatan Sukowono", "005/567/2026", "Undangan Upacara Hari Kemerdekaan", "Camat Sukowono mengharap kehadiran Kepala Sekolah pada Upacara HUT RI ke-81 di Alun-Alun Kecamatan Sukowono...", "https://drive.google.com/open?id=456"]
        ];
        shLogMasuk.getRange(2, 1, dummyLogMasuk.length, dummyLogMasuk[0].length).setValues(dummyLogMasuk);
    }
}

/**
 * AUTH: Sistem Login
 */
function prosesLogin(username, password) {
    try {
        inisialisasiDatabase();
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_USERS);
        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === username) {
                const storedPassword = data[i][1];
                if (storedPassword === password) {
                    return { status: "SUCCESS", nama: data[i][2], role: data[i][3], username: data[i][0] };
                }
            }
        }
        return { status: "FAILED", message: "Username atau password salah!" };
    } catch (error) {
        return { status: "ERROR", message: error.toString() };
    }
}

/**
 * OCR ENGINE: Mengolah Surat Masuk (Upload + Ekstraksi Teks)
 * Fungsi ini membutuhkan Layanan "Drive API" diaktifkan di Advanced Services.
 */
function simpanSuratMasukOCR(metadata, base64Data, mimeType) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_LOG_MASUK);
        const folder = DriveApp.getFolderById(FOLDER_MASUK_ID); // Menggunakan folder khusus surat masuk

        // 1. Simpan File Asli ke Drive
        const decoded = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decoded, mimeType, "Scan_Masuk_" + metadata.nomor_asal);
        const file = folder.createFile(blob);
        const fileUrl = file.getUrl();

        // 2. Lakukan OCR menggunakan Google Drive API jika diaktifkan
        let extractedText = "-";
        try {
            if (typeof Drive !== "undefined") {
                const resource = {
                    title: "Temp_OCR_" + metadata.nomor_asal, // Untuk Drive API v2
                    name: "Temp_OCR_" + metadata.nomor_asal,  // Untuk Drive API v3
                    mimeType: "application/vnd.google-apps.document" // Target: Google Doc (Memicu OCR otomatis)
                };

                let tempFile;
                // Cek versi Drive API secara dinamis
                if (typeof Drive.Files.insert === "function") {
                    tempFile = Drive.Files.insert(resource, blob);
                } else if (typeof Drive.Files.create === "function") {
                    tempFile = Drive.Files.create(resource, blob);
                } else {
                    throw new Error("Metode insert atau create tidak ditemukan pada layanan Drive API.");
                }

                if (tempFile && tempFile.id) {
                    try {
                        // Coba ekspor langsung dengan Drive API agar tidak membutuhkan scope/izin DocumentApp
                        const textBlob = Drive.Files.export(tempFile.id, "text/plain");
                        extractedText = textBlob.getDataAsString();
                    } catch (exportErr) {
                        // Fallback ke DocumentApp jika ekspor langsung gagal
                        const doc = DocumentApp.openById(tempFile.id);
                        extractedText = doc.getBody().getText();
                    }
                    Drive.Files.remove(tempFile.id); // Hapus file doc sementara
                }
            } else {
                extractedText = "[INFO] Gagal melakukan OCR karena layanan 'Drive API' belum diaktifkan di setelan Layanan (Advanced Services) Google Apps Script.";
            }
        } catch (ocrError) {
            extractedText = "[OCR ERROR] Gagal mengekstrak teks secara otomatis: " + ocrError.toString();
        }

        // 3. Catat ke Database Log_Surat_Masuk
        sheet.appendRow([
            new Date(),
            metadata.operator || "Admin",
            metadata.tanggal_terima,
            metadata.asal_surat,
            metadata.nomor_asal,
            metadata.perihal,
            extractedText,
            fileUrl
        ]);

        // Format baris terakhir agar rapi
        sheet.getRange(sheet.getLastRow(), 1, 1, 8).setNumberFormat("@");

        return {
            status: "SUCCESS",
            message: "Surat berhasil diarsipkan. Teks telah diekstrak otomatis.",
            extracted: extractedText.substring(0, 200) + "..."
        };

    } catch (e) {
        return { status: "ERROR", message: "Gagal memproses surat masuk: " + e.toString() };
    }
}

/**
 * SETTINGS: Ambil data pengaturan
 */
function ambilPengaturan() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_PENGATURAN);
        const data = sheet.getDataRange().getValues();
        const config = data.slice(1).reduce((acc, [key, val]) => {
            if (key) acc[key] = val;
            return acc;
        }, {});

        // Tambahkan data pejabat KS untuk pemanggilan variabel global
        config.pejabat_ks = {
            nama: config.Ttd_Nama_1 || "",
            nip: config.Ttd_Nip_1 || "",
            jabatan: config.Ttd_Jabatan_1 || "",
            pangkat: config.Ttd_Pangkat_1 || ""
        };

        return config;
    } catch (e) { return null; }
}

/**
 * SISWA: Mencari data siswa berdasarkan nama atau NISN
 */
function cariSiswa(query) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_SISWA);
        if (!sheet) return [];

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return []; // Hanya header atau kosong

        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const namaIdx = headers.findIndex(h => h.toLowerCase() === "nama");
        const nisnIdx = headers.findIndex(h => h.toLowerCase() === "nisn");
        const q = String(query || "").toLowerCase().replace(/[^a-z0-9-]/g, ''); // Izinkan tanda hubung
        const qAsli = String(query || "").toLowerCase();

        return data.slice(1)
            .filter(row => {
                const namaVal = namaIdx !== -1 ? String(row[namaIdx] || "").toLowerCase() : "";
                const nisnVal = nisnIdx !== -1 ? String(row[nisnIdx] || "").toLowerCase().replace(/[^a-z0-9]/g, '') : "";
                return (namaIdx !== -1 && namaVal.includes(qAsli)) || (nisnIdx !== -1 && nisnVal.includes(q));
            }).filter(Boolean) // Filter out any null/undefined results
            .map(row => {
                let obj = {};
                headers.forEach((h, i) => {
                    if (h === "Tanggal_Lahir") {
                        if (row[i] instanceof Date) {
                            obj[h] = Utilities.formatDate(row[i], "GMT+7", "yyyy-MM-dd");
                        } else if (typeof row[i] === "string" && row[i].includes("/")) {
                            const p = row[i].split("/"); // DD/MM/YYYY -> YYYY-MM-DD
                            if (p.length === 3) obj[h] = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                            else obj[h] = row[i];
                        } else {
                            obj[h] = row[i];
                        }
                    } else {
                        obj[h] = row[i];
                    }
                });
                return obj;
            }).slice(0, 10); // Limit 10 hasil
    } catch (e) { return []; }
}

/**
 * GURU: Mencari data guru berdasarkan nama atau NIP
  */
function cariGuru(query) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_GURU);
        if (!sheet) return [];
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const namaIdx = headers.findIndex(h => h.toLowerCase() === "nama");
        const nipIdx = headers.findIndex(h => h.toLowerCase() === "nip");
        const q = String(query || "").toLowerCase().replace(/[^a-z0-9-]/g, ''); // Izinkan tanda hubung
        const qAsli = String(query || "").toLowerCase();

        const results = data.slice(1)
            .filter(row => {
                const nama = namaIdx !== -1 ? String(row[namaIdx] || "").toLowerCase() : "";
                const nip = nipIdx !== -1 ? String(row[nipIdx] || "").toLowerCase().replace(/[^a-z0-9-]/g, '') : "";
                return nama.includes(qAsli) || nip.includes(q);
            }).filter(Boolean) // Filter out any null/undefined results
            .map(row => {
                let obj = {};
                headers.forEach((h, i) => {
                    let val = row[i];
                    // Tambahkan kolom identitas lain jika diperlukan
                    if (["NIP", "NUPTK", "NISN", "RT", "RW", "NIS", "Kelas"].includes(h)) {
                        val = String(val).trim();
                    }
                    obj[h] = val;
                });
                return obj;
            }).slice(0, 10);
        return results;
    } catch (e) {
        console.error("[ERROR] Backend cariGuru:", e.toString());
        return [];
    }
}

/**
  * GURU: Mengambil satu data guru secara spesifik berdasarkan NIP
 */
function ambilGuruByNip(nip) {
    try {
        const nipStr = String(nip).trim();
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_GURU);
        if (!sheet) return null;

        // Cari di kolom NIP (Kolom B / 2) menggunakan TextFinder
        const textFinder = sheet.getRange("B:B").createTextFinder(nipStr).matchEntireCell(true);
        const cell = textFinder.findNext();

        if (cell) {
            const rowNum = cell.getRow();
            const lastCol = sheet.getLastColumn();
            const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
            const rowValues = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];

            let obj = {};
            headers.forEach((h, i) => {
                let val = rowValues[i];
                if (["NIP", "NUPTK", "NISN"].includes(h)) val = String(val).trim();
                obj[h] = val;
            });
            return obj;
        }
        return null;

    } catch (e) {
        console.error("[ERROR] Backend ambilGuruByNip:", e.toString());
        return null;
    }
}

/**
 * GURU: Simpan atau Update data guru
 */
function simpanGuruBaru(data) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_GURU);
        const dataRaw = sheet.getDataRange().getValues();
        let headers = dataRaw[0].map(h => String(h).trim());
        let updatedAtIdx = headers.findIndex(h => h.toLowerCase() === "updated_at");
        if (updatedAtIdx === -1) {
            updatedAtIdx = headers.length;
            sheet.getRange(1, headers.length + 1).setValue("updated_at");
            headers.push("updated_at");
        }

        const nipIdx = headers.findIndex(h => h.toLowerCase() === "nip");
        const namaIdx = headers.findIndex(h => h.toLowerCase() === "nama");

        const nipInput = String(data.NIP || "").trim();
        const namaInput = String(data.Nama || "").trim();

        let targetRow = -1;
        // Cari baris yang cocok di Google Sheets
        for (let i = 1; i < dataRaw.length; i++) {
            const rowNip = String(dataRaw[i][nipIdx] || "").trim();
            const rowNama = String(dataRaw[i][namaIdx] || "").trim();

            // Aturan kecocokan keunikan:
            // 1. Jika NIP diinputkan dan bukan tanda hubung ("-"), bandingkan NIP
            // 2. Jika NIP diinputkan berupa "-" atau kosong, bandingkan Nama
            if (nipInput && nipInput !== "-") {
                if (rowNip === nipInput) {
                    targetRow = i + 1;
                    break;
                }
            } else {
                if (rowNama === namaInput && (rowNip === "-" || !rowNip)) {
                    targetRow = i + 1;
                    break;
                }
            }
        }

        // Conflict Resolution check
        const incomingTimestamp = data.updated_at ? parseInt(data.updated_at, 10) : 0;
        if (targetRow !== -1 && targetRow > 1) {
            const existingTimestampStr = dataRaw[targetRow - 1][updatedAtIdx];
            const existingTimestamp = existingTimestampStr ? parseInt(existingTimestampStr, 10) : 0;
            if (existingTimestamp > incomingTimestamp) {
                return { status: "SUCCESS", message: "Data cloud lebih baru. Pembaruan lokal diabaikan untuk mencegah timpa data." };
            }
        }

        const rowData = headers.map(h => {
            if (h.toLowerCase() === "updated_at") return incomingTimestamp || Date.now();
            return data[h] || "";
        });

        if (targetRow > 1) {
            sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
            return { status: "SUCCESS", message: "Data guru '" + data.Nama + "' berhasil diperbarui." };
        } else {
            sheet.appendRow(rowData);
            return { status: "SUCCESS", message: "Guru baru '" + data.Nama + "' berhasil ditambahkan." };
        }
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * GURU: Menghapus data guru
 */
function hapusGuru(payload) {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_GURU);
        if (!sheet) return { status: "ERROR", message: "Sheet Database_Guru tidak ditemukan." };

        let nipStr = "";
        let namaStr = "";
        if (payload && typeof payload === 'object') {
            nipStr = String(payload.NIP || "").trim();
            namaStr = String(payload.Nama || "").trim();
        } else {
            nipStr = String(payload || "").trim();
        }

        const dataRaw = sheet.getDataRange().getValues();
        const headers = dataRaw[0].map(h => String(h).trim());
        const nipIdx = headers.findIndex(h => h.toLowerCase() === "nip");
        const namaIdx = headers.findIndex(h => h.toLowerCase() === "nama");

        let targetRow = -1;
        for (let i = 1; i < dataRaw.length; i++) {
            const rowNip = String(dataRaw[i][nipIdx] || "").trim();
            const rowNama = String(dataRaw[i][namaIdx] || "").trim();

            if (namaStr) {
                if (rowNip === nipStr && rowNama === namaStr) {
                    targetRow = i + 1;
                    break;
                }
            } else {
                if (rowNip === nipStr) {
                    targetRow = i + 1;
                    break;
                }
            }
        }

        if (targetRow > 1) {
            sheet.deleteRow(targetRow);
            return { status: "SUCCESS", message: "Data guru berhasil dihapus." };
        }
        return { status: "ERROR", message: "Data tidak ditemukan." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * GURU: Ambil semua untuk ekspor
 */
function ambilSemuaGuru() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_GURU);
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        return data.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
        });
    } catch (e) { return []; }
}

/**
 * SISWA: Simpan atau Update data siswa
 */
function simpanSiswaBaru(data) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_SISWA);
        if (!sheet) return { status: "ERROR", message: "Sheet Database_Siswa tidak ditemukan." };

        const dataRaw = sheet.getDataRange().getValues();
        let headers = dataRaw[0].map(h => String(h).trim());
        let updatedAtIdx = headers.findIndex(h => h.toLowerCase() === "updated_at");
        if (updatedAtIdx === -1) {
            updatedAtIdx = headers.length;
            sheet.getRange(1, headers.length + 1).setValue("updated_at");
            headers.push("updated_at");
        }

        const nisnIdx = headers.findIndex(h => h.toLowerCase() === "nisn");
        const nisnInput = String(data.NISN || "").trim();

        const nisnMap = new Map(dataRaw.map((r, i) => [String(r[nisnIdx]).trim(), i + 1]));
        const targetRow = nisnInput && nisnMap.has(nisnInput) ? nisnMap.get(nisnInput) : -1;

        // Conflict Resolution check
        const incomingTimestamp = data.updated_at ? parseInt(data.updated_at, 10) : 0;
        if (targetRow !== -1) {
            const existingTimestampStr = dataRaw[targetRow - 1][updatedAtIdx];
            const existingTimestamp = existingTimestampStr ? parseInt(existingTimestampStr, 10) : 0;
            if (existingTimestamp > incomingTimestamp) {
                return { status: "SUCCESS", message: "Data cloud lebih baru. Pembaruan lokal diabaikan untuk mencegah timpa data." };
            }
        }

        const rowData = headers.map(h => {
            let val = data[h] || "";
            if (h.toLowerCase() === "updated_at") {
                val = incomingTimestamp || Date.now();
            }
            if (h === "Tanggal_Lahir" && String(val).includes("-")) {
                const p = String(val).split("-"); // YYYY-MM-DD -> DD/MM/YYYY
                if (p.length === 3) val = `${p[2]}/${p[1]}/${p[0]}`;
            }
            return val;
        });

        if (targetRow !== -1) {
            sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
            return { status: "SUCCESS", message: "Data siswa '" + data.Nama + "' berhasil diperbarui." };
        } else {
            sheet.appendRow(rowData);
            return { status: "SUCCESS", message: "Siswa baru '" + data.Nama + "' berhasil ditambahkan." };
        }
    } catch (e) {
        return { status: "ERROR", message: e.toString() };
    }
}

/**
 * SISWA: Menghapus data siswa berdasarkan NISN
 */
function hapusSiswa(nisn) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_SISWA);
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const nisnIdx = headers.findIndex(h => h.toLowerCase() === "nisn");

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][nisnIdx]).trim() === String(nisn).trim()) {
                sheet.deleteRow(i + 1);
                return { status: "SUCCESS", message: "Data siswa berhasil dihapus secara permanen." };
            }
        }
        return { status: "ERROR", message: "Data siswa tidak ditemukan." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * SISWA: Mengambil seluruh data siswa untuk backup/ekspor
 */
function ambilSemuaSiswa() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_SISWA);
        if (!sheet) return [];
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return [];

        const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
        const headers = data[0];
        return data.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => {
                if (h === "Tanggal_Lahir") {
                    if (row[i] instanceof Date) {
                        obj[h] = Utilities.formatDate(row[i], "GMT+7", "yyyy-MM-dd");
                    } else if (typeof row[i] === "string" && row[i].includes("/")) {
                        const p = row[i].split("/");
                        if (p.length === 3) obj[h] = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                        else obj[h] = row[i];
                    } else {
                        obj[h] = row[i];
                    }
                } else {
                    obj[h] = row[i];
                }
            });
            return obj;
        });
    } catch (e) { return []; }
}

/**
 * SISWA: Impor massal data siswa (Dukungan JSON)
 */
function imporSiswaBatch(siswaArray) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_SISWA);
        const dataExist = sheet.getDataRange().getValues();
        const headers = dataExist[0].map(h => String(h).trim());
        const nisnIdx = headers.findIndex(h => h.toLowerCase() === "nisn");
        if (nisnIdx === -1) return { status: "ERROR", message: "Kolom NISN tidak ditemukan di database." };

        // Map untuk pencarian O(1)
        const nisnMap = new Map();
        dataExist.forEach((row, index) => {
            const key = String(row[nisnIdx] || "").trim();
            if (index > 0 && key) nisnMap.set(key, index + 1);
        });

        siswaArray.forEach(s => {
            const nisnInput = String(s.NISN || "").trim();
            const rowData = headers.map(h => s[h] || "");

            if (nisnInput && nisnMap.has(nisnInput)) {
                sheet.getRange(nisnMap.get(nisnInput), 1, 1, rowData.length).setValues([rowData]);
            } else if (nisnInput) {
                sheet.appendRow(rowData);
                nisnMap.set(nisnInput, sheet.getLastRow());
            }
        });

        return { status: "SUCCESS", message: siswaArray.length + " data siswa diproses (Tambah/Update)." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * GURU: Impor massal data guru (Dukungan JSON)
 */
function imporGuruBatch(guruArray) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_GURU);
        const dataExist = sheet.getDataRange().getValues();
        const headers = dataExist[0].map(h => String(h).trim());
        const nipIdx = headers.findIndex(h => h.toLowerCase() === "nip");
        const namaIdx = headers.findIndex(h => h.toLowerCase() === "nama");
        if (nipIdx === -1) return { status: "ERROR", message: "Kolom NIP tidak ditemukan di database." };
        if (namaIdx === -1) return { status: "ERROR", message: "Kolom Nama tidak ditemukan di database." };

        // Buat map pencarian
        // Untuk NIP valid (bukan "-" dan tidak kosong), petakan NIP -> index baris
        // Untuk NIP "-" atau kosong, petakan Nama -> index baris
        const keyMap = new Map();
        dataExist.forEach((row, index) => {
            if (index > 0) {
                const rNip = String(row[nipIdx] || "").trim();
                const rNama = String(row[namaIdx] || "").trim();
                if (rNip && rNip !== "-") {
                    keyMap.set("NIP_" + rNip, index + 1);
                } else if (rNama) {
                    keyMap.set("Nama_" + rNama, index + 1);
                }
            }
        });

        guruArray.forEach(g => {
            const nipInput = String(g.NIP || "").trim();
            const namaInput = String(g.Nama || "").trim();
            const rowData = headers.map(h => g[h] || "");

            let targetRow = -1;
            let keyStr = "";
            if (nipInput && nipInput !== "-") {
                keyStr = "NIP_" + nipInput;
            } else if (namaInput) {
                keyStr = "Nama_" + namaInput;
            }

            if (keyStr && keyMap.has(keyStr)) {
                targetRow = keyMap.get(keyStr);
                sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
            } else if (nipInput || namaInput) {
                sheet.appendRow(rowData);
                targetRow = sheet.getLastRow();
                if (keyStr) keyMap.set(keyStr, targetRow);
            }
        });

        return { status: "SUCCESS", message: guruArray.length + " data guru diproses (Tambah/Update)." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}


/**
 * UPLOAD: Mengolah Base64 dan mengembalikan link lh3 (High Res)
 */
function uploadFileLogoKeDrive(dataMime, base64Data, namaKomponen) {
    try {
        const folder = DriveApp.getFolderById(FOLDER_LOGO_ID);
        const rawData = Utilities.base64Decode(base64Data);
        const fileName = "Logo_" + namaKomponen;
        const blob = Utilities.newBlob(rawData, dataMime, fileName);

        // Cari file yang ada, pastikan bukan yang di dalam sampah (Trash)
        const existingFiles = folder.getFilesByName(fileName);
        let file;

        while (existingFiles.hasNext()) {
            let f = existingFiles.next();
            if (!f.isTrashed()) {
                f.setTrashed(true); // Hapus versi lama agar tidak terjadi konflik metadata/header
            }
        }

        // Buat file baru secara bersih untuk menjamin integritas data biner
        file = folder.createFile(blob);

        const fileId = file.getId(); // Dapatkan ID segera setelah file dibuat

        // Coba atur sharing, jika ditolak kebijakan organisasi, biarkan tetap privat
        try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) {
            console.warn("Sharing ditolak kebijakan organisasi: " + e.message);
        }

        /**
         * Alternatif URL: Menggunakan format direct 'lh3' berbasis ID File.
         * Format ini lebih stabil dan tidak memutus eksekusi jika setSharing gagal.
         */
        const directUrl = "https://lh3.googleusercontent.com/d/" + fileId;

        return { status: "SUCCESS", url: directUrl };
    } catch (err) {
        return { status: "ERROR", message: err.toString() };
    }
}
/**
 * ARSIP: Murni hanya menyuntikkan teks isi surat ke sheet Log_Surat
 */
function simpanPaketSuratLengkap(paket) {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheetLog = db.getSheetByName(SHEET_LOG); // Target: Log_Surat

        if (!sheetLog) {
            return { status: "ERROR", message: "Sheet Log_Surat tidak ditemukan." };
        }

        const lastRow = sheetLog.getLastRow();

        // Ambil data konten teks surat dari parameter
        const s = paket.surat ? paket.surat : paket;

        sheetLog.appendRow([
            new Date(),
            String(s.operator || "Operator"),
            String(s.tanggal || ""),
            String(s.nomor || ""),
            String(s.perihal || ""),
            String(s.penerima || ""),
            String(s.lampiran || "-"),
            String(s.pembuka || ""),
            String(s.isi || ""),
            String(s.tembusan || ""),
            String(s.serial_id || "-"),
            String(s.layout || "standard"),
            String(s.ref_id || "")
        ]);

        // Cukup format baris yang baru saja ditambahkan agar ringan
        sheetLog.getRange(lastRow + 1, 2, 1, 12).setNumberFormat("@");

        return { status: "SUCCESS", message: "Surat berhasil diarsipkan ke database log." };

    } catch (e) {
        return { status: "ERROR", message: "Gagal mengarsipkan: " + e.toString() };
    }
}

/**
 * TEMPLATE: Murni hanya mendaftarkan teks isi surat ke sheet Database_Templates
 */
function simpanTemplateDinamis(data) {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheetTemplate = db.getSheetByName(SHEET_TEMPLATES); // Target: Database_Templates

        if (!sheetTemplate) {
            return { status: "ERROR", message: "Sheet Database_Templates tidak ditemukan." };
        }

        const namaTemplate = data.nama || "Template Baru";

        // OPTIMASI: Hanya ambil kolom pertama (Nama Template) untuk cek duplikat
        const lastRow = sheetTemplate.getLastRow();
        const names = lastRow > 1 ? sheetTemplate.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];
        const isDuplicate = names.some(n => String(n).toLowerCase() === namaTemplate.toLowerCase());

        if (isDuplicate) {
            return { status: "FAILED", message: "Template dengan nama '" + namaTemplate + "' sudah ada. Gunakan nama lain." };
        }

        const s = data.surat ? data.surat : data;

        sheetTemplate.appendRow([
            String(namaTemplate),
            String(s.tanggal || ""),
            String(s.nomor || ""),
            String(s.perihal || ""),
            String(s.penerima || ""),
            String(s.lampiran || "-"),
            String(s.pembuka || ""),
            String(s.isi || ""),
            String(s.tembusan || ""),
            String(s.layout || "standard")
        ]);

        sheetTemplate.getRange(sheetTemplate.getLastRow(), 1, 1, 10).setNumberFormat("@");

        return { status: "SUCCESS", message: "Master template '" + namaTemplate + "' berhasil disimpan." };
    } catch (e) {
        return { status: "ERROR", message: "Gagal menyimpan template: " + e.toString() };
    }
}
/**
 * TEMPLATES: Mengambil seluruh master template untuk dropdown frontend
 */
function ambilSemuaTemplate() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_TEMPLATES);
        if (!sheet) return [];

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        const headers = data[0].map(h => String(h).trim().toLowerCase());

        const idxNama = headers.indexOf("nama_template") !== -1 ? headers.indexOf("nama_template") : headers.indexOf("nama");
        const idxNomor = headers.indexOf("nomor");
        const idxTanggal = headers.indexOf("tanggal_default") !== -1 ? headers.indexOf("tanggal_default") : headers.indexOf("tanggal");
        const idxPerihal = headers.indexOf("perihal");
        const idxPenerima = headers.indexOf("penerima");
        const idxLampiran = headers.indexOf("lampiran");
        const idxPembuka = headers.indexOf("pembuka");
        const idxIsi = headers.indexOf("isi_surat") !== -1 ? headers.indexOf("isi_surat") : headers.indexOf("isi");
        const idxTembusan = headers.indexOf("tembusan");
        const idxLayout = headers.indexOf("layout");

        const templates = data.slice(1).map(row => {
            let tglTemplate = "";
            if (idxTanggal !== -1 && row[idxTanggal]) {
                tglTemplate = row[idxTanggal] instanceof Date
                    ? Utilities.formatDate(row[idxTanggal], "GMT+7", "yyyy-MM-dd")
                    : String(row[idxTanggal]);
            }

            return {
                nama: idxNama !== -1 ? String(row[idxNama]) : "(Tanpa Nama Template)",
                nomor: idxNomor !== -1 ? String(row[idxNomor]) : "",
                tanggal: tglTemplate,
                perihal: idxPerihal !== -1 ? String(row[idxPerihal]) : "",
                penerima: idxPenerima !== -1 ? String(row[idxPenerima]) : "",
                lampiran: idxLampiran !== -1 ? String(row[idxLampiran]) : "-",
                pembuka: idxPembuka !== -1 ? String(row[idxPembuka]) : "",
                isi: idxIsi !== -1 ? String(row[idxIsi]) : "",
                tembusan: idxTembusan !== -1 ? String(row[idxTembusan]) : "",
                layout: idxLayout !== -1 ? String(row[idxLayout]) : "standard"
            };
        })
            // Filter hanya template yang memiliki nama (menghindari baris kosong di sheet)
            .filter(t => t.nama && t.nama.trim() !== "" && t.nama !== "(Tanpa Nama Template)" && t.nama !== "Nama_Template");

        return templates;

    } catch (e) {
        console.error("Gagal ambilSemuaTemplate: " + e.toString());
        return [];
    }
}

/**
 * MASTER DATA: Mengambil kode klasifikasi surat aktif
 */
function ambilKodeKlasifikasiSurat() {
    try {
        inisialisasiDatabase();
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_KLASIFIKASI);
        if (!sheet) return [];

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        return data.slice(1)
            .filter(row => row[0] && String(row[2] || "YA").toUpperCase() !== "TIDAK")
            .map(row => ({
                kode: String(row[0]).trim(),
                nama: String(row[1] || "").trim()
            }))
            .filter(item => item.kode);
    } catch (e) {
        console.error("Gagal ambilKodeKlasifikasiSurat: " + e.toString());
        return [];
    }
}

/**
 * MASTER DATA: Menghapus kode klasifikasi surat
 */
function hapusKodeKlasifikasi(kode) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_KLASIFIKASI);
        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === String(kode).trim()) {
                sheet.deleteRow(i + 1);
                return { status: "SUCCESS", message: `Kode '${kode}' berhasil dihapus.` };
            }
        }
        return { status: "FAILED", message: "Kode tidak ditemukan." };
    } catch (e) {
        return { status: "ERROR", message: e.toString() };
    }
}

/**
 * MASTER DATA: Menambah kode klasifikasi surat baru
 */
function tambahKodeKlasifikasiSurat(dataKode) {
    try {
        inisialisasiDatabase();
        const kode = String(dataKode && dataKode.kode ? dataKode.kode : "").trim();
        const nama = String(dataKode && dataKode.nama ? dataKode.nama : "").trim();

        if (!kode || !nama) {
            return { status: "FAILED", message: "Kode dan nama klasifikasi wajib diisi." };
        }

        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_KLASIFIKASI);
        sheet.getRange("A:C").setNumberFormat("@");
        const data = sheet.getDataRange().getValues();
        const kodeLower = kode.toLowerCase();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim().toLowerCase() === kodeLower) {
                sheet.getRange(i + 1, 1, 1, 3).setNumberFormat("@");
                sheet.getRange(i + 1, 1, 1, 3).setValues([[String(kode), String(nama), "YA"]]);
                return { status: "SUCCESS", message: "Kode klasifikasi diperbarui." };
            }
        }

        const nextRow = sheet.getLastRow() + 1;
        sheet.getRange(nextRow, 1, 1, 3).setNumberFormat("@");
        sheet.getRange(nextRow, 1, 1, 3).setValues([[String(kode), String(nama), "YA"]]);
        return { status: "SUCCESS", message: "Kode klasifikasi baru berhasil ditambahkan." };
    } catch (e) {
        return { status: "ERROR", message: "Gagal menyimpan kode klasifikasi: " + e.toString() };
    }
}

function dapatkanTimestampMilis(val) {
    if (val instanceof Date) return val.getTime();
    if (!val) return new Date().getTime();
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
    return new Date().getTime();
}

/**
 * ARSIP: Menarik riwayat log arsip surat keluar
 */
function dapatkanRiwayatArsip() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_LOG);
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        const hasilMap = data.slice(1).map(row => {
            let idTs = dapatkanTimestampMilis(row[0]);
            let waktuSistem = row[0];
            if (row[0] instanceof Date) {
                waktuSistem = Utilities.formatDate(row[0], "GMT+7", "dd/MM/yy HH:mm");
            }

            let tanggalSurat = row[2];
            if (row[2] instanceof Date) {
                tanggalSurat = Utilities.formatDate(row[2], "GMT+7", "yyyy-MM-dd");
            }

            return {
                id: idTs,
                waktu: waktuSistem,
                operator: row[1],
                tanggal: tanggalSurat,
                nomor: row[3],
                perihal: row[4],
                penerima: row[5],
                lampiran: row[6],
                pembuka: row[7],
                isi: row[8],
                tembusan: row[9] || "",
                sid: row[10] || "N/A",
                layout: row[11] || "standard",
                ref_id: row[12] || ""
            };
        });

        return hasilMap.reverse().slice(0, 50);

    } catch (e) {
        console.error("Error dapatkanRiwayatArsip: " + e.toString());
        return [];
    }
}

/**
 * ARSIP: Menarik riwayat log surat masuk
 */
function dapatkanRiwayatSuratMasuk() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_LOG_MASUK);
        if (!sheet) return [];
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        const hasilMap = data.slice(1).map(row => {
            let idTs = dapatkanTimestampMilis(row[0]);
            let waktuSistem = row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+7", "dd/MM/yy HH:mm") : row[0];

            let tanggalTerima = row[2];
            if (row[2] instanceof Date) {
                tanggalTerima = Utilities.formatDate(row[2], "GMT+7", "yyyy-MM-dd");
            }

            return {
                id: idTs,
                waktu: waktuSistem,
                operator: row[1],
                tanggal: tanggalTerima,
                asal: row[3],
                nomor: row[4],
                perihal: row[5],
                ocr: row[6],
                link: row[7]
            };
        });

        return hasilMap.reverse().slice(0, 50); // Ambil 50 data terakhir terbaru
    } catch (e) {
        console.error("Error dapatkanRiwayatSuratMasuk: " + e.toString());
        return [];
    }
}

/**
 * ARSIP: Menghapus baris log arsip tertentu
 */
function hapusDataArsip(timestampId, nomor) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_LOG);
        const data = sheet.getDataRange().getValues();

        for (let i = data.length - 1; i >= 1; i--) {
            let currentTs = data[i][0] instanceof Date ? data[i][0].getTime() : data[i][0];
            if (String(currentTs) === String(timestampId) && data[i][3] === nomor) {
                sheet.deleteRow(i + 1);
                return { status: "SUCCESS", message: "Catatan arsip berhasil dihapus secara permanen." };
            }
        }
        return { status: "FAILED", message: "Data arsip tidak ditemukan." };
    } catch (e) {
        return { status: "ERROR", message: "Kesalahan server: " + e.toString() };
    }
}

/**
 * VERIFIKASI: Mengambil data surat berdasarkan Unique ID (SID) untuk halaman publik
 */
function verifikasiSuratByUid(uid) {
    try {
        if (!uid) return { status: "ERROR", message: "ID Verifikasi tidak disertakan." };

        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_LOG);
        if (!sheet) return { status: "ERROR", message: "Sheet Log_Surat tidak ditemukan." };

        const targetUid = String(uid).trim();
        // Cari di kolom Serial_ID (Kolom K / 11) menggunakan TextFinder
        const textFinder = sheet.getRange("K:K").createTextFinder(targetUid).matchEntireCell(true);
        const cell = textFinder.findNext();

        if (cell) {
            const rowNum = cell.getRow();
            const rowValues = sheet.getRange(rowNum, 1, 1, 13).getValues()[0];
            const config = ambilPengaturan() || {};

            return {
                status: "SUCCESS",
                no: rowValues[3],
                hal: rowValues[4],
                ttd: config.Ttd_Nama_1 || rowValues[1] || "Kepala Sekolah",
                sid: rowValues[10],
                tanggal: rowValues[2] instanceof Date ? Utilities.formatDate(rowValues[2], "GMT+7", "dd/MM/yyyy") : rowValues[2]
            };
        }
        return { status: "NOT_FOUND", message: "Data tidak ditemukan di pangkalan data pusat." };
    } catch (e) {
        return { status: "ERROR", message: e.toString() };
    }
}

/**
 * ARSIP: Mengambil data Log_Surat dan memformatnya untuk Agenda Excel
 * Filter berdasarkan Tahun dan Header sesuai permintaan.
 */
function ambilDataArsipUntukEkspor(tahun) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheetLog = ss.getSheetByName(SHEET_LOG);
        const sheetSetting = ss.getSheetByName(SHEET_PENGATURAN);

        if (!sheetLog) throw new Error("Sheet Log_Surat tidak ditemukan.");

        // Ambil Nama Sekolah untuk kolom "Dari"
        let schoolName = "SDN Mojogemi 02";
        if (sheetSetting) {
            const settings = sheetSetting.getDataRange().getValues();
            const nameRow = settings.find(r => r[0] === "Kop_Sekolah");
            if (nameRow) schoolName = nameRow[1];
        }

        const data = sheetLog.getDataRange().getValues();
        if (data.length <= 1) return [];

        const filteredRows = data.slice(1).filter(row => {
            const noSurat = String(row[3] || "");
            const parts = noSurat.split('/');
            const yearInNo = parts.length > 0 ? parts[parts.length - 1] : "";

            // Cek tahun dari nomor surat (format: .../2026)
            return yearInNo === String(tahun);
        });

        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        return filteredRows.map(row => {
            let tglRaw = row[2];
            let hariTanggal = "-";

            // Pastikan tglRaw diubah menjadi objek Date agar getDay() bekerja
            let d = (tglRaw instanceof Date) ? tglRaw : new Date(tglRaw);

            if (!isNaN(d.getTime())) {
                hariTanggal = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }

            const noSurat = String(row[3] || "");
            const partsNo = noSurat.split('/');
            const kodeKlasifikasi = partsNo[0] || "-";

            // Mengambil nomor urut sampai akhir (membuang kode klasifikasi di awal)
            // Contoh: 400.3.5/001/.../2026 -> 001/.../2026
            const noSuratTanpaKlasifikasi = partsNo.slice(1).join('/');

            return {
                "Hari, Tanggal": hariTanggal,
                "No Surat": noSuratTanpaKlasifikasi || noSurat,
                "Perihal": row[4] || "-",
                "Kode Klasifikasi Surat": kodeKlasifikasi,
                "Dari Siapa (Dari)": schoolName,
                "Untuk Siapa (Ke)": row[5] || "-",
                "Tembusan": row[9] || "-"
            };
        });
    } catch (e) { throw new Error(e.toString()); }
}

/**
 * ARSIP: Mengambil data Log_Surat_Masuk dan memformatnya untuk Agenda Excel
 * Filter berdasarkan Tahun.
 */
function ambilDataSuratMasukUntukEkspor(tahun) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheetLog = ss.getSheetByName(SHEET_LOG_MASUK);

        if (!sheetLog) throw new Error("Sheet Log_Surat_Masuk tidak ditemukan.");

        const data = sheetLog.getDataRange().getValues();
        if (data.length <= 1) return [];

        const targetTahun = String(tahun);
        const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        // Filter baris berdasarkan tahun dari kolom Tanggal_Terima (Indeks 2)
        const filteredRows = data.slice(1).filter(row => {
            let tglRaw = row[2];
            let d = (tglRaw instanceof Date) ? tglRaw : new Date(tglRaw);
            return !isNaN(d.getTime()) && String(d.getFullYear()) === targetTahun;
        });

        return filteredRows.map(row => {
            let tglRaw = row[2];
            let hariTanggal = "-";
            let d = (tglRaw instanceof Date) ? tglRaw : new Date(tglRaw);

            if (!isNaN(d.getTime())) {
                hariTanggal = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }

            return {
                "Hari, Tanggal Terima": hariTanggal,
                "Asal Surat (Dari)": row[3] || "-",
                "Nomor Surat Asal": row[4] || "-",
                "Perihal": row[5] || "-",
                "Diterima Oleh": row[1] || "-",
                "Link Dokumen": row[7] || "-"
            };
        });
    } catch (e) { throw new Error(e.toString()); }
}

/**
 * Validasi: Cek apakah string nomor surat lengkap sudah digunakan dalam database
 */
function cekFullNomorDuplikat(nomorFull) {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_LOG);
        if (!sheet) return false;
        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return false;
        const data = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
        const target = String(nomorFull || "").replace(/\s+/g, '').toLowerCase();
        for (let i = 0; i < data.length; i++) {
            const val = String(data[i][0] || "").replace(/\s+/g, '').toLowerCase();
            if (val === target) {
                return true; // Duplikat ditemukan
            }
        }
        return false;
    } catch (e) {
        Logger.log("Error cekFullNomorDuplikat: " + e.toString());
        return false;
    }
}

/**
 * Validasi: Cek apakah nomor urut sudah digunakan dalam tahun berjalan
 */
function cekNomorDuplikat(urutanStr, tahun) {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_LOG);
        if (!sheet) return "ERROR";

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return "VALID";

        // OPTIMASI: Hanya ambil kolom Nomor Surat (Kolom D) untuk divalidasi
        const nomorData = sheet.getRange(1, 4, lastRow, 1).getValues();
        const targetUrutan = parseInt(urutanStr, 10);
        const targetTahun = String(tahun).trim();
        let urutanMaks = 0;

        for (let i = 1; i < nomorData.length; i++) {
            let nomorArsip = String(nomorData[i][0] || "");
            let parts = nomorArsip.split('/');
            if (parts.length >= 4 && parts[parts.length - 1] === targetTahun) {
                let u = parseInt(parts[1], 10);
                if (u === targetUrutan) return "DUPLICATE";
                if (u > urutanMaks) urutanMaks = u;
            }
        }

        if (targetUrutan > urutanMaks + 1) return "JUMP";

        return "VALID";
    } catch (e) {
        return "ERROR";
    }
}

/**
 * AUTO-NUMBER: Membuat nomor surat otomatis
 */
function generateNomorSuratOtomatis(kodeKlasifikasi) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000); // Tunggu hingga 10 detik jika ada proses lain
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_LOG);
        const lastRow = sheet.getLastRow();

        // OPTIMASI: Hanya ambil kolom Nomor Surat untuk mencari urutan terbesar
        const nomorData = lastRow > 1 ? sheet.getRange(2, 4, lastRow - 1, 1).getValues() : [];

        const config = ambilPengaturan() || {};
        let urutanTerakhir = 0;
        let tahunIni = new Date().getFullYear().toString();
        let npsnSekolah = String(config.NPSN_Sekolah || NPSN_SEKOLAH).replace(/\D/g, "") || NPSN_SEKOLAH;

        // Cari urutan terbesar di seluruh data log untuk tahun berjalan (Global Sequence)
        for (let i = 0; i < nomorData.length; i++) {
            let nomorArsip = String(nomorData[i][0] || "");
            let parts = nomorArsip.split('/');

            // Cek apakah format sesuai (KODE/URUTAN/NPSN/TAHUN) dan tahunnya cocok
            if (parts.length >= 4 && parts[parts.length - 1] === tahunIni) {
                let urutan = parseInt(parts[1], 10);
                if (!isNaN(urutan) && urutan > urutanTerakhir) {
                    urutanTerakhir = urutan;
                }
            }
        }

        let urutanStr = (urutanTerakhir + 1).toString().padStart(3, '0');
        let kodeProvinsi = String(config.Kode_Provinsi || "35").trim();
        let kodeKabupaten = String(config.Kode_Kabupaten || "09").trim();
        let kodeDinas = String(config.Kode_Dinas || "310").trim();
        let kodeKecamatan = String(config.Kode_Kecamatan || "24").trim();
        let npsnLengkap = `${kodeProvinsi}.${kodeKabupaten}.${kodeDinas}.${kodeKecamatan}.${npsnSekolah}`;
        return `${kodeKlasifikasi}/${urutanStr}/${npsnLengkap}/${tahunIni}`;
    } catch (e) {
        return `${kodeKlasifikasi}/001/35.09.310.24.${NPSN_SEKOLAH}/${new Date().getFullYear()}`;
    } finally {
        lock.releaseLock();
    }
}

/**
 * SETTINGS: Menyimpan Khusus Pengaturan Kop Surat (Dipanggil oleh Tombol Simpan Kop)
 */
function simpanPengaturanKop(dataKop) {
    return perbaruiDataPengaturanBatch(dataKop, "Konfigurasi Identitas");
}

/**
 * SETTINGS: Menyimpan Khusus Pengaturan TTD (Mendukung Multi-TTD hingga 3 Nama)
 */
function simpanPengaturanTtd(dataTtd) {
    return perbaruiDataPengaturanBatch(dataTtd, "Pengaturan 3 Tanda Tangan");
}

/**
 * HELPER: Fungsi internal untuk memperbarui data pengaturan secara batch (DRY)
 */
function perbaruiDataPengaturanBatch(dataMap, konteks) {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheetSetting = db.getSheetByName(SHEET_PENGATURAN);

        if (!sheetSetting) {
            return { status: "ERROR", message: "Sheet Pengaturan tidak ditemukan." };
        }

        const dataRange = sheetSetting.getDataRange().getValues();
        sheetSetting.getRange("A:B").setNumberFormat("@");

        const settingsMap = new Map(dataRange.map((row, index) => [String(row[0]).toLowerCase().trim(), index + 1]));

        for (let key in dataMap) {
            const searchKey = key.toLowerCase().trim();
            if (settingsMap.has(searchKey)) {
                const rowIndex = settingsMap.get(searchKey);
                sheetSetting.getRange(rowIndex, 2).setValue(String(dataMap[key] || ""));
            } else {
                const nextRow = sheetSetting.getLastRow() + 1;
                sheetSetting.getRange(nextRow, 1, 1, 2).setNumberFormat("@");
                sheetSetting.getRange(nextRow, 1, 1, 2).setValues([[String(key), String(dataMap[key] || "")]]);
                settingsMap.set(searchKey, nextRow);
            }
        }
        return { status: "SUCCESS", message: konteks + " berhasil diperbarui." };
    } catch (e) {
        return { status: "ERROR", message: "Gagal menyimpan " + konteks + ": " + e.toString() };
    }
}

/**
 * USERS: Memperbarui Username/Password/Nama user yang sedang login
 */
function perbaruiProfilUser(usernameLama, dataBaru) {
    try {
        const ss = dapatkanSpreadsheetHost();
        const sheet = ss.getSheetByName(SHEET_USERS);
        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === usernameLama) {
                // Kolom: Username (0), Password (1), Nama_Lengkap (2), Role (3)
                sheet.getRange(i + 1, 1).setValue(dataBaru.username);
                if (dataBaru.password) {
                    sheet.getRange(i + 1, 2).setValue(hashPassword(dataBaru.password));
                }
                sheet.getRange(i + 1, 3).setValue(dataBaru.nama);
                return { status: "SUCCESS", message: "Data profil berhasil diperbarui." };
            }
        }
        return { status: "FAILED", message: "User tidak ditemukan di database." };
    } catch (error) {
        return { status: "ERROR", message: error.toString() };
    }
}

/**
 * TEMPLATE: Batch import data template dari file JSON
 */
function imporTemplatesBatch(templates) {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheetTemplate = db.getSheetByName(SHEET_TEMPLATES);
        if (!sheetTemplate) return { status: "ERROR", message: "Sheet Database_Templates tidak ditemukan." };

        const existingData = sheetTemplate.getDataRange().getValues().map(r => r[0].toString().toLowerCase());

        const rowsToInsert = templates
            .filter(t => t.nama && !existingData.includes(t.nama.toLowerCase()))
            .map(t => [
                String(t.nama),
                String(t.tanggal || ""),
                String(t.nomor || ""),
                String(t.perihal || ""),
                String(t.penerima || ""),
                String(t.lampiran || "-"),
                String(t.pembuka || ""),
                String(t.isi || ""),
                String(t.tembusan || ""),
                String(t.layout || "standard")
            ]);

        if (rowsToInsert.length > 0) {
            sheetTemplate.getRange(sheetTemplate.getLastRow() + 1, 1, rowsToInsert.length, 10).setValues(rowsToInsert);
        }

        return { status: "SUCCESS", message: rowsToInsert.length + " template baru berhasil diimpor (Duplikasi dilewati)." };
    } catch (e) {
        return { status: "ERROR", message: "Gagal impor: " + e.toString() };
    }
}

/**
 * TEMPLATE: Menghapus seluruh data di sheet template (kecuali header)
 */
function hapusSemuaTemplate() {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheet = db.getSheetByName(SHEET_TEMPLATES);
        if (!sheet) return { status: "ERROR", message: "Sheet Database_Templates tidak ditemukan." };

        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
            sheet.deleteRows(2, lastRow - 1);
        }
        return { status: "SUCCESS", message: "Seluruh master template berhasil dihapus." };
    } catch (e) {
        return { status: "ERROR", message: "Gagal hapus: " + e.toString() };
    }
}

/**
 * TEMPLATE: Menghapus satu template tertentu berdasarkan nama
 */
function hapusTemplateSatu(nama) {
    try {
        const db = dapatkanSpreadsheetHost();
        const sheet = db.getSheetByName(SHEET_TEMPLATES);
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === String(nama).trim()) {
                sheet.deleteRow(i + 1);
                return { status: "SUCCESS", message: `Template '${nama}' berhasil dihapus.` };
            }
        }
        return { status: "FAILED", message: "Template tidak ditemukan." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * USERS: Mengambil semua daftar pengguna
 */
function ambilSemuaUser() {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_USERS);
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        return data.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
        });
    } catch (e) { return []; }
}

/**
 * USERS: Simpan atau Update User
 */
function simpanDatabaseUser(data) {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_USERS);
        const dataRaw = sheet.getDataRange().getValues();
        const usernameInput = String(data.Username).trim().toLowerCase();
        let targetRow = -1;
        let existingPassword = "";

        for (let i = 1; i < dataRaw.length; i++) {
            if (String(dataRaw[i][0]).trim().toLowerCase() === usernameInput) {
                targetRow = i + 1;
                existingPassword = dataRaw[i][1];
                break;
            }
        }

        let passwordToStore = data.Password;
        // Hash only if it's different from the existing password, or if it is a new user
        if (targetRow === -1 || passwordToStore !== existingPassword) {
            passwordToStore = hashPassword(passwordToStore);
        }

        const rowData = [data.Username, passwordToStore, data.Nama_Lengkap, data.Role];
        if (targetRow !== -1) {
            sheet.getRange(targetRow, 1, 1, 4).setValues([rowData]);
            return { status: "SUCCESS", message: "User '" + data.Username + "' diperbarui." };
        } else {
            sheet.appendRow(rowData);
            return { status: "SUCCESS", message: "User '" + data.Username + "' ditambahkan." };
        }
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * USERS: Hapus User
 */
function hapusUserDatabase(username) {
    try {
        const sheet = dapatkanSpreadsheetHost().getSheetByName(SHEET_USERS);
        const data = sheet.getDataRange().getValues();
        const uInput = String(username).trim().toLowerCase();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim().toLowerCase() === uInput) {
                if (uInput === "admin") return { status: "ERROR", message: "User Admin utama tidak boleh dihapus!" };
                sheet.deleteRow(i + 1);
                return { status: "SUCCESS", message: "User berhasil dihapus." };
            }
        }
        return { status: "ERROR", message: "User tidak ditemukan." };
    } catch (e) { return { status: "ERROR", message: e.toString() }; }
}

/**
 * FUNGSI DUMMY UNTUK MEMANCING IZIN GOOGLE DOCS (DOCUMENTAPP)
 * Jalankan fungsi ini sekali saja di editor Apps Script untuk memicu dialog otorisasi.
 */
function pancingOtorisasiDocs() {
    const docTemp = DocumentApp.create("pancingan");
    Logger.log("Dokumen pancingan sukses dibuat: " + docTemp.getUrl());
    DriveApp.getFileById(docTemp.getId()).setTrashed(true); // Langsung buang ke tempat sampah
    Logger.log("Dokumen pancingan dipindahkan ke trash.");
}