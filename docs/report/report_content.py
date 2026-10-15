"""Content of the MeQ thesis. Edit the text here and run build_report.py.

Inline markup: **bold**, *italic*, `code`, {{text to complete}} (yellow).
Figures are PNG paths relative to the repository root.
"""

TITLE = "Development of a Web Application for Sports Facility Queuing and Maintenance Reporting"
AUTHOR = "Nutthawut Wanma"
STUDENT_ID = "66311834"
ADVISOR = "Assistant Professor Wansuree Massagram, Ph.D."
MONTH = "October 2026"  # month of submission, shown on the cover pages

COVER_REPLACEMENTS = [
    ("Buzzly: A Centralized Hub for Digital Marketing Intelligence", TITLE),
    ("Pachara Danthanin", AUTHOR),
    ("October 2026", MONTH),
]

SHOT = "docs/report/screenshots/"
IMG = "docs/report/images/"
DIA = "docs/diagrams/rendered/"

ALL_FIGURES = []


def fig(doc, path, caption, width=100):
    ALL_FIGURES.append(path)
    doc.figure(path, caption, width)


def write(doc, sect):
    front_matter(doc)
    doc.section_break(sect[1])
    chapter1(doc)
    doc.section_break(sect[2])
    chapter2(doc)
    doc.section_break(sect[3])
    chapter3(doc)
    doc.section_break(sect[4])
    chapter4(doc)
    doc.section_break(sect[5])
    chapter5(doc)
    doc.section_break(sect[6])
    references(doc)
    appendices(doc)


# =====================================================================
def front_matter(doc):
    doc.plain_heading("Acknowledgement")
    doc.p("I would like to express my sincere gratitude to Asst. Prof. Dr. Wansuree Massagram, my senior project advisor, "
          "for her guidance and critical feedback throughout this project. I also thank Asst. Prof. Dr. Sanya Khruahong and "
          "Asst. Prof. Dr. Winai Wongthai for their comments as committee members, and the Department of Computer Science and "
          "Information Technology, Faculty of Science, Naresuan University, for its support. Finally, I thank the students who "
          "play at the university basketball courts and took part in the field tests, whose feedback shaped the system described here.")
    doc.raw('<w:p><w:pPr><w:pStyle w:val="NormalNoIndent"/><w:spacing w:before="480"/><w:jc w:val="right"/></w:pPr>'
            '<w:r><w:rPr><w:rFonts w:cs="Arial"/></w:rPr><w:t>Nutthawut Wanma</w:t></w:r></w:p>')
    doc.page_break()

    doc.info_line("Title", TITLE)
    doc.info_line("Author", AUTHOR)
    doc.info_line("Student ID", STUDENT_ID)
    doc.info_line("Advisor", ADVISOR)
    doc.info_line("Academic Paper", "Undergraduate Thesis B.S. (Computer Science)")
    doc.info_line("", "Faculty of Science, Naresuan University")
    doc.info_line("Keywords", "virtual queue, sports facility, maintenance reporting, transactional database rules, "
                  "geolocation check-in, LINE Messaging API, Backend-as-a-Service")

    doc.plain_heading("Abstract")
    doc.p("Walk-in players at the outdoor basketball courts of Naresuan University queue by word of mouth: newcomers cannot "
          "tell whose turn is next, queue jumping cannot be proven, and disputes follow. Damaged equipment, such as a broken "
          "hoop or a failed floodlight, also reaches the staff late because there is no channel for reporting it. This project "
          "designed, developed, and evaluated MeQ, a mobile web application for on-site court queuing and maintenance reporting "
          "at three courts (3x3 A, 3x3 B, and 5x5). Every queue rule (full rosters, one active queue per player, a check-in "
          "deadline, a two-consecutive-win limit with a mandatory rest, and score validation) is enforced inside PostgreSQL "
          "through transactional functions, and scheduled database jobs advance each court without an administrator. Check-in "
          "is verified by the device's location, with the distance to the court computed on the server. Players report damaged "
          "equipment with a photo; administrators track each report through a recorded status history and are reminded about "
          "reports that wait too long. LINE notifications, delivered through a transactional outbox, tell team leaders when "
          "their team is next or called, and tell reporters and administrators about maintenance progress. The system was "
          "built with Next.js on Vercel and Supabase, and evaluated against seven key performance indicators whose thresholds "
          "were fixed before measurement. All 98 database tests and 30 unit tests of the business rules passed, and a field "
          "test with six players on real phones exposed nine defects, among them a queue that stopped advancing after a team "
          "requeued, all of which were corrected and covered by new tests. "
          "{{Summarize here the results of KPI-1 and KPI-3 to KPI-7 after the final evaluation (Chapter 4).}}")

    doc.toc("Table of Contents", r'TOC \o "1-3" \h \z \u')
    doc.page_break()
    doc.toc("List of Tables", r'TOC \h \z \t "Table Caption,1"')
    doc.page_break()
    doc.toc("List of Figures", r'TOC \h \z \t "caption,1"')


# =====================================================================
def chapter1(doc):
    doc.chapter_heading("Introduction")
    doc.h(2, "Introduction")
    doc.h(3, "Background and Significance of the Problem")
    doc.p("Naresuan University provides outdoor basketball courts that students and members of the public may use free of "
          "charge during open hours. Two full courts serve walk-in players: one full court is divided into two half courts "
          "for 3-on-3 games (3x3 A and 3x3 B), and the other hosts 5-on-5 games. In the evening, more teams arrive than the "
          "courts can hold, so teams wait for their turn while others play.")
    doc.p("The university already runs an official sports booking system [1] (Figure 1.1), but it serves advance reservations "
          "and university events, not walk-in play. During open hours, the queue exists only in the players' memory: a team "
          "that arrives asks around who is last in line. A newcomer cannot see the order, a team can claim a turn it does not "
          "have, and nobody can prove otherwise, so arguments between teams are common. Research on queues shows that "
          "perceived fairness matters as much as the waiting time itself: people accept a longer wait when the order is "
          "visibly first come, first served, and resent a shorter one when they see others jump ahead [2], [3].")
    fig(doc, IMG + "nu-booking.png", "The official Naresuan University sports service page, which handles reservations but not walk-in queues [1]")
    doc.p("A second, smaller problem concerns the facility itself. When a hoop comes loose, a backboard cracks, the court "
          "surface breaks, or a floodlight fails, players usually leave without telling anyone, because there is no channel "
          "for reporting. The court caretaker learns about the damage late, and the next players find an unusable court.")
    doc.h(3, "Problem Statement")
    doc.p("An informal queue fails in two ways: the order is invisible, and nothing enforces it. A digital list that anyone "
          "can edit would solve only the first. The problem addressed by this project is therefore whether the queue rules "
          "that players already follow at the courts can be made visible to everyone and enforced by the system itself, "
          "including the cases where several teams act at the same moment, and whether players can be told when their turn "
          "comes without having to stand next to the court. Alongside the queue, the project asks whether a simple reporting "
          "channel, with a recorded status for each report, lets the staff learn about damaged equipment sooner and lets "
          "players follow the repair.")

    doc.h(2, "Objectives")
    doc.p("This project has four objectives:")
    doc.ol([
        "To design and develop MeQ, a mobile web application that shows the queues of the three basketball courts of "
        "Naresuan University and enforces the court rules (full rosters, one queue per player, a check-in deadline, a "
        "two-consecutive-win limit, and score validation) inside the database.",
        "To verify that teams are physically at the court before they play, by checking each member's location on the server.",
        "To develop a maintenance reporting module through which players report damaged equipment with a photo and "
        "administrators track each report to its resolution.",
        "To notify team leaders, reporters, and administrators through LINE, and to evaluate the system's correctness, "
        "timeliness, performance, usability, and security against criteria fixed before measurement.",
    ])
    doc.h(3, "Research Questions")
    doc.p("The project addresses one principal question: *Can a queue whose rules are enforced by the database, together "
          "with push notifications, replace word-of-mouth queuing at a free, unsupervised sports facility?* It is examined "
          "through four research questions:")
    doc.pni("**RQ1 (Correctness).** Does the system keep every queue consistent with the court rules when many users act at the same time?")
    doc.pni("**RQ2 (Timeliness).** Do LINE notifications reach team leaders soon enough after their team is called to replace calling out across the court?")
    doc.pni("**RQ3 (Maintenance).** Does the reporting module let administrators respond to damaged equipment within a working day?")
    doc.pni("**RQ4 (Practicality).** Does the system respond quickly enough on phones under the expected evening load, and do players find it usable?")
    doc.h(3, "Research Hypotheses")
    doc.p("Each research question is tested against a hypothesis with a threshold fixed before measurement (Section 3.3.1):")
    doc.pni("**H1 (RQ1).** With 50 concurrent virtual users joining and leaving queues, no run produces a rule violation "
            "(a team or player in two active queues, a duplicate or missing queue position, or an order that differs from the "
            "joining order), and every automated rule test passes.")
    doc.pni("**H2 (RQ2).** During the field evaluation, at least 95% of LINE notifications are delivered within 60 seconds "
            "of the event that caused them, and no message is delivered twice.")
    doc.pni("**H3 (RQ3).** The median time from a maintenance report to the first administrator response is at most 12 hours.")
    doc.pni("**H4 (RQ4).** Under 50 concurrent users, the 95th-percentile response time is below 2 seconds with fewer than 1% "
            "failed requests, and the mean System Usability Scale (SUS) score is at least 68.")

    doc.h(2, "Scope")
    doc.h(3, "Target Users")
    doc.ol([
        "Walk-in players at the Naresuan University basketball courts, students and members of the public, who use the system on their phones at the court.",
        "Team captains, who manage their team and its queue, and the member they name as game delegate.",
        "Administrators of the facility, who manage courts, events, and maintenance reports from a desktop or phone.",
    ], paren=True)
    doc.h(3, "Facility")
    doc.p("The system covers the three courts described in Section 1.1.1 (3x3 A, 3x3 B, and 5x5), each with its own queue. "
          "The courts are open from 05:00 to 00:00, and the queue day starts at 05:00 Bangkok time. Other sports and other "
          "facilities are outside the scope.")
    doc.h(3, "Core Functions")
    doc.ol([
        "Sign-in with LINE, team creation, and team invitations.",
        "A queue per court, visible to everyone and refreshed automatically, with rules enforced by the database.",
        "Location-verified check-in when a team is called, and a confirmed start of each game.",
        "Score submission by both teams, automatic validation, winner rotation, and player statistics.",
        "Maintenance reporting with photo evidence, a status workflow, and statistics for administrators.",
        "LINE notifications to team leaders, reporters, invitees, and administrators.",
        "Administration of court opening, events that close courts, the daily target score, and stuck games.",
    ], paren=True)
    doc.h(3, "Technical Constraints")
    doc.ol([
        "A Next.js web application in TypeScript, deployed on Vercel, with Supabase (PostgreSQL, Auth, Storage) as the backend.",
        "Mobile browsers are the primary target; no native application is built.",
        "Free or hobby tiers of Vercel, Supabase, and the LINE Official Account throughout.",
        "LINE can push messages only to users who have added the MeQ Official Account as a friend.",
    ], paren=True)
    doc.h(3, "Variables")
    doc.p("The independent variable is the system itself, a treatment that is built and then measured rather than a factor "
          "varied across groups. Its components are the database-enforced queue rules, the location-verified check-in, the "
          "maintenance workflow, and the notification outbox. The dependent variables are the seven key performance "
          "indicators (KPIs) defined in Section 3.3.1.")
    doc.h(3, "Setting and Period")
    doc.p("Development took place from {{start month}} to October 2026. A formative field test with six players on real "
          "phones was held on 12 October 2026. The summative evaluation is scheduled for {{dates of the final evaluation}}.")
    doc.h(3, "Conceptual Framework")
    fig(doc, IMG + "conceptual-framework.png", "Conceptual framework of the project", 92)
    doc.p("Figure 1.2 relates the components of MeQ to the outcomes evaluated. The queue rules and the location check "
          "determine whether the queue stays correct (KPI-1, KPI-2); the notification outbox determines whether team leaders "
          "learn of their turn in time (KPI-3); the maintenance workflow determines how quickly reports receive a response "
          "(KPI-4); and the system as a whole is measured for performance under load (KPI-5), usability (KPI-6), and "
          "security (KPI-7).")

    doc.h(2, "Assumptions")
    doc.ol([
        "Players carry a smartphone with a browser, location services, and LINE, which is the dominant messaging application in Thailand.",
        "Teams agree on the score of each game on the court; the system validates that the two submissions are consistent but cannot observe the game itself.",
        "The location reported by a phone's browser is honest within its stated accuracy; the system rejects readings whose accuracy is too poor but cannot detect a deliberately falsified location.",
        "Within each evaluation round, the free-tier infrastructure performs consistently enough for its runs to be compared.",
    ])

    doc.h(2, "Definitions")
    for term, meaning in [
        ("Queue entry", "A team's place in the queue of one court, from joining until it leaves, is skipped, or finishes."),
        ("Team leader", "The captain of a team or the game delegate the captain has named; only leaders act for the team in a game."),
        ("Check-in", "The period after a team is called during which its members verify their location and the leader confirms the team is ready."),
        ("Holding the court", "The state of a winning team that chose to keep playing and waits on the court for the next challenger."),
        ("Two-win limit", "The rule that a team may win at most two consecutive games on a court before resting for one game."),
        ("Remote procedure call (RPC)", "A database function that the application calls to change data; all queue changes go through RPCs."),
        ("Row Level Security (RLS)", "A PostgreSQL mechanism that decides, row by row, which data each user may read or change [6]."),
        ("Transactional outbox", "A pattern in which a message is stored in the same database transaction as the change that causes it and sent afterwards [9]."),
        ("Key performance indicator (KPI)", "A measurable criterion with a threshold fixed before measurement (Section 3.3.1)."),
        ("System Usability Scale (SUS)", "A ten-item questionnaire that yields a usability score from 0 to 100 [22]."),
    ]:
        doc.p(f"**{term}:** {meaning}")

    doc.h(2, "Benefits")
    doc.ol([
        "Players see the same queue on their phones, can wait away from the court, and are told when their turn comes, which removes the main source of disputes.",
        "Court staff learn about damaged equipment from a photo and a location instead of hearing about it days later, and administrators can show how quickly each report was handled.",
        "Developers of similar systems can reuse the design: rules enforced in database transactions, scheduled advancement without staff, server-side location checks, and an outbox for notifications.",
    ])

    doc.h(2, "Research Plan")
    doc.table("Project work schedule", ["No.", "Activity", "Period"], [
        ["1", "Requirement analysis and system design", "{{Apr–May 2026}}"],
        ["2", "Database, queue rules, and team management", "{{May–Aug 2026}}"],
        ["3", "Check-in, game flow, and statistics", "{{Aug 2026}}"],
        ["4", "Maintenance module and LINE notifications", "Sep–Oct 2026"],
        ["5", "Formative field test and corrections", "12–13 Oct 2026"],
        ["6", "Summative evaluation (KPI-1 to KPI-7)", "{{dates}}"],
        ["7", "Analysis and report preparation", "Oct–{{Nov}} 2026"],
    ], [1, 6, 3])


# =====================================================================
def chapter2(doc):
    doc.chapter_heading("Literature Review")
    doc.h(2, "Background")
    doc.h(3, "Theory")
    doc.pni("**Design Science Research**")
    doc.p("Design science research produces knowledge by building and evaluating artifacts that solve a problem relevant to "
          "a real environment [4]. Hevner et al. describe it as a cycle between the environment, which supplies the business "
          "need, the knowledge base, which supplies foundations and methods, and the build-and-evaluate loop of the research "
          "itself. MeQ is such an artifact: the need comes from the courts (Chapter 1), the design draws on the techniques "
          "below, and the system is built (Chapter 3) and evaluated against explicit criteria (Chapter 4). Two of the "
          "framework's evaluation methods are used: functional testing against expected outcomes, and observation of the "
          "artifact in use.")
    doc.pni("**Fairness and the Psychology of Queues**")
    doc.p("Larson argues that the experience of a queue depends on social justice as much as on the waiting time: a "
          "first-come, first-served order is accepted as fair, while a violation of it, a *slip*, provokes anger even when "
          "it costs little time [2]. Maister adds that unexplained and uncertain waits feel longer than known, finite ones "
          "[3]. Two design requirements follow. The order must be enforced, not merely displayed, so that no team can slip "
          "ahead; and every waiting team should see its position and be told when its turn comes, which turns an uncertain "
          "wait into a known one.")
    doc.h(3, "Technique")
    doc.pni("**Transactions and Concurrency Control**")
    doc.p("A queue is shared state that several users change at the same time. If two teams join at the same moment, or the "
          "scheduler calls a team while its captain leaves, an application that reads, decides, and then writes can lose an "
          "update or assign the same position twice. Database transactions avoid this when the decision and the write happen "
          "inside one transaction under an appropriate isolation level and locking [5]. MeQ therefore places every queue "
          "transition in a PostgreSQL function that locks the rows it decides on, so that the rules hold regardless of how "
          "many users act concurrently. Constraints such as a unique index on a team's active queue entry act as a second "
          "line of defence.")
    doc.pni("**Location Verification**")
    doc.p("Browsers expose the device's position through the W3C Geolocation API, which reports latitude, longitude, and an "
          "accuracy radius [8]. The distance between two points on the Earth is computed with the haversine formula [7]. "
          "Because any value computed in the browser can be altered, the browser only sends its coordinates; the database "
          "computes the distance to the court, compares it with the court's radius plus the reported accuracy, and stores an "
          "expiring verification.")
    doc.pni("**Reliable Notification Delivery**")
    doc.p("Sending a message to an external service inside a database transaction is unreliable: the transaction may roll "
          "back after the message is sent, or the service may fail after the data are committed. The transactional outbox "
          "pattern stores the message in the same transaction as the change that causes it, and a separate relay sends "
          "stored messages afterwards and records the result [9]. Messaging practice adds two properties: a receiver should "
          "tolerate the same message arriving twice (idempotency), and messages that cannot be delivered should be set aside "
          "rather than retried forever [10]. MeQ applies these ideas to LINE notifications (Section 3.2.8).")
    doc.h(3, "Technology")
    doc.pni("**Next.js and React**")
    doc.p("React builds user interfaces from components [12]. Next.js is a React framework whose App Router renders pages on "
          "the server and runs *Server Actions*, functions that execute on the server when a form is submitted [11]. MeQ uses "
          "server rendering so that the queue a phone shows always comes from the database, and Server Actions so that the "
          "browser never writes to the database directly.")
    doc.pni("**Supabase and PostgreSQL**")
    doc.p("Supabase is an open-source Backend-as-a-Service built on PostgreSQL. It provides authentication, a data API, file "
          "storage, and PostgreSQL extensions [13]. MeQ uses Row Level Security to restrict which rows each user may read [6], "
          "the pg_cron extension to run scheduled jobs inside the database [14], the pg_net extension to make HTTP calls from "
          "the database, and Vault to store secrets that those calls need.")
    doc.pni("**LINE Login and the LINE Messaging API**")
    doc.p("LINE Login authenticates users with their LINE account through OpenID Connect [15], [17]. The LINE Messaging API "
          "lets an Official Account push messages to users who have added it as a friend [16]. MeQ uses LINE Login as its "
          "only sign-in method for players, so every account carries a LINE user ID to which notifications can be pushed.")
    doc.pni("**Mobile-First Design**")
    doc.p("Players use MeQ at the court, on a phone, often outdoors. Mobile-first design starts from the smallest screen and "
          "the most essential actions and adds detail for larger screens [27]. The interface of MeQ follows this approach: "
          "each page shows first the one action a user is most likely to need.")

    doc.h(2, "Related Works")
    doc.h(3, "Facility Booking Systems")
    doc.p("The official Naresuan University sports service [1] lets users view the reservation calendar, check facility "
          "availability, and see scheduled university activities. It is effective for formal events and advance bookings, "
          "but it has no mechanism for walk-in players during open hours and no channel for reporting damaged equipment. "
          "MeQ complements it rather than replacing it: university events are entered in MeQ as calendar events that close "
          "the affected courts, and walk-in play is handled by the queue.")
    doc.h(3, "Pickup Basketball Applications")
    doc.p("Applications for pickup basketball, such as HoopMaps [18], help players find courts and games. Commercial pickup "
          "services at private clubs add waitlists, but they are typically closed, paid, and run by staff on site. None of "
          "them enforces the rotation rules of a specific free court without staff. MeQ is free, tied to the three courts of "
          "the university, and self-managed: the database and the scheduler run the rotation.")
    doc.h(3, "Virtual Queue Applications")
    doc.p("Virtual queue services such as QueQ, widely used in Thai restaurants and hospitals [19], issue a queue number and "
          "notify the customer when the turn approaches. They show that Thai users accept a phone-based queue and "
          "notifications. Their model, however, assumes a single service point that calls one customer at a time. A "
          "basketball court calls two teams, lets the winner stay, limits consecutive wins, and needs both teams to agree on a "
          "score, rules that a generic ticket queue cannot express.")
    doc.h(3, "Issue Reporting Platforms")
    doc.p("Civic reporting platforms let citizens report problems with a photo and a location and follow their resolution. "
          "FixMyStreet routes reports to the responsible authority and shows their status publicly [21]; Traffy Fondue, "
          "developed by NECTEC, collects reports through LINE and is used by Thai cities including Bangkok [20]. Their shared "
          "lessons are that reporting must take seconds, that a visible status motivates people to report, and that "
          "duplicate reports of the same problem should be merged. The maintenance module of MeQ applies these lessons at "
          "the scale of one facility: one active report per court and problem type, a public status without the reporter's "
          "identity, and a history of every status change.")
    doc.h(3, "Synthesis and Research Gap")
    doc.table("Themes from theory and related work and their implications for MeQ", ["Theme", "Principal finding", "Implication for MeQ"], [
        ["Queue fairness [2], [3]", "Visible first-come, first-served order and known waits are perceived as fair", "Enforce the order in the database; show every queue; notify the next team"],
        ["Design science [4]", "Artifacts are built and evaluated against explicit criteria", "Seven KPIs with thresholds fixed before measurement"],
        ["Concurrency control [5]", "Decisions and writes must share one transaction", "Every queue transition is a locking database function"],
        ["Location verification [7], [8]", "Browser positions carry an accuracy; client values can be altered", "Server-side distance with an accuracy allowance and expiry"],
        ["Reliable messaging [9], [10]", "Store messages with the change; deliver idempotently; isolate failures", "Notification outbox with retry key, expiry, and retry limit"],
        ["Virtual queues [19]", "Thai users accept phone queues and notifications", "Phone-first queue with LINE notifications"],
        ["Issue reporting [20], [21]", "Fast reporting, visible status, merged duplicates", "Photo report, public status, one active report per problem"],
    ], [3, 4, 4])
    doc.p("Existing systems either handle reservations without walk-in play [1], provide queues that cannot express court "
          "rotation rules [19], or handle reports for whole cities [20], [21]. No system found enforces the rotation rules of "
          "a free, unsupervised court and verifies that teams are present, while also giving its users a maintenance channel. "
          "This project addresses that gap.")


# =====================================================================
def chapter3(doc):
    doc.chapter_heading("Methodology")
    doc.h(2, "Method")
    doc.h(3, "Research Design")
    doc.p("The project follows design science research (Section 2.1.1) [4]. MeQ is the artifact; the need comes from the "
          "courts, the design is grounded in the techniques of Chapter 2, and the system is built (this chapter) and evaluated "
          "(Chapter 4). Correctness is evaluated by functional testing against expected outcomes; timeliness and maintenance "
          "responsiveness by observation of the system in use; performance by a load test; usability by a standardized "
          "questionnaire; and security by privilege tests and a vulnerability scan.")
    doc.h(3, "Development Process")
    doc.p("Development followed iterative prototyping in four phases:")
    doc.ol([
        "**Rule analysis.** Writing down the rules that players already follow at the courts (Table 3.4) and the cases where they break down.",
        "**Database first.** Implementing every rule as a database function with automated tests before building the pages that call it.",
        "**Interface.** Building mobile pages for players and desktop pages for administrators around the functions.",
        "**Field-driven correction.** Testing with real players on real phones, correcting each defect found, and adding a test for it before the next round.",
    ])
    doc.p("Implementation was assisted by AI coding agents: the initial project structure was generated with OpenAI Codex, "
          "and later work, including the maintenance workflow, the notification system, and the corrections after the field "
          "test, was carried out with Claude Code. The author specified each change, reviewed it before it was committed, and "
          "required the type check, linter, production build, unit tests, and database tests to pass; a continuous integration "
          "pipeline repeats the tests on every pull request.")
    doc.h(3, "Tools and Environment")
    doc.table("Development and evaluation tools", ["Layer", "Tool", "Use"], [
        ["Frontend", "Next.js 16 (App Router), React 19, TypeScript (strict)", "Server-rendered pages and Server Actions"],
        ["Hosting", "Vercel (Hobby), Singapore region", "Web application and the notification endpoint"],
        ["Backend", "Supabase (Free): PostgreSQL, Auth, Storage, pg_cron, pg_net, Vault", "Data, rules, sign-in, photos, scheduled jobs"],
        ["Messaging", "LINE Login (OpenID Connect), LINE Messaging API", "Sign-in and push notifications"],
        ["Testing", "pgTAP via Supabase CLI; Node.js test runner; GitHub Actions", "Database rule tests, unit tests, CI"],
        ["Evaluation", "{{k6; OWASP ZAP; SUS questionnaire}}", "KPI-1, KPI-5, KPI-6, KPI-7"],
        ["Development", "Git, GitHub, OpenAI Codex, Claude Code, Mermaid", "Version control, implementation, diagrams"],
    ], [2, 5, 4])

    doc.h(2, "Design and Implementation")
    doc.h(3, "Functional Requirements")
    doc.p("Table 3.2 lists the functional requirements and the section that realizes each; Figure 3.1 shows the "
          "corresponding use cases.")
    doc.table("Functional requirements", ["ID", "The system shall", "Section"], [
        ["FR-1", "Let users sign in with LINE, create a team, and invite members", "3.2.10"],
        ["FR-2", "Show the queue of every court, refreshed without user action", "3.2.3"],
        ["FR-3", "Let a team leader join or leave a queue, subject to the court rules", "3.2.4"],
        ["FR-4", "Call the next teams automatically and verify their location before the game", "3.2.5"],
        ["FR-5", "Collect scores from both teams, validate them, and apply the winner rotation", "3.2.6"],
        ["FR-6", "Accept maintenance reports with a photo and track each to resolution", "3.2.7"],
        ["FR-7", "Notify team leaders, invitees, reporters, and administrators through LINE", "3.2.8"],
        ["FR-8", "Let administrators manage courts, events, target scores, reports, and stuck games", "3.2.6, 3.2.7"],
    ], [1, 7, 1.4])
    fig(doc, IMG + "use-case.png", "Use case diagram of MeQ")
    doc.h(3, "Non-Functional Requirements")
    doc.table("Non-functional requirements and their verification", ["Quality attribute", "Requirement", "Verified by"], [
        ["Correctness", "Queues obey the court rules under concurrent use", "KPI-1, KPI-2"],
        ["Timeliness", "Team leaders learn of their turn within a minute", "KPI-3"],
        ["Responsiveness", "Reports receive an administrator response within a working day", "KPI-4"],
        ["Performance", "Pages respond quickly with 50 concurrent users", "KPI-5"],
        ["Usability", "Players rate the system at least acceptable", "KPI-6"],
        ["Security", "Users can change only what their role permits; common web risks are mitigated", "KPI-7"],
    ], [2, 5, 2])

    doc.h(3, "Architecture")
    fig(doc, IMG + "system-architecture.png", "System architecture of MeQ")
    doc.p("MeQ has three parts (Figure 3.2). The **web application** runs on Vercel. Each page is rendered on the server from "
          "data read through the user's own session, so Row Level Security applies to every read. Every change goes through "
          "a Server Action, which validates the input and calls one database function; the browser never writes to a table.")
    doc.p("The **database** is the source of truth for all queue state. Teams, queue entries, check-ins, games, scores, and "
          "player history are changed only by functions that run with elevated rights but check the caller's identity and "
          "role inside the transaction, and table grants block direct writes from users. Scheduled jobs inside the database "
          "advance the courts and expire deadlines every 30 seconds, so the queue keeps moving when no administrator is "
          "present.")
    doc.p("The **notification path** connects the database to LINE. Database triggers write a message to an outbox table in "
          "the same transaction as the event; a dispatcher endpoint claims pending messages, pushes them to LINE, and records "
          "the outcome (Section 3.2.8).")
    doc.p("The proposal planned real-time synchronization through WebSockets. The implementation instead refreshes the "
          "court and game pages from the server every 10 seconds while the page is visible and the user is not typing. This "
          "keeps the queue tables closed to direct reads from the browser and was judged sufficient for a queue in which "
          "turns last minutes.")

    doc.h(3, "Queue Rules")
    doc.p("Table 3.4 lists the rules the database enforces. They were written down from the practice at the courts and "
          "refined after the field test.")
    doc.table("Court and queue rules enforced by the database", ["Area", "Rule"], [
        ["Courts", "Three courts (3x3 A, 3x3 B, 5x5), each with its own queue; open 05:00–00:00; the queue day starts at 05:00"],
        ["Teams", "A user belongs to one team; a 3x3 team needs exactly 3 members and a 5x5 team 5 before it may queue"],
        ["Queue", "A team or player may be in only one active queue; positions follow the joining order"],
        ["Calling", "The scheduler calls the next teams when a court needs them: one challenger if a winner holds the court, otherwise two"],
        ["Check-in", "A called team has 3 minutes (adjustable 1–10) to verify every member's location and confirm ready; otherwise it is skipped"],
        ["Target score", "Daily default 7 (3x3) or 15 (5x5); before a game, one leader may propose another allowed value and the other must confirm"],
        ["Scoring", "Each team submits its own players' points; the result is valid only if exactly one team reached the target"],
        ["Deadline", "Both teams must submit valid scores within 5 minutes of the end request, or the game ends without a result"],
        ["Rotation", "The winner may continue for at most two consecutive wins, then rests one game and returns to the head of the queue"],
        ["Decisions", "The winner and the loser each have 3 minutes to continue or requeue; no decision means leaving the queue"],
    ], [2, 9])
    fig(doc, IMG + "queue-entry-states.png", "States of a team's queue entry")
    doc.p("Figure 3.3 shows the states a queue entry passes through. Each arrow is a database function or a scheduled job; "
          "no state can be changed by writing to the table directly.")

    doc.h(3, "Check-in and Location Verification")
    doc.p("When a team is called, each member opens the court page and allows the browser to read the location. The browser "
          "sends the latitude, longitude, and accuracy to a Server Action, which passes them to the database. The database "
          "computes the haversine distance to the court [7] and accepts the reading if the distance plus the reported "
          "accuracy is within the court's radius (`courts.location_radius_metres`). A verification lasts 30 minutes. The "
          "team leader can confirm the team ready only when every member holds a valid verification, and the game starts "
          "when both teams are ready. A winning team that holds the court does not check in again.")

    doc.h(3, "Game Flow and Score Validation")
    doc.p("Either team leader can request the end of a game; the other leader can reject the request if the game is not "
          "over. Each leader then submits the points of every player of their own team. When both submissions are in, the "
          "database validates the result: a tie, a result in which neither team reached the target, or one in which both did "
          "is rejected, and both teams must submit again. A valid result records each player's points, updates the winner's "
          "streak, and moves both teams to their post-game decision (Figure 3.4).")
    doc.p("The field test showed that a game could block a court indefinitely if a leader left without submitting scores. "
          "Three safeguards were added. Both teams must submit valid scores within 5 minutes of the end request, after which "
          "the game ends without a result, nothing is recorded, and the court is released. Administrators can cancel a stuck "
          "game or decide its final score. A captain can name one member as *game delegate*, who may perform the captain's "
          "game actions but not manage the team.")
    fig(doc, IMG + "game-states.png", "Game states from the end request to the result", 80)

    doc.h(3, "Maintenance Workflow")
    doc.p("A player reports damaged equipment by choosing the court and the problem type (court surface, backboard or hoop, "
          "lighting, or other), describing the problem, and optionally attaching a photo of up to 5 MB. Photos are stored in "
          "a private bucket; only the reporter and administrators can open them. To avoid duplicate reports, only one report "
          "per court and problem type can be open at a time; a player who tries to report the same problem is told it is "
          "already being handled.")
    doc.p("Administrators move each report through the statuses *new*, *accepted*, *waiting for the caretaker*, and "
          "*resolved*, or *rejected* for spam. Following the facility's practice, the system never contacts the caretaker: "
          "administrators telephone the caretaker and record it by setting the status. Every change is stored with its time, "
          "author, and note. Accepted reports appear on a public status board and on the affected court's page, without the "
          "reporter's identity or photo. The proposal envisaged suspending a court's queue automatically when a report is "
          "filed; this was not adopted, because an unverified report could then close a court. Administrators close a court "
          "manually when the damage requires it.")
    fig(doc, IMG + "maintenance-flow.png", "Maintenance report statuses and notifications", 70)
    doc.p("A statistics page reports, for a chosen period, the number of reports, those still open, the median and mean time "
          "to the first response and to resolution, and breakdowns by court, problem type, and status. These figures are the "
          "source of KPI-4.")

    doc.h(3, "Notifications")
    doc.p("Table 3.5 lists the notifications. After the field test, queue messages were limited to team leaders, because "
          "messages to every member were found noisy, and game-result messages were removed in favour of the result page.")
    doc.table("LINE notifications", ["Event", "Recipient", "Expires after"], [
        ["Team becomes next in line", "Team leaders", "30 minutes"],
        ["Team called to check in", "Team leaders", "Check-in deadline"],
        ["End of game requested", "Leaders of both teams", "Score deadline"],
        ["Game ended without a result", "Team leaders", "2 hours"],
        ["Invitation to a team", "Invitee", "24 hours"],
        ["New maintenance report", "Every administrator", "24 hours"],
        ["Report waiting for the caretaker longer than 2 days", "Every administrator, once a day at 09:00", "12 hours"],
        ["Report status changed", "Reporter", "24 hours"],
    ], [5, 4, 2.5])
    doc.p("Delivery follows the transactional outbox pattern [9] (Figure 3.6). A database trigger writes each message to "
          "`line_notifications` in the same transaction as the event, with a unique key that prevents the same event from "
          "producing two messages. A dispatcher, which holds the LINE access token and runs only on the server, claims "
          "pending messages and pushes each to LINE with the message's identifier as the retry key, so a retried request is "
          "not delivered twice. Temporary failures are retried up to three times; messages past their expiry are never sent, "
          "so that enabling LINE late does not deliver stale calls; and messages for users without a LINE identity are "
          "skipped. The dispatcher runs immediately after the user action that caused the message and, for events caused by "
          "the scheduler, every minute through pg_cron and pg_net, authenticated by a secret stored in Vault.")
    fig(doc, IMG + "line-notification-flow.png", "Sequence of a LINE notification from the event to delivery")
    doc.p("LINE delivers pushes only to users who have added the Official Account as a friend [16]. MeQ therefore asks users "
          "to add it during sign-in, repeats the invitation in a welcome guide shown on the first visit, and offers an "
          "add-friend button on the profile page that opens LINE directly on a phone and shows a QR code on a computer.")

    doc.h(3, "Database Design")
    doc.p("The schema was built through {{37}} migrations. Table 3.6 lists the core tables, and Figures 3.7 and 3.8 show their relationships; "
          "Appendix A describes them in detail.")
    doc.table("Core tables", ["Table", "Role"], [
        ["profiles", "One row per user, with display name, avatar, role, and onboarding state"],
        ["teams, team_memberships, team_invitations", "Teams, their current and past members, and pending invitations"],
        ["courts, court_groups, daily_score_settings", "Courts, the group shared by the two 3x3 courts, and target scores"],
        ["queue_entries, active_queue_players", "Queue entries per court, and the lock that keeps a player in one queue"],
        ["location_verifications, team_check_ins", "Expiring location checks and the check-in of each called team"],
        ["games, game_roster_snapshots, player_scores, score_submissions", "Games, frozen rosters, submitted points, and submissions"],
        ["player_game_history", "One row per player per completed game, the source of statistics"],
        ["maintenance_reports, maintenance_status_history, maintenance_active_issues", "Reports, their history, and the one-open-report lock"],
        ["line_notifications", "The notification outbox"],
        ["court_events, queue_settings, audit_logs", "Closures, adjustable durations, and an audit trail"],
    ], [5, 7])
    fig(doc, IMG + "er-queue.png", "Entity-relationship diagram of teams, queues, and games")
    fig(doc, IMG + "er-maintenance.png", "Entity-relationship diagram of maintenance reports and notifications", 80)

    doc.h(3, "Access Control and Data Protection")
    doc.p("Row Level Security is enabled on every table [6]. Users may read what the interface shows them, such as queues, "
          "teams, and public reports, but they cannot write to any lifecycle table; every change goes through a function that "
          "checks the caller. Administrators are users whose profile role is *ADMIN*, and every administrator function checks "
          "the role again. Players never handle the service key: it exists only on the server, where the dispatcher uses it.")
    doc.p("In line with Thailand's Personal Data Protection Act [26], the system stores only what it needs: the LINE display "
          "name, avatar, and user ID; team and game records; and, for check-in, the distance to the court rather than the "
          "coordinates. Maintenance photos are private, and the public status board omits the reporter. Privacy and terms "
          "pages describe these practices to users.")

    doc.h(3, "Interface Design")
    doc.p("The interface is Thai by default with an English option, and is designed for phones. Figures 3.9 to 3.14 show the "
          "main pages; Appendix B gives a step-by-step guide.")
    fig(doc, SHOT + "login.png", "The sign-in page", 45)
    fig(doc, SHOT + "home.png", "The home page with the status of every court", 45)
    fig(doc, SHOT + "court-queue.png", "A court page with the current game and the queue", 45)
    fig(doc, SHOT + "check-in.png", "Check-in of a called team with each member's location status", 45)
    fig(doc, SHOT + "maintenance-form.png", "The maintenance reporting form", 45)
    fig(doc, SHOT + "admin-maintenance.png", "The administrator's maintenance page with the 30-day summary", 90)

    doc.h(2, "Testing")
    doc.h(3, "Evaluation Framework")
    doc.p("The criteria of the evaluation were fixed on {{15 October 2026}}, before the summative measurement, so that the "
          "results could not influence the criteria by which they are judged (Table 3.7). Apart from the SUS benchmark of 68 "
          "[23], the thresholds are practical targets set by the author.")
    doc.table("Evaluation design and its alignment with the research questions", ["KPI", "RQ / hypothesis", "Instrument", "Pass threshold"], [
        ["KPI-1 Queue integrity under load", "RQ1 / H1", "Load script with 50 virtual users; invariant queries", "0 rule violations in 3 runs"],
        ["KPI-2 Rule conformance", "RQ1 / H1", "pgTAP database tests; unit tests", "All tests pass"],
        ["KPI-3 Notification timeliness", "RQ2 / H2", "line_notifications records", "≥ 95% sent within 60 s; no duplicates"],
        ["KPI-4 Maintenance response", "RQ3 / H3", "Maintenance statistics", "Median first response ≤ 12 h"],
        ["KPI-5 Responsiveness under load", "RQ4 / H4", "k6 with 50 virtual users [24]", "p95 < 2 s and < 1% failed"],
        ["KPI-6 Usability", "RQ4 / H4", "System Usability Scale [22]", "Mean ≥ 68"],
        ["KPI-7 Security", "supporting", "Privilege tests; OWASP Top 10 [25]; ZAP baseline", "All privilege tests pass; no High finding"],
    ], [3.2, 2.4, 3.8, 3])
    doc.h(3, "Evaluation Objects and Participants")
    doc.lead("Automated tests (KPI-2).", "Thirteen pgTAP files that exercise the database functions as different users, and "
             "seven unit-test suites for the rules in TypeScript.")
    doc.lead("Load test environment (KPI-1, KPI-5).", "{{A separate Supabase project or the local Supabase stack with 50 test "
             "accounts in teams of 3 and 5, so that production data are not affected.}}")
    doc.lead("Field evaluation (KPI-3, KPI-4, KPI-6).", "{{Number}} players recruited at the courts by convenience sampling "
             "over {{period}}, using the deployed system on their own phones.")
    doc.h(3, "Instruments")
    doc.lead("Invariant queries (KPI-1).", "SQL queries run after each load run that count teams or players in more than one "
                                           "active queue, duplicate or missing positions, and positions out of joining order.")
    doc.lead("k6 load script (KPI-1, KPI-5).", "Drives a fixed journey: sign in, open the court page, join a queue, refresh "
                                              "the queue page as the live refresh does, and leave. {{Final journey to be fixed before the run.}}")
    doc.lead("Outbox records (KPI-3).", "The creation and delivery time, status, and attempts of every notification.")
    doc.lead("Maintenance statistics (KPI-4).", "The statistics page of Section 3.2.7, computed from the status history.")
    doc.lead("System Usability Scale (KPI-6).", "The standard ten-item questionnaire [22], administered in Thai {{(Appendix C)}}.")
    doc.lead("Security instruments (KPI-7).", "The privilege tests in `security_privileges.sql` and the role checks in the "
                                              "other test files; an OWASP Top 10 matrix [25]; and {{an OWASP ZAP baseline scan}}.")
    doc.h(3, "Data Collection Procedures")
    doc.p("{{Describe, after the evaluation: the dates, the number of runs, how participants were briefed and consented, "
          "the tasks they performed before the SUS questionnaire, and how the records were exported.}}")
    doc.h(3, "Data Analysis")
    doc.p("All KPIs are criterion-referenced: a hypothesis is supported only if every criterion of its KPIs is met. For "
          "KPI-3, the delay of each notification is its delivery time minus its creation time, and the share delivered within "
          "60 seconds is computed over all notifications sent during the evaluation. For KPI-4, the median is used because a "
          "few reports filed at night would distort a mean. For KPI-5, the 95th percentile captures the slowest requests "
          "that users experience. For KPI-6, responses are scored by the standard procedure [22], and the mean, standard "
          "deviation, and 95% confidence interval are reported.")


# =====================================================================
def chapter4(doc):
    doc.chapter_heading("Results and Discussion")
    doc.h(2, "Results")
    doc.h(3, "Summary of Results")
    doc.table("Results for the seven KPIs", ["KPI", "Pass threshold", "Result", "Verdict"], [
        ["KPI-1 Queue integrity", "0 violations", "{{ }}", "{{ }}"],
        ["KPI-2 Rule conformance", "All tests pass", "98 of 98 database tests; 30 of 30 unit tests", "Pass"],
        ["KPI-3 Notification timeliness", "≥ 95% within 60 s", "{{ }}", "{{ }}"],
        ["KPI-4 Maintenance response", "Median ≤ 12 h", "{{ }}", "{{ }}"],
        ["KPI-5 Responsiveness", "p95 < 2 s; < 1% failed", "{{ }}", "{{ }}"],
        ["KPI-6 Usability", "Mean SUS ≥ 68", "{{ }}", "{{ }}"],
        ["KPI-7 Security", "Privilege tests pass; no High finding", "40 of 40 privilege tests; {{ZAP}}", "{{ }}"],
    ], [3, 3, 4, 1.5])

    doc.h(3, "Formative Field Test")
    doc.p("Before the summative evaluation, six players used the deployed system on their own phones at the courts on "
          "12 October 2026, playing several 3x3 games through the full cycle of queuing, check-in, scoring, and rotation. The "
          "database confirmed that the statistics of every completed game had been recorded. The session exposed the defects "
          "in Table 4.2, each of which was corrected and covered by a new test before the next round.")
    doc.table("Defects found in the field test and their corrections", ["Observation", "Cause", "Correction"], [
        ["A team that requeued after losing was never called again, and no court advanced", "The second check-in of the same queue entry violated a unique key, and the failed scheduler run rolled back every court",
         "Uniqueness only among open check-ins; each court advanced in its own sub-transaction"],
        ["The winning captain did not see the option to continue", "The game page did not move to the result when the game ended", "The page follows the game to its result automatically"],
        ["Scores could be resubmitted by one team alone after a rejection", "Only the resubmitting team was checked", "Both teams must submit again"],
        ["A winning team that continued could never leave the queue", "No transition from holding the court", "Holders may leave; a waiting challenger returns to the head"],
        ["A team that won twice was not made to rest", "The rest was released before the loser decided", "The resting team waits for the loser's decision"],
        ["Members verified as present were refused at confirmation", "Two different radii (300 m and 50 m)", "One radius per court for both checks"],
        ["Location checks expired during a long wait", "Verification lasted 10 minutes", "30 minutes"],
        ["LINE messages to every member were noisy", "All members were notified", "Only team leaders are notified"],
        ["A game could hold a court indefinitely", "No deadline for scores", "5-minute score deadline; administrator tools; game delegate"],
    ], [4, 4, 4])
    doc.p("The most serious defect, the first in Table 4.2, was diagnosed from the scheduler's own records "
          "(`cron.job_run_details`), which showed a duplicate-key failure seconds after the losing team requeued. It also "
          "showed that a single faulty court could stop every court, which is why each court now advances independently.")

    doc.h(3, "KPI-1: Queue Integrity Under Load")
    doc.p("{{Report the three runs: number of operations, rule violations found by the invariant queries (expected 0), and "
          "any errors. Add a table and, if useful, a figure.}}")
    doc.h(3, "KPI-2: Rule Conformance")
    doc.p("All 98 assertions in the thirteen database test files and all 30 unit tests passed on the final build (Table 4.3). "
          "The database tests run each function as specific users, including users who must be refused, so they verify the "
          "rules and the permissions together.")
    doc.table("Automated test results", ["Test file", "Area", "Assertions", "Result"], [
        ["security_privileges", "Grants, RLS, and function permissions", "40", "Pass"],
        ["winner_rotation", "Two-win limit, rest, and decisions", "14", "Pass"],
        ["team_location_status", "Location status of team members", "11", "Pass"],
        ["requeue_check_in", "Repeated check-ins after requeuing", "9", "Pass"],
        ["court_advance_safety", "Resting order, radius, per-court isolation", "8", "Pass"],
        ["location_verification", "Distance, accuracy, and expiry", "7", "Pass"],
        ["line_notifications", "Outbox, claiming, retry, and expiry", "3", "Pass"],
        ["Other six files", "Full 3x3 flow, queue, teams, invitations, maintenance, game safety", "6", "Pass"],
        ["Unit tests (7 suites)", "Rules, notifications, live refresh, statistics", "30", "Pass"],
    ], [3.2, 5, 1.9, 1.2])
    doc.h(3, "KPI-3: Notification Timeliness")
    doc.p("{{Report the number of notifications, the share delivered within 60 s, the median and maximum delay, and "
          "duplicates (expected 0). In the preliminary test of 11 October 2026, messages triggered by a user action were "
          "delivered on the first attempt, and a message created by the scheduler was delivered within the one-minute cycle.}}")
    doc.h(3, "KPI-4: Maintenance Response")
    doc.p("{{Report the number of reports, the median and mean time to the first response and to resolution, and include a "
          "screenshot of the statistics page.}}")
    fig(doc, SHOT + "admin-stats.png", "The maintenance statistics page", 90)
    doc.h(3, "KPI-5: Responsiveness Under Load")
    doc.p("{{Report p95 and the failure rate of each run, and a figure of response time per step.}}")
    doc.h(3, "KPI-6: Usability")
    doc.p("{{Report n, the mean SUS score, the standard deviation, and the 95% confidence interval, with a figure against the benchmark of 68.}}")
    doc.h(3, "KPI-7: Security")
    doc.p("All 40 privilege assertions passed: anonymous users cannot call any queue, game, or administrator function; "
          "signed-in users cannot write to lifecycle tables directly; only the service role can claim notifications; and "
          "administrator functions refuse other users. {{Add the OWASP Top 10 matrix and the ZAP baseline result.}}")

    doc.h(2, "Discussion")
    doc.h(3, "Rules in the Database, Not in the Interface")
    doc.p("The field test supports the central design decision while showing its cost. Because every rule lives in a "
          "transactional function, the defects found were defects of the rules themselves, not of one page bypassing them, "
          "and each correction applied to every page at once. The same centralization made a single failing court stop every "
          "court until each court was isolated in its own sub-transaction. Enforcement in the database is therefore "
          "necessary for a fair queue [2], [5], but a scheduler that serves several courts must also contain each court's "
          "failures. {{Relate to the KPI-1 result.}}")
    doc.h(3, "Notifications Turn an Uncertain Wait into a Known One")
    doc.p("Maister's observation that uncertain waits feel longer [3] motivated the notifications. The field test added a "
          "practical refinement: messages to every member were perceived as noise, and limiting them to team leaders kept "
          "the information while reducing interruptions. The outbox design ensured that no message was sent for a change that "
          "was rolled back and none was sent twice. {{Relate to KPI-3.}}")
    doc.h(3, "Maintenance Reporting at the Scale of One Facility")
    doc.p("{{Discuss KPI-4, the effect of merging duplicate reports, and the decision not to suspend queues automatically.}}")
    doc.h(3, "Practicality")
    doc.p("{{Discuss KPI-5 and KPI-6, and the choice of polling instead of WebSockets.}}")


# =====================================================================
def chapter5(doc):
    doc.chapter_heading("Conclusions")
    doc.h(2, "Conclusions")
    doc.p("This project designed, developed, and evaluated MeQ, a mobile web application that replaces word-of-mouth queuing "
          "at the basketball courts of Naresuan University and gives players a channel for reporting damaged equipment.")
    doc.lead("Objective 1: the queue.", "MeQ shows the queue of every court and enforces the court rules in the database. "
             "All automated rule tests passed, and the defects found in the field test were corrected and covered by tests. "
             "{{Conclusion on KPI-1 and H1.}}")
    doc.lead("Objective 2: presence.", "Check-in requires every member to be within the court's radius, computed on the "
             "server, before a team can play.")
    doc.lead("Objective 3: maintenance.", "Players report damage with a photo, duplicate reports are merged, and every "
             "status change is recorded. {{Conclusion on KPI-4 and H3.}}")
    doc.lead("Objective 4: notifications and evaluation.", "{{Conclusions on KPI-3, KPI-5, KPI-6, and KPI-7.}}")
    doc.h(2, "Limitations")
    doc.ol([
        "A falsified browser location cannot be detected; the radius check only confirms what the phone reports.",
        "Scores are entered by the teams; the system checks that they are consistent, not that they are true.",
        "Notifications reach only users who have added the LINE Official Account as a friend.",
        "The evaluation took place at one facility, on free-tier infrastructure, with a small convenience sample.",
        "The author built and evaluated the system with AI assistance; automated tests and fixed criteria reduce, but do not remove, this bias.",
    ])
    doc.h(2, "Recommendations")
    doc.h(3, "Recommendations for Practice")
    doc.ol([
        "Developers of shared queues should enforce every rule in a database transaction and test it as each kind of user, including users who must be refused.",
        "A scheduler that advances several resources should isolate each one, so that one failure does not stop the others.",
        "Notifications should be stored with the change that causes them, carry an expiry, and be sent idempotently.",
        "Field tests with real users on real devices should precede the summative evaluation; most defects in this project were found that way.",
    ])
    doc.h(3, "Recommendations for Future Research")
    doc.ol([
        "Extend MeQ to other free facilities of the university, such as futsal and volleyball courts, with their own rules.",
        "Compare server polling with real-time subscriptions for queues with shorter turns.",
        "Study whether a visible, enforced queue reduces disputes, for example by observing the courts before and after deployment.",
        "Add stronger presence checks, such as a QR code displayed at the court, where location alone is insufficient.",
    ])


# =====================================================================
REFS = [
    "Division of Student Affairs, Naresuan University, “Sport NU: Sports facility services.” [Online]. Available: https://sa.nu.ac.th/ (accessed Feb. 28, 2026).",
    "R. C. Larson, “Perspectives on queues: Social justice and the psychology of queueing,” *Operations Research*, vol. 35, no. 6, pp. 895–905, 1987.",
    "D. H. Maister, “The psychology of waiting lines,” in *The Service Encounter*, J. A. Czepiel, M. R. Solomon, and C. F. Surprenant, Eds. Lexington, MA, USA: Lexington Books, 1985, pp. 113–123.",
    "A. R. Hevner, S. T. March, J. Park, and S. Ram, “Design science in information systems research,” *MIS Quarterly*, vol. 28, no. 1, pp. 75–105, 2004.",
    "H. Berenson, P. Bernstein, J. Gray, J. Melton, E. O’Neil, and P. O’Neil, “A critique of ANSI SQL isolation levels,” in *Proc. ACM SIGMOD Int. Conf. Management of Data*, 1995, pp. 1–10.",
    "The PostgreSQL Global Development Group, “Row security policies,” PostgreSQL Documentation. [Online]. Available: https://www.postgresql.org/docs/current/ddl-rowsecurity.html (accessed Oct. 15, 2026).",
    "R. W. Sinnott, “Virtues of the haversine,” *Sky and Telescope*, vol. 68, no. 2, p. 159, 1984.",
    "W3C, “Geolocation,” W3C Recommendation. [Online]. Available: https://www.w3.org/TR/geolocation/ (accessed Oct. 15, 2026).",
    "C. Richardson, *Microservices Patterns: With Examples in Java*. Shelter Island, NY, USA: Manning, 2018.",
    "G. Hohpe and B. Woolf, *Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions*. Boston, MA, USA: Addison-Wesley, 2004.",
    "Vercel, “Next.js documentation.” [Online]. Available: https://nextjs.org/docs (accessed Oct. 15, 2026).",
    "Meta Platforms, Inc., “React: The library for web and native user interfaces.” [Online]. Available: https://react.dev/ (accessed Oct. 15, 2026).",
    "Supabase Inc., “Supabase documentation.” [Online]. Available: https://supabase.com/docs (accessed Oct. 15, 2026).",
    "Citus Data, “pg_cron: Run periodic jobs in PostgreSQL.” [Online]. Available: https://github.com/citusdata/pg_cron (accessed Oct. 15, 2026).",
    "LY Corporation, “LINE Login documentation,” LINE Developers. [Online]. Available: https://developers.line.biz/en/docs/line-login/ (accessed Oct. 15, 2026).",
    "LY Corporation, “Messaging API documentation,” LINE Developers. [Online]. Available: https://developers.line.biz/en/docs/messaging-api/ (accessed Oct. 15, 2026).",
    "N. Sakimura, J. Bradley, M. Jones, B. de Medeiros, and C. Mortimore, “OpenID Connect Core 1.0,” OpenID Foundation, 2014. [Online]. Available: https://openid.net/specs/openid-connect-core-1_0.html",
    "HoopMaps, “HoopMaps: The app for pickup basketball.” [Online]. Available: https://www.hoopmaps.com/ (accessed Feb. 28, 2026).",
    "{{QueQ, “QueQ: Queue reservation application.” [Online]. Available: https://www.queq.me/ (accessed: verify URL and date).}}",
    "{{National Electronics and Computer Technology Center (NECTEC), “Traffy Fondue.” [Online]. Available: https://www.traffy.in.th/ (accessed: verify URL and date).}}",
    "mySociety, “FixMyStreet.” [Online]. Available: https://www.fixmystreet.com/ (accessed Oct. 15, 2026).",
    "J. Brooke, “SUS: A ‘quick and dirty’ usability scale,” in *Usability Evaluation in Industry*, P. W. Jordan, B. Thomas, B. A. Weerdmeester, and I. L. McClelland, Eds. London, U.K.: Taylor & Francis, 1996, pp. 189–194.",
    "J. Sauro and J. R. Lewis, *Quantifying the User Experience: Practical Statistics for User Research*, 2nd ed. Cambridge, MA, USA: Morgan Kaufmann, 2016.",
    "Grafana Labs, “Grafana k6 documentation.” [Online]. Available: https://grafana.com/docs/k6/latest/ (accessed Oct. 15, 2026).",
    "OWASP Foundation, “OWASP Top 10:2021,” 2021. [Online]. Available: https://owasp.org/Top10/",
    "“Personal Data Protection Act, B.E. 2562 (2019),” *Royal Thai Government Gazette*, vol. 136, part 69 Kor, May 27, 2019.",
    "L. Wroblewski, *Mobile First*. New York, NY, USA: A Book Apart, 2011.",
]


def references(doc):
    doc.plain_heading("References")
    for i, ref in enumerate(REFS, 1):
        doc.reference(i, ref)


def appendices(doc):
    doc.page_break()
    doc.plain_heading("Appendix")
    doc.page_break()
    doc.plain_heading("Appendix A: Database Schema", appendix="A")
    doc.p("This appendix summarizes the tables of the public schema as defined by the migrations in "
          "`supabase/migrations/`. {{Expand with column tables for the core tables if the committee requires it.}}")
    doc.table("Status values used by the queue, games, and maintenance", ["Type", "Values"], [
        ["queue_status", "WAITING, CALLED, CHECKING_IN, READY_TO_PLAY, PLAYING, DECIDING_CONTINUE, HOLDING_COURT, DECIDING_REQUEUE, AWAITING_SCORE, RESTING, RETURNING_CHAMPION, MISSED_QUEUE, CANCELLED, LEFT_QUEUE"],
        ["game_status", "PLAYING, END_REQUESTED, AWAITING_SCORE, VALIDATING_RESULT, COMPLETED, INVALID_SCORE, CANCELLED"],
        ["check_in_status", "ACTIVE, READY, CLOSED, EXPIRED"],
        ["maintenance_status", "NEW, IN_PROGRESS, WAITING_FOR_CARETAKER, RESOLVED, REJECTED"],
        ["maintenance_category", "SURFACE, HOOP, LIGHTING, OTHER"],
        ["line_notifications.status", "PENDING, SENDING, SENT, FAILED, EXPIRED, SKIPPED"],
    ], [2.5, 9])
    doc.page_break()
    doc.plain_heading("Appendix B: User Guide", appendix="B")
    doc.p("This guide walks a player through MeQ in the order of use. {{Number the steps on each screenshot.}}")
    for shot, cap, steps in [
        ("welcome-guide.png", "The welcome guide shown after the first sign-in",
         ["Choose Sign in with LINE and allow MeQ in LINE.", "Add MeQ as a friend when LINE asks, so that you are notified when your team is called.", "Read the four steps in the welcome guide and choose Start."]),
        ("team.png", "A team page with members and the game delegate",
         ["Open Teams and create a team (3x3 or 5x5), or accept an invitation.", "As captain, invite members until the roster is full.", "Optionally choose a game delegate who can act for you in games."]),
        ("court-queue.png", "Joining the queue of a court",
         ["Open Courts and choose a court.", "As captain or delegate, choose Join queue. Your position appears in the list."]),
        ("check-in.png", "Check-in after the team is called",
         ["When LINE tells you that your team is called, open the court page.", "Every member allows location access so that MeQ can confirm they are at the court.", "The captain or delegate confirms the team ready before the deadline."]),
        ("scores.png", "Submitting the points of your team",
         ["After the game, a leader chooses End game.", "Each team enters the points of its own players within 5 minutes."]),
        ("result.png", "The result and the decision to continue or requeue",
         ["The winner chooses to continue or leave; the loser chooses to requeue or leave, within 3 minutes."]),
        ("maintenance-form.png", "Reporting damaged equipment",
         ["Open Maintenance, choose the court and the problem type, describe it, attach a photo, and send.", "Follow the status of your report under My reports; LINE tells you when it changes."]),
        ("line-chat.png", "A LINE notification from MeQ", []),
    ]:
        if steps:
            doc.ol(steps)
        fig(doc, SHOT + shot, cap, 45)
    doc.page_break()
    doc.plain_heading("Appendix C: SUS Questionnaire", appendix="C")
    doc.p("{{Insert the Thai SUS questionnaire as administered, and the consent statement.}}")
