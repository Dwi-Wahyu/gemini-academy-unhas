import RegistrationForm from "../RegistrationForm";

export const metadata = {
  title: "Pendaftaran Dosen · Gemini Academy Unhas",
  description: "Formulir pendaftaran khusus Dosen / Tenaga Pendidik Universitas Hasanuddin.",
};

export default function DosenPage() {
  return <RegistrationForm role="Dosen" />;
}
