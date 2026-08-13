# Maintenance status flow

```mermaid
flowchart LR
    U["ผู้ใช้ส่งรายการแจ้งซ่อม"] --> R["maintenance_reports"]
    U --> S["Private Supabase Storage"]
    R --> A["Admin maintenance feed"]
    S --> A
    A -->|"อัปเดต NEW / IN_PROGRESS / RESOLVED"| R
    R --> P["Public status RPC"]
    P -->|"ไม่ส่งชื่อผู้แจ้งหรือรูปหลักฐาน"| M["หน้าแจ้งซ่อม: สถานะสาธารณะ"]
    P -->|"เฉพาะงานที่ยังไม่ RESOLVED"| C["หน้าสนามที่ได้รับผลกระทบ"]
    R --> O["รายการที่ฉันแจ้ง"]
```

The public feed intentionally excludes reporter identity and private image paths. Resolved work remains visible on the maintenance page for seven days, but does not appear as an active court warning.
