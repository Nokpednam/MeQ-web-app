# Build the presentation deck with PowerPoint (COM), for import into Canva.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File build_deck.ps1 [-RenderDir <dir>]
# Text comes from slide-content.md; numbers come from Chapter 4 of the thesis.
param([string]$RenderDir = "")
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$report = Split-Path -Parent $here
$out = Join-Path $here "MeQ_Presentation.pptx"

function C([string]$hex) {
  $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
  return $r + 256 * $g + 65536 * $b
}
$DARK = C "1E2430"; $ORANGE = C "E8682C"; $INK = C "1E2430"; $MUTED = C "5B6270"
$CARD = C "F3F4F6"; $TINT = C "FDEEE5"; $WHITE = C "FFFFFF"; $LINE = C "D0D4DC"; $SOFT = C "C9CED8"
$FONT = "Arial"

function T($s, [string]$text, $x, $y, $w, $h, $size, $color, [bool]$bold = $false, [int]$align = 1) {
  $sh = $s.Shapes.AddTextbox(1, $x, $y, $w, $h)
  $tf = $sh.TextFrame
  $tf.WordWrap = -1; $tf.AutoSize = 0
  $tf.MarginLeft = 0; $tf.MarginRight = 0; $tf.MarginTop = 0; $tf.MarginBottom = 0
  $tr = $tf.TextRange
  $tr.Text = $text
  $tr.Font.Name = $FONT; $tr.Font.Size = [single]$size; $tr.Font.Color.RGB = [int]($color)
  $tr.Font.Bold = $(if ($bold) { -1 } else { 0 })
  $tr.ParagraphFormat.Alignment = $align
  return $sh
}
function Bullets($s, [string[]]$lines, $x, $y, $w, $h, $size, $color) {
  $sh = T $s ($lines -join "`r") $x $y $w $h $size $color
  $tr = $sh.TextFrame.TextRange
  $tr.ParagraphFormat.Bullet.Visible = -1
  $tr.ParagraphFormat.Bullet.Character = 8226
  $tr.ParagraphFormat.Bullet.Font.Color.RGB = [int]($ORANGE)
  $tr.ParagraphFormat.SpaceAfter = [math]::Round($size * 0.6)
  $sh.TextFrame.Ruler.Levels(1).FirstMargin = 0
  $sh.TextFrame.Ruler.Levels(1).LeftMargin = [math]::Round($size * 1.1)
  return $sh
}
function Box($s, $x, $y, $w, $h, $color) {
  $sh = $s.Shapes.AddShape(5, $x, $y, $w, $h)
  $sh.Fill.ForeColor.RGB = [int]($color); $sh.Line.Visible = 0
  $sh.Adjustments.Item(1) = [math]::Min(0.12, 14 / [math]::Min($w, $h))
  $sh.Shadow.Visible = 0
  return $sh
}
function Circle($s, $x, $y, $d, [string]$label) {
  $sh = $s.Shapes.AddShape(9, $x, $y, $d, $d)
  $sh.Fill.ForeColor.RGB = [int]($ORANGE); $sh.Line.Visible = 0; $sh.Shadow.Visible = 0
  $tr = $sh.TextFrame.TextRange
  $tr.Text = $label; $tr.Font.Name = $FONT; $tr.Font.Size = [math]::Round($d * 0.45); $tr.Font.Bold = -1
  $tr.Font.Color.RGB = [int]($WHITE); $tr.ParagraphFormat.Alignment = 2
  $sh.TextFrame.MarginLeft = 0; $sh.TextFrame.MarginRight = 0
  return $sh
}
function Pic($s, [string]$rel, $x, $y, $w, $h, [bool]$frame = $true) {
  $p = $s.Shapes.AddPicture((Join-Path $report $rel), 0, -1, $x, $y, $w, $h)
  if ($frame) { $p.Line.Visible = -1; $p.Line.ForeColor.RGB = [int]($LINE); $p.Line.Weight = 1 }
  return $p
}
# Phone screenshots are 900 x 2000.
function Phone($s, [string]$name, $x, $y, $h) { return Pic $s ("screenshots\" + $name + ".png") $x $y ([math]::Round($h * 0.45, 1)) $h }
function NewSlide($pres, [bool]$dark = $false) {
  $s = $pres.Slides.Add($pres.Slides.Count + 1, 12)
  $s.FollowMasterBackground = 0
  $s.Background.Fill.Solid()
  $s.Background.Fill.ForeColor.RGB = [int]($(if ($dark) { $DARK } else { $WHITE }))
  return $s
}
function Heading($s, [string]$kicker, [string]$title, $color = $INK) {
  if ($kicker) { T $s $kicker 48 30 864 18 13 $ORANGE $true | Out-Null }
  T $s $title 48 50 864 44 30 $color $true | Out-Null
}
function Notes($s, [string]$text) { $s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $text }

$pp = New-Object -ComObject PowerPoint.Application
$pres = $pp.Presentations.Add(0)
$pres.PageSetup.SlideWidth = 960; $pres.PageSetup.SlideHeight = 540
try {
# 1. Title
$s = NewSlide $pres $true
T $s "FINAL-YEAR PROJECT · COMPUTER SCIENCE · NARESUAN UNIVERSITY" 48 120 480 18 13 $ORANGE $true | Out-Null
T $s "MeQ" 48 146 480 90 72 $WHITE $true | Out-Null
T $s "A mobile web application for basketball court queues and maintenance reports" 48 240 470 80 24 $WHITE | Out-Null
T $s "[Your name] · [Student ID]`rAdvisor: [Advisor name]`r2026" 48 372 470 80 16 $SOFT | Out-Null
Phone $s "home" 560 70 400 | Out-Null
Phone $s "court-queue" 740 70 400 | Out-Null
Notes $s "สวัสดีครับ ผม ... วันนี้จะนำเสนอโปรเจกต์ MeQ ระบบคิวสนามบาสและแจ้งซ่อมของมหาวิทยาลัยนเรศวร (20 วินาที)"

# 2. WHY: problem
$s = NewSlide $pres
Heading $s "WHY" "No one can see the queue, and no one can enforce it"
Bullets $s @(
  "3 courts (3x3 A, 3x3 B, 5x5), free walk-in play, crowded every evening",
  "The queue lives only in players' memory: ""Who is last?""",
  "No one can see the order or enforce it, so disputes follow",
  "Broken hoops and lights go unreported",
  "The NU sports booking system handles reservations, not walk-in queues"
) 48 125 420 360 18 $INK | Out-Null
Pic $s "images\nu-booking.png" 500 140 412 222 | Out-Null
T $s "The official NU sports page handles reservations, not walk-in play" 500 372 412 36 12 $MUTED | Out-Null
Notes $s "ตอนเย็นทีมที่มารอมีมากกว่าจำนวนสนาม คิวมีอยู่แค่ในความจำของผู้เล่น ทีมที่มาใหม่ต้องถามว่าใครต่อคิวท้ายสุด ทุกคนมองไม่เห็นลำดับ และไม่มีอะไรบังคับให้เป็นไปตามลำดับ เลยทะเลาะกันบ่อย งานวิจัยเรื่องคิวบอกว่าความยุติธรรมที่ผู้คนมองเห็นสำคัญพอ ๆ กับเวลาที่ต้องรอ อีกปัญหาหนึ่งคืออุปกรณ์เสียแล้วไม่มีช่องทางแจ้ง ระบบจองของมหาวิทยาลัยมีอยู่แล้ว แต่ใช้สำหรับจองล่วงหน้า ไม่ได้รองรับคนที่เดินมาเล่น (1 นาที)"

# 3. WHY: research question and objectives
$s = NewSlide $pres
Heading $s "WHY" "Research question and objectives"
$q = Box $s 48 112 864 84 $TINT
$tr = $q.TextFrame.TextRange
$tr.Text = "Can a queue whose rules are enforced by the database, together with push notifications, replace word-of-mouth queuing?"
$tr.Font.Name = $FONT; $tr.Font.Size = 20; $tr.Font.Italic = -1; $tr.Font.Color.RGB = [int]($INK); $tr.ParagraphFormat.Alignment = 1
$q.TextFrame.MarginLeft = 24; $q.TextFrame.MarginRight = 24
$objs = @(
  @("Queues", "Show every court's queue and enforce the court rules"),
  @("Presence", "Verify that teams are at the court, with GPS checked on the server"),
  @("Maintenance", "Reports with photos, tracked to resolution"),
  @("Notify, evaluate", "LINE notifications and 7 KPIs fixed before measuring")
)
for ($i = 0; $i -lt 4; $i++) {
  $x = 48 + $i * 220
  Box $s $x 222 204 250 $CARD | Out-Null
  Circle $s ($x + 20) 242 40 ([string]($i + 1)) | Out-Null
  T $s $objs[$i][0] ($x + 20) 300 164 26 18 $INK $true | Out-Null
  T $s $objs[$i][1] ($x + 20) 334 164 120 15 $MUTED | Out-Null
}
Notes $s "คำถามหลักคือ คิวที่ฐานข้อมูลเป็นคนบังคับกติกา บวกกับการแจ้งเตือนผ่าน LINE จะใช้แทนการต่อคิวแบบปากต่อปากได้ไหม ผมแบ่งเป็นวัตถุประสงค์ 4 ข้อ และตั้งเกณฑ์วัดผล 7 ตัวไว้ก่อนเริ่มวัดผล (1 นาที)"

# 4. WHAT: MeQ in one picture
$s = NewSlide $pres
Heading $s "WHAT" "MeQ in one picture: from sign-in to statistics"
$steps = @(@("login", "Sign in with LINE"), @("team", "Create a team"), @("court-queue", "Join a court queue"), @("check-in", "Check in at the court"), @("result", "Result and statistics"))
for ($i = 0; $i -lt 5; $i++) {
  $x = 48 + $i * 179
  Phone $s $steps[$i][0] ($x + 2) 110 330 | Out-Null
  Circle $s $x 452 28 ([string]($i + 1)) | Out-Null
  T $s $steps[$i][1] ($x + 36) 456 130 40 14 $INK $true | Out-Null
}
Notes $s "MeQ เป็นเว็บแอปที่เปิดบนมือถือ ไม่ต้องติดตั้ง ผู้ใช้ล็อกอินด้วย LINE สร้างทีม เชิญเพื่อน แล้วเข้าคิวสนามที่ต้องการ เมื่อถึงคิว ระบบเรียกทีมและแจ้งเตือนผ่าน LINE ทุกคนในทีมต้องเช็กอินที่สนาม พอเล่นจบ ทั้งสองทีมส่งคะแนน ระบบตรวจว่าคะแนนตรงกันแล้วบันทึกลงสถิติ (1 นาที)"

# 5. WHAT: court rules
$s = NewSlide $pres
Heading $s "WHAT" "The court rules, enforced by the system"
$rules = @(
  @("Full roster only", "3x3 needs 3 players; 5x5 needs 5"),
  @("One team, one queue", "A player belongs to one team; a team waits in one queue"),
  @("Check-in deadline", "A called team must check in at the court in time"),
  @("Winners stay for 2 games", "Then rest 1 game; losers have 3 minutes to requeue"),
  @("Both teams agree on the score", "Otherwise they resubmit, or an admin decides")
)
for ($i = 0; $i -lt 5; $i++) {
  $y = 118 + $i * 76
  Circle $s 48 $y 36 ([string]($i + 1)) | Out-Null
  $sh = T $s ($rules[$i][0] + "`r" + $rules[$i][1]) 100 ($y - 2) 460 60 15 $MUTED
  $p1 = $sh.TextFrame.TextRange.Paragraphs(1)
  $p1.Font.Bold = -1; $p1.Font.Size = 18; $p1.Font.Color.RGB = [int]($INK)
}
Pic $s "images\game-states.png" 608 112 305 400 | Out-Null
Notes $s "กติกาเหล่านี้เป็นกติกาที่ผู้เล่นใช้กันอยู่แล้วที่สนาม ผมแค่เอามาให้ระบบบังคับใช้แทนคน ที่ผู้เล่นสนใจที่สุดคือข้อทีมชนะอยู่ต่อได้ 2 เกมแล้วต้องพัก เพื่อไม่ให้ทีมเก่งทีมเดียวครองสนามทั้งคืน (1 นาที)"

# 6. WHAT: maintenance
$s = NewSlide $pres
Heading $s "WHAT" "Maintenance reports, tracked to resolution"
Phone $s "maintenance-form" 48 112 384 | Out-Null
Phone $s "admin-maintenance" 236 112 384 | Out-Null
$chips = @("New", "Accepted", "Waiting for caretaker", "Resolved")
for ($i = 0; $i -lt 4; $i++) {
  $x = 452 + $i * 118
  $c = Box $s $x 122 100 52 $(if ($i -eq 3) { $ORANGE } else { $CARD })
  $tr = $c.TextFrame.TextRange
  $tr.Text = $chips[$i]; $tr.Font.Name = $FONT; $tr.Font.Size = 13; $tr.Font.Bold = -1
  $tr.Font.Color.RGB = [int]($(if ($i -eq 3) { $WHITE } else { $INK })); $tr.ParagraphFormat.Alignment = 2
  $c.TextFrame.MarginLeft = 4; $c.TextFrame.MarginRight = 4
  if ($i -lt 3) { T $s ([string][char]0x2192) ($x + 102) 136 16 24 16 $MUTED $true 2 | Out-Null }
}
T $s "or Rejected, if the report is not valid" 452 182 460 18 12 $MUTED | Out-Null
Bullets $s @(
  "Players report damage with a photo; the admin is notified on LINE",
  "The reporter is notified of every status change",
  "Every change is recorded in the history",
  "A second report of an open problem is refused"
) 452 226 460 260 17 $INK | Out-Null
Notes $s "ผู้เล่นถ่ายรูปจุดที่เสียแล้วส่งรายงาน แอดมินได้รับแจ้งเตือนผ่าน LINE ทันที ทุกครั้งที่สถานะเปลี่ยน ผู้แจ้งได้รับแจ้งเตือน และระบบเก็บประวัติไว้ทุกขั้น (40 วินาที)"

# 7. HOW: architecture
$s = NewSlide $pres
Heading $s "HOW" "Architecture: free-tier services, one source of truth"
Pic $s "images\system-architecture.png" 48 116 570 380 | Out-Null
$parts = @(
  @("Next.js 16 on Vercel", "Pages and Server Actions, in TypeScript"),
  @("Supabase", "PostgreSQL, LINE sign-in, private photo storage"),
  @("LINE Messaging API", "Push notifications to players and admins"),
  @("pg_cron", "Advances every queue each 30 seconds")
)
for ($i = 0; $i -lt 4; $i++) {
  $y = 120 + $i * 94
  Box $s 644 $y 268 82 $CARD | Out-Null
  $sh = T $s ($parts[$i][0] + "`r" + $parts[$i][1]) 660 ($y + 14) 240 60 13 $MUTED
  $p1 = $sh.TextFrame.TextRange.Paragraphs(1); $p1.Font.Bold = -1; $p1.Font.Size = 16; $p1.Font.Color.RGB = [int]($INK)
}
Notes $s "หน้าเว็บทำด้วย Next.js และ deploy บน Vercel ฝั่งหลังบ้านใช้ Supabase ซึ่งมีฐานข้อมูล PostgreSQL ระบบล็อกอิน และที่เก็บรูป การแจ้งเตือนส่งผ่าน LINE Messaging API ทั้งหมดใช้บริการแบบฟรี (1 นาที 10 วินาที)"

# 8. HOW: the database is the referee
$s = NewSlide $pres
Heading $s "HOW" "The database is the referee"
T $s "The browser only asks.`rThe database decides." 48 116 430 90 28 $ORANGE $true | Out-Null
Bullets $s @(
  "Every change runs in one transaction that checks the user and the rules",
  "Row-level security blocks direct writes to queue and score tables",
  "GPS: the server computes the distance; a phone's ""in range"" is never trusted",
  "Notifications are saved with the change, so none is lost or sent twice"
) 48 230 430 280 16 $INK | Out-Null
Box $s 508 116 404 290 $CARD | Out-Null
Pic $s "images\line-notification-flow.png" 524 190 372 141 $false | Out-Null
T $s "Notification outbox: saved in the same transaction as the change, then sent once" 524 350 372 40 13 $MUTED | Out-Null
Notes $s "นี่คือหัวใจของงาน ถ้าให้หน้าเว็บเป็นคนตัดสินกติกา คนที่รู้วิธีก็โกงได้ หรือถ้าสองทีมกดเข้าคิวพร้อมกันก็อาจได้คิวซ้อนกัน ผมจึงให้ฐานข้อมูลเป็นกรรมการ ทุกการเปลี่ยนแปลงต้องผ่านฟังก์ชันที่ตรวจสิทธิ์และกติกาภายใน transaction ตำแหน่ง GPS ก็คำนวณระยะทางที่เซิร์ฟเวอร์ ไม่เชื่อค่าที่หน้าเว็บส่งมาว่าอยู่ในระยะ (1 นาที 10 วินาที)"

# 9. HOW: process
$s = NewSlide $pres
Heading $s "HOW" "Built and tested in small, verified steps"
$stats = @(
  @("39", "database migrations, each versioned"),
  @("147", "automated tests on every change: 115 database + 32 unit"),
  @("3", "field sessions with real players on their own phones"),
  @("11", "defects found and fixed, each covered by a new test")
)
for ($i = 0; $i -lt 4; $i++) {
  $x = 48 + $i * 220
  Box $s $x 118 204 210 $CARD | Out-Null
  T $s $stats[$i][0] ($x + 20) 134 164 64 52 $ORANGE $true | Out-Null
  T $s $stats[$i][1] ($x + 20) 214 164 96 16 $INK | Out-Null
}
$flow = @("Design", "Build", "Test in CI", "Field test", "Fix + new test")
for ($i = 0; $i -lt 5; $i++) {
  $x = 48 + $i * 178
  $c = Box $s $x 382 152 56 $(if ($i -eq 3) { $ORANGE } else { $TINT })
  $tr = $c.TextFrame.TextRange
  $tr.Text = $flow[$i]; $tr.Font.Name = $FONT; $tr.Font.Size = 15; $tr.Font.Bold = -1
  $tr.Font.Color.RGB = [int]($(if ($i -eq 3) { $WHITE } else { $INK })); $tr.ParagraphFormat.Alignment = 2
  if ($i -lt 4) { T $s ([string][char]0x2192) ($x + 154) 398 22 24 18 $MUTED $true 2 | Out-Null }
}
T $s "Design science research: build, evaluate, improve" 48 458 864 22 14 $MUTED | Out-Null
Notes $s "ผมพัฒนาแบบสร้าง ทดสอบ แล้วปรับปรุง ทุกครั้งที่แก้โค้ด GitHub จะรันเทสอัตโนมัติ 147 ข้อ ถ้าข้อไหนไม่ผ่านจะ merge ไม่ได้ และบั๊กที่เจอจากการทดสอบที่สนามจริง แก้แล้วจะเขียนเทสเพิ่มเพื่อไม่ให้บั๊กนั้นกลับมาอีก (50 วินาที)"

# 10. DEMO
$s = NewSlide $pres $true
Heading $s "DEMO" "One round on the court" $WHITE
$v = Box $s 48 116 500 380 (C "2A3140")
$tr = $v.TextFrame.TextRange
$tr.Text = "[ Demo video, 60–90 s ]`rJoin queue → LINE message → check in → scores → result"
$tr.Font.Name = $FONT; $tr.Font.Size = 18; $tr.Font.Color.RGB = [int]($SOFT); $tr.ParagraphFormat.Alignment = 2
$tr.Paragraphs(1).Font.Bold = -1; $tr.Paragraphs(1).Font.Size = 22; $tr.Paragraphs(1).Font.Color.RGB = [int]($WHITE)
Phone $s "line-chat" 576 116 380 | Out-Null
Phone $s "result" 741 116 380 | Out-Null
Notes $s "(พูดตามวิดีโอ) อัดหน้าจอระหว่างเทสที่สนามวันที่ 17 ต.ค. ตัดให้เหลือไม่เกิน 90 วินาที แล้ววางแทนกล่องวิดีโอ (1 นาที 30 วินาที)"

# 10b. Field evaluation photos
$s = NewSlide $pres
Heading $s "RESULTS" "Field evaluation, 17 October 2026"
Pic $s "slides\photos\field-game.jpg" 48 112 440 330 | Out-Null
T $s "A game during the evaluation" 48 450 440 18 12 $MUTED | Out-Null
Pic $s "slides\photos\field-author.jpg" 508 112 200 150 | Out-Null
T $s "MeQ in use at the court" 508 268 200 18 12 $MUTED | Out-Null
Pic $s "slides\photos\covered-court-renovation.jpg" 712 112 200 150 | Out-Null
T $s "Planned court: no lights (maintenance)" 712 268 200 18 12 $MUTED | Out-Null
Bullets $s @(
  "Moved to the Faculty of Science court, played as 3x3",
  "13 players; four teams played, 17:20–18:30",
    "Queue, check-in, play, scores, and a maintenance report",
  "Check-in failed at first: the court point was moved on site",
  "SUS questionnaire answered the same evening"
) 508 318 404 200 15 $INK | Out-Null
Notes $s "วันที่ 17 ต.ค. ผมพาผู้เล่น 13 คน 4 ทีม มาใช้ระบบจริงที่สนาม ตั้งแต่ 5 โมงครึ่งถึง 6 โมงครึ่ง ตามแผนจะเทสที่สนามในร่ม แต่วันนั้นกำลังซ่อมไฟสนาม ไม่มีไฟ คนเลยไม่มาเล่น ผมจึงย้ายไปเทสที่สนามคณะวิทยาศาสตร์ซึ่งมีสนามเดียว เล่นแบบ 3x3 ตอนแรกเช็กอินไม่ผ่านเพราะพิกัดในระบบยังชี้ไปที่สนามในร่ม ผมตั้งพิกัดใหม่ที่สนามนั้นทันที (40 วินาที)"

# 11. RESULTS: KPI scorecard (the image carries its own title)
$s = NewSlide $pres
Pic $s "slides\kpi-scorecard.png" 0 0 960 540 $false | Out-Null
Notes $s "ทุกเกณฑ์ตั้งไว้ก่อนวัดผล ผลออกมาผ่าน 6 จาก 7 ตัว ตัวที่ไม่ผ่านคือ SUS ได้ 67.5 จากผู้เล่น 13 คน ต่ำกว่าเกณฑ์ 68 อยู่ 0.5 คะแนน ถือว่าก้ำกึ่ง ข้อที่ได้คะแนนน้อยคือต้องมีคนช่วยตอนใช้ครั้งแรก โดยเฉพาะ KPI-1 ที่จำลองผู้ใช้ 50 คนกดเข้าออกคิวพร้อมกัน ไม่มีครั้งไหนที่คิวผิดกติกาเลย และมีการกดเข้าคิวซ้ำพร้อมกัน 533 ครั้ง ระบบไม่ยอมรับแม้แต่ครั้งเดียว (1 นาที 30 วินาที)"

# 12. RESULTS: field tests
$s = NewSlide $pres
Heading $s "RESULTS" "Real players found what the tests missed"
$found = @(
  @("Queue stalled", "The queue stopped advancing after a team requeued. Fixed in the database, with a new test."),
  @("Challenger dropped (16 Oct)", "When a winner left, the called challenger vanished from the queue. Fixed the same day, with a new test."),
  @("Statistics showed 0", "A missing permission grant hid players' statistics. Fixed and verified on the live site.")
)
for ($i = 0; $i -lt 3; $i++) {
  $x = 48 + $i * 295
  Box $s $x 118 274 248 $CARD | Out-Null
  Circle $s ($x + 20) 138 36 ([string]($i + 1)) | Out-Null
  T $s $found[$i][0] ($x + 20) 190 234 50 18 $INK $true | Out-Null
  T $s $found[$i][1] ($x + 20) 244 234 110 15 $MUTED | Out-Null
}
$l = Box $s 48 390 864 84 $TINT
$tr = $l.TextFrame.TextRange
$tr.Text = "Lesson: every automated test passed, but real users on real phones found the edge cases."
$tr.Font.Name = $FONT; $tr.Font.Size = 19; $tr.Font.Bold = -1; $tr.Font.Color.RGB = [int]($INK); $tr.ParagraphFormat.Alignment = 1
$l.TextFrame.MarginLeft = 24
Notes $s "สิ่งที่ได้เรียนรู้มากที่สุดคือ เทสอัตโนมัติผ่านหมดก็ยังไม่พอ ต้องให้คนจริงใช้จริง บั๊กที่ร้ายแรงที่สุดเจอจากการทดสอบที่สนาม รวมทั้งหมดเจอข้อบกพร่องในโค้ด 11 จุด แก้ครบและเพิ่มเทสทุกครั้ง และปัญหาการตั้งค่าพิกัด 1 จุดที่แก้ที่สนาม (1 นาที)"

# 13. IMPACT
$s = NewSlide $pres
Heading $s "IMPACT" "Impact, limitations, and future work"
$cols = @(
  @("Impact", @("A visible, fair queue: fewer arguments, no standing by the court", "Damage reaches the staff sooner; players follow the repair", "Free infrastructure that other facilities can reuse")),
  @("Limitations", @("A faked GPS location cannot be detected", "Scores are entered by the teams themselves", "First use needs guidance (SUS 67.5)", "One facility and a small sample")),
  @("Future work", @("Queues visible without sign-in; guided first use", "QR code check-in at the court", "Futsal and volleyball courts", "Measure disputes before and after deployment"))
)
for ($i = 0; $i -lt 3; $i++) {
  $x = 48 + $i * 295
  Box $s $x 118 274 300 $(if ($i -eq 0) { $TINT } else { $CARD }) | Out-Null
  T $s $cols[$i][0] ($x + 22) 140 230 28 20 $ORANGE $true | Out-Null
  Bullets $s $cols[$i][1] ($x + 22) 184 230 280 15 $INK | Out-Null
}
Notes $s "ข้อจำกัดที่ตอบตรง ๆ ได้คือ ถ้ามีคนปลอม GPS ระบบตรวจไม่ได้ และคะแนนเป็นค่าที่ผู้เล่นกรอกเอง ระบบตรวจได้แค่ว่าสองทีมกรอกตรงกัน งานต่อยอดคือขยายไปสนามกีฬาอื่น และใช้ QR code ที่สนามเพื่อยืนยันว่ามาจริง (1 นาที)"

# 14. Thank you
$s = NewSlide $pres $true
T $s "Thank you" 48 170 520 90 64 $WHITE $true | Out-Null
T $s "Questions?" 48 262 520 44 30 $ORANGE $true | Out-Null
T $s "[Website link or QR code]" 48 340 520 24 16 $SOFT | Out-Null
Phone $s "home" 650 70 400 | Out-Null
Notes $s "ขอบคุณครับ ยินดีตอบคำถามครับ"

if (Test-Path $out) { Remove-Item $out }
$pres.SaveAs($out, 24)
"saved=" + $out
if ($RenderDir) {
  New-Item -ItemType Directory -Force $RenderDir | Out-Null
  Get-ChildItem $RenderDir -Filter "slide-*.png" | Remove-Item
  foreach ($sl in $pres.Slides) { $sl.Export((Join-Path $RenderDir ("slide-{0:D2}.png" -f $sl.SlideIndex)), "PNG", 1280, 720) }
  "rendered=" + $pres.Slides.Count
}
} finally {
  $pres.Close()
  $pp.Quit()
}
