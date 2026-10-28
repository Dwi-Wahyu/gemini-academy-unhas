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
  const [schedules, setSchedules] = useState([]),
    [units, setUnits] = useState([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Memuat jadwal & kuota…"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [selectedUnit, setSelectedUnit] = useState(""),
    [employmentStatus, setEmploymentStatus] = useState(
      role === "Mahasiswa" ? "Mahasiswa" : "PNS"
    );

  async function refresh() {
    try {
      const [rSessions, rUnits] = await Promise.all([
        fetch(`/api/sessions?profession=${encodeURIComponent(role)}`, { cache: "no-store" }),
        fetch("/api/units", { cache: "no-store" }),
      ]);
      const [dSessions, dUnits] = await Promise.all([
        rSessions.json(),
        rUnits.json(),
      ]);
      if (!rSessions.ok) throw Error(dSessions.error);
      if (!rUnits.ok) throw Error(dUnits.error);

      const allScheds = dSessions.schedules || (dSessions.schedule ? [dSessions.schedule] : []);
      setSchedules(allScheds);
      setUnits(dUnits);
      setStatus("");

      // Kumpulkan semua sesi yang valid untuk role ini dari seluruh jadwal aktif
      const validSess = allScheds
        .filter((sc) => sc.is_active)
        .flatMap((sc) =>
          (sc.sessions || [])
            .filter((s) => isSessionAllowed(s, role))
            .map((s) => ({
              ...s,
              schedule_title: sc.title,
              event_date: sc.event_date,
              location: sc.location,
              schedule_exempt_student_quota: sc.exempt_student_quota,
            }))
        );

      setSelected((v) => {
        const found = validSess.find((s) => String(s.id) === v);
        if (found && Number(found.remaining) > 0) return v;
        const firstAvailable = validSess.find((s) => Number(s.remaining) > 0);
        return firstAvailable ? String(firstAvailable.id) : "";
      });

      setSelectedUnit((v) =>
        dUnits.some((u) => u.name === v && (role === "Mahasiswa" || u.remaining > 0)) ? v : "",
      );
    } catch {
      setStatus("Jadwal dan kuota belum dapat diperbarui. Coba beberapa saat lagi.");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [role]);

  // Saring semua jadwal aktif yang memiliki minimal 1 sesi yang valid untuk role ini
  const validSchedules = schedules
    .filter((sc) => sc.is_active)
    .map((sc) => {
      const roleSessions = (sc.sessions || []).filter((s) => isSessionAllowed(s, role));
      return {
        ...sc,
        validSessions: roleSessions,
      };
    })
    .filter((sc) => sc.validSessions.length > 0)
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  // Kumpulkan semua sesi valid dari seluruh jadwal untuk opsi dropdown form
  const allValidSessions = validSchedules.flatMap((sc) =>
    sc.validSessions.map((s) => ({
      ...s,
      schedule_title: sc.title,
      event_date: sc.event_date,
      location: sc.location,
      schedule_exempt_student_quota: sc.exempt_student_quota,
    }))
  );

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const formData = new FormData(e.currentTarget);
      const chosenSessionId = formData.get("academy_session_id");
      const chosenSession = allValidSessions.find((s) => String(s.id) === String(chosenSessionId));
      if (!chosenSession || Number(chosenSession.remaining) <= 0) {
        throw Error("Sesi pelatihan yang dipilih sudah penuh. Silakan pilih sesi lainnya.");
      }
      formData.set("profession", role);
      if (role === "Pimpinan") {
        const position = (formData.get("position") || "").toString().trim();
        if (!position) {
          throw Error("Jabatan pimpinan wajib diisi.");
        }
      }
      if (role === "Mahasiswa") {
        formData.set("employment_status", "Mahasiswa");
        const email = (formData.get("email") || "").toString().trim().toLowerCase();
        if (!email) {
          throw Error("Mahasiswa wajib mengisi alamat email Unhas.");
        }
        if (!/^[^\s@]+@(?:[a-z0-9-]+\.)*unhas\.ac\.id$/i.test(email)) {
          throw Error("Mahasiswa wajib menggunakan email resmi Unhas (contoh: @student.unhas.ac.id atau @unhas.ac.id).");
        }
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
      nipLabel: "NIP (18 Digit Angka) *",
      nipPlaceholder: "Masukkan 18 digit NIP",
      nipPattern: "[0-9]{18}",
      nipMax: 18,
      positionLabel: "Jabatan *",
      positionPlaceholder: "Contoh: Dekan / Wakil Dekan / Ketua Lembaga",
      accent: "#1e3a8a",
    },
    Dosen: {
      eyebrow: "01 / JALUR DOSEN",
      title: "Formulir Pendaftaran",
      desc: "Khusus Tenaga Pendidik / Dosen Tetap Universitas Hasanuddin.",
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
      nipLabel: "NIP (18 Digit Angka) *",
      nipPlaceholder: "Masukkan 18 digit NIP",
      nipPattern: "[0-9]{18}",
      nipMax: 18,
      letterLabel: "Surat Usulan Pimpinan Unit Kerja (Opsional)",
      letterHelp: "Unggah berkas usulan bertanda tangan pimpinan unit kerja jika ada (format PDF, maks 5 MB).",
      accent: "#059669",
    },
    Mahasiswa: {
      eyebrow: "01 / JALUR MAHASISWA",
      title: "Formulir Pendaftaran",
      desc: "Khusus Mahasiswa Aktif Diploma, Sarjana, dan Pascasarjana Universitas Hasanuddin.",
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
  const isAllFull = allValidSessions.length > 0 && allValidSessions.every((s) => Number(s.remaining) <= 0);
  const selectedSession = allValidSessions.find((s) => String(s.id) === String(selected));
  const isStudentQuotaExempt =
    role === "Mahasiswa" &&
    (selectedSession
      ? Boolean(selectedSession.exempt_student_quota || selectedSession.schedule_exempt_student_quota)
      : allValidSessions.some((s) => Boolean(s.exempt_student_quota || s.schedule_exempt_student_quota)));

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#64748b",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Kembali ke Pilihan Jalur
        </Link>
      </div>

      <div className="registration-grid">
        {/* BAGIAN KIRI: MENAMPILKAN SEMUA JADWAL DENGAN SESI VALID UNTUK ROLE INI */}
        <section className="intro">
          <h1 style={{ fontSize: "46px", marginTop: "16px" }}>
            {config.title}
            <br />
            <span>Gemini Academy.</span>
          </h1>
          <p className="lead">{config.desc}</p>

          {validSchedules.map((sc) => (
            <div key={sc.id} style={{ marginBottom: "26px" }}>
              <div
                style={{
                  margin: "18px 0 14px",
                  padding: "16px 18px",
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "1px solid rgba(226, 232, 240, 0.95)",
                  borderRadius: "14px",
                  boxShadow: "0 4px 15px -2px rgba(15, 23, 42, 0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: "#1e3a8a",
                    lineHeight: 1.45,
                    marginBottom: "8px",
                  }}
                >
                  {sc.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "14px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>📅</span>
                    <b>{formatEventDate(sc.event_date)}</b>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span>📍</span>
                    <b>{sc.location}</b>
                  </div>
                </div>
              </div>

              <div className="session-list" style={{ marginTop: "10px" }}>
                {sc.validSessions.map((s, i) => {
                  const isSelected = selected === String(s.id);
                  return (
                    <article
                      className="session-card"
                      key={s.id}
                      onClick={() => {
                        if (s.remaining > 0) setSelected(String(s.id));
                      }}
                      style={{
                        cursor: s.remaining > 0 ? "pointer" : "not-allowed",
                        border: isSelected ? "2px solid #567bda" : "1px solid #e0e7f1",
                        background: isSelected ? "#f8faff" : "#fff",
                        boxShadow: isSelected ? "0 4px 14px rgba(86, 123, 218, 0.15)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      <span className="icon">{i % 2 === 0 ? "☀" : "◷"}</span>
                      <div style={{ flex: 1 }}>
                        <b>{s.name}</b>
                        <p>
                          {s.starts_at}–{s.ends_at} WITA
                        </p>
                      </div>
                      <span
                        className="badge"
                        style={{
                          background: s.remaining > 0 ? "#edf7f2" : "#fef2f2",
                          color: s.remaining > 0 ? "#3a8c73" : "#dc2626",
                        }}
                      >
                        {s.remaining > 0 ? `${s.remaining} kursi tersisa` : "Penuh"}
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}

          {!validSchedules.length && (
            <div style={{ padding: "16px", color: "#64748b", fontSize: "14px" }}>
              {status || `Belum ada jadwal kegiatan yang dibuka untuk kategori ${role} saat ini.`}
            </div>
          )}

          <p className="note">
            ⓘ Kuota awal 230 peserta per sesi. Sesi yang telah penuh otomatis tidak dapat dipilih.
          </p>
          <div className="decor">✦</div>
        </section>

        {/* BAGIAN KANAN: FORMULIR PENDAFTARAN */}
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

            {role === "Pimpinan" && (
              <label>
                {config.positionLabel || "Jabatan *"}
                <input
                  name="position"
                  required
                  maxLength={150}
                  placeholder={config.positionPlaceholder || "Contoh: Dekan / Wakil Dekan / Ketua Lembaga"}
                />
                <small>Masukkan jabatan pimpinan unit kerja saat ini.</small>
              </label>
            )}

            <label>
              {role === "Mahasiswa" ? "Fakultas / Program Pascasarjana *" : "Unit Kerja / Fakultas *"}
              <select
                required
                name="unit"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
              >
                <option value="">Pilih unit kerja / fakultas</option>
                {units.map((u) => {
                  const isDisabled = !isStudentQuotaExempt && u.remaining <= 0;
                  return (
                    <option key={u.id} value={u.name} disabled={isDisabled}>
                      {u.name}
                      {isStudentQuotaExempt
                        ? ""
                        : u.remaining > 0
                        ? ` — ${u.remaining} kuota tersisa (maks ${u.max_quota})`
                        : ` — KUOTA PENUH (maks ${u.max_quota})`}
                    </option>
                  );
                })}
              </select>
              <small>
                {isStudentQuotaExempt
                  ? "Khusus kategori Mahasiswa pada sesi ini, pendaftaran tidak dibatasi kuota per fakultas."
                  : "Setiap unit kerja memiliki batas maksimal kuota pengusulan."}
              </small>
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

            {role !== "Pimpinan" && (
              <label>
                {config.letterLabel}
                <input
                  type="file"
                  name="letter"
                  required={role !== "Tendik"}
                  accept=".pdf,application/pdf"
                />
                <small>{config.letterHelp}</small>
              </label>
            )}

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
              Alamat Email Unhas {role === "Mahasiswa" ? "*" : <span className="optional">Opsional</span>}
              <input
                name="email"
                type="email"
                required={role === "Mahasiswa"}
                maxLength={200}
                autoComplete="email"
                placeholder={
                  role === "Mahasiswa"
                    ? "nama@student.unhas.ac.id atau nama@unhas.ac.id"
                    : "nama@unhas.ac.id"
                }
              />
              <small>
                {role === "Mahasiswa"
                  ? "Wajib menggunakan email resmi Unhas (contoh: @student.unhas.ac.id atau @unhas.ac.id)."
                  : "Boleh dikosongkan bila belum memiliki email Unhas."}
              </small>
            </label>

            {/* PILIHAN SESI: MENAMPILKAN SEMUA JADWAL & SESI YANG VALID UNTUK ROLE INI */}
            <label>
              Pilihan Sesi Pelatihan *
              <select
                required
                name="academy_session_id"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Pilih sesi yang tersedia</option>
                {allValidSessions.map((s) => {
                  const isFull = Number(s.remaining) <= 0;
                  const eventDateFormatted = formatEventDate(s.event_date);
                  return (
                    <option key={s.id} value={s.id} disabled={isFull}>
                      {eventDateFormatted ? `${eventDateFormatted} — ` : ""}{s.name} ({s.starts_at}–{s.ends_at} WITA){isFull ? " [PENUH]" : ""}
                    </option>
                  );
                })}
              </select>
              <small style={{ color: "#1e40af", marginTop: "4px", display: "block" }}>
                ℹ Menampilkan seluruh jadwal dan sesi yang dibuka untuk kategori {role}.
              </small>
            </label>

            <p className="muted" role="status">
              {isAllFull ? "Semua sesi pelatihan untuk kategori ini sudah penuh." : status}
            </p>

            <button
              className="primary"
              disabled={
                busy ||
                isAllFull ||
                !allValidSessions.length ||
                !selected ||
                Number(allValidSessions.find((s) => String(s.id) === String(selected))?.remaining || 0) <= 0
              }
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
