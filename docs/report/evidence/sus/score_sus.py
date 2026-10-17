"""Score the SUS responses of the field evaluation (KPI-6) and draw the thesis figure.

Scoring follows Brooke (1996): odd items contribute (answer - 1), even items (5 - answer),
and the sum is multiplied by 2.5. Run from the repository root:
python docs/report/evidence/sus/score_sus.py
"""
import csv
import math
import os
import statistics

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
FIGURE = os.path.join(HERE, "..", "..", "images", "sus-scores.png")
BENCHMARK = 68
T_975 = {11: 2.201, 12: 2.179}  # two-sided 95% t values by degrees of freedom

with open(os.path.join(HERE, "sus-responses-2026-10-17.csv"), encoding="utf-8") as f:
    rows = list(csv.reader(f))[1:]
answers = [[int(x) for x in r[2:12]] for r in rows]
scores = [2.5 * sum((a - 1) if i % 2 == 0 else (5 - a) for i, a in enumerate(v)) for v in answers]
n = len(scores)
mean, sd = statistics.mean(scores), statistics.stdev(scores)
half = T_975[n - 1] * sd / math.sqrt(n)
print(f"n={n} mean={mean:.2f} sd={sd:.2f} median={statistics.median(scores)} min={min(scores)} max={max(scores)}")
print(f"scores {sorted(scores)}")
print(f"95% CI {mean - half:.1f} to {mean + half:.1f}; at or above {BENCHMARK}: {sum(s >= BENCHMARK for s in scores)}")
for i in range(10):
    print(f"item {i + 1}: {statistics.mean(v[i] for v in answers):.2f}")

INK, INK2, MUTED, GRID, SURFACE, BLUE = "#0b0b0b", "#52514e", "#8a8984", "#e4e3df", "#ffffff", "#2a78d6"
plt.rcParams["font.family"] = ["Arial", "DejaVu Sans"]
fig, ax = plt.subplots(figsize=(7.5, 2.9), dpi=200, facecolor=SURFACE)
fig.subplots_adjust(left=0.05, right=0.97, top=0.82, bottom=0.2)
counts = {}
for s in sorted(scores):
    k = counts.get(s, 0)
    counts[s] = k + 1
    ax.scatter(s, 0.12 + 0.22 * k, s=70, color=BLUE, edgecolor=SURFACE, linewidth=1.5, zorder=3)
ax.errorbar(mean, -0.55, xerr=half, fmt="o", color=INK, markersize=8, capsize=5, linewidth=2, zorder=3)
# Round half up, so that 66.25 is reported as 66.3 as in the text.
r1 = lambda x: f"{math.floor(x * 10 + 0.5) / 10:.1f}"
ax.text(mean - half - 1.2, -0.55, f"mean {r1(mean)}\n95% CI {r1(mean - half)}–{r1(mean + half)}", ha="right", va="center",
        fontsize=9, color=INK, linespacing=1.3)
ax.axvline(BENCHMARK, color=INK2, linewidth=1.5, linestyle=(0, (5, 3)), zorder=2)
ax.text(BENCHMARK + 0.8, 1.55, f"benchmark {BENCHMARK}", fontsize=9, color=INK2, va="center")
ax.text(0, 1.55, "Each dot is one participant", fontsize=9, color=MUTED, va="center", transform=ax.get_yaxis_transform())
ax.set_xlim(30, 100)
ax.set_ylim(-1.5, 1.8)
ax.set_yticks([])
ax.set_xticks(range(30, 101, 10))
ax.tick_params(axis="x", labelsize=9, colors=INK2, length=0)
ax.set_xlabel("SUS score (0–100)", fontsize=9, color=INK2)
ax.grid(axis="x", color=GRID, linewidth=0.8)
ax.set_axisbelow(True)
for side in ("top", "right", "left"):
    ax.spines[side].set_visible(False)
ax.spines["bottom"].set_color(GRID)
fig.savefig(FIGURE, facecolor=SURFACE)
print("figure", os.path.normpath(FIGURE))
