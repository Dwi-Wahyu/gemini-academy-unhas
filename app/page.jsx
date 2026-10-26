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

export default function HomeLanding() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const res = await fetch("/api/schedules", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSchedules(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 15000);
    return () => clearInterval(t);
  }, []);

  const roles = [
    {
      id: "pimpinan",
      role: "Pimpinan",
      icon: "🏛️",
      title: "Pimpinan Unit Kerja",
      badge: "Hari I — Jumat, 30 Okt 2026",
      badgeBg: "#eff6ff",
      badgeColor: "#1e40af",
      target: "Rektorat, Dekanat, Direktur Sekolah, Ketua Lembaga, dan Kepala Biro",
      description: "Sesi pelatihan tingkat kepemimpinan strategis dalam pemanfaatan kecerdasan artifisial.",
      href: "/daftar/pimpinan",
      action: "Buka Formulir Pimpinan →",
      btnBg: "#1e3a8a",
    },
    {
      id: "dosen",
      role: "Dosen",
      icon: "👨‍🏫",
      title: "Dosen / Pendidik",
      badge: "Hari I — Jumat, 30 Okt 2026",
      badgeBg: "#eff6ff",
      badgeColor: "#1e40af",
      target: "Dosen Tetap / Tenaga Pendidik Universitas Hasanuddin",
      description: "Pelatihan integrasi Gemini AI dalam pengajaran, riset akademik, dan kurikulum.",
      href: "/daftar/dosen",
      action: "Buka Formulir Dosen →",
      btnBg: "#2563eb",
    },
    {
      id: "tendik",
      role: "Tendik",
      icon: "💼",
      title: "Tenaga Kependidikan",
      badge: "Hari II — Sabtu, 31 Okt 2026",
      badgeBg: "#ecfdf5",
      badgeColor: "#065f46",
      target: "Staf Administrasi, Laboran, Pranata Komputer, dan Pustakawan",
      description: "Peningkatan efisiensi kerja administrasi dan layanan kampus berbasis AI.",
      href: "/daftar/tendik",
      action: "Buka Formulir Tendik →",
      btnBg: "#059669",
    },
    {
      id: "mahasiswa",
      role: "Mahasiswa",
      icon: "🎓",
      title: "Mahasiswa",
      badge: "Hari II — Sabtu, 31 Okt 2026",
      badgeBg: "#f5f3ff",
      badgeColor: "#5b21b6",
      target: "Mahasiswa Aktif Diploma, Sarjana, dan Pascasarjana Unhas",
      description: "Eksplorasi kecerdasan artifisial untuk produktivitas studi, inovasi, dan riset.",
      href: "/daftar/mahasiswa",
      action: "Buka Formulir Mahasiswa →",
      btnBg: "#7c3aed",
    },
  ];

  return (
    <div style={{ maxWidth: "1160px", margin: "0 auto" }}>
      {/* HERO SECTION */}
      <section style={{ textAlign: "center", padding: "20px 10px 40px" }}>
        <div className="eyebrow">● PENDAFTARAN RESMI PESERTA</div>
        <h1 style={{ fontSize: "56px", margin: "16px 0 20px", letterSpacing: "-1.5px" }}>
          Gemini Academy <span>Universitas Hasanuddin</span>
        </h1>
        <p
          className="lead"
          style={{
            maxWidth: "680px",
            margin: "0 auto 30px",
            fontSize: "16px",
            lineHeight: 1.8,
            color: "#64748b",
          }}
        >
          Program Pelatihan & Sertifikasi Kecerdasan Artifisial (AI) terdepan.
          Pendaftaran dibagi ke dalam formulir terpisah berdasarkan kategori profesi.
          Silakan pilih jalur pendaftaran Anda di bawah ini:
        </p>

        {/* INFO TANGGAL & LOKASI */}
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "18px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "50px",
            padding: "10px 24px",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
            fontSize: "13px",
            color: "#334155",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>📅</span>
            <b>Jumat, 30 Okt 2026</b> (Dosen & Pimpinan)
          </div>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>📅</span>
            <b>Sabtu, 31 Okt 2026</b> (Tendik & Mahasiswa)
          </div>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>📍</span>
            <b>Arsyad Rasyid Lecture Theater</b>
          </div>
        </div>
      </section>

      {/* 4 ROLE NAVIGATION CARDS */}
      <section style={{ margin: "20px 0 50px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
          }}
        >
          {roles.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "26px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 6px 20px -4px rgba(15, 23, 42, 0.06)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                  <span style={{ fontSize: "36px" }}>{r.icon}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "12px",
                      background: r.badgeBg,
                      color: r.badgeColor,
                    }}
                  >
                    {r.badge}
                  </span>
                </div>

                <h3 style={{ fontSize: "20px", margin: "0 0 8px", color: "#0f172a", fontWeight: 700 }}>
                  {r.title}
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px", lineHeight: 1.6 }}>
                  {r.description}
                </p>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    fontSize: "11px",
                    color: "#475569",
                    marginBottom: "20px",
                  }}
                >
                  <b style={{ color: "#334155", display: "block", marginBottom: "3px" }}>
                    Sasaran Peserta:
                  </b>
                  {r.target}
                </div>
              </div>

              <Link
                href={r.href}
                style={{
                  display: "block",
                  textAlign: "center",
                  background: r.btnBg,
                  color: "#ffffff",
                  padding: "12px 18px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "13px",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                  transition: "opacity 0.15s ease",
                }}
              >
                {r.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* OVERVIEW KUOTA SESI REAL-TIME */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "32px",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          <div>
            <div className="eyebrow">MONITORING KUOTA PELATIHAN</div>
            <h2 style={{ fontSize: "22px", margin: "4px 0 0" }}>Jadwal & Sesi Pelatihan</h2>
          </div>
          <span style={{ fontSize: "11.5px", color: "#64748b" }}>
            Diperbarui otomatis tiap 15 detik
          </span>
        </div>

        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>Memuat jadwal kegiatan…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {schedules.map((sc) => (
              <div
                key={sc.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <b style={{ color: "#1e3a8a", fontSize: "14px", display: "block" }}>
                      📅 {formatEventDate(sc.event_date)}
                    </b>
                    <small style={{ color: "#64748b" }}>📍 {sc.location}</small>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: sc.id === 1 ? "#eff6ff" : "#ecfdf5",
                      color: sc.id === 1 ? "#1e40af" : "#065f46",
                    }}
                  >
                    {sc.id === 1 ? "Dosen & Pimpinan" : "Tendik & Mahasiswa"}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
                  {sc.sessions?.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <b style={{ fontSize: "13px", color: "#1e293b" }}>{s.name}</b>
                        <small style={{ color: "#64748b", display: "block", marginTop: "2px" }}>
                          {s.starts_at}–{s.ends_at} WITA
                        </small>
                      </div>
                      <span
                        className="badge"
                        style={{
                          background: s.remaining > 0 ? "#edf7f2" : "#fef2f2",
                          color: s.remaining > 0 ? "#3a8c73" : "#dc2626",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {s.remaining > 0 ? `${s.remaining} kursi sisa` : "PENUH"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
