# MeQ: Content for the Presentation Slides (Canva)

- **Time limit:** 15 minutes. The plan uses about 13.5 minutes, which leaves time for transitions and questions.
- **Slide text:** short English, matching the thesis.
- **Speaker notes:** Thai.
- **Pictures:** paths are relative to `docs/report/`.
- **Waiting for data:** items marked ⏳ wait for the SUS results or for screenshots from the field test of 17 Oct.

| # | Section | Slide | Time |
|---|---|---|---|
| 1 | — | Title | 0:20 |
| 2 | WHY | The problem at the courts | 1:00 |
| 3 | WHY | Research question and objectives | 1:00 |
| 4 | WHAT | MeQ in one picture | 1:00 |
| 5 | WHAT | Court rules enforced by the system | 1:00 |
| 6 | WHAT | Maintenance reports | 0:40 |
| 7 | HOW | Architecture | 1:10 |
| 8 | HOW | The database is the referee | 1:10 |
| 9 | HOW | Development and testing process | 0:50 |
| 10 | DEMO | Video or screenshots of one round | 1:30 |
| 11 | RESULTS | KPI results | 1:30 |
| 12 | RESULTS | What the field tests found | 1:00 |
| 13 | IMPACT | Impact, limitations, future work | 1:00 |
| 14 | — | Thank you / Q&A | 0:10 |

---

## Slide 1: Title
**On the slide**
- MeQ: A Mobile Web Application for Basketball Court Queues and Maintenance Reports at Naresuan University
- Name, student ID, advisor
- Department of Computer Science, Faculty of Science, Naresuan University · 2026

**Picture:** MeQ logo or `screenshots/home.png` placed inside a phone frame.

**Speaker notes:** สวัสดีครับ ผม ... วันนี้จะนำเสนอโปรเจกต์ MeQ ระบบคิวสนามบาสและแจ้งซ่อมของมหาวิทยาลัยนเรศวร

---

## Slide 2: WHY: The problem at the courts
**On the slide**
- 3 courts (3x3 A, 3x3 B, 5x5), free walk-in play, crowded every evening
- The queue lives only in players' memory → "who is last?"
- No one can see the order, and no one can enforce it → disputes
- Broken hoops and lights go unreported
- The NU sports booking system handles reservations, not walk-in queues

**Picture:** a photo of the crowded court in the evening, or `images/nu-booking.png` (Figure 1.1 in the thesis).

**Speaker notes:** ตอนเย็นทีมที่มารอมีมากกว่าจำนวนสนาม คิวมีอยู่แค่ในความจำของผู้เล่น ทีมที่มาใหม่ต้องถามว่าใครต่อคิวท้ายสุด ทุกคนมองไม่เห็นลำดับ และไม่มีอะไรบังคับให้เป็นไปตามลำดับ เลยทะเลาะกันบ่อย งานวิจัยเรื่องคิวบอกว่าความยุติธรรมที่ผู้คนมองเห็นสำคัญพอ ๆ กับเวลาที่ต้องรอ อีกปัญหาหนึ่งคืออุปกรณ์เสียแล้วไม่มีช่องทางแจ้ง ระบบจองของมหาวิทยาลัยมีอยู่แล้ว แต่ใช้สำหรับจองล่วงหน้า ไม่ได้รองรับคนที่เดินมาเล่น

---

## Slide 3: WHY: Research question and objectives
**On the slide**
> Can a queue whose rules are enforced by the database, together with push notifications, replace word-of-mouth queuing?

Objectives:
1. Show every court's queue and enforce the court rules
2. Verify that teams are at the court (GPS checked on the server)
3. Maintenance reports with photos, tracked to resolution
4. LINE notifications + evaluation against 7 KPIs fixed in advance

**Speaker notes:** คำถามหลักคือ คิวที่ฐานข้อมูลเป็นคนบังคับกติกา บวกกับการแจ้งเตือนผ่าน LINE จะใช้แทนการต่อคิวแบบปากต่อปากได้ไหม ผมแบ่งเป็นวัตถุประสงค์ 4 ข้อ และตั้งเกณฑ์วัดผล 7 ตัวไว้ก่อนเริ่มวัดผล

---

## Slide 4: WHAT: MeQ in one picture
**On the slide** (pictures with short labels)
- Sign in with LINE → create a team → invite friends
- Join a court queue → get called → check in at the court
- Play → both teams submit scores → statistics
- Report damaged equipment with a photo
- Admin: open or close courts, events, target score, reports

**Pictures:** 4–5 screenshots arranged in a row: `screenshots/login.png`, `screenshots/team.png`, `screenshots/court-queue.png`, `screenshots/check-in.png`, `screenshots/result.png`

**Speaker notes:** MeQ เป็นเว็บแอปที่เปิดบนมือถือ ไม่ต้องติดตั้ง ผู้ใช้ล็อกอินด้วย LINE สร้างทีม เชิญเพื่อน แล้วเข้าคิวสนามที่ต้องการ เมื่อถึงคิว ระบบเรียกทีมและแจ้งเตือนผ่าน LINE ทุกคนในทีมต้องเช็กอินที่สนาม พอเล่นจบ ทั้งสองทีมส่งคะแนน ระบบตรวจว่าคะแนนตรงกันแล้วบันทึกลงสถิติ

---

## Slide 5: WHAT: Court rules enforced by the system
**On the slide**
- Full roster only (3x3 = 3 players, 5x5 = 5 players)
- One team per player, one queue per team
- Check-in deadline when called; losers have 3 min to requeue
- Winners stay for at most 2 games, rest 1 game, then return
- Both teams must agree on the score

**Picture:** `images/game-states.png` or `images/queue-entry-states.png`, or a simple drawing of the winner rotation

**Speaker notes:** กติกาเหล่านี้เป็นกติกาที่ผู้เล่นใช้กันอยู่แล้วที่สนาม ผมแค่เอามาให้ระบบบังคับใช้แทนคน ที่ผู้เล่นสนใจที่สุดคือข้อทีมชนะอยู่ต่อได้ 2 เกมแล้วต้องพัก เพื่อไม่ให้ทีมเก่งทีมเดียวครองสนามทั้งคืน

---

## Slide 6: WHAT: Maintenance reports
**On the slide**
- Report with a photo → admin is notified on LINE
- Status: New → Accepted → Waiting for caretaker → Resolved (or Rejected)
- The reporter is notified of every change, and every change is recorded
- A second report of an open problem is refused

**Pictures:** `screenshots/maintenance-form.png` + `screenshots/admin-maintenance.png` (+ `images/maintenance-flow.png`)

**Speaker notes:** ผู้เล่นถ่ายรูปจุดที่เสียแล้วส่งรายงาน แอดมินได้รับแจ้งเตือนผ่าน LINE ทันที ทุกครั้งที่สถานะเปลี่ยน ผู้แจ้งได้รับแจ้งเตือน และระบบเก็บประวัติไว้ทุกขั้น

---

## Slide 7: HOW: Architecture
**On the slide**
- Next.js 16 (React, TypeScript) on Vercel
- Supabase: PostgreSQL, Auth (LINE Login), private Storage
- LINE Messaging API for notifications
- pg_cron advances the queues every 30 s

**Picture:** `images/system-architecture.png`

**Speaker notes:** หน้าเว็บทำด้วย Next.js และ deploy บน Vercel ฝั่งหลังบ้านใช้ Supabase ซึ่งมีฐานข้อมูล PostgreSQL ระบบล็อกอิน และที่เก็บรูป การแจ้งเตือนส่งผ่าน LINE Messaging API ทั้งหมดใช้บริการแบบฟรี

---

## Slide 8: HOW: The database is the referee
**On the slide**
- The browser only asks; the database decides
- Every change goes through one transaction-safe function that checks the user and the rules
- Row-level security: users cannot write to queue or score tables directly
- GPS: the phone sends its coordinates, and the server computes the distance
- Notifications are saved with the change (outbox) → never lost, never sent twice

**Picture:** `images/line-notification-flow.png` or `../diagrams/rendered/queue-checkin-flow.png`

**Speaker notes:** นี่คือหัวใจของงาน ถ้าให้หน้าเว็บเป็นคนตัดสินกติกา คนที่รู้วิธีก็โกงได้ หรือถ้าสองทีมกดเข้าคิวพร้อมกันก็อาจได้คิวซ้อนกัน ผมจึงให้ฐานข้อมูลเป็นกรรมการ ทุกการเปลี่ยนแปลงต้องผ่านฟังก์ชันที่ตรวจสิทธิ์และกติกาภายใน transaction ตำแหน่ง GPS ก็คำนวณระยะทางที่เซิร์ฟเวอร์ ไม่เชื่อค่าที่หน้าเว็บส่งมาว่าอยู่ในระยะ

---

## Slide 9: HOW: Development and testing process
**On the slide**
- Design science research: build → evaluate → improve
- 39 database migrations, versioned
- 147 automated tests (115 database + 32 unit), run on every change (CI)
- 3 field sessions with real players on their own phones (12, 16, 17 Oct) → defects fixed and covered by new tests

**Speaker notes:** ผมพัฒนาแบบสร้าง ทดสอบ แล้วปรับปรุง ทุกครั้งที่แก้โค้ด GitHub จะรันเทสอัตโนมัติ 147 ข้อ ถ้าข้อไหนไม่ผ่านจะ merge ไม่ได้ และบั๊กที่เจอจากการทดสอบที่สนามจริง แก้แล้วจะเขียนเทสเพิ่มเพื่อไม่ให้บั๊กนั้นกลับมาอีก

---

## Slide 10: DEMO
**On the slide:** a video of about 60–90 seconds, or a sequence of screenshots

Suggested order: join queue → called + LINE message → check in → submit scores → result → statistics

**Pictures:** `screenshots/court-queue.png` → `screenshots/line-chat.png` → `screenshots/check-in.png` → ⏳ `screenshots/scores.png` → `screenshots/result.png`

**Speaker notes:** (พูดตามภาพ) ⏳ แนะนำให้อัดวิดีโอหน้าจอระหว่างเทสที่สนามวันที่ 17 ต.ค. แล้วตัดให้เหลือไม่เกิน 90 วินาที

---

## Slide 10b: RESULTS: Field evaluation, 17 Oct
**On the slide:** photos `slides/photos/field-game.jpg` (large), `field-author.jpg`, `covered-court-renovation.jpg`
- Moved to the Faculty of Science court, played as 3x3
- 13 players; four teams played, 17:20–18:30
- Queue, check-in, play, scores, and a maintenance report
- Check-in failed at first: the court point was moved on site
- SUS questionnaire answered the same evening

**Speaker notes:** วันที่ 17 ต.ค. ผมพาผู้เล่น 13 คน 4 ทีม มาใช้ระบบจริงที่สนาม สนามในร่มที่ตั้งใจจะใช้กำลังซ่อมไฟ ไม่มีไฟ จึงย้ายไปสนามคณะวิทยาศาสตร์ เล่นแบบ 3x3 ตอนแรกเช็กอินไม่ผ่านเพราะพิกัดยังชี้ไปที่สนามในร่ม เลยตั้งพิกัดใหม่ที่สนาม (40 วินาที)

---

## Slide 11: RESULTS: KPI results
**On the slide** (table or 7 cards)

| KPI | Criterion | Result |
|---|---|---|
| 1 Queue integrity | 0 violations, 50 users | 0 in 6 runs ✅ |
| 2 Rule tests | All pass | 115/115 + 32/32 ✅ |
| 3 LINE timeliness | ≥ 95% within 60 s | 96.7% (29/30), median 1.7 s ✅ |
| 4 Maintenance | Every step as specified | 7/7 steps, 10/10 notifications ✅ |
| 5 Responsiveness | p95 < 2 s, < 1% failed | p95 < 0.1 s locally, < 0.6 s deployed ✅ |
| 6 Usability (SUS) | Mean ≥ 68 | 67.5, n = 13 (95% CI 59.4–75.6) ✗ not met (borderline) |
| 7 Security | No High finding | 0 High, 40/40 privilege tests ✅ |

**Speaker notes:** ทุกเกณฑ์ตั้งไว้ก่อนวัดผล ผลออกมาผ่าน 6 จาก 7 ตัว SUS ได้ 67.5 ต่ำกว่าเกณฑ์ 68 อยู่ 0.5 คะแนน จุดที่ต้องปรับคือการใช้ครั้งแรก โดยเฉพาะ KPI-1 ที่จำลองผู้ใช้ 50 คนกดเข้าออกคิวพร้อมกัน ไม่มีครั้งไหนที่คิวผิดกติกาเลย และมีการกดเข้าคิวซ้ำพร้อมกัน 533 ครั้ง ระบบไม่ยอมรับแม้แต่ครั้งเดียว

---

## Slide 12: RESULTS: What the field tests found
**On the slide**
- 12 defects found during the field tests, development, and review; all were fixed
- Example 1: the queue stopped advancing after a team requeued
- Example 2 (16 Oct): the challenger disappeared when the winner left → fixed, new test added
- Example 3: player statistics showed 0 because of a permission grant → fixed and verified on production
- Lesson: the automated tests passed, but real users found the edge cases

**Speaker notes:** สิ่งที่ได้เรียนรู้มากที่สุดคือ เทสอัตโนมัติผ่านหมดก็ยังไม่พอ ต้องให้คนจริงใช้จริง บั๊กที่ร้ายแรงที่สุดเจอจากการทดสอบที่สนาม พอเจอแล้วผมแก้และเพิ่มเทสทุกครั้ง

---

## Slide 13: IMPACT and FUTURE
**On the slide**

Impact
- A visible, fair queue → fewer arguments, no need to stand and wait at the court
- Damage reaches the staff sooner, and players can follow the repair
- Free infrastructure, so other facilities can reuse it

Limitations
- A faked GPS location cannot be detected
- Scores are entered by the teams themselves
- One facility, small sample

Future work
- Futsal and volleyball courts
- QR code check-in at the court
- Measure disputes before and after deployment

**Speaker notes:** ข้อจำกัดที่ตอบตรง ๆ ได้คือ ถ้ามีคนปลอม GPS ระบบตรวจไม่ได้ และคะแนนเป็นค่าที่ผู้เล่นกรอกเอง ระบบตรวจได้แค่ว่าสองทีมกรอกตรงกัน งานต่อยอดคือขยายไปสนามกีฬาอื่น และใช้ QR code ที่สนามเพื่อยืนยันว่ามาจริง

---

## Slide 14: Thank you / Q&A
- Link or QR code to the website
- "Thank you"

---

## Questions the committee may ask (prepare answers)
| Question | Short answer |
|---|---|
| Why not just use a LINE group or Google Sheet? | Anyone can edit those, so nothing enforces the order, and two teams can take the same turn at once. MeQ lets the database enforce the rules. |
| What if someone fakes their GPS? | It cannot be detected; this is a stated limitation. The next step is a QR code at the court. |
| What if the teams enter wrong scores? | The system checks only that both teams agree. If they disagree, they must resubmit, or an admin resolves the game. |
| Why does a load test with 50 users count as enough? | It matches the expected evening load at 3 courts. The criteria were fixed before measuring. |
| How was AI used? | As a coding assistant. Automated tests, field tests, and criteria fixed in advance reduce the bias; this is stated in the limitations. |
| What does PDPA require here? | Table 3.7: minimal data collection, a privacy page, no stored coordinates. Remaining gaps: no self-service deletion and no written breach procedure. |
