"use client";
import { useEffect, useState } from "react";

const date = (s) =>
  new Date(s.replace(" ", "T") + "Z").toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
  });

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

const PROFESSIONS = ["Dosen", "Pimpinan", "Tendik", "Mahasiswa"];

function parseProfessions(str) {
  if (!str || str === "ALL") return [...PROFESSIONS];
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

function toggleProfession(currentStr, prof) {
  let list = parseProfessions(currentStr);
  if (list.includes(prof)) {
    list = list.filter((p) => p !== prof);
  } else {
    list = [...list, prof];
  }
  if (list.length === 0) return prof;
  if (list.length === PROFESSIONS.length) return "ALL";
  return list.join(",");
}

export default function Dashboard() {
  const [d, setD] = useState(null),
    [units, setUnits] = useState([]),
    [schedules, setSchedules] = useState([]),
    [filterSchedule, setFilterSchedule] = useState(""),
    [filterSession, setFilterSession] = useState(""),
    [tab, setTab] = useState("participants"),
    [error, setError] = useState(""),
    [unitMsg, setUnitMsg] = useState(""),
    [unitName, setUnitName] = useState(""),
    [unitQuota, setUnitQuota] = useState(20),
    [unitBusy, setUnitBusy] = useState(false),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState(null),
    [editModal, setEditModal] = useState(null),
    [editBusy, setEditBusy] = useState(false),
    [editUnitModal, setEditUnitModal] = useState(null),
    [editUnitBusy, setEditUnitBusy] = useState(false),
    [confirmModal, setConfirmModal] = useState(null),
    [confirmBusy, setConfirmBusy] = useState(false),
    [scheduleTitle, setScheduleTitle] = useState("Program Pelatihan dan Sertifikasi Gemini Certified Faculty untuk Dosen dan Tenaga Pendidikan Universitas Hasanuddin"),
    [scheduleDate, setScheduleDate] = useState("2026-10-30"),
    [scheduleLocation, setScheduleLocation] = useState("Arsyad Rasyid Lecture Theather"),
    [scheduleDesc, setScheduleDesc] = useState(""),
    [scheduleSessions, setScheduleSessions] = useState([
      { name: "Sesi I (Pagi)", starts_at: "08:30", ends_at: "11:30", capacity: 230, allowed_professions: "Dosen,Pimpinan" },
      { name: "Sesi II (Siang)", starts_at: "13:30", ends_at: "16:30", capacity: 230, allowed_professions: "Dosen,Pimpinan,Tendik" },
    ]),
    [scheduleBusy, setScheduleBusy] = useState(false),
    [editScheduleModal, setEditScheduleModal] = useState(null),
    [editScheduleBusy, setEditScheduleBusy] = useState(false);

  // Tangani tombol ESC untuk menutup dialog yang sedang terbuka
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (confirmModal && !confirmBusy) setConfirmModal(null);
        else if (editScheduleModal && !editScheduleBusy) setEditScheduleModal(null);
        else if (editUnitModal && !editUnitBusy) setEditUnitModal(null);
        else if (editModal && !editBusy) setEditModal(null);
        else if (detail) setDetail(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModal, confirmBusy, editScheduleModal, editScheduleBusy, editUnitModal, editUnitBusy, editModal, editBusy, detail]);

  async function load(q = "") {
    setError("");
    try {
      const [rP, rU] = await Promise.all([
        fetch("/api/participants?" + q, { cache: "no-store" }),
        fetch("/api/units", { cache: "no-store" }),
      ]);
      if (rP.status === 401) {
        location.assign("/admin/login");
        return;
      }
      const jP = await rP.json();
      if (!rP.ok) throw Error(jP.error);
      setD(jP);
      if (jP.schedules) setSchedules(jP.schedules);
      setQuery(q);
      if (rU.ok) setUnits(await rU.json());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function show(id) {
    try {
      const r = await fetch("/api/participants/" + id);
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setDetail(j);
    } catch (e) {
      setError(e.message);
    }
  }

  async function logout() {
    try {
      const r = await fetch("/api/logout", { method: "POST" });
      if (!r.ok) throw Error("Gagal keluar. Coba lagi.");
      location.assign("/admin/login");
    } catch (e) {
      setError(e.message);
    }
  }

  function page(n) {
    const p = new URLSearchParams(query);
    p.set("page", String(n));
    load(p.toString());
  }

  async function addUnit(e) {
    e.preventDefault();
    setUnitBusy(true);
    setError("");
    setUnitMsg("");
    try {
      const r = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: unitName,
          max_quota: Number(unitQuota) || 20,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setUnits(j.units);
      setUnitName("");
      setUnitQuota(20);
      setUnitMsg("Unit kerja berhasil ditambahkan.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUnitBusy(false);
    }
  }

  function startEditUnit(u) {
    setEditUnitModal({
      id: u.id,
      name: u.name,
      max_quota: u.max_quota,
      used: u.used,
    });
    setError("");
    setUnitMsg("");
  }

  async function saveEditUnit(e) {
    e.preventDefault();
    setEditUnitBusy(true);
    setError("");
    setUnitMsg("");
    try {
      const r = await fetch("/api/units/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUnitModal.id,
          name: editUnitModal.name,
          max_quota: Number(editUnitModal.max_quota),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setUnits(j.units);
      setUnitMsg(j.message || "Unit kerja berhasil diperbarui.");
      setEditUnitModal(null);
      load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditUnitBusy(false);
    }
  }

  function askDeleteUnit(id, name) {
    setConfirmModal({
      title: "Hapus Unit Kerja?",
      message: `Apakah Anda yakin ingin menghapus unit kerja "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Ya, Hapus Unit",
      danger: true,
      action: async () => {
        setConfirmBusy(true);
        setError("");
        setUnitMsg("");
        try {
          const r = await fetch("/api/units/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const j = await r.json();
          if (!r.ok) throw Error(j.error);
          setUnits(j.units);
          setUnitMsg(`Unit kerja "${name}" berhasil dihapus.`);
          setConfirmModal(null);
        } catch (e) {
          setError(e.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  async function addSchedule(e) {
    e.preventDefault();
    setScheduleBusy(true);
    setError("");
    setUnitMsg("");
    try {
      const r = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleTitle,
          event_date: scheduleDate,
          location: scheduleLocation,
          description: scheduleDesc,
          sessions: scheduleSessions,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setSchedules(j.schedules);
      setUnitMsg(j.message || "Jadwal kegiatan berhasil ditambahkan.");
      load(query);
    } catch (e) {
      setError(e.message);
    } finally {
      setScheduleBusy(false);
    }
  }

  function startEditSchedule(sc) {
    setEditScheduleModal({
      id: sc.id,
      title: sc.title,
      event_date: sc.event_date,
      location: sc.location,
      description: sc.description || "",
      is_active: sc.is_active,
      sessions: sc.sessions
        ? sc.sessions.map((s) => ({
            id: s.id,
            name: s.name,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            capacity: s.capacity,
            reserved: s.reserved,
            allowed_professions: s.allowed_professions || "ALL",
          }))
        : [],
    });
    setError("");
    setUnitMsg("");
  }

  async function saveEditSchedule(e) {
    e.preventDefault();
    setEditScheduleBusy(true);
    setError("");
    setUnitMsg("");
    try {
      const r = await fetch("/api/schedules/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editScheduleModal),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setSchedules(j.schedules);
      setUnitMsg(j.message || "Jadwal berhasil diperbarui.");
      setEditScheduleModal(null);
      load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditScheduleBusy(false);
    }
  }

  async function toggleScheduleActive(sc) {
    setError("");
    setUnitMsg("");
    try {
      const r = await fetch("/api/schedules/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sc,
          is_active: sc.is_active ? 0 : 1,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setSchedules(j.schedules);
      setUnitMsg(
        `Status jadwal "${sc.title}" diubah menjadi ${
          sc.is_active ? "Nonaktif" : "Aktif"
        }.`
      );
      load(query);
    } catch (err) {
      setError(err.message);
    }
  }

  function askDeleteSchedule(id, title) {
    setConfirmModal({
      title: "Hapus Jadwal Kegiatan?",
      message: `Apakah Anda yakin ingin menghapus jadwal "${title}"? Seluruh sesi terkait akan ikut dihapus.`,
      confirmText: "Ya, Hapus Jadwal",
      danger: true,
      action: async () => {
        setConfirmBusy(true);
        setError("");
        setUnitMsg("");
        try {
          const r = await fetch("/api/schedules/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const j = await r.json();
          if (!r.ok) throw Error(j.error);
          setSchedules(j.schedules);
          setUnitMsg(`Jadwal "${title}" berhasil dihapus.`);
          setConfirmModal(null);
          load(query);
        } catch (e) {
          setError(e.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  function startEdit(p) {
    setEditModal({
      id: p.id,
      name: p.name,
      nip: p.nip,
      unit: p.unit,
      profession: p.profession || "Dosen",
      employment_status: p.employment_status || "PNS",
      phone: p.phone,
      email: p.email || "",
      academy_session_id: p.academy_session_id,
      letter_file: p.letter_file || "",
    });
    setError("");
    setUnitMsg("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditBusy(true);
    setError("");
    setUnitMsg("");
    try {
      const formData = new FormData(e.currentTarget);
      const r = await fetch(`/api/participants/${editModal.id}/edit`, {
        method: "POST",
        body: formData,
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setUnitMsg(j.message || "Data peserta berhasil diperbarui.");
      setEditModal(null);
      load(query);
      if (detail && detail.id === editModal.id) {
        show(editModal.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  function askDeleteParticipant(id, name) {
    setConfirmModal({
      title: "Hapus Peserta?",
      message: `Apakah Anda yakin ingin menghapus peserta "${name}"? Kuota yang sebelumnya digunakan oleh peserta ini akan otomatis dikembalikan ke kuota sesi terkait.`,
      confirmText: "Ya, Hapus Peserta",
      danger: true,
      action: async () => {
        setConfirmBusy(true);
        setError("");
        setUnitMsg("");
        try {
          const r = await fetch(`/api/participants/${id}/delete`, {
            method: "POST",
          });
          const j = await r.json();
          if (!r.ok) throw Error(j.error);
          setUnitMsg(j.message || `Peserta "${name}" berhasil dihapus.`);
          if (detail && detail.id === id) setDetail(null);
          if (editModal && editModal.id === id) setEditModal(null);
          setConfirmModal(null);
          load(query);
        } catch (err) {
          setError(err.message);
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATOR · GEMINI ACADEMY</div>
          <h1 className="admin-h1">Panel Administrator</h1>
        </div>
        <div>
          <button onClick={() => load(query)}>↻ Perbarui</button>{" "}
          <button onClick={logout}>Keluar</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "22px" }}>
        <button
          className={tab === "participants" ? "" : "secondary"}
          onClick={() => {
            setTab("participants");
            setError("");
          }}
        >
          Daftar Peserta {d ? `(${d.total})` : ""}
        </button>
        <button
          className={tab === "schedules" ? "" : "secondary"}
          onClick={() => {
            setTab("schedules");
            setError("");
          }}
        >
          Manajemen Jadwal ({schedules.length})
        </button>
        <button
          className={tab === "units" ? "" : "secondary"}
          onClick={() => {
            setTab("units");
            setError("");
          }}
        >
          Kelola Unit Kerja & Kuota ({units.length})
        </button>
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {unitMsg && (
        <p
          className="alert"
          style={{
            background: "#edf7f2",
            borderColor: "#c3e6d5",
            color: "#286b55",
          }}
          role="status"
        >
          ✓ {unitMsg}
        </p>
      )}

      {/* DIALOG DETAIL PESERTA */}
      {detail && (
        <div className="dialog-overlay" onClick={() => setDetail(null)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <div className="eyebrow">DETAIL PESERTA TERDAFTAR</div>
                <h2>{detail.name}</h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setDetail(null)}
                title="Tutup dialog (Esc)"
              >
                ✕
              </button>
            </div>

            <dl>
              {Object.entries({
                "Nama Lengkap": detail.name,
                NIP: detail.nip,
                "Unit Kerja": detail.unit,
                "Kategori Profesi": detail.profession || "-",
                "Status Kepegawaian": detail.employment_status || "-",
                "Nomor WhatsApp": detail.phone,
                "Email Unhas": detail.email || "Belum memiliki",
                "Jadwal / Program": detail.schedule_title || "Gemini Academy",
                "Tanggal & Lokasi":
                  (detail.event_date ? formatEventDate(detail.event_date) : "-") +
                  (detail.location ? ` (${detail.location})` : ""),
                Sesi:
                  detail.session +
                  " · " +
                  detail.starts_at +
                  "–" +
                  detail.ends_at +
                  " WITA",
                "Terdaftar (WITA)": date(detail.created_at),
                "Kode Pendaftaran": detail.registration_code,
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {detail.letter_file && (
                <div>
                  <dt>Surat Usulan Pimpinan Unit Kerja</dt>
                  <dd>
                    <a
                      href={`/api/participants/${detail.id}/letter`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary"
                      style={{
                        display: "inline-block",
                        marginTop: "6px",
                        padding: "8px 14px",
                      }}
                    >
                      Buka / Unduh Surat Usulan ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div
              className="dialog-actions"
              style={{ justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <button
                type="button"
                onClick={() => askDeleteParticipant(detail.id, detail.name)}
                style={{
                  background: "#fff0f0",
                  color: "#c53030",
                  border: "1px solid #f0d2d2",
                }}
              >
                Hapus Peserta ✕
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDetail(null)}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startEdit(detail);
                    setDetail(null);
                  }}
                >
                  Edit Data Peserta ✎
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG EDIT PESERTA */}
      {editModal && (
        <div
          className="dialog-overlay"
          onClick={() => !editBusy && setEditModal(null)}
        >
          <div
            className="dialog-box modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <div>
                <div className="eyebrow">EDIT DATA PESERTA</div>
                <h2>Edit: {editModal.name}</h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setEditModal(null)}
                disabled={editBusy}
                title="Tutup dialog (Esc)"
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Perbarui informasi pendaftaran atau pindahkan pilihan sesi peserta.
            </p>
            <form onSubmit={saveEdit}>
              <label>
                Nama Lengkap *
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={editModal.name}
                  onChange={(e) =>
                    setEditModal({ ...editModal, name: e.target.value })
                  }
                />
              </label>
              <label>
                NIP * (18 digit angka)
                <input
                  name="nip"
                  required
                  pattern="[0-9]{18}"
                  maxLength={18}
                  inputMode="numeric"
                  value={editModal.nip}
                  onChange={(e) =>
                    setEditModal({ ...editModal, nip: e.target.value })
                  }
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <label>
                  Unit Kerja *
                  <select
                    name="unit"
                    required
                    value={editModal.unit}
                    onChange={(e) =>
                      setEditModal({ ...editModal, unit: e.target.value })
                    }
                  >
                    <option value="">Pilih unit kerja</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                    {!units.some((u) => u.name === editModal.unit) && (
                      <option value={editModal.unit}>{editModal.unit}</option>
                    )}
                  </select>
                </label>
                <label>
                  Pilihan Sesi *
                  <select
                    name="academy_session_id"
                    required
                    value={editModal.academy_session_id}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        academy_session_id: e.target.value,
                      })
                    }
                  >
                    {d?.sessions?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.event_date ? `${formatEventDate(s.event_date)} — ` : ""}{s.name} ({s.starts_at}–{s.ends_at} WITA)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <label>
                  Kategori Profesi *
                  <select
                    name="profession"
                    required
                    value={editModal.profession}
                    onChange={(e) =>
                      setEditModal({ ...editModal, profession: e.target.value })
                    }
                  >
                    <option value="Dosen">Dosen</option>
                    <option value="Tendik">Tenaga Kependidikan (Tendik)</option>
                    <option value="Pimpinan">Pimpinan</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                  </select>
                </label>
                <label>
                  Status Kepegawaian *
                  <select
                    name="employment_status"
                    required
                    value={editModal.employment_status}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        employment_status: e.target.value,
                      })
                    }
                  >
                    <option value="PNS">PNS (Pegawai Negeri Sipil)</option>
                    <option value="NPT">NPT (Non-PNS Tetap)</option>
                    <option value="NPTT">NPTT (Non-PNS Tidak Tetap)</option>
                    <option value="Mahasiswa">Mahasiswa (Aktif)</option>
                  </select>
                </label>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <label>
                  Nomor WhatsApp *
                  <input
                    name="phone"
                    required
                    maxLength={20}
                    value={editModal.phone}
                    onChange={(e) =>
                      setEditModal({ ...editModal, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Email Unhas (Opsional)
                  <input
                    name="email"
                    type="email"
                    maxLength={200}
                    value={editModal.email}
                    onChange={(e) =>
                      setEditModal({ ...editModal, email: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Ganti Berkas Surat Usulan (Format PDF, Maks 5 MB)
                <input
                  type="file"
                  name="letter"
                  accept=".pdf,application/pdf"
                />
                <small>
                  {editModal.letter_file
                    ? `Berkas tersimpan saat ini: ${editModal.letter_file}. Biarkan kosong jika tidak ingin mengubah berkas.`
                    : "Belum ada berkas terunggah. Pilih file PDF untuk mengunggah berkas baru."}
                </small>
              </label>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditModal(null)}
                  disabled={editBusy}
                >
                  Batal
                </button>
                <button type="submit" disabled={editBusy}>
                  {editBusy ? "Menyimpan perubahan…" : "Simpan Perubahan ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG EDIT JADWAL */}
      {editScheduleModal && (
        <div
          className="dialog-overlay"
          onClick={() => !editScheduleBusy && setEditScheduleModal(null)}
        >
          <div
            className="dialog-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "620px" }}
          >
            <div className="dialog-header">
              <div>
                <div className="eyebrow">KELOLA JADWAL</div>
                <h2>Edit Jadwal Kegiatan</h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setEditScheduleModal(null)}
                disabled={editScheduleBusy}
                title="Tutup dialog (Esc)"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveEditSchedule}>
              <label>
                Nama Program / Kegiatan *
                <input
                  required
                  maxLength={255}
                  value={editScheduleModal.title}
                  onChange={(e) =>
                    setEditScheduleModal({
                      ...editScheduleModal,
                      title: e.target.value,
                    })
                  }
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <label>
                  Tanggal Pelaksanaan *
                  <input
                    type="date"
                    required
                    value={editScheduleModal.event_date}
                    onChange={(e) =>
                      setEditScheduleModal({
                        ...editScheduleModal,
                        event_date: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Lokasi / Tempat *
                  <input
                    required
                    maxLength={255}
                    value={editScheduleModal.location}
                    onChange={(e) =>
                      setEditScheduleModal({
                        ...editScheduleModal,
                        location: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Keterangan
                <input
                  value={editScheduleModal.description || ""}
                  onChange={(e) =>
                    setEditScheduleModal({
                      ...editScheduleModal,
                      description: e.target.value,
                    })
                  }
                  placeholder="Catatan tambahan kegiatan"
                />
              </label>
              <label>
                Status Jadwal
                <select
                  value={editScheduleModal.is_active ? "1" : "0"}
                  onChange={(e) =>
                    setEditScheduleModal({
                      ...editScheduleModal,
                      is_active: e.target.value === "1" ? 1 : 0,
                    })
                  }
                >
                  <option value="1">
                    Aktif (Bisa dipilih pendaftar jika terdekat)
                  </option>
                  <option value="0">
                    Nonaktif (Disembunyikan dari pendaftaran)
                  </option>
                </select>
              </label>

              {editScheduleModal.sessions?.length > 0 && (
                <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "13px",
                      color: "#334155",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Pengaturan Sesi & Kapasitas
                  </span>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {editScheduleModal.sessions.map((sess, idx) => {
                      const allowedList = parseProfessions(sess.allowed_professions);
                      return (
                        <div
                          key={sess.id || idx}
                          style={{
                            background: "#f8fafc",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            display: "grid",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              value={sess.name}
                              onChange={(e) => {
                                const updated = [...editScheduleModal.sessions];
                                updated[idx].name = e.target.value;
                                setEditScheduleModal({
                                  ...editScheduleModal,
                                  sessions: updated,
                                });
                              }}
                              placeholder="Nama Sesi"
                              required
                            />
                            <input
                              value={sess.starts_at}
                              onChange={(e) => {
                                const updated = [...editScheduleModal.sessions];
                                updated[idx].starts_at = e.target.value;
                                setEditScheduleModal({
                                  ...editScheduleModal,
                                  sessions: updated,
                                });
                              }}
                              placeholder="Mulai (08:30)"
                              required
                            />
                            <input
                              value={sess.ends_at}
                              onChange={(e) => {
                                const updated = [...editScheduleModal.sessions];
                                updated[idx].ends_at = e.target.value;
                                setEditScheduleModal({
                                  ...editScheduleModal,
                                  sessions: updated,
                                });
                              }}
                              placeholder="Selesai (11:30)"
                              required
                            />
                            <input
                              type="number"
                              value={sess.capacity}
                              min={sess.reserved || 1}
                              max={2000}
                              onChange={(e) => {
                                const updated = [...editScheduleModal.sessions];
                                updated[idx].capacity = Number(e.target.value);
                                setEditScheduleModal({
                                  ...editScheduleModal,
                                  sessions: updated,
                                });
                              }}
                              placeholder="Kapasitas"
                              required
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                              fontSize: "11px",
                              borderTop: "1px dashed #cbd5e1",
                              paddingTop: "6px",
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "#475569" }}>
                              Hak Akses Role:
                            </span>
                            {PROFESSIONS.map((prof) => {
                              const isAllowed = allowedList.includes(prof);
                              return (
                                <button
                                  key={prof}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editScheduleModal.sessions];
                                    updated[idx].allowed_professions = toggleProfession(
                                      sess.allowed_professions,
                                      prof
                                    );
                                    setEditScheduleModal({
                                      ...editScheduleModal,
                                      sessions: updated,
                                    });
                                  }}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: "11px",
                                    borderRadius: "14px",
                                    border: isAllowed ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                    background: isAllowed ? "#eff6ff" : "#fff",
                                    color: isAllowed ? "#1d4ed8" : "#94a3b8",
                                    fontWeight: isAllowed ? 600 : 400,
                                    cursor: "pointer",
                                  }}
                                  title={`Klik untuk ubah akses ${prof}`}
                                >
                                  {isAllowed ? `✓ ${prof}: Boleh` : `✕ ${prof}: Dilarang`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditScheduleModal(null)}
                  disabled={editScheduleBusy}
                >
                  Batal
                </button>
                <button type="submit" disabled={editScheduleBusy}>
                  {editScheduleBusy ? "Menyimpan…" : "Simpan Perubahan ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG EDIT UNIT KERJA */}
      {editUnitModal && (
        <div
          className="dialog-overlay"
          onClick={() => !editUnitBusy && setEditUnitModal(null)}
        >
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <div className="eyebrow">KELOLA UNIT KERJA</div>
                <h2>Edit Unit Kerja & Kuota</h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setEditUnitModal(null)}
                disabled={editUnitBusy}
                title="Tutup dialog (Esc)"
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Perbarui nama unit kerja atau batas maksimal kuota usulan.
            </p>
            <form onSubmit={saveEditUnit}>
              <label>
                Nama Unit Kerja / Fakultas *
                <input
                  required
                  maxLength={200}
                  value={editUnitModal.name}
                  onChange={(e) =>
                    setEditUnitModal({ ...editUnitModal, name: e.target.value })
                  }
                />
              </label>
              <label>
                Batas Maksimal Kuota Peserta *
                <input
                  type="number"
                  required
                  min={editUnitModal.used || 1}
                  max={1000}
                  value={editUnitModal.max_quota}
                  onChange={(e) =>
                    setEditUnitModal({
                      ...editUnitModal,
                      max_quota: e.target.value,
                    })
                  }
                />
                <small>
                  Jumlah peserta terdaftar saat ini: <b>{editUnitModal.used}</b> orang. Kuota tidak boleh lebih kecil dari jumlah peserta terdaftar.
                </small>
              </label>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditUnitModal(null)}
                  disabled={editUnitBusy}
                >
                  Batal
                </button>
                <button type="submit" disabled={editUnitBusy}>
                  {editUnitBusy ? "Menyimpan…" : "Simpan Perubahan ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG (MODAL PENGGANTI ALERT/CONFIRM) */}
      {confirmModal && (
        <div
          className="dialog-overlay"
          onClick={() => !confirmBusy && setConfirmModal(null)}
        >
          <div
            className="dialog-box confirm-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon confirm-icon-danger">⚠️</div>
            <h2 style={{ fontSize: "20px", marginTop: 0, marginBottom: "10px" }}>
              {confirmModal.title}
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "13px",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              {confirmModal.message}
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={confirmModal.action}
                disabled={confirmBusy}
              >
                {confirmBusy
                  ? "Memproses…"
                  : confirmModal.confirmText || "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONTEN TAB */}
      {tab === "schedules" ? (
        <div style={{ display: "grid", gap: "25px" }}>
          <section className="card">
            <div className="eyebrow">PENGATURAN KEGIATAN</div>
            <h2>Tambah Jadwal & Sesi Baru</h2>
            <p className="muted">
              Atur nama program pelatihan, tanggal pelaksanaan, lokasi gedung/ruangan, serta sesi waktu kegiatan.
            </p>
            <form onSubmit={addSchedule}>
              <div style={{ display: "grid", gap: "15px", marginBottom: "15px" }}>
                <label>
                  Nama Program / Kegiatan *
                  <input
                    required
                    maxLength={255}
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="Contoh: Program Pelatihan dan Sertifikasi Gemini Certified Faculty untuk Dosen dan Tenaga Pendidikan Universitas Hasanuddin"
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <label>
                    Tanggal Pelaksanaan *
                    <input
                      type="date"
                      required
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                    <small>Jadwal aktif dengan tanggal terdekat otomatis tampil di form publik</small>
                  </label>
                  <label>
                    Lokasi / Tempat *
                    <input
                      required
                      maxLength={255}
                      value={scheduleLocation}
                      onChange={(e) => setScheduleLocation(e.target.value)}
                      placeholder="Contoh: Arsyad Rasyid Lecture Theather"
                    />
                    <small>Nama gedung, aula, auditorium, atau ruang kelas</small>
                  </label>
                </div>
                <label>
                  Keterangan Tambahan <span className="optional">Opsional</span>
                  <input
                    value={scheduleDesc}
                    onChange={(e) => setScheduleDesc(e.target.value)}
                    placeholder="Catatan tambahan kegiatan jika ada"
                  />
                </label>
              </div>

              <div
                style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "15px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "#334155" }}>
                    Daftar Sesi pada Jadwal Ini ({scheduleSessions.length} sesi)
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      const nextNum = scheduleSessions.length + 1;
                      const roman =
                        nextNum === 3 ? "III" : nextNum === 4 ? "IV" : String(nextNum);
                      setScheduleSessions([
                        ...scheduleSessions,
                        {
                          name: `Sesi ${roman}`,
                          starts_at: "08:30",
                          ends_at: "11:30",
                          capacity: 230,
                          allowed_professions: "ALL",
                        },
                      ]);
                    }}
                    style={{ padding: "5px 10px", fontSize: "12px" }}
                  >
                    + Tambah Sesi
                  </button>
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  {scheduleSessions.map((sess, idx) => {
                    const allowedList = parseProfessions(sess.allowed_professions);
                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#fff",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            placeholder="Nama Sesi (misal: Sesi I)"
                            value={sess.name}
                            onChange={(e) => {
                              const updated = [...scheduleSessions];
                              updated[idx].name = e.target.value;
                              setScheduleSessions(updated);
                            }}
                            required
                          />
                          <input
                            placeholder="Mulai (08:30)"
                            value={sess.starts_at}
                            onChange={(e) => {
                              const updated = [...scheduleSessions];
                              updated[idx].starts_at = e.target.value;
                              setScheduleSessions(updated);
                            }}
                            required
                          />
                          <input
                            placeholder="Selesai (11:30)"
                            value={sess.ends_at}
                            onChange={(e) => {
                              const updated = [...scheduleSessions];
                              updated[idx].ends_at = e.target.value;
                              setScheduleSessions(updated);
                            }}
                            required
                          />
                          <input
                            type="number"
                            placeholder="Kapasitas"
                            min={1}
                            max={2000}
                            value={sess.capacity}
                            onChange={(e) => {
                              const updated = [...scheduleSessions];
                              updated[idx].capacity = Number(e.target.value);
                              setScheduleSessions(updated);
                            }}
                            required
                          />
                          {scheduleSessions.length > 1 ? (
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => {
                                setScheduleSessions(
                                  scheduleSessions.filter((_, i) => i !== idx)
                                );
                              }}
                              style={{ padding: "6px 10px", color: "#c53030" }}
                              title="Hapus sesi"
                            >
                              ✕
                            </button>
                          ) : (
                            <div style={{ width: "32px" }} />
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flexWrap: "wrap",
                            fontSize: "11px",
                            borderTop: "1px dashed #e2e8f0",
                            paddingTop: "6px",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#475569" }}>
                            Hak Akses Role:
                          </span>
                          {PROFESSIONS.map((prof) => {
                            const isAllowed = allowedList.includes(prof);
                            return (
                              <button
                                key={prof}
                                type="button"
                                onClick={() => {
                                  const updated = [...scheduleSessions];
                                  updated[idx].allowed_professions = toggleProfession(
                                    sess.allowed_professions,
                                    prof
                                  );
                                  setScheduleSessions(updated);
                                }}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  borderRadius: "14px",
                                  border: isAllowed ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                  background: isAllowed ? "#eff6ff" : "#fff",
                                  color: isAllowed ? "#1d4ed8" : "#94a3b8",
                                  fontWeight: isAllowed ? 600 : 400,
                                  cursor: "pointer",
                                }}
                                title={`Klik untuk ubah akses ${prof}`}
                              >
                                {isAllowed ? `✓ ${prof}: Boleh` : `✕ ${prof}: Dilarang`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={scheduleBusy}>
                {scheduleBusy ? "Menyimpan Jadwal…" : "+ Simpan Jadwal Baru"}
              </button>
            </form>
          </section>

          <section className="card table-card">
            <div className="table-meta" style={{ fontWeight: 600 }}>
              Daftar Jadwal Kegiatan ({schedules.length})
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama Program</th>
                    <th>Tanggal & Tempat</th>
                    <th>Sesi & Kuota</th>
                    <th>Total Peserta</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((sc, i) => (
                    <tr key={sc.id}>
                      <td>{i + 1}</td>
                      <td>
                        <b>{sc.title}</b>
                        {sc.description && <small>{sc.description}</small>}
                      </td>
                      <td>
                        <b style={{ color: "#1e3a8a" }}>
                          {formatEventDate(sc.event_date)}
                        </b>
                        <small>📍 {sc.location}</small>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          {sc.sessions?.map((s) => (
                            <span
                              key={s.id}
                              style={{ fontSize: "11px", color: "#475569" }}
                            >
                              • <b>{s.name}</b> ({s.starts_at}–{s.ends_at} WITA):{" "}
                              <strong>{s.reserved}</strong>/{s.capacity} (
                              {s.remaining} sisa)
                              {s.allowed_professions && s.allowed_professions !== "ALL" && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: "6px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    background: "#e0e7ff",
                                    color: "#3730a3",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                  }}
                                >
                                  🎯 {s.allowed_professions}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <strong>{sc.total_reserved}</strong> / {sc.total_capacity}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="badge"
                          onClick={() => toggleScheduleActive(sc)}
                          style={{
                            cursor: "pointer",
                            background: sc.is_active ? "#edf7f2" : "#f1f5f9",
                            color: sc.is_active ? "#2f855a" : "#64748b",
                            border: "none",
                          }}
                          title="Klik untuk ubah status aktif/nonaktif"
                        >
                          {sc.is_active ? "● Aktif" : "○ Nonaktif"}
                        </button>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="secondary"
                          onClick={() => startEditSchedule(sc)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "11px",
                            marginRight: "6px",
                          }}
                        >
                          Edit ✎
                        </button>
                        <button
                          className="secondary"
                          onClick={() => askDeleteSchedule(sc.id, sc.title)}
                          disabled={Number(sc.total_reserved) > 0}
                          title={
                            Number(sc.total_reserved) > 0
                              ? "Tidak dapat dihapus karena sudah ada peserta"
                              : "Hapus jadwal"
                          }
                          style={{
                            color:
                              Number(sc.total_reserved) > 0
                                ? "#a0aec0"
                                : "#c53030",
                            borderColor: "#e2e8f0",
                            padding: "6px 12px",
                            fontSize: "11px",
                          }}
                        >
                          Hapus ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!schedules.length && (
                    <tr>
                      <td colSpan={7} className="empty">
                        Belum ada jadwal yang ditambahkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : tab === "units" ? (
        <div style={{ display: "grid", gap: "25px" }}>
          <section className="card">
            <div className="eyebrow">INPUT DATA MANUAL</div>
            <h2>Tambah Unit Kerja Baru</h2>
            <p className="muted">
              Tambahkan fakultas, lembaga, biro, atau unit baru agar langsung muncul pada pilihan pendaftar.
            </p>
            <form onSubmit={addUnit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr auto",
                  gap: "15px",
                  alignItems: "flex-end",
                }}
              >
                <label style={{ margin: 0 }}>
                  Nama Unit Kerja / Fakultas *
                  <input
                    required
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="Contoh: Fakultas Kedokteran"
                  />
                </label>
                <label style={{ margin: 0 }}>
                  Batas Kuota Peserta *
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={unitQuota}
                    onChange={(e) => setUnitQuota(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={unitBusy}
                  style={{ height: "43px" }}
                >
                  {unitBusy ? "Menyimpan…" : "+ Tambah Unit"}
                </button>
              </div>
            </form>
          </section>

          <section className="card table-card">
            <div className="table-meta" style={{ fontWeight: 600 }}>
              Daftar Unit Kerja & Penggunaan Kuota (Maksimal Pengusulan)
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama Unit Kerja</th>
                    <th>Batas Kuota</th>
                    <th>Terdaftar</th>
                    <th>Sisa Kuota</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.id}>
                      <td>{i + 1}</td>
                      <td>
                        <b>{u.name}</b>
                      </td>
                      <td>{u.max_quota} orang</td>
                      <td>
                        <strong>{u.used}</strong> / {u.max_quota}
                      </td>
                      <td>
                        <span
                          style={{
                            color: u.remaining > 0 ? "#2f855a" : "#c53030",
                            fontWeight: 600,
                          }}
                        >
                          {u.remaining} kursi
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              u.remaining > 0 ? "#edf7f2" : "#fff0f0",
                            color:
                              u.remaining > 0 ? "#2f855a" : "#c53030",
                          }}
                        >
                          {u.remaining > 0 ? "Tersedia" : "Penuh (Maks Kuota)"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          className="secondary"
                          onClick={() => startEditUnit(u)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "11px",
                            marginRight: "6px",
                          }}
                        >
                          Edit ✎
                        </button>
                        <button
                          className="secondary"
                          onClick={() => askDeleteUnit(u.id, u.name)}
                          disabled={u.used > 0}
                          title={
                            u.used > 0
                              ? "Tidak dapat dihapus karena sudah ada peserta"
                              : "Hapus unit kerja"
                          }
                          style={{
                            color: u.used > 0 ? "#a0aec0" : "#c53030",
                            borderColor: "#e2e8f0",
                            padding: "6px 12px",
                            fontSize: "11px",
                          }}
                        >
                          Hapus ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!units.length && (
                    <tr>
                      <td colSpan={7} className="empty">
                        Belum ada unit kerja yang ditambahkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : d ? (
        <>
          <div className="stats">
            <article>
              <span>Total pendaftar</span>
              <strong>{d.all}</strong>
              <small>
                dari{" "}
                {(filterSchedule
                  ? d.sessions.filter(
                      (s) => String(s.schedule_id) === String(filterSchedule)
                    )
                  : d.sessions
                ).reduce((a, s) => a + (Number(s.capacity) || 0), 0)}{" "}
                kursi
              </small>
            </article>
            {(filterSchedule
              ? d.sessions.filter(
                  (s) => String(s.schedule_id) === String(filterSchedule)
                )
              : d.sessions
            ).map((s) => (
              <article key={s.id}>
                <span>
                  {s.name} · {s.starts_at}–{s.ends_at} WITA
                  {s.event_date ? ` (${formatEventDate(s.event_date)})` : ""}
                </span>
                <strong>
                  {s.reserved} <small>/ {s.capacity}</small>
                </strong>
                <progress value={s.reserved} max={s.capacity} />
                <small>{s.remaining} kursi tersisa</small>
              </article>
            ))}
          </div>
          <section className="card table-card">
            <form
              className="filters"
              onSubmit={(e) => {
                e.preventDefault();
                load(
                  new URLSearchParams(new FormData(e.currentTarget)).toString(),
                );
              }}
            >
              <label className="search">
                Cari peserta
                <input
                  name="q"
                  type="search"
                  maxLength={150}
                  placeholder="Nama, NIP, unit kerja, email, WhatsApp"
                />
              </label>
              <label>
                Filter Jadwal
                <select
                  name="schedule"
                  value={filterSchedule}
                  onChange={(e) => {
                    setFilterSchedule(e.target.value);
                    setFilterSession("");
                  }}
                >
                  <option value="">Semua Jadwal</option>
                  {schedules.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {formatEventDate(sc.event_date)} —{" "}
                      {sc.title.length > 28
                        ? sc.title.slice(0, 28) + "…"
                        : sc.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Filter Sesi
                <select
                  name="session"
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                >
                  <option value="">Semua sesi</option>
                  {(filterSchedule
                    ? schedules.find(
                        (sc) => String(sc.id) === String(filterSchedule)
                      )?.sessions ||
                      d.sessions.filter(
                        (s) => String(s.schedule_id) === String(filterSchedule)
                      )
                    : d.sessions
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.starts_at}–{s.ends_at} WITA)
                      {!filterSchedule && s.schedule_title
                        ? ` · ${s.schedule_title.slice(0, 24)}…`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button>Terapkan</button>
              <a className="button secondary" href={"/api/export?" + query}>
                Unduh Excel ↓
              </a>
            </form>
            <div className="table-meta">
              {d.total} peserta ditemukan · Halaman {d.page} dari{" "}
              {Math.max(1, Math.ceil(d.total / 25))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "No.",
                      "Nama / NIP",
                      "Unit Kerja",
                      "Profesi / Status",
                      "WhatsApp / Email",
                      "Jadwal & Sesi",
                      "Surat Usulan",
                      "Terdaftar (WITA)",
                      "Aksi",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.participants.map((p, i) => (
                    <tr key={p.id}>
                      <td>{(d.page - 1) * 25 + i + 1}</td>
                      <td>
                        <b>{p.name}</b>
                        <small>{p.nip}</small>
                      </td>
                      <td>{p.unit}</td>
                      <td>
                        <span className="pill" style={{ marginRight: "4px" }}>
                          {p.profession || "-"}
                        </span>
                        <span
                          className="pill"
                          style={{ background: "#eef3fb" }}
                        >
                          {p.employment_status || "-"}
                        </span>
                      </td>
                      <td>
                        {p.phone}
                        <small>{p.email || "Belum memiliki email Unhas"}</small>
                      </td>
                      <td>
                        <b>{p.session}</b>
                        <small style={{ color: "#64748b", display: "block" }}>
                          {p.event_date ? formatEventDate(p.event_date) : ""}
                          {p.location ? ` · ${p.location}` : ""}
                        </small>
                      </td>
                      <td>
                        {p.letter_file ? (
                          <a
                            href={`/api/participants/${p.id}/letter`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#466fd5",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            Buka ↗
                          </a>
                        ) : (
                          <span style={{ color: "#a0aec0" }}>-</span>
                        )}
                      </td>
                      <td>{date(p.created_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => show(p.id)}
                          style={{
                            padding: "5px 9px",
                            fontSize: "11px",
                            marginRight: "4px",
                          }}
                        >
                          Lihat ↗
                        </button>
                        <button
                          onClick={() => startEdit(p)}
                          className="secondary"
                          style={{
                            padding: "5px 9px",
                            fontSize: "11px",
                            marginRight: "4px",
                          }}
                        >
                          Edit ✎
                        </button>
                        <button
                          onClick={() => askDeleteParticipant(p.id, p.name)}
                          style={{
                            padding: "5px 9px",
                            fontSize: "11px",
                            background: "#fff0f0",
                            color: "#c53030",
                            border: "1px solid #f0d2d2",
                          }}
                        >
                          Hapus ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!d.participants.length && (
                    <tr>
                      <td colSpan={9} className="empty">
                        Belum ada peserta yang sesuai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={d.page <= 1} onClick={() => page(d.page - 1)}>
                ← Sebelumnya
              </button>
              <button
                disabled={d.page * 25 >= d.total}
                onClick={() => page(d.page + 1)}
              >
                Berikutnya →
              </button>
            </div>
          </section>
        </>
      ) : (
        <p role="status">{error ? "Data belum tersedia." : "Memuat data…"}</p>
      )}
    </>
  );
}
