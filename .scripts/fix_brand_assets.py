#!/usr/bin/env python3
"""Auto-fix and standardize Home Assistant Add-on brand assets (icon.png and logo.png).

Ensures:
1. icon.png exists and is in true PNG format (converts JPEGs named .png to genuine PNG) and square (1:1).
2. logo.png exists and is in true PNG format. If missing or square (1:1), generates a landscape banner.
3. If an existing logo is already a valid non-square landscape banner, it is untouched.
"""

import os
import sys

import yaml
from PIL import Image, ImageDraw, ImageFont


def get_addon_title(addon_dir: str) -> str:
    cfg_file = os.path.join(addon_dir, "config.yaml")
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
                if isinstance(cfg, dict) and "name" in cfg:
                    return str(cfg["name"])
        except Exception:
            pass
    return os.path.basename(os.path.abspath(addon_dir)).replace("-", " ").title()


def fix_icon(addon_dir: str) -> bool:
    icon_path = os.path.join(addon_dir, "icon.png")
    if not os.path.exists(icon_path):
        return False

    try:
        im = Image.open(icon_path)
        changed = False

        # Convert JPEG (or other formats) falsely named .png into genuine PNG
        if im.format != "PNG":
            print(f"Converting {icon_path} from {im.format} to genuine PNG")
            im_rgba = im.convert("RGBA")
            im_rgba.save(icon_path, format="PNG")
            im = Image.open(icon_path)
            changed = True

        if im.width != im.height:
            print(f"Fixing non-square icon in {addon_dir}: {im.size}")
            im_rgba = im.convert("RGBA")
            max_dim = max(im.width, im.height)
            square_img = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
            square_img.paste(im_rgba, ((max_dim - im.width) // 2, (max_dim - im.height) // 2))
            if max_dim < 256 or max_dim > 1024:
                square_img = square_img.resize((256, 256), Image.Resampling.LANCZOS)
            square_img.save(icon_path, format="PNG")
            changed = True

        return changed
    except Exception as e:
        print(f"Error inspecting icon {icon_path}: {e}")
    return False


def generate_landscape_logo(addon_dir: str, title: str, subtitle: str | None = None) -> bool:
    icon_path = os.path.join(addon_dir, "icon.png")
    logo_path = os.path.join(addon_dir, "logo.png")
    if not os.path.exists(icon_path):
        return False

    try:
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
        font_b_path = next((p for p in font_paths if os.path.exists(p)), None)

        font_sub_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/TTF/DejaVuSans.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
        font_s_path = next((p for p in font_sub_paths if os.path.exists(p)), None)

        if font_b_path:
            font_title = ImageFont.truetype(font_b_path, 48)
        else:
            font_title = ImageFont.load_default()

        if font_s_path:
            font_sub = ImageFont.truetype(font_s_path, 28)
        else:
            font_sub = ImageFont.load_default()

        dummy = Image.new("RGBA", (10, 10))
        d = ImageDraw.Draw(dummy)
        t_bbox = d.textbbox((0, 0), title, font=font_title)
        t_width = t_bbox[2] - t_bbox[0]

        s_width = 0
        if subtitle:
            s_bbox = d.textbbox((0, 0), subtitle, font=font_sub)
            s_width = s_bbox[2] - s_bbox[0]

        text_max_w = max(t_width, s_width)

        h = 180
        badge_size = 140
        padding = 24
        spacing = 20

        total_w = padding + badge_size + spacing + text_max_w + padding + 10
        total_w = max(total_w, 512)

        banner = Image.new("RGBA", (total_w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(banner)

        icon = Image.open(icon_path).convert("RGBA")
        bbox = icon.getbbox()
        if bbox:
            icon = icon.crop(bbox)

        scale = min(badge_size / icon.width, badge_size / icon.height)
        new_w = int(icon.width * scale)
        new_h = int(icon.height * scale)
        icon_resized = icon.resize((new_w, new_h), Image.Resampling.LANCZOS)

        icon_x = padding + (badge_size - new_w) // 2
        icon_y = (h - new_h) // 2
        banner.paste(icon_resized, (icon_x, icon_y), icon_resized)

        text_x = padding + badge_size + spacing
        if subtitle:
            title_y = (h - (48 + 10 + 28)) // 2 - 4
            sub_y = title_y + 48 + 8
            draw.text((text_x, title_y), title, font=font_title, fill=(31, 31, 31, 255))
            draw.text((text_x, sub_y), subtitle, font=font_sub, fill=(95, 99, 104, 255))
        else:
            title_y = (h - 48) // 2 - 4
            draw.text((text_x, title_y), title, font=font_title, fill=(31, 31, 31, 255))

        banner.save(logo_path, format="PNG")
        print(f"Generated landscape logo for {addon_dir} ({total_w}x{h})")
        return True
    except Exception as e:
        print(f"Failed to generate logo for {addon_dir}: {e}")
        return False


def fix_logo(addon_dir: str) -> bool:
    icon_path = os.path.join(addon_dir, "icon.png")
    logo_path = os.path.join(addon_dir, "logo.png")

    if not os.path.exists(icon_path):
        return False

    needs_generation = False
    if not os.path.exists(logo_path):
        needs_generation = True
    else:
        try:
            lim = Image.open(logo_path)
            if lim.width == lim.height or lim.format != "PNG":
                needs_generation = True
        except Exception:
            needs_generation = True

    if needs_generation:
        title = get_addon_title(addon_dir)
        subtitle = None
        base_name = os.path.basename(os.path.abspath(addon_dir))
        if base_name == "antigravity":
            title = "Antigravity"
            subtitle = "Quota Monitor"
        elif base_name == "antigravity-server":
            title = "Antigravity"
            subtitle = "Server"
        return generate_landscape_logo(addon_dir, title, subtitle)

    return False


def process_all():
    changed = False
    for root, dirs, files in os.walk("."):
        if "config.yaml" in files:
            parts = root.split(os.sep)
            if any(p.startswith(".") for p in parts if p != "."):
                continue
            if fix_icon(root):
                changed = True
            if fix_logo(root):
                changed = True
    return changed


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for target in sys.argv[1:]:
            if os.path.isdir(target):
                fix_icon(target)
                fix_logo(target)
    else:
        process_all()
