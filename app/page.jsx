"use client";
import { useEffect, useState } from "react";
export default function Registration() {
  const [sessions, setSessions] = useState([]),
    [units, setUnits] = useState([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Memuat kuota…"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [selectedUnit, setSelectedUnit] = useState(""),
    [profession, setProfession] = useState(""),
    [employmentStatus, setEmploymentStatus] = useState("");
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
      setSessions(dSessions);
      setUnits(dUnits);
      setStatus("");
      setSelected((v) =>
        dSessions.some((s) => String(s.id) === v && s.remaining > 0) ? v : "",
      );
      setSelectedUnit((v) =>
        dUnits.some((u) => u.name === v && u.remaining > 0) ? v : "",
      );
    } catch {
      setStatus(
        "Kuota belum dapat diperbarui. Coba kembali beberapa saat lagi.",
      );
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const formData = new FormData(e.currentTarget);
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
  const full = sessions.length > 0 && sessions.every((s) => s.remaining === 0);
  return (
    <div className="registration-grid">
      <section className="intro">
        <div className="eyebrow">● PENDAFTARAN PESERTA</div>
        <h1>
          Mulai langkah
          <br />
          baru bersama <span>AI.</span>
        </h1>
        <p className="lead">
          Jelajahi potensi kecerdasan artifisial bersama Gemini Academy.
          Daftarkan diri Anda dan pilih sesi yang sesuai.
        </p>
        <div className="session-list">
          {sessions.map((s, i) => (
            <article className="session-card" key={s.id}>
              <span className="icon">{i ? "◷" : "☀"}</span>
              <div>
                <b>{s.name}</b>
                <p>
                  {s.starts_at}–{s.ends_at} WITA
                </p>
              </div>
              <span className="badge">{s.remaining} kursi tersisa</span>
            </article>
          ))}
        </div>
        <p className="note">
          ⓘ Kuota awal 230 peserta per sesi. Sesi penuh otomatis tidak dapat
          dipilih.
        </p>
        <div className="decor">✦</div>
      </section>
      <section className="card">
        <div className="eyebrow">01 / PENDAFTARAN</div>
        <h2>Daftar Gemini Academy</h2>
        <p className="muted">Lengkapi data diri Anda di bawah ini.</p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Nama Lengkap *
            <input
              name="name"
              required
              minLength={2}
              maxLength={150}
              autoComplete="name"
              placeholder="Nama lengkap beserta gelar"
            />
          </label>
          <label>
            NIP *
            <input
              name="nip"
              required
              pattern="[0-9]{18}"
              maxLength={18}
              inputMode="numeric"
              placeholder="Masukkan 18 digit NIP"
            />
            <small>NIP digunakan untuk mencegah pendaftaran ganda.</small>
          </label>
          <label>
            Unit Kerja *
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
            <small>Setiap unit kerja memiliki batas maksimal pengusulan.</small>
          </label>
          <label>
            Kategori Profesi *
            <select
              required
              name="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
            >
              <option value="">Pilih kategori profesi</option>
              <option value="Dosen">Dosen</option>
              <option value="Tendik">Tenaga Kependidikan (Tendik)</option>
            </select>
          </label>
          <label>
            Status Kepegawaian *
            <select
              required
              name="employment_status"
              value={employmentStatus}
              onChange={(e) => setEmploymentStatus(e.target.value)}
            >
              <option value="">Pilih status kepegawaian</option>
              <option value="PNS">PNS (Pegawai Negeri Sipil)</option>
              <option value="NPT">NPT (Non-PNS Tetap)</option>
              <option value="NPTT">NPTT (Non-PNS Tidak Tetap)</option>
            </select>
          </label>
          <label>
            Surat Usulan Pimpinan Unit Kerja *
            <input
              type="file"
              name="letter"
              required
              accept=".pdf,application/pdf"
            />
            <small>
              Unggah berkas usulan bertanda tangan pimpinan unit kerja (format PDF, maks 5 MB).
            </small>
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
            Alamat Email Unhas <span className="optional">Opsional</span>
            <input
              name="email"
              type="email"
              maxLength={200}
              autoComplete="email"
              placeholder="nama@unhas.ac.id"
            />
            <small>Boleh dikosongkan bila belum memiliki.</small>
          </label>
          <label>
            Pilihan Sesi *
            <select
              required
              name="academy_session_id"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Pilih sesi yang tersedia</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.remaining}>
                  {s.name} : {s.starts_at}–{s.ends_at} WITA —{" "}
                  {s.remaining ? s.remaining + " kursi" : "PENUH"}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" role="status">
            {full ? "Semua sesi penuh. Pendaftaran ditutup." : status}
          </p>
          <button
            className="primary"
            disabled={busy || full || !sessions.length}
          >
            {busy ? "Menyimpan pendaftaran…" : "Daftar sekarang ↗"}
          </button>
          <p className="privacy">
            Data digunakan untuk administrasi kegiatan Gemini Academy.
          </p>
        </form>
      </section>
    </div>
  );
}
