import { participantWorkbook } from "../../../lib/excel.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import nodePath from "node:path";
import bcrypt from "bcryptjs";
import { db, sessions, workUnits } from "../../../lib/db.js";
import { admin, signIn, digest } from "../../../lib/auth.js";
import { validate } from "../../../lib/validation.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
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
    if (req.method === "GET" && key === "sessions")
      return json(await sessions());
    if (req.method === "GET" && key === "units")
      return json(await workUnits());
    if (req.method === "GET" && key === "receipt") {
      const code = (await cookies()).get("academy_receipt")?.value;
      if (!code) return json({ error: "Bukti tidak ditemukan." }, 404);
      const [rows] = await db.execute(
        "SELECT p.id,p.name,p.registration_code,p.profession,p.employment_status,p.letter_file,s.name AS session,s.starts_at,s.ends_at FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id WHERE p.registration_code=?",
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
          errors.push("Ukuran surat usulan pimpinan unit kerja maksimal 5 MB.");
        }
        const origName = letterFile.name || "";
        const ext = nodePath.extname(origName).toLowerCase();
        const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
        if (!allowedExts.includes(ext)) {
          errors.push("Format surat usulan harus berupa file PDF, JPG, atau PNG.");
        } else {
          savedFileName = `${randomUUID()}${ext}`;
          bufferToSave = Buffer.from(await letterFile.arrayBuffer());
        }
      } else if (typeof bodyData.letter_file === "string" && bodyData.letter_file) {
        savedFileName = bodyData.letter_file;
      } else {
        errors.push("Surat usulan pimpinan unit kerja wajib diunggah.");
      }

      if (errors.length) return json({ error: errors.join(" ") }, 422);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [taken] = await conn.execute(
          "UPDATE academy_sessions SET reserved=reserved+1 WHERE id=? AND reserved<capacity",
          [d.academy_session_id],
        );
        if (taken.affectedRows !== 1) {
          await conn.rollback();
          return json({ error: "Sesi sudah penuh atau tidak tersedia." }, 409);
        }
        const [unitRows] = await conn.execute(
          "SELECT id, name, max_quota FROM work_units WHERE name = ? FOR UPDATE",
          [d.unit]
        );
        if (unitRows.length > 0) {
          const [[countRow]] = await conn.execute(
            "SELECT COUNT(*) AS used FROM participants WHERE unit = ?",
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
          return json({ error: "NIP ini sudah terdaftar." }, 409);
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
        "SELECT p.*,s.name AS session,s.starts_at,s.ends_at FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id WHERE p.id=?",
        [id],
      );
      return r[0]
        ? json(r[0])
        : json({ error: "Peserta tidak ditemukan." }, 404);
    }
    if (req.method === "GET" && (key === "participants" || key === "export")) {
      const q = (url.searchParams.get("q") || "").trim();
      const sid = url.searchParams.get("session");
      const page = Number(url.searchParams.get("page") || 1);
      if (
        q.length > 150 ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        (sid && !/^[1-9]\d*$/.test(sid))
      )
        return json({ error: "Filter tidak valid." }, 422);
      let where = " WHERE 1=1";
      const args = [];
      if (q) {
        where +=
          " AND (p.name LIKE ? OR p.nip LIKE ? OR p.unit LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.profession LIKE ? OR p.employment_status LIKE ?)";
        args.push(...Array(7).fill("%" + q + "%"));
      }
      if (sid) {
        where += " AND p.academy_session_id=?";
        args.push(sid);
      }
      const base =
        " FROM participants p JOIN academy_sessions s ON s.id=p.academy_session_id" +
        where;
      if (key === "export") {
        const [r] = await db.query(
          "SELECT p.*,s.name AS session,s.starts_at,s.ends_at" +
            base +
            " ORDER BY p.id DESC",
          args,
        );
        const buffer = await participantWorkbook(r);
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="peserta-gemini-academy.xlsx"',
            "Cache-Control": "private, no-store",
          },
        });
      }

      const [r] = await db.query(
        "SELECT p.*,s.name AS session" +
          base +
          " ORDER BY p.id DESC LIMIT 25 OFFSET ?",
        [...args, (page - 1) * 25],
      );
      const [[count]] = await db.query("SELECT COUNT(*) AS total" + base, args);
      const [[all]] = await db.query(
        "SELECT COUNT(*) AS total FROM participants",
      );
      return json({
        participants: r,
        total: count.total,
        all: all.total,
        sessions: await sessions(),
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
