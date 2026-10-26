import RegistrationForm from "../RegistrationForm";

export const metadata = {
  title: "Pendaftaran Tenaga Kependidikan (Tendik) · Gemini Academy Unhas",
  description: "Formulir pendaftaran khusus Tenaga Kependidikan / Staf Administrasi Universitas Hasanuddin.",
};

export default function TendikPage() {
  return <RegistrationForm role="Tendik" />;
}
