import "./globals.css";
import Link from "next/link";
export const metadata = {
  title: "Gemini Academy · Unhas",
  description: "Pendaftaran Gemini Academy Universitas Hasanuddin",
};
export default function Layout({ children }) {
  return (
    <html lang="id">
      <body>
        <header>
          <Link className="brand" href="/">
            <span>✦</span> Gemini <b>Academy</b>
          </Link>
          <nav>
            <span className="unhas">UNIVERSITAS HASANUDDIN</span>
            <Link href="/admin">Dashboard</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <span>Gemini Academy × Universitas Hasanuddin</span>
          <Link href="/admin">Admin ↗</Link>
        </footer>
      </body>
    </html>
  );
}
