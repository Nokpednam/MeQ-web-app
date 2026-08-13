import { redirect } from "next/navigation";

export default function MaintenanceRedirectPage() {
  redirect("/maintenance/new");
}
