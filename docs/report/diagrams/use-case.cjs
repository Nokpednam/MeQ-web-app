// Draws the UML use case diagram for the report (docs/report/images/use-case.png).
const sharp = require("../../../node_modules/sharp");
const W = 1700, H = 1180, F = "Arial, sans-serif";
const box = { x: 430, y: 60, w: 840, h: 1060 };
const leftCases = [
  ["Sign in with LINE", "P"], ["View queues of all courts", "P"], ["Create team / accept invitation", "P"],
  ["Verify location by GPS", "P"], ["Report damaged equipment", "P"], ["View own reports and statistics", "P"],
  ["Join or leave a court queue", "C"], ["Confirm team ready", "C"], ["Request game end, submit scores", "C"],
  ["Continue or requeue after a game", "C"], ["Name a game delegate", "C"],
];
const rightCases = [
  ["Manage courts, events, target score", "A"], ["Handle maintenance reports", "A"], ["Cancel or resolve a stuck game", "A"],
  ["View maintenance statistics", "A"], ["Call next team, expire deadlines", "S"], ["Send LINE notifications", "S"],
];
const actors = { P: { x: 180, y: 300, label: ["Player"] }, C: { x: 180, y: 820, label: ["Team captain /", "game delegate"] },
  A: { x: 1520, y: 360, label: ["Administrator"] }, S: { x: 1520, y: 880, label: ["System scheduler", "(pg_cron)"] } };
const ell = (cx, cy, text) => `<ellipse cx="${cx}" cy="${cy}" rx="185" ry="34" fill="#fff" stroke="#1f2430" stroke-width="2"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${F}" font-size="19" fill="#1f2430">${text}</text>`;
const stick = (a) => {
  const { x, y } = a;
  return `<g stroke="#1f2430" stroke-width="3" fill="none"><circle cx="${x}" cy="${y - 70}" r="22" fill="#fff"/><line x1="${x}" y1="${y - 48}" x2="${x}" y2="${y + 10}"/><line x1="${x - 38}" y1="${y - 26}" x2="${x + 38}" y2="${y - 26}"/><line x1="${x}" y1="${y + 10}" x2="${x - 30}" y2="${y + 60}"/><line x1="${x}" y1="${y + 10}" x2="${x + 30}" y2="${y + 60}"/></g>` +
    a.label.map((l, i) => `<text x="${x}" y="${y + 92 + i * 24}" text-anchor="middle" font-family="${F}" font-size="20" font-weight="bold" fill="#1f2430">${l}</text>`).join("");
};
let lines = "", shapes = "";
const place = (list, cx) => list.forEach(([text, who], i) => {
  const cy = box.y + 75 + i * ((box.h - 110) / (list.length - 1 || 1));
  const a = actors[who];
  const ex = cx < a.x ? cx + 185 : cx - 185;
  lines += `<line x1="${a.x + (a.x < cx ? 40 : -40)}" y1="${a.y - 20}" x2="${ex}" y2="${cy}" stroke="#8a8f99" stroke-width="1.6"/>`;
  shapes += ell(cx, cy, text);
});
place(leftCases, box.x + 230);
place(rightCases, box.x + box.w - 230);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#fbfaf8" stroke="#1f2430" stroke-width="2.5"/>
<text x="${box.x + box.w / 2}" y="${box.y + 34}" text-anchor="middle" font-family="${F}" font-size="22" font-weight="bold" fill="#1f2430">MeQ web application</text>
${lines}${shapes}${Object.values(actors).map(stick).join("")}
</svg>`;
sharp(Buffer.from(svg)).png().toFile("docs/report/images/use-case.png").then(() => console.log("ok"));
