import { admin } from "../../lib/auth.js";
import { redirect } from "next/navigation";
import Dashboard from "./ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!await admin()) redirect("/admin/login");
  return <Dashboard />;
}
