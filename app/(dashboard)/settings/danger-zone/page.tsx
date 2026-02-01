import { redirect } from "next/navigation";

export default function DangerZonePage() {
  redirect("/settings/account#danger-zone");
}
