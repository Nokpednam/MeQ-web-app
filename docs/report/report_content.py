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

    doc.plain_heading("Abstract", new_page=True)
    doc.p("Walk-in players at the basketball courts of Naresuan University queue by word of mouth, so newcomers cannot "
          "tell whose turn is next and disputes are common. Damaged equipment also reaches the staff late, because there is "
          "no channel for reporting it. This project designed, developed, and evaluated MeQ, a mobile web application for "
          "queuing at three courts (3x3 A, 3x3 B, and 5x5) and for reporting damaged equipment. The queue rules, such as "
          "full rosters, one queue per player, a check-in deadline, and a limit of two consecutive wins, are enforced by "
          "transactional functions in PostgreSQL, and scheduled jobs advance each court without an administrator. A team "
          "checks in by sharing each member's location, and the server computes the distance to the court. Players report "
          "damage with a photo, and administrators record each step of the repair. LINE notifications tell team leaders "
          "when their turn comes and tell reporters and administrators about each report. The system was built with "
          "Next.js and Supabase.")
    doc.p("MeQ was evaluated against seven key performance indicators whose thresholds were fixed before measurement. All "
          "115 database tests and 32 unit tests passed. Field tests and a review found eleven defects, which were corrected "
          "and covered by new tests. With 50 simultaneous users, no queue rule was violated in six runs, and pages answered "
          "within 0.1 seconds at the 95th percentile. All 15 LINE notifications of the field evaluation arrived within a "
          "minute, the maintenance workflow passed every step of a scripted scenario, and a security scan found no "
          "High-risk alert. Thirteen players rated the usability at a mean System Usability Scale score of 67.5 (95% "
          "confidence interval 59.4–75.6), just below the benchmark of 68, and their answers show that the first use "
          "needs to be easier.")
    doc.page_break()

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
    doc.p("Naresuan University provides covered basketball courts that students and members of the public may use free of "
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
    doc.pni("**RQ3 (Maintenance).** Does the reporting module carry every report from the player to the administrator and back through each status, with every step recorded and notified?")
    doc.pni("**RQ4 (Practicality).** Does the system respond quickly enough on phones under the expected evening load, and do players find it usable?")
    doc.h(3, "Research Hypotheses")
    doc.p("Each research question is tested against a hypothesis with a threshold fixed before measurement (Section 3.3.1):")
    doc.pni("**H1 (RQ1).** With 50 concurrent virtual users joining and leaving queues, no run produces a rule violation "
            "(a team or player in two active queues, a duplicate or missing queue position, or an order that differs from the "
            "joining order), and every automated rule test passes.")
    doc.pni("**H2 (RQ2).** In use on the deployed system, at least 95% of LINE notifications are delivered within 60 seconds "
            "of the event that caused them, and no message is delivered twice.")
    doc.pni("**H3 (RQ3).** In a scripted scenario covering every status, every step behaves as specified: the administrator is notified of each new report and the reporter of each status change within 60 seconds, a second active report of the same problem is refused, and every status change is recorded in the history.")
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
    doc.p("Development took place from April to October 2026. A formative field test with six players on real "
          "phones was held on 12 October 2026 and a second on 16 October 2026. The summative evaluation took place in October 2026, "
          "with the field evaluation on 17 October 2026.")
    doc.h(3, "Conceptual Framework")
    fig(doc, IMG + "conceptual-framework.png", "Conceptual framework of the project", 62)
    doc.p("Figure 1.2 relates the components of MeQ to the outcomes evaluated. The queue rules and the location check "
          "determine whether the queue stays correct (KPI-1, KPI-2); the notification outbox determines whether team leaders "
          "learn of their turn in time (KPI-3); the maintenance workflow determines whether reports reach the administrator "
          "and are traced to resolution (KPI-4); and the system as a whole is measured for performance under load (KPI-5), usability (KPI-6), and "
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
        ["1", "Requirement analysis and system design", "Apr–May 2026"],
        ["2", "Database, queue rules, and team management", "May–Aug 2026"],
        ["3", "Check-in, game flow, and statistics", "Aug 2026"],
        ["4", "Maintenance module and LINE notifications", "Sep–Oct 2026"],
        ["5", "Field tests and corrections", "12–16 Oct 2026"],
        ["6", "Summative evaluation (KPI-1 to KPI-7)", "Oct 2026"],
        ["7", "Analysis and report preparation", "Oct 2026"],
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
          "computes the distance to the court, adds the reported accuracy, accepts the reading only if the sum is within the "
          "court's radius, and stores an expiring verification.")
    doc.pni("**Reliable Notification Delivery**")
    doc.p("Sending a message to an external service inside a database transaction is unreliable: the transaction may roll "
          "back after the message is sent, or the service may fail after the data are committed. The transactional outbox "
          "pattern stores the message in the same transaction as the change that causes it, and a separate relay sends "
          "stored messages afterwards and records the result [9]. Messaging practice adds two properties: a receiver should "
          "tolerate the same message arriving twice (idempotency), and messages that cannot be delivered should be set aside "
          "rather than retried forever [10]. MeQ applies these ideas to LINE notifications (Section 3.2.8).")
    doc.pni("**Usability Measurement**")
    doc.p("For a new system without an established user base, a standardized questionnaire is the practical way to "
          "measure usability. The ten-item System Usability Scale (SUS) yields a score from 0 to 100 [22]; it has high "
          "internal-consistency reliability, with a coefficient alpha of about 0.9, and a mean of 68 is the usual benchmark "
          "of average usability [23]. Because the scale is short, it can be answered at the court right after a game.")
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
          "(Chapter 4). Correctness is evaluated by functional testing against expected outcomes; timeliness by observation "
          "of the system in use; the maintenance workflow by a scripted scenario; performance by a load test; usability by "
          "a standardized questionnaire; and security by privilege tests and a vulnerability scan.")
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
    doc.p("Table 3.1 lists the tools with the versions used for the evaluation in October 2026. Standards are cited in "
          "their current editions: the OWASP Top 10:2025 [25] and the Personal Data Protection Act B.E. 2562 (2019), in "
          "full force since 1 June 2022 [26].")
    doc.table("Development and evaluation tools", ["Layer", "Tool", "Use"], [
        ["Frontend", "Next.js 16.3.8 (App Router), React 19.2.8, TypeScript 5.9 (strict)", "Server-rendered pages and Server Actions"],
        ["Hosting", "Vercel (Hobby), Singapore region", "Web application and the notification endpoint"],
        ["Backend", "Supabase (Free): PostgreSQL, Auth, Storage, pg_cron, pg_net, Vault", "Data, rules, sign-in, photos, scheduled jobs"],
        ["Messaging", "LINE Login (OpenID Connect), LINE Messaging API", "Sign-in and push notifications"],
        ["Testing", "pgTAP via Supabase CLI 2.113; PostgreSQL 17 (local stack); Node.js 24 test runner; GitHub Actions", "Database rule tests, unit tests, CI"],
        ["Evaluation", "k6 2.3.0; Lighthouse 13.5.0; OWASP ZAP 2.17.0; npm audit; OWASP Top 10:2025; SUS questionnaire in Google Forms", "KPI-1, KPI-5, KPI-6, KPI-7"],
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
        ["Traceability", "Every report reaches the administrator, and every status change is recorded and notified", "KPI-4"],
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
    fig(doc, IMG + "queue-entry-states.png", "States of a team's queue entry", 78)
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
    doc.p("A game could block a court indefinitely if a leader left without submitting scores. "
          "Three safeguards were added. Both teams must submit valid scores within 5 minutes of the end request, after which "
          "the game ends without a result, nothing is recorded, and the court is released. Administrators can cancel a stuck "
          "game or decide its final score. A captain can name one member as *game delegate*, who may perform the captain's "
          "game actions but not manage the team.")
    fig(doc, IMG + "game-states.png", "Game states from the end request to the result", 58)

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
    fig(doc, IMG + "maintenance-flow.png", "Maintenance report statuses and notifications", 40)
    doc.p("A statistics page reports, for a chosen period, the number of reports, those still open, the median and mean time "
          "to the first response and to resolution, and breakdowns by court, problem type, and status. Real faults cannot be "
          "scheduled, so these figures serve the long-term monitoring of the courts, while the evaluation tests the workflow "
          "itself (KPI-4).")

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
    doc.p("The schema was built through 39 migrations. Table 3.6 lists the core tables, and Figures 3.7 and 3.8 show their relationships; "
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
    fig(doc, IMG + "er-queue.png", "Entity-relationship diagram of teams, queues, and games", 85)
    fig(doc, IMG + "er-maintenance.png", "Entity-relationship diagram of maintenance reports and notifications", 72)

    doc.h(3, "Access Control and Data Protection")
    doc.p("Row Level Security is enabled on every table [6]. Users may read what the interface shows them, such as queues, "
          "teams, and public reports, but they cannot write to any lifecycle table; every change goes through a function that "
          "checks the caller. Administrators are users whose profile role is *ADMIN*, and every administrator function checks "
          "the role again. Players never handle the service key: it exists only on the server, where the dispatcher uses it.")
    doc.p("In line with Thailand's Personal Data Protection Act (PDPA) [26], the system stores only what it needs: the LINE "
          "display name, avatar, and user ID; team and game records; and, for check-in, the distance to the court rather "
          "than the coordinates. Maintenance photos are private, and the public status board omits the reporter. Privacy "
          "and terms pages describe these practices to users. Table 3.7 checks the system against the main duties of a data "
          "controller under the PDPA; it is a self-assessment by the author, not a legal review, and it lists the gaps that "
          "remain.")
    doc.table("Personal data protection checklist against the PDPA [26]", ["Duty", "What MeQ does", "Remaining gap"], [
        ["Notice of collection and purpose", "A privacy page lists each kind of data, its source, its purpose, and who can see it; it is linked from the sign-in and profile pages; it was corrected on 16 October 2026 to state the 30-minute expiry of a location check",
         "—"],
        ["Lawful basis and consent", "Data are used to provide the service the player signs in for; LINE messages are sent only after the player adds the Official Account as a friend; evaluation participants give explicit consent in the questionnaire",
         "No separate consent step at sign-in"],
        ["Data minimization", "LINE Login requests only the `openid` and `profile` scopes, so no e-mail or phone number is collected; check-in stores the distance, not the coordinates; the public board omits the reporter",
         "—"],
        ["Retention", "A new location check replaces the previous one and each expires after 30 minutes; undelivered notifications expire",
         "No automatic deletion of old notifications, audit logs, reports, or photos"],
        ["Security", "Row-level security on every table, a private photo bucket, HTTPS with security headers, and a service key kept on the server (KPI-7)",
         "—"],
        ["Processors", "Supabase (database, sign-in, photos), Vercel (hosting), and LINE (sign-in, messages) are named in the privacy page",
         "Relies on the providers' standard terms; no separate agreements"],
        ["Rights of the data subject", "Players can ask through the LINE Official Account to see, correct, or delete their account data; results that involve other players may be kept for their statistics",
         "No self-service deletion; requests are handled manually"],
        ["Breach notification", "Audit logs record changes, and the hosting providers keep their own request logs",
         "No written procedure for reporting a breach to the authority and to users"],
    ], [2.6, 5.4, 3.6])

    doc.h(3, "Interface Design")
    doc.p("The interface is Thai by default with an English option, and is designed for phones. Figures 3.9 and 3.10 show "
          "the main pages; Appendix B gives a step-by-step guide.")
    fig(doc, IMG + "ui-player-pages.png", "Pages for players: (a) sign-in; (b) the home page with the status of every court; "
        "(c) a court page with its opening hours, target score, and queue", 92)
    fig(doc, IMG + "ui-checkin-maintenance.png", "(a) Check-in of the two called teams, with the deadline and the captain's "
        "ready button; (b) the maintenance reporting form; (c) the administrator's maintenance page with a report, its "
        "photo, and the status control", 92)

    doc.h(2, "Testing")
    doc.h(3, "Evaluation Framework")
    doc.p("The criteria of the evaluation were fixed on 15 October 2026, before the summative measurement, so that the "
          "results could not influence the criteria by which they are judged (Table 3.8), and they were committed to the "
          "project's version control on that day. Apart from the SUS benchmark of 68 [23], the thresholds are practical "
          "targets set by the author. Two criteria changed afterwards. KPI-4 "
          "first required a median time to the administrator's first response of 12 hours or less; because real faults "
          "cannot be scheduled, it was replaced on 15 October by the scripted scenario of Table 3.9 before the scenario was "
          "run. KPI-5 kept its threshold, and measurements on the deployed site were added to it on 16 October. KPI-3 is measured on the "
          "notifications of the field evaluation; the records of the preliminary and formative tests, created before the "
          "criteria were fixed and analysed afterwards, are reported alongside them.")
    doc.table("Evaluation design and its alignment with the research questions", ["KPI", "RQ / hypothesis", "Instrument", "Pass threshold"], [
        ["KPI-1 Queue integrity under load", "RQ1 / H1", "Load script with 50 virtual users; invariant queries", "0 rule violations in 3 runs"],
        ["KPI-2 Rule conformance", "RQ1 / H1", "pgTAP database tests; unit tests", "All tests pass"],
        ["KPI-3 Notification timeliness", "RQ2 / H2", "line_notifications records", "≥ 95% sent within 60 s; no duplicates"],
        ["KPI-4 Maintenance workflow", "RQ3 / H3", "Scripted scenario; status history; outbox records", "Every step as specified; notifications within 60 s"],
        ["KPI-5 Responsiveness under load", "RQ4 / H4", "k6 with 50 virtual users [24]; k6 and Lighthouse [29] on the deployed site", "p95 < 2 s and < 1% failed"],
        ["KPI-6 Usability", "RQ4 / H4", "System Usability Scale [22]", "Mean ≥ 68"],
        ["KPI-7 Security", "supporting", "Privilege tests; OWASP Top 10 [25]; ZAP baseline", "All privilege tests pass; no High finding"],
    ], [3.2, 2.4, 3.8, 3])
    doc.h(3, "Evaluation Objects and Participants")
    doc.lead("Automated tests (KPI-2).", "Fifteen pgTAP files that exercise the database functions as different users, one "
             "of which reads the tables as a signed-in player and as an administrator, and seven unit-test suites "
             "for the rules in TypeScript.")
    doc.lead("Load test environment (KPI-1, KPI-5).", "The local Supabase stack, with all 37 migrations and its scheduled "
             "jobs, and a production build of the application, on one laptop (AMD Ryzen 7 7840HS, 8 cores, 16 GB RAM, "
             "Docker Desktop), so that production data were not affected. Fifty test accounts formed ten 3x3 teams and four "
             "5x5 teams, every member's location was recorded as verified, and the courts were opened all day.")
    doc.lead("Maintenance scenario (KPI-4).", "Five report attempts, each marked as a test in its description, filed on the "
             "deployed system at the 5x5 court, where no real report was open, by the author acting as player and as "
             "administrator on the author's own phone (Table 3.9).")
    doc.lead("Field evaluation (KPI-3, KPI-6).", "Thirteen players recruited at the court by convenience sampling on "
             "17 October 2026, using the deployed system on their own phones: twelve in four 3x3 teams, and one who tried "
             "every page but did not join a team.")
    doc.h(3, "Instruments")
    doc.lead("Invariant queries (KPI-1).", "Nine SQL queries run after each load run that count teams or players in more "
                                           "than one active queue, duplicate or missing positions of waiting teams, waiting "
                                           "teams out of joining order, more than two teams called on a court, player "
                                           "reservations that do not match the active entries, and teams on a court of the "
                                           "wrong format.")
    doc.lead("k6 load script (KPI-1, KPI-5).", "Fifty virtual users arrive over 30 seconds and stay for three minutes. Each "
                                              "of the 14 captains signs in, opens the court page, tries to join two queues "
                                              "at the same moment (the two 3x3 courts, or the 5x5 court twice), refreshes "
                                              "the court page every 10 seconds as the live refresh does, and leaves. The 36 "
                                              "members open their court page every 10 seconds. The scheduler of the "
                                              "database keeps calling teams during the run. Refusals by a queue rule are "
                                              "expected answers and are not counted as failed requests.")
    doc.lead("Deployed-site check (KPI-5).", "A k6 script in which three users, signed in with the author's session, "
                                             "open eleven pages of a player and an administrator for three minutes, "
                                             "reading only; and Lighthouse [29] in its default mobile settings on four of them.")
    doc.lead("Outbox records (KPI-3).", "The creation and delivery time, status, and attempts of every notification.")
    doc.lead("Maintenance scenario (KPI-4).", "The scripted steps in Table 3.9, with the status history and the outbox "
                                              "records of the test reports as evidence.")
    doc.table("Maintenance scenario of KPI-4", ["Step", "Action", "Expected behavior"], [
        ["S1", "File report R1 (surface, with photo)", "Report saved as NEW; administrator notified by LINE"],
        ["S2", "File R2 for the same court and problem while R1 is open", "Refused with the duplicate message; no report saved"],
        ["S3", "Move R1 to In progress, Waiting for caretaker, and Resolved", "Three history rows; reporter notified of each change"],
        ["S4", "File R3 for the same problem after R1 is resolved", "Accepted, because R1 is closed"],
        ["S5", "File R4 (hoop, without photo); reject it with a note", "Status REJECTED kept in history; reporter notified"],
        ["S6", "File R5 for the same problem as R4", "Accepted, because a rejection closes R4"],
        ["S7", "Reject R3 and R5 with the note “test data”", "Test reports closed; real reports unaffected"],
    ], [1, 5.5, 5.5])
    doc.lead("System Usability Scale (KPI-6).", "The standard ten-item questionnaire [22], administered in Thai through "
             "Google Forms (Appendix C). The Thai wording is the author's translation and was not separately validated, for "
             "example by item–objective congruence (IOC) review or back-translation (Section 5.2).")
    doc.lead("Security instruments (KPI-7).", "The privilege tests in `security_privileges.sql` and the role checks in the "
                                              "other test files; an OWASP Top 10 matrix [25]; `npm audit` of the production dependencies; and an OWASP ZAP baseline scan of the deployed site [28], which crawls "
                                              "the public pages and checks their responses without submitting forms.")
    doc.h(3, "Data Collection Procedures")
    doc.p("The load test was run in two sets of three runs on 16 October 2026: set A with k6 inside a Docker container "
          "and set B with the same k6 version running directly on the laptop. Set B was added after set A, to find the "
          "cause of its failed requests (Section 4.1.7); everything else, including the application build, was the same. "
          "Before each run the local database was reset and the "
          "accounts and teams were created again, so the runs are independent; after each run the invariant queries were "
          "executed and the k6 summary was exported. A first set of three runs exposed two errors in the instruments "
          "themselves: the script counted the empty success response of the leave function (HTTP 204) as a failure, and "
          "two invariant queries treated the cleared position of a called team, which the design intends, as a violation. "
          "Both were corrected and the runs of set A were repeated; the results below come from the repeated runs, and the "
          "discarded first attempt is kept with the evidence. The scripts and results are in `docs/report/evidence/load-test/`. "
          "The field evaluation was planned at the covered courts that MeQ serves, but on the day their floodlights were "
          "under maintenance, so no one came to play there. It was moved to the single outdoor court of the Faculty of "
          "Science, used for 3x3 games, and took place on 17 October 2026 from about 17:20 to 18:30; the court location "
          "in MeQ was set to that court for the session, and every team used the queue of 3x3 A. The players "
          "signed in with LINE, formed teams, and went through queuing, location check-in, play, and score submission as "
          "in normal use, with the author at the court. Afterwards each player received a link to the questionnaire, "
          "which opened with the consent statement (Appendix C); all thirteen respondents consented. Several players left "
          "before answering, so the responses arrived between 18:09 and 22:49 on the same day. The responses were exported "
          "from Google Forms as a CSV file and scored with the script in `docs/report/evidence/sus/`.")
    doc.h(3, "Data Analysis")
    doc.p("All KPIs are criterion-referenced: a hypothesis is supported only if every criterion of its KPIs is met. For "
          "KPI-3, the delay of each notification is its delivery time minus its creation time, and the share delivered within "
          "60 seconds is computed over all notifications created during the field evaluation, and separately over those of 11 "
          "and 12 October. For KPI-4, each step is passed or failed "
          "against its expected behavior, and the delays of its notifications are computed as for KPI-3. For KPI-5, the 95th percentile captures the slowest requests "
          "that users experience. For KPI-6, responses are scored by the standard procedure [22], and the mean, standard "
          "deviation, and 95% confidence interval are reported. The two background questions (Appendix C) are reported "
          "as counts to describe the participants; the sample is too small to compare groups statistically.")


# =====================================================================
def chapter4(doc):
    doc.chapter_heading("Results and Discussion")
    doc.h(2, "Results")
    doc.h(3, "Summary of Results")
    doc.table("Results for the seven KPIs", ["KPI", "Pass threshold", "Result", "Verdict"], [
        ["KPI-1 Queue integrity", "0 violations", "0 violations in 6 runs; 0 of 533 simultaneous double joins accepted", "Pass"],
        ["KPI-2 Rule conformance", "All tests pass", "115 of 115 database tests; 32 of 32 unit tests", "Pass"],
        ["KPI-3 Notification timeliness", "≥ 95% within 60 s", "Field evaluation (17 Oct): 15 of 15 (100%) within 60 s, median 1.0 s; earlier tests (11–12 Oct): 29 of 30 (96.7%); none sent twice", "Pass"],
        ["KPI-4 Maintenance workflow", "Every step as specified; notifications within 60 s", "7 of 7 steps as specified; 10 of 10 notifications within 60 s (median 1.0 s)", "Pass"],
        ["KPI-5 Responsiveness", "p95 < 2 s; < 1% failed", "Set B (local, 50 users): p95 88–94 ms, 0 failed in 3 runs (set A: up to 1.46% failed, traced to the load generator); set C (deployed, 3 users): p95 477–567 ms, 0 failed; Lighthouse mobile: largest content within 1.9 s", "Pass"],
        ["KPI-6 Usability", "Mean SUS ≥ 68", "Mean 67.5 (SD 13.4; 95% CI 59.4–75.6), n = 13; 8 of 13 scores at or above 68", "Not met"],
        ["KPI-7 Security", "Privilege tests pass; no High finding", "40 of 40 privilege tests; npm audit: 0 production vulnerabilities after upgrade; ZAP baseline: 0 High; warnings 11 → 7 after security headers", "Pass"],
    ], [3, 3, 4, 1.5])

    doc.h(3, "Formative Field Test")
    doc.p("Before the summative evaluation, six players in two 3x3 teams used the deployed system on their own phones "
          "at the courts on 12 October 2026. They completed one game through queuing, check-in, play, and scoring (7–3), "
          "and the database recorded the statistics of all six players. The second round never started: when the losing "
          "team requeued, the scheduler failed and no court advanced again, so no further game could be created. That "
          "defect and the others observed during the session, together with two found while developing on the same day and "
          "those found in a review of every feature on the following day, are listed in Table 4.2; each defect in the code was corrected and covered by a new test. A second session on "
          "16 October, after those corrections, completed a game between two new teams (7–6); the result page showed "
          "every player's points and the profile pages showed the statistics, and the session exposed one more defect. "
          "The field evaluation of 17 October, moved to another court at short notice, exposed a problem of operation "
          "rather than code: players standing at the court were refused at check-in. Both are the last rows of Table 4.2.")
    doc.table("Defects found in the field tests, during development, and in the review that followed", ["Source", "Observation", "Cause", "Correction"], [
        ["Field test", "A team that requeued after losing was never called again, and no court advanced", "The second check-in of the same queue entry violated a unique key, and the failed scheduler run rolled back every court",
         "Uniqueness only among open check-ins; each court advanced in its own sub-transaction"],
        ["Field test", "Players' statistics showed zero although the game had been recorded",
         "The row-level security policies called helper functions that signed-in users could not execute, and the page hid the error",
         "Execute granted on the helpers; a test reads the tables as a signed-in user"],
        ["Field test", "The winning captain did not see the option to continue", "The game page did not move to the result when the game ended", "The page follows the game to its result automatically"],
        ["Development, 12 Oct", "Scores could be resubmitted by one team alone after a rejection", "Only the resubmitting team was checked", "Both teams must submit again"],
        ["Field test", "A winning team that continued could never leave the queue", "No transition from holding the court", "Holders may leave; a waiting challenger returns to the head"],
        ["Review, 13 Oct", "A team that won twice was not made to rest", "The rest was released before the loser decided", "The resting team waits for the loser's decision"],
        ["Review, 13 Oct", "Members verified as present were refused at confirmation", "Two different radii (300 m and 50 m)", "One radius per court for both checks"],
        ["Field test", "Location checks expired during a long wait", "Verification lasted 10 minutes", "30 minutes"],
        ["Field test", "LINE messages to every member were noisy", "All members were notified", "Only team leaders are notified"],
        ["Development, 12 Oct", "A game could hold a court indefinitely", "No deadline for scores", "5-minute score deadline; administrator tools; game delegate"],
        ["Field test, 16 Oct", "A requeued team called to face the winner was dropped when the winner let its decision time out", "The rule that returns a called challenger when the holder leaves did not cover the winner's decision", "The challenger returns to the head of the queue when the winner leaves or times out"],
        ["Field test, 17 Oct", "Players standing at the evaluation court were refused at check-in", "The court location, taken from the place marker of the court in Google Maps, was about 125 m from where the players stood, and the check adds the reported GPS accuracy to the distance, so a 150 m radius left no margin",
         "Court location re-pinned on site in Google Maps, next to the court and its waiting area; radius raised to 400 m for the session, then set to 200 m"],
    ], [1.8, 3.6, 3.6, 3.6])
    doc.p("The most serious defect, the first in Table 4.2, was diagnosed from the scheduler's own records "
          "(`cron.job_run_details`), which showed a duplicate-key failure seconds after the losing team requeued. It also "
          "showed that a single faulty court could stop every court, which is why each court now advances independently.")

    doc.h(3, "KPI-1: Queue Integrity Under Load")
    doc.p("No run of either set produced a rule violation (Table 4.3). In each run the captains attempted about 180 joins, half of them "
          "as the second of two simultaneous requests for the same team. The database never accepted both requests of a "
          "pair: when the team was free it accepted one and refused the other, and when the team was still called from "
          "an earlier join it refused both. Meanwhile the scheduler "
          "called 10 to 12 teams per run, so joins, leaves, and calls competed for the same queues. Leaving was refused only "
          "for teams that the scheduler had already called, as the rules require.")
    doc.table("Queue integrity under load (KPI-1), 16 October 2026",
              ["Run", "Joins tried", "Joined", "Both of a pair accepted", "Left", "Leaves refused", "Teams called", "Violations"], [
        ["A1", "182", "58", "0 of 91", "46", "12", "12", "0"],
        ["A2", "172", "55", "0 of 86", "45", "10", "10", "0"],
        ["A3", "172", "53", "0 of 86", "43", "8", "10", "0"],
        ["B1", "178", "56", "0 of 89", "44", "12", "12", "0"],
        ["B2", "182", "58", "0 of 91", "46", "12", "12", "0"],
        ["B3", "180", "57", "0 of 90", "45", "12", "12", "0"],
    ], [1, 1.4, 1.6, 1.8, 1.1, 1.5, 1.4, 1.9])
    doc.h(3, "KPI-2: Rule Conformance")
    doc.p("All 115 assertions in the fifteen database test files and all 32 unit tests passed on the final build "
          "(Table 4.4). The database tests run each function as specific users, including users who must be refused, so "
          "they verify the rules and the permissions together. Until 16 October, however, they ran as the database owner, "
          "which bypasses row-level security, so none of them read a table the way the application does. That gap hid the "
          "defect behind the empty statistics in Table 4.2; the test file `rls_helper_access` now reads as a signed-in "
          "player and as an administrator, and it failed before the correction and passes after it.")
    doc.table("Automated test results", ["Test file", "Area", "Assertions", "Result"], [
        ["security_privileges", "Grants, RLS, and function permissions", "40", "Pass"],
        ["winner_rotation", "Two-win limit, rest, and decisions", "14", "Pass"],
        ["team_location_status", "Location status of team members", "11", "Pass"],
        ["requeue_check_in", "Repeated check-ins after requeuing", "9", "Pass"],
        ["court_advance_safety", "Resting order, radius, per-court isolation", "8", "Pass"],
        ["location_verification", "Distance, accuracy, and expiry", "7", "Pass"],
        ["line_notifications", "Outbox, claiming, retry, and expiry", "3", "Pass"],
        ["challenger_return", "A called challenger returns when the winner leaves or times out", "8", "Pass"],
        ["rls_helper_access", "Reading statistics, scores, and logs as a player and as an admin", "9", "Pass"],
        ["Other six files", "Full 3x3 flow, queue, teams, invitations, maintenance, game safety", "6", "Pass"],
        ["Unit tests (7 suites)", "Rules, notifications, live refresh, statistics, security headers", "32", "Pass"],
    ], [3.2, 5, 1.9, 1.2])
    doc.h(3, "KPI-3: Notification Timeliness")
    doc.p("During the field evaluation of 17 October 2026, from 17:00 to 19:30, the outbox recorded 15 notifications "
          "(Table 4.5). All 15 were sent on the first attempt and none twice, and all were delivered within 60 seconds of "
          "the change that caused them, which meets the threshold of 95%. The median delay was 1.0 second and the longest "
          "51.8 seconds, a call to check in that waited for the next dispatch cycle.")
    doc.table("Delivery delay of LINE notifications by event during the field evaluation, 17 October 2026",
              ["Event", "Sent", "Within 60 s", "Median delay (s)", "Maximum delay (s)"], [
        ["Team invitation", "6", "6", "0.8", "1.0"],
        ["New maintenance report", "1", "1", "0.7", "0.7"],
        ["Next in queue", "3", "3", "8.4", "11.4"],
        ["Team called", "3", "3", "11.6", "51.8"],
        ["Request to submit scores", "2", "2", "30.9", "31.1"],
        ["**Total**", "**15**", "**15 (100%)**", "**1.0**", "**51.8**"],
    ], [4.2, 1.3, 2, 2.2, 2.3])
    doc.p("The outbox recorded 30 notifications on the production system between 11 and 12 October 2026, during the "
          "preliminary test and the formative field test (Table 4.6). All 30 were sent on the first attempt, none was sent "
          "twice, and none failed or expired. Twenty-nine (96.7%) were delivered within 60 seconds of the change that "
          "caused them, which meets the threshold of 95%. The median delay was 1.7 seconds and the mean 25.6 seconds.")
    doc.table("Delivery delay of LINE notifications by event, 11–12 October 2026",
              ["Event", "Sent", "Within 60 s", "Median delay (s)", "Maximum delay (s)"], [
        ["Team invitation", "5", "5", "0.8", "1.0"],
        ["Game result", "6", "6", "1.5", "2.2"],
        ["Maintenance status changed", "1", "1", "1.0", "1.0"],
        ["Next in queue", "6", "6", "10.0", "19.7"],
        ["Request to submit scores", "2", "2", "11.1", "11.2"],
        ["Team called", "6", "6", "19.3", "20.4"],
        ["New maintenance report", "4", "3", "13.0", "530.5"],
        ["**Total**", "**30**", "**29 (96.7%)**", "**1.7**", "**530.5**"],
    ], [4.2, 1.3, 2, 2.2, 2.3])
    doc.p("The delays follow the two delivery paths described in Chapter 3. Messages caused by a user's own action, such as an "
          "invitation or a game result, were sent within about two seconds by the request that caused them. Messages caused "
          "by the scheduler, such as a team being called, waited for the next one-minute dispatch cycle and took 10 to 20 "
          "seconds. The single late message, a new maintenance report delayed by 530.5 seconds, was created at 20:10 on "
          "11 October, while the scheduled dispatch on the production deployment was still being configured; the next "
          "message of the same kind, eight minutes later, was sent in 24.8 seconds. Both samples are small, 45 messages "
          "in all, of which 44 (97.8%) arrived within a minute.")
    doc.h(3, "KPI-4: Maintenance Workflow")
    doc.p("The scenario of Table 3.9 was run on the deployed system on 15 October 2026 between 19:15 and 19:40, on the "
          "author's phone, with five report attempts at the 5x5 court. Step S4 was carried out after S6 by mistake; the "
          "order does not affect its outcome, because R1 had already been resolved. Every step behaved as specified "
          "(Table 4.7).")
    doc.table("Results of the maintenance scenario, 15 October 2026", ["Step", "Observed behavior", "Result"], [
        ["S1", "R1 saved as NEW with its photo; administrator notified 1.2 s later", "Pass"],
        ["S2", "R2 refused with the duplicate message; no report saved", "Pass"],
        ["S3", "R1 moved to In progress, Waiting for caretaker, and Resolved; three history rows; reporter notified after 1.3, 1.1, and 0.8 s", "Pass"],
        ["S4", "R3 for the same problem accepted after R1 was resolved; administrator notified", "Pass"],
        ["S5", "R4 saved without a photo, then rejected; the rejection kept in the history; reporter notified", "Pass"],
        ["S6", "R5 for the same problem as R4 accepted after the rejection", "Pass"],
        ["S7", "R3 and R5 rejected; no test report left open; the open reports of the 3x3 courts unchanged", "Pass"],
    ], [1, 9, 1.5])
    doc.p("The outbox recorded ten maintenance notifications during the run, four for new reports and six for status "
          "changes. All ten were sent on the first attempt, between 0.8 and 1.3 seconds after the change, with a median "
          "of 1.0 second. Every status change of the test reports appears in the history with its time, so the full "
          "path of R1 from report to resolution, 10 minutes and 37 seconds, can be reconstructed from the database.")
    doc.p("The run also exposed one interface defect outside the specified steps. The note that an administrator may add "
          "to a status change, which is included in the reporter's LINE message, could not be entered on a phone: the note "
          "field reused the style of the header's administrator link, which is hidden on narrow screens, so the field was "
          "hidden with it. The field was given its own style, and a source test now guards against the regression.")
    fig(doc, SHOT + "admin-stats.png", "The maintenance statistics page after the scenario (30 days), including the test reports", 70)
    doc.h(3, "KPI-5: Responsiveness Under Load")
    doc.p("Response times stayed far below the threshold in every run of both sets (Table 4.8): the 95th percentile of "
          "all requests was 88 to 94 milliseconds and no request took longer than 227 milliseconds. Court pages, rendered on the server "
          "with their queue, accounted for almost all of this time, while the queue functions in the database answered in "
          "under 8 milliseconds at the 95th percentile.")
    doc.table("Response times under load (sets A and B, local) and on the deployed site (set C), 16 October 2026",
              ["Run", "Requests", "Pages p95 (ms)", "Functions p95 (ms)", "All p95 (ms)", "Max (ms)", "Failed"], [
        ["A1", "1,336", "100.9", "7.6", "91.1", "183.5", "9 (0.67%)"],
        ["A2", "1,317", "101.0", "7.6", "93.6", "178.2", "10 (0.76%)"],
        ["A3", "1,304", "107.9", "7.3", "91.9", "159.0", "19 (1.46%)"],
        ["B1", "1,351", "109.5", "7.8", "94.2", "226.4", "0 (0%)"],
        ["B2", "1,366", "97.0", "7.4", "88.2", "174.6", "0 (0%)"],
        ["B3", "1,356", "92.8", "7.8", "88.6", "172.4", "0 (0%)"],
        ["C1", "131", "567", "—", "567", "1,579", "0 (0%)"],
        ["C2", "133", "506", "—", "506", "1,315", "0 (0%)"],
        ["C3", "130", "477", "—", "477", "1,507", "0 (0%)"],
    ], [1, 1.7, 1.7, 1.9, 1.6, 1.4, 2.1])
    doc.p("In set A the failure rate met the threshold in the first two runs but not in the third (1.46%). The failed "
          "requests were not slow answers: they came in short bursts, mostly as connections from the load generator that "
          "timed out before reaching the server (15 of 19 in run A3), and only page requests failed, which in set A "
          "crossed from the Docker container to the laptop, while requests to the database through a port published by "
          "Docker never failed. To test whether the container's networking caused the failures, set B ran the same k6 "
          "version directly on the laptop against the same build. No request failed in any of its three runs, and the "
          "response times did not change. The failures of set A are therefore attributed to the load generator's "
          "network path rather than to MeQ, and KPI-5 is met on set B. Both sets are reported so that the reader can "
          "judge this attribution.")
    doc.p("These times describe the application and the database, not what a player experiences at the courts. All "
          "parts ran on one laptop, so no request crossed the internet. The load was also light, about 6 requests per "
          "second, because each user waited 10 seconds between pages as the live refresh does; the script fetched only the "
          "HTML of each page and called the queue functions directly rather than through Server Actions. The result shows "
          "that the server and the database are not a bottleneck for 50 users, with a wide margin under 2 seconds, but "
          "not the response time of the deployed system.")
    doc.p("Set C measured that response time on the deployed site between 17:44 and 17:57 on 16 October 2026, signed "
          "in as the author, from the same laptop over its internet connection. Three k6 users opened the eleven signed-in "
          "pages of a player and an administrator, with three to six seconds between pages, for three minutes in each of "
          "three runs; they only read pages, so no queue entry, score, report, or notification was created. Every request "
          "was answered signed in and none failed. The 95th percentile was 477 to 567 milliseconds, five to six times that "
          "of set B, and the median about 310 milliseconds (Table 4.8); the slowest page at the 95th percentile in any run, 1.0 second, was the "
          "maintenance statistics of the administrator. The difference from set B is the time of the internet and of the "
          "database queries between Vercel and Supabase. Lighthouse [29] then loaded four pages three times each as a "
          "phone on a mobile network, using its default mobile settings, which emulate a mid-range phone and simulate a "
          "slow 4G connection. Unlike k6, it counts the scripts, styles, and images of the page and the time to draw it. "
          "The largest content of every page appeared within 1.9 seconds, with a median of about 1.0 second, and every "
          "page scored 99 or 100 for performance (Table 4.9). The first run of each page was the slowest, because "
          "nothing was cached yet.")
    doc.table("Lighthouse mobile results on the deployed site, median of three runs, 16 October 2026",
              ["Page", "Performance score", "First contentful paint (s)", "Largest contentful paint (s)", "Slowest LCP (s)", "Total blocking time (ms)"], [
        ["/courts/3x3-a (court and queue)", "99–100", "0.81", "1.02", "1.87", "64"],
        ["/profile (statistics)", "100", "0.83", "1.02", "1.06", "73"],
        ["/courts (court list)", "100", "0.84", "0.97", "1.15", "27"],
        ["/admin (administrator)", "100", "0.78", "0.93", "1.28", "26"],
    ], [3.4, 1.7, 1.8, 1.8, 1.5, 1.8])
    doc.p("Set C used three users, so it shows the response time that a player meets, not whether the deployed site "
          "holds 50 users at once; that capacity rests on sets A and B, because a load of 50 users on the free tiers "
          "of the deployed services would have disturbed real players. Lighthouse simulates a mobile network rather than "
          "measuring one, and the k6 requests left from a fixed connection, so a phone at the courts may be slower when "
          "its signal is weak.")
    doc.h(3, "KPI-6: Usability")
    doc.p("Thirteen players answered the questionnaire on the day of the field evaluation. Five play at the courts at "
          "least four times a week, five two or three times a week, and three once a week or less. Five chose the team "
          "leader option and eight the member option; one of the five, who tried every page but did not join a team, "
          "chose the leader option although that player led no team. The mean SUS score was 67.5 (SD 13.4; median 70; range "
          "40–87.5), with a 95% confidence interval of 59.4 to 75.6 (t distribution, 12 degrees of freedom). The mean is "
          "0.5 points below the benchmark of 68 [23], so KPI-6 is not met. The interval includes 68, so the sample cannot "
          "show whether the true mean lies above or below the benchmark. Eight of the thirteen scores were 68 or higher "
          "(Figure 4.2).")
    fig(doc, IMG + "sus-scores.png", "SUS scores of the thirteen participants, with the mean, its 95% confidence interval, and the benchmark of 68", 95)
    doc.p("One response gave 5 to all ten items, including the five negatively worded ones, a pattern that suggests the "
          "items were not read. It was kept, because the procedure fixed before measurement made no provision for "
          "excluding responses. Without it the mean would be 68.8, just above 68, so the verdict depends on a single "
          "response and should be read as borderline rather than as a clear failure. The item means show where the score was "
          "lost. Players would like to use MeQ regularly (item 1: 4.31 of 5) and found its functions well integrated "
          "(item 5: 4.23) and consistent (item 6: 1.85, where lower is better). They were less sure that they could use it "
          "without help (item 4: 3.54, lower is better) or without learning several things first (item 10: 2.92). Two "
          "written comments agree: one player asked for someone to teach the first use, and another asked to see the "
          "queues without signing in.")
    doc.h(3, "KPI-7: Security")
    doc.p("All 40 privilege assertions passed: anonymous users cannot call any queue, game, or administrator function; "
          "signed-in users cannot write to lifecycle tables directly; only the service role can claim notifications; and "
          "administrator functions refuse other users. Table 4.10 maps the controls of MeQ to the OWASP Top 10:2025 [25], the edition current at the time of the evaluation.")
    doc.table("Controls of MeQ against the OWASP Top 10:2025", ["Risk", "Control in MeQ", "Evidence"], [
        ["A01 Broken Access Control", "Row-level security on every table; lifecycle tables are written only by functions that check `auth.uid()` and the role; administrator functions check the role again; each user's photos are kept in their own folder of a private bucket; the server calls only the fixed LINE address, never one taken from user input (server-side request forgery, part of A01 since 2025)",
         "40 privilege assertions; reads as a signed-in user (rls_helper_access)"],
        ["A02 Security Misconfiguration", "Private storage bucket limited to JPEG, PNG, and WebP up to 5 MB, checked again in the server action; row-level security enabled on every table; security headers including a Content Security Policy; the framework header switched off",
         "Privilege tests; ZAP baseline (Table 4.11)"],
        ["A03 Software Supply Chain Failures", "Dependencies are pinned by the lockfile and audited with `npm audit`; known vulnerabilities in Next.js 16.3.3 (critical), sharp, and source-map-js were removed by upgrading to Next.js 16.3.8; every change passes continuous integration before it is merged",
         "npm audit before and after the upgrade; CI records"],
        ["A04 Cryptographic Failures", "HTTPS only; no passwords are stored because users sign in with LINE; keys are kept in server environment variables and the database vault; the service-role key never reaches the browser",
         "Code review; environment configuration"],
        ["A05 Injection", "Every query goes through parameterized calls of the Supabase client; database functions set an empty `search_path` and use schema-qualified names; React escapes all output",
         "Code review"],
        ["A06 Insecure Design", "Rules, timers, and positions are decided in database transactions; the distance to the court is computed on the server; browser timers are for display only",
         "pgTAP rule tests; field tests"],
        ["A07 Authentication Failures", "Sign-in with LINE Login through OpenID Connect [17]; sessions are kept in cookies managed by Supabase Auth and refreshed on every request",
         "Code review"],
        ["A08 Software or Data Integrity Failures", "Database changes only through versioned migrations; the notification dispatcher requires a secret compared in constant time; each notification carries a retry key so that it is never delivered twice",
         "Migration history; outbox records (KPI-3)"],
        ["A09 Security Logging and Alerting Failures", "Queue, team, and game events are written to `audit_logs`; maintenance status changes to their own history; scheduler failures to `cron.job_run_details` and `audit_logs`; administrators are alerted by LINE about new and overdue reports, but not about scheduler failures",
         "Field-test diagnosis (Table 4.2)"],
        ["A10 Mishandling of Exceptional Conditions", "Each court advances in its own sub-transaction, so an error in one court is logged and rolled back without stopping the others; database errors are mapped to messages for the user. The statistics defect of Table 4.2 showed the opposite case, an error that a page hid by showing empty data",
         "court_advance_safety test; Table 4.2"],
    ], [3, 6.2, 2.8])
    doc.p("The dependency audit was the one control that initially failed the criterion. On 15 October 2026, `npm audit` "
          "reported a critical advisory in Next.js 16.3.3, whose affected features include the image optimization that MeQ "
          "uses for LINE profile pictures, and high-severity advisories in sharp and source-map-js. After the upgrade to "
          "Next.js 16.3.8, the audit of the production dependencies reported no vulnerabilities, and the type check, lint, "
          "unit tests, and production build all passed. Five high-severity advisories remain in the lint toolchain, a "
          "development dependency that is not deployed.")
    doc.p("The deployed site was scanned twice with the ZAP baseline scan. The first scan, on the evening of 15 October "
          "2026 after the Next.js upgrade, passed 56 rules and raised no High-risk alert, which already meets the "
          "criterion of KPI-7, but it reported missing security headers. The headers were then added to the Next.js "
          "configuration, and the second scan, early on 16 October, passed 60 rules with no High-risk alert and seven "
          "warnings instead of eleven (Table 4.11). Neither scan was signed in, so both covered only the public pages (the "
          "sign-in, privacy, and terms pages and the static files); the pages behind sign-in are protected by the "
          "privilege tests instead.")
    doc.table("Alerts of the ZAP baseline scans before and after the security headers",
              ["Risk", "Alert", "Before", "After", "Assessment"], [
        ["Medium", "Content Security Policy header not set", "Raised", "Resolved", "A policy now limits scripts, images, and forms to the site, Supabase, and LINE Login"],
        ["Medium", "Missing anti-clickjacking header", "Raised", "Resolved", "frame-ancestors 'none' and X-Frame-Options DENY"],
        ["Medium", "CSP allows inline scripts and styles", "—", "Raised", "Next.js needs inline scripts without nonces, and React uses style attributes; a nonce-based policy would require dynamic rendering of every page"],
        ["Medium", "Cross-domain misconfiguration", "Raised", "Raised", "Static files are served to any origin by the host; they contain no user data"],
        ["Medium", "Absence of anti-CSRF tokens", "Raised", "Raised", "On the sign-in form, which only starts LINE Login; Next.js Server Actions check the request origin instead of a token"],
        ["Low", "X-Content-Type-Options, Permissions-Policy, opener and resource policies", "Raised", "Resolved", "Set as response headers; geolocation stays allowed for check-in"],
        ["Low", "X-Powered-By header reveals the framework", "Raised", "Resolved", "Switched off"],
        ["Low", "Cross-Origin-Embedder-Policy missing", "Raised", "Raised", "Requiring it would block photos from Supabase and LINE profile pictures"],
        ["Info", "Caching and modern web application notes", "Raised", "Raised", "No action needed"],
    ], [1.5, 3.2, 1.7, 1.7, 3.9])
    doc.p("The remaining warnings are accepted trade-offs rather than flaws: the policy still blocks scripts from other "
          "origins, framing, plugins, and changes of the base address, which are the usual routes of the attacks it "
          "targets. Both reports are kept with the project (`docs/report/evidence/`).")

    doc.h(2, "Discussion")
    doc.h(3, "Enforcing the Rules in the Database")
    doc.p("The field test supports the central design decision while showing its cost. Because every rule lives in a "
          "transactional function, the defects found were defects of the rules themselves, not of one page bypassing them, "
          "and each correction applied to every page at once. The same centralization made a single failing court stop every "
          "court until each court was isolated in its own sub-transaction. Enforcement in the database is therefore "
          "necessary for a fair queue [2], [5], but a scheduler that serves several courts must also contain each court's "
          "failures. The load test supports this from the other side: with 50 users and the scheduler acting on the same "
          "queues, the row locks and unique indexes of the database let only one of two simultaneous joins succeed, and "
          "no run left a single inconsistency. Placing the rules in the database also moves the risk there: a single "
          "missing grant made every player's statistics unreadable, and the tests missed it because they ran with "
          "privileges that skip row-level security.")
    doc.h(3, "Notifications")
    doc.p("Maister's observation that uncertain waits feel longer [3] motivated the notifications. The field test added a "
          "practical refinement: messages to every member were perceived as noise, and limiting them to team leaders kept "
          "the information while reducing interruptions. The outbox design ensured that no message was sent for a change that "
          "was rolled back and none was sent twice. The records of KPI-3 confirm this: all 45 messages were sent on the "
          "first attempt and none twice, and the only delay beyond one minute occurred while the dispatch was being "
          "configured. The one-minute cycle of the scheduler, not LINE, accounts for most of the waiting time, so a shorter "
          "cycle is the simplest improvement if faster calls are needed.")
    doc.h(3, "Maintenance Reporting")
    doc.p("At one facility, faults are rare and cannot be scheduled, so the evaluation could test the path a report takes "
          "but not how quickly a real administrator acts on it. The design choices still shape that time. Refusing a second "
          "report of an open problem keeps the administrator's list to one item per fault, and the status history makes "
          "every delay visible on the statistics page. Suspending a court's queue automatically when a report is filed was "
          "rejected, because a single unverified report could then close a court; the administrator, who checks the damage, "
          "decides instead. The scenario of KPI-4 confirmed that each of these mechanisms works on the deployed system, "
          "and that a report reaches the administrator about a second after it is filed. What remains unmeasured is the "
          "human part of the cycle, the time an administrator and a caretaker take to act, which only regular use can show.")
    doc.h(3, "Performance and Usability")
    doc.p("The load test suggests that the expected evening crowd is far from the limits of the design. Refreshing every "
          "court page every 10 seconds instead of keeping a WebSocket open costs a full page render per refresh, yet 50 "
          "users kept the 95th percentile under a tenth of a second on a laptop. Polling also keeps the queue tables closed "
          "to the browser, which subscriptions would have required opening. The failures of the first set of runs are a "
          "reminder that a load test measures its own environment as well: only by changing the load generator's path, "
          "and nothing else, could they be separated from the application.")
    doc.p("Usability fell just short of its criterion, and the answers separate what MeQ does from how a newcomer starts. "
          "The functions were rated well, but before the first game a player must sign in with LINE, join a full team, "
          "allow location access, and learn the court rules, and the welcome guide shown at the first sign-in did not "
          "remove the need for help. The comments suggest two changes: letting anyone see the queues without signing in, "
          "and a short guided first use at the courts. The sample was small and came from one session, so the confidence "
          "interval is wide; a larger sample after these changes would show whether the score rises above 68.")


# =====================================================================
def chapter5(doc):
    doc.chapter_heading("Conclusions")
    doc.h(2, "Conclusions")
    doc.p("This project designed, developed, and evaluated MeQ, a mobile web application that replaces word-of-mouth queuing "
          "at the basketball courts of Naresuan University and gives players a channel for reporting damaged equipment.")
    doc.lead("Objective 1: the queue.", "MeQ shows the queue of every court and enforces the court rules in the database. "
             "All automated rule tests passed, and the defects found in the field test were corrected and covered by tests. "
             "Under 50 simultaneous users the queues stayed consistent in all six runs, and no team "
             "could hold two places at once, so H1 is supported.")
    doc.lead("Objective 2: presence.", "Check-in requires every member to be within the court's radius, computed on the "
             "server, before a team can play. In the field evaluation it worked once the court location had been pinned at "
             "the court itself, which showed that the location must be set where players actually stand.")
    doc.lead("Objective 3: maintenance.", "Players report damage with a photo, a second report of an open problem is "
             "refused, and every status change is recorded. In a scripted scenario on the deployed "
             "system, every step behaved as specified and all ten notifications arrived within 1.3 seconds, so H3 is "
             "supported; one defect, a note field hidden on phones, was found and corrected.")
    doc.lead("Objective 4: notifications and evaluation.", "During the field evaluation all 15 "
             "notifications arrived within a minute, as did 29 of 30 in the earlier tests, and none arrived twice (KPI-3, H2 "
             "supported). In a load test on one laptop, pages answered within a tenth of a second at the 95th "
             "percentile under 50 users, with no failed request once the load generator ran outside Docker; on the deployed "
             "site, with three users, they answered within 0.6 seconds at the 95th percentile and a simulated phone showed each page within "
             "1.9 seconds (KPI-5). No High-risk alert or vulnerable "
             "production dependency remained after the upgrade and the security headers (KPI-7). Thirteen players rated the "
             "usability at a mean SUS score of 67.5, just below the benchmark of 68 (KPI-6 not met). Because a hypothesis is "
             "supported only if all of its criteria are met, H4 is not supported: its responsiveness criterion was met, "
             "but its usability criterion was not, and the first use of the system needs to be easier.")
    doc.h(2, "Limitations")
    doc.ol([
        "A falsified browser location cannot be detected; the radius check only confirms what the phone reports.",
        "Scores are entered by the teams; the system checks that they are consistent, not that they are true.",
        "Notifications reach only users who have added the LINE Official Account as a friend.",
        "The evaluation took place at one facility, on free-tier infrastructure, with a small convenience sample. The field "
        "evaluation itself was held on a single outdoor court used for 3x3 games, because the covered courts had no "
        "lighting during maintenance, so it exercised only the queue of 3x3 A.",
        "The load test ran on one laptop that hosted the application, the database, and the load generator together, so its response times are not those of the hosted services; the deployed site was measured only with three users and a simulated mobile network; the failures of its first set were traced to the load generator's network path by a second set, not by a test from a separate machine.",
        "The Thai translation of the SUS was not validated, and the thirteen respondents came from one session, recruited by convenience.",
        "The time administrators take to respond to real faults was not measured, because faults could not be scheduled during the evaluation; the statistics page records it for later study.",
        "The author built and evaluated the system with AI assistance; automated tests and fixed criteria reduce, but do not remove, this bias.",
    ])
    doc.h(2, "Recommendations")
    doc.h(3, "Recommendations for Practice")
    doc.ol([
        "Developers of shared queues should enforce every rule in a database transaction and test it as each kind of user, including users who must be refused.",
        "Row-level security should be tested as the role the application uses, because tests run as the database owner bypass it.",
        "A scheduler that advances several resources should isolate each one, so that one failure does not stop the others.",
        "Notifications should be stored with the change that causes them, carry an expiry, and be sent idempotently.",
        "Field tests with real users on real devices should precede the summative evaluation; the most serious defect of this project was found that way.",
    ])
    doc.h(3, "Recommendations for Deployment at the University")
    doc.ol([
        "Pin the location of the covered courts on site, next to the courts and their waiting area, and set the radius accordingly, as was done for the field evaluation.",
        "Make the first use easier before regular use: show the queues without sign-in and guide a new player through the first game.",
        "Close the remaining PDPA gaps of Table 3.7: a retention period for old notifications, logs, and photos, and a written procedure for reporting a data breach.",
        "Agree with the facility staff who acts as administrator, and rotate every secret key before handing the system over.",
    ])
    doc.h(3, "Recommendations for Future Research")
    doc.ol([
        "Extend MeQ to other free facilities of the university, such as futsal and volleyball courts, with their own rules.",
        "Compare server polling with real-time subscriptions for queues with shorter turns.",
        "Study whether a visible, enforced queue reduces disputes, for example by observing the courts before and after deployment.",
        "Add stronger presence checks, such as a QR code displayed at the court, where location alone is insufficient.",
        "Measure the time from report to response and to repair over a semester of regular use, using the statistics page.",
        "Repeat the SUS with a larger sample after making the first use easier, for example by showing the queues without sign-in.",
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
    "QueQ, “QueQ: No more queue line.” [Online]. Available: https://www.queq.me/ (accessed Oct. 15, 2026).",
    "National Electronics and Computer Technology Center (NECTEC), “Urban and community problem management with the Traffy Fondue platform.” [Online]. Available: https://www.nectec.or.th/innovation/innovation-mobile-application/traffy-fondue.html (accessed Oct. 15, 2026).",
    "mySociety, “FixMyStreet.” [Online]. Available: https://www.fixmystreet.com/ (accessed Oct. 15, 2026).",
    "J. Brooke, “SUS: A ‘quick and dirty’ usability scale,” in *Usability Evaluation in Industry*, P. W. Jordan, B. Thomas, B. A. Weerdmeester, and I. L. McClelland, Eds. London, U.K.: Taylor & Francis, 1996, pp. 189–194.",
    "J. Sauro and J. R. Lewis, *Quantifying the User Experience: Practical Statistics for User Research*, 2nd ed. Cambridge, MA, USA: Morgan Kaufmann, 2016.",
    "Grafana Labs, “Grafana k6 documentation.” [Online]. Available: https://grafana.com/docs/k6/latest/ (accessed Oct. 15, 2026).",
    "OWASP Foundation, “OWASP Top 10:2025,” Nov. 2025. [Online]. Available: https://top10.owasp.org/ (accessed Oct. 16, 2026).",
    "“Personal Data Protection Act, B.E. 2562 (2019),” *Royal Thai Government Gazette*, vol. 136, part 69 Kor, May 27, 2019.",
    "L. Wroblewski, *Mobile First*. New York, NY, USA: A Book Apart, 2011.",
    "ZAP Dev Team, “ZAP – Baseline scan.” [Online]. Available: https://www.zaproxy.org/docs/docker/baseline-scan/ (accessed Oct. 15, 2026).",
    "Google, “Introduction to Lighthouse,” Chrome for Developers. [Online]. Available: https://developer.chrome.com/docs/lighthouse/overview (accessed Oct. 16, 2026).",
]


def references(doc):
    doc.plain_heading("References")
    for i, ref in enumerate(REFS, 1):
        doc.reference(i, ref)


def appendices(doc):
    doc.plain_heading("Appendix", new_page=True)
    doc.page_break()
    doc.plain_heading("Appendix A: Database Schema", appendix="A")
    doc.p("Table 3.6 lists the core tables; this appendix lists the status values that they use, as defined by the "
          "migrations in `supabase/migrations/`.")
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
    doc.p("This guide walks a player through MeQ in the order of use.")
    for image, cap, steps in [
        ("guide-start.png", "(a) The welcome guide shown after the first sign-in; (b) a team page with the format, roster count, and status",
         ["Choose Sign in with LINE and allow MeQ in LINE.", "Add MeQ as a friend when LINE asks, so that you are notified when your team is called.", "Read the four steps in the welcome guide and choose Start.",
          "Open Teams and create a team (3x3 or 5x5), or accept an invitation.", "As captain, invite members until the roster is full, and optionally choose a game delegate who can act for you in games."]),
        ("guide-queue.png", "(a) A court page, where the captain joins the queue; (b) check-in after the team is called",
         ["Open Courts and choose a court. As captain or delegate, choose Join queue; your position appears in the list.",
          "When LINE tells you that your team is called, open the court page. Every member allows location access so that MeQ can confirm they are at the court.",
          "The captain or delegate confirms the team ready before the deadline."]),
        ("guide-game.png", "(a) Submitting the points of your team; (b) the result and the decision to continue or requeue",
         ["After the game, a leader chooses End game, and each team enters the points of its own players within 5 minutes.",
          "The winner chooses to continue or leave; the loser chooses to requeue or leave, within 3 minutes."]),
        ("guide-maintenance.png", "(a) Reporting damaged equipment; (b) a LINE notification from MeQ",
         ["Open Maintenance, choose the court and the problem type, describe it, attach a photo, and send.", "Follow the status of your report under My reports; LINE tells you when it changes."]),
    ]:
        doc.ol(steps)
        fig(doc, IMG + image, cap, 62)
    doc.page_break()
    doc.plain_heading("Appendix C: SUS Questionnaire", appendix="C")
    doc.p("The questionnaire was administered in Thai through Google Forms after the participants had used MeQ on their "
          "own phones; the tasks below were planned for each participant, and one participant, who did not join a team, "
          "did not queue, check in, or submit scores. The form has three sections: consent; the ten statements and an optional "
          "comment; and two background questions, placed last so that they cannot influence the SUS answers. It "
          "collects no name, e-mail address, or LINE account. The ten statements follow the "
          "standard SUS [22]: odd statements are positive and even statements are negative. The Thai wording is the "
          "author's translation, kept as close as possible to the original. The form was generated by the script "
          "`docs/report/sus-google-form.gs`, so its wording is identical to Table C.1.")
    doc.h(3, "Consent Statement", numbered=False)
    doc.p("The first section shows the statement below and asks the participant to choose ยินยอม (agree) or ไม่ยินยอม "
          "(do not agree); choosing ไม่ยินยอม ends the form without collecting any answers.")
    doc.pleft("ข้าพเจ้ายินยอมเข้าร่วมการประเมินระบบ MeQ ซึ่งเป็นส่วนหนึ่งของโครงงานปริญญานิพนธ์ ภาควิชาวิทยาการคอมพิวเตอร์ "
            "มหาวิทยาลัยนเรศวร แบบสอบถามนี้ไม่เก็บชื่อหรือข้อมูลที่ระบุตัวตน คำตอบจะใช้เพื่อการวิเคราะห์ในภาพรวมเท่านั้น "
            "ข้าพเจ้าสามารถหยุดหรือถอนตัวได้ทุกเมื่อโดยไม่มีผลใด ๆ ต่อการใช้สนาม")
    doc.pni("(I agree to take part in the evaluation of MeQ, part of a senior project of the Department of Computer Science, "
            "Naresuan University. The questionnaire collects no name or identifying data, and the answers are analyzed only "
            "in aggregate. I may stop or withdraw at any time without any effect on my use of the courts.)")
    doc.h(3, "Tasks Before the Questionnaire", numbered=False)
    doc.ol([
        "เข้าสู่ระบบด้วย LINE (sign in with LINE)",
        "สร้างทีมหรือรับคำเชิญเข้าทีม (create a team or accept an invitation)",
        "ดูคิวของทุกสนามและลงคิว (view the queues and join one)",
        "เช็กอินเมื่อถึงคิวและยืนยันความพร้อม (check in when called and confirm ready)",
        "ส่งคะแนนหลังจบเกม และดูสถิติของตนเอง (submit the score and view your statistics)",
        "แจ้งซ่อมอุปกรณ์สนาม 1 รายการ (report one equipment problem)",
    ])
    doc.h(3, "Questionnaire", numbered=False)
    doc.pleft("โปรดเลือกระดับความเห็นของท่านต่อข้อความแต่ละข้อ: 1 = ไม่เห็นด้วยอย่างยิ่ง, 2 = ไม่เห็นด้วย, 3 = เฉย ๆ, "
            "4 = เห็นด้วย, 5 = เห็นด้วยอย่างยิ่ง")
    doc.table("The SUS questionnaire as administered in Thai", ["#", "Statement (Thai)", "Original statement [22]"], [
        ["1", "ฉัน\u200bคิดว่า\u200bฉัน\u200bอยาก\u200bใช้ MeQ เป็น\u200bประจำ", "I think that I would like to use this system frequently."],
        ["2", "ฉัน\u200bรู้สึก\u200bว่า MeQ ซับซ้อน\u200bเกิน\u200bความ\u200bจำเป็น", "I found the system unnecessarily complex."],
        ["3", "ฉัน\u200bคิดว่า MeQ ใช้งาน\u200bง่าย", "I thought the system was easy to use."],
        ["4", "ฉัน\u200bคิดว่า\u200bต้อง\u200bมี\u200bคน\u200bช่วย\u200bแนะนำ จึง\u200bจะ\u200bใช้ MeQ ได้", "I think that I would need the support of a technical person to be able to use this system."],
        ["5", "ฉัน\u200bพบ\u200bว่า\u200bฟังก์ชัน\u200bต่าง ๆ ของ MeQ ทำงาน\u200bเชื่อมโยง\u200bกัน\u200bได้\u200bดี", "I found the various functions in this system were well integrated."],
        ["6", "ฉัน\u200bคิดว่า MeQ มี\u200bส่วน\u200bที่\u200bไม่\u200bสอดคล้อง\u200bกัน\u200bมาก\u200bเกินไป", "I thought there was too much inconsistency in this system."],
        ["7", "ฉัน\u200bคิดว่า\u200bคน\u200bส่วนใหญ่\u200bจะ\u200bเรียนรู้\u200bวิธี\u200bใช้ MeQ ได้\u200bอย่าง\u200bรวดเร็ว", "I would imagine that most people would learn to use this system very quickly."],
        ["8", "ฉัน\u200bรู้สึก\u200bว่า MeQ ใช้งาน\u200bยุ่งยาก", "I found the system very cumbersome to use."],
        ["9", "ฉัน\u200bรู้สึก\u200bมั่นใจ\u200bขณะ\u200bใช้ MeQ", "I felt very confident using the system."],
        ["10", "ฉัน\u200bต้อง\u200bเรียนรู้\u200bหลาย\u200bอย่าง\u200bก่อน\u200bจึง\u200bจะ\u200bเริ่ม\u200bใช้ MeQ ได้", "I needed to learn a lot of things before I could get going with this system."],
    ], [0.8, 5.6, 5.1])
    doc.pleft("ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ) — additional comments (optional), free text.")
    doc.h(3, "Background Questions", numbered=False)
    doc.p("The last section, headed by the note shown to participants that these answers are used only to describe "
          "the respondents as a group, asks two required multiple-choice questions (Table C.2).")
    doc.table("Background questions", ["Question (Thai)", "Choices (Thai)", "English"], [
        ["คุณ\u200bมา\u200bเล่น\u200bที่\u200bสนาม\u200bบาส\u200bมหาวิทยาลัย\u200bนเรศวร\u200bบ่อย\u200bแค่ไหน",
         "สัปดาห์\u200bละ 4 ครั้ง\u200bขึ้น\u200bไป / สัปดาห์\u200bละ 2–3 ครั้ง / สัปดาห์\u200bละ\u200bครั้ง\u200bหรือ\u200bน้อย\u200bกว่า / ครั้ง\u200bแรก",
         "How often do you play at the NU basketball courts? 4 or more times a week / 2–3 times a week / once a week or less / first time"],
        ["ใน\u200bการ\u200bทดลอง\u200bครั้ง\u200bนี้ คุณ\u200bใช้ MeQ ใน\u200bฐานะ\u200bอะไร",
         "หัวหน้า\u200bทีม หรือ\u200bผู้\u200bช่วย\u200bหัวหน้า / สมาชิก\u200bทีม",
         "In this trial, did you use MeQ as a team leader (captain or delegate) or as a team member?"],
    ], [3.4, 3.6, 4.5])
    fig(doc, SHOT + "sus-form.png", "The SUS section of the questionnaire in Google Forms", 50)
    doc.h(3, "Scoring", numbered=False)
    doc.p("For each odd statement the contribution is the response minus 1; for each even statement it is 5 minus the "
          "response. The sum of the ten contributions is multiplied by 2.5, giving a score from 0 to 100 [22]. A mean of "
          "68 is the commonly used benchmark of average usability [23]. The responses were exported as a CSV file from "
          "the linked Google Sheet, and each respondent's score was computed before the mean, standard deviation, and "
          "95% confidence interval.")
