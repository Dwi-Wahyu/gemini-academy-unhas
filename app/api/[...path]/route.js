import { participantWorkbook } from "../../../lib/excel.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import nodePath from "node:path";
import bcrypt from "bcryptjs";
import { db, sessions, workUnits, schedules, getNearestSchedule } from "../../../lib/db.js";
import { admin, signIn, digest } from "../../../lib/auth.js";
import { validate } from "../../../lib/validation.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

function isSessionAllowed(sess, prof) {
  if (!prof) return true;
  if (!sess || !sess.allowed_professions || sess.allowed_professions === "ALL") return true;
  const allowed = sess.allowed_professions.split(",").map((s) => s.trim().toLowerCase());
  return allowed.includes(prof.toLowerCase());
}
async function route(req, ctx) {
  const { path: routeSegments } = await ctx.params;
  const key = routeSegments.join("/");
  const url = new URL(req.url);
  try {
    if (
      req.method === "POST" &&
      req.headers.get("origin") !== (process.env.APP_ORIGIN || url.origin)
    )
      return json({ error: "Origin permintaan tidak valid." }, 403);
    if (req.method === "GET" && key === "sessions") {
      const sid = url.searchParams.get("schedule_id");
      const profession = url.searchParams.get("profession") || url.searchParams.get("role");

      const allScheds = await schedules();
      let activeScheds = allScheds.filter((s) => s.is_active);

      if (profession) {
        activeScheds = activeScheds
          .map((sc) => ({
            ...sc,
            sessions: (sc.sessions || []).filter((s) => isSessionAllowed(s, profession)),
          }))
          .filter((sc) => sc.sessions.length > 0);
      }

      const targetSchedule = sid
        ? allScheds.find((s) => String(s.id) === sid)
        : ((await getNearestSchedule()) || activeScheds[0] || null);

      let allSessionsList = await sessions();
      if (profession) {
        allSessionsList = allSessionsList.filter((s) => isSessionAllowed(s, profession));
      }

      let sessionList = sid
        ? (targetSchedule ? await sessions(targetSchedule.id) : await sessions(sid))
        : allSessionsList;
      if (profession && sid) {
        sessionList = sessionList.filter((s) => isSessionAllowed(s, profession));
      }

      return json({
        schedule: targetSchedule || null,
        schedules: activeScheds,
        sessions: sessionList,
        all_sessions: allSessionsList,
      });
    }
    if (req.method === "GET" && key === "schedules")
      return json(await schedules());
    if (req.method === "GET" && key === "units")
      return json(await workUnits());
    if (req.method === "GET" && key === "receipt") {
      const code = (await cookies()).get("academy_receipt")?.value;
      if (!code) return json({ error: "Bukti tidak ditemukan." }, 404);
      const [rows] = await db.execute(
        "SELECT p.id,p.name,p.registration_code,p.profession,p.employment_status,p.letter_file,s.name AS session,s.starts_at,s.ends_at,sc.title AS schedule_title,DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,sc.location FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id LEFT JOIN schedules sc ON sc.id=s.schedule_id WHERE p.registration_code=?",
        [code],
      );
      return rows[0]
        ? json(rows[0])
        : json({ error: "Bukti tidak ditemukan." }, 404);
    }
    if (
      req.method === "GET" &&
      routeSegments.length === 3 &&
      routeSegments[0] === "participants" &&
      routeSegments[2] === "letter"
    ) {
      const id = Number(routeSegments[1]);
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID tidak valid." }, 422);
      const isAdmin = await admin();
      const receiptCode = (await cookies()).get("academy_receipt")?.value;
      const [r] = await db.execute(
        "SELECT letter_file, registration_code, name FROM participants WHERE id = ?",
        [id]
      );
      if (!r[0] || !r[0].letter_file)
        return json({ error: "Surat usulan tidak ditemukan." }, 404);
      if (!isAdmin && (!receiptCode || receiptCode !== r[0].registration_code)) {
        return json({ error: "Akses tidak diizinkan." }, 403);
      }
      const filePath = nodePath.join(
        process.cwd(),
        "uploads",
        "letters",
        r[0].letter_file
      );
      try {
        const fileBuffer = await readFile(filePath);
        const ext = nodePath.extname(r[0].letter_file).toLowerCase();
        const mimeTypes = {
          ".pdf": "application/pdf",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
        };
        const mime = mimeTypes[ext] || "application/octet-stream";
        return new Response(fileBuffer, {
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `inline; filename="surat-usulan-${id}${ext}"`,
            "Cache-Control": "private, no-store",
          },
        });
      } catch {
        return json({ error: "Berkas tidak ditemukan di server." }, 404);
      }
    }
    if (req.method === "POST" && key === "register") {
      let bodyData = {};
      let letterFile = null;
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        for (const [k, v] of formData.entries()) {
          if (k === "letter") {
            letterFile = v;
          } else {
            bodyData[k] = v;
          }
        }
      } else {
        bodyData = await req.json();
        if (bodyData.letter) {
          letterFile = bodyData.letter;
        }
      }

      const { data: d, errors } = validate(bodyData);

      let savedFileName = null;
      let bufferToSave = null;

      if (
        letterFile &&
        typeof letterFile === "object" &&
        typeof letterFile.arrayBuffer === "function" &&
        letterFile.size > 0
      ) {
        if (letterFile.size > 5 * 1024 * 1024) {
          errors.push(
            d.profession === "Mahasiswa"
              ? "Ukuran berkas KTM / surat keterangan maksimal 5 MB."
              : "Ukuran surat usulan pimpinan unit kerja maksimal 5 MB."
          );
        }
        const origName = letterFile.name || "";
        const ext = nodePath.extname(origName).toLowerCase();
        const allowedExts = [".pdf"];
        if (!allowedExts.includes(ext)) {
          errors.push(
            d.profession === "Mahasiswa"
              ? "Format berkas KTM / surat keterangan harus berupa file PDF."
              : "Format surat usulan harus berupa file PDF."
          );
        } else {
          savedFileName = `${randomUUID()}${ext}`;
          bufferToSave = Buffer.from(await letterFile.arrayBuffer());
        }
      } else if (typeof bodyData.letter_file === "string" && bodyData.letter_file) {
        savedFileName = bodyData.letter_file;
      } else if (d.profession !== "Pimpinan") {
        errors.push(
          d.profession === "Mahasiswa"
            ? "Kartu Tanda Mahasiswa (KTM) / Surat Keterangan Mahasiswa Aktif wajib diunggah."
            : "Surat usulan pimpinan unit kerja wajib diunggah."
        );
      }

      if (errors.length) return json({ error: errors.join(" ") }, 422);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [targetSessionRows] = await conn.execute(
          "SELECT s.id, s.name, s.capacity, s.reserved, s.allowed_professions, s.exempt_student_quota, sc.exempt_student_quota AS schedule_exempt_student_quota FROM academy_sessions s LEFT JOIN schedules sc ON sc.id = s.schedule_id WHERE s.id = ? FOR UPDATE",
          [d.academy_session_id]
        );
        if (!targetSessionRows.length) {
          await conn.rollback();
          return json({ error: "Sesi tidak ditemukan." }, 404);
        }
        const targetSession = targetSessionRows[0];
        const allowed = targetSession.allowed_professions;
        if (allowed && allowed !== "ALL") {
          const allowedList = allowed.split(",").map((s) => s.trim().toLowerCase());
          if (!allowedList.includes(d.profession.toLowerCase())) {
            await conn.rollback();
            return json(
              {
                error: `Sesi "${targetSession.name}" tidak dapat dipilih oleh kategori profesi ${d.profession}.`,
              },
              422
            );
          }
        }

        const [taken] = await conn.execute(
          "UPDATE academy_sessions SET reserved=reserved+1 WHERE id=? AND reserved<capacity",
          [d.academy_session_id],
        );
        if (taken.affectedRows !== 1) {
          await conn.rollback();
          return json({ error: "Sesi sudah penuh atau tidak tersedia." }, 409);
        }

        const isExemptStudent =
          d.profession === "Mahasiswa" &&
          (Boolean(targetSession.exempt_student_quota) ||
            Boolean(targetSession.schedule_exempt_student_quota));

        if (!isExemptStudent) {
          const [unitRows] = await conn.execute(
            "SELECT id, name, max_quota FROM work_units WHERE name = ? FOR UPDATE",
            [d.unit]
          );
          if (unitRows.length > 0) {
            const [[countRow]] = await conn.execute(
              "SELECT COUNT(p.id) AS used FROM participants p JOIN academy_sessions s ON s.id = p.academy_session_id LEFT JOIN schedules sc ON sc.id = s.schedule_id WHERE p.unit = ? AND NOT (p.profession = 'Mahasiswa' AND (COALESCE(s.exempt_student_quota, 0) = 1 OR COALESCE(sc.exempt_student_quota, 0) = 1))",
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
          }
        }

        if (bufferToSave && savedFileName) {
          const uploadDir = nodePath.join(process.cwd(), "uploads", "letters");
          await mkdir(uploadDir, { recursive: true });
          await writeFile(nodePath.join(uploadDir, savedFileName), bufferToSave);
        }

        const code = randomUUID();
        await conn.execute(
          "INSERT INTO participants(registration_code,name,nip,unit,phone,email,profession,employment_status,letter_file,academy_session_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
          [
            code,
            d.name,
            d.nip,
            d.unit,
            d.phone,
            d.email || null,
            d.profession,
            d.employment_status,
            savedFileName,
            d.academy_session_id,
          ],
        );
        await conn.commit();
        const res = json({ ok: true }, 201);
        res.cookies.set("academy_receipt", code, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 3600,
        });
        try {
          (await cookies()).set("academy_receipt", code, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 3600,
          });
        } catch {}
        return res;
      } catch (e) {
        try {
          await conn.rollback();
        } catch {}
        if (bufferToSave && savedFileName) {
          try {
            await unlink(nodePath.join(process.cwd(), "uploads", "letters", savedFileName));
          } catch {}
        }
        if (e.code === "ER_DUP_ENTRY")
          return json({ error: d.profession === "Mahasiswa" ? "NIM ini sudah terdaftar." : "NIP ini sudah terdaftar." }, 409);
        throw e;
      } finally {
        conn.release();
      }
    }
    if (req.method === "POST" && key === "login") {
      const { email, password } = await req.json();
      if (
        typeof email !== "string" ||
        email.length > 255 ||
        typeof password !== "string" ||
        Buffer.byteLength(password) > 72
      )
        return json({ error: "Email atau kata sandi tidak sesuai." }, 422);
      const normalized = email.trim().toLowerCase(),
        hash = digest(normalized);
      const c = await db.getConnection();
      let user;
      try {
        await c.beginTransaction();
        await c.execute(
          "INSERT INTO login_attempts(email_hash,attempts,reset_at) VALUES(?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)) ON DUPLICATE KEY UPDATE email_hash=email_hash",
          [hash],
        );
        const [a] = await c.execute(
          "SELECT attempts,reset_at>UTC_TIMESTAMP() AS active FROM login_attempts WHERE email_hash=? FOR UPDATE",
          [hash],
        );
        if (a[0].active && a[0].attempts >= 5) {
          await c.rollback();
          return json(
            {
              error: "Terlalu banyak percobaan. Coba kembali dalam satu menit.",
            },
            429,
          );
        }
        const [users] = await c.execute(
          "SELECT * FROM users WHERE email=? AND is_admin=1",
          [normalized],
        );
        user = users[0];
        const ok = await bcrypt.compare(
          password,
          user?.password ||
            "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
        );
        if (!user || !ok) {
          await c.execute(
            "UPDATE login_attempts SET attempts=IF(reset_at>UTC_TIMESTAMP(),attempts+1,1),reset_at=IF(reset_at>UTC_TIMESTAMP(),reset_at,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)) WHERE email_hash=?",
            [hash],
          );
          await c.commit();
          return json({ error: "Email atau kata sandi tidak sesuai." }, 401);
        }
        await c.execute("DELETE FROM login_attempts WHERE email_hash=?", [
          hash,
        ]);
        await c.commit();
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
      await signIn(user.id);
      return json({ ok: true });
    }
    if (!(await admin()))
      return json({ error: "Silakan login sebagai admin." }, 401);
    if (req.method === "POST" && key === "logout") {
      const jar = await cookies();
      const t = jar.get("academy_admin")?.value;
      if (t)
        await db.execute("DELETE FROM admin_sessions WHERE token_hash=?", [
          digest(t),
        ]);
      jar.delete("academy_admin");
      return json({ ok: true });
    }
    if (req.method === "POST" && key === "schedules") {
      const body = await req.json();
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const eventDate = typeof body.event_date === "string" ? body.event_date.trim() : "";
      const location = typeof body.location === "string" ? body.location.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const sessionList = Array.isArray(body.sessions) && body.sessions.length > 0 ? body.sessions : [
        { name: "Sesi I", starts_at: "08:30", ends_at: "11:30", capacity: 230 },
        { name: "Sesi II", starts_at: "13:30", ends_at: "16:30", capacity: 230 },
      ];

      if (!title || title.length > 255)
        return json({ error: "Nama program / kegiatan wajib diisi (maks 255 karakter)." }, 422);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
        return json({ error: "Format tanggal kegiatan tidak valid (YYYY-MM-DD)." }, 422);
      if (!location || location.length > 255)
        return json({ error: "Lokasi / tempat wajib diisi (maks 255 karakter)." }, 422);

      const exemptStudentQuota = body.exempt_student_quota ? 1 : 0;
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [res] = await conn.execute(
          "INSERT INTO schedules (title, event_date, location, description, exempt_student_quota, is_active) VALUES (?, ?, ?, ?, ?, 1)",
          [title, eventDate, location, description || null, exemptStudentQuota]
        );
        const scheduleId = res.insertId;

        for (const s of sessionList) {
          const sName = typeof s.name === "string" && s.name.trim() ? s.name.trim() : "Sesi";
          const sStarts = typeof s.starts_at === "string" && s.starts_at.trim() ? s.starts_at.trim() : "08:30";
          const sEnds = typeof s.ends_at === "string" && s.ends_at.trim() ? s.ends_at.trim() : "11:30";
          const sCap = Number(s.capacity) || 230;
          const sAllowed = typeof s.allowed_professions === "string" && s.allowed_professions.trim() ? s.allowed_professions.trim() : "ALL";
          const sExempt = s.exempt_student_quota ? 1 : 0;
          await conn.execute(
            "INSERT INTO academy_sessions (schedule_id, name, starts_at, ends_at, capacity, reserved, allowed_professions, exempt_student_quota) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
            [scheduleId, sName, sStarts, sEnds, sCap, sAllowed, sExempt]
          );
        }
        await conn.commit();
        return json({ ok: true, message: "Jadwal berhasil ditambahkan.", schedules: await schedules() }, 201);
      } catch (e) {
        try { await conn.rollback(); } catch {}
        throw e;
      } finally {
        conn.release();
      }
    }
    if (
      ((req.method === "POST" || req.method === "PUT") &&
        (key === "schedules/edit" || key === "schedules/update")) ||
      ((req.method === "POST" || req.method === "PUT") &&
        routeSegments.length === 3 &&
        routeSegments[0] === "schedules" &&
        (routeSegments[2] === "edit" || routeSegments[2] === "update"))
    ) {
      let id;
      let body;
      try { body = await req.json(); } catch { body = {}; }
      if (routeSegments.length === 3) id = Number(routeSegments[1]);
      else id = Number(body.id);

      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID jadwal tidak valid." }, 422);

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const eventDate = typeof body.event_date === "string" ? body.event_date.trim() : "";
      const location = typeof body.location === "string" ? body.location.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const isActive = body.is_active === false || body.is_active === 0 || body.is_active === "0" ? 0 : 1;

      if (!title || title.length > 255)
        return json({ error: "Nama program / kegiatan wajib diisi (maks 255 karakter)." }, 422);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
        return json({ error: "Format tanggal kegiatan tidak valid (YYYY-MM-DD)." }, 422);
      if (!location || location.length > 255)
        return json({ error: "Lokasi / tempat wajib diisi (maks 255 karakter)." }, 422);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [existing] = await conn.execute(
          "SELECT id FROM schedules WHERE id = ? FOR UPDATE",
          [id]
        );
        if (!existing.length) {
          await conn.rollback();
          return json({ error: "Jadwal tidak ditemukan." }, 404);
        }

        const exemptStudentQuota = body.exempt_student_quota ? 1 : 0;
        await conn.execute(
          "UPDATE schedules SET title = ?, event_date = ?, location = ?, description = ?, exempt_student_quota = ?, is_active = ? WHERE id = ?",
          [title, eventDate, location, description || null, exemptStudentQuota, isActive, id]
        );

        if (Array.isArray(body.sessions)) {
          for (const s of body.sessions) {
            const sAllowed = typeof s.allowed_professions === "string" && s.allowed_professions.trim() ? s.allowed_professions.trim() : "ALL";
            const sExempt = s.exempt_student_quota ? 1 : 0;
            if (s.id) {
              const sCap = Number(s.capacity) || 230;
              await conn.execute(
                "UPDATE academy_sessions SET name = ?, starts_at = ?, ends_at = ?, capacity = GREATEST(?, reserved), allowed_professions = ?, exempt_student_quota = ? WHERE id = ? AND schedule_id = ?",
                [s.name.trim(), s.starts_at.trim(), s.ends_at.trim(), sCap, sAllowed, sExempt, s.id, id]
              );
            } else if (s.name) {
              await conn.execute(
                "INSERT INTO academy_sessions (schedule_id, name, starts_at, ends_at, capacity, reserved, allowed_professions, exempt_student_quota) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
                [id, s.name.trim(), s.starts_at.trim(), s.ends_at.trim(), Number(s.capacity) || 230, sAllowed, sExempt]
              );
            }
          }
        }

        await conn.commit();
        return json({ ok: true, message: "Jadwal berhasil diperbarui.", schedules: await schedules() });
      } catch (e) {
        try { await conn.rollback(); } catch {}
        throw e;
      } finally {
        conn.release();
      }
    }
    if (
      (req.method === "DELETE" && key.startsWith("schedules/")) ||
      (req.method === "POST" && key === "schedules/delete")
    ) {
      let id;
      if (key === "schedules/delete" || req.method === "POST") {
        const b = await req.json();
        id = Number(b.id);
      } else {
        id = Number(routeSegments[1]);
      }
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID jadwal tidak valid." }, 422);

      const [sc] = await db.execute("SELECT title FROM schedules WHERE id = ?", [id]);
      if (!sc.length) return json({ error: "Jadwal tidak ditemukan." }, 404);

      const [[pCount]] = await db.execute(
        "SELECT COUNT(*) AS count FROM participants p JOIN academy_sessions s ON s.id = p.academy_session_id WHERE s.schedule_id = ?",
        [id]
      );
      if (pCount.count > 0) {
        return json(
          {
            error: `Tidak dapat menghapus jadwal "${sc[0].title}" karena terdapat ${pCount.count} peserta yang sudah terdaftar.`,
          },
          409
        );
      }

      await db.execute("DELETE FROM schedules WHERE id = ?", [id]);
      return json({ ok: true, message: `Jadwal "${sc[0].title}" berhasil dihapus.`, schedules: await schedules() });
    }
    if (req.method === "POST" && key === "units") {
      const body = await req.json();
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const maxQuota = Number(body.max_quota) || 20;
      if (!name || name.length > 200)
        return json(
          { error: "Nama unit kerja wajib diisi (maksimal 200 karakter)." },
          422
        );
      if (maxQuota < 1 || maxQuota > 1000)
        return json(
          { error: "Batas kuota harus bernilai antara 1 dan 1000." },
          422
        );
      try {
        await db.execute(
          "INSERT INTO work_units (name, max_quota) VALUES (?, ?)",
          [name, maxQuota]
        );
        return json({ ok: true, units: await workUnits() }, 201);
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY")
          return json({ error: "Unit kerja ini sudah terdaftar." }, 409);
        throw e;
      }
    }
    if (
      ((req.method === "POST" || req.method === "PUT") &&
        (key === "units/edit" || key === "units/update")) ||
      ((req.method === "POST" || req.method === "PUT") &&
        routeSegments.length === 3 &&
        routeSegments[0] === "units" &&
        (routeSegments[2] === "edit" || routeSegments[2] === "update"))
    ) {
      let id;
      let body;
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      if (routeSegments.length === 3) {
        id = Number(routeSegments[1]);
      } else {
        id = Number(body.id);
      }
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID unit kerja tidak valid." }, 422);

      const name = typeof body.name === "string" ? body.name.trim() : "";
      const maxQuota = Number(body.max_quota);

      if (!name || name.length > 200)
        return json(
          { error: "Nama unit kerja wajib diisi (maksimal 200 karakter)." },
          422
        );
      if (!Number.isSafeInteger(maxQuota) || maxQuota < 1 || maxQuota > 1000)
        return json(
          { error: "Batas kuota harus bernilai antara 1 dan 1000." },
          422
        );

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [existing] = await conn.execute(
          "SELECT id, name, max_quota FROM work_units WHERE id = ? FOR UPDATE",
          [id]
        );
        if (!existing.length) {
          await conn.rollback();
          return json({ error: "Unit kerja tidak ditemukan." }, 404);
        }
        const oldUnit = existing[0];

        if (oldUnit.name !== name) {
          const [duplicate] = await conn.execute(
            "SELECT id FROM work_units WHERE name = ? AND id != ?",
            [name, id]
          );
          if (duplicate.length) {
            await conn.rollback();
            return json(
              { error: `Unit kerja dengan nama "${name}" sudah terdaftar.` },
              409
            );
          }
        }

        const [[usedCount]] = await conn.execute(
          "SELECT COUNT(*) AS total FROM participants WHERE unit = ?",
          [oldUnit.name]
        );

        if (maxQuota < usedCount.total) {
          await conn.rollback();
          return json(
            {
              error: `Batas kuota (${maxQuota}) tidak boleh lebih kecil dari jumlah peserta yang sudah terdaftar (${usedCount.total} orang).`,
            },
            422
          );
        }

        await conn.execute(
          "UPDATE work_units SET name = ?, max_quota = ? WHERE id = ?",
          [name, maxQuota, id]
        );

        if (oldUnit.name !== name) {
          await conn.execute(
            "UPDATE participants SET unit = ? WHERE unit = ?",
            [name, oldUnit.name]
          );
        }

        await conn.commit();
        return json({
          ok: true,
          message: `Unit kerja "${name}" berhasil diperbarui.`,
          units: await workUnits(),
        });
      } catch (e) {
        try {
          await conn.rollback();
        } catch {}
        if (e.code === "ER_DUP_ENTRY")
          return json({ error: "Unit kerja ini sudah terdaftar." }, 409);
        throw e;
      } finally {
        conn.release();
      }
    }
    if (
      (req.method === "DELETE" && key.startsWith("units/")) ||
      (req.method === "POST" && key === "units/delete")
    ) {
      let id;
      if (key === "units/delete" || req.method === "POST") {
        const b = await req.json();
        id = Number(b.id);
      } else {
        id = Number(routeSegments[1]);
      }
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID unit kerja tidak valid." }, 422);
      const [u] = await db.execute(
        "SELECT name FROM work_units WHERE id = ?",
        [id]
      );
      if (!u.length)
        return json({ error: "Unit kerja tidak ditemukan." }, 404);
      const [[pCount]] = await db.execute(
        "SELECT COUNT(*) AS count FROM participants WHERE unit = ?",
        [u[0].name]
      );
      if (pCount.count > 0) {
        return json(
          {
            error: `Tidak dapat menghapus "${u[0].name}" karena sudah ada ${pCount.count} peserta yang terdaftar di unit ini.`,
          },
          409
        );
      }
      await db.execute("DELETE FROM work_units WHERE id = ?", [id]);
      return json({ ok: true, units: await workUnits() });
    }
    if (
      req.method === "GET" &&
      routeSegments.length === 2 &&
      routeSegments[0] === "participants"
    ) {
      const id = Number(routeSegments[1]);
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID tidak valid." }, 422);
      const [r] = await db.execute(
        "SELECT p.*,s.name AS session,s.starts_at,s.ends_at,sc.id AS schedule_id,sc.title AS schedule_title,DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,sc.location FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id LEFT JOIN schedules sc ON sc.id=s.schedule_id WHERE p.id=?",
        [id],
      );
      return r[0]
        ? json(r[0])
        : json({ error: "Peserta tidak ditemukan." }, 404);
    }
    if (
      (req.method === "DELETE" &&
        routeSegments.length === 2 &&
        routeSegments[0] === "participants") ||
      (req.method === "POST" &&
        routeSegments.length === 3 &&
        routeSegments[0] === "participants" &&
        routeSegments[2] === "delete") ||
      (req.method === "POST" && key === "participants/delete")
    ) {
      let id;
      if (
        key === "participants/delete" ||
        (req.method === "POST" && routeSegments.length === 2)
      ) {
        const b = await req.json();
        id = Number(b.id);
      } else {
        id = Number(routeSegments[1]);
      }
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID peserta tidak valid." }, 422);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.execute(
          "SELECT id, name, academy_session_id, letter_file FROM participants WHERE id = ? FOR UPDATE",
          [id]
        );
        if (!rows.length) {
          await conn.rollback();
          return json({ error: "Peserta tidak ditemukan." }, 404);
        }
        const p = rows[0];

        await conn.execute(
          "UPDATE academy_sessions SET reserved = GREATEST(reserved - 1, 0) WHERE id = ?",
          [p.academy_session_id]
        );
        await conn.execute("DELETE FROM participants WHERE id = ?", [id]);
        await conn.commit();

        if (p.letter_file) {
          try {
            await unlink(
              nodePath.join(process.cwd(), "uploads", "letters", p.letter_file)
            );
          } catch {}
        }
        return json({
          ok: true,
          message: `Peserta "${p.name}" berhasil dihapus.`,
        });
      } catch (e) {
        try {
          await conn.rollback();
        } catch {}
        throw e;
      } finally {
        conn.release();
      }
    }
    if (
      (req.method === "PUT" &&
        routeSegments.length === 2 &&
        routeSegments[0] === "participants") ||
      (req.method === "POST" &&
        routeSegments.length === 3 &&
        routeSegments[0] === "participants" &&
        (routeSegments[2] === "edit" || routeSegments[2] === "update"))
    ) {
      const id = Number(routeSegments[1]);
      if (!Number.isSafeInteger(id) || id < 1)
        return json({ error: "ID peserta tidak valid." }, 422);

      let bodyData = {};
      let letterFile = null;
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        for (const [k, v] of formData.entries()) {
          if (k === "letter") {
            letterFile = v;
          } else {
            bodyData[k] = v;
          }
        }
      } else {
        bodyData = await req.json();
        if (bodyData.letter) {
          letterFile = bodyData.letter;
        }
      }

      const { data: d, errors } = validate(bodyData);

      let savedFileName = null;
      let bufferToSave = null;

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
        const ext = nodePath.extname(origName).toLowerCase();
        if (ext !== ".pdf") {
          errors.push("Format surat usulan harus berupa file PDF.");
        } else {
          savedFileName = `${randomUUID()}${ext}`;
          bufferToSave = Buffer.from(await letterFile.arrayBuffer());
        }
      }

      if (errors.length) return json({ error: errors.join(" ") }, 422);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [existingRows] = await conn.execute(
          "SELECT * FROM participants WHERE id = ? FOR UPDATE",
          [id]
        );
        if (!existingRows.length) {
          await conn.rollback();
          return json({ error: "Peserta tidak ditemukan." }, 404);
        }
        const oldP = existingRows[0];

        if (Number(oldP.academy_session_id) !== Number(d.academy_session_id)) {
          const [taken] = await conn.execute(
            "UPDATE academy_sessions SET reserved = reserved + 1 WHERE id = ? AND reserved < capacity",
            [d.academy_session_id]
          );
          if (taken.affectedRows !== 1) {
            await conn.rollback();
            return json(
              { error: "Sesi tujuan sudah penuh atau tidak tersedia." },
              409
            );
          }
          await conn.execute(
            "UPDATE academy_sessions SET reserved = GREATEST(reserved - 1, 0) WHERE id = ?",
            [oldP.academy_session_id]
          );
        }

        if (oldP.unit !== d.unit) {
          const [currSessionRows] = await conn.execute(
            "SELECT s.exempt_student_quota, sc.exempt_student_quota AS schedule_exempt_student_quota FROM academy_sessions s LEFT JOIN schedules sc ON sc.id = s.schedule_id WHERE s.id = ?",
            [d.academy_session_id]
          );
          const isExemptStudent =
            d.profession === "Mahasiswa" &&
            currSessionRows.length > 0 &&
            (Boolean(currSessionRows[0].exempt_student_quota) ||
              Boolean(currSessionRows[0].schedule_exempt_student_quota));

          if (!isExemptStudent) {
            const [unitRows] = await conn.execute(
              "SELECT id, name, max_quota FROM work_units WHERE name = ? FOR UPDATE",
              [d.unit]
            );
            if (unitRows.length > 0) {
              const [[countRow]] = await conn.execute(
                "SELECT COUNT(p.id) AS used FROM participants p JOIN academy_sessions s ON s.id = p.academy_session_id LEFT JOIN schedules sc ON sc.id = s.schedule_id WHERE p.unit = ? AND p.id != ? AND NOT (p.profession = 'Mahasiswa' AND (COALESCE(s.exempt_student_quota, 0) = 1 OR COALESCE(sc.exempt_student_quota, 0) = 1))",
                [d.unit, id]
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
            }
          }
        }

        let finalLetter = oldP.letter_file;
        if (bufferToSave && savedFileName) {
          const uploadDir = nodePath.join(process.cwd(), "uploads", "letters");
          await mkdir(uploadDir, { recursive: true });
          await writeFile(nodePath.join(uploadDir, savedFileName), bufferToSave);
          finalLetter = savedFileName;
        }

        await conn.execute(
          "UPDATE participants SET name = ?, nip = ?, unit = ?, phone = ?, email = ?, profession = ?, employment_status = ?, letter_file = ?, academy_session_id = ? WHERE id = ?",
          [
            d.name,
            d.nip,
            d.unit,
            d.phone,
            d.email || null,
            d.profession,
            d.employment_status,
            finalLetter,
            d.academy_session_id,
            id,
          ]
        );

        await conn.commit();

        if (
          bufferToSave &&
          savedFileName &&
          oldP.letter_file &&
          oldP.letter_file !== savedFileName
        ) {
          try {
            await unlink(
              nodePath.join(process.cwd(), "uploads", "letters", oldP.letter_file)
            );
          } catch {}
        }

        return json({ ok: true, message: "Data peserta berhasil diperbarui." });
      } catch (e) {
        try {
          await conn.rollback();
        } catch {}
        if (bufferToSave && savedFileName) {
          try {
            await unlink(
              nodePath.join(process.cwd(), "uploads", "letters", savedFileName)
            );
          } catch {}
        }
        if (e.code === "ER_DUP_ENTRY")
          return json(
            {
              error:
                d.profession === "Mahasiswa"
                  ? "NIM ini sudah terdaftar pada peserta lain."
                  : "NIP ini sudah terdaftar pada peserta lain.",
            },
            409
          );
        throw e;
      } finally {
        conn.release();
      }
    }
    if (req.method === "GET" && (key === "participants" || key === "export")) {
      const q = (url.searchParams.get("q") || "").trim();
      const sid = url.searchParams.get("session");
      const scid = url.searchParams.get("schedule");
      const profession = (url.searchParams.get("profession") || "").trim();
      const page = Number(url.searchParams.get("page") || 1);
      if (
        q.length > 150 ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        (sid && !/^[1-9]\d*$/.test(sid)) ||
        (scid && !/^[1-9]\d*$/.test(scid)) ||
        (profession && !["Dosen", "Tendik", "Pimpinan", "Mahasiswa"].includes(profession))
      )
        return json({ error: "Filter tidak valid." }, 422);
      let where = " WHERE 1=1";
      const args = [];
      if (q) {
        where +=
          " AND (p.name LIKE ? OR p.nip LIKE ? OR p.unit LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.profession LIKE ? OR p.employment_status LIKE ?)";
        args.push(...Array(7).fill("%" + q + "%"));
      }
      if (scid) {
        where += " AND s.schedule_id=?";
        args.push(scid);
      }
      if (sid) {
        where += " AND p.academy_session_id=?";
        args.push(sid);
      }
      if (profession) {
        where += " AND p.profession=?";
        args.push(profession);
      }
      const base =
        " FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id LEFT JOIN schedules sc ON sc.id=s.schedule_id" +
        where;
      if (key === "export") {
        const [r] = await db.query(
          "SELECT p.*,s.name AS session,s.starts_at,s.ends_at,sc.title AS schedule_title,DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,sc.location" +
            base +
            " ORDER BY p.id DESC",
          args,
        );
        const buffer = await participantWorkbook(r, profession);
        const filename = profession
          ? `peserta-${profession.toLowerCase()}.xlsx`
          : "peserta-gemini-academy.xlsx";
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              `attachment; filename="${filename}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }

      const [r] = await db.query(
        "SELECT p.*,s.name AS session,s.starts_at,s.ends_at,sc.id AS schedule_id,sc.title AS schedule_title,DATE_FORMAT(sc.event_date, '%Y-%m-%d') AS event_date,sc.location" +
          base +
          " ORDER BY p.id DESC LIMIT 25 OFFSET ?",
        [...args, (page - 1) * 25],
      );
      const [[count]] = await db.query("SELECT COUNT(*) AS total" + base, args);
      const [[all]] = await db.query(
        "SELECT COUNT(*) AS total FROM participants",
      );
      const [profCounts] = await db.query(
        "SELECT profession, COUNT(*) AS count FROM participants GROUP BY profession"
      );
      const profession_counts = { Dosen: 0, Tendik: 0, Pimpinan: 0, Mahasiswa: 0 };
      for (const row of profCounts) {
        if (row.profession in profession_counts) {
          profession_counts[row.profession] = Number(row.count) || 0;
        }
      }
      return json({
        participants: r,
        total: count.total,
        all: all.total,
        profession_counts,
        sessions: await sessions(scid || null),
        schedules: await schedules(),
        page,
      });
    }
    return json({ error: "Tidak ditemukan." }, 404);
  } catch (e) {
    console.error("API error:", e);
    const detail = e?.sqlMessage || e?.message || "";
    return json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Layanan belum tersedia. Periksa konfigurasi database atau coba kembali."
            : `Layanan belum tersedia: ${detail || "Periksa konfigurasi database atau coba kembali."}`,
      },
      503,
    );
  }
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const DELETE = route;
