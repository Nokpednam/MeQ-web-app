# MeQ Diagrams

ไฟล์ `.mmd` เปิดดูได้โดย:
- Mermaid Live Editor
- VS Code extension ที่รองรับ Mermaid
- GitHub Markdown เมื่อฝังใน code block แบบ `mermaid`

Render เป็น SVG จาก root โปรเจกต์:

```bash
./scripts/render-diagrams.sh
```

แผนภาพหลัก:

- `system-architecture.mmd` — ส่วนประกอบที่ใช้งานอยู่ในระบบปัจจุบัน รวม LINE Messaging (outbox + dispatcher) และการรีเฟรชหน้าคิวอัตโนมัติ; ไม่ใช้ Supabase Realtime
- `line-notification-flow.mmd` — ลำดับการส่งแจ้งเตือน LINE ตั้งแต่ trigger จนส่งถึงผู้รับ
- `er-diagram.mmd` — schema ของ PostgreSQL/Supabase
- `database-auth-flow.mmd` — ขอบเขต Auth, RLS และ transactional RPC
- `queue-flow.mmd` / `queue-checkin-flow.mmd` — วงจรคิวและเช็กอิน
- `game-result-flow.mmd` — การส่งคะแนนและ finalize เกม
- `maintenance-status-flow.md` — การรับรายงานซ่อม สถานะ (รวม REJECTED) ประวัติการดำเนินการ และการกันรายงานซ้ำ

ไฟล์ใน `rendered/` เป็น snapshot ที่สร้างจาก source diagram ควร render ใหม่เมื่อแก้ `.mmd` หรือ `.dot`
