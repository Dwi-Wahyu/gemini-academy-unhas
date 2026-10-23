"use client";
import { useState } from "react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.location.assign("/admin");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <section className="card login-card">
      <div className="eyebrow">AREA ADMINISTRATOR</div>
      <h2>Masuk ke dashboard</h2>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Kata Sandi
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Memeriksa…" : "Masuk ↗"}
        </button>
      </form>
    </section>
  );
}
