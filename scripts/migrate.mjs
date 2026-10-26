import { readFile } from 'node:fs/promises';
import { db } from '../lib/db.js';

async function migrate() {
  console.log('Memulai migrasi database...');
  try {
    // 1. Buat tabel schedules jika belum ada
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Cek apakah kolom schedule_id sudah ada di tabel academy_sessions
    const [colsSchedule] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academy_sessions' AND COLUMN_NAME = 'schedule_id'
    `);

    if (colsSchedule.length === 0) {
      console.log('-> Menambahkan kolom schedule_id ke tabel academy_sessions...');
      await db.query(`
        ALTER TABLE academy_sessions
        ADD COLUMN schedule_id BIGINT UNSIGNED NULL AFTER id,
        ADD CONSTRAINT fk_academy_sessions_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      `);
    }

    // 3. Cek apakah kolom allowed_professions sudah ada di tabel academy_sessions
    const [colsAllowed] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academy_sessions' AND COLUMN_NAME = 'allowed_professions'
    `);

    if (colsAllowed.length === 0) {
      console.log('-> Menambahkan kolom allowed_professions ke tabel academy_sessions...');
      await db.query(`
        ALTER TABLE academy_sessions
        ADD COLUMN allowed_professions VARCHAR(255) NULL DEFAULT 'ALL' AFTER ends_at
      `);
    }

    // 4. Perlebar kolom nip pada tabel participants untuk mendukung NIM mahasiswa (sampai 30 char)
    const [nipCol] = await db.query(`
      SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participants' AND COLUMN_NAME = 'nip'
    `);
    if (nipCol.length > 0 && Number(nipCol[0].CHARACTER_MAXIMUM_LENGTH) < 30) {
      console.log('-> Menyesuaikan panjang kolom nip menjadi VARCHAR(30)...');
      await db.query(`ALTER TABLE participants MODIFY COLUMN nip VARCHAR(30) NOT NULL`);
    }

    // 5. Jalankan seluruh perintah dari database/schema.sql secara berurutan
    const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) {
      await db.query(statement);
    }

    // 6. Pastikan sesi lama terhubung ke jadwal default
    await db.query('UPDATE academy_sessions SET schedule_id = 1 WHERE schedule_id IS NULL');

    console.log('✓ Migrasi database berhasil diselesaikan.');
  } catch (err) {
    console.error('✕ Terjadi kesalahan saat migrasi:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
