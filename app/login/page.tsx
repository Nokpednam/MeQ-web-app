import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signInWithLine, signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect(params.next?.startsWith("/") ? params.next : "/profile");

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="auth-brand" href="/">MeQ</Link>
        <p className="section-label">PLAYER ACCESS</p>
        <h1>เข้าสู่ระบบ MeQ</h1>
        <p className="auth-intro">ใช้บัญชีเดียวสำหรับทีม คิวสนาม ผลการแข่งขัน และสถิติของคุณ</p>
        {params.error ? <p className="auth-alert is-error" role="alert">{params.error}</p> : null}
        {params.message ? <p className="auth-alert is-success" role="status">{params.message}</p> : null}
        <form action={signInWithLine} className="line-auth-form">
          <input type="hidden" name="next" value={params.next ?? "/profile"} />
          <button className="line-login-button" type="submit">
            <span aria-hidden="true">LINE</span>
            เข้าสู่ระบบด้วย LINE
          </button>
        </form>
        <p className="auth-privacy-note">MeQ จะใช้ชื่อและรูปโปรไฟล์ LINE เพื่อสร้างบัญชีผู้เล่นของคุณ</p>
        {process.env.NODE_ENV !== "production" ? <details className="auth-development">
          <summary>Development: เข้าสู่ระบบด้วยอีเมล</summary>
          <form className="auth-form">
          <input type="hidden" name="next" value={params.next ?? "/profile"} />
          <label><span>ชื่อที่แสดง <small>ใช้ตอนสร้างบัญชี</small></span><input name="displayName" autoComplete="name" minLength={2} maxLength={80} placeholder="เช่น ปุณณ์" /></label>
          <label><span>อีเมล</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
          <label><span>รหัสผ่าน</span><input name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" /></label>
          <div className="auth-actions">
            <button className="queue-primary-button" formAction={signIn}>เข้าสู่ระบบ</button>
            <button className="queue-secondary-button" formAction={signUp}>สร้างบัญชีใหม่</button>
          </div>
          </form>
        </details> : null}
        <Link className="auth-back" href="/">← กลับ Dashboard</Link>
      </section>
    </main>
  );
}
