"""Generate all PWA and UI icons from the official WhatsApp Add-on logo.

Usage:
    python scripts/generate-icons.py
"""

import os
from pathlib import Path

from PIL import Image


def generate_icons():
    root_dir = Path(__file__).resolve().parent.parent
    logo_path = root_dir.parent / "logo.png"
    ui_dir = root_dir / "src" / "routes" / "ui"

    if not logo_path.exists():
        print(f"Error: Logo file not found at {logo_path}")
        return

    img = Image.open(logo_path).convert("RGBA")
    print(f"Loaded official logo: {img.size} from {logo_path}")

    sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512]

    for s in sizes:
        target_path = ui_dir / f"icon-{s}.png"
        resized = img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(target_path, format="PNG")
        print(f"Generated {target_path.name} ({s}x{s})")

    # Multi-resolution favicon.ico
    ico_path = ui_dir / "favicon.ico"
    img.resize((48, 48), Image.Resampling.LANCZOS).save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Generated favicon.ico (16, 32, 48)")


if __name__ == "__main__":
    generate_icons()
