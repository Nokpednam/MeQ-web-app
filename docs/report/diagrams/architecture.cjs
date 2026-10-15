// Draws the system architecture figure for the report (docs/report/images/system-architecture.png).
const sharp = require("../../../node_modules/sharp");
const F = "Arial, sans-serif", W = 1620, H = 1080;
const box = (x, y, w, h, title, lines = [], fill = "#fff") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="#1f2430" stroke-width="2"/>` +
  `<text x="${x + w / 2}" y="${y + 34}" text-anchor="middle" font-family="${F}" font-size="22" font-weight="bold" fill="#1f2430">${title}</text>` +
  lines.map((l, i) => `<text x="${x + w / 2}" y="${y + 64 + i * 26}" text-anchor="middle" font-family="${F}" font-size="18" fill="#333">${l}</text>`).join("");
const lane = (x, y, w, h, title, color) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${color}" stroke="#9aa0a6" stroke-width="1.5" stroke-dasharray="6 5"/>` +
  `<text x="${x + 18}" y="${y + 30}" font-family="${F}" font-size="20" font-weight="bold" fill="#555">${title}</text>`;
const arrow = (x1, y1, x2, y2, label = "", lx = 0, ly = 0) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1f2430" stroke-width="2" marker-end="url(#a)"/>` +
  (label ? `<text x="${(x1 + x2) / 2 + lx}" y="${(y1 + y2) / 2 + ly}" text-anchor="middle" font-family="${F}" font-size="17" fill="#c94f16">${label}</text>` : "");
const path = (pts, label, lx, ly) =>
  `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#1f2430" stroke-width="2" marker-end="url(#a)"/>` +
  `<text x="${lx}" y="${ly}" text-anchor="middle" font-family="${F}" font-size="17" fill="#c94f16">${label}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1f2430"/></marker></defs>
<rect width="${W}" height="${H}" fill="#fff"/>
${box(80, 60, 330, 120, "Mobile browser", ["Players and administrators"], "#fff3eb")}
${box(1190, 60, 330, 120, "LINE Platform", ["Login (OpenID Connect)", "Messaging API"], "#eefaf2")}
${lane(40, 260, 470, 520, "Vercel", "#f7f7f9")}
${box(80, 310, 390, 190, "Next.js application", ["Server-rendered pages", "Server Actions (validate, call RPC)", "Live refresh every 10 s"])}
${box(80, 560, 390, 170, "Notification dispatcher", ["/api/line/dispatch", "claim, push, complete", "service key on server only"])}
${lane(600, 260, 960, 720, "Supabase", "#f2f7fd")}
${box(640, 310, 420, 190, "PostgreSQL", ["Tables with Row Level Security", "Rule functions (RPC) run in", "transactions and check the caller"])}
${box(1100, 310, 420, 190, "Auth", ["Sessions from LINE Login", "custom OAuth provider"])}
${box(640, 560, 420, 170, "line_notifications", ["Outbox written by triggers:", "dedupe key, expiry, status"], "#fffbe6")}
${box(1100, 560, 420, 170, "Storage", ["Private maintenance photos,", "uploaded by Server Actions"])}
${box(640, 790, 880, 160, "pg_cron scheduled jobs", ["Every 30 s: call next teams, expire check-ins, decisions, score deadlines", "Every 1 min: wake the dispatcher through pg_net (secret in Vault)", "Daily 09:00: remind administrators of waiting repairs"])}
${arrow(245, 180, 245, 310, "HTTPS", 40, 0)}
${arrow(470, 400, 640, 400, "reads, RPC", 0, -12)}
${arrow(1310, 180, 1310, 310, "OAuth", 40, 0)}
${arrow(850, 500, 850, 560, "triggers", 45, 5)}
${arrow(640, 645, 470, 645, "claim / complete", 0, -12)}
${arrow(275, 500, 275, 560, "after action", 60, 0)}
${arrow(700, 790, 470, 715, "HTTP POST", -25, 35)}
${arrow(1190, 120, 410, 120, "notification to phone", 0, -12)}
${path([[200, 730], [200, 1040], [1580, 1040], [1580, 120], [1520, 120]], "push message", 900, 1030)}
</svg>`;
sharp(Buffer.from(svg)).png().toFile("docs/report/images/system-architecture.png").then(() => console.log("ok"));
