const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

let initSqlJs;
let autoUpdater;

try {
    initSqlJs = require('sql.js');
    autoUpdater = require("electron-updater").autoUpdater;
} catch (error) {
    dialog.showErrorBox(
        "Gagal Memuat Aplikasi",
        "Komponen penting aplikasi tidak ditemukan.\nDetail: " + error.message + "\n\nSolusi: Harap buka Terminal di folder aplikasi ini dan jalankan perintah 'npm install', lalu coba buka kembali."
    );
    app.exit(1);
}

let GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbx_6UUpq0tDWJZoGwGSWA3FubRs4hkXdh34lzIdt4gEzIiNJh8tA-5wRg_6h7x5INv4/exec';

function loadLocalGasUrl() {
    try {
        const userDataPath = app.getPath('userData');
        const gasConfigPath = path.join(userDataPath, 'gas_config.json');
        if (fs.existsSync(gasConfigPath)) {
            const data = JSON.parse(fs.readFileSync(gasConfigPath, 'utf8'));
            if (data && data.gasUrl) {
                GAS_WEBAPP_URL = data.gasUrl;
                console.log("Loaded GAS Web App URL from config:", GAS_WEBAPP_URL);
            }
        } else {
            fs.writeFileSync(gasConfigPath, JSON.stringify({ gasUrl: GAS_WEBAPP_URL }, null, 2), 'utf8');
        }
    } catch (e) {
        console.error("Failed to load GAS URL config:", e);
    }
}

let db;

class Statement {
    constructor(stmt, dbInstance) {
        this.stmt = stmt;
        this.dbInstance = dbInstance;
    }

    run(...params) {
        try {
            this.stmt.bind(params);
            this.stmt.step();
            this.stmt.reset();
            this.dbInstance.save();
            return { changes: 1, lastInsertRowid: 0 };
        } catch (e) {
            this.stmt.reset();
            throw e;
        }
    }

    get(...params) {
        try {
            this.stmt.bind(params);
            const hasRow = this.stmt.step();
            const result = hasRow ? this.stmt.getAsObject() : undefined;
            this.stmt.reset();
            return result;
        } catch (e) {
            this.stmt.reset();
            throw e;
        }
    }

    all(...params) {
        try {
            this.stmt.bind(params);
            const results = [];
            while (this.stmt.step()) {
                results.push(this.stmt.getAsObject());
            }
            this.stmt.reset();
            return results;
        } catch (e) {
            this.stmt.reset();
            throw e;
        }
    }
}

class Database {
    constructor(dbPath, SQL) {
        this.dbPath = dbPath;
        this.SQL = SQL;
        this.inTransaction = false;
        let filebuffer;
        try {
            filebuffer = fs.readFileSync(dbPath);
        } catch (e) {
            filebuffer = null;
        }
        this.db = new this.SQL.Database(filebuffer);
    }

    exec(sql) {
        this.db.run(sql);
        this.save();
    }

    prepare(sql) {
        const stmt = this.db.prepare(sql);
        return new Statement(stmt, this);
    }

    transaction(fn) {
        return (...args) => {
            this.inTransaction = true;
            this.db.run('BEGIN TRANSACTION');
            try {
                const result = fn(...args);
                this.db.run('COMMIT');
                this.inTransaction = false;
                this.save();
                return result;
            } catch (e) {
                this.inTransaction = false;
                console.error("Transaction failed! Original database error:", e);
                try {
                    this.db.run('ROLLBACK');
                } catch (rollbackErr) {
                    console.error("Rollback also failed:", rollbackErr);
                }
                throw e;
            }
        };
    }

    pragma(sql) {
        try {
            this.db.run(`PRAGMA ${sql}`);
        } catch (e) { }
    }

    save() {
        if (this.inTransaction) return;
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }
}

// --- SETUP DATABASE (CREATE TABLES) ---
async function syncUsersFromCloud() {
    try {
        console.log("Memulai sinkronisasi user dari cloud...");
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ambilSemuaUser' })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
            const stmt = db.prepare('INSERT OR REPLACE INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)');
            const tx = db.transaction((userList) => {
                for (const u of userList) {
                    if (u.Username) {
                        stmt.run(u.Username, u.Password || '', u.Nama_Lengkap || '', u.Role || '');
                    }
                }
            });
            tx(result.data);
            console.log("Sinkronisasi user dari cloud berhasil. Jumlah user:", result.data.length);
        } else {
            console.warn("Gagal sinkronisasi user: Respons tidak valid atau status bukan SUCCESS. Respons:", JSON.stringify(result));
        }
    } catch (e) {
        console.error("Gagal sinkronisasi user dari cloud:", e);
    }
}

function sendSyncStatus(status, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status', status, message);
    }
}

async function syncDatabaseFromCloud() {
    try {
        sendSyncStatus('loading', 'Sinkronisasi offline: memeriksa data lokal...');
        console.log("Memulai sinkronisasi database dari cloud...");

        // PUSH OFFLINE SISWA
        try {
            const offlineSiswa = db.prepare('SELECT data FROM siswa WHERE is_offline = 1').all();
            for (const s of offlineSiswa) {
                const dataSiswa = JSON.parse(s.data);
                await fetch(GAS_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'simpanSiswaBaru', payload: dataSiswa })
                });
            }
            console.log(`Pushed ${offlineSiswa.length} offline siswa records to cloud.`);
        } catch (err) {
            console.error("Gagal push offline siswa:", err);
        }

        // PUSH OFFLINE GURU
        try {
            const offlineGuru = db.prepare('SELECT data FROM guru WHERE is_offline = 1').all();
            for (const g of offlineGuru) {
                const dataGuru = JSON.parse(g.data);
                await fetch(GAS_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'simpanGuruBaru', payload: dataGuru })
                });
            }
            console.log(`Pushed ${offlineGuru.length} offline guru records to cloud.`);
        } catch (err) {
            console.error("Gagal push offline guru:", err);
        }

        // PUSH OFFLINE ARSIP
        try {
            const offlineArsip = db.prepare('SELECT * FROM arsip WHERE is_offline = 1').all();
            for (const a of offlineArsip) {
                const payload = {
                    nomor: a.nomor, tanggal: a.tanggal, perihal: a.perihal, penerima: a.penerima,
                    lampiran: a.lampiran, pembuka: a.pembuka, isi: a.isi, tembusan: a.tembusan,
                    operator: a.operator, serial_id: a.sid, ref_id: a.ref_id, layout: a.layout
                };
                await fetch(GAS_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'simpanPaketSuratLengkap', payload: payload })
                });
            }
            if (offlineArsip.length > 0) console.log(`Pushed ${offlineArsip.length} offline arsip records to cloud.`);
        } catch (err) { console.error("Gagal push offline arsip:", err); }

        // PUSH OFFLINE MASUK
        try {
            const offlineMasuk = db.prepare('SELECT * FROM masuk WHERE is_offline = 1').all();
            for (const m of offlineMasuk) {
                const meta = { asal_surat: m.asal, nomor_asal: m.nomor, perihal: m.perihal, tanggal_terima: m.tanggal, operator: m.operator, ocrText: m.extracted, link: m.link };
                await fetch(GAS_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'simpanSuratMasukOCR', payload: { meta: meta, base64: null, mime: null } })
                });
            }
            if (offlineMasuk.length > 0) console.log(`Pushed ${offlineMasuk.length} offline surat masuk to cloud.`);
        } catch (err) { console.error("Gagal push offline masuk:", err); }

        // PUSH OFFLINE KLASIFIKASI
        try {
            const offlineKlasifikasi = db.prepare('SELECT * FROM klasifikasi WHERE is_offline = 1').all();
            for (const k of offlineKlasifikasi) {
                await fetch(GAS_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'tambahKodeKlasifikasiSurat', payload: { kode: k.kode, nama: k.nama } })
                });
            }
            if (offlineKlasifikasi.length > 0) console.log(`Pushed ${offlineKlasifikasi.length} offline klasifikasi to cloud.`);
        } catch (err) { console.error("Gagal push offline klasifikasi:", err); }

        sendSyncStatus('loading', 'Menyinkronkan data cloud ke lokal...');
        
        // 1. Sinkronisasi Pengaturan (Settings)
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ambilPengaturan' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && result.data) {
                const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
                const tx = db.transaction((data) => {
                    if (Array.isArray(data)) {
                        // Jika Google Apps Script mengembalikan array [{key: "App_Name", value: "KlikSurat"}] atau [{App_Name: "KlikSurat"}]
                        for (const item of data) {
                            if (item.key !== undefined && item.value !== undefined) {
                                stmt.run(item.key, String(item.value || ''));
                            } else {
                                for (const [k, v] of Object.entries(item)) {
                                    stmt.run(k, String(v || ''));
                                }
                            }
                        }
                    } else if (typeof data === 'object') {
                        // Jika kembalian berupa object langsung { App_Name: "KlikSurat", NPSN: "123" }
                        for (const [key, value] of Object.entries(data)) {
                            stmt.run(key, String(value || ''));
                        }
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi pengaturan berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi pengaturan:", e); }

        // 2. Sinkronisasi Master Template
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ambilSemuaTemplate' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                // Cari template lokal yang belum ada di cloud
                const localTemplatesRows = db.prepare('SELECT nama, data FROM templates').all();
                const cloudTemplateNames = result.data.map(t => t.nama);
                
                for (const row of localTemplatesRows) {
                    if (!cloudTemplateNames.includes(row.nama)) {
                        try {
                            const payload = { nama: row.nama, surat: JSON.parse(row.data) };
                            await fetch(GAS_WEBAPP_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'simpanTemplateDinamis', payload: payload })
                            });
                            console.log(`Berhasil push template lokal ke cloud: ${row.nama}`);
                        } catch (pushErr) {
                            console.error(`Gagal push template ${row.nama}:`, pushErr);
                        }
                    }
                }

                // Timpa/perbarui template lokal dengan data dari cloud
                const stmt = db.prepare('INSERT OR REPLACE INTO templates (nama, data) VALUES (?, ?)');
                const tx = db.transaction((list) => {
                    for (const t of list) {
                        if (t.nama) stmt.run(t.nama, JSON.stringify(t));
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi templates berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi templates:", e); }

        // 3. Sinkronisasi Arsip Surat Keluar
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dapatkanRiwayatArsip' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                db.exec('DELETE FROM arsip');
                const stmt = db.prepare(`INSERT INTO arsip (id, nomor, tanggal, perihal, penerima, lampiran, pembuka, isi, tembusan, operator, sid, ref_id, layout) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                const tx = db.transaction((list) => {
                    let currentId = Date.now();
                    for (const row of list) {
                        stmt.run(currentId--, row.nomor || '', row.tanggal || '', row.perihal || '', row.penerima || '', row.lampiran || '', row.pembuka || '', row.isi || '', row.tembusan || '', row.operator || '', row.sid || '', row.ref_id || '', row.layout || 'standard');
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi riwayat arsip berhasil.");
            }
        } catch (e) { 
            console.error("Gagal sinkronisasi arsip:", e); 
        }

        // 4. Sinkronisasi Surat Masuk
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dapatkanRiwayatSuratMasuk' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                db.exec('DELETE FROM masuk');
                const stmt = db.prepare('INSERT INTO masuk (id, asal, nomor, perihal, tanggal, operator, extracted, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                const tx = db.transaction((list) => {
                    let currentId = Date.now();
                    for (const row of list) {
                        stmt.run(currentId--, row.asal || '', row.nomor || '', row.perihal || '', row.tanggal || '', row.operator || '', row.ocr || '', row.link || '');
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi surat masuk berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi surat masuk:", e); }

        // 5. Sinkronisasi Guru
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ambilSemuaGuru' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                db.exec('DELETE FROM guru');
                const stmt = db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data, is_offline) VALUES (?, ?, ?, 0)');
                const tx = db.transaction((guruList) => {
                    for (const g of guruList) {
                        if (g.Nama) stmt.run(g.NIP || '-', g.Nama, JSON.stringify(g));
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi guru berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi guru:", e); }

        // 6. Sinkronisasi Siswa
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ambilSemuaSiswa' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                db.exec('DELETE FROM siswa');
                const stmt = db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data, is_offline) VALUES (?, ?, ?, 0)');
                const tx = db.transaction((siswaList) => {
                    for (const s of siswaList) {
                        stmt.run(s.NISN, s.Nama, JSON.stringify(s));
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi siswa berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi siswa:", e); }

        // 7. Sinkronisasi Kode Klasifikasi
        try {
            const res = await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ambilKodeKlasifikasiSurat' })
            });
            const result = await res.json();
            if (result.status === 'SUCCESS' && Array.isArray(result.data)) {
                db.exec('DELETE FROM klasifikasi');
                const stmt = db.prepare('INSERT OR REPLACE INTO klasifikasi (kode, nama) VALUES (?, ?)');
                const tx = db.transaction((list) => {
                    for (const k of list) {
                        stmt.run(k.kode, k.nama);
                    }
                });
                tx(result.data);
                console.log("Sinkronisasi kode klasifikasi berhasil.");
            }
        } catch (e) { console.error("Gagal sinkronisasi kode klasifikasi:", e); }

        // Kirim event ke renderer process bahwa sinkronisasi telah selesai
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('database-synced');
            sendSyncStatus('success', 'Proses sinkronisasi database selesai.');
            console.log("Mengirim event database-synced ke frontend.");
        }
    } catch (e) {
        console.error("Gagal sinkronisasi database cloud:", e);
        sendSyncStatus('error', 'Terjadi kesalahan saat sinkronisasi.');
    }
}

ipcMain.handle('sinkronisasi-otomatis', async () => {
    // Dipanggil dari frontend saat koneksi internet kembali aktif
    try {
        await syncDatabaseFromCloud();
        return { status: 'SUCCESS' };
    } catch (e) {
        return { status: 'ERROR', message: e.message };
    }
});

async function checkAndRunAutoBackup(dbPath) {
    try {
        const userDataPath = app.getPath('userData');
        const backupsDir = path.join(userDataPath, 'Backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        // Check last backup date in settings (we will do this via a local JSON since the DB is just initialized)
        const backupStatusPath = path.join(userDataPath, 'backup_status.json');
        let lastBackup = 0;
        if (fs.existsSync(backupStatusPath)) {
            try {
                const status = JSON.parse(fs.readFileSync(backupStatusPath, 'utf8'));
                lastBackup = status.lastBackup || 0;
            } catch (e) {}
        }

        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        
        if (now - lastBackup >= SEVEN_DAYS) {
            console.log("Running weekly auto-backup...");
            const dateObj = new Date();
            const dateStr = dateObj.toISOString().split('T')[0].replace(/-/g, '');
            const backupFile = path.join(backupsDir, `kliksurat_backup_${dateStr}.sqlite.gz`);

            if (fs.existsSync(dbPath)) {
                const gzip = zlib.createGzip();
                const source = fs.createReadStream(dbPath);
                const destination = fs.createWriteStream(backupFile);

                source.pipe(gzip).pipe(destination).on('finish', () => {
                    console.log(`Auto-backup completed: ${backupFile}`);
                    fs.writeFileSync(backupStatusPath, JSON.stringify({ lastBackup: now }), 'utf8');

                    // Keep only last 4 backups
                    try {
                        const files = fs.readdirSync(backupsDir)
                            .filter(f => f.startsWith('kliksurat_backup_') && f.endsWith('.sqlite.gz'))
                            .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
                            .sort((a, b) => b.time - a.time);

                        if (files.length > 4) {
                            for (let i = 4; i < files.length; i++) {
                                fs.unlinkSync(path.join(backupsDir, files[i].name));
                                console.log(`Deleted old backup: ${files[i].name}`);
                            }
                        }
                    } catch (cleanupErr) {
                        console.error("Error cleaning up old backups:", cleanupErr);
                    }
                }).on('error', (err) => {
                    console.error("Failed to write auto-backup:", err);
                });
            }
        }
    } catch (e) {
        console.error("Error during checkAndRunAutoBackup:", e);
    }
}

async function initDatabase() {
    const SQL = await initSqlJs();
    const dbPath = path.join(app.getPath('userData'), 'kliksurat_database.sqlite');
    db = new Database(dbPath, SQL);
    db.pragma('journal_mode = WAL'); // Performa lebih baik
    
    // Check and run auto-backup
    checkAndRunAutoBackup(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, nama TEXT, role TEXT);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS templates (nama TEXT PRIMARY KEY, data JSON);
        CREATE TABLE IF NOT EXISTS arsip (id INTEGER PRIMARY KEY AUTOINCREMENT, nomor TEXT, tanggal TEXT, perihal TEXT, penerima TEXT, lampiran TEXT, pembuka TEXT, isi TEXT, tembusan TEXT, operator TEXT, sid TEXT, ref_id TEXT, layout TEXT, is_offline INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS masuk (id INTEGER PRIMARY KEY AUTOINCREMENT, asal TEXT, nomor TEXT, perihal TEXT, tanggal TEXT, operator TEXT, extracted TEXT, link TEXT, is_offline INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS klasifikasi (kode TEXT PRIMARY KEY, nama TEXT, is_offline INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS siswa (nisn TEXT PRIMARY KEY, nama TEXT, data JSON, is_offline INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS guru (nip TEXT, nama TEXT, data JSON, is_offline INTEGER DEFAULT 0, PRIMARY KEY (nip, nama));
    `);

    // Migrasi skema untuk menambahkan kolom updated_at pada db yang sudah ada
    try { db.exec("ALTER TABLE arsip ADD COLUMN updated_at INTEGER DEFAULT 0;"); } catch (e) {}
    try { db.exec("ALTER TABLE masuk ADD COLUMN updated_at INTEGER DEFAULT 0;"); } catch (e) {}

    // Jalankan migrasi skema tabel guru jika diperlukan
    try {
        const tableInfo = db.prepare("PRAGMA table_info(guru)").all();
        const primaryKeys = tableInfo.filter(c => c.pk > 0);
        if (primaryKeys.length === 1 && primaryKeys[0].name === 'nip') {
            console.log("Mendeteksi skema tabel guru lama (pk nip saja). Melakukan migrasi...");
            db.exec(`
                ALTER TABLE guru RENAME TO guru_old;
                CREATE TABLE guru (nip TEXT, nama TEXT, data JSON, is_offline INTEGER DEFAULT 0, PRIMARY KEY (nip, nama));
                INSERT OR IGNORE INTO guru (nip, nama, data, is_offline) SELECT nip, nama, data, 0 FROM guru_old;
                DROP TABLE guru_old;
            `);
            console.log("Migrasi skema tabel guru sukses.");
        }
    } catch (e) {
        console.error("Gagal migrasi skema guru:", e);
        db.exec("CREATE TABLE IF NOT EXISTS guru (nip TEXT, nama TEXT, data JSON, is_offline INTEGER DEFAULT 0, PRIMARY KEY (nip, nama));");
    }

    // Jalankan migrasi penambahan kolom is_offline jika diperlukan
    try {
        const columns = db.prepare("PRAGMA table_info(siswa)").all();
        if (!columns.some(c => c.name === 'is_offline')) {
            db.exec("ALTER TABLE siswa ADD COLUMN is_offline INTEGER DEFAULT 0;");
            console.log("Migrasi kolom is_offline pada tabel siswa berhasil.");
        }
    } catch (e) { console.error("Gagal migrasi kolom is_offline siswa:", e); }

    try {
        const columns = db.prepare("PRAGMA table_info(guru)").all();
        if (!columns.some(c => c.name === 'is_offline')) {
            db.exec("ALTER TABLE guru ADD COLUMN is_offline INTEGER DEFAULT 0;");
            console.log("Migrasi kolom is_offline pada tabel guru berhasil.");
        }
    } catch (e) { console.error("Gagal migrasi kolom is_offline guru:", e); }

    // Migrasi tambahan untuk arsip, masuk, klasifikasi
    try {
        const columns = db.prepare("PRAGMA table_info(arsip)").all();
        if (!columns.some(c => c.name === 'is_offline')) db.exec("ALTER TABLE arsip ADD COLUMN is_offline INTEGER DEFAULT 0;");
    } catch (e) { console.error("Gagal migrasi is_offline arsip:", e); }

    try {
        const columns = db.prepare("PRAGMA table_info(masuk)").all();
        if (!columns.some(c => c.name === 'is_offline')) db.exec("ALTER TABLE masuk ADD COLUMN is_offline INTEGER DEFAULT 0;");
    } catch (e) { console.error("Gagal migrasi is_offline masuk:", e); }

    try {
        const columns = db.prepare("PRAGMA table_info(klasifikasi)").all();
        if (!columns.some(c => c.name === 'is_offline')) db.exec("ALTER TABLE klasifikasi ADD COLUMN is_offline INTEGER DEFAULT 0;");
    } catch (e) { console.error("Gagal migrasi is_offline klasifikasi:", e); }

    // Reset atau pastikan ada admin default jika tabel user masih kosong
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
        db.prepare('INSERT OR REPLACE INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)').run('admin', 'admin123', 'Administrator Utama', 'Operator Utama');
    }

    // Jalankan sinkronisasi user secara asinkron agar tidak menghambat startup window
    syncUsersFromCloud().catch(err => console.error("Gagal sinkronisasi user:", err));
    syncDatabaseFromCloud().catch(err => console.error("Gagal sinkronisasi database:", err));

    // Buat klasifikasi default jika belum ada
    const klasifikasiCount = db.prepare('SELECT COUNT(*) as count FROM klasifikasi').get().count;
    if (klasifikasiCount === 0) {
        const defaultKlasifikasi = [
            ["400.3.5", "Administrasi Sekolah"],
            ["005", "Undangan"],
            ["421.2", "Pendidikan Dasar"],
            ["421.3", "Kesiswaan"],
            ["421.5", "Kurikulum"],
            ["800", "Kepegawaian"],
            ["900", "Keuangan"],
            ["045", "Arsip/Dokumentasi"]
        ];
        const insertStmt = db.prepare('INSERT OR REPLACE INTO klasifikasi (kode, nama) VALUES (?, ?)');
        const tx = db.transaction((list) => {
            for (const item of list) insertStmt.run(item[0], item[1]);
        });
        tx(defaultKlasifikasi);
    }
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: "KlikSurat - SDN Mojogemi 02",
        icon: path.join(__dirname, 'assets', 'jember-ico.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Membantu memuat gambar lokal secara langsung
            zoomFactor: 0.67
        }
    });

    // Sembunyikan menu bar bawaan browser (File, Edit, dll)
    mainWindow.autoHideMenuBar = true;
    mainWindow.setMenuBarVisibility(false);
    mainWindow.webContents.setZoomFactor(0.67);
    mainWindow.maximize();
    mainWindow.loadFile('index.html');
}

app.whenReady().then(async () => {
    loadLocalGasUrl();
    // Salin logo default dari direktori artifact
    try {
        const assetsDir = path.join(__dirname, 'assets');
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }
        const destLogoPath = path.join(assetsDir, 'logo.png');
        const artifactDir = 'C:\\Users\\OPHIR\\.gemini\\antigravity-ide\\brain\\9ecd2f23-034a-440e-b4db-d1be5655c87c';
        if (fs.existsSync(artifactDir)) {
            const files = fs.readdirSync(artifactDir);
            const logoFile = files.find(f => f.startsWith('logo_') && (f.endsWith('.png') || f.endsWith('.jpg')));
            if (logoFile) {
                const sourceLogoPath = path.join(artifactDir, logoFile);
                fs.copyFileSync(sourceLogoPath, destLogoPath);
                console.log(`Logo copied successfully from ${sourceLogoPath} to assets/logo.png`);
            } else {
                console.warn("No logo file found in artifact directory.");
            }
        } else {
            console.warn("Artifact directory does not exist:", artifactDir);
        }
    } catch (e) {
        console.error("Gagal menyalin logo default:", e);
    }

    await initDatabase();
    createWindow();

    // Setup Auto Updater
    try {
        autoUpdater.checkForUpdatesAndNotify();
        autoUpdater.on('update-available', () => {
            if(mainWindow) mainWindow.webContents.send('update_available');
        });
        autoUpdater.on('download-progress', (progressObj) => {
            if(mainWindow) mainWindow.webContents.send('update_progress', progressObj);
        });
        autoUpdater.on('update-downloaded', () => {
            if(mainWindow) mainWindow.webContents.send('update_downloaded');
        });
    } catch(err) {
        console.error("AutoUpdater error:", err);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// =====================================================================
// IPC HANDLERS (JEMBATAN ANTARA BACKEND DB DAN FRONTEND RENDERER)
// =====================================================================

// 1. Auth & Users
ipcMain.handle('proses-login', (event, username, password) => {
    console.log("--- LOGIN DEBUG ---");
    console.log("INPUT USERNAME:", JSON.stringify(username));
    console.log("INPUT PASSWORD:", JSON.stringify(password));
    try {
        const allUsers = db.prepare('SELECT * FROM users').all();
        console.log("ALL REGISTERED USERS IN DB:", allUsers);
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
        console.log("MATCHING USER RESULT:", user);
        if (user) {
            console.log("LOGIN SUCCESSFUL");
            return { status: 'SUCCESS', nama: user.nama, role: user.role, username: user.username };
        }
    } catch (e) {
        console.error("LOGIN DB ERROR:", e);
    }
    console.log("LOGIN DENIED");
    return { status: 'ERROR', message: 'Username atau password salah!' };
});

ipcMain.handle('ambil-semua-user', () => {
    return db.prepare('SELECT username as Username, nama as Nama_Lengkap, role as Role, password as Password FROM users').all();
});

ipcMain.handle('simpan-database-user', async (event, data) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanDatabaseUser', payload: data })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('INSERT OR REPLACE INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)').run(data.Username, data.Password, data.Nama_Lengkap, data.Role);
            return { status: 'SUCCESS', message: 'User berhasil disimpan ke Cloud & Lokal.' };
        } else { throw new Error(result.message); }
    } catch (e) { 
        try {
            db.prepare('INSERT OR REPLACE INTO users (username, password, nama, role) VALUES (?, ?, ?, ?)').run(data.Username, data.Password, data.Nama_Lengkap, data.Role);
            return { status: 'SUCCESS', message: 'User disimpan secara lokal (Offline).' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message }; 
        }
    }
});

ipcMain.handle('perbarui-profil-user', async (event, userLama, dataBaru) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'perbaruiProfilUser', payload: { usernameLama: userLama, dataBaru: dataBaru } })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            const updateStmt = dataBaru.password
                ? db.prepare('UPDATE users SET username = ?, nama = ?, password = ? WHERE username = ?')
                : db.prepare('UPDATE users SET username = ?, nama = ? WHERE username = ?');
            if (dataBaru.password) updateStmt.run(dataBaru.username, dataBaru.nama, dataBaru.password, userLama);
            else updateStmt.run(dataBaru.username, dataBaru.nama, userLama);
            return { status: 'SUCCESS', message: 'Profil diperbarui di Cloud & Lokal.' };
        } else { throw new Error(result.message); }
    } catch (e) { 
        try {
            const updateStmt = dataBaru.password
                ? db.prepare('UPDATE users SET username = ?, nama = ?, password = ? WHERE username = ?')
                : db.prepare('UPDATE users SET username = ?, nama = ? WHERE username = ?');
            if (dataBaru.password) updateStmt.run(dataBaru.username, dataBaru.nama, dataBaru.password, userLama);
            else updateStmt.run(dataBaru.username, dataBaru.nama, userLama);
            return { status: 'SUCCESS', message: 'Profil diperbarui lokal (Offline).' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message }; 
        }
    }
});

ipcMain.handle('hapus-user-database', async (event, username) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusUserDatabase', payload: username })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('DELETE FROM users WHERE username = ?').run(username);
            return { status: 'SUCCESS', message: 'User dicabut dari Cloud & Lokal.' };
        } else { throw new Error(result.message); }
    } catch (e) { 
        try {
            db.prepare('DELETE FROM users WHERE username = ?').run(username);
            return { status: 'SUCCESS', message: 'User dicabut secara lokal (Offline).' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message }; 
        }
    }
});

// 2. Settings (Pengaturan)
ipcMain.handle('ambil-pengaturan', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const config = {};
    rows.forEach(r => config[r.key] = r.value);
    return config;
});

ipcMain.handle('simpan-pengaturan-kop', (event, data) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const tx = db.transaction((configObj) => {
            for (const [key, value] of Object.entries(configObj)) { stmt.run(key, value); }
        });
        tx(data);
        
        // Simpan ke cloud secara asinkron
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanPengaturanKop', payload: data })
        }).catch(err => console.error("Gagal simpan kop ke cloud:", err));

        return { status: 'SUCCESS', message: 'Pengaturan KOP berhasil disimpan.' };
    } catch (e) { return { status: 'ERROR', message: e.message }; }
});

ipcMain.handle('simpan-pengaturan-ttd', (event, data) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const tx = db.transaction((configObj) => {
            for (const [key, value] of Object.entries(configObj)) { stmt.run(key, value); }
        });
        tx(data);

        // Simpan ke cloud secara asinkron
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanPengaturanTtd', payload: data })
        }).catch(err => console.error("Gagal simpan ttd ke cloud:", err));

        return { status: 'SUCCESS', message: 'Pengaturan TTD berhasil disimpan.' };
    } catch (e) { return { status: 'ERROR', message: e.message }; }
});

ipcMain.handle('upload-file-logo', async (event, mime, base64, pos) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'uploadFileLogoKeDrive',
                payload: { dataMime: mime, base64Data: base64, namaKomponen: pos.toLowerCase() }
            })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            return { status: 'SUCCESS', url: result.url };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            const buffer = Buffer.from(base64, 'base64');
            const ext = mime.split('/')[1] || 'png';
            const filename = `logo_${pos.toLowerCase()}_${Date.now()}.${ext}`;
            const uploadDir = path.join(app.getPath('userData'), 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);
            return { status: 'SUCCESS', url: `file://${filePath}` };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

// 3. Arsip & Nomor
ipcMain.handle('generate-nomor-surat-otomatis', (event, kode) => {
    const tahun = new Date().getFullYear();
    const arsip = db.prepare('SELECT nomor FROM arsip WHERE nomor LIKE ? ORDER BY id DESC').all(`%/${tahun}`);
    let maxUrut = 0;
    arsip.forEach(r => {
        const parts = r.nomor.split('/');
        if (parts.length > 1) {
            const u = parseInt(parts[1], 10);
            if (!isNaN(u) && u > maxUrut) maxUrut = u;
        }
    });
    const nextUrut = String(maxUrut + 1).padStart(3, '0');
    
    // Ambil NPSN dan kode-kode dari tabel settings
    let npsn = "20523730";
    let kodeProvinsi = "35";
    let kodeKabupaten = "09";
    let kodeDinas = "310";
    let kodeKecamatan = "24";

    try {
        const settingsRows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?)').all('NPSN_Sekolah', 'Kode_Provinsi', 'Kode_Kabupaten', 'Kode_Dinas', 'Kode_Kecamatan');
        settingsRows.forEach(row => {
            if (row.value && row.value.trim() !== "") {
                if (row.key === 'NPSN_Sekolah') npsn = row.value.trim();
                if (row.key === 'Kode_Provinsi') kodeProvinsi = row.value.trim();
                if (row.key === 'Kode_Kabupaten') kodeKabupaten = row.value.trim();
                if (row.key === 'Kode_Dinas') kodeDinas = row.value.trim();
                if (row.key === 'Kode_Kecamatan') kodeKecamatan = row.value.trim();
            }
        });
    } catch (e) {}

    return `${kode}/${nextUrut}/${kodeProvinsi}.${kodeKabupaten}.${kodeDinas}.${kodeKecamatan}.${npsn}/${tahun}`;
});

ipcMain.handle('cek-nomor-duplikat', (event, urutan, tahun) => {
    const arsip = db.prepare('SELECT nomor FROM arsip WHERE nomor LIKE ?').all(`%/${urutan}/%/${tahun}`);
    return arsip.length > 0 ? "DUPLICATE" : "VALID";
});

ipcMain.handle('cek-full-nomor-duplikat', (event, nomor) => {
    const arsip = db.prepare('SELECT id FROM arsip WHERE nomor = ?').get(nomor);
    return !!arsip;
});

ipcMain.handle('simpan-paket-surat-lengkap', async (event, p) => {
    try {
        // Simpan ke cloud
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanPaketSuratLengkap', payload: p })
        });
        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            db.prepare(`INSERT INTO arsip (nomor, tanggal, perihal, penerima, lampiran, pembuka, isi, tembusan, operator, sid, ref_id, layout, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.nomor, p.tanggal, p.perihal, p.penerima, p.lampiran, p.pembuka, p.isi, p.tembusan, p.operator, p.serial_id, p.ref_id, p.layout, Date.now());
            
            // Trigger sync
            syncDatabaseFromCloud();
            return { status: 'SUCCESS' };
        } else {
            throw new Error(result.message || 'Gagal menyimpan ke cloud.');
        }
    } catch (e) {
        // Fallback simpan lokal saja jika offline
        try {
            db.prepare(`INSERT INTO arsip (nomor, tanggal, perihal, penerima, lampiran, pembuka, isi, tembusan, operator, sid, ref_id, layout, is_offline, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(p.nomor, p.tanggal, p.perihal, p.penerima, p.lampiran, p.pembuka, p.isi, p.tembusan, p.operator, p.serial_id, p.ref_id, p.layout, Date.now());
            return { status: 'SUCCESS', message: 'Tersimpan lokal (Offline)' };
        } catch (localErr) {
            throw new Error(localErr.message);
        }
    }
});

ipcMain.handle('dapatkan-riwayat-arsip', () => {
    return db.prepare('SELECT * FROM arsip ORDER BY id DESC LIMIT 200').all();
});

ipcMain.handle('hapus-data-arsip', async (event, id, nomor) => {
    try {
        db.prepare('DELETE FROM arsip WHERE id = ?').run(id);
        
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusDataArsip', payload: { id, nomor } })
        }).catch(err => console.error("Gagal hapus arsip di cloud:", err));

        return { status: 'SUCCESS', message: 'Arsip dihapus.' };
    } catch (e) { return { status: 'ERROR', message: e.message }; }
});

ipcMain.handle('ambil-data-arsip-untuk-ekspor', (event, tahun) => {
    return db.prepare('SELECT nomor as Nomor, tanggal as Tanggal, perihal as Perihal, penerima as Tujuan, operator as Eksekutor FROM arsip WHERE nomor LIKE ? ORDER BY id ASC').all(`%/${tahun}`);
});

// 4. Surat Masuk
ipcMain.handle('dapatkan-riwayat-surat-masuk', () => {
    return db.prepare('SELECT * FROM masuk ORDER BY id DESC LIMIT 100').all();
});

ipcMain.handle('simpan-surat-masuk-ocr', async (event, meta, b64, mime) => {
    try {
        // Simpan ke cloud
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'simpanSuratMasukOCR', 
                payload: { metadata: meta, base64Data: b64, mimeType: mime } 
            })
        });
        const result = await response.json();
        
        const buffer = Buffer.from(b64, 'base64');
        const ext = mime === 'application/pdf' ? 'pdf' : 'png';
        const filename = `masuk_${Date.now()}.${ext}`;
        const uploadDir = path.join(app.getPath('userData'), 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        if (result.status === 'SUCCESS') {
            db.prepare('INSERT INTO masuk (asal, nomor, perihal, tanggal, operator, extracted, link, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .run(meta.asal_surat, meta.nomor_asal, meta.perihal, meta.tanggal_terima, meta.operator, result.extracted || '', result.link || `file://${filePath}`, Date.now());
            
            // Sinkronkan riwayat setelah simpan
            syncDatabaseFromCloud();
            return { status: 'SUCCESS', message: 'Surat Masuk disimpan ke Cloud & Lokal.', extracted: result.extracted };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        // Fallback simpan lokal saja jika offline
        try {
            const buffer = Buffer.from(b64, 'base64');
            const ext = mime === 'application/pdf' ? 'pdf' : 'png';
            const filename = `masuk_${Date.now()}.${ext}`;
            const uploadDir = path.join(app.getPath('userData'), 'uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);

            db.prepare('INSERT INTO masuk (asal, nomor, perihal, tanggal, operator, extracted, link, is_offline, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
                .run(meta.asal_surat, meta.nomor_asal, meta.perihal, meta.tanggal_terima, meta.operator, "(Offline)", `file://${filePath}`, Date.now());
            return { status: 'SUCCESS', message: 'Tersimpan secara lokal (Offline).', extracted: 'Mode Offline' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

// 5. Template Surat
ipcMain.handle('ambil-semua-template', () => {
    return db.prepare('SELECT nama, data FROM templates').all().map(r => {
        let obj = JSON.parse(r.data);
        obj.nama = r.nama;
        return obj;
    });
});

ipcMain.handle('simpan-template-dinamis', async (event, payload) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanTemplateDinamis', payload: payload })
        });
        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            db.prepare('INSERT OR REPLACE INTO templates (nama, data) VALUES (?, ?)').run(payload.nama, JSON.stringify(payload.surat));
            return { status: 'SUCCESS' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('INSERT OR REPLACE INTO templates (nama, data) VALUES (?, ?)').run(payload.nama, JSON.stringify(payload.surat));
            return { status: 'SUCCESS', message: 'Tersimpan lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('hapus-template-satu', async (event, nama) => {
    try {
        db.prepare('DELETE FROM templates WHERE nama = ?').run(nama);
        
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusTemplateSatu', payload: nama })
        }).catch(err => console.error("Gagal hapus template di cloud:", err));

        return { status: 'SUCCESS', message: 'Template Dihapus.' };
    } catch (e) { return { status: 'ERROR', message: e.message }; }
});

ipcMain.handle('hapus-semua-template', async () => {
    try {
        db.prepare('DELETE FROM templates').run();
        
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusSemuaTemplate' })
        }).catch(err => console.error("Gagal hapus semua template di cloud:", err));

        return { status: 'SUCCESS', message: 'Semua template dibersihkan.' };
    } catch (e) { return { status: 'ERROR', message: e.message }; }
});

// 6. Siswa
ipcMain.handle('ambil-semua-siswa', async () => {
    try {
        // Mengambil data dari Google Apps Script Database
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ambilSemuaSiswa' })
        });

        const result = await response.json();

        if (result.status === 'SUCCESS') {
            // (Opsional) Sinkronisasikan ke SQLite lokal agar bisa dipakai saat offline
            const stmt = db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data) VALUES (?, ?, ?)');
            const tx = db.transaction((siswaList) => {
                for (const s of siswaList) stmt.run(s.NISN, s.Nama, JSON.stringify(s));
            });
            tx(result.data);

            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        console.error("Gagal koneksi ke GAS, memuat dari SQLite lokal:", e);
        // Fallback: Ambil dari cache lokal SQLite jika komputer sedang offline
        return db.prepare('SELECT data FROM siswa').all().map(r => JSON.parse(r.data));
    }
});

ipcMain.handle('simpan-siswa-baru', async (event, data) => {
    try {
        data.updated_at = Date.now();
        // Simpan ke Google Apps Script (Cloud)
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanSiswaBaru', payload: data })
        });
        const result = await response.json();

        if (result.status === 'SUCCESS') {
            // Simpan juga ke cache SQLite lokal
            db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data) VALUES (?, ?, ?)').run(data.NISN, data.Nama, JSON.stringify(data));
            return { status: 'SUCCESS', message: 'Data Tersimpan di Cloud & Lokal' };
        } else { throw new Error(result.message); }
    } catch (e) {
        try {
            db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data, is_offline) VALUES (?, ?, ?, 1)').run(data.NISN, data.Nama, JSON.stringify(data));
            return { status: 'SUCCESS', message: 'Tersimpan secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: 'Koneksi Cloud Gagal & Gagal Simpan Lokal: ' + localErr.message };
        }
    }
});

ipcMain.handle('hapus-siswa', async (event, nisn) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusSiswa', payload: nisn })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('DELETE FROM siswa WHERE nisn = ?').run(nisn);
            return { status: 'SUCCESS', message: 'Data Siswa Dihapus dari Cloud & Lokal' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('DELETE FROM siswa WHERE nisn = ?').run(nisn);
            return { status: 'SUCCESS', message: 'Data Siswa Dihapus secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: 'Gagal Hapus Lokal: ' + localErr.message };
        }
    }
});

// 7. Guru
ipcMain.handle('ambil-semua-guru', async () => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ambilSemuaGuru' })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.exec('DELETE FROM guru');
            const stmt = db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data) VALUES (?, ?, ?)');
            const tx = db.transaction((guruList) => {
                for (const g of guruList) {
                    if (g.NIP) stmt.run(g.NIP, g.Nama, JSON.stringify(g));
                }
            });
            tx(result.data);
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        console.error("Gagal koneksi ke GAS, memuat dari SQLite lokal:", e);
        return db.prepare('SELECT data FROM guru').all().map(r => JSON.parse(r.data));
    }
});

ipcMain.handle('cari-guru', (event, q) => {
    const query = `%${q}%`;
    return db.prepare('SELECT data FROM guru WHERE nama LIKE ? OR nip LIKE ? LIMIT 15').all(query, query).map(r => JSON.parse(r.data));
});

ipcMain.handle('simpan-guru-baru', async (event, data) => {
    try {
        data.updated_at = Date.now();
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'simpanGuruBaru', payload: data })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data) VALUES (?, ?, ?)').run(data.NIP, data.Nama, JSON.stringify(data));
            return { status: 'SUCCESS', message: 'Data Guru Disimpan ke Cloud & Lokal' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data, is_offline) VALUES (?, ?, ?, 1)').run(data.NIP, data.Nama, JSON.stringify(data));
            return { status: 'SUCCESS', message: 'Tersimpan secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('hapus-guru', async (event, payload) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusGuru', payload: payload })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('DELETE FROM guru WHERE nip = ? AND nama = ?').run(payload.NIP, payload.Nama);
            return { status: 'SUCCESS', message: 'Data Guru Dihapus dari Cloud & Lokal' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('DELETE FROM guru WHERE nip = ? AND nama = ?').run(payload.NIP, payload.Nama);
            return { status: 'SUCCESS', message: 'Data Guru Dihapus secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('dapatkan-url-skrip', () => { return GAS_WEBAPP_URL; });
ipcMain.handle('dapatkan-gas-url', () => { return GAS_WEBAPP_URL; });
ipcMain.handle('update-gas-url', async (event, url) => {
    try {
        GAS_WEBAPP_URL = url;
        const userDataPath = app.getPath('userData');
        const gasConfigPath = path.join(userDataPath, 'gas_config.json');
        fs.writeFileSync(gasConfigPath, JSON.stringify({ gasUrl: url }, null, 2), 'utf8');
        console.log("Updated GAS Web App URL config to:", GAS_WEBAPP_URL);
        
        // Trigger syncs immediately using the new URL
        syncUsersFromCloud().catch(err => console.error("Gagal sync users setelah update URL:", err));
        syncDatabaseFromCloud().catch(err => console.error("Gagal sync database setelah update URL:", err));
        return { status: 'SUCCESS', message: 'GAS URL berhasil diperbarui.' };
    } catch (e) {
        return { status: 'ERROR', message: e.message };
    }
});
ipcMain.handle('log-to-terminal', (e, level, msg) => { console.log(`[${level.toUpperCase()}] ${msg}`); });

// 8. Klasifikasi Handlers
ipcMain.handle('ambil-kode-klasifikasi-surat', () => {
    return db.prepare('SELECT kode, nama FROM klasifikasi').all();
});

ipcMain.handle('hapus-kode-klasifikasi', async (event, kode) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hapusKodeKlasifikasi', payload: kode })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('DELETE FROM klasifikasi WHERE kode = ?').run(kode);
            return { status: 'SUCCESS', message: 'Kode klasifikasi berhasil dihapus.' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('DELETE FROM klasifikasi WHERE kode = ?').run(kode);
            return { status: 'SUCCESS', message: 'Terhapus secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('tambah-kode-klasifikasi-surat', async (event, data) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'tambahKodeKlasifikasiSurat', payload: data })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            db.prepare('INSERT OR REPLACE INTO klasifikasi (kode, nama) VALUES (?, ?)').run(data.kode, data.nama);
            return { status: 'SUCCESS', message: 'Kode klasifikasi berhasil disimpan.' };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            db.prepare('INSERT OR REPLACE INTO klasifikasi (kode, nama, is_offline) VALUES (?, ?, 1)').run(data.kode, data.nama);
            return { status: 'SUCCESS', message: 'Tersimpan secara lokal (Offline)' };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

// 9. Batch Imports Handlers
ipcMain.handle('impor-templates-batch', async (event, templates) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'imporTemplatesBatch', payload: templates })
        });
        const result = await response.json();
        if (result.status === 'SUCCESS') {
            const insertStmt = db.prepare('INSERT OR REPLACE INTO templates (nama, data) VALUES (?, ?)');
            const tx = db.transaction((list) => {
                for (const t of list) {
                    insertStmt.run(t.nama, JSON.stringify(t));
                }
            });
            tx(templates);
            return { status: 'SUCCESS', message: `${templates.length} template berhasil diimpor ke Cloud & Lokal.` };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            const insertStmt = db.prepare('INSERT OR REPLACE INTO templates (nama, data) VALUES (?, ?)');
            const tx = db.transaction((list) => {
                for (const t of list) {
                    insertStmt.run(t.nama, JSON.stringify(t));
                }
            });
            tx(templates);
            return { status: 'SUCCESS', message: `${templates.length} template disimpan secara lokal (Offline)` };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('impor-siswa-batch', async (event, siswaList) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'imporSiswaBatch', payload: siswaList })
        });
        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            const stmt = db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data) VALUES (?, ?, ?)');
            const tx = db.transaction((list) => {
                for (const s of list) {
                    stmt.run(s.NISN, s.Nama, JSON.stringify(s));
                }
            });
            tx(siswaList);
            return { status: 'SUCCESS', message: `${siswaList.length} data siswa berhasil diimpor ke Cloud & Lokal.` };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO siswa (nisn, nama, data, is_offline) VALUES (?, ?, ?, 1)');
            const tx = db.transaction((list) => {
                for (const s of list) {
                    stmt.run(s.NISN, s.Nama, JSON.stringify(s));
                }
            });
            tx(siswaList);
            return { status: 'SUCCESS', message: `${siswaList.length} data siswa disimpan secara lokal (Offline)` };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

ipcMain.handle('impor-guru-batch', async (event, guruList) => {
    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'imporGuruBatch', payload: guruList })
        });
        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            const stmt = db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data) VALUES (?, ?, ?)');
            const tx = db.transaction((list) => {
                for (const g of list) {
                    stmt.run(g.NIP || '-', g.Nama, JSON.stringify(g));
                }
            });
            tx(guruList);
            return { status: 'SUCCESS', message: `${guruList.length} data guru berhasil diimpor ke Cloud & Lokal.` };
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO guru (nip, nama, data, is_offline) VALUES (?, ?, ?, 1)');
            const tx = db.transaction((list) => {
                for (const g of list) {
                    stmt.run(g.NIP || '-', g.Nama, JSON.stringify(g));
                }
            });
            tx(guruList);
            return { status: 'SUCCESS', message: `${guruList.length} data guru disimpan secara lokal (Offline)` };
        } catch (localErr) {
            return { status: 'ERROR', message: localErr.message };
        }
    }
});

// 10. Missing Search & Export Handlers
ipcMain.handle('cari-siswa', (event, q) => {
    const query = `%${q}%`;
    return db.prepare('SELECT data FROM siswa WHERE nama LIKE ? OR nisn LIKE ? LIMIT 15').all(query, query).map(r => JSON.parse(r.data));
});

ipcMain.handle('ambil-data-surat-masuk-untuk-ekspor', (event, tahun) => {
    return db.prepare('SELECT nomor as Nomor, tanggal as Tanggal, asal as Asal, perihal as Perihal, operator as Eksekutor FROM masuk WHERE tanggal LIKE ? ORDER BY id ASC').all(`${tahun}-%`);
});

// 11. Document Verification Handler
ipcMain.handle('verifikasi-surat-by-uid', (event, uid) => {
    try {
        const row = db.prepare('SELECT nomor, perihal, operator FROM arsip WHERE sid = ?').get(uid);
        if (row) {
            return {
                status: 'SUCCESS',
                no: row.nomor,
                hal: row.perihal,
                ttd: row.operator
            };
        } else {
            return { status: 'ERROR', message: 'Dokumen tidak ditemukan.' };
        }
    } catch (e) {
        return { status: 'ERROR', message: e.message };
    }
});

// 12. Print Preview Handlers
ipcMain.handle('ambil-printers', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers;
    }
    return [];
});

ipcMain.handle('generate-pdf-preview', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            // Kita simpan ke buffer PDF secara virtual
            const pdfBuffer = await mainWindow.webContents.printToPDF({
                marginsType: 0, // margin default (disetel manual di HTML)
                printBackground: true,
                pageSize: 'A4' // atau sesuaikan dengan config kertas
            });
            return { status: 'SUCCESS', buffer: pdfBuffer.toString('base64') };
        } catch (e) {
            return { status: 'ERROR', message: e.message };
        }
    }
    return { status: 'ERROR', message: 'Window not found' };
});

ipcMain.handle('simpan-sebagai-pdf', async (event, defaultName) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            const pdfBuffer = await mainWindow.webContents.printToPDF({
                marginsType: 0,
                printBackground: true,
                pageSize: 'A4'
            });
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Simpan PDF Surat',
                defaultPath: defaultName || 'Surat.pdf',
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });
            if (filePath) {
                fs.writeFileSync(filePath, pdfBuffer);
                return { status: 'SUCCESS', path: filePath };
            } else {
                return { status: 'CANCELED' };
            }
        } catch (e) {
            return { status: 'ERROR', message: e.message };
        }
    }
    return { status: 'ERROR', message: 'Window not found' };
});

ipcMain.handle('print-dokumen-kustom', async (event, printerName, copies) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            return new Promise((resolve) => {
                mainWindow.webContents.print({
                    silent: true,
                    deviceName: printerName,
                    copies: parseInt(copies) || 1,
                    printBackground: true,
                    marginsType: 0
                }, (success, failureReason) => {
                    if (success) {
                        resolve({ status: 'SUCCESS' });
                    } else {
                        resolve({ status: 'ERROR', message: failureReason });
                    }
                });
            });
        } catch (e) {
            return { status: 'ERROR', message: e.message };
        }
    }
    return { status: 'ERROR', message: 'Window not found' };
});

ipcMain.handle('restart_app', () => {
    autoUpdater.quitAndInstall();
});