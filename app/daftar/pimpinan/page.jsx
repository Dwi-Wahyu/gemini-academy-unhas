import RegistrationForm from "../RegistrationForm";

export const metadata = {
  title: "Pendaftaran Pimpinan Unit Kerja · Gemini Academy Unhas",
  description: "Formulir pendaftaran khusus Pimpinan Unit Kerja Universitas Hasanuddin.",
};

export default function PimpinanPage() {
  return <RegistrationForm role="Pimpinan" />;
}
