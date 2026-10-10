# Maintenance status flow

```mermaid
flowchart LR
    U["ผู้ใช้ส่งรายการแจ้งซ่อม"] --> T["create_maintenance_report RPC"]
    T --> R["maintenance_reports: NEW"]
    T --> D["maintenance_active_issues<br/>หนึ่งสนาม + หนึ่งประเภทปัญหา"]
    U --> S["Private Supabase Storage"]
    R --> A["Admin maintenance feed"]
    S --> A
    A -->|"รับเรื่อง"| I["IN_PROGRESS"]
    I -->|"ส่งต่อผู้ดูแลสนาม"| W["WAITING_FOR_CARETAKER"]
    I -->|"แก้ไขเสร็จ"| X["RESOLVED"]
    W -->|"แก้ไขเสร็จ"| X
    X -->|"ปลดล็อกรายงานประเภทเดิม"| D
    I --> P["Public status RPC"]
    W --> P
    P -->|"ไม่ส่งชื่อผู้แจ้งหรือรูปหลักฐาน"| M["หน้าแจ้งซ่อม: สถานะสาธารณะ"]
    P --> C["หน้าสนามที่ได้รับผลกระทบ"]
    R --> O["รายการที่ฉันแจ้ง"]
    A -->|"ลบถาวร"| DEL["admin_delete_maintenance_report RPC"]
    DEL -->|"ปลดล็อกรายงานประเภทเดิม"| D
    DEL -->|"คืน image_path ให้ server ลบรูป"| S
```

`NEW` is visible only to the reporter and administrators. The public feed starts after an administrator accepts the report and intentionally excludes reporter identity and private image paths. The active-issue registry prevents concurrent duplicate reports for the same court and category until all matching reports are resolved or deleted.

Administrators can hard-delete a report. The RPC returns the stored image path, and the server action removes that object from Storage, so the browser never chooses which file is deleted.
