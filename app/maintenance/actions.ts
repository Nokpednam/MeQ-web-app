"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteMaintenanceReport } from "@/lib/supabase-maintenance-repository";


const allowedImages = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const allowedStatuses = new Set(["NEW", "IN_PROGRESS", "WAITING_FOR_CARETAKER", "RESOLVED", "REJECTED"]);

export async function submitMaintenanceReportAction(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/maintenance/new");

  const courtId = String(form.get("court"));
  const category = String(form.get("category"));
  const details = String(form.get("details") ?? "").trim();
  const image = form.get("image");
  if (!["3x3-a", "3x3-b", "5x5"].includes(courtId) || !["SURFACE", "HOOP", "LIGHTING", "OTHER"].includes(category) || details.length < 5 || details.length > 1000) {
    redirect("/maintenance/new?error=invalid");
  }

  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    const extension = allowedImages.get(image.type);
    if (!extension || image.size > 5 * 1024 * 1024) redirect("/maintenance/new?error=image");
    imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("maintenance-evidence").upload(imagePath, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (error) redirect("/maintenance/new?error=upload");
  }

  const { error } = await supabase.rpc("create_maintenance_report", {
    p_court_id: courtId,
    p_category: category,
    p_details: details,
    p_image_path: imagePath,
  });
  if (error) {
    if (imagePath) await supabase.storage.from("maintenance-evidence").remove([imagePath]);
    const reason = error.message.includes("DUPLICATE_ACTIVE_REPORT") || error.code === "23505" ? "duplicate" : "save";
    redirect(`/maintenance/new?error=${reason}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/maintenance");
  revalidatePath("/maintenance");
  redirect("/maintenance/new?success=1");
}

export async function updateMaintenanceStatusAction(form: FormData) {
  const returnTo = form.get("returnTo") === "/admin/maintenance" ? "/admin/maintenance" : "/admin";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${returnTo}`);
  const status = String(form.get("status"));
  if (!allowedStatuses.has(status)) redirect(`${returnTo}?maintenance=error#maintenance-reports`);

  const { error } = await supabase.rpc("admin_update_maintenance_status", {
    p_report_id: String(form.get("reportId")),
    p_status: status,
    p_admin_note: String(form.get("adminNote") ?? ""),
  });
  if (error) redirect(`${returnTo}?maintenance=error#maintenance-reports`);

  revalidatePath("/admin");
  revalidatePath("/admin/maintenance");
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/new");
  revalidatePath("/courts", "layout");
  redirect(`${returnTo}?maintenance=saved#maintenance-reports`);
}

export async function deleteMaintenanceReportAction(form: FormData) {
  const returnTo = form.get("returnTo") === "/admin/maintenance" ? "/admin/maintenance" : "/admin";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${returnTo}`);

  const reportId = String(form.get("reportId"));

  try {
    await deleteMaintenanceReport(supabase, reportId);
  } catch {
    redirect(`${returnTo}?maintenance=delete-error#maintenance-reports`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/maintenance");
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/new");
  revalidatePath("/courts", "layout");
  redirect(`${returnTo}?maintenance=deleted#maintenance-reports`);
}
