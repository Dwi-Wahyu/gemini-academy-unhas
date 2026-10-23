# Gemini Academy — React + Next.js + MySQL

Konversi dari sumber Laravel yang dilampirkan. React digunakan untuk antarmuka, Next.js App Router untuk halaman dan API, MySQL untuk data. Tidak memerlukan PHP/Laravel.

## Menjalankan

Gunakan Node.js 22.12+ atau 24 LTS dan MySQL 8. Buat database `gemini_academy` serta akun database yang memiliki izin membuat tabel dan membaca/menulis data.

```bash
npm ci
cp .env.example .env
# Edit .env sesuai akun MySQL Anda
npm run db:setup
# Password dibaca dari environment; hindari menyimpan password di riwayat shell:
read -s -p "Password admin: " ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run admin:create
unset ADMIN_PASSWORD
npm run dev
```

Buka http://localhost:3000 dan /admin/login. Perintah read di atas untuk Bash (Linux/WSL); pada sistem lain atur environment ADMIN_PASSWORD secara aman. Password minimal 12 karakter, maksimal 72 byte. Tidak ada akun atau password bawaan.

## Produksi

Set APP_ORIGIN ke URL HTTPS publik yang tepat (tanpa slash akhir), isi konfigurasi MySQL, lalu `npm run build` dan `npm start`. Letakkan di belakang reverse proxy HTTPS; cookie admin produksi bersifat Secure. Jangan gunakan static export karena aplikasi membutuhkan server Node.js. Jalankan `npm test` untuk pengujian validasi dan Excel.

## Fitur yang dipertahankan

- Pendaftaran: nama, NIP 18 digit unik, unit kerja, WhatsApp Indonesia, email Unhas opsional.
- Dua sesi, masing-masing 230 peserta, pembaruan kuota setiap 15 detik.
- Transaksi InnoDB dengan UPDATE bersyarat dan indeks unik NIP mencegah kelebihan kuota dan peserta ganda.
- Bukti pendaftaran privat lewat cookie HttpOnly, dapat dicetak; berlaku satu jam pada browser yang sama.
- Login admin, sesi opaque tersimpan di MySQL (8 jam), logout/revokasi, pembatasan 5 kegagalan login per email selama satu menit.
- Dashboard statistik, pencarian, filter sesi, paginasi 25 peserta, detail, Excel (.xlsx) mengikuti filter pencarian dan sesi. NIP serta WhatsApp disimpan sebagai teks agar digit tetap utuh. Nilai pengguna ditulis sebagai teks, bukan formula.
- Waktu pendaftaran disimpan UTC dan ditampilkan WITA. Data admin/API tidak di-cache; mutasi diperiksa origin-nya.

## Struktur

`app/` halaman React dan API Next.js; `lib/` database, autentikasi, validasi; `database/schema.sql` skema; `scripts/` setup dan pembuatan admin; `tests/` pengujian.

## Data Laravel lama

Paket konversi tidak berisi data produksi. Backup dahulu. Untuk memakai database Laravel lama dengan tabel bawaan ZIP, jalankan db:setup: tabel bisnis yang sudah ada dipertahankan, dan tabel sesi admin/login ditambahkan. Seed menggunakan ID sesi 1 dan 2 tanpa menimpa nilai yang sudah ada. Pastikan struktur dan ID sesi sesuai sumber serta koneksi Laravel lama memang menggunakan UTC sebelum menggabungkan data. Akun bcrypt Laravel dapat digunakan; akun Argon perlu dibuat ulang melalui CLI dengan email berbeda. Sesi login Laravel tidak dibawa. Kolom unit kerja tetap input teks, sesuai ZIP sumber.

## Batas verifikasi

Lihat VERIFICATION.md untuk hasil pengujian aktual. Uji alur database dan konkurensi wajib dilakukan pada MySQL pengembangan sebelum produksi. Tidak ada email/WhatsApp otomatis pada aplikasi sumber maupun hasil konversi.
