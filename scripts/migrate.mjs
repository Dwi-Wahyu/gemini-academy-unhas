import { readFile } from 'node:fs/promises';
import { db } from '../lib/db.js';

async function migrate() {
  console.log('Memulai migrasi database...');
  try {
    // 1. Jalankan skema dasar dari database/schema.sql terlebih dahulu (semua CREATE TABLE IF NOT EXISTS & INSERT aman tanpa menimpa data)
    const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) {
      await db.query(statement);
    }

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

    // 4. Cek kolom exempt_student_quota pada schedules dan academy_sessions
    const [colsScExempt] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'exempt_student_quota'
    `);
    if (colsScExempt.length === 0) {
      console.log('-> Menambahkan kolom exempt_student_quota ke tabel schedules...');
      await db.query(`ALTER TABLE schedules ADD COLUMN exempt_student_quota BOOLEAN NOT NULL DEFAULT 0`);
    }

    const [colsSessExempt] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'academy_sessions' AND COLUMN_NAME = 'exempt_student_quota'
    `);
    if (colsSessExempt.length === 0) {
      console.log('-> Menambahkan kolom exempt_student_quota ke tabel academy_sessions...');
      await db.query(`ALTER TABLE academy_sessions ADD COLUMN exempt_student_quota BOOLEAN NOT NULL DEFAULT 0`);
    }

    // 5. Perlebar kolom nip pada tabel participants untuk mendukung NIM mahasiswa (sampai 30 char)
    const [nipCol] = await db.query(`
      SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participants' AND COLUMN_NAME = 'nip'
    `);
    if (nipCol.length > 0 && Number(nipCol[0].CHARACTER_MAXIMUM_LENGTH) < 30) {
      console.log('-> Menyesuaikan panjang kolom nip menjadi VARCHAR(30)...');
      await db.query(`ALTER TABLE participants MODIFY COLUMN nip VARCHAR(30) NOT NULL`);
    }

    // 5b. Cek kolom position pada tabel participants
    const [colsPosition] = await db.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'participants' AND COLUMN_NAME = 'position'
    `);
    if (colsPosition.length === 0) {
      console.log('-> Menambahkan kolom position ke tabel participants...');
      await db.query(`ALTER TABLE participants ADD COLUMN position VARCHAR(150) NULL AFTER nip`);
    }

    // 6. Pastikan sesi lama terhubung ke jadwal default
    await db.query('UPDATE academy_sessions SET schedule_id = 1 WHERE schedule_id IS NULL');

    console.log('✓ Migrasi database berhasil diselesaikan tanpa mengubah data yang ada.');
  } catch (err) {
    console.error('✕ Terjadi kesalahan saat migrasi:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
