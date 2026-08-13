"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/profile";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
}

function authRedirect(kind: "error" | "message", message: string, next: string): never {
  redirect(`/login?${kind}=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) authRedirect("error", "กรุณากรอกอีเมลและรหัสผ่าน", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authRedirect("error", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", next);
  redirect(next);
}

export async function signInWithLine(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "custom:line",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "openid profile",
    },
  });

  if (error || !data.url) {
    authRedirect("error", "ไม่สามารถเชื่อมต่อ LINE ได้ กรุณาลองใหม่", next);
  }
  redirect(data.url);
}

export async function signUp(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (displayName.length < 2 || displayName.length > 80) {
    authRedirect("error", "ชื่อที่แสดงต้องยาว 2–80 ตัวอักษร", next);
  }
  if (!email || password.length < 8) {
    authRedirect("error", "กรุณาใช้อีเมลที่ถูกต้องและรหัสผ่านอย่างน้อย 8 ตัวอักษร", next);
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) authRedirect("error", "ไม่สามารถสร้างบัญชีได้ กรุณาตรวจอีเมลหรือลองใหม่", next);
  if (data.session) redirect(next);
  authRedirect("message", "สร้างบัญชีแล้ว กรุณาเปิดอีเมลเพื่อยืนยันบัญชี", next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?message=" + encodeURIComponent("ออกจากระบบแล้ว"));
}
