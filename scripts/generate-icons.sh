#!/bin/bash
# Generate PWA icons from SVG using built-in macOS tools
set -euo pipefail

ICONS_DIR="$(dirname "$0")/../public/icons"
mkdir -p "$ICONS_DIR"

# Create a simple GBA-themed SVG
cat > /tmp/gba-icon.svg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1a1a2e"/>
  <rect x="96" y="80" width="320" height="200" rx="16" fill="#0f3460"/>
  <rect x="120" y="100" width="272" height="160" rx="8" fill="#9be36d"/>
  <rect x="120" y="100" width="272" height="160" rx="8" fill="#7bc043" opacity="0.8"/>
  <!-- D-pad -->
  <rect x="120" y="320" width="24" height="72" rx="4" fill="#e0e0e0"/>
  <rect x="96" y="344" width="72" height="24" rx="4" fill="#e0e0e0"/>
  <!-- A/B -->
  <circle cx="380" cy="330" r="20" fill="#e74c3c"/>
  <circle cx="340" cy="360" r="20" fill="#3498db"/>
  <!-- Start/Select -->
  <rect x="200" y="400" width="48" height="12" rx="6" fill="#888"/>
  <rect x="264" y="400" width="48" height="12" rx="6" fill="#888"/>
  <text x="212" y="430" font-size="10" fill="#aaa" font-family="sans-serif">SEL</text>
  <text x="272" y="430" font-size="10" fill="#aaa" font-family="sans-serif">STA</text>
</svg>
SVG

# Use sips (macOS built-in) to convert SVG to PNG at different sizes
# sips can't do SVG, so use a quick qlmanage approach or just copy the SVG
# Actually, let's use the canvas approach in the browser. For now, just put SVGs.

# Simple approach: create PNGs using Python (available on macOS)
python3 << 'PYTHON'
import subprocess, os

svg_path = "/tmp/gba-icon.svg"
icons_dir = os.environ.get("ICONS_DIR", "public/icons")

for size in [192, 512]:
    out = os.path.join(icons_dir, f"icon-{size}.png")
    # Use rsvg-convert if available, otherwise qlmanage
    try:
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), svg_path, "-o", out], check=True)
    except FileNotFoundError:
        # Fallback: use sips on a rendered version
        subprocess.run(["qlmanage", "-t", "-s", str(size), "-o", "/tmp", svg_path],
                       capture_output=True)
        tmp_png = f"/tmp/gba-icon.svg.png"
        if os.path.exists(tmp_png):
            subprocess.run(["sips", "-z", str(size), str(size), tmp_png, "--out", out], capture_output=True)

# Maskable is same as 512 for now
import shutil
src = os.path.join(icons_dir, "icon-512.png")
dst = os.path.join(icons_dir, "icon-512-maskable.png")
if os.path.exists(src):
    shutil.copy2(src, dst)

print("Icons generated!")
PYTHON
