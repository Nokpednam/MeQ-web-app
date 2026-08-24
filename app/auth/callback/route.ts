import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error("OAuth callback session exchange failed", {
      message: error.message,
      code: error.code,
      status: error.status,
    });
  } else {
    console.error("OAuth callback did not receive an authorization code");
  }
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent("ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ")}`, request.url),
  );
}
