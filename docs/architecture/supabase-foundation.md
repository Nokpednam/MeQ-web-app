# Supabase foundation for MeQ

## ขอบเขตรอบนี้

Migration ใน `supabase/migrations` เป็น schema เป้าหมายสำหรับย้ายจาก mock data และ
`localStorage` ไป PostgreSQL/Supabase ภายหลัง รอบนี้ยังไม่ติดตั้ง Supabase client,
ยังไม่เชื่อม project จริง และไม่เปลี่ยนการทำงานของ UI ปัจจุบัน

## Source of truth

- `profiles` อ้างถึง `auth.users` และเก็บ role เป็น `USER` หรือ `ADMIN`
- `team_memberships` เป็นแหล่งจริงของสมาชิกทีม โดย partial unique index บังคับหนึ่งทีมต่อผู้ใช้
- `queue_entries` เก็บสถานะคิว และ `active_queue_players` บังคับไม่ให้ผู้เล่นอยู่หลายคิว
- `games` เป็นแหล่งจริงของเกม active/completed; `courts.active_game_id` ชี้เกมปัจจุบันเท่านั้น
- `score_submissions` unique ด้วย `(game_id, team_id)` และ `player_scores` อ้าง roster snapshot
- `player_game_history` unique ด้วย `(game_id, user_id)` และ view `player_statistics` คำนวณแยก 3x3/5x5
- `maintenance_reports.image_path` เก็บ path ของ Supabase Storage ไม่เก็บรูปเป็น base64 ในฐานข้อมูล

## Security boundary

ตาราง lifecycle เปิด RLS และไม่มี policy สำหรับ client write โดยตรง การเข้าคิว ออกจากคิว
และส่งคะแนนต้องเรียก RPC ที่ตรวจ `auth.uid()` ภายใน transaction เท่านั้น RPC แบบ
`security definer` ใช้ `search_path = ''`, อ้างชื่อ schema เต็ม และจำกัดสิทธิ์ execute

ตำแหน่งต้องมาจาก verification ที่ยังไม่หมดอายุใน `location_verifications` ซึ่งควรถูกเขียนโดย
Edge Function หรือ trusted server เท่านั้น ไม่รับ boolean ว่า “อยู่ในระยะ” จาก browser

Role `ADMIN` ห้ามแก้ผ่าน profile update ปกติ ผู้ใช้แก้ได้เฉพาะ `display_name` และ `avatar_url`;
การตั้งผู้ดูแลต้องทำผ่าน trusted server/SQL operation ที่บันทึก audit log

## Business date and time

สนามเปิด 05:00–00:00 ตาม `Asia/Bangkok` และวันธุรกิจเริ่ม 05:00 น. ค่า target score
เก็บต่อ `court_group_id + business_date` ทำให้ 3x3 A/B อ่านค่าจาก group `3x3` เดียวกัน
แต่มี `queue_entries.court_id` คนละค่า จึงยังเป็นคิวแยก

## Migration path from localStorage

1. สร้าง Supabase project สำหรับ Development และรัน migration/seed
2. เปิด Auth provider พื้นฐานก่อน จากนั้นค่อยเพิ่ม LINE OAuth adapter
3. เพิ่ม server-side Supabase client ใน Next.js โดยใช้ publishable/anon key กับ session cookie
4. สร้าง async repository adapters ให้ตรง domain types ปัจจุบัน; UI ห้ามเรียก localStorage โดยตรง
5. ย้าย Team repository แล้วทดสอบ constraint หนึ่งทีมต่อผู้ใช้
6. ย้าย Queue/Check-in ผ่าน RPC และทดสอบ concurrent requests
7. ย้าย Game/Score/Statistics และทดสอบ finalize ซ้ำ
8. ย้าย Calendar/Maintenance และ Storage bucket สำหรับภาพ
9. ปิด development seed และ simulator ใน Production

ระหว่างย้ายให้เลือก repository implementation ด้วย environment/config ที่ฝั่ง server
ห้าม merge ข้อมูล localStorage กับข้อมูล production แบบอัตโนมัติ

## Required environment variables (later phase)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` หรือ publishable key ตาม project configuration
- `SUPABASE_SERVICE_ROLE_KEY` เฉพาะ trusted server/Edge Function และห้ามมี prefix `NEXT_PUBLIC_`
- LINE channel credentials เฉพาะ server เมื่อเริ่มทำ LINE Login

## Transactional invariants to test against a real local Supabase instance

- คำขอเข้าคิวพร้อมกันของทีม/ผู้เล่นเดียวกัน สำเร็จได้ครั้งเดียว
- position ต่อท้ายไม่ชนกันเมื่อหลายทีมเข้าพร้อมกัน
- ทีมสมาชิกไม่ครบหรือผิดประเภทสนามเข้าคิวไม่ได้
- ผู้เล่นที่ไม่มี location verification ภายใน 50 เมตรเข้าคิวไม่ได้
- ส่งคะแนนทีมละหนึ่ง submission และคะแนน 0 เป็นค่าที่ถูกต้อง
- finalize game id เดิมซ้ำไม่เพิ่ม history หรือสถิติซ้ำ
- เกม completed ถูกล้างจาก `courts.active_game_id`
- ผู้ชนะครั้งแรกเข้าสู่ `DECIDING_CONTINUE`; ครบสองครั้งเข้าสู่ `RESTING`
- ทีมแพ้เข้าสู่ `DECIDING_REQUEUE` พร้อม deadline 3 นาที

