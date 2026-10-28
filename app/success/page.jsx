"use client";
import { useEffect, useState } from "react";
export default function Success() {
  const [r, setR] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/receipt")
      .then(async (x) => {
        const d = await x.json();
        if (!x.ok) throw Error(d.error);
        setR(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="card receipt">
      {r ? (
        <>
          <div className="check">✓</div>
          <div className="eyebrow">PENDAFTARAN BERHASIL</div>
          <h2>Terima kasih, {r.name}!</h2>
          <p>
            Anda terdaftar di <b>{r.session}</b>
            {r.profession && r.employment_status ? (
              <>
                {" "}sebagai <b>{r.profession} ({r.employment_status})</b>
                {r.position ? <> — <b>{r.position}</b></> : null}
              </>
            ) : null}
            .
          </p>
          <div className="receipt-box">
            <b>
              {r.starts_at}–{r.ends_at} WITA
            </b>
            <p>Kode pendaftaran</p>
            <code>{r.registration_code}</code>
          </div>
          <button onClick={() => window.print()}>Simpan / cetak bukti ↗</button>
        </>
      ) : (
        <p role="status">{error || "Memuat bukti…"}</p>
      )}
      <a className="back" href="/">
        Kembali ke formulir
      </a>
    </section>
  );
}
