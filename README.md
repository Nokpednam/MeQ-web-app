# MeQ Starter v0.1

เว็บแอป MeQ สำหรับจัดการทีม คิวสนามบาส เช็กอิน เกม คะแนน สถิติ ปฏิทิน และงานแจ้งซ่อมของมหาวิทยาลัยนเรศวร

## ระบบปัจจุบัน
- Next.js App Router + TypeScript
- Supabase Auth, PostgreSQL, RLS และ transactional RPC
- LINE Login พร้อมข้อมูลโปรไฟล์ผู้เล่น
- สนาม 3x3 A, 3x3 B และ 5x5 ซึ่งมีคิวแยกกัน
- GPS verification, team check-in และ timeout ที่ประมวลผลฝั่งฐานข้อมูล
- เกม คะแนนรายบุคคล สถิติ ปฏิทิน และแจ้งซ่อม
- Admin ปรับสถานะสนาม คะแนนเป้าหมาย เวลาเช็กอิน และกิจกรรมได้
- Queue Flow, State Diagram, Architecture และ ER Diagram ใน `docs/diagrams`
- CI ตรวจ typecheck, lint, production build, unit tests และ database tests

## เปิดใน VS Code
1. แตกไฟล์ ZIP
2. เปิด VS Code
3. เลือก **File > Open Folder** แล้วเลือกโฟลเดอร์ `meq-starter-v0.1`
4. เปิด Terminal ใน VS Code ด้วย **Terminal > New Terminal**
5. รัน:

```bash
npm install
npm run dev
```

6. เปิด `http://localhost:3000`

## ตรวจโค้ดก่อนส่งขึ้น GitHub

```bash
npm run typecheck
npm run lint
npm run build
```

## ใช้ Codex CLI ในโฟลเดอร์นี้
ติดตั้ง Codex CLI แล้วเปิด Terminal ที่ root ของโปรเจกต์:

```bash
npm i -g @openai/codex
codex
```

Codex จะอ่าน `AGENTS.md` เพื่อทราบ Requirement หลักของ MeQ โดยอัตโนมัติ ตัวอย่างคำสั่ง:

```text
ตรวจหน้า Dashboard ปัจจุบัน แล้วเพิ่มหน้า /teams สำหรับสร้างทีม 3x3 หรือ 5x5 โดยห้ามสมาชิกเกินจำนวนตาม AGENTS.md จากนั้นรัน typecheck, lint และ build
```

อ่านขั้นตอนละเอียดเพิ่มเติมที่ `docs/CLI-WORKFLOW.md`

## Git เริ่มต้น

```bash
git init
git add .
git commit -m "chore: initialize MeQ starter"
```

หลังสร้าง Repository เปล่าบน GitHub:

```bash
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

## Supabase

โครงสร้าง PostgreSQL, RLS, transactional RPC, migrations และ database tests อยู่ใน `supabase/`
Production UI อ่านและแก้ข้อมูลผ่าน Supabase โดยไม่ใช้ repository จำลองหรือ `localStorage`
ยกเว้นการจดจำภาษาที่ผู้ใช้เลือก ดูรายละเอียดที่ `docs/architecture/supabase-foundation.md`

เมื่อต้องการทดสอบกับ Supabase local stack ต้องติดตั้ง Docker Desktop แล้วรัน:

```bash
npx supabase init
npx supabase start
```

จากนั้นใช้ migration และ tests ในโฟลเดอร์ `supabase/`:

```bash
npx supabase db reset --local --no-seed
npm run test:db
```

## Vercel CLI (เมื่อพร้อม Deploy)

```bash
npm i -g vercel
vercel login
vercel
```

## เปลี่ยนรูปสนาม
แทนที่ไฟล์ต่อไปนี้โดยคงชื่อไฟล์เดิม หรือแก้ path ใน `lib/mock-data.ts`:
- `public/courts/3x3-a.svg`
- `public/courts/3x3-b.svg`
- `public/courts/5x5.svg`
