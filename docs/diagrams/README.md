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

- `er-diagram.mmd` — schema เป้าหมายของ PostgreSQL/Supabase
- `database-auth-flow.mmd` — ขอบเขต Auth, RLS และ transactional RPC
- `queue-flow.mmd` / `queue-checkin-flow.mmd` — วงจรคิวและเช็กอิน
- `game-result-flow.mmd` — การส่งคะแนนและ finalize เกม
