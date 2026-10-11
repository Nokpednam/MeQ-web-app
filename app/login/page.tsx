import { redirect } from "next/navigation";
import { signIn, signInWithLine, signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

const features = [
  {
    title: "ดูคิวทุกสนามแบบสด",
    body: "3x3 A, 3x3 B และ 5x5 เห็นลำดับเดียวกันทุกคน ไม่มีใครลัดคิว",
    icon: <path d="M4 6h16M4 12h16M4 18h10"/>,
  },
  {
    title: "ถึงคิวแล้ว LINE เตือน",
    body: "ไปพักหรือซื้อน้ำได้ ระบบส่งข้อความบอกเมื่อถึงคิวทีมคุณ",
    icon: <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>,
  },
  {
    title: "อุปกรณ์พัง แจ้งได้ทันที",
    body: "ถ่ายรูปส่งแอดมิน แล้วติดตามสถานะจนซ่อมเสร็จ",
    icon: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"/>,
  },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(params.next?.startsWith("/") ? params.next : "/");
  const next = params.next ?? "/";

  return (
    <main className="login-page">
      <section className="login-hero">
        <svg className="login-court" viewBox="0 0 600 560" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="3">
            <rect x="20" y="20" width="560" height="520" rx="6"/>
            <rect x="210" y="20" width="180" height="230"/>
            <circle cx="300" cy="250" r="90"/>
            <path d="M80 20v120a220 220 0 0 0 440 0V20"/>
            <path d="M210 540a90 90 0 0 1 180 0"/>
            <circle cx="300" cy="62" r="18"/>
            <path d="M270 44h60"/>
          </g>
        </svg>
        <div className="login-hero-content">
          <div className="login-brand"><span>MeQ</span><small>สนามบาส มหาวิทยาลัยนเรศวร</small></div>
          <h1>ถึงคิวเมื่อไร<br/><em>รู้ทันที</em></h1>
          <p className="login-lead">ต่อคิวสนามบาสผ่านมือถือ ไม่ต้องถามปากต่อปาก ไม่ต้องยืนรอว่าใครคิวต่อ</p>
          <ul className="login-features">
            {features.map((feature) => <li key={feature.title}>
              <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{feature.icon}</svg></span>
              <div><strong>{feature.title}</strong><p>{feature.body}</p></div>
            </li>)}
          </ul>
          <p className="login-courts"><b>3x3 A</b><b>3x3 B</b><b>5x5</b></p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <h2 id="login-title">เข้าสู่ระบบ</h2>
          <p className="login-card-lead">ใช้บัญชี LINE ที่มีอยู่แล้ว ไม่ต้องสมัครใหม่</p>
          {params.error ? <p className="auth-alert is-error" role="alert">{params.error}</p> : null}
          {params.message ? <p className="auth-alert is-success" role="status">{params.message}</p> : null}
          <form action={signInWithLine}>
            <input type="hidden" name="next" value={next} />
            <button className="login-line-button" type="submit">
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.8-3.4 7.9-5.9C21.3 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8Z"/></svg>
              เข้าสู่ระบบด้วย LINE
            </button>
          </form>
          <ol className="login-next-steps">
            <li>กดปุ่มด้านบน แล้วอนุญาตใน LINE</li>
            <li>กดเพิ่มเพื่อน MeQ เพื่อรับแจ้งเตือนเมื่อถึงคิว</li>
            <li>รวมทีมให้ครบ แล้วลงคิวได้เลย</li>
          </ol>
          <p className="login-privacy">MeQ ใช้ชื่อ รูปโปรไฟล์ และ LINE ID สำหรับบัญชีผู้เล่นและการแจ้งเตือนเท่านั้น<br/><a href="/privacy">นโยบายความเป็นส่วนตัว</a> · <a href="/terms">ข้อกำหนดการใช้งาน</a></p>
          {process.env.NODE_ENV !== "production" ? <details className="auth-development">
            <summary>Development: เข้าสู่ระบบด้วยอีเมล</summary>
            <form className="auth-form">
            <input type="hidden" name="next" value={next} />
            <label><span>ชื่อที่แสดง <small>ใช้ตอนสร้างบัญชี</small></span><input name="displayName" autoComplete="name" minLength={2} maxLength={80} placeholder="เช่น ปุณณ์" /></label>
            <label><span>อีเมล</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
            <label><span>รหัสผ่าน</span><input name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" /></label>
            <div className="auth-actions">
              <button className="queue-primary-button" formAction={signIn}>เข้าสู่ระบบ</button>
              <button className="queue-secondary-button" formAction={signUp}>สร้างบัญชีใหม่</button>
            </div>
            </form>
          </details> : null}
        </div>
      </section>
    </main>
  );
}
