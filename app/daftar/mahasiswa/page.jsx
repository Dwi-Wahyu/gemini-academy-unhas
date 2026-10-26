import RegistrationForm from "../RegistrationForm";

export const metadata = {
  title: "Pendaftaran Mahasiswa · Gemini Academy Unhas",
  description: "Formulir pendaftaran khusus Mahasiswa Aktif Universitas Hasanuddin.",
};

export default function MahasiswaPage() {
  return <RegistrationForm role="Mahasiswa" />;
}
