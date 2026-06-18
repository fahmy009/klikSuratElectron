let modeTtdAktif = "kanan-bawah";
let userSessionName = "Guest";
let userSessionUsername = "guest";
window.cacheTemplates = [];
window.cacheArsip = [];
window.cacheKodeKlasifikasi = [];
window.selectedSiswa = null;
window.selectedSiswaList = [];
window.fullCacheSiswa = [];
window.fullCacheGuru = [];
window.selectedGuru = null;
window.selectedGuruList = [];
window.isBatchMode = false;
window.isBatchModeGuru = false;
window.configPejabat = {};
let mobileViewMode = "editor"; // 'editor' atau 'preview'

function getLogoWithCacheBuster(logoPath) {
    if (!logoPath) return "";
    if (logoPath.startsWith('data:') || logoPath.includes('http://') || logoPath.includes('https://')) return logoPath;
    const separator = logoPath.includes('?') ? '&' : '?';
    return `${logoPath}${separator}t=${Date.now()}`;
}

// =============================================================
// PENGAMAN CETAK: HANYA DOKUMEN YANG SUDAH DIARSIPKAN
// =============================================================
function normalizeArchiveText(value) {
    return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeArchiveDate(value) {
    const normalized = normalizeArchiveText(value);
    return normalized.includes("T") ? normalized.split("T")[0] : normalized;
}

function getCurrentDraftArchivePayload() {
    const getVal = (id, fallback = "") => document.getElementById(id)?.value ?? fallback;
    return {
        nomor: normalizeArchiveText(getVal('in_nomor')),
        tanggal: normalizeArchiveDate(getVal('in_tanggal')),
        perihal: normalizeArchiveText(getVal('in_perihal')),
        penerima: normalizeArchiveText(getVal('in_penerima')),
        lampiran: normalizeArchiveText(getVal('in_lampiran')),
        pembuka: normalizeArchiveText(getVal('in_pembuka')),
        isi: normalizeArchiveText(document.getElementById('in_isi')?.value || ""),
        tembusan: normalizeArchiveText(getVal('in_tembusan')),
        serial_id: normalizeArchiveText(getVal('in_serial_id')),
        layout: getVal('in_layout_type', 'standard')
    };
}

function normalizeArchivePayload(record = {}) {
    return {
        nomor: normalizeArchiveText(record.nomor),
        tanggal: normalizeArchiveDate(record.tanggal),
        perihal: normalizeArchiveText(record.perihal),
        penerima: normalizeArchiveText(record.penerima),
        lampiran: normalizeArchiveText(record.lampiran),
        pembuka: normalizeArchiveText(record.pembuka),
        isi: normalizeArchiveText(record.isi),
        tembusan: normalizeArchiveText(record.tembusan),
        serial_id: normalizeArchiveText(record.sid || record.serial_id),
        layout: record.layout || 'standard'
    };
}

function getArchiveSignature(payload) {
    return JSON.stringify(normalizeArchivePayload(payload));
}

function isCurrentDraftArchived() {
    const targetSignature = getArchiveSignature(getCurrentDraftArchivePayload());
    const arsip = Array.isArray(window.cacheArsip) ? window.cacheArsip : [];
    return arsip.some((row) => getArchiveSignature(row) === targetSignature);
}

function syncArchiveStatusUI() {
    const statusWrap = document.getElementById('print-archive-status');
    const statusIcon = document.getElementById('print-status-icon');
    const statusBadge = document.getElementById('print-status-badge');
    const statusText = document.getElementById('print-status-text');
    const printButton = document.getElementById('btn-cetak-surat');
    const pdfButton = document.getElementById('btn-cetak-pdf');

    if (!statusWrap || !statusIcon || !statusBadge || !statusText || !printButton) {
        return;
    }

    const isArchived = isCurrentDraftArchived();

    if (isArchived) {
        statusWrap.className = 'mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10';
        statusIcon.className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100';
        statusIcon.innerHTML = '<i class="fa-solid fa-circle-check text-sm"></i>';
        statusBadge.className = 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100';
        statusBadge.textContent = 'ARSIP TERSIMPAN';
        statusText.textContent = 'Surat sudah tercatat dan siap diverifikasi melalui scan.';
        
        printButton.disabled = false;
        printButton.classList.remove('opacity-50', 'cursor-not-allowed');
        printButton.classList.add('shadow-md');
        printButton.title = 'Cetak surat sekarang';
        printButton.setAttribute('aria-disabled', 'false');
        
        if (pdfButton) {
            pdfButton.disabled = false;
            pdfButton.classList.remove('opacity-50', 'cursor-not-allowed');
            pdfButton.classList.add('shadow-md');
            pdfButton.title = 'Simpan sebagai PDF sekarang';
            pdfButton.setAttribute('aria-disabled', 'false');
        }
    } else {
        statusWrap.className = 'mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10';
        statusIcon.className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100';
        statusIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-sm"></i>';
        statusBadge.className = 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/20 dark:text-amber-100';
        statusBadge.textContent = 'ARSIP BELUM SIAP';
        statusText.textContent = 'Simpan data terlebih dahulu agar surat dapat diverifikasi setelah dicetak.';
        
        printButton.disabled = true;
        printButton.classList.add('opacity-50', 'cursor-not-allowed');
        printButton.classList.remove('shadow-md');
        printButton.title = 'Arsipkan surat terlebih dahulu untuk mencetak';
        printButton.setAttribute('aria-disabled', 'true');
        
        if (pdfButton) {
            pdfButton.disabled = true;
            pdfButton.classList.add('opacity-50', 'cursor-not-allowed');
            pdfButton.classList.remove('shadow-md');
            pdfButton.title = 'Arsipkan surat terlebih dahulu untuk menyimpan PDF';
            pdfButton.setAttribute('aria-disabled', 'true');
        }
    }
}

// =============================================================
// INTERFAKS DAN MANAJEMEN SESI LOGIN
// =============================================================
function handleLogin(e) {
    e.preventDefault();
    setLoading(true, "Memvalidasi Keamanan...");
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    // [MODIFIKASI ELECTRON] Menggunakan ipcRenderer via preload
    window.electronAPI.prosesLogin(u, p)
        .then(function (res) {
            setLoading(false);
            if (res && res.status === "SUCCESS") {
                const dataSesi = { terautentikasi: true, nama: res.nama, role: res.role, username: res.username };
                localStorage.setItem("kliksurat_sd_session", JSON.stringify(dataSesi));
                aktifkanSesiDashboard(res.nama, res.role, res.username);
                if (typeof tampilkanToast === "function") tampilkanToast("success", "AKSES DIBERIKAN", "Selamat datang kembali, " + res.nama);
            } else {
                if (typeof tampilkanToast === "function") tampilkanToast("error", "AKSES DITOLAK", res ? res.message : "Terjadi kesalahan sistem.");
            }
        })
        .catch(function (err) {
            setLoading(false);
            if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR SERVER", err.toString());
        });
}

function aktifkanSesiDashboard(nama, role, username) {
    userSessionName = nama;
    userSessionUsername = username;
    const userProfile = document.getElementById('user-profile');
    if (userProfile) userProfile.innerHTML = `<i class="fa fa-user-circle"></i> ${nama}`;

    // ROLE BASED ACCESS CONTROL (RBAC)
    const isGuru = (role === "Guru");
    const btnSettings = document.getElementById('btn-open-settings');
    const tabKop = document.getElementById('btn-tab-kop');
    const tabTtd = document.getElementById('btn-tab-ttd');
    const tabContainer = document.getElementById('sidebar-tabs');

    if (btnSettings) btnSettings.classList.toggle('hidden', isGuru);
    if (tabKop) tabKop.classList.toggle('hidden', isGuru);
    if (tabTtd) tabTtd.classList.toggle('hidden', isGuru);

    if (tabContainer) {
        if (isGuru) {
            tabContainer.classList.replace('grid-cols-5', 'grid-cols-3');
        } else {
            tabContainer.classList.replace('grid-cols-3', 'grid-cols-5');
        }
    }

    if (!isGuru && btnSettings) {
        btnSettings.classList.remove('hidden');
    }

    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-dashboard').classList.remove('hidden');
    muatAwalSeluruhKonfigurasi();
}

function periksaSesiLoginOtomatis() {
    const dataLokal = localStorage.getItem("kliksurat_sd_session");
    if (dataLokal) {
        try {
            const sesi = JSON.parse(dataLokal);
            if (sesi && sesi.terautentikasi && sesi.username) {
                aktifkanSesiDashboard(sesi.nama, sesi.role, sesi.username);
                return;
            } else {
                localStorage.removeItem("kliksurat_sd_session");
            }
        } catch (err) {
            localStorage.removeItem("kliksurat_sd_session");
        }
    }
    setLoading(false);
}

function handleLogout() {
    Swal.fire({
        title: 'Yakin Ingin Keluar?',
        text: "Sesi kerja Anda akan diakhiri. Pastikan semua data penting telah disimpan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa fa-sign-out-alt"></i> Ya, Keluar',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            prosesLogoutSistem(true);
        }
    });
}

function prosesLogoutSistem(withNotification = false) {
    setLoading(true, "Mengakhiri sesi...");

    setTimeout(() => {
        localStorage.removeItem("kliksurat_sd_session");
        userSessionName = "";
        userSessionUsername = "";

        const modals = ['modal-profile', 'modal-settings', 'modal-siswa', 'modal-guru', 'modal-about', 'modal-cropper'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const pwd = document.getElementById('password');
        if (pwd) pwd.value = "";

        setLoading(false);

        const dashboard = document.getElementById('main-dashboard');
        const loginPage = document.getElementById('login-page');

        if (dashboard) dashboard.classList.add('hidden');
        if (loginPage) loginPage.classList.remove('hidden');

        if (withNotification) {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Keluar',
                text: 'Sesi aman Anda telah ditutup.',
                confirmButtonColor: '#0284c7',
                timer: 1500,
                showConfirmButton: false
            });
        }
    }, 700);
}

// =============================================================
// SINKRONISASI DATABASE & KONFIGURASI KERTAS
// =============================================================
function muatAwalSeluruhKonfigurasi(silent = false) {
    if (typeof applySavedTheme === "function") applySavedTheme();

    if (!silent) setLoading(true, "Sinkronisasi Database...");

    // [MODIFIKASI ELECTRON] Load config pakai IPC Renderer
    window.electronAPI.ambilPengaturan()
        .then(function (config) {
            if (!silent) setLoading(false);
            if (!config) return;

            // [LOG DEBUG] Untuk membantu pengecekan data
            console.log("=== [DEBUG] DATA PENGATURAN DARI DATABASE ===");
            console.log("Data yang diterima Frontend:", config);
            console.log("=============================================");



            if (document.getElementById('set_app_name')) document.getElementById('set_app_name').value = config.App_Name || "KlikSurat";
            if (document.getElementById('set_npsn_sekolah')) document.getElementById('set_npsn_sekolah').value = config.NPSN_Sekolah || "";
            if (document.getElementById('set_kode_provinsi')) document.getElementById('set_kode_provinsi').value = config.Kode_Provinsi || "35";
            if (document.getElementById('set_kode_kabupaten')) document.getElementById('set_kode_kabupaten').value = config.Kode_Kabupaten || "09";
            if (document.getElementById('set_kode_dinas')) document.getElementById('set_kode_dinas').value = config.Kode_Dinas || "310";
            if (document.getElementById('set_kode_kecamatan')) document.getElementById('set_kode_kecamatan').value = config.Kode_Kecamatan || "24";

            if (document.getElementById('in_kop_daerah')) document.getElementById('in_kop_daerah').value = config.Kop_Daerah || "";
            if (document.getElementById('in_kop_sub')) document.getElementById('in_kop_sub').value = config.Kop_Sub || config.Kop_Sub_Dinas || "";
            if (document.getElementById('in_kop_sekolah')) document.getElementById('in_kop_sekolah').value = config.Kop_Sekolah || "";
            if (document.getElementById('in_kop_alamat')) document.getElementById('in_kop_alamat').value = config.Kop_Alamat || "";
            if (document.getElementById('in_kop_kontak')) document.getElementById('in_kop_kontak').value = config.Kop_Kontak || "";

            if (document.getElementById('in_ttd_frasa_tanggal')) document.getElementById('in_ttd_frasa_tanggal').value = config.Ttd_Frasa_Tanggal || "Pada Tanggal";
            if (document.getElementById('in_logo_kiri')) document.getElementById('in_logo_kiri').value = config.Logo_Kiri_Url || "";
            if (document.getElementById('in_ttd_foto')) document.getElementById('in_ttd_foto').checked = (config.Ttd_Gunakan_Foto === "YA");
            if (document.getElementById('in_logo_kanan')) document.getElementById('in_logo_kanan').value = config.Logo_Kanan_Url || "";
            if (document.getElementById('in_ttd_ks')) document.getElementById('in_ttd_ks').value = config.Ttd_Ks_Url || "";
            if (document.getElementById('in_tampil_ttd_ks')) document.getElementById('in_tampil_ttd_ks').checked = (config.Ttd_Gunakan_Ttd_Ks === "YA");
            if (document.getElementById('in_geser_ttd_x')) {
                const shiftX = config.Ttd_Geser_X_Ks || "0";
                document.getElementById('in_geser_ttd_x').value = shiftX;
                if (document.getElementById('val_geser_ttd_x')) document.getElementById('val_geser_ttd_x').innerText = shiftX;
            }
            const currentLogo = config.Logo_Kanan_Url || config.Logo_Kiri_Url || globalLogo || "";
            const appName = config.App_Name || globalAppName || "KlikSurat";
            if (typeof refreshUIIdentity === "function") {
                refreshUIIdentity(appName, currentLogo);
            }
            if (document.getElementById('in_layout_type')) document.getElementById('in_layout_type').value = config.Layout_Type || "standard";
            if (document.getElementById('in_ukuran_kertas')) document.getElementById('in_ukuran_kertas').value = config.Ukuran_Kertas || "size-f4";
            if (document.getElementById('in_pilihan_font')) document.getElementById('in_pilihan_font').value = config.Pilihan_Font || "font-serif-official";
            if (document.getElementById('in_line_spacing')) document.getElementById('in_line_spacing').value = config.Line_Spacing || "1.6";

            ['atas', 'bawah', 'kiri', 'kanan'].forEach(k => {
                const el = document.getElementById(`in_margin_${k}`);
                if (el) el.value = config[`Margin_${k.charAt(0).toUpperCase() + k.slice(1)}`] || "20";
            });
            if (document.getElementById('in_satuan_margin')) document.getElementById('in_satuan_margin').value = config.Satuan_Margin || "mm";

            if (document.getElementById('in_ttd_frasa_ditetapkan')) document.getElementById('in_ttd_frasa_ditetapkan').value = config.Ttd_Frasa_Ditetapkan || "Ditetapkan di";
            if (document.getElementById('in_ttd_height')) {
                const h = config.Ttd_Height || "80";
                document.getElementById('in_ttd_height').value = h;
                document.getElementById('val_ttd_height').innerText = h;
            }
            if (document.getElementById('in_ttd_materai')) document.getElementById('in_ttd_materai').checked = (config.Ttd_Gunakan_Materai === "YA");

            [1, 2, 3].forEach(n => {
                const frasaEl = document.getElementById(`p${n}_frasa`);
                if (n > 1 && frasaEl) frasaEl.value = config[`Ttd_Frasa_${n}`] || "";
                ['jabatan', 'nama', 'pangkat', 'nip'].forEach(p => {
                    const el = document.getElementById(`p${n}_${p}`);
                    if (el) el.value = config[`Ttd_${p.charAt(0).toUpperCase() + p.slice(1)}_${n}`] || "";
                });
            });

            if (typeof loadKoleksiDatabase === "function") loadKoleksiDatabase();
            if (typeof muatDataArsip === "function") muatDataArsip();
            if (typeof loadKodeKlasifikasiSurat === "function") loadKodeKlasifikasiSurat();
            if (typeof muatTabelSiswa === "function") muatTabelSiswa();
            if (typeof muatTabelGuru === "function") muatTabelGuru();
            if (typeof muatDataMasuk === "function") muatDataMasuk();

            sinkronisasiLayoutKonfigurasi();
            if (typeof ubahModeLayoutTtd === "function") ubahModeLayoutTtd(config.Ttd_Mode_Aktif || "kanan-bawah");

            const printArea = document.getElementById('print-area');
            if (printArea) printArea.dataset.pageCount = "0";

            if (typeof mintaNomorOtomatis === "function") mintaNomorOtomatis();

            const tglMasukInput = document.getElementById('in_masuk_tanggal');
            if (tglMasukInput) {
                const now = new Date();
                tglMasukInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }

            stabilkanLivePreviewSetelahLayout();
        })
        .catch(function (err) {
            setLoading(false);
            console.error("Gagal sinkronisasi data awal:", err);
            if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR SISTEM", "Gagal memuat konfigurasi awal.");
        });
}

function sinkronisasiLayoutKonfigurasi() {
    const size = document.getElementById('in_ukuran_kertas')?.value || "size-f4";
    const mt = document.getElementById('in_margin_atas')?.value || 20;
    const mb = document.getElementById('in_margin_bawah')?.value || 20;
    const ml = document.getElementById('in_margin_kiri')?.value || 25;
    const mr = document.getElementById('in_margin_kanan')?.value || 20;
    const satuan_val = document.getElementById('in_satuan_margin')?.value || "mm";

    const mBox = document.getElementById('measurement-box');
    if (mBox) {
        mBox.style.width = (size === 'size-f4') ? "215mm" : "210mm";
        mBox.style.padding = `${mt}${satuan_val} ${mr}${satuan_val} ${mb}${satuan_val} ${ml}${satuan_val}`;
        mBox.style.fontFamily = document.getElementById('in_pilihan_font')?.value === 'font-serif-official' ? 'Times New Roman' : 'Arial';
        mBox.style.fontSize = document.getElementById('in_ukuran_font')?.value || '12pt';
    }

    let printStyle = document.getElementById('dynamic-print-style');
    if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'dynamic-print-style';
        document.head.appendChild(printStyle);
    }

    const sheetW = size === 'size-f4' ? '215mm' : '210mm';
    const sheetH = size === 'size-f4' ? '330mm' : '297mm';
    const innerH = `calc(${sheetH} - ${mt}${satuan_val} - ${mb}${satuan_val})`;

    document.documentElement.style.setProperty('--sheet-width', sheetW);
    document.documentElement.style.setProperty('--sheet-height', sheetH);
    document.documentElement.style.setProperty('--inner-height', innerH);

    let ukuranFisikKertas = (size === 'size-f4') ? '215mm 330mm' : 'A4';
    printStyle.innerHTML = `@media print { @page { size: ${ukuranFisikKertas}; margin: 0 !important; } }`;

    if (typeof updateLivePreview === "function") updateLivePreview();
    window.requestAnimationFrame(() => {
        if (typeof updateLivePreview === "function") updateLivePreview();
    });
    stabilkanLivePreviewSetelahLayout();
}

// =============================================================
// LIVE PREVIEW ENGINE (SINKRONISASI FORM KE KERTAS)
// =============================================================
let webAppUrl = "";
let lastSidForShortening = "";
let shortUrlCache = "";
let qrPreviewCache = { text: "", src: "" };
let livePreviewStabilizerTimer = null;

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function siapkanDanCetak() {
    if (typeof menjalankanUpdatePreviewLangsung === "function") menjalankanUpdatePreviewLangsung();
    setLoading(true, "Menyiapkan Printer...");
    setTimeout(() => {
        setLoading(false);
        cetakPreviewTerisolasi();
    }, 450);
}

function siapkanDanPdf() {
    if (typeof menjalankanUpdatePreviewLangsung === "function") menjalankanUpdatePreviewLangsung();
    setLoading(true, "Mengekspor ke PDF...");
    
    // Hapus clone QR Code (jika ada duplicate dari pembuatan lib)
    document.querySelectorAll('#print-area #qrcode').forEach((qrBox) => {
        const qrImages = Array.from(qrBox.querySelectorAll('canvas, img'));
        qrImages.slice(1).forEach(el => el.remove());
    });

    setTimeout(() => {
        const namaSurat = document.getElementById('val_klasifikasi_nama')?.innerText || "Surat_Dinas";
        const nomorSurat = document.getElementById('preview_nomor_surat')?.innerText.replace(/[\/\\]/g, '_') || Date.now();
        const defaultName = `${namaSurat}_${nomorSurat}.pdf`;
        
        window.electronAPI.simpanSebagaiPdf(defaultName).then(res => {
            setLoading(false);
            if (res && res.status === 'SUCCESS') {
                if (typeof tampilkanToast === "function") tampilkanToast("success", "BERHASIL", `PDF berhasil disimpan`);
            } else if (res && res.status === 'CANCELED') {
                // User membatalkan dialog
            } else {
                if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", "Gagal menyimpan PDF: " + (res ? res.message : ''));
            }
        }).catch(err => {
            setLoading(false);
            if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString());
        });
    }, 450);
}

function cetakPreviewTerisolasi() {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
        window.print();
        return;
    }

    const clonedPrintArea = printArea.cloneNode(true);
    clonedPrintArea.querySelectorAll('#qrcode').forEach((qrBox) => {
        const qrImages = Array.from(qrBox.querySelectorAll('canvas, img'));
        qrImages.slice(1).forEach(el => el.remove());
    });

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();

    const content = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Cetak Surat</title>
  <style>
    :root {
      --sheet-width: ${getComputedStyle(document.documentElement).getPropertyValue('--sheet-width') || '210mm'};
      --sheet-height: ${getComputedStyle(document.documentElement).getPropertyValue('--sheet-height') || '297mm'};
      --inner-height: ${getComputedStyle(document.documentElement).getPropertyValue('--inner-height') || 'calc(297mm - 20mm - 20mm)'};
      --line-spacing: ${document.getElementById('in_line_spacing')?.value || '1.6'};
    }
    @page { size: var(--sheet-width) var(--sheet-height); margin: 0 !important; }
    * { box-sizing: border-box; overflow-wrap: anywhere; word-wrap: break-word; tab-size: 4; }
    body { margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .preview-rich-content { white-space: pre-wrap !important; line-height: var(--line-spacing) !important; }
    .page-sheet { width: var(--sheet-width) !important; height: var(--sheet-height) !important; overflow: hidden !important; break-after: page !important; page-break-after: always !important; }
    .page-sheet:last-child { break-after: auto !important; page-break-after: auto !important; }
    .content-wrapper { height: var(--inner-height) !important; overflow: hidden !important; }
    /* Memuat full CSS di dalam iframe bisa menggunakan rel link jika dirouting dengan baik, namun untuk keamanan cetak kita sisipkan CSS dasar */
  </style>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>${clonedPrintArea.outerHTML}</body>
</html>`;

    frameDoc.write(content);
    frameDoc.close();

    const runPrint = () => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => printFrame.remove(), 1000);
    };
    setTimeout(runPrint, 700);
}

function updateLivePreview() {
    if (typeof menjalankanUpdatePreviewLangsung === "function") menjalankanUpdatePreviewLangsung();
    if (typeof syncArchiveStatusUI === 'function') syncArchiveStatusUI();
}

function stabilkanLivePreviewSetelahLayout() {
    clearTimeout(livePreviewStabilizerTimer);
    const rerender = () => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (typeof menjalankanUpdatePreviewLangsung === "function") menjalankanUpdatePreviewLangsung();
            });
        });
    };
    livePreviewStabilizerTimer = setTimeout(rerender, 300);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(rerender).catch(() => { });
    }
}

let editorReady = false;
function initTinyMCEEditor() {
    if (typeof tinymce === 'undefined') return;
    tinymce.init({
        selector: '#quill-isi',
        license_key: 'gpl',
        height: 400,
        menubar: false,
        plugins: 'table lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media help wordcount',
        toolbar: 'undo redo | blocks | fontfamily fontsize | bold italic underline forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table link image | removeformat code',
        toolbar_mode: 'wrap',
        promotion: false,
        branding: false,
        content_style: 'body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.6; }',
        setup: function (editor) {
            editor.addShortcut('ctrl+s', 'Simpan Data', function () { if (typeof prosesSimpanData === "function") prosesSimpanData(); });
            editor.on('init', function () {
                editorReady = true;
                const savedVal = document.getElementById('in_isi').value;
                if (savedVal) editor.setContent(savedVal);
            });
            editor.on('keydown', function (e) {
                if (e.keyCode === 9) { // Tab key shortcut
                    if (e.shiftKey) { editor.execCommand('Outdent'); }
                    else { editor.execCommand('Indent'); }
                    e.preventDefault(); e.stopPropagation();
                }
            });
            editor.on('change input undo redo', function () {
                document.getElementById('in_isi').value = editor.getContent();
                updateLivePreview();
            });
        },
        font_family_formats: 'Arial=arial,helvetica,sans-serif; Times New Roman=times new roman,times,serif; Courier New=courier new,courier,monospace;',
        table_appearance_options: true,
        table_resize_bars: true,
        table_default_attributes: { border: '0' }
    });
}

function setIsiEditorValue(value) {
    const hiddenField = document.getElementById('in_isi');
    if (!hiddenField) return;
    hiddenField.value = value || '';
    if (editorReady && tinymce.get('quill-isi')) tinymce.get('quill-isi').setContent(value || '');
}

// =============================================================
// SHORTCUT KEYBOARD GLOBAL & ENGINE VARIABLE RESOLVER
// =============================================================
document.addEventListener('keydown', function (e) {
    // Shortcut Ctrl+S atau Cmd+S untuk Simpan Data
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (typeof prosesSimpanData === "function") prosesSimpanData();
    }
});

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function resolveVariables(text) {
    if (!text) return "";
    let result = text;

    const toProperCase = (str) => {
        if (!str || typeof str !== 'string') return str;
        return str.toLowerCase().replace(/(^|\s)\S/g, (L) => L.toUpperCase());
    };

    const getTtdLive = (id, key, fallback) => {
        const val = document.getElementById(id)?.value;
        return (val && val.trim() !== "") ? val : (window.configPejabat[key] || fallback);
    };

    // Pejabat 1, 2, 3
    result = result.replace(/{{nama_ks}}/g, getTtdLive('p1_nama', 'nama', ".................."));
    result = result.replace(/{{nip_ks}}/g, getTtdLive('p1_nip', 'nip', ".................."));
    result = result.replace(/{{jabatan_ks}}/g, toProperCase(getTtdLive('p1_jabatan', 'jabatan', "Kepala Sekolah")));
    result = result.replace(/{{pangkat_ks}}/g, getTtdLive('p1_pangkat', 'pangkat', ""));
    result = result.replace(/{{nama_p2}}/g, getTtdLive('p2_nama', 'Ttd_Nama_2', ".................."));
    result = result.replace(/{{nip_p2}}/g, getTtdLive('p2_nip', 'Ttd_Nip_2', ".................."));
    result = result.replace(/{{jabatan_p2}}/g, toProperCase(getTtdLive('p2_jabatan', 'Ttd_Jabatan_2', "")));
    result = result.replace(/{{pangkat_p2}}/g, getTtdLive('p2_pangkat', 'Ttd_Pangkat_2', ""));
    result = result.replace(/{{frasa_p2}}/g, getTtdLive('p2_frasa', 'Ttd_Frasa_2', ""));
    result = result.replace(/{{nama_p3}}/g, getTtdLive('p3_nama', 'Ttd_Nama_3', ".................."));
    result = result.replace(/{{nip_p3}}/g, getTtdLive('p3_nip', 'Ttd_Nip_3', ".................."));
    result = result.replace(/{{jabatan_p3}}/g, toProperCase(getTtdLive('p3_jabatan', 'Ttd_Jabatan_3', "")));
    result = result.replace(/{{pangkat_p3}}/g, getTtdLive('p3_pangkat', 'Ttd_Pangkat_3', ""));
    result = result.replace(/{{frasa_p3}}/g, getTtdLive('p3_frasa', 'Ttd_Frasa_3', ""));

    // Variabel Siswa
    const s = window.selectedSiswa || {};
    result = result.replace(/{{nama_siswa}}/g, s.Nama || "..................");
    result = result.replace(/{{nisn}}/g, s.NISN || "..................");
    result = result.replace(/{{nis}}/g, s.NIS || "..................");
    result = result.replace(/{{tempat_lahir}}/g, toProperCase(s.Tempat_Lahir || ".................."));
    result = result.replace(/{{tanggal_lahir}}/g, typeof formatTanggalIndo === "function" ? formatTanggalIndo(s.Tanggal_Lahir) : (s.Tanggal_Lahir || ".................."));
    result = result.replace(/{{dusun}}/g, toProperCase(s.Dusun || ".................."));
    result = result.replace(/{{desa}}/g, toProperCase(s.Desa || ".................."));
    result = result.replace(/{{rt}}/g, s.RT || "...");
    result = result.replace(/{{rw}}/g, s.RW || "...");
    result = result.replace(/{{kecamatan}}/g, toProperCase(s.Kecamatan || ".................."));
    result = result.replace(/{{kabupaten}}/g, toProperCase(s.Kabupaten || ".................."));
    result = result.replace(/{{nama_ayah}}/g, s.Nama_Ayah || "..................");
    result = result.replace(/{{nama_ibu}}/g, s.Nama_Ibu || "..................");
    result = result.replace(/{{kelas}}/g, s.Kelas || "..................");
    result = result.replace(/{{tahun_ajaran}}/g, s.Tahun_Ajaran || "..................");
    result = result.replace(/{{va_pip}}/g, s.VA_PIP || "-");
    result = result.replace(/{{rek_pip}}/g, s.Rek_PIP || "-");
    result = result.replace(/{{nomor_ijazah}}/g, s.Nomor_Ijazah || "..................");
    result = result.replace(/{{ket_lulus}}/g, toProperCase(s.Ket_Lulus || ".................."));

    // Variabel Guru
    const g = window.selectedGuru || {};
    result = result.replace(/{{nama_guru}}/g, g.Nama || "..................");
    result = result.replace(/{{nip_guru}}/g, g.NIP || "..................");
    result = result.replace(/{{nuptk_guru}}/g, g.NUPTK || "..................");
    result = result.replace(/{{jabatan_guru}}/g, g.Jabatan || "..................");
    result = result.replace(/{{pangkat_guru}}/g, g.Pangkat_Golongan || "..................");
    result = result.replace(/{{unit_kerja}}/g, toProperCase(g.Unit_Kerja || ".................."));
    result = result.replace(/{{tugas_utama}}/g, toProperCase(g.Tugas_Utama || ".................."));
    result = result.replace(/{{tugas_tambahan}}/g, toProperCase(g.Tugas_Tambahan || ".................."));

    // Variabel Nilai Siswa
    const mapelNames = [
        "Pendidikan Agama dan Budi Pekerti", "Pendidikan Pancasila", "Bahasa Indonesia",
        "Matematika", "Ilmu Pengetahuan Alam dan Sosial", "Pendidikan Jasmani, Olahraga, dan Kesehatan",
        "Seni dan Budaya", "Bahasa Inggris", "Bahasa Madura", "Baca Tulis Al Quran (BTA)"
    ];
    let totalNilai = 0; let jumlahMapel = 0;
    mapelNames.forEach((name, i) => {
        const valStr = s[name];
        const valNum = parseFloat(valStr || 0);
        if (valStr && !isNaN(valNum)) { totalNilai += valNum; jumlahMapel++; }
        result = result.replace(new RegExp(`{{nilai_${i + 1}}}`, 'g'), valStr || "0");
    });
    const rataRata = jumlahMapel > 0 ? (totalNilai / jumlahMapel).toFixed(2) : "0.00";
    result = result.replace(/{{nilai_rata_rata}}/g, rataRata);

    // Variabel Sekolah
    const getKopLive = (id, fallback) => { const val = document.getElementById(id)?.value; return (val && val.trim() !== "") ? val : fallback; };
    result = result.replace(/{{nama_sekolah}}/g, getKopLive('in_kop_sekolah', "SD Negeri ..."));
    result = result.replace(/{{npsn_sekolah}}/g, getKopLive('set_npsn_sekolah', "........"));
    result = result.replace(/{{alamat_sekolah}}/g, getKopLive('in_kop_alamat', "........"));
    result = result.replace(/{{kontak_sekolah}}/g, getKopLive('in_kop_kontak', "........"));
    result = result.replace(/{{daerah_sekolah}}/g, toProperCase(getKopLive('in_kop_daerah', "........")));
    result = result.replace(/{{sub_dinas}}/g, toProperCase(getKopLive('in_kop_sub', "........")));

    // Variabel Dokumen
    result = result.replace(/{{nomor_surat}}/g, document.getElementById('in_nomor')?.value || "........");
    result = result.replace(/{{tanggal_surat}}/g, typeof formatTanggalIndo === "function" ? formatTanggalIndo(document.getElementById('in_tanggal')?.value) : "........");
    result = result.replace(/{{perihal}}/g, toProperCase(document.getElementById('in_perihal')?.value || "........"));

    return result;
}

function menjalankanUpdatePreviewLangsung() {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = "";
    let pageCount = 0;

    let activeList = [null];
    if (window.isBatchMode && window.selectedSiswaList.length > 0) activeList = window.selectedSiswaList;
    else if (window.isBatchModeGuru && window.selectedGuruList.length > 0) activeList = window.selectedGuruList;
    else if (window.selectedSiswa) activeList = [window.selectedSiswa];
    else if (window.selectedGuru) activeList = [window.selectedGuru];

    const getRawVal = (id, fallback = "") => document.getElementById(id)?.value ?? fallback;

    activeList.forEach((item, index) => {
        if (item && item.NISN) window.selectedSiswa = item;
        else if (item && item.NIP) window.selectedGuru = item;

        const getVal = (id, fallback = "") => resolveVariables(document.getElementById(id)?.value ?? fallback);
        const layoutType = getRawVal('in_layout_type', 'standard');
        const previousPageCount = parseInt(printArea.dataset.pageCount || "0", 10);
        const nl2br = (value) => escapeHTML(value).replace(/\n/g, '<br>');
        const isValidUrl = (url) => {
            const s = String(url || "").trim();
            return s.length > 0 && (/^https?:\/\//i.test(s) || /^file:\/\//i.test(s) || /^data:image\//i.test(s) || s.startsWith('.') || s.startsWith('/') || s.includes('logo') || s.includes('assets/'));
        };

        const size = getVal('in_ukuran_kertas', "size-f4");
        const font = getVal('in_pilihan_font', "font-serif-official");
        const fontSize = getVal('in_ukuran_font', "12pt");
        const marginSatuan = "mm";
        const margins = {
            t: getVal('in_margin_atas', 20), b: getVal('in_margin_bawah', 20),
            l: getVal('in_margin_kiri', 25), r: getVal('in_margin_kanan', 20)
        };
        const sheetHeightMm = size === 'size-f4' ? 330 : 297;
        const pxPerMm = 96 / 25.4;
        const fallbackInnerHeight = Math.max(100, (sheetHeightMm - parseFloat(margins.t) - parseFloat(margins.b)) * pxPerMm);

        let currentPage = null;
        let currentContent = null;

        const createNewPage = () => {
            const pageNumber = pageCount + 1;
            const p = document.createElement('div');
            p.className = `page-sheet shadow-2xl text-black ${size} ${font}`;
            p.style.lineHeight = document.getElementById('in_line_spacing')?.value || "1.6";
            if (pageNumber > previousPageCount) p.classList.add('page-enter');
            p.dataset.pageNumber = pageNumber;
            p.style.fontSize = fontSize;
            p.style.padding = `${margins.t}${marginSatuan} ${margins.r}${marginSatuan} ${margins.b}${marginSatuan} ${margins.l}${marginSatuan}`;
            p.innerHTML = `<div class="content-wrapper" style="height: var(--inner-height); position: relative; box-sizing: border-box; min-height: 1px; overflow: hidden;"></div>`;
            return p;
        };

        const appendNewPage = () => {
            const page = createNewPage();
            printArea.appendChild(page);
            pageCount++;
            currentPage = page;
            currentContent = page.querySelector('.content-wrapper');
        };

        const getInnerHeight = () => {
            if (!currentContent) return fallbackInnerHeight;
            const measured = currentContent.clientHeight || currentContent.getBoundingClientRect().height;
            return measured > 20 ? measured : fallbackInnerHeight;
        };

        const pageOverflows = () => currentContent.scrollHeight > getInnerHeight() + 2;

        const addBlock = (block) => {
            let attempts = 0;
            while (attempts < 6) {
                currentContent.appendChild(block);
                if (!pageOverflows()) return block;
                currentContent.removeChild(block);
                appendNewPage();
                attempts += 1;
            }
            currentContent.appendChild(block);
            return block;
        };

        const addHtmlBlock = (html, className = "") => {
            const wrapper = document.createElement('div');
            if (className) wrapper.className = className;
            wrapper.innerHTML = html;
            return addBlock(wrapper);
        };

        const addQuillHtmlBlock = (html) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'preview-rich-content';
            wrapper.innerHTML = html;
            addBlock(wrapper);
        };

        const addParagraph = (text) => {
            const cleanText = String(text || "");
            if (cleanText.trim() === "") {
                const spacer = document.createElement('div'); spacer.style.height = "1em";
                addBlock(spacer); return;
            }
            const paragraph = document.createElement('p');
            paragraph.className = "mb-2 text-justify"; paragraph.textContent = cleanText;
            addBlock(paragraph);
            if (!pageOverflows() || paragraph.parentNode !== currentContent) return;

            currentContent.removeChild(paragraph);
            const words = cleanText.split(/(\s+)/).filter(part => part.length > 0);
            let active = document.createElement('p');
            active.className = "mb-2 text-justify";
            currentContent.appendChild(active);

            words.forEach((word) => {
                const previous = active.textContent;
                active.textContent += word;
                if (pageOverflows() && previous !== "") {
                    active.textContent = previous.trimEnd();
                    appendNewPage();
                    active = document.createElement('p');
                    active.className = "indent-[40px] mb-2 text-justify";
                    active.textContent = word.trimStart();
                    currentContent.appendChild(active);
                }
            });
        };

        const forcePageBreak = () => {
            if (currentContent.children.length === 0 && pageCount > 1) return;
            appendNewPage();
        };

        appendNewPage();

        const lKiri = getVal('in_logo_kiri'); const lKanan = getVal('in_logo_kanan');
        addHtmlBlock(`
        <div class="kop-surat flex items-center border-b-[4px] border-double border-black pb-1.5 mb-5 select-none shrink-0">
        ${isValidUrl(lKiri) ? `<img class="w-20 h-24 object-contain shrink-0" src="${escapeHTML(lKiri)}" alt="">` : ''}
        <div class="flex-1 text-center px-4 min-w-0">
          <h4 class="text-[12pt] font-bold uppercase leading-tight">${escapeHTML(getVal('in_kop_daerah'))}</h4>
          <h4 class="text-[12pt] font-bold uppercase leading-tight">${escapeHTML(getVal('in_kop_sub'))}</h4>
          <h4 class="text-[12pt] font-bold uppercase leading-tight">${escapeHTML(getVal('in_kop_sekolah'))}</h4>
          <p class="text-[9pt] leading-tight mt-1">${escapeHTML(getVal('in_kop_alamat'))}</p>
          <p class="text-[9pt] italic leading-tight mt-0.5">${escapeHTML(getVal('in_kop_kontak'))}</p>
        </div>
        ${isValidUrl(lKanan) ? `<img class="w-20 h-24 object-contain shrink-0" src="${escapeHTML(lKanan)}" alt="">` : ''}
        </div>`);

        const tglIndo = typeof formatTanggalIndo === "function" ? formatTanggalIndo(getVal('in_tanggal')) : getVal('in_tanggal');

        if (layoutType === "centered") {
            addHtmlBlock(`
          <div class="text-center mb-8 mt-4">
            <h2 class="text-[14pt] font-bold uppercase underline decoration-1 underline-offset-4">${escapeHTML(getVal('in_perihal') || 'SURAT KETERANGAN')}</h2>
            <p class="text-[12pt] mt-1">Nomor: ${escapeHTML(getVal('in_nomor') || '...')}</p>
          </div>`);
        } else {
            addHtmlBlock(`
          <div class="metadata-surat w-full mb-6">
          <table class="w-full"><tr class="align-top">
            <td class="w-[60%]"><table class="w-full">
              <tr><td class="w-[90px]">Nomor</td><td class="w-[15px]">:</td><td>${escapeHTML(getVal('in_nomor') || '...')}</td></tr>
              <tr><td>Sifat</td><td>:</td><td>${escapeHTML(getVal('in_sifat'))}</td></tr>
              <tr><td>Lampiran</td><td>:</td><td>${escapeHTML(getVal('in_lampiran') || '-')}</td></tr>
              <tr><td>Perihal</td><td>:</td><td class="font-bold">${escapeHTML(getVal('in_perihal') || '...')}</td></tr>
            </table></td>
            <td class="w-[40%] text-right">${escapeHTML(getVal('in_lokasi'))}, ${escapeHTML(tglIndo)}</td>
          </tr></table></div>`);
        }

        const isiPenerima = getVal('in_penerima');
        if (isiPenerima.trim() !== "") addHtmlBlock(`<div class="mb-6"><p>${escapeHTML(getVal('in_label_penerima'))}</p><div class="font-bold whitespace-pre-wrap">${nl2br(isiPenerima)}</div></div>`);

        addHtmlBlock(`<p class="mb-4">${escapeHTML(getVal('in_pembuka'))}</p>`);

        const isiSurat = resolveVariables(getRawVal('in_isi'));
        if (isiSurat.trim() !== "") {
            if (/<[a-z][\s\S]*>/i.test(isiSurat)) {
                const richWrapper = document.createElement('div'); richWrapper.innerHTML = isiSurat;
                Array.from(richWrapper.childNodes).forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) addQuillHtmlBlock(node.outerHTML);
                    else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') addParagraph(node.textContent);
                });
            } else {
                isiSurat.split('\n').forEach(line => {
                    if (line.trim() === "---") { forcePageBreak(); return; }
                    if (line.includes(" : ")) {
                        let parts = line.split(" : ");
                        addHtmlBlock(`<table style="width: calc(100% - 40px); margin: 5px 0 5px 40px; table-layout: fixed;">
                        <tr><td style="width: 130px; vertical-align: top;">${escapeHTML(parts[0].trim())}</td>
                        <td style="width: 20px; vertical-align: top;">:</td>
                        <td style="vertical-align: top;">${escapeHTML(parts.slice(1).join(" : ").trim())}</td></tr></table>`);
                    } else { addParagraph(line); }
                });
            }
        }

        const finalBlock = document.createElement('div'); finalBlock.className = "mt-8 relative";
        const ttdDiv = document.createElement('div'); ttdDiv.id = "canvas-area-ttd";
        finalBlock.appendChild(ttdDiv);
        if (typeof renderKomponenSpesimenTtd === "function") renderKomponenSpesimenTtd(ttdDiv);

        const footerBlock = document.createElement('div');
        const tembusanText = getVal('in_tembusan');
        footerBlock.id = "active-footer-logic"; footerBlock.className = "absolute left-0 bottom-0 max-w-[230px] text-[9pt]";
        footerBlock.innerHTML = `
        <div class="flex flex-col items-start opacity-80"><div class="flex flex-col items-center">
            <div id="qrcode" class="p-0.5 border border-slate-100 rounded-md bg-white" style="width: 69px; height: 69px; display: flex; align-items: center; justify-content: center;"></div>
            <span class="text-[6pt] mt-1 font-mono text-[#0f172a]">Verifikasi Dokumen</span>
        </div></div>
        <div id="container_tembusan" class="${tembusanText.trim() ? '' : 'hidden'} mt-2">
            <p class="font-bold underline mb-0.5">Tembusan:</p>
            <div id="view_tembusan" class="whitespace-pre-wrap italic leading-tight border-l-2 border-slate-100 pl-2">${nl2br(tembusanText)}</div>
        </div>`;
        finalBlock.appendChild(footerBlock);
        currentContent.appendChild(finalBlock);

        if (typeof renderQRCodeVerifikasiInto === "function") renderQRCodeVerifikasiInto(footerBlock);

        if (currentContent.scrollHeight - getInnerHeight() > 24 && currentContent.children.length > 1) {
            currentContent.removeChild(finalBlock); appendNewPage(); currentContent.appendChild(finalBlock);
        }
    });
    document.getElementById('current-page-val').innerText = pageCount;
    printArea.dataset.pageCount = pageCount;
}

function renderQRCodeVerifikasiInto(footerElement) {
    const inpTembusan = document.getElementById('in_tembusan')?.value || "";
    const viewTembusan = footerElement.querySelector('#view_tembusan');
    const contTembusan = footerElement.querySelector('#container_tembusan');
    if (viewTembusan && contTembusan && inpTembusan.trim() !== "") {
        contTembusan.classList.remove('hidden'); viewTembusan.innerText = inpTembusan;
    }

    const qrContainer = footerElement.querySelector('#qrcode');
    if (qrContainer) {
        const sid = document.getElementById('in_serial_id').value || "VALID";
        let qrText = `VERIFIED DOCUMENT\nID: ${sid}`;
        // Electron App URL mode bisa disesuaikan atau dimatikan jika fully offline
        if (webAppUrl && (webAppUrl.startsWith('http://') || webAppUrl.startsWith('https://'))) {
            qrText = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + "id=" + sid + "&mode=1";
        }
        qrContainer.style.width = '69px'; qrContainer.style.height = '69px';
        qrContainer.style.display = 'flex'; qrContainer.style.alignItems = 'center'; qrContainer.style.justifyContent = 'center'; qrContainer.style.backgroundColor = '#ffffff';

        const paintQrImage = (src) => {
            qrContainer.innerHTML = "";
            const img = document.createElement('img'); img.src = src; img.alt = "QR Verifikasi";
            img.style.display = 'block'; img.style.width = '65px'; img.style.height = '65px'; img.style.maxWidth = '65px'; img.style.maxHeight = '65px';
            qrContainer.appendChild(img);
        };
        if (qrPreviewCache.text === qrText && qrPreviewCache.src) { paintQrImage(qrPreviewCache.src); return; }
        if (typeof QRCode === "undefined") {
            setTimeout(() => { if (footerElement.isConnected) renderQRCodeVerifikasiInto(footerElement); }, 250); return;
        }
        try {
            const tmpQr = document.createElement('div'); tmpQr.style.position = 'fixed'; tmpQr.style.left = '-9999px'; tmpQr.style.top = '-9999px'; document.body.appendChild(tmpQr);
            new QRCode(tmpQr, { text: qrText, width: 96, height: 96, correctLevel: QRCode.CorrectLevel.M });
            const canvas = tmpQr.querySelector('canvas'); const img = tmpQr.querySelector('img');
            const src = canvas ? canvas.toDataURL('image/png') : (img ? img.src : "");
            tmpQr.remove();
            if (src) { qrPreviewCache = { text: qrText, src }; paintQrImage(src); }
        } catch (err) { qrContainer.innerHTML = '<span style="font-size:8pt;font-weight:700;color:#0f172a;">QR</span>'; }
    }
}

function formatTanggalIndo(dateString) {
    if (!dateString) return "..................";
    let parts;
    if (dateString.includes("-")) parts = dateString.split('-');
    else if (dateString.includes("/")) parts = dateString.split('/').reverse();
    else return dateString;
    if (parts.length !== 3) return dateString;
    const tahun = parseInt(parts[0], 10); const bulan = parseInt(parts[1], 10) - 1; const tanggal = parseInt(parts[2], 10);
    const bulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${tanggal} ${bulanIndo[bulan]} ${tahun}`;
}

function renderKomponenSpesimenTtd(targetEl) {
    const c = targetEl || document.getElementById('canvas-area-ttd');
    if (!c) return;
    const layoutType = document.getElementById('in_layout_type')?.value || "standard";
    const tglIndo = formatTanggalIndo(document.getElementById('in_tanggal')?.value);
    const lokasi = document.getElementById('in_lokasi')?.value || "Jember";
    const isCentered = layoutType === "centered";
    const ttdHeight = document.getElementById('in_ttd_height')?.value || "80";
    const pakaiMaterai = document.getElementById('in_ttd_materai')?.checked || false;
    const frasaDitetapkan = document.getElementById('in_ttd_frasa_ditetapkan') ? document.getElementById('in_ttd_frasa_ditetapkan').value : "Ditetapkan di";
    const frasaTanggal = document.getElementById('in_ttd_frasa_tanggal') ? document.getElementById('in_ttd_frasa_tanggal').value : "Pada Tanggal";
    const pakaiFoto = document.getElementById('in_ttd_foto')?.checked || false;

    const getP = (n) => ({
        f: document.getElementById(`p${n}_frasa`)?.value || "",
        j: document.getElementById(`p${n}_jabatan`)?.value || "",
        n: document.getElementById(`p${n}_nama`)?.value || "..................",
        p: document.getElementById(`p${n}_pangkat`)?.value || "",
        nip: document.getElementById(`p${n}_nip`)?.value ? "NIP. " + document.getElementById(`p${n}_nip`).value : "NIP. ...................."
    });
    const p1 = getP(1), p2 = getP(2), p3 = getP(3);

    const pakaiTtdKs = document.getElementById('in_tampil_ttd_ks')?.checked || false;
    const urlTtdKs = document.getElementById('in_ttd_ks')?.value || "";
    const geserTtdKs = document.getElementById('in_geser_ttd_x')?.value || "0";
    const ttdKsHtml = (pakaiTtdKs && urlTtdKs) ? `<img src="${getLogoWithCacheBuster(urlTtdKs)}" class="absolute z-20" style="max-height: ${parseInt(ttdHeight) + 40}px; top: 50%; left: 50%; transform: translate(calc(-50% + ${geserTtdKs}px), -50%); object-fit: contain; pointer-events: none;">` : "";

    const materaiHtml = pakaiMaterai ? `<div class="absolute left-0 top-1/2 -translate-y-1/2 -rotate-12 border-2 border-dashed border-slate-300 p-2 text-[7pt] text-slate-400 font-bold leading-none select-none text-center z-10 bg-white/50">TEMPEL<br>MATERAI<br>10.000</div>` : "";
    const fotoHtml = pakaiFoto ? `<div class="shrink-0 border border-black flex items-center justify-center text-[7pt] text-slate-400 font-bold mb-6" style="width: 30mm; height: 40mm; margin-right: 15px;">PAS FOTO 3X4</div>` : "";
    const alignClass = isCentered ? 'text-left' : 'text-center';

    let prefixDitetapkan = "";
    if (isCentered) {
        if (frasaDitetapkan.trim() === "" && frasaTanggal.trim() === "") {
            prefixDitetapkan = `<div class="text-left mb-3">${escapeHTML(lokasi)}, ${escapeHTML(tglIndo)}</div>`;
        } else {
            prefixDitetapkan = `
            <div class="text-left mb-3"><table style="border-collapse: collapse; border: none; width: auto !important; margin-left: 0; line-height: 1.2; font-size: 12pt;">
                <tr><td style="padding: 0; white-space: nowrap; width: 1px;">${escapeHTML(frasaDitetapkan)}</td><td style="padding: 0 4px; width: 1px; text-align: center;">:</td><td style="padding: 0; white-space: nowrap;">${escapeHTML(lokasi)}</td></tr>
                <tr><td style="padding: 0; white-space: nowrap; width: 1px;">${escapeHTML(frasaTanggal)}</td><td style="padding: 0 4px; width: 1px; text-align: center;">:</td><td style="padding: 0; white-space: nowrap;">${escapeHTML(tglIndo)}</td></tr>
            </table></div>`;
        }
    }

    if (modeTtdAktif === "kanan-bawah") {
        c.innerHTML = `<div class="flex justify-end w-full"><div class="flex items-end">${fotoHtml}<div class="w-[300px] ${alignClass}">${prefixDitetapkan}<div class="whitespace-pre-line ${isCentered ? 'mt-2' : ''}">${p1.j}</div><div class="relative inline-block w-full">${materaiHtml}${ttdKsHtml}<div style="height: ${ttdHeight}px"></div></div><div class="font-bold underline">${p1.n}</div><div>${p1.p}</div><div>${p1.nip}</div></div></div></div>`;
    } else if (modeTtdAktif === "kanan-kiri") {
        c.innerHTML = `<div class="flex justify-between w-full items-end"><div class="w-[280px] text-center pl-24">${p2.f ? `<div class="font-medium mb-1">${p2.f}</div>` : ''}<div class="whitespace-pre-line">${p2.j}</div><div class="h-20"></div><div class="font-bold underline">${p2.n}</div><div>${p2.p}</div><div>${p2.nip}</div></div><div class="w-[280px] ${alignClass}">${prefixDitetapkan}<div class="whitespace-pre-line">${p1.j}</div><div class="relative inline-block w-full">${materaiHtml}${ttdKsHtml}<div style="height: ${ttdHeight}px"></div></div><div class="font-bold underline">${p1.n}</div><div>${p1.p}</div><div>${p1.nip}</div></div></div>`;
    } else if (modeTtdAktif === "segitiga") {
        c.innerHTML = `<div class="w-full flex flex-col items-center gap-8"><div class="w-full flex justify-between items-end"><div class="w-[260px] text-center">${p2.f ? `<div class="font-medium mb-1">${p2.f}</div>` : ''}<div class="whitespace-pre-line">${p2.j}</div><div class="h-20"></div><div class="font-bold underline">${p2.n}</div><div>${p2.p}</div><div>${p2.nip}</div></div><div class="w-[260px] ${alignClass}">${prefixDitetapkan}<div class="whitespace-pre-line">${p1.j}</div><div class="relative inline-block w-full">${materaiHtml}${ttdKsHtml}<div style="height: ${ttdHeight}px"></div></div><div class="font-bold underline">${p1.n}</div><div>${p1.p}</div><div>${p1.nip}</div></div></div><div class="w-[300px] text-center mt-2">${p3.f ? `<div class="font-medium mb-1">${p3.f}</div>` : '<div class="font-medium mb-1">Mengetahui,</div>'}<div class="whitespace-pre-line">${p3.j}</div><div class="h-16"></div><div class="font-bold underline">${p3.n}</div><div>${p3.p}</div><div>${p3.nip}</div></div></div>`;
    }
}

function ubahModeLayoutTtd(mode) {
    modeTtdAktif = mode;
    ['p2', 'p3'].forEach(id => { const el = document.getElementById(`box-form-${id}`); if (el) el.classList.add('hidden'); });
    if (mode === "kanan-kiri") document.getElementById('box-form-p2')?.classList.remove('hidden');
    if (mode === "segitiga") { document.getElementById('box-form-p2')?.classList.remove('hidden'); document.getElementById('box-form-p3')?.classList.remove('hidden'); }
    if (typeof updateLivePreview === "function") updateLivePreview();
}

// =============================================================
// UPLOAD GAMBAR CROPPER & OPERASI DB SETTINGS/TEMPLATE
// =============================================================
let cropperInstance = null;
let currentCropPosition = '';

function prosesUnggahLogoKeDrive(posisi) {
    let inputId = 'file_logo_kiri';
    if (posisi === 'right') inputId = 'file_logo_kanan';
    else if (posisi === 'ttd_ks') inputId = 'file_ttd_ks';
    const fileInput = document.getElementById(inputId);
    const file = fileInput?.files[0];
    if (!file) return;
    currentCropPosition = posisi;
    const reader = new FileReader();
    reader.onload = function (e) {
        const imgElement = document.getElementById('image-to-crop'); imgElement.src = e.target.result;
        document.getElementById('modal-cropper').classList.remove('hidden');
        if (cropperInstance) cropperInstance.destroy();
        const CropperLib = window.Cropper || Cropper;
        if (typeof CropperLib === 'undefined') { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL MEMUAT", "Library pemotong gambar belum siap."); return; }
        cropperInstance = new CropperLib(imgElement, { aspectRatio: NaN, viewMode: 1, autoCropArea: 0.8, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true });
        document.getElementById('btn-do-crop').onclick = function () {
            const canvas = cropperInstance.getCroppedCanvas({ width: 500, height: 600, imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
            const croppedBase64 = canvas.toDataURL('image/png');
            const base64Data = croppedBase64.split(',')[1];
            tutupModalCropper();
            lakukanUploadLogoFinal('image/png', base64Data, currentCropPosition);
        };
    };
    reader.readAsDataURL(file);
}

function tutupModalCropper() {
    document.getElementById('modal-cropper').classList.add('hidden');
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    document.getElementById('file_logo_kiri').value = ""; document.getElementById('file_logo_kanan').value = ""; document.getElementById('file_ttd_ks').value = "";
}

function lakukanUploadLogoFinal(mimeType, base64Data, posisi) {
    setLoading(true, "Mengunggah logo " + posisi + "...");
    window.electronAPI.uploadFileLogo(mimeType, base64Data, posisi.toUpperCase())
        .then(function (response) {
            if (response && response.status === "SUCCESS") {
                if (posisi === 'left') document.getElementById('in_logo_kiri').value = response.url;
                else if (posisi === 'right') document.getElementById('in_logo_kanan').value = response.url;
                else if (posisi === 'ttd_ks') document.getElementById('in_ttd_ks').value = response.url;
                if (posisi === 'right') {
                    const logoWithBuster = getLogoWithCacheBuster(response.url);
                    if (document.getElementById('brand-logo-nav')) document.getElementById('brand-logo-nav').src = logoWithBuster;
                    if (document.getElementById('app-logo-login')) document.getElementById('app-logo-login').src = logoWithBuster;
                }
                if (typeof updateLivePreview === "function") updateLivePreview();
                let dataOtoSimpan = {}; 
                if (posisi === 'left') dataOtoSimpan["Logo_Kiri_Url"] = response.url;
                else if (posisi === 'right') dataOtoSimpan["Logo_Kanan_Url"] = response.url;
                else if (posisi === 'ttd_ks') dataOtoSimpan["Ttd_Ks_Url"] = response.url;
                window.electronAPI.simpanPengaturanKop(dataOtoSimpan).then(() => {
                    setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("success", "BERHASIL", `Logo ${posisi} diunggah.`);
                }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
            } else {
                setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", response ? response.message : "Gagal mengunggah gambar.");
            }
        })
        .catch(function (err) { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "CRITICAL ERROR", err.toString()); });
}

function simpanKopKeDatabase() {
    setLoading(true, "Simpan Kop diproses...");
    const dataKop = {
        "Kop_Daerah": document.getElementById('in_kop_daerah').value,
        "Kop_Sub_Dinas": document.getElementById('in_kop_sub').value,
        "Kop_Sekolah": document.getElementById('in_kop_sekolah').value,
        "Kop_Alamat": document.getElementById('in_kop_alamat').value,
        "Kop_Kontak": document.getElementById('in_kop_kontak').value,
        "Line_Spacing": document.getElementById('in_line_spacing').value,
        "Ukuran_Kertas": document.getElementById('in_ukuran_kertas').value,
        "Ukuran_Font": document.getElementById('in_ukuran_font').value,
        "Pilihan_Font": document.getElementById('in_pilihan_font').value,
        "Satuan_Margin": document.getElementById('in_satuan_margin').value,
        "Margin_Atas": document.getElementById('in_margin_atas').value,
        "Margin_Bawah": document.getElementById('in_margin_bawah').value,
        "Margin_Kiri": document.getElementById('in_margin_kiri').value,
        "Margin_Kanan": document.getElementById('in_margin_kanan').value
    };
    window.electronAPI.simpanPengaturanKop(dataKop).then(res => {
        setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast(res.status === "SUCCESS" ? "success" : "error", res.status === "SUCCESS" ? "BERHASIL" : "GAGAL", res.message);
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
}

function bukaModalProfile() {
    document.getElementById('prof_nama').value = userSessionName;
    document.getElementById('prof_username').value = userSessionUsername;
    document.getElementById('prof_password').value = "";
    document.getElementById('modal-profile').classList.remove('hidden');
}

function tutupModalProfile() { document.getElementById('modal-profile').classList.add('hidden'); }


function simpanProfilBaru() {
    const dataProfil = { nama: document.getElementById('prof_nama').value.trim(), username: document.getElementById('prof_username').value.trim(), password: document.getElementById('prof_password').value.trim() };
    if (!dataProfil.nama || !dataProfil.username) { if (typeof tampilkanToast === "function") tampilkanToast("error", "DATA KOSONG", "Nama dan Username harus diisi."); return; }
    setLoading(true, "Memperbarui Akun...");
    window.electronAPI.perbaruiProfilUser(userSessionUsername, dataProfil).then(res => {
        setLoading(false);
        if (res.status === "SUCCESS") {
            const isCredentialChanged = dataProfil.username !== userSessionUsername || dataProfil.password !== "";
            if (isCredentialChanged && typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Keamanan Diperbarui', text: 'Sistem akan mengeluarkan Anda secara otomatis.', confirmButtonColor: '#0284c7', allowOutsideClick: false }).then(() => { if (typeof prosesLogoutSistem === "function") prosesLogoutSistem(); });
            } else {
                if (typeof tampilkanToast === "function") tampilkanToast("success", "PROFIL DIPERBARUI", res.message);
                userSessionName = dataProfil.nama;
                let sesi = JSON.parse(localStorage.getItem("kliksurat_sd_session") || "{}");
                if (sesi) { sesi.nama = userSessionName; sesi.username = userSessionUsername; localStorage.setItem("kliksurat_sd_session", JSON.stringify(sesi)); }
                document.getElementById('user-profile').innerHTML = `<i class="fa fa-user-circle"></i> ${userSessionName}`;
                if (typeof tutupModalProfile === "function") tutupModalProfile();
            }
        } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res.message); }
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
}

function simpanSettingsUmum() {
    const appName = document.getElementById('set_app_name').value;
    const npsnSekolah = (document.getElementById('set_npsn_sekolah')?.value || "").replace(/\D/g, "");
    const kodeProvinsi = document.getElementById('set_kode_provinsi')?.value || "35";
    const kodeKabupaten = document.getElementById('set_kode_kabupaten')?.value || "09";
    const kodeDinas = document.getElementById('set_kode_dinas')?.value || "310";
    const kodeKecamatan = document.getElementById('set_kode_kecamatan')?.value || "24";

    const logoL = document.getElementById('in_logo_kiri').value; const logoR = document.getElementById('in_logo_kanan').value;
    if (npsnSekolah && npsnSekolah.length !== 8) { if (typeof tampilkanToast === "function") tampilkanToast("error", "NPSN TIDAK VALID", "NPSN sekolah harus berisi 8 digit angka."); return; }
    setLoading(true, "Memperbarui sistem...");
    window.electronAPI.simpanPengaturanKop({ "App_Name": appName, "NPSN_Sekolah": npsnSekolah, "Kode_Provinsi": kodeProvinsi, "Kode_Kabupaten": kodeKabupaten, "Kode_Dinas": kodeDinas, "Kode_Kecamatan": kodeKecamatan, "Logo_Kiri_Url": logoL, "Logo_Kanan_Url": logoR }).then(res => {
        setLoading(false);
        if (res.status === "SUCCESS") {
            if (typeof tampilkanToast === "function") tampilkanToast("success", "SISTEM DIPERBARUI", "Nama aplikasi dan logo telah disimpan.");
            if (typeof tutupModalSettings === "function") tutupModalSettings();
            if (typeof refreshUIIdentity === "function") refreshUIIdentity(appName, logoR || logoL || "");
        } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res.message); }
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
}

function loadKodeKlasifikasiSurat() {
    const select = document.getElementById('in_kode_klasifikasi'); const listBox = document.getElementById('daftar-kode-klasifikasi');
    if (!select && !listBox) return;
    window.electronAPI.ambilKodeKlasifikasiSurat().then(data => {
        window.cacheKodeKlasifikasi = data || []; if (typeof renderKodeKlasifikasiSurat === "function") renderKodeKlasifikasiSurat(window.cacheKodeKlasifikasi);
    }).catch(err => console.warn("Gagal memuat kode klasifikasi:", err));
}

function renderKodeKlasifikasiSurat(data) {
    const select = document.getElementById('in_kode_klasifikasi');
    const listBox = document.getElementById('daftar-kode-klasifikasi');
    const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const items = (data && data.length) ? data : [{ kode: "400.3.5", nama: "Administrasi Sekolah" }, { kode: "005", nama: "Undangan" }];

    if (select) {
        const currentValue = select.value;
        select.innerHTML = items.map(item => {
            const label = item.nama ? `${item.kode} - ${item.nama}` : item.kode;
            return `<option value="${escapeText(item.kode)}">${escapeText(label)}</option>`;
        }).join('');
        if (items.some(item => item.kode === currentValue)) select.value = currentValue;
    }

    if (listBox) {
        listBox.innerHTML = items.map(item => `
        <div class="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-2.5 py-1.5"><div class="flex flex-col"><span class="font-mono font-bold text-brand-blue text-xs">${escapeText(item.kode)}</span><span class="text-[10px] text-slate-500 dark:text-slate-300 truncate max-w-[150px]">${escapeText(item.nama || '-')}</span></div><button onclick="hapusKlasifikasi('${escapeText(item.kode)}')" class="text-rose-400 hover:text-rose-600 transition-colors"><i class="fa fa-times-circle"></i></button></div>
        `).join('');
    }
}

function hapusKlasifikasi(kode) {
    if (typeof Swal === 'undefined') return;
    Swal.fire({ title: 'Hapus Kode?', text: `Hapus klasifikasi ${kode}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus' }).then(res => {
        if (res.isConfirmed) {
            setLoading(true, "Menghapus...");
            window.electronAPI.hapusKodeKlasifikasi(kode).then(() => { loadKodeKlasifikasiSurat(); setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("success", "TERHAPUS", "Kode klasifikasi dihapus."); }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", err.toString()); });
        }
    });
}

function tambahKodeKlasifikasiBaru() {
    const kodeEl = document.getElementById('in_kode_baru'); const namaEl = document.getElementById('in_nama_kode_baru');
    const kode = kodeEl?.value.trim() || ""; const nama = namaEl?.value.trim() || "";
    if (!kode || !nama) { if (typeof tampilkanToast === "function") tampilkanToast("error", "DATA KOSONG", "Kode dan nama klasifikasi wajib diisi."); return; }
    setLoading(true, "Menyimpan...");
    window.electronAPI.tambahKodeKlasifikasiSurat({ kode, nama }).then(res => {
        setLoading(false);
        if (res && res.status === "SUCCESS") {
            if (kodeEl) kodeEl.value = ""; if (namaEl) namaEl.value = "";
            if (typeof tampilkanToast === "function") tampilkanToast("success", "KODE TERSIMPAN", res.message);
            loadKodeKlasifikasiSurat();
        } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res ? res.message : "Gagal menyimpan."); }
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
}

function simpanTtdKeDatabase() {
    const modeElem = document.getElementById('in_mode_ttd'); const modeValue = modeElem ? modeElem.value : (typeof modeTtdAktif !== 'undefined' ? modeTtdAktif : "kanan-bawah");
    setLoading(true, "Menyimpan setelan TTD...");
    const dataTtd = {
        "Ttd_Gunakan_Ttd_Ks": document.getElementById('in_tampil_ttd_ks')?.checked ? "YA" : "TIDAK",
        "Ttd_Geser_X_Ks": document.getElementById('in_geser_ttd_x')?.value || "0",
        "Ttd_Frasa_Ditetapkan": document.getElementById('in_ttd_frasa_ditetapkan')?.value || "Ditetapkan di", "Ttd_Frasa_Tanggal": document.getElementById('in_ttd_frasa_tanggal')?.value || "Pada Tanggal",
        "Ttd_Mode_Aktif": modeValue, "Ttd_Gunakan_Foto": document.getElementById('in_ttd_foto')?.checked ? "YA" : "TIDAK",
        "Ttd_Jabatan_1": document.getElementById('p1_jabatan')?.value || "", "Ttd_Nama_1": document.getElementById('p1_nama')?.value || "", "Ttd_Pangkat_1": document.getElementById('p1_pangkat')?.value || "", "Ttd_Nip_1": document.getElementById('p1_nip')?.value || "",
        "Ttd_Frasa_2": document.getElementById('p2_frasa')?.value || "", "Ttd_Jabatan_2": document.getElementById('p2_jabatan')?.value || "", "Ttd_Nama_2": document.getElementById('p2_nama')?.value || "", "Ttd_Pangkat_2": document.getElementById('p2_pangkat')?.value || "", "Ttd_Nip_2": document.getElementById('p2_nip')?.value || "",
        "Ttd_Frasa_3": document.getElementById('p3_frasa')?.value || "", "Ttd_Jabatan_3": document.getElementById('p3_jabatan')?.value || "", "Ttd_Nama_3": document.getElementById('p3_nama')?.value || "", "Ttd_Pangkat_3": document.getElementById('p3_pangkat')?.value || "", "Ttd_Nip_3": document.getElementById('p3_nip')?.value || ""
    };
    window.electronAPI.simpanPengaturanTtd(dataTtd).then(res => {
        setLoading(false);
        if (res && res.status === "SUCCESS") {
            window.configPejabat = { nama: dataTtd.Ttd_Nama_1, nip: dataTtd.Ttd_Nip_1, jabatan: dataTtd.Ttd_Jabatan_1, pangkat: dataTtd.Ttd_Pangkat_1 };
            if (typeof tampilkanToast === "function") tampilkanToast("success", "BERHASIL", res.message); else if (typeof Swal !== 'undefined') Swal.fire('Berhasil', res.message, 'success');
        } else {
            const msg = res ? res.message : "Gagal menyimpan TTD.";
            if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", msg); else if (typeof Swal !== 'undefined') Swal.fire('Gagal', msg, 'error');
        }
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); else if (typeof Swal !== 'undefined') Swal.fire('Error Sistem', err.toString(), 'error'); });
}

function prosesSimpanData() {
    const packNomor = document.getElementById('in_nomor')?.value; const packPerihal = document.getElementById('in_perihal')?.value;
    if (!packNomor || !packPerihal) { if (typeof Swal !== 'undefined') Swal.fire({ icon: 'warning', title: 'Data Belum Lengkap', text: 'Nomor dan Perihal wajib diisi!', confirmButtonColor: '#0284c7' }); return; }

    const inSid = document.getElementById('in_serial_id');
    if (inSid) { inSid.value = "V" + Math.random().toString(36).substring(2, 9).toUpperCase(); shortUrlCache = ""; lastSidForShortening = ""; if (typeof updateLivePreview === "function") updateLivePreview(); }

    const dataSuratMurni = {
        nomor: packNomor, tanggal: document.getElementById('in_tanggal')?.value || "", perihal: packPerihal, penerima: document.getElementById('in_penerima')?.value || "",
        lampiran: document.getElementById('in_lampiran')?.value || "", pembuka: document.getElementById('in_pembuka')?.value || "", isi: document.getElementById('in_isi')?.value || "",
        tembusan: document.getElementById('in_tembusan')?.value || "", operator: typeof userSessionName !== "undefined" ? userSessionName : "Admin",
        serial_id: document.getElementById('in_serial_id')?.value || "-", ref_id: window.selectedSiswa?.NISN || window.selectedGuru?.NIP || "",
        layout: document.getElementById('in_layout_type')?.value || "standard"
    };

    const parts = dataSuratMurni.nomor.split('/');
    if (parts.length < 2) {
        // Fallback simpan jika format bukan urutan/tahun
        eksekusiSimpanAkhir(dataSuratMurni); return;
    }
    const urutan = parts[1]; const tahun = parts[parts.length - 1];

    window.electronAPI.cekNomorDuplikat(urutan, tahun).then(status => {
        if (status === "DUPLICATE" || status === "JUMP") {
            if (typeof tampilkanToast === "function") tampilkanToast("warning", "NOMOR DISESUAIKAN", status === "DUPLICATE" ? `Nomor ${urutan} sudah ada. Menyesuaikan...` : `Nomor ${urutan} melompat. Menyesuaikan...`);
            if (typeof mintaNomorOtomatis === "function") mintaNomorOtomatis(); return;
        }
        eksekusiSimpanAkhir(dataSuratMurni);
    }).catch(() => { eksekusiSimpanAkhir(dataSuratMurni); });
}

function eksekusiSimpanAkhir(dataSuratMurni) {
    if (typeof Swal === 'undefined') return;
    Swal.fire({ title: 'Simpan Arsip Surat?', text: "Surat akan dicatat ke log arsip.", icon: 'question', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: 'Ya, Arsipkan' }).then((result) => {
        if (result.isConfirmed) {
            setLoading(true, "Mengarsipkan Surat...");
            window.electronAPI.simpanPaketSuratLengkap(dataSuratMurni).then(res => {
                setLoading(false);
                if (typeof muatDataArsip === "function") muatDataArsip();
                if (typeof mintaNomorOtomatis === "function") mintaNomorOtomatis();
                Swal.fire({ icon: 'success', title: 'Berhasil Diarsipkan!', text: 'Apakah isi teks ini ingin dijadikan Master Template baru?', showCancelButton: true, confirmButtonColor: '#0284c7', confirmButtonText: 'Jadikan Template', cancelButtonText: 'Tidak Selesai' }).then((pilihan) => {
                    if (pilihan.isConfirmed) { tanyakanNamaTemplateOtomatis(dataSuratMurni); } else { if (typeof bersihkanFormSuratSelesai === "function") bersihkanFormSuratSelesai(); }
                });
            }).catch(err => { setLoading(false); Swal.fire('Gagal', err.toString(), 'error'); });
        }
    });
}

function tanyakanNamaTemplateOtomatis(dataSuratMurni) {
    if (typeof Swal === 'undefined') return;
    Swal.fire({ title: 'Nama Master Template', input: 'text', showCancelButton: true, confirmButtonColor: '#0284c7', confirmButtonText: 'Simpan', inputValidator: (value) => { if (!value) return 'Nama template wajib diisi!'; } }).then((inputRes) => {
        if (inputRes.isConfirmed) {
            setLoading(true, "Mendaftarkan Template...");
            window.electronAPI.simpanTemplateDinamis({ nama: inputRes.value, surat: dataSuratMurni }).then(res => {
                setLoading(false); Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Master draf surat ditambahkan.', confirmButtonColor: '#0284c7' }).then(() => { if (typeof loadKoleksiDatabase === "function") loadKoleksiDatabase(); if (typeof bersihkanFormSuratSelesai === "function") bersihkanFormSuratSelesai(); });
            }).catch(err => { setLoading(false); Swal.fire({ icon: 'error', title: 'Gagal', text: err.toString() }); });
        }
    });
}

function konfirmasiHapusSemuaTemplate() {
    if (typeof Swal === 'undefined') return;
    Swal.fire({ title: 'Hapus Semua Template?', text: "Semua template akan dihapus permanen.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Ya, Hapus Semua' }).then((result) => {
        if (result.isConfirmed) {
            setLoading(true, "Membersihkan database...");
            window.electronAPI.hapusSemuaTemplate().then(res => {
                setLoading(false);
                if (res.status === "SUCCESS") { if (typeof tampilkanToast === "function") tampilkanToast("success", "BERHASIL", res.message); if (typeof loadKoleksiDatabase === "function") loadKoleksiDatabase(); } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res.message); }
            }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
        }
    });
}

function handleImporFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error("Format harus Array JSON.");
            setLoading(true, "Mengimpor Template...");
            window.electronAPI.imporTemplatesBatch(importedData).then(res => {
                setLoading(false);
                if (res.status === "SUCCESS") { if (typeof Swal !== 'undefined') Swal.fire('Impor Berhasil', res.message, 'success'); if (typeof loadKoleksiDatabase === "function") loadKoleksiDatabase(); } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res.message); }
                event.target.value = '';
            }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); event.target.value = ''; });
        } catch (err) { if (typeof Swal !== 'undefined') Swal.fire('File Tidak Valid', 'Pastikan file adalah format JSON template yang benar.', 'error'); }
    };
    reader.readAsText(file);
}

// =============================================================
// SISWA: PENCARIAN & MANAJEMEN CRUD
// =============================================================
function filterSiswa(query) {
    const resultsDiv = document.getElementById('siswa_results_list');
    if (!resultsDiv) return;
    if (!query || query.length < 3) { resultsDiv.innerHTML = ""; resultsDiv.classList.add('hidden'); return; }

    window.electronAPI.cariSiswa(query).then(data => {
        if (!data || data.length === 0) { resultsDiv.innerHTML = '<div class="p-3 text-[10px] text-slate-400 text-center italic">Siswa tidak ditemukan...</div>'; }
        else {
            resultsDiv.innerHTML = data.map(s => `<div onclick="pilihSiswa('${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}')" class="p-3 text-xs hover:bg-emerald-50 cursor-pointer flex items-center justify-between group"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-[10px]">${s.Nama.charAt(0)}</div><div class="flex flex-col overflow-hidden"><span class="font-bold text-slate-700 truncate uppercase">${s.Nama}</span><span class="text-[9px] text-slate-400">NISN: ${s.NISN} | Kelas: ${s.Kelas}</span></div></div>${window.isBatchMode ? '<i class="fa fa-plus-circle text-emerald-400"></i>' : ''}</div>`).join('');
        }
        resultsDiv.classList.remove('hidden');
    }).catch(err => { console.error("Gagal cari siswa:", err); });
}

function simpanDataSiswa() {
    const form = document.getElementById('form-siswa');
    const formData = new FormData(form); const data = {}; formData.forEach((value, key) => data[key] = value);
    if (!data.Nama || !data.NISN) { if (typeof tampilkanToast === "function") tampilkanToast("error", "TIDAK LENGKAP", "Nama dan NISN wajib diisi!"); return; }

    setLoading(true, "Menyimpan data siswa...");
    window.electronAPI.simpanSiswaBaru(data).then(res => {
        setLoading(false);
        if (res.status === "SUCCESS") {
            if (typeof tampilkanToast === "function") tampilkanToast("success", "BERHASIL", res.message);
            window.selectedSiswa = data; if (typeof tutupModalSiswa === "function") tutupModalSiswa();
            if (typeof muatTabelSiswa === "function") muatTabelSiswa(); if (typeof updateLivePreview === "function") updateLivePreview();
        } else { if (typeof tampilkanToast === "function") tampilkanToast("error", "GAGAL", res.message); }
    }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
}

function hapusDataSiswa(nisnManual, namaManual) {
    const nisn = nisnManual || document.querySelector('#form-siswa [name="NISN"]').value;
    const nama = namaManual || document.querySelector('#form-siswa [name="Nama"]').value;
    if (!nisn) return;

    if (typeof Swal === 'undefined') return;
    Swal.fire({ title: 'Hapus Siswa?', text: `Data ${nama} akan dihapus permanen.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Ya, Hapus' }).then((result) => {
        if (result.isConfirmed) {
            setLoading(true, "Menghapus...");
            window.electronAPI.hapusSiswa(nisn).then(res => {
                setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast(res.status === "SUCCESS" ? "success" : "error", "HAPUS", res.message);
                if (res.status === "SUCCESS") { window.selectedSiswa = null; if (!nisnManual && typeof tutupModalSiswa === "function") tutupModalSiswa(); if (typeof muatTabelSiswa === "function") muatTabelSiswa(); if (typeof updateLivePreview === "function") updateLivePreview(); }
            }).catch(err => { setLoading(false); if (typeof tampilkanToast === "function") tampilkanToast("error", "ERROR", err.toString()); });
        }
    });
}

function handleImporSiswaExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const dataRaw = new Uint8Array(e.target.result);
            if (typeof XLSX === 'undefined') throw new Error("Library XLSX tidak ditemukan!");
            const workbook = XLSX.read(dataRaw, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            if (!jsonData || jsonData.length === 0) { if (typeof tampilkanToast === "function") tampilkanToast("error", "KOSONG", "Tidak ada data di file Excel."); return; }

            setLoading(true, "Mengimpor...");
            window.electronAPI.imporSiswaBatch(jsonData).then(res => {
                setLoading(false); if (typeof Swal !== 'undefined') Swal.fire('Impor Selesai', res.message, 'success'); event.target.value = ""; if (typeof muatTabelSiswa === "function") muatTabelSiswa();
            }).catch(err => { setLoading(false); if (typeof Swal !== 'undefined') Swal.fire('Gagal', err.toString(), 'error'); event.target.value = ""; });
        } catch (err) { if (typeof Swal !== 'undefined') Swal.fire('Error', err.toString(), 'error'); event.target.value = ""; }
    };
    reader.readAsArrayBuffer(file);
}

// --- BERSAMBUNG KE PART 3: Operasi Arsip, Guru, Surat Masuk, dan Utilitas UI ---
function pilihSiswa(encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
        if (window.isBatchMode) {
            if (!window.selectedSiswaList.some(s => s.NISN === data.NISN)) {
                window.selectedSiswaList.push(data);
                tampilkanToast("success", "DITAMBAHKAN", `${data.Nama} masuk dalam antrean cetak.`);
            }
            const searchInp = document.getElementById('search_siswa');
            if (searchInp) { searchInp.value = ""; searchInp.focus(); }
            renderSelectedSiswaList();
        } else {
            window.selectedSiswa = data;
            document.getElementById('search_siswa').value = data.Nama;
            document.getElementById('siswa-selected-badge')?.classList.remove('hidden');
            tampilkanToast("success", "SISWA TERPILIH", `${data.Nama} terkoneksi.`);
        }
        document.getElementById('siswa_results_list').classList.add('hidden');
        if (typeof updateLivePreview === "function") updateLivePreview();
    } catch (e) {
        tampilkanToast("error", "GAGAL", "Gagal memproses data siswa.");
    }
}

function toggleBatchMode(val) {
    window.isBatchMode = val;
    window.selectedSiswaList = [];
    window.selectedSiswa = null;
    document.getElementById('siswa_selected_list').classList.toggle('hidden', !val);
    document.getElementById('siswa_selected_list').innerHTML = "";
    document.getElementById('search_siswa').value = "";
    if (typeof updateLivePreview === "function") updateLivePreview();
}

function renderSelectedSiswaList() {
    const container = document.getElementById('siswa_selected_list');
    container.innerHTML = window.selectedSiswaList.map((s, i) => `
        <div class="flex items-center gap-1.5 px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold rounded-lg animate-in zoom-in duration-200">
        <span class="max-w-[80px] truncate uppercase">${s.Nama}</span>
        <button onclick="hapusSiswaDariBatch(${i})" class="hover:text-red-200"><i class="fa fa-times-circle"></i></button>
        </div>
    `).join('');
}

function hapusSiswaDariBatch(index) {
    window.selectedSiswaList.splice(index, 1);
    renderSelectedSiswaList();
    if (typeof updateLivePreview === "function") updateLivePreview();
}

function loadKoleksiDatabase() {
    const select = document.getElementById('in_pilih_template');
    if (!select) return;
    setLoading(true, "Sinkronisasi template...");
    window.electronAPI.ambilSemuaTemplate().then(function (data) {
        setLoading(false);
        window.cacheTemplates = data || [];
        renderDropdownTemplate(window.cacheTemplates);
        if (typeof renderSettingsTemplateList === "function") renderSettingsTemplateList();
    }).catch(function (err) { console.error("Gagal memuat database: ", err); });
}

function renderDropdownTemplate(data) {
    const select = document.getElementById('in_pilih_template');
    if (!select) return;
    select.innerHTML = '<option value="">-- Buat Surat Baru (Kosong) --</option>';
    if (!data || data.length === 0) {
        let opt = document.createElement('option'); opt.disabled = true; opt.text = "Tidak ada template yang tersimpan"; select.appendChild(opt);
    } else {
        data.forEach((tpl, i) => {
            let opt = document.createElement('option');
            const originalIdx = window.cacheTemplates.findIndex(item => item.nama === tpl.nama);
            opt.value = originalIdx; opt.text = "📄 " + tpl.nama; select.appendChild(opt);
        });
    }
}

function filterTemplate(query) {
    const resultsDiv = document.getElementById('search_results_list');
    if (!window.cacheTemplates || !resultsDiv) return;
    if (!query || query.trim() === "") { resultsDiv.innerHTML = ""; resultsDiv.classList.add('hidden'); return; }
    const filtered = window.cacheTemplates.filter(t => t.nama.toLowerCase().includes(query.toLowerCase()));
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="p-4 text-xs text-slate-400 text-center italic">Template tidak ditemukan...</div>';
    } else {
        resultsDiv.innerHTML = filtered.map(t => {
            const idx = window.cacheTemplates.findIndex(item => item.nama === t.nama);
            return `<div onclick="pilihDariPencarian(${idx}, '${t.nama.replace(/'/g, "\\'")}')" class="p-3 text-xs hover:bg-sky-50 cursor-pointer flex items-center gap-3 transition-colors group"><div class="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-sky-100 flex items-center justify-center transition-colors"><i class="fa-regular fa-file-lines text-slate-400 group-hover:text-sky-600"></i></div><div class="flex flex-col overflow-hidden"><span class="font-semibold text-slate-700 group-hover:text-sky-700 truncate">${t.nama}</span><span class="text-[9px] text-slate-400 truncate">${t.perihal || 'Tanpa Perihal'}</span></div></div>`;
        }).join('');
    }
    resultsDiv.classList.remove('hidden');
}

function pilihDariPencarian(idx, nama) {
    const select = document.getElementById('in_pilih_template');
    if (select) select.value = idx;
    document.getElementById('search_results_list').classList.add('hidden');
    pilihTemplateDinamis(idx);
}

function pilihTemplateDinamis(idx) {
    const searchBox = document.getElementById('search_template'); const inSid = document.getElementById('in_serial_id');
    if (inSid) { inSid.value = ""; shortUrlCache = ""; lastSidForShortening = ""; }
    if (idx === "" || !window.cacheTemplates || !window.cacheTemplates[idx]) {
        bersihkanFormSuratSelesai();
        const sSiswa = document.getElementById('section-pilih-siswa'); if (sSiswa) { sSiswa.classList.add('hidden'); window.selectedSiswa = null; }
        const sGuru = document.getElementById('section-pilih-guru'); if (sGuru) { sGuru.classList.add('hidden'); window.selectedGuru = null; }
        if (document.getElementById('search_siswa')) document.getElementById('search_siswa').value = "";
        if (document.getElementById('search_guru')) document.getElementById('search_guru').value = "";
        if (searchBox) searchBox.value = "";
        return;
    }
    const t = window.cacheTemplates[idx];
    if (searchBox) searchBox.value = t.nama;
    if (document.getElementById('in_perihal')) document.getElementById('in_perihal').value = t.perihal || "";
    if (document.getElementById('in_penerima')) document.getElementById('in_penerima').value = t.penerima || "";
    if (document.getElementById('in_lampiran')) document.getElementById('in_lampiran').value = t.lampiran || "-";
    if (document.getElementById('in_pembuka')) document.getElementById('in_pembuka').value = t.pembuka || "";
    if (document.getElementById('in_layout_type')) document.getElementById('in_layout_type').value = t.layout || "standard";
    setIsiEditorValue(t.isi || "");
    if (document.getElementById('in_tembusan')) document.getElementById('in_tembusan').value = t.tembusan || "";
    const inputTgl = document.getElementById('in_tanggal'); if (inputTgl) { const now = new Date(); inputTgl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
    const parts = (t.nomor || "").split('/'); if (parts.length > 0 && parts[0]) { const selectKlas = document.getElementById('in_kode_klasifikasi'); if (selectKlas) { selectKlas.value = parts[0]; mintaNomorOtomatis(); } }
    shortUrlCache = ""; lastSidForShortening = ""; if (typeof updateLivePreview === "function") updateLivePreview();
    tampilkanToast("success", "TEMPLATE DIMUAT", `Draft '${t.nama}' berhasil diterapkan.`);

    // Deteksi Tipe Template (Siswa vs Guru)
    const keywordSiswa = ["siswa", "skl", "pip", "ijazah", "lulus", "raport", "nilai"];
    const keywordGuru = ["guru", "tugas", "pbm", "sk pbm", "pembagian tugas"];
    const butuhSiswa = keywordSiswa.some(k => t.nama.toLowerCase().includes(k) || (t.isi && t.isi.toLowerCase().includes(k)));
    const butuhGuru = keywordGuru.some(k => t.nama.toLowerCase().includes(k) || (t.isi && t.isi.toLowerCase().includes(k)));

    const sectionSiswa = document.getElementById('section-pilih-siswa');
    if (sectionSiswa) {
        if (butuhSiswa) {
            sectionSiswa.classList.remove('hidden');
        } else {
            sectionSiswa.classList.add('hidden');
            window.selectedSiswa = null;
        }
    }
    const sectionGuru = document.getElementById('section-pilih-guru');
    if (sectionGuru) {
        if (butuhGuru) sectionGuru.classList.remove('hidden');
        else {
            sectionGuru.classList.add('hidden');
            window.selectedGuru = null;
        }
    }
}

function bersihkanFormSuratSelesai() {
    const idsToClear = ['in_nomor', 'in_perihal', 'in_penerima', 'in_pembuka', 'in_tembusan'];
    idsToClear.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    setIsiEditorValue('');
    const inSid = document.getElementById('in_serial_id'); if (inSid) inSid.value = "";
    const inputTgl = document.getElementById('in_tanggal'); if (inputTgl) { const now = new Date(); inputTgl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
    shortUrlCache = ""; lastSidForShortening = ""; if (typeof updateLivePreview === "function") updateLivePreview();
}

function buatTemplateBaru() {
    const dataSurat = {
        nomor: document.getElementById('in_nomor').value,
        tanggal: document.getElementById('in_tanggal') ? document.getElementById('in_tanggal').value : "",
        perihal: document.getElementById('in_perihal').value,
        penerima: document.getElementById('in_penerima').value,
        lampiran: document.getElementById('in_lampiran').value,
        pembuka: document.getElementById('in_pembuka').value,
        isi: document.getElementById('in_isi').value
    };
    Swal.fire({
        title: 'Beri Nama Template',
        input: 'text',
        inputPlaceholder: 'Contoh: Undangan Wali Murid',
        showCancelButton: true,
        confirmButtonColor: '#0284c7',
        inputValidator: (value) => { if (!value) return 'Nama template tidak boleh kosong!' }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            setLoading(true, "Memproses Template...");
            dataSurat.nama = result.value;
            window.electronAPI.simpanTemplateDinamis(dataSurat).then(() => {
                setLoading(false); Swal.fire({ icon: 'success', title: 'Sukses!', text: 'Template baru berhasil ditambahkan.', confirmButtonColor: '#10b981' }); loadKoleksiDatabase();
            }).catch(err => { setLoading(false); Swal.fire({ icon: 'error', title: 'Gagal!', text: 'Gagal simpan template: ' + err, confirmButtonColor: '#e11d48' }); });
        }
    });
}

function isiFormSiswa(data) {
    const form = document.getElementById('form-siswa');
    Object.keys(data).forEach(key => { const input = form.querySelector(`[name="${key}"]`); if (input) input.value = data[key] || ''; });
}

function bukaModalSiswa(tab = 'form') {
    const form = document.getElementById('form-siswa');
    form.reset();
    switchTabSiswa(tab);
    if (window.selectedSiswa) {
        isiFormSiswa(window.selectedSiswa);
        document.getElementById('btn-hapus-siswa').classList.remove('hidden');
    } else {
        document.getElementById('btn-hapus-siswa').classList.add('hidden');
    }
    document.getElementById('modal-siswa').classList.remove('hidden');
}

function tutupModalSiswa() {
    document.getElementById('modal-siswa').classList.add('hidden');
}

function handleKetLulusChange(selectEl) {
    const form = selectEl.closest('form');
    const ijazahInput = form.querySelector('[name="Nomor_Ijazah"]');
    if (!ijazahInput) return;
    if (selectEl.value === "BELUM LULUS / MASIH AKTIF") { ijazahInput.value = "-"; }
    else if (ijazahInput.value === "-") { ijazahInput.value = ""; }
}

function switchTabSiswa(target) {
    const formArea = document.getElementById('siswa-tab-form');
    const tableArea = document.getElementById('siswa-tab-table');
    const btnForm = document.getElementById('tab-siswa-form-btn');
    const btnTable = document.getElementById('tab-siswa-table-btn');
    if (target === 'form') {
        formArea.classList.remove('hidden'); tableArea.classList.add('hidden');
        if (btnForm) btnForm.className = "py-2 border-b-2 border-brand-blue text-brand-blue";
        if (btnTable) btnTable.className = "py-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
    } else {
        formArea.classList.add('hidden'); tableArea.classList.remove('hidden');
        if (btnForm) btnForm.className = "py-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
        if (btnTable) btnTable.className = "py-2 border-b-2 border-brand-blue text-brand-blue";
        muatTabelSiswa();
    }
}

function muatTabelSiswa() {
    const container = document.getElementById('tabel-siswa-body');
    document.querySelectorAll('#siswa-tab-table input[data-filter-col]').forEach(input => input.value = '');
    container.innerHTML = Array(5).fill(0).map(() => `<tr class="border-b border-slate-50"><td class="p-3"><div class="h-4 w-32 bg-slate-100 animate-pulse rounded"></div></td><td class="p-3"><div class="h-4 w-20 bg-slate-100 animate-pulse rounded"></div></td><td class="p-3"><div class="h-4 w-12 bg-slate-100 animate-pulse rounded"></div></td><td class="p-3"><div class="h-4 w-16 bg-slate-100 animate-pulse rounded"></div></td><td class="p-3"><div class="h-4 w-8 ml-auto skeleton-box rounded"></div></td></tr>`).join('');
    window.electronAPI.ambilSemuaSiswa().then(data => {
        window.fullCacheSiswa = data || [];
        renderTabelSiswa(window.fullCacheSiswa);
        if (typeof updateHeaderStats === "function") updateHeaderStats();
    }).catch(err => console.error(err));
}

function filterTabelSiswa() {
    const filters = {};
    document.querySelectorAll('#siswa-tab-table input[data-filter-col]').forEach(input => {
        const val = input.value.trim().toLowerCase();
        if (val) filters[input.dataset.filterCol] = val;
    });
    let filtered = window.fullCacheSiswa;
    if (Object.keys(filters).length > 0) {
        filtered = window.fullCacheSiswa.filter(s => {
            for (const col in filters) {
                if (col === "Domisili") {
                    const text = `${s.Dusun || ''} ${s.Desa || ''} ${s.RT || ''} ${s.RW || ''} ${s.Kecamatan || ''} ${s.Kabupaten || ''}`.toLowerCase();
                    if (!text.includes(filters[col])) return false;
                } else if (!String(s[col] || '').toLowerCase().includes(filters[col])) return false;
            }
            return true;
        });
    }
    renderTabelSiswa(filtered);
}

function renderTabelSiswa(data) {
    const container = document.getElementById('tabel-siswa-body');
    if (!data || data.length === 0) { container.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Database masih kosong.</td></tr>'; return; }
    container.innerHTML = data.map(s => `
    <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td class="p-3 text-xs font-bold text-slate-700">${s.Nama}</td>
      <td class="p-3 text-xs font-mono">${s.NISN}</td>
      <td class="p-3 text-xs">${s.Kelas || '-'}</td>
      <td class="p-3 text-[10px] text-slate-500 italic">${s.Dusun || '-'}, RT ${s.RT || 0}/RW ${s.RW || 0}</td>
      <td class="p-3 text-right space-x-2">
        <button onclick="editSiswaRow('${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}')" class="text-brand-blue hover:text-sky-700"><i class="fa fa-edit"></i></button>
        <button onclick="hapusDataSiswa('${s.NISN}', '${s.Nama.replace(/'/g, "\\'")}')" class="text-rose-500 hover:text-rose-700"><i class="fa fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

function editSiswaRow(encoded) {
    window.selectedSiswa = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    bukaModalSiswa('form');
}

function eksporDataSiswaExcel() {
    setLoading(true, "Menyiapkan Data...");
    window.electronAPI.ambilSemuaSiswa().then(data => {
        setLoading(false);
        if (!data || data.length === 0) { tampilkanToast("warning", "EKSPOR GAGAL", "Database siswa kosong."); return; }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Database_Siswa");
        XLSX.writeFile(wb, `Database_Siswa_${new Date().getFullYear()}.xlsx`);
        tampilkanToast("success", "BERHASIL", "File Excel diunduh.");
    }).catch(err => { setLoading(false); tampilkanToast("error", "ERROR", err.toString()); });
}

function downloadFormatSiswaExcel() {
    const headers = [
        "Nama", "NIS", "NISN", "Tempat_Lahir", "Tanggal_Lahir", "Nama_Ayah", "Nama_Ibu", "Kelas", "Tahun_Ajaran", "VA_PIP", "Rek_PIP", "Nomor_Ijazah", "Ket_Lulus",
        "Pendidikan Agama dan Budi Pekerti", "Pendidikan Pancasila", "Bahasa Indonesia", "Matematika", "Ilmu Pengetahuan Alam dan Sosial",
        "Pendidikan Jasmani, Olahraga, dan Kesehatan", "Seni dan Budaya", "Bahasa Inggris", "Bahasa Madura", "Baca Tulis Al Quran (BTA)"
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Database_Siswa");
    XLSX.writeFile(wb, "Format_Database_Siswa.xlsx");
    tampilkanToast("info", "DOWNLOAD", "Format Excel berhasil diunduh.");
}

// =============================================================
// MANAJEMEN ARSIP
// =============================================================
function muatDataArsip() {
    const searchArsip = document.getElementById('search_arsip');
    if (searchArsip) searchArsip.value = "";
    const box = document.getElementById('kontainer-arsip');
    if (box) box.innerHTML = Array(4).fill(0).map(() => `<div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 space-y-2"><div class="flex justify-between"><div class="h-3 w-20 skeleton-box rounded"></div><div class="h-3 w-12 skeleton-box rounded"></div></div><div class="h-4 w-full skeleton-box rounded"></div><div class="h-3 w-2/3 skeleton-box rounded"></div></div>`).join('');

    window.electronAPI.dapatkanRiwayatArsip().then(data => {
        window.cacheArsip = data || [];
        renderDaftarArsip(window.cacheArsip);
        if (typeof updateHeaderStats === "function") updateHeaderStats();
        if (typeof syncArchiveStatusUI === 'function') syncArchiveStatusUI();
        if (typeof renderDashboardCharts === 'function') renderDashboardCharts();
    }).catch(err => {
        if (box) box.innerHTML = `<div class="text-center text-xs text-rose-500 py-5">Gagal memuat arsip: ${escapeHTML(err.toString())}</div>`;
    });
}

let chartSuratInstance = null;
function renderDashboardCharts() {
    const ctx = document.getElementById('chartSurat');
    if (!ctx) return;

    // Hitung statistik arsip per bulan
    const arsip = window.cacheArsip || [];
    const monthlyCounts = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    arsip.forEach(item => {
        if (!item.tanggal) return;
        try {
            const d = new Date(item.tanggal);
            if (!isNaN(d.getTime())) {
                const m = d.getMonth();
                monthlyCounts[m] = (monthlyCounts[m] || 0) + 1;
            }
        } catch (e) { }
    });

    const dataPoints = months.map((m, i) => monthlyCounts[i] || 0);

    if (chartSuratInstance) {
        chartSuratInstance.destroy();
    }

    // Gunakan warna Tailwind untuk chart (sesuai tema)
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    chartSuratInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Jumlah Surat Keluar',
                data: dataPoints,
                backgroundColor: 'rgba(2, 132, 199, 0.7)',
                borderColor: 'rgba(2, 132, 199, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor, precision: 0 },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function renderDaftarArsip(data) {
    const box = document.getElementById('kontainer-arsip');
    if (!box) return;
    if (!data || data.length === 0) {
        box.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-center opacity-70">
          <svg class="w-16 h-16 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum Ada Arsip</span>
        </div>`;
        return;
    }
    box.innerHTML = data.map(row => `
    <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-blue transition-all cursor-default group relative">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[9px] font-mono font-bold text-brand-blue bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[180px]">${row.nomor}</span>
        <span class="text-[9px] text-slate-400 font-medium">${row.tanggal ? row.tanggal.split('T')[0] : "-"}</span>
      </div>
      <div class="text-[11px] font-bold text-slate-700 truncate pr-8 mb-0.5">${row.perihal || "(Tanpa Perihal)"}</div>
      <div class="text-[10px] text-slate-400 truncate italic">Kpd: ${row.penerima ? String(row.penerima).replace(/\n/g, " ") : "-"}</div>
      <button onclick="konfirmasiHapusArsip('${row.id}', '${row.nomor.replace(/'/g, "\\'")}')" class="absolute right-10 bottom-2 w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-200"><i class="fa fa-trash text-[10px]"></i></button>
      <button onclick="cetakUlangArsip('${btoa(unescape(encodeURIComponent(JSON.stringify(row))))}')" class="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center bg-brand-blue text-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-200"><i class="fa fa-file-import text-[10px]"></i></button>
    </div>`).join('');
}

function filterArsip(query) {
    if (!window.cacheArsip) return;
    const q = query.toLowerCase().trim();
    if (q === "") { renderDaftarArsip(window.cacheArsip); return; }
    const filtered = window.cacheArsip.filter(row => (row.nomor && row.nomor.toLowerCase().includes(q)) || (row.perihal && row.perihal.toLowerCase().includes(q)) || (row.penerima && row.penerima.toLowerCase().includes(q)));
    renderDaftarArsip(filtered);
}

function eksporArsipExcel() {
    Swal.fire({
        title: 'Cetak Agenda Surat',
        text: 'Masukkan tahun arsip yang ingin diekspor:',
        input: 'number',
        inputValue: new Date().getFullYear(),
        showCancelButton: true,
        confirmButtonText: 'Unduh Excel',
        confirmButtonColor: '#10b981',
        inputValidator: (val) => { if (!val) return 'Tahun wajib diisi!' }
    }).then((result) => {
        if (result.isConfirmed) {
            setLoading(true, "Menyusun Buku Agenda " + result.value + "...");
            window.electronAPI.ambilDataArsipUntukEkspor(result.value).then(data => {
                setLoading(false);
                if (!data || data.length === 0) { tampilkanToast("warning", "KOSONG", "Tidak ada rekaman."); return; }
                const n = document.getElementById('in_kop_sekolah')?.value || "SDN MOJOGEMI 02";
                const d = document.getElementById('in_kop_daerah')?.value || "";
                const s = document.getElementById('in_kop_sub')?.value || "";
                const a = document.getElementById('in_kop_alamat')?.value || "";
                const k = document.getElementById('in_kop_kontak')?.value || "";
                const header = [["", d.toUpperCase(), ""], ["", s.toUpperCase(), ""], ["[LOGO]", n.toUpperCase(), "[LOGO]"], ["", "AGENDA KELUAR TAHUN " + result.value, ""], ["", a + " | " + k, ""], [""]];
                const ws = XLSX.utils.aoa_to_sheet(header);
                XLSX.utils.sheet_add_json(ws, data, { origin: "A7" });
                ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 35 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Agenda");
                XLSX.writeFile(wb, `Buku_Agenda_Surat_Keluar_${result.value}.xlsx`);
                tampilkanToast("success", "BERHASIL", "Excel siap.");
            }).catch(err => { setLoading(false); tampilkanToast("error", "ERROR", err.toString()); });
        }
    });
}

function konfirmasiHapusArsip(id, nomor) {
    Swal.fire({
        title: 'Hapus Arsip?', text: `Hapus nomor ${nomor}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Hapus'
    }).then((result) => {
        if (result.isConfirmed) {
            setLoading(true, "Menghapus...");
            window.electronAPI.hapusDataArsip(id, nomor).then(res => {
                setLoading(false);
                if (res.status === "SUCCESS") { tampilkanToast("success", "TERHAPUS", res.message); muatDataArsip(); }
                else { tampilkanToast("error", "GAGAL", res.message); }
            }).catch(err => { setLoading(false); tampilkanToast("error", "ERROR", err.toString()); });
        }
    });
}

function cetakUlangArsip(encodedData) {
    try {
        const row = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
        if (document.getElementById('in_nomor')) document.getElementById('in_nomor').value = row.nomor || "";
        if (document.getElementById('in_perihal')) document.getElementById('in_perihal').value = row.perihal || "";
        if (document.getElementById('in_penerima')) document.getElementById('in_penerima').value = row.penerima || "";
        if (document.getElementById('in_lampiran')) document.getElementById('in_lampiran').value = row.lampiran || "-";
        if (document.getElementById('in_pembuka')) document.getElementById('in_pembuka').value = row.pembuka || "";
        if (document.getElementById('in_layout_type')) document.getElementById('in_layout_type').value = row.layout || "standard";
        setIsiEditorValue(row.isi || "");
        if (document.getElementById('in_tembusan')) document.getElementById('in_tembusan').value = row.tembusan || "";
        const inSid = document.getElementById('in_serial_id');
        if (inSid) { inSid.value = (row.sid && row.sid !== "N/A") ? row.sid : ""; shortUrlCache = ""; lastSidForShortening = ""; }
        const inputTgl = document.getElementById('in_tanggal');
        if (inputTgl && row.tanggal) { inputTgl.value = String(row.tanggal).includes('T') ? row.tanggal.split('T')[0] : row.tanggal; }

        switchTab('isi');
        if (typeof updateLivePreview === "function") updateLivePreview();

        const subjek = (row.perihal || "") + (row.isi || "");
        const isSiswa = ["siswa", "skl", "pip", "ijazah", "lulus", "raport", "nilai"].some(k => subjek.toLowerCase().includes(k));
        const isGuru = ["guru", "tugas", "pbm", "sk pbm", "pembagian tugas"].some(k => subjek.toLowerCase().includes(k));
        if (document.getElementById('section-pilih-siswa')) document.getElementById('section-pilih-siswa').classList.toggle('hidden', !isSiswa);
        if (document.getElementById('section-pilih-guru')) document.getElementById('section-pilih-guru').classList.toggle('hidden', !isGuru);

        if (row.ref_id) {
            if (isSiswa) {
                window.electronAPI.cariSiswa(row.ref_id).then(data => {
                    if (data && data.length > 0) { window.selectedSiswa = data[0]; if (document.getElementById('search_siswa')) document.getElementById('search_siswa').value = data[0].Nama; updateLivePreview(); }
                });
            } else if (isGuru) {
                window.electronAPI.cariGuru(row.ref_id).then(data => {
                    if (data && data.length > 0) { window.selectedGuru = data[0]; if (document.getElementById('search_guru')) document.getElementById('search_guru').value = data[0].Nama; updateLivePreview(); }
                });
            }
        }
        tampilkanToast("success", "ARSIP DIMUAT", "Data ditarik ke form.");
    } catch (e) { tampilkanToast("error", "GAGAL MEMUAT", "Data arsip corrupt."); }
}

function unduhSertifikat() {
    const card = document.getElementById('v-card');
    const noSurat = document.getElementById('v-no').innerText || "Sertifikat";
    setLoading(true, "Menyiapkan Gambar...");
    html2canvas(card, { scale: 2, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Sertifikat_Verifikasi_${noSurat.replace(/\//g, '_')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setLoading(false);
        tampilkanToast("success", "UNDUH SELESAI", "Sertifikat tersimpan.");
    });
}

// =============================================================
// MANAJEMEN GURU
// =============================================================
function filterGuru(query) {
    const resultsDiv = document.getElementById('guru_results_list');
    if (!resultsDiv || !query || query.length < 3) { resultsDiv.innerHTML = ""; resultsDiv.classList.add('hidden'); return; }
    window.electronAPI.cariGuru(query).then(data => {
        if (!data || data.length === 0) resultsDiv.innerHTML = '<div class="p-3 text-[10px] text-center italic">Tidak ditemukan...</div>';
        else {
            resultsDiv.innerHTML = data.map(g => {
                const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(g))));
                return `<div onclick="pilihGuru('${encoded}')" class="p-3 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"><div><b>${g.Nama}</b><br><span class="text-[9px]">NIP: ${g.NIP}</span></div>${window.isBatchModeGuru ? '<i class="fa fa-plus-circle text-blue-400"></i>' : ''}</div>`;
            }).join('');
        }
        resultsDiv.classList.remove('hidden');
    });
}

function isiDataGuruKeForm(guru) {
    if (!guru) return;
    document.getElementById('p1_nama').value = guru.Nama || '';
    document.getElementById('p1_nip').value = guru.NIP || '';
    document.getElementById('p1_jabatan').value = guru.Jabatan || '';
    document.getElementById('p1_pangkat').value = guru.Pangkat_Golongan || '';
    if (typeof updateLivePreview === "function") updateLivePreview();
}

function pilihGuru(encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
        if (window.isBatchModeGuru) {
            const isExist = window.selectedGuruList.some(g => g.Nama === data.Nama && g.NIP === data.NIP);
            if (!isExist) { window.selectedGuruList.push(data); tampilkanToast("success", "DITAMBAHKAN", `${data.Nama} masuk dalam antrean.`); }
            const searchInp = document.getElementById('search_guru');
            if (searchInp) { searchInp.value = ""; searchInp.focus(); }
            renderSelectedGuruList();
        } else {
            window.selectedGuru = data; document.getElementById('search_guru').value = data.Nama;
        }
        document.getElementById('guru_results_list').classList.add('hidden');
        if (typeof updateLivePreview === "function") updateLivePreview();
    } catch (e) { console.error(e); }
}

function toggleBatchModeGuru(val) {
    window.isBatchModeGuru = val;
    window.selectedGuruList = [];
    document.getElementById('guru_selected_list').classList.toggle('hidden', !val);
    if (typeof updateLivePreview === "function") updateLivePreview();
}

function renderSelectedGuruList() {
    const container = document.getElementById('guru_selected_list');
    container.innerHTML = window.selectedGuruList.map((g, i) => `<div class="flex items-center gap-1.5 px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded-lg">${g.Nama} <button onclick="window.selectedGuruList.splice(${i}, 1); renderSelectedGuruList(); updateLivePreview();"><i class="fa fa-times-circle"></i></button></div>`).join('');
    container.classList.toggle('hidden', window.selectedGuruList.length === 0);
}

function bukaModalGuru(tab = 'form') {
    const form = document.getElementById('form-guru'); form.reset(); switchTabGuru(tab);
    if (window.selectedGuru) { Object.keys(window.selectedGuru).forEach(k => { const input = form.querySelector(`[name="${k}"]`); if (input) input.value = window.selectedGuru[k]; }); document.getElementById('btn-hapus-guru').classList.remove('hidden'); }
    else { document.getElementById('btn-hapus-guru').classList.add('hidden'); }
    document.getElementById('modal-guru').classList.remove('hidden');
}

function tutupModalGuru() { document.getElementById('modal-guru').classList.add('hidden'); }

function switchTabGuru(target) {
    const formArea = document.getElementById('guru-tab-form'); const tableArea = document.getElementById('guru-tab-table');
    const btnForm = document.getElementById('tab-guru-form-btn'); const btnTable = document.getElementById('tab-guru-table-btn');
    if (target === 'form') { formArea.classList.remove('hidden'); tableArea.classList.add('hidden'); if (btnForm) btnForm.className = "py-2 border-b-2 border-brand-blue text-brand-blue"; if (btnTable) btnTable.className = "py-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600"; }
    else { formArea.classList.add('hidden'); tableArea.classList.remove('hidden'); if (btnForm) btnForm.className = "py-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600"; if (btnTable) btnTable.className = "py-2 border-b-2 border-brand-blue text-brand-blue"; muatTabelGuru(); }
}

function muatTabelGuru() {
    const container = document.getElementById('tabel-guru-body');
    document.querySelectorAll('#guru-tab-table input[data-filter-col]').forEach(i => i.value = '');
    container.innerHTML = Array(4).fill(0).map(() => `<tr class="border-b border-slate-50"><td class="p-3"><div class="h-4 w-32 skeleton-box rounded"></div></td><td class="p-3"><div class="h-4 w-24 skeleton-box rounded"></div></td><td class="p-3"><div class="h-4 w-20 skeleton-box rounded"></div></td><td class="p-3"><div class="h-4 w-8 ml-auto skeleton-box rounded"></div></td></tr>`).join('');
    window.electronAPI.ambilSemuaGuru().then(data => {
        window.fullCacheGuru = data || []; renderTabelGuru(window.fullCacheGuru); if (typeof updateHeaderStats === "function") updateHeaderStats();
    });
}

function filterTabelGuru() {
    const filters = {};
    document.querySelectorAll('#guru-tab-table input[data-filter-col]').forEach(input => { const val = input.value.trim().toLowerCase(); if (val) filters[input.dataset.filterCol] = val; });
    let filtered = window.fullCacheGuru;
    if (Object.keys(filters).length > 0) { filtered = window.fullCacheGuru.filter(g => { for (const col in filters) { if (!String(g[col] || '').toLowerCase().includes(filters[col])) return false; } return true; }); }
    renderTabelGuru(filtered);
}

function renderTabelGuru(data) {
    const container = document.getElementById('tabel-guru-body');
    if (!data || data.length === 0) { container.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Database kosong.</td></tr>'; return; }
    container.innerHTML = data.map(g => `<tr class="border-b border-slate-50 hover:bg-slate-50/50"><td class="p-3 text-xs font-bold text-slate-700">${g.Nama}</td><td class="p-3 text-xs font-mono">${g.NIP}</td><td class="p-3 text-xs">${g.Jabatan || '-'}</td><td class="p-3 text-right space-x-2"><button onclick="editGuruRow('${btoa(unescape(encodeURIComponent(JSON.stringify(g))))}')" class="text-brand-blue"><i class="fa fa-edit"></i></button><button onclick="hapusDataGuru('${g.NIP}', '${g.Nama.replace(/'/g, "\\'")}')" class="text-rose-500"><i class="fa fa-trash"></i></button></td></tr>`).join('');
}

function editGuruRow(encoded) {
    window.selectedGuru = JSON.parse(decodeURIComponent(escape(atob(encoded)))); bukaModalGuru('form');
}

function hapusDataGuru(nipManual, namaManual) {
    const nip = nipManual || document.querySelector('#form-guru [name="NIP"]').value; const nama = namaManual || document.querySelector('#form-guru [name="Nama"]').value;
    if (!nip && !nama) return;
    Swal.fire({ title: 'Hapus Guru?', text: `Data ${nama} akan dihapus.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Hapus' }).then(result => {
        if (result.isConfirmed) {
            setLoading(true, "Menghapus...");
            window.electronAPI.hapusGuru({ NIP: nip, Nama: nama }).then(res => {
                setLoading(false); tampilkanToast(res.status === "SUCCESS" ? "success" : "error", "HAPUS", res.message);
                if (res.status === "SUCCESS") { window.selectedGuru = null; if (!nipManual) tutupModalGuru(); muatTabelGuru(); updateLivePreview(); }
            });
        }
    });
}

function simpanDataGuru() {
    const form = document.getElementById('form-guru'); const data = {}; new FormData(form).forEach((v, k) => data[k] = v);
    setLoading(true, "Menyimpan...");
    window.electronAPI.simpanGuruBaru(data).then(res => {
        setLoading(false); tampilkanToast("success", "BERHASIL", res.message); tutupModalGuru(); muatTabelGuru(); updateLivePreview();
    });
}

function downloadFormatGuruExcel() {
    const ws = XLSX.utils.aoa_to_sheet([["Nama", "NIP", "NUPTK", "Jabatan", "Pangkat_Golongan", "Unit_Kerja", "Tugas_Utama", "Tugas_Tambahan"]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Database_Guru");
    XLSX.writeFile(wb, "Format_Database_Guru.xlsx");
}

function eksporDataGuruExcel() {
    window.electronAPI.ambilSemuaGuru().then(data => {
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Guru");
        XLSX.writeFile(wb, "Data_Guru.xlsx");
    });
}

function handleImporGuruExcel(event) {
    const file = event.target.files[0]; const reader = new FileReader();
    reader.onload = e => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (!jsonData || jsonData.length === 0) { tampilkanToast("error", "KOSONG", "Data kosong."); return; }
        setLoading(true, "Mengimpor...");
        window.electronAPI.imporGuruBatch(jsonData).then(res => {
            setLoading(false); Swal.fire('Selesai', res.message, 'success'); event.target.value = ""; muatTabelGuru();
        }).catch(err => { setLoading(false); Swal.fire('Gagal', err.toString(), 'error'); event.target.value = ""; });
    }; reader.readAsArrayBuffer(file);
}

// =============================================================
// SETTINGS, ADMIN USER & TEMPLATE (LAIN-LAIN)
// =============================================================
function bukaModalSettings() {
    document.getElementById('modal-settings').classList.remove('hidden');
    if (typeof loadKodeKlasifikasiSurat === "function") loadKodeKlasifikasiSurat();
    renderSettingsTemplateList();
}

function tutupModalSettings() {
    document.getElementById('modal-settings').classList.add('hidden');
}

function bukaManajemenUser() {
    bukaModalSettings();
    switchSettingsTab('user');
}

function renderSettingsTemplateList() {
    const list = document.getElementById('settings-template-list');
    if (!list || !window.cacheTemplates) return;
    if (window.cacheTemplates.length === 0) { list.innerHTML = '<div class="p-2 text-center text-slate-400">Kosong</div>'; return; }
    list.innerHTML = window.cacheTemplates.map(t => `<div class="flex justify-between p-2 hover:bg-slate-50"><span class="truncate pr-2 font-medium">${t.nama}</span><button onclick="hapusSatuTemplate('${t.nama.replace(/'/g, "\\'")}')" class="text-rose-500 hover:text-rose-700 px-1"><i class="fa fa-trash-alt"></i></button></div>`).join('');
}

function hapusSatuTemplate(nama) {
    Swal.fire({ title: 'Hapus Template?', text: `Hapus '${nama}'?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Hapus' }).then(res => {
        if (res.isConfirmed) {
            setLoading(true, "Menghapus...");
            window.electronAPI.hapusTemplateSatu(nama).then(response => {
                setLoading(false); if (response.status === "SUCCESS") { loadKoleksiDatabase(); setTimeout(renderSettingsTemplateList, 500); tampilkanToast("success", "TERHAPUS", response.message); }
            });
        }
    });
}

function switchSettingsTab(target) {
    ['umum', 'data', 'klasifikasi', 'user'].forEach(t => {
        const btn = document.getElementById(`set-tab-${t}`); const content = document.getElementById(`set-content-${t}`);
        if (btn && content) {
            if (t === target) { btn.className = "w-full flex gap-3 px-4 py-3 rounded-2xl bg-brand-blue text-white shadow-lg font-bold text-xs uppercase tracking-widest"; content.classList.remove('hidden'); }
            else { btn.className = "w-full flex gap-3 px-4 py-3 rounded-2xl hover:bg-slate-200 text-slate-500 font-bold text-xs uppercase tracking-widest"; content.classList.add('hidden'); }
        }
    });
    if (target === 'klasifikasi') loadKodeKlasifikasiSurat();
    if (target === 'user') muatTabelUserAdmin();
}

function simpanUserBaruAdmin() {
    const form = document.getElementById('form-mgmt-user');
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    if (!data.Username || !data.Password || !data.Nama_Lengkap) { tampilkanToast("error", "DATA KOSONG", "Harap isi semua kolom user."); return; }
    setLoading(true, "Menyimpan User...");
    window.electronAPI.simpanDatabaseUser(data).then(res => {
        setLoading(false);
        if (res.status === "SUCCESS") { tampilkanToast("success", "BERHASIL", res.message); form.reset(); muatTabelUserAdmin(); }
        else { tampilkanToast("error", "GAGAL", res.message); }
    }).catch(err => { setLoading(false); tampilkanToast("error", "ERROR", err.toString()); });
}

function muatTabelUserAdmin() {
    const container = document.getElementById('tabel-user-body');
    container.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat...</td></tr>';
    window.electronAPI.ambilSemuaUser().then(data => {
        if (!data || data.length === 0) { container.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Belum ada user.</td></tr>'; return; }
        container.innerHTML = data.map(u => `<tr class="border-b"><td class="p-3 font-bold">${u.Username}</td><td class="p-3">${u.Nama_Lengkap}</td><td class="p-3"><span class="px-2 py-0.5 rounded-full bg-slate-100 text-[8px] font-black">${u.Role}</span></td><td class="p-3 text-right"><button onclick="editUserAdmin('${btoa(unescape(encodeURIComponent(JSON.stringify(u))))}')" class="text-brand-blue mr-2"><i class="fa fa-edit"></i></button><button onclick="hapusUserAdmin('${u.Username}')" class="text-rose-500"><i class="fa fa-trash"></i></button></td></tr>`).join('');
    });
}

function editUserAdmin(encoded) {
    const u = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    const form = document.getElementById('form-mgmt-user');
    form.querySelector('[name="Username"]').value = u.Username; form.querySelector('[name="Password"]').value = u.Password;
    form.querySelector('[name="Nama_Lengkap"]').value = u.Nama_Lengkap; form.querySelector('[name="Role"]').value = u.Role;
    tampilkanToast("info", "EDIT", "Silakan ubah data.");
}

function hapusUserAdmin(username) {
    if (username === "admin") { tampilkanToast("error", "DITOLAK", "User admin utama tidak boleh dihapus."); return; }
    Swal.fire({ title: 'Hapus User?', text: `Cabut akses ${username}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Hapus' }).then(res => {
        if (res.isConfirmed) {
            setLoading(true);
            window.electronAPI.hapusUserDatabase(username).then(response => { setLoading(false); tampilkanToast(response.status === "SUCCESS" ? "success" : "error", "HAPUS", response.message); muatTabelUserAdmin(); });
        }
    });
}

// =============================================================
// SURAT MASUK & OCR
// =============================================================
let dataSuratMasukGlobal = [];
function bukaModalMasuk() { document.getElementById('modal-masuk').classList.remove('hidden'); }
function tutupModalMasuk() { document.getElementById('modal-masuk').classList.add('hidden'); }

function updateFileLabel(input) {
    const label = document.getElementById('label_file_masuk');
    if (input.files && input.files[0]) { label.innerText = input.files[0].name.toUpperCase(); label.classList.add('text-emerald-600'); }
}

function prosesSimpanSuratMasuk() {
    const asal = document.getElementById('in_masuk_asal').value; const nomor = document.getElementById('in_masuk_nomor').value;
    const perihal = document.getElementById('in_masuk_perihal').value; const tanggal = document.getElementById('in_masuk_tanggal').value;
    const fileInput = document.getElementById('file_surat_masuk');
    if (!asal || !nomor || !fileInput.files[0]) { tampilkanToast("error", "BELUM LENGKAP", "Mohon isi metadata dan file."); return; }
    setLoading(true, "Menganalisis Dokumen (OCR)...");
    const file = fileInput.files[0]; const reader = new FileReader();
    reader.onload = function (e) {
        const base64Data = e.target.result.split(',')[1];
        window.electronAPI.simpanSuratMasukOCR({ asal_surat: asal, nomor_asal: nomor, perihal: perihal, tanggal_terima: tanggal, operator: userSessionName }, base64Data, file.type).then(res => {
            setLoading(false);
            if (res.status === "SUCCESS") {
                tampilkanToast("success", "BERHASIL SCAN", res.message);
                const resultBox = document.getElementById('ocr_result_box'); const previewText = document.getElementById('ocr_preview_text');
                if (resultBox && previewText) { resultBox.classList.remove('hidden'); previewText.innerText = res.extracted; }
                document.getElementById('in_masuk_asal').value = ""; document.getElementById('in_masuk_nomor').value = ""; document.getElementById('in_masuk_perihal').value = ""; fileInput.value = ""; document.getElementById('label_file_masuk').innerText = "PILIH DOKUMEN";
                setTimeout(() => { tutupModalMasuk(); muatDataMasuk(); }, 2500);
            } else { tampilkanToast("error", "GAGAL", res.message); }
        });
    }; reader.readAsDataURL(file);
}

function muatDataMasuk() {
    const kontainer = document.getElementById('kontainer-masuk');
    if (kontainer) kontainer.innerHTML = `
        <div class="space-y-3">
            <div class="skeleton-box h-16 w-full rounded-xl"></div>
            <div class="skeleton-box h-16 w-full rounded-xl"></div>
            <div class="skeleton-box h-16 w-full rounded-xl"></div>
        </div>
    `;
    window.electronAPI.dapatkanRiwayatSuratMasuk().then(data => {
        window.dataSuratMasukGlobal = data;
        if (kontainer) renderListMasuk(data);
        updateHeaderStats();
    }).catch(err => {
        if (kontainer) kontainer.innerHTML = '<div class="text-center text-xs text-red-400 py-5">Gagal memuat data surat masuk.</div>';
    });
}

function renderListMasuk(data) {
    const kontainer = document.getElementById('kontainer-masuk'); kontainer.innerHTML = '';
    if (!data || data.length === 0) {
        kontainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 text-center opacity-70">
          <svg class="w-16 h-16 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Belum Ada Surat Masuk</span>
        </div>`;
        return;
    }
    data.forEach(item => {
        const linkFile = item.link && item.link !== '-' ? item.link : '#';
        const targetAttr = linkFile !== '#' ? 'target="_blank"' : '';
        const btnClass = linkFile !== '#' ? 'text-brand-blue hover:bg-brand-blue hover:text-white border-brand-blue/20' : 'text-slate-300 border-slate-200 cursor-not-allowed';
        const card = document.createElement('div'); card.className = 'p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 transition-all hover:shadow-md';
        card.innerHTML = `<div class="w-10 h-10 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center shadow-sm"><i class="fa fa-envelope-open-text text-sm"></i></div><div class="flex-1 min-w-0"><h4 class="text-xs font-bold text-slate-800 dark:text-white truncate leading-tight" title="${item.perihal || 'Tanpa Perihal'}">${item.perihal || 'Tanpa Perihal'}</h4><div class="text-[10px] text-slate-500 font-medium truncate flex gap-2 items-center mt-1"><span><i class="fa fa-building text-slate-400 mr-1"></i> ${item.asal || '-'}</span><span class="w-1 h-1 rounded-full bg-slate-300"></span><span><i class="fa fa-calendar-day text-slate-400 mr-1"></i> ${item.tanggal}</span></div></div><a href="${linkFile}" ${targetAttr} class="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border ${btnClass} transition-all shadow-sm" title="Pratinjau Dokumen"><i class="fa fa-file-pdf"></i></a>`;
        kontainer.appendChild(card);
    });
}

function filterMasuk(keyword) {
    if (!keyword) { renderListMasuk(dataSuratMasukGlobal); return; }
    const q = keyword.toLowerCase();
    renderListMasuk(dataSuratMasukGlobal.filter(item => (item.asal && item.asal.toLowerCase().includes(q)) || (item.perihal && item.perihal.toLowerCase().includes(q)) || (item.nomor && item.nomor.toLowerCase().includes(q))));
}

function eksporSuratMasukExcel() {
    Swal.fire({ title: 'Cetak Agenda Masuk', text: 'Masukkan tahun terima:', input: 'number', inputValue: new Date().getFullYear(), showCancelButton: true, confirmButtonText: 'Unduh Excel' }).then(res => {
        if (res.isConfirmed) {
            setLoading(true, "Menyusun Buku Agenda Masuk " + res.value + "...");
            window.electronAPI.ambilDataSuratMasukUntukEkspor(res.value).then(data => {
                setLoading(false); if (!data || data.length === 0) { tampilkanToast("warning", "KOSONG", "Tidak ada data."); return; }
                const n = document.getElementById('in_kop_sekolah')?.value || "SEKOLAH"; const d = document.getElementById('in_kop_daerah')?.value || ""; const s = document.getElementById('in_kop_sub')?.value || "";
                const header = [["", d.toUpperCase(), ""], ["", s.toUpperCase(), ""], ["[LOGO]", n.toUpperCase(), "[LOGO]"], ["", "AGENDA MASUK TAHUN " + res.value, ""], ["", "", ""], [""]];
                const ws = XLSX.utils.aoa_to_sheet(header); XLSX.utils.sheet_add_json(ws, data, { origin: "A7" });
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Masuk"); XLSX.writeFile(wb, `Buku_Agenda_Masuk_${res.value}.xlsx`);
                tampilkanToast("success", "BERHASIL", "Excel siap.");
            });
        }
    });
}

// =============================================================
// UTILITAS UI, TEMA, FORMATTING & STARTUP
// =============================================================
function toggleDarkMode() {
    const html = document.documentElement; const icon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) { html.classList.remove('dark'); localStorage.setItem('kliksurat_theme_mode', 'light'); icon.className = 'fa fa-moon'; }
    else { html.classList.add('dark'); localStorage.setItem('kliksurat_theme_mode', 'dark'); icon.className = 'fa fa-sun'; }
}

function changeAccentColor(color) {
    document.documentElement.style.setProperty('--brand-color', color); localStorage.setItem('kliksurat_accent_color', color); updateLivePreview(); tampilkanToast("success", "TEMA BERUBAH", "Aksen diperbarui.");
}

function applySavedTheme() {
    const html = document.documentElement; const icon = document.getElementById('theme-icon');
    if (localStorage.getItem('kliksurat_theme_mode') === 'dark') { html.classList.add('dark'); if (icon) icon.className = 'fa fa-sun'; }
    else { html.classList.remove('dark'); if (icon) icon.className = 'fa fa-moon'; }
    const col = localStorage.getItem('kliksurat_accent_color'); if (col) html.style.setProperty('--brand-color', col);
}

function formatNIPInput(el) { if (/[a-zA-Z]/.test(el.value)) tampilkanToast("warning", "FORMAT NIP", "NIP biasanya hanya berisi angka."); }

function mintaNomorOtomatis() {
    const kodeKlasifikasi = document.getElementById('in_kode_klasifikasi')?.value || "400.3.5";
    window.electronAPI.generateNomorSuratOtomatis(kodeKlasifikasi).then(nomorBaru => {
        document.getElementById('in_nomor').value = nomorBaru; if (typeof updateLivePreview === "function") updateLivePreview();
        tampilkanToast("success", "NOMOR DIGENERATE", "Nomor berikutnya dimasukkan.");
    }).catch(err => { console.error(err); tampilkanToast("error", "KESALAHAN SISTEM", "Gagal mendapatkan nomor otomatis."); });
}

function validasiNomorManual() {
    const el = document.getElementById('in_nomor'); const nomor = el.value.trim();
    if (!nomor) { el.classList.remove('border-red-500', 'ring-red-200'); return; }
    el.classList.add('opacity-50');
    const parts = nomor.split('/');
    if (parts.length < 4) {
        window.electronAPI.cekFullNomorDuplikat(nomor).then(isDuplikat => {
            el.classList.remove('opacity-50');
            if (isDuplikat) {
                tampilkanToast("warning", "NOMOR TERSEDIA", "Nomor ini sudah ada, sedang menyesuaikan...");
                el.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                mintaNomorOtomatis();
            }
        }).catch(err => {
            el.classList.remove('opacity-50');
            console.error("Duplicate Check Error:", err);
        });
        return;
    }
    const urutan = parts[1]; const tahun = parts[parts.length - 1];
    window.electronAPI.cekNomorDuplikat(urutan, tahun).then(status => {
        el.classList.remove('opacity-50');
        if (status === "DUPLICATE") {
            tampilkanToast("warning", "NOMOR DISESUAIKAN", `Nomor urut ${urutan} sudah digunakan. Menyesuaikan...`);
            el.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            mintaNomorOtomatis();
        } else if (status === "JUMP") {
            tampilkanToast("warning", "URUTAN DIPERBAIKI", `Nomor urut ${urutan} melompat. Mengembalikan ke urutan benar.`);
            el.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            mintaNomorOtomatis();
        } else if (status === "VALID") {
            el.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            tampilkanToast("success", "NOMOR TERSEDIA", "Nomor ini unik dan dapat digunakan.");
        }
    }).catch(err => {
        el.classList.remove('opacity-50');
        tampilkanToast("error", "KESALAHAN SERVER", "Gagal memvalidasi nomor. Periksa sistem backend.");
    });
}

function switchTab(target) {
    ['isi', 'redaksi', 'kop', 'ttd', 'arsip', 'masuk'].forEach(t => {
        const sec = document.getElementById(`section-${t}`); const btn = document.getElementById(`btn-tab-${t}`);
        if (sec) sec.classList.add('hidden');
        if (btn) { btn.classList.remove('border-brand-blue', 'text-brand-blue', 'bg-white'); btn.classList.add('border-transparent', 'text-slate-500', 'hover:bg-slate-100'); }
    });
    const targetSec = document.getElementById(`section-${target}`); const targetBtn = document.getElementById(`btn-tab-${target}`);
    if (targetSec) targetSec.classList.remove('hidden');
    if (targetBtn) { targetBtn.classList.remove('border-transparent', 'text-slate-500', 'hover:bg-slate-100'); targetBtn.classList.add('border-brand-blue', 'text-brand-blue', 'bg-white'); }
}

function tampilkanToast(tipe, judul, pesan) {
    const loginPage = document.getElementById('login-page');
    if (loginPage && !loginPage.classList.contains('hidden')) {
        const allowedTitles = ["AKSES DIBERIKAN", "AKSES DITOLAK", "ERROR SERVER", "MEMPROSES", "INFO SINKRONISASI", "BERHASIL SINKRON"];
        if (!allowedTitles.includes(judul.toUpperCase())) return;
    }

    const container = document.getElementById('toast-container'); if (!container) return;
    let bColor = "border-red-500", icon = "fa-circle-xmark text-red-600", bg = "bg-red-50";
    if (tipe === "success") { bColor = "border-emerald-500"; icon = "fa-circle-check text-emerald-600"; bg = "bg-emerald-50"; }
    else if (tipe === "warning") { bColor = "border-amber-500"; icon = "fa-triangle-exclamation text-amber-600"; bg = "bg-amber-50"; }
    else if (tipe === "info") { bColor = "border-blue-500"; icon = "fa-circle-info text-blue-600"; bg = "bg-blue-50"; }
    playToastSound(tipe);
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-white/95 backdrop-blur-md border shadow-xl translate-x-full transition-all duration-300 opacity-0 ${bColor}`;
    toast.innerHTML = `<div class="flex-shrink-0 w-8 h-8 rounded-xl ${bg} flex items-center justify-center"><i class="fa-solid ${icon}"></i></div><div class="flex-1"><h5 class="text-xs font-bold uppercase tracking-wide">${judul}</h5><p class="text-xs text-slate-500 mt-0.5">${pesan}</p></div>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full', 'opacity-0'), 10);
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 5000);
}

function playToastSound(tipe) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination); const now = ctx.currentTime;
        if (tipe === "success") { osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1); }
        else { osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(220, now + 0.2); }
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    } catch (e) { console.log("Audio not supported"); }
}

function setLoading(show, text = "") {
    const loader = document.getElementById('loading'); const loaderText = document.getElementById('loading-text');
    if (!loader) return;
    if (show) {
        if (loaderText) loaderText.innerText = text || "Memproses..."; loader.classList.remove('hidden'); setTimeout(() => loader.classList.replace('opacity-0', 'opacity-100'), 10);
    } else {
        loader.classList.replace('opacity-100', 'opacity-0'); setTimeout(() => loader.classList.add('hidden'), 300);
    }
}

function jalankanAutosave() {
    const draft = getCurrentDraftArchivePayload(); localStorage.setItem('kliksurat_draft_autosave', JSON.stringify(draft));
}

function muatDraftAutosave() {
    const saved = localStorage.getItem('kliksurat_draft_autosave'); if (!saved) return;
    try {
        const d = JSON.parse(saved);
        if (d.nomor || d.perihal || d.isi) {
            document.getElementById('in_nomor').value = d.nomor || ""; document.getElementById('in_perihal').value = d.perihal || "";
            document.getElementById('in_penerima').value = d.penerima || ""; document.getElementById('in_lampiran').value = d.lampiran || "-";
            document.getElementById('in_pembuka').value = d.pembuka || ""; document.getElementById('in_tembusan').value = d.tembusan || "";
            document.getElementById('in_tanggal').value = d.tanggal || ""; document.getElementById('in_serial_id').value = d.serial_id || "";
            if (document.getElementById('in_layout_type')) document.getElementById('in_layout_type').value = d.layout || "standard";
            setIsiEditorValue(d.isi || ""); updateLivePreview(); tampilkanToast("info", "DRAF DIPULIHKAN", "Sesi pengetikan terakhir dipulihkan.");
        }
    } catch (e) { console.warn("Gagal memuat draf autosave."); }
}

function eksporTemplates() {
    if (!window.cacheTemplates || window.cacheTemplates.length === 0) { tampilkanToast("warning", "EKSPOR GAGAL", "Tidak ada template."); return; }
    const blob = new Blob([JSON.stringify(window.cacheTemplates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `Backup_Template_${new Date().toISOString().split('T')[0]}.json`);
    link.click(); URL.revokeObjectURL(url); tampilkanToast("success", "SELESAI", "File template diunduh.");
}

function triggerImporTemplates() { document.getElementById('input_impor_template').click(); }

function bukaModalAbout() { document.getElementById('modal-about').classList.remove('hidden'); }
function tutupModalAbout() { document.getElementById('modal-about').classList.add('hidden'); }

function toggleSidebarCollapse() {
    const sidebar = document.getElementById('main-sidebar'); const icon = document.getElementById('sidebar-toggle-icon');
    if (sidebar.style.width === '0px') { sidebar.style.width = ''; sidebar.classList.remove('opacity-0'); icon.className = 'fa fa-chevron-left text-[10px]'; }
    else { sidebar.style.width = '0px'; sidebar.classList.add('opacity-0'); icon.className = 'fa fa-chevron-right text-[10px]'; }
    setTimeout(updateLivePreview, 305); setTimeout(adjustPreviewScaleMobile, 310);
}

function adjustPreviewScaleMobile() {
    if (window.innerWidth > 1024) { const area = document.getElementById('print-area'); if (area) { area.style.transform = ''; area.style.margin = ''; } return; }
    const pane = document.getElementById('preview-pane'); const area = document.getElementById('print-area');
    if (!pane || !area) return;
    const paperWidthPx = (document.getElementById('in_ukuran_kertas')?.value === 'size-f4' ? 215 : 210) * (96 / 25.4);
    const scale = Math.min(1, (pane.clientWidth - 32) / paperWidthPx);
    area.style.transform = `scale(${scale})`; area.style.transformOrigin = 'top center'; area.style.marginBottom = `-${area.offsetHeight * (1 - scale)}px`;
}
window.addEventListener('resize', adjustPreviewScaleMobile);

function toggleMobileView() {
    const dash = document.getElementById('main-dashboard'); const icon = document.getElementById('mobile-toggle-icon');
    mobileViewMode = (mobileViewMode === "editor") ? "preview" : "editor";
    dash.classList.toggle('mobile-focus-preview', mobileViewMode === "preview"); dash.classList.toggle('mobile-focus-editor', mobileViewMode === "editor");
    icon.className = (mobileViewMode === "preview") ? "fa fa-pen-nib text-xl" : "fa fa-eye text-xl";
    if (mobileViewMode === "preview") setTimeout(adjustPreviewScaleMobile, 50);
}

function updateHeaderStats() {
    const cont = document.getElementById('header-stats'); if (!cont) return;
    const incomingCount = (window.dataSuratMasukGlobal ? window.dataSuratMasukGlobal.length : 0);
    const s = [
        { l: 'Siswa', c: window.fullCacheSiswa.length, col: 'text-emerald-400', bg: 'bg-emerald-500/10', b: 'border-emerald-500/20', i: 'fa-user-graduate', act: "bukaModalSiswa('table')" },
        { l: 'Guru', c: window.fullCacheGuru.length, col: 'text-blue-400', bg: 'bg-blue-500/10', b: 'border-blue-500/20', i: 'fa-chalkboard-teacher', act: "bukaModalGuru('table')" },
        { l: 'Surat Masuk', c: incomingCount, col: 'text-sky-400', bg: 'bg-sky-500/10', b: 'border-sky-500/20', i: 'fa-envelope-open-text', act: "switchTab('masuk'); muatDataMasuk();" },
        { l: 'Arsip', c: window.cacheArsip.length, col: 'text-amber-400', bg: 'bg-amber-500/10', b: 'border-amber-500/20', i: 'fa-box-archive', act: "switchTab('arsip')" }
    ];
    cont.innerHTML = s.map(x => `<div class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl ${x.bg} border ${x.b} shadow-sm cursor-pointer" onclick="${x.act}" title="${x.c} Data ${x.l}"><i class="fa ${x.i} text-sm ${x.col}"></i><span class="text-xs font-black text-white">${x.c}</span></div>`).join('');
}

function setupDashboardUI() {
    if (globalAppName) {
        document.getElementById('app-title-login').innerText = globalAppName; document.getElementById('app-title-nav').innerText = globalAppName;
        if (document.getElementById('footer-app-name-meta')) document.getElementById('footer-app-name-meta').innerText = globalAppName;
        if (document.getElementById('about-app-for')) document.getElementById('about-app-for').innerText = globalAppName;
        if (document.getElementById('about-app-engine-name')) document.getElementById('about-app-engine-name').innerText = globalAppName + " Engine";
    }
    if (globalLogo) {
        const logoWithBuster = getLogoWithCacheBuster(globalLogo);
        if (document.getElementById('app-logo-login')) document.getElementById('app-logo-login').src = logoWithBuster;
        if (document.getElementById('brand-logo-nav')) document.getElementById('brand-logo-nav').src = logoWithBuster;
    }
}

function refreshUIIdentity(name, logo) {
    if (document.getElementById('app-title-nav')) document.getElementById('app-title-nav').innerText = name;
    if (document.getElementById('app-title-login')) document.getElementById('app-title-login').innerText = name;
    if (document.getElementById('footer-app-name-meta')) document.getElementById('footer-app-name-meta').innerText = name;
    if (document.getElementById('about-app-for')) document.getElementById('about-app-for').innerText = name;
    if (document.getElementById('about-app-engine-name')) document.getElementById('about-app-engine-name').innerText = name + " Engine";
    document.title = name;
    if (logo) {
        const logoWithBuster = getLogoWithCacheBuster(logo);
        if (document.getElementById('brand-logo-nav')) document.getElementById('brand-logo-nav').src = logoWithBuster;
        if (document.getElementById('app-logo-login')) document.getElementById('app-logo-login').src = logoWithBuster;
    }
}

function runVerificationMode(uid) {
    document.getElementById('login-page').classList.add('hidden');
    const vPage = document.getElementById('verification-page'); const vCard = document.getElementById('v-card');
    vPage.classList.remove('hidden'); setTimeout(() => { vPage.classList.replace('opacity-0', 'opacity-100'); vCard.classList.replace('scale-95', 'scale-100'); }, 100);
    document.getElementById('v-sid').innerText = uid || 'N/A';

    setLoading(true, "Verifikasi Dokumen...");
    window.electronAPI.verifikasiSuratByUid(uid).then(res => {
        if (res.status === "SUCCESS") {
            document.getElementById('v-no').innerText = res.no; document.getElementById('v-hal').innerText = res.hal; document.getElementById('v-ttd').innerText = res.ttd;
        } else {
            document.getElementById('v-no').innerText = "TIDAK VALID"; document.getElementById('v-hal').innerText = "Data Tidak Ditemukan";
            document.getElementById('v-desc').innerText = "Peringatan: Dokumen ini tidak terdaftar di database resmi.";
            document.getElementById('v-desc').className = "text-xs mb-8 italic leading-relaxed px-4 text-red-500 font-bold";
        }
        setLoading(false);
    }).catch(err => {
        document.getElementById('v-hal').innerText = "Error Koneksi Server"; document.getElementById('v-no').innerText = "NETWORK ERROR"; setLoading(false);
    });
}

function togglePassword() {
    const pwdInput = document.getElementById('password'); const eyeIcon = document.getElementById('eye-icon');
    if (pwdInput.type === "password") { pwdInput.type = "text"; eyeIcon.classList.remove('fa-eye'); eyeIcon.classList.add('fa-eye-slash'); }
    else { pwdInput.type = "password"; eyeIcon.classList.remove('fa-eye-slash'); eyeIcon.classList.add('fa-eye'); }
}

document.addEventListener("click", function (event) {
    const searchInput = document.getElementById('search_template'); const resultsList = document.getElementById('search_results_list');
    if (searchInput && resultsList && !searchInput.contains(event.target) && !resultsList.contains(event.target)) { resultsList.classList.add('hidden'); }
});


function initializeApp() {
    const urlParamsObj = new URLSearchParams(window.location.search);
    const mode = urlParamsObj.get('mode') || (typeof globalParams !== 'undefined' ? globalParams.mode : null);
    const id = urlParamsObj.get('id') || (typeof globalParams !== 'undefined' ? globalParams.id : null);

    if (mode === '1' && id) {
        runVerificationMode(id);
        return;
    }

    setupDashboardUI(); initTinyMCEEditor();
    if (typeof muatAwalSeluruhKonfigurasi === "function") muatAwalSeluruhKonfigurasi(true);
    if (typeof periksaSesiLoginOtomatis === "function") periksaSesiLoginOtomatis();

    setTimeout(() => {
        loadKoleksiDatabase(); muatDataArsip(); loadKodeKlasifikasiSurat(); muatDraftAutosave();
        setInterval(jalankanAutosave, 30000);
        if (document.fonts) document.fonts.ready.then(() => { if (typeof updateLivePreview === "function") updateLivePreview(); stabilkanLivePreviewSetelahLayout(); });
    }, 800);

    if (!webAppUrl || webAppUrl === "") {
        window.electronAPI.dapatkanUrlSkrip().then(url => {
            if (url) {
                webAppUrl = url.replace(/\/dev$/, "/exec");
                if (typeof updateLivePreview === "function") {
                    updateLivePreview();
                }
            }
        }).catch(err => console.warn(err));
    }

    if (window.electronAPI && typeof window.electronAPI.onDatabaseSynced === "function") {
        window.electronAPI.onDatabaseSynced(() => {
            console.log("Database disinkronkan dari cloud, memuat ulang konfigurasi...");
            muatAwalSeluruhKonfigurasi();
        });
    }

    if (window.electronAPI && typeof window.electronAPI.onSyncStatus === "function") {
        window.electronAPI.onSyncStatus((status, message) => {
            if (userSessionUsername && userSessionUsername !== "guest" && userSessionUsername !== "") {
                if (typeof tampilkanToast === "function") {
                    if (status === 'loading') {
                        tampilkanToast("info", "SINKRONISASI", message);
                    } else if (status === 'success') {
                        tampilkanToast("success", "SINKRONISASI", message);
                    } else if (status === 'error') {
                        tampilkanToast("warning", "SINKRONISASI", message);
                    }
                }
            }
        });
    }
}

function runVerificationMode(uid) {
    document.getElementById('login-page').classList.add('hidden');
    const vPage = document.getElementById('verification-page'); const vCard = document.getElementById('v-card');
    vPage.classList.remove('hidden'); setTimeout(() => { vPage.classList.replace('opacity-0', 'opacity-100'); vCard.classList.replace('scale-95', 'scale-100'); }, 100);

    document.getElementById('v-sid').innerText = uid || 'N/A';
    document.getElementById('v-no').innerText = "Memverifikasi...";
    document.getElementById('v-hal').innerText = "Mengambil data pangkalan...";
    document.getElementById('v-ttd').innerText = "Otoritas Sekolah";

    // Kembalikan injeksi identitas Branding di Sertifikat Verifikasi
    if (globalAppName) {
        document.getElementById('v-footer-app-name').innerText = globalAppName;
        document.getElementById('v-desc').innerText = `Informasi diverifikasi otomatis oleh Sistem Arsip ${globalAppName}`;
    }
    if (globalLogo) {
        const logoWithBuster = getLogoWithCacheBuster(globalLogo);
        if (document.getElementById('v-logo')) document.getElementById('v-logo').src = logoWithBuster;
        if (document.getElementById('v-watermark')) document.getElementById('v-watermark').src = logoWithBuster;
    }

    setLoading(true, "Verifikasi Dokumen...");
    window.electronAPI.verifikasiSuratByUid(uid).then(res => {
        if (res.status === "SUCCESS") {
            document.getElementById('v-no').innerText = res.no;
            document.getElementById('v-hal').innerText = res.hal;
            document.getElementById('v-ttd').innerText = res.ttd;
        } else {
            document.getElementById('v-no').innerText = "TIDAK VALID";
            document.getElementById('v-hal').innerText = "Data Tidak Ditemukan";
            document.getElementById('v-desc').innerText = "Peringatan: Dokumen ini tidak terdaftar di database resmi.";
            document.getElementById('v-desc').className = "text-xs mb-8 italic leading-relaxed px-4 text-red-500 font-bold";
        }
        setLoading(false);
    }).catch(err => {
        document.getElementById('v-hal').innerText = "Error Koneksi Server";
        document.getElementById('v-no').innerText = "NETWORK ERROR";
        setLoading(false);
    });
}

document.addEventListener("DOMContentLoaded", initializeApp);

function bukaModalSettingGasUrl() {
    window.electronAPI.dapatkanGasUrl().then(currentUrl => {
        Swal.fire({
            title: 'Pengaturan Server',
            text: 'Masukkan URL Web App Google Apps Script (GAS):',
            input: 'url',
            inputValue: currentUrl || '',
            showCancelButton: true,
            confirmButtonColor: '#0284c7',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            inputValidator: (value) => {
                if (!value) {
                    return 'URL tidak boleh kosong!';
                }
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    return 'URL harus diawali dengan http:// atau https://';
                }
            }
        }).then(res => {
            if (res.isConfirmed && res.value) {
                setLoading(true, "Memperbarui URL Server...");
                window.electronAPI.updateGasUrl(res.value).then(response => {
                    setLoading(false);
                    if (response.status === "SUCCESS") {
                        tampilkanToast("success", "URL DIPERBARUI", "Koneksi server diperbarui, menyinkronkan database.");
                    } else {
                        tampilkanToast("error", "GAGAL", response.message);
                    }
                }).catch(err => {
                    setLoading(false);
                    tampilkanToast("error", "ERROR", err.toString());
                });
            }
        });
    }).catch(err => {
        tampilkanToast("error", "ERROR", "Gagal membaca konfigurasi server.");
    });
}

// =============================================================
// NAVIGASI HALAMAN (NEXT/PREV) & SCROLL TRACKING
// =============================================================
function navigasiHalaman(arah) {
    const pane = document.getElementById('preview-pane');
    const pages = document.querySelectorAll('.page-sheet');
    if (!pane || pages.length === 0) return;

    let currentPageIdx = 0;
    let minDistance = Infinity;

    pages.forEach((p, index) => {
        const rect = p.getBoundingClientRect();
        // Cek jarak offset dari top viewport untuk menentukan halaman yang aktif
        const distance = Math.abs(rect.top - 80);
        if (distance < minDistance) {
            minDistance = distance;
            currentPageIdx = index;
        }
    });

    let targetIdx = currentPageIdx;
    if (arah === 'next' && currentPageIdx < pages.length - 1) {
        targetIdx++;
    } else if (arah === 'prev' && currentPageIdx > 0) {
        targetIdx--;
    }

    if (targetIdx !== currentPageIdx) {
        const targetElement = pages[targetIdx];
        const paneTop = pane.getBoundingClientRect().top;
        const targetTop = targetElement.getBoundingClientRect().top;
        // Hitung posisi scroll lokal agar tidak menggeser layout utama (header hilang)
        const scrollPos = pane.scrollTop + (targetTop - paneTop) - 32;
        pane.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
}

function kembaliKeAtas() {
    const pane = document.getElementById('preview-pane');
    if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
}

function perbaruiPenghitungHalaman() {
    const pages = document.querySelectorAll('.page-sheet');
    const elTotal = document.getElementById('total-page-val');
    const elCurrent = document.getElementById('current-page-val');

    if (!elTotal || !elCurrent || pages.length === 0) return;

    elTotal.innerText = pages.length;

    let currentPageIdx = 0;
    let minDistance = Infinity;
    pages.forEach((p, index) => {
        const rect = p.getBoundingClientRect();
        const distance = Math.abs(rect.top - 80);
        if (distance < minDistance) {
            minDistance = distance;
            currentPageIdx = index;
        }
    });
    elCurrent.innerText = currentPageIdx + 1;
}

document.addEventListener("DOMContentLoaded", () => {
    const pane = document.getElementById('preview-pane');
    if (pane) {
        pane.addEventListener('scroll', perbaruiPenghitungHalaman);
        // Observasi perubahan DOM di print-area jika ada penambahan halaman secara dinamis
        const printArea = document.getElementById('print-area');
        if (printArea) {
            const observer = new MutationObserver(perbaruiPenghitungHalaman);
            observer.observe(printArea, { childList: true, subtree: true });
        }
    }
});

// =============================================================
// CUSTOM PRINT PREVIEW
// =============================================================
async function siapkanDanCetak() {
    setLoading(true, "Menyiapkan Print Preview...");

    // Tampilkan modal print preview
    const modal = document.getElementById('modal-print-preview');
    if (modal) modal.classList.remove('hidden');

    const loadingLayer = document.getElementById('pp_loading');
    if (loadingLayer) loadingLayer.classList.remove('hidden');

    try {
        // Ambil daftar printer
        const printers = await window.electronAPI.ambilPrinters();
        const selectPrinter = document.getElementById('pp_printer_list');
        if (selectPrinter) {
            selectPrinter.innerHTML = '';

            printers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name;
                opt.textContent = p.displayName || p.name;
                if (p.isDefault) {
                    opt.selected = true;
                    opt.textContent += " (Default)";
                }
                selectPrinter.appendChild(opt);
            });
        }

        // Hasilkan PDF Pratinjau via IPC (main.js)
        const pdfResult = await window.electronAPI.generatePdfPreview();

        if (pdfResult && pdfResult.status === 'SUCCESS') {
            const byteCharacters = atob(pdfResult.buffer);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const frame = document.getElementById('pp_frame');
            if (frame) frame.src = url;
        } else {
            throw new Error(pdfResult ? pdfResult.message : "Gagal generate PDF");
        }

        if (loadingLayer) loadingLayer.classList.add('hidden');
        setLoading(false);
    } catch (err) {
        setLoading(false);
        tutupModalPrintPreview();
        if (typeof tampilkanToast === "function") {
            tampilkanToast('error', 'GAGAL PREVIEW', 'Gagal memuat pratinjau cetak: ' + err.message);
        } else if (typeof Swal !== 'undefined') {
            Swal.fire('Gagal', err.message, 'error');
        }
    }
}

function tutupModalPrintPreview() {
    const modal = document.getElementById('modal-print-preview');
    if (modal) modal.classList.add('hidden');

    const frame = document.getElementById('pp_frame');
    if (frame && frame.src) {
        URL.revokeObjectURL(frame.src);
        frame.src = '';
    }
}

async function eksekusiPrintSiluman() {
    const printerName = document.getElementById('pp_printer_list').value;
    const copies = parseInt(document.getElementById('pp_copies').value, 10) || 1;

    if (!printerName) {
        if (typeof tampilkanToast === "function") tampilkanToast('warning', 'PILIH PRINTER', 'Silakan pilih printer tujuan terlebih dahulu.');
        return;
    }

    const btn = document.getElementById('btn_execute_print');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mencetak...';
    btn.disabled = true;

    try {
        const result = await window.electronAPI.printDokumenKustom(printerName, copies);

        if (result && result.status === 'SUCCESS') {
            if (typeof tampilkanToast === "function") tampilkanToast('success', 'CETAK BERHASIL', 'Dokumen berhasil dikirim ke printer.');
            tutupModalPrintPreview();
        } else {
            if (typeof tampilkanToast === "function") tampilkanToast('error', 'CETAK GAGAL', result ? result.message : 'Terjadi kesalahan saat mencetak.');
        }
    } catch (err) {
        if (typeof tampilkanToast === "function") tampilkanToast('error', 'ERROR PRINT', err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// =============================================================
// AUTO UPDATER LISTENERS
// =============================================================
if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
    window.electronAPI.onUpdateAvailable(() => {
        if (typeof tampilkanToast === 'function') {
            tampilkanToast('info', 'Pembaruan Ditemukan', 'Mengunduh versi terbaru di latar belakang...');
        }
    });

    if (window.electronAPI.onUpdateProgress) {
        window.electronAPI.onUpdateProgress((progressObj) => {
            const container = document.getElementById('toast-container');
            if (!container) return;
            
            let progressToast = document.getElementById('update-progress-toast');
            if (!progressToast) {
                progressToast = document.createElement('div');
                progressToast.id = 'update-progress-toast';
                progressToast.className = `pointer-events-auto flex flex-col p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-brand-blue/30 shadow-xl transition-all duration-300 dark:bg-slate-800 dark:border-slate-700`;
                container.appendChild(progressToast);
            }
            
            const percent = Math.round(progressObj.percent || 0);
            const speed = (progressObj.bytesPerSecond / (1024 * 1024)).toFixed(2); // MB/s
            const transferred = (progressObj.transferred / (1024 * 1024)).toFixed(2);
            const total = (progressObj.total / (1024 * 1024)).toFixed(2);
            
            progressToast.innerHTML = `
                <div class="flex items-center gap-3 mb-2">
                    <div class="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center">
                        <i class="fa-solid fa-cloud-arrow-down text-brand-blue dark:text-blue-400"></i>
                    </div>
                    <div class="flex-1">
                        <h5 class="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Mengunduh Pembaruan...</h5>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${transferred} MB / ${total} MB (${speed} MB/s)</p>
                    </div>
                    <div class="font-bold text-brand-blue dark:text-blue-400 text-sm">${percent}%</div>
                </div>
                <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-brand-blue dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
                </div>
            `;
        });
    }

    window.electronAPI.onUpdateDownloaded(() => {
        const progressToast = document.getElementById('update-progress-toast');
        if (progressToast) {
            progressToast.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => progressToast.remove(), 300);
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Pembaruan Siap!',
                text: 'Versi terbaru aplikasi telah diunduh. Muat ulang sekarang untuk menginstal?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#0284c7',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Muat Ulang & Instal',
                cancelButtonText: 'Nanti Saja'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.electronAPI.restartApp();
                }
            });
        }
    });
}

if (window.electronAPI && window.electronAPI.onDatabaseSynced) {
    window.electronAPI.onDatabaseSynced(() => {
        if (typeof muatAwalSeluruhKonfigurasi === "function") {
            muatAwalSeluruhKonfigurasi(true);
        }
    });
}

// Auto-Sync saat koneksi internet pulih
window.addEventListener('online', () => {
    console.log("Koneksi internet terdeteksi pulih. Memulai auto-sync background...");
    if (typeof tampilkanToast === "function") tampilkanToast("success", "ONLINE", "Internet terhubung kembali. Memulai sinkronisasi...");
    if (window.electronAPI && window.electronAPI.sinkronisasiOtomatis) {
        window.electronAPI.sinkronisasiOtomatis().catch(err => console.error("Auto-sync error:", err));
    }
});
