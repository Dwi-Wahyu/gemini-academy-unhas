"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function isSessionAllowed(session, prof) {
  if (!session || !session.allowed_professions || session.allowed_professions === "ALL") return true;
  if (!prof) return true;
  const allowed = session.allowed_professions.split(",").map((s) => s.trim().toLowerCase());
  return allowed.includes(prof.toLowerCase());
}

export default function RegistrationForm({ role }) {
  const [schedule, setSchedule] = useState(null),
    [sessions, setSessions] = useState([]),
    [units, setUnits] = useState([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Memuat kuota sesi…"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [selectedUnit, setSelectedUnit] = useState(""),
    [employmentStatus, setEmploymentStatus] = useState(
      role === "Mahasiswa" ? "Mahasiswa" : "PNS"
    );

  const targetDate = role === "Dosen" || role === "Pimpinan" ? "2026-10-30" : "2026-10-31";

  async function refresh() {
    try {
      const [rSessions, rUnits] = await Promise.all([
        fetch("/api/sessions", { cache: "no-store" }),
        fetch("/api/units", { cache: "no-store" }),
      ]);
      const [dSessions, dUnits] = await Promise.all([
        rSessions.json(),
        rUnits.json(),
      ]);
      if (!rSessions.ok) throw Error(dSessions.error);
      if (!rUnits.ok) throw Error(dUnits.error);

      const allScheds = dSessions.schedules || (dSessions.schedule ? [dSessions.schedule] : []);
      // Temukan jadwal yang sesuai dengan tanggal kategori ini
      const matchedSched = allScheds.find((s) => s.event_date === targetDate) || dSessions.schedule || null;

      // Ambil sesi khusus jadwal ini
      let sList = [];
      if (matchedSched) {
        const rTarget = await fetch(`/api/sessions?schedule_id=${matchedSched.id}`, { cache: "no-store" });
        const dTarget = await rTarget.json();
        sList = dTarget.sessions || [];
      } else {
        sList = dSessions.sessions || [];
      }

      setSchedule(matchedSched);
      setSessions(sList);
      setUnits(dUnits);
      setStatus("");

      setSelected((v) => {
        const found = sList.find((s) => String(s.id) === v);
        if (found && found.remaining > 0 && isSessionAllowed(found, role)) {
          return v;
        }
        const first = sList.find((s) => s.remaining > 0 && isSessionAllowed(s, role));
        return first ? String(first.id) : "";
      });

      setSelectedUnit((v) =>
        dUnits.some((u) => u.name === v && u.remaining > 0) ? v : "",
      );
    } catch {
      setStatus("Kuota belum dapat diperbarui. Coba beberapa saat lagi.");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [role]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("profession", role);
      if (role === "Mahasiswa") {
        formData.set("employment_status", "Mahasiswa");
      }
      const r = await fetch("/api/register", {
        method: "POST",
        body: formData,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.location.assign("/success");
    } catch (e) {
      setError(e.message);
      setBusy(false);
      refresh();
    }
  }

  const roleConfigs = {
    Pimpinan: {
      eyebrow: "01 / JALUR PIMPINAN UNIT KERJA",
      title: "Formulir Pendaftaran",
      desc: "Khusus Rektorat, Dekanat, Direktur Sekolah, Ketua Lembaga, dan Kepala Biro.",
      dateLabel: "Jumat, 30 Oktober 2026",
      nipLabel: "NIP (18 Digit Angka) *",
      nipPlaceholder: "Masukkan 18 digit NIP",
      nipPattern: "[0-9]{18}",
      nipMax: 18,
      letterLabel: "Surat Penugasan / Usulan Pimpinan Unit Kerja *",
      letterHelp: "Unggah berkas usulan pimpinan unit kerja (format PDF, maks 5 MB).",
      accent: "#1e3a8a",
    },
    Dosen: {
      eyebrow: "01 / JALUR DOSEN",
      title: "Formulir Pendaftaran",
      desc: "Khusus Tenaga Pendidik / Dosen Tetap Universitas Hasanuddin.",
      dateLabel: "Jumat, 30 Oktober 2026",
      nipLabel: "NIP (18 Digit Angka) *",
      nipPlaceholder: "Masukkan 18 digit NIP",
      nipPattern: "[0-9]{18}",
      nipMax: 18,
      letterLabel: "Surat Usulan Pimpinan Unit Kerja / Dekan *",
      letterHelp: "Unggah berkas usulan bertanda tangan Dekan / Pimpinan Unit (format PDF, maks 5 MB).",
      accent: "#2563eb",
    },
    Tendik: {
      eyebrow: "01 / JALUR TENAGA KEPENDIDIKAN",
      title: "Formulir Pendaftaran",
      desc: "Khusus Tenaga Kependidikan, Staf Administrasi, Laboran, dan Pustakawan Unhas.",
      dateLabel: "Sabtu, 31 Oktober 2026",
      nipLabel: "NIP (18 Digit Angka) *",
      nipPlaceholder: "Masukkan 18 digit NIP",
      nipPattern: "[0-9]{18}",
      nipMax: 18,
      letterLabel: "Surat Usulan Pimpinan Unit Kerja *",
      letterHelp: "Unggah berkas usulan bertanda tangan pimpinan unit kerja (format PDF, maks 5 MB).",
      accent: "#059669",
    },
    Mahasiswa: {
      eyebrow: "01 / JALUR MAHASISWA",
      title: "Formulir Pendaftaran",
      desc: "Khusus Mahasiswa Aktif Diploma, Sarjana, dan Pascasarjana Universitas Hasanuddin.",
      dateLabel: "Sabtu, 31 Oktober 2026",
      nipLabel: "NIM (Nomor Induk Mahasiswa) *",
      nipPlaceholder: "Masukkan NIM (contoh: H071191001)",
      nipPattern: "[A-Za-z0-9/_-]{4,30}",
      nipMax: 30,
      letterLabel: "Kartu Tanda Mahasiswa (KTM) / Surat Keterangan Aktif Kuliah *",
      letterHelp: "Unggah scan KTM atau Surat Keterangan Mahasiswa Aktif (format PDF, maks 5 MB).",
      accent: "#7c3aed",
    },
  };

  const config = roleConfigs[role] || roleConfigs.Dosen;
  const full = sessions.length > 0 && sessions.every((s) => s.remaining === 0);

  return (
    <div>
      <div className="registration-grid">
        <section className="intro">
          <h1 style={{ fontSize: "46px", marginTop: "16px" }}>
            {config.title}
            <br />
            <span>Gemini Academy.</span>
          </h1>
          <p className="lead">{config.desc}</p>

          {schedule && (
            <div
              style={{
                margin: "20px 0",
                padding: "18px 20px",
                background: "rgba(255, 255, 255, 0.8)",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                borderRadius: "14px",
                boxShadow: "0 4px 15px -2px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#1e3a8a",
                  lineHeight: 1.45,
                  marginBottom: "10px",
                }}
              >
                {schedule.title}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "14px",
                  fontSize: "12.5px",
                  color: "#334155",
                }}
              >
                <div>
                  <b>{formatEventDate(schedule.event_date)}</b>
                </div>
                <div>
                  <b>{schedule.location}</b>
                </div>
              </div>
            </div>
          )}

          <div className="session-list">
            {sessions.map((s, i) => {
              const allowed = isSessionAllowed(s, role);
              return (
                <article
                  className="session-card"
                  key={s.id}
                  style={{
                    opacity: allowed ? 1 : 0.45,
                    border: allowed && selected === String(s.id)
                      ? "2px solid #567bda"
                      : "1px solid #e0e7f1",
                    background: allowed && selected === String(s.id)
                      ? "#f8faff"
                      : "#fff",
                    transition: "all 0.2s",
                  }}
                >
                  <span className="icon">{i ? "◷" : "☀"}</span>
                  <div style={{ flex: 1 }}>
                    <b>{s.name}</b>
                    <p>
                      {s.starts_at}–{s.ends_at} WITA
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: s.remaining > 0 ? (allowed ? "#edf7f2" : "#f1f5f9") : "#fef2f2",
                      color: s.remaining > 0 ? (allowed ? "#3a8c73" : "#64748b") : "#dc2626",
                    }}
                  >
                    {s.remaining > 0
                      ? (allowed ? `${s.remaining} kursi tersisa` : "Tidak tersedia")
                      : "Penuh"}
                  </span>
                </article>
              );
            })}
            {!sessions.length && (
              <div style={{ padding: "16px", color: "#64748b", fontSize: "14px" }}>
                Belum ada sesi jadwal yang dibuka untuk kategori ini.
              </div>
            )}
          </div>

          <p className="note">
            ⓘ Kuota awal 230 peserta per sesi. Sesi penuh atau di luar hak akses kategori otomatis tidak dapat dipilih.
          </p>
          <div className="decor">✦</div>
        </section>

        <section className="card">
          <h2>{config.title}</h2>
          <p className="muted">{config.desc}</p>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={submit}>
            <input type="hidden" name="profession" value={role} />

            <label>
              Nama Lengkap {role !== "Mahasiswa" ? "(beserta Gelar)" : ""} *
              <input
                name="name"
                required
                minLength={2}
                maxLength={150}
                autoComplete="name"
                placeholder={role === "Mahasiswa" ? "Nama lengkap mahasiswa" : "Nama lengkap beserta gelar"}
              />
            </label>

            <label>
              {config.nipLabel}
              <input
                name="nip"
                required
                pattern={config.nipPattern}
                maxLength={config.nipMax}
                inputMode={role === "Mahasiswa" ? "text" : "numeric"}
                placeholder={config.nipPlaceholder}
              />
              <small>
                {role === "Mahasiswa"
                  ? "NIM digunakan untuk identifikasi peserta mahasiswa Unhas."
                  : "NIP digunakan untuk validasi kepegawaian dan mencegah pendaftaran ganda."}
              </small>
            </label>

            <label>
              {role === "Mahasiswa" ? "Fakultas / Program Pascasarjana *" : "Unit Kerja / Fakultas *"}
              <select
                required
                name="unit"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
              >
                <option value="">Pilih unit kerja / fakultas</option>
                {units.map((u) => (
                  <option key={u.id} value={u.name} disabled={u.remaining <= 0}>
                    {u.name} — {u.remaining > 0 ? `${u.remaining} kuota tersisa (maks ${u.max_quota})` : `KUOTA PENUH (maks ${u.max_quota})`}
                  </option>
                ))}
              </select>
              <small>Setiap unit kerja memiliki batas maksimal kuota pengusulan.</small>
            </label>

            {role === "Mahasiswa" ? (
              <input type="hidden" name="employment_status" value="Mahasiswa" />
            ) : (
              <label>
                Status Kepegawaian *
                <select
                  required
                  name="employment_status"
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                >
                  <option value="PNS">PNS (Pegawai Negeri Sipil)</option>
                  <option value="NPT">NPT (Non-PNS Tetap)</option>
                  {role !== "Pimpinan" && <option value="NPTT">NPTT (Non-PNS Tidak Tetap)</option>}
                </select>
              </label>
            )}

            <label>
              {config.letterLabel}
              <input
                type="file"
                name="letter"
                required
                accept=".pdf,application/pdf"
              />
              <small>{config.letterHelp}</small>
            </label>

            <label>
              Nomor WhatsApp Aktif *
              <input
                type="tel"
                name="phone"
                required
                maxLength={20}
                autoComplete="tel"
                placeholder="081234567890"
              />
            </label>

            <label>
              Alamat Email {role === "Mahasiswa" ? "Unhas / Pribadi" : "Unhas"}{" "}
              <span className="optional">Opsional</span>
              <input
                name="email"
                type="email"
                maxLength={200}
                autoComplete="email"
                placeholder="nama@unhas.ac.id"
              />
              <small>Boleh dikosongkan bila belum memiliki email Unhas.</small>
            </label>

            <label>
              Pilihan Sesi Pelatihan *
              <select
                required
                name="academy_session_id"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Pilih sesi yang tersedia</option>
                {sessions.map((s) => {
                  const allowed = isSessionAllowed(s, role);
                  const isFull = !s.remaining;
                  const isDisabled = isFull || !allowed;
                  const eventDateFormatted = formatEventDate(s.event_date || schedule?.event_date);
                  return (
                    <option key={s.id} value={s.id} disabled={isDisabled}>
                      {eventDateFormatted ? `${eventDateFormatted} — ` : ""}{s.name} ({s.starts_at}–{s.ends_at} WITA){isFull ? " [PENUH]" : (!allowed ? " [Dibatasi]" : "")}
                    </option>
                  );
                })}
              </select>
            </label>

            <p className="muted" role="status">
              {full ? "Semua sesi pada jadwal ini penuh." : status}
            </p>

            <button
              className="primary"
              disabled={busy || full || !sessions.length || !selected}
            >
              {busy ? "Menyimpan pendaftaran…" : `Mendaftar ↗`}
            </button>
            <p className="privacy">
              Data digunakan untuk administrasi kegiatan pelatihan Gemini Academy Unhas.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
