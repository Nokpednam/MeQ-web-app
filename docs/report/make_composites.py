"""Combine phone screenshots into side-by-side figures with (a), (b), (c) labels.

Run from the repository root: python docs/report/make_composites.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "screenshots")
OUT = os.path.join(HERE, "images")
PHONE_W, PHONE_H, GAP, LABEL_H = 600, 1333, 70, 110

COMPOSITES = {
    "ui-player-pages.png": ["login", "home", "court-queue"],
    "ui-checkin-maintenance.png": ["check-in", "maintenance-form", "admin-maintenance"],
    "guide-start.png": ["welcome-guide", "team"],
    "guide-queue.png": ["court-queue", "check-in"],
    "guide-game.png": ["scores", "result"],
    "guide-maintenance.png": ["maintenance-form", "line-chat"],
}

try:
    font = ImageFont.truetype("arial.ttf", 64)
except OSError:
    font = ImageFont.load_default()

for name, shots in COMPOSITES.items():
    width = len(shots) * PHONE_W + (len(shots) - 1) * GAP
    canvas = Image.new("RGB", (width, PHONE_H + LABEL_H), "white")
    draw = ImageDraw.Draw(canvas)
    for i, shot in enumerate(shots):
        phone = Image.open(os.path.join(SHOTS, shot + ".png")).convert("RGB").resize((PHONE_W, PHONE_H), Image.LANCZOS)
        x = i * (PHONE_W + GAP)
        canvas.paste(phone, (x, 0))
        draw.rectangle([x, 0, x + PHONE_W - 1, PHONE_H - 1], outline="#BFBFBF", width=3)
        label = f"({chr(ord('a') + i)})"
        tw = draw.textlength(label, font=font)
        draw.text((x + (PHONE_W - tw) / 2, PHONE_H + 25), label, fill="black", font=font)
    canvas.save(os.path.join(OUT, name))
    print(name, canvas.size)
