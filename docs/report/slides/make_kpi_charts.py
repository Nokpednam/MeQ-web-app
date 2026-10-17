"""Render the KPI images for the presentation slides (16:9, 1920x1080).

Values come from Chapter 4 of the thesis (docs/report/report_content.py).
Run from the repository root: python docs/report/slides/make_kpi_charts.py
"""
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = os.path.dirname(os.path.abspath(__file__))
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#8a8984"
GRID = "#e4e3df"
CARD = "#ffffff"
BORDER = "#dddcd7"
GOOD = "#0ca30c"
GOOD_TEXT = "#006300"
BLUE = "#2a78d6"
plt.rcParams["font.family"] = ["Segoe UI", "DejaVu Sans"]

# (title, result, detail, criterion, status) where status is "pass" or "notmet".
KPIS = [
    ("KPI-1  Queue integrity", "0", "rule violations in 6 runs\n50 users · 0 of 533 double joins accepted", "Criterion: 0 violations", "pass"),
    ("KPI-2  Rule tests", "147 / 147", "115 database + 32 unit tests", "Criterion: all tests pass", "pass"),
    ("KPI-3  LINE notifications", "96.7%", "29 of 30 within 60 s\nmedian 1.7 s · no duplicates", "Criterion: ≥ 95% within 60 s", "pass"),
    ("KPI-4  Maintenance", "7 / 7", "steps as specified\n10 of 10 notifications within 60 s", "Criterion: every step as specified", "pass"),
    ("KPI-5  Responsiveness", "0.57 s", "slowest p95 · deployed site\n0.09 s locally with 50 users · 0 failed", "Criterion: p95 < 2 s, < 1% failed", "pass"),
    ("KPI-6  Usability (SUS)", "67.5", "mean SUS · 13 players · 17 Oct\n95% CI 59.4–75.6 · 8 of 13 at 68 or above", "Criterion: mean SUS ≥ 68", "notmet"),
    ("KPI-7  Security", "0 High", "ZAP findings · 40 / 40 privilege tests\n0 vulnerable production packages", "Criterion: no High finding", "pass"),
]


def card(fig, x, y, w, h, kpi):
    title, value, detail, criterion, status = kpi
    ax = fig.add_axes([x, y, w, h])
    ax.set_axis_off()
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.add_patch(FancyBboxPatch((0.01, 0.02), 0.98, 0.96, boxstyle="round,pad=0,rounding_size=0.04",
                                facecolor=CARD, edgecolor=BORDER, linewidth=1.5, mutation_aspect=w / h * 1.78))
    ax.text(0.07, 0.86, title, fontsize=17, fontweight="bold", color=INK, va="center")
    ax.text(0.07, 0.60, value, fontsize=44, fontweight="bold", color=INK, va="center")
    ax.text(0.07, 0.33, detail, fontsize=13.5, color=INK2, va="center", linespacing=1.4)
    ax.text(0.07, 0.11, criterion, fontsize=12.5, color=MUTED, va="center")
    if status == "pass":
        ax.text(0.93, 0.86, "✓ Pass", fontsize=15, fontweight="bold", color=GOOD_TEXT, va="center", ha="right",
                bbox=dict(boxstyle="round,pad=0.35", facecolor="#e6f5e6", edgecolor=GOOD, linewidth=1.2))
    else:
        ax.text(0.93, 0.86, "✗ Not met", fontsize=15, fontweight="bold", color="#8a4b00", va="center", ha="right",
                bbox=dict(boxstyle="round,pad=0.35", facecolor="#fff3e0", edgecolor="#e8a33c", linewidth=1.2))


def scorecard():
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=SURFACE)
    fig.text(0.04, 0.93, "Results against criteria fixed before measurement", fontsize=30, fontweight="bold", color=INK)
    passed = sum(1 for k in KPIS if k[4] == "pass")
    fig.text(0.04, 0.885, f"{passed} of 7 KPIs met · usability 0.5 points below the benchmark of 68", fontsize=18, color=INK2)
    w, h, gx, gy = 0.225, 0.37, 0.012, 0.03
    for i, kpi in enumerate(KPIS):
        row, col = divmod(i, 4)
        x = 0.04 + col * (w + gx)
        y = 0.45 - row * (h + gy)
        card(fig, x, y, w, h, kpi)
    fig.savefig(os.path.join(OUT, "kpi-scorecard.png"), facecolor=SURFACE)
    plt.close(fig)


def response_times():
    # All-request p95 per run (Table 4.7). Set A is left out: its failures came from the load generator.
    runs = [("B1", 94.2), ("B2", 88.2), ("B3", 88.6), ("C1", 567), ("C2", 506), ("C3", 477)]
    labels = ["Local · 50 users · run 1", "Local · 50 users · run 2", "Local · 50 users · run 3",
              "Deployed · 3 users · run 1", "Deployed · 3 users · run 2", "Deployed · 3 users · run 3"]
    fig, ax = plt.subplots(figsize=(19.2, 10.8), dpi=100, facecolor=SURFACE)
    fig.subplots_adjust(left=0.2, right=0.95, top=0.8, bottom=0.12)
    ax.set_facecolor(SURFACE)
    ys = [5.6, 4.6, 3.6, 2.0, 1.0, 0.0]
    for yv, (_, ms) in zip(ys, runs):
        ax.barh(yv, ms, height=0.62, color=BLUE, edgecolor=SURFACE, linewidth=2)
        ax.text(ms + 25, yv, f"{ms:g} ms", va="center", fontsize=16, color=INK)
    ax.axvline(2000, color=INK, linewidth=2, linestyle=(0, (6, 4)))
    ax.text(1985, 6.35, "Criterion: p95 < 2,000 ms", ha="right", va="center", fontsize=16, fontweight="bold", color=INK)
    ax.set_yticks(ys, labels, fontsize=16, color=INK)
    ax.set_xlim(0, 2150)
    ax.set_ylim(-0.6, 6.8)
    ax.set_xticks([0, 500, 1000, 1500, 2000], ["0", "500", "1,000", "1,500", "2,000"], fontsize=14, color=INK2)
    ax.set_xlabel("95th-percentile response time (ms)", fontsize=16, color=INK2, labelpad=12)
    ax.grid(axis="x", color=GRID, linewidth=1)
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", length=0)
    fig.text(0.04, 0.92, "KPI-5: every run well below the 2-second criterion", fontsize=30, fontweight="bold", color=INK)
    fig.text(0.04, 0.87, "0 failed requests in all six runs · Lighthouse mobile: largest content shown within 1.9 s",
             fontsize=18, color=INK2)
    fig.text(0.04, 0.04, "Local: application, database, and k6 on one laptop (set B). Deployed: Vercel + Supabase, "
             "read-only pages (set C), 16 Oct 2026.", fontsize=13, color=MUTED)
    fig.savefig(os.path.join(OUT, "kpi5-response-time.png"), facecolor=SURFACE)
    plt.close(fig)


if __name__ == "__main__":
    scorecard()
    response_times()
    print("ok")
