# MeQ Starter v0.1

โค้ดเริ่มต้นของ MeQ สำหรับตรวจแนวทางหน้าตา โครงสร้างโปรเจกต์ และกฎระบบ ก่อนเชื่อมฐานข้อมูลจริง

## สิ่งที่มีในรอบนี้
- Next.js App Router + TypeScript
- Dashboard responsive สำหรับมือถือและคอมพิวเตอร์
- สนาม 3x3 A, 3x3 B และ 5x5 พร้อมภาพ placeholder ที่เปลี่ยนเป็นรูปจริงได้
- Mock queue, เกมที่กำลังเล่น, คะแนนประจำวัน, ปฏิทิน และแจ้งซ่อม
- กฎธุรกิจใน `lib/meq-domain.ts`
- Queue Flow, State Diagram, Architecture และ ER Diagram ใน `docs/diagrams`
- `AGENTS.md` สำหรับให้ Codex CLI เข้าใจกฎ MeQ ทุกครั้ง

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

## Supabase foundation

โครงสร้าง PostgreSQL, RLS, transactional RPC และ seed เริ่มต้นอยู่ใน `supabase/`
โดยยังไม่เชื่อม project จริงหรือเปลี่ยน UI จาก localStorage ดูแผนการย้ายระบบได้ที่
`docs/architecture/supabase-foundation.md`

เมื่อต้องการทดสอบกับ Supabase local stack ต้องติดตั้ง Docker Desktop แล้วรัน:

```bash
npx supabase init
npx supabase start
```

จากนั้นใช้ migration และ seed ในโฟลเดอร์ `supabase/` กับ local project ก่อนเชื่อม Development project

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
