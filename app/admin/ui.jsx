"use client";
import { useEffect, useState } from "react";
const date = (s) =>
  new Date(s.replace(" ", "T") + "Z").toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
  });
export default function Dashboard() {
  const [d, setD] = useState(null),
    [units, setUnits] = useState([]),
    [tab, setTab] = useState("participants"),
    [error, setError] = useState(""),
    [unitMsg, setUnitMsg] = useState(""),
    [unitName, setUnitName] = useState(""),
    [unitQuota, setUnitQuota] = useState(20),
    [unitBusy, setUnitBusy] = useState(false),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState(null),
    [editModal, setEditModal] = useState(null),
    [editBusy, setEditBusy] = useState(false);

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

  async function deleteUnit(id, name) {
    if (!confirm(`Hapus unit kerja "${name}"?`)) return;
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
    } catch (e) {
      setError(e.message);
    }
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

  async function deleteParticipant(id, name) {
    if (!confirm(`Hapus peserta "${name}"? Kuota sesi akan otomatis dikembalikan.`))
      return;
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
      load(query);
    } catch (err) {
      setError(err.message);
    }
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

      {detail && (
        <section className="card detail-card">
          <button onClick={() => setDetail(null)}>Tutup detail</button>
          <h2>{detail.name}</h2>
          <dl>
            {Object.entries({
              NIP: detail.nip,
              "Unit Kerja": detail.unit,
              "Kategori Profesi": detail.profession || "-",
              "Status Kepegawaian": detail.employment_status || "-",
              WhatsApp: detail.phone,
              Email: detail.email || "Belum memiliki",
              Sesi:
                detail.session +
                " · " +
                detail.starts_at +
                "–" +
                detail.ends_at +
                " WITA",
              "Terdaftar (WITA)": date(detail.created_at),
              Kode: detail.registration_code,
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
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button type="button" onClick={() => startEdit(detail)}>
              Edit Data Peserta ✎
            </button>
            <button
              type="button"
              onClick={() => deleteParticipant(detail.id, detail.name)}
              style={{
                background: "#fff0f0",
                color: "#c53030",
                border: "1px solid #f0d2d2",
              }}
            >
              Hapus Peserta ✕
            </button>
          </div>
        </section>
      )}

      {editModal && (
        <section
          className="card detail-card"
          style={{ maxWidth: "680px", marginBottom: "30px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div className="eyebrow">EDIT DATA PESERTA</div>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditModal(null)}
              style={{ padding: "6px 12px", fontSize: "11px" }}
            >
              Tutup ✕
            </button>
          </div>
          <h2>Edit Peserta: {editModal.name}</h2>
          <p className="muted">
            Perbarui informasi data peserta atau pindahkan pilihan sesi.
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
                      {s.name} ({s.starts_at}–{s.ends_at} WITA)
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
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button type="submit" disabled={editBusy}>
                {editBusy ? "Menyimpan perubahan…" : "Simpan Perubahan ↗"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditModal(null)}
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === "units" ? (
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
                          {u.remaining > 0 ? "Tersedia" : "Penuh (Maks 20)"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => deleteUnit(u.id, u.name)}
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
                          Hapus
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
                dari {d.sessions.reduce((a, s) => a + s.capacity, 0)} kursi
              </small>
            </article>
            {d.sessions.map((s) => (
              <article key={s.id}>
                <span>
                  {s.name} · {s.starts_at}–{s.ends_at} WITA
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
                Filter sesi
                <select name="session">
                  <option value="">Semua sesi</option>
                  {d.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
                      "Sesi",
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
                      <td>{p.session}</td>
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
                          onClick={() => deleteParticipant(p.id, p.name)}
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

