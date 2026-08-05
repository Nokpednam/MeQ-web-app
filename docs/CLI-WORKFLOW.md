# การทำงานกับ MeQ ผ่าน VS Code และ Codex CLI

## แนวคิด
- VS Code ใช้เปิดและแก้ไฟล์
- Terminal ใน VS Code ใช้รันคำสั่ง
- Codex CLI ทำงานภายในโฟลเดอร์โปรเจกต์ อ่านไฟล์ แก้โค้ด และรันคำสั่งทดสอบได้
- `AGENTS.md` และเอกสารใน `docs/` ทำหน้าที่ส่งต่อ Requirement ให้ AI ในแต่ละ session

> Codex CLI เป็น session แยกจากแชตนี้ จึงไม่ได้รู้บทสนทนาทั้งหมดโดยอัตโนมัติ แต่โปรเจกต์นี้เก็บกฎสำคัญไว้ในไฟล์แล้ว

## ติดตั้งบน Windows / macOS / Linux ผ่าน npm
ต้องติดตั้ง Node.js ก่อน จากนั้นเปิด Terminal:

```bash
npm i -g @openai/codex
```

ตรวจสอบ:

```bash
codex --version
```

## เปิด MeQ และเริ่ม Codex

```bash
cd path/to/meq-starter-v0.1
codex
```

ครั้งแรกให้เลือก Sign in with ChatGPT แล้วกำหนด permission ตามที่ต้องการ

## Prompt แรกที่ควรใช้

```text
อ่าน AGENTS.md, docs/requirements/queue-rules.md และ docs/diagrams ทั้งหมดก่อน ห้ามแก้ไฟล์ จากนั้นสรุปความเข้าใจเกี่ยวกับ MeQ และบอกสิ่งที่ยังเป็น mock data
```

เมื่อสรุปถูกต้องแล้ว จึงสั่งงานทีละ feature:

```text
สร้างหน้า /teams สำหรับสร้างทีม 3x3 หรือ 5x5 ตามกฎใน AGENTS.md ใช้ mock data ก่อน อย่าเพิ่ม dependency โดยไม่จำเป็น และหลังแก้ให้รัน npm run typecheck, npm run lint และ npm run build
```

## วงรอบการทำงานที่แนะนำ

```text
1. สร้าง Git checkpoint
2. ให้ Codex อ่าน requirement
3. สั่งงานเพียงหนึ่ง feature
4. ตรวจ diff
5. รันเว็บและทดลองกด
6. รัน typecheck, lint, build
7. ถ้าโอเคจึง commit
```

คำสั่ง Git:

```bash
git status
git diff
git add .
git commit -m "feat: add team creation flow"
```

## ให้ Codex ตรวจงานก่อน commit
ใน Codex CLI ใช้:

```text
/review
```

หรือพิมพ์:

```text
ตรวจ uncommitted changes โดยเน้น business rules ของคิว การตรวจสิทธิ์ และความเสี่ยงจากผู้ใช้กดพร้อมกัน ห้ามแก้ไฟล์จนกว่าจะรายงานเสร็จ
```

## การทำงานร่วมกับแชตนี้
เมื่อเกิด Error ให้ส่งข้อมูลต่อไปนี้กลับมา:
- คำสั่งที่รัน
- Error ทั้งก้อนตั้งแต่บรรทัดแรกถึงสุดท้าย
- ไฟล์ที่แก้ล่าสุด หรือ ZIP ของ repository
- ภาพหน้าจอถ้าเป็นปัญหา UI

เมื่อมีการเปลี่ยน Requirement ให้แก้ `AGENTS.md` และ `docs/requirements/queue-rules.md` ก่อน เพื่อไม่ให้ CLI ใช้กฎเก่า
