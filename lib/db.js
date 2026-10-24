import mysql from 'mysql2/promise';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const g = globalThis;

export function loadEnvIfNeeded() {
  if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (existsSync(envPath)) {
        if (typeof process.loadEnvFile === 'function') {
          process.loadEnvFile(envPath);
        } else {
          const content = readFileSync(envPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) process.env[k] = v;
            }
          }
        }
      }
    } catch {}
  }
}

loadEnvIfNeeded();

function getPoolKey() {
  return `${process.env.MYSQL_HOST || '127.0.0.1'}:${process.env.MYSQL_PORT || 3306}:${process.env.MYSQL_USER || ''}:${process.env.MYSQL_DATABASE || ''}`;
}

export function getDb() {
  loadEnvIfNeeded();
  const currentKey = getPoolKey();
  if (g.academyDb && g.academyDbKey !== currentKey) {
    try {
      g.academyDb.end();
    } catch {}
    delete g.academyDb;
  }
  if (!g.academyDb) {
    g.academyDbKey = currentKey;
    g.academyDb = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      connectionLimit: 10,
      timezone: 'Z',
      dateStrings: true,
    });
  }
  return g.academyDb;
}

export const db = new Proxy({}, {
  get(_target, prop) {
    const pool = getDb();
    const val = pool[prop];
    return typeof val === 'function' ? val.bind(pool) : val;
  }
});

export async function getNearestSchedule() {
  // Ambil jadwal aktif dengan tanggal terdekat (hari ini atau mendatang)
  const [upcoming] = await db.query(
    'SELECT * FROM schedules WHERE is_active = 1 AND event_date >= CURDATE() ORDER BY event_date ASC, id ASC LIMIT 1'
  );
  if (upcoming.length > 0) return upcoming[0];

  // Jika tidak ada jadwal mendatang, ambil jadwal aktif terakhir
  const [anyActive] = await db.query(
    'SELECT * FROM schedules WHERE is_active = 1 ORDER BY event_date DESC, id DESC LIMIT 1'
  );
  return anyActive[0] || null;
}

export async function schedules() {
  const [rows] = await db.query(`
    SELECT 
      sc.id,
      sc.title,
      DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,
      sc.location,
      sc.description,
      sc.is_active,
      sc.created_at,
      sc.updated_at,
      COALESCE(SUM(s.capacity), 0) AS total_capacity,
      COALESCE(SUM(s.reserved), 0) AS total_reserved,
      COUNT(s.id) AS session_count
    FROM schedules sc
    LEFT JOIN academy_sessions s ON s.schedule_id = sc.id
    GROUP BY sc.id
    ORDER BY sc.event_date DESC, sc.id DESC
  `);

  // Sertakan daftar sesi di tiap jadwal
  for (const row of rows) {
    const [sess] = await db.query(
      'SELECT *, GREATEST(capacity-reserved,0) AS remaining FROM academy_sessions WHERE schedule_id = ? ORDER BY id ASC',
      [row.id]
    );
    row.sessions = sess;
  }
  return rows;
}

export async function sessions(scheduleId = null) {
  let query = `
    SELECT 
      s.*, 
      GREATEST(s.capacity - s.reserved, 0) AS remaining,
      sc.title AS schedule_title,
      DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,
      sc.location
    FROM academy_sessions s
    LEFT JOIN schedules sc ON sc.id = s.schedule_id
  `;
  const args = [];
  if (scheduleId) {
    query += ' WHERE s.schedule_id = ?';
    args.push(scheduleId);
  }
  query += ' ORDER BY sc.event_date ASC, s.id ASC';

  const [rows] = await db.query(query, args);
  return rows;
}

export async function workUnits() {
  const [rows] = await db.query(
    'SELECT u.id, u.name, u.max_quota, COUNT(p.id) AS used, GREATEST(u.max_quota - COUNT(p.id), 0) AS remaining FROM work_units u LEFT JOIN participants p ON p.unit = u.name GROUP BY u.id, u.name, u.max_quota ORDER BY u.name ASC'
  );
  return rows;
}
