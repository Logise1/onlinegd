"""
Download Geometry Dash sprites from gdcolon.com
Maps each URL to the filename expected by objects.js / player.js
"""

import os
import urllib.request

SPRITES_DIR = os.path.join(os.path.dirname(__file__), "sprites")
os.makedirs(SPRITES_DIR, exist_ok=True)

# Map: filename -> URL
DOWNLOADS = {
    # ── Mode portals ──
    "portal_cube.png":    "https://gdcolon.com/obj/12.png",
    "portal_ship.png":    "https://gdcolon.com/obj/13.png",
    "portal_ball.png":    "https://gdcolon.com/obj/47.png",
    "portal_ufo.png":     "https://gdcolon.com/obj/111.png",
    "portal_wave.png":    "https://gdcolon.com/obj/660.png",
    "portal_robot.png":   "https://gdcolon.com/obj/745.png",
    "portal_spider.png":  "https://gdcolon.com/obj/1331.png",

    # ── Gravity portals ──
    "portal_gravity.png":        "https://gdcolon.com/obj/11.png",
    "portal_gravity_normal.png": "https://gdcolon.com/obj/10.png",

    # ── Size portals ──
    "portal_size_normal.png": "https://gdcolon.com/obj/99.png",
    "portal_size_mini.png":   "https://gdcolon.com/obj/101.png",

    # ── Speed portals ──
    "portal_speed_slow.png":   "https://gdcolon.com/obj/200.png",
    "portal_speed_normal.png": "https://gdcolon.com/obj/201.png",
    "portal_speed_fast.png":   "https://gdcolon.com/obj/202.png",
    "portal_speed_vfast.png":  "https://gdcolon.com/obj/203.png",
    "portal_speed_vvfast.png": "https://gdcolon.com/obj/1334.png",

    # ── Pads ──
    "pad_yellow.png": "https://gdcolon.com/obj/35.png",
    "pad_red.png":    "https://gdcolon.com/obj/1332.png",
    "pad_pink.png":   "https://gdcolon.com/obj/140.png",
    "pad_blue.png":   "https://gdcolon.com/obj/67.png",

    # ── Orbs ──
    "orb_yellow.png": "https://gdcolon.com/obj/36.png",
    "orb_red.png":    "https://gdcolon.com/obj/1333.png",
    "orb_green.png":  "https://gdcolon.com/obj/1022.png",
    "orb_blue.png":   "https://gdcolon.com/obj/84.png",
    "orb_pink.png":   "https://gdcolon.com/obj/141.png",
    "orb_black.png":  "https://gdcolon.com/obj/1330.png",
}


def download_sprite(filename, url):
    path = os.path.join(SPRITES_DIR, filename)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()

            # Detect real extension from content-type
            ext_map = {
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/webp": ".webp",
                "image/gif": ".gif",
                "image/svg+xml": ".svg",
            }
            real_ext = ext_map.get(content_type.split(";")[0].strip(), ".png")

            # If the real extension differs, rename to match
            if not filename.endswith(real_ext):
                new_filename = os.path.splitext(filename)[0] + real_ext
                path = os.path.join(SPRITES_DIR, new_filename)
                print(f"  ⚠ Content-Type is {content_type} → saving as {new_filename}")

            with open(path, "wb") as f:
                f.write(data)

            size_kb = len(data) / 1024
            print(f"  ✓ {filename}  ({size_kb:.1f} KB)")
            return True
    except Exception as e:
        print(f"  ✗ {filename}  ERROR: {e}")
        return False


if __name__ == "__main__":
    print(f"Downloading {len(DOWNLOADS)} sprites to {SPRITES_DIR}\n")
    ok = 0
    fail = 0
    for name, url in DOWNLOADS.items():
        success = download_sprite(name, url)
        if success:
            ok += 1
        else:
            fail += 1
    print(f"\nDone: {ok} downloaded, {fail} failed")
