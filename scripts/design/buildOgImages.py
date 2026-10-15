"""Markenbilder des Elektroplaners erzeugen (Vorschaukarte 1200×630, Logo 512×512).

Hintergrund: Die Dateien hießen bis Oktober 2026 `werft.png`/`werft-mark.png`
und trugen die alte Wortmarke. Sie sind umbenannt; dieses Skript erzeugt den
Inhalt neu — in denselben Maßen, mit demselben Aufbau und mit den Farben und
Schriften der Markenebene (`app/globals.css`):

    Fläche   #eceef0  (--surface-canvas hell)
    Tinte    #16181a  (--text-high)
    Beiwort  #4a5158  (--text-med)
    Kupfer   #a34a24  (--oxide hell)
    Logo     #1a1d20  (--soot)

Schriftverteilung wie im Produkt: Outfit für die Überschrift (`font-display`),
IBM Plex Mono für gesperrte Beiworte und Werte.

Aufruf (Pillow und fontTools nötig):

    python scripts/design/buildOgImages.py

Die Schriften werden beim ersten Lauf aus `node_modules/@fontsource*` gezogen
und im Zwischenspeicher (`OG_FONTS_DIR`, Vorgabe `/tmp/elektroplaner-fonts`)
abgelegt — der Lauf ist damit reproduzierbar, ohne dass Schriftdateien im
Repository liegen.
"""

from __future__ import annotations

import os
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
FONTS_DIR = pathlib.Path(os.environ.get("OG_FONTS_DIR", "/tmp/elektroplaner-fonts"))

# ── Markenwerte aus app/globals.css ──────────────────────────────────────
BG = (236, 238, 240)  # --surface-canvas (hell)
INK = (22, 24, 26)  # --text-high
INK_SOFT = (74, 81, 88)  # --text-med
OXIDE = (163, 74, 36)  # --oxide (hell)
SOOT = (26, 29, 32)  # --soot (Logo-Hintergrund)


def ensure_fonts() -> dict[str, pathlib.Path]:
    """Legt die benötigten Schriftschnitte im Zwischenspeicher ab.

    Die Quellen sind die Dateien, die die Anwendung ohnehin ausliefert:
    Variable Schriften (Inter, Outfit) werden auf den benötigten Schnitt
    festgeschrieben, die statische Mono-Schrift wird entpackt.
    """
    wanted = {
        "display": FONTS_DIR / "Outfit-600.ttf",
        "mono": FONTS_DIR / "PlexMono-400.ttf",
        "mono-bold": FONTS_DIR / "PlexMono-500.ttf",
    }
    if all(path.exists() for path in wanted.values()):
        return wanted

    try:
        from fontTools.ttLib import TTFont
        from fontTools.varLib.instancer import instantiateVariableFont
    except ImportError:  # pragma: no cover - Hinweis statt Absturz
        sys.exit(
            "fontTools fehlt. Entweder `pip install fonttools brotli` ausführen "
            "oder die Schriftschnitte unter OG_FONTS_DIR bereitstellen."
        )

    FONTS_DIR.mkdir(parents=True, exist_ok=True)

    variable = ROOT / "node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2"
    outfit = TTFont(variable)
    instantiateVariableFont(outfit, {"wght": 600}, inplace=True)
    outfit.save(wanted["display"])

    for weight, target in ((400, wanted["mono"]), (500, wanted["mono-bold"])):
        source = (
            ROOT
            / f"node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-{weight}-normal.woff2"
        )
        font = TTFont(source)
        font.flavor = None  # als TTF ablegen, nicht als woff2
        font.save(target)

    return wanted


def text_layer(text: str, font_path: pathlib.Path, size: int, tracking: float) -> Image.Image:
    """Text auf transparentem Grund, Zeichen für Zeichen gesperrt."""
    font = ImageFont.truetype(str(font_path), size)
    layer = Image.new("L", (2600, 600), 0)
    draw = ImageDraw.Draw(layer)
    x = 0.0
    for char in text:
        draw.text((x, 0), char, font=font, fill=255)
        x += draw.textlength(char, font=font) + tracking
    return layer.crop(layer.getbbox())


def tracking_for(
    text: str, font_path: pathlib.Path, size: int, target_width: int, base: float = 0.0
) -> float:
    """Sperrung, mit der die Zeile die Zielbreite trifft (Breite = Vorgabe)."""
    measured = text_layer(text, font_path, size, base).width
    return base + (target_width - measured) / max(len(text) - 1, 1)


def place(canvas: Image.Image, layer: Image.Image, x: int, y: int, color) -> None:
    """Setzt eine Textmaske in der Zielfarbe an (x, y)."""
    canvas.paste(Image.new("RGB", layer.size, color), (x, y), layer)


def build_og_card(fonts: dict[str, pathlib.Path]) -> None:
    """Vorschaukarte: Kanten, Zeilenbänder und Strichlänge der Vorgängerkarte."""
    canvas = Image.new("RGB", (1200, 630), BG)
    left = 72

    eyebrow = text_layer(
        "ELEKTROPLANER", fonts["mono-bold"], 24, tracking_for("ELEKTROPLANER", fonts["mono-bold"], 24, 300)
    )
    place(canvas, eyebrow, left - 2, 85, OXIDE)

    headline = text_layer(
        "Camper-Ausbau planen",
        fonts["display"],
        70,
        tracking_for("Camper-Ausbau planen", fonts["display"], 70, 885),
    )
    place(canvas, headline, left, 205, INK)

    subtitle_text = "Elektrik · Dach · Heizung · Reihenfolge"
    subtitle = text_layer(
        subtitle_text, fonts["mono"], 34, tracking_for(subtitle_text, fonts["mono"], 34, 840)
    )
    place(canvas, subtitle, left, 316, INK_SOFT)

    ImageDraw.Draw(canvas).rectangle([70, 420, 230, 426], fill=OXIDE)

    footer_text = "Erst der Plan. Dann das Blech."
    footer = text_layer(footer_text, fonts["mono"], 25, tracking_for(footer_text, fonts["mono"], 25, 556))
    place(canvas, footer, left, 482, INK_SOFT)

    target = ROOT / "public/og/elektroplaner.png"
    canvas.save(target, optimize=True)
    print(f"{target.relative_to(ROOT)} — {canvas.width}×{canvas.height}")


def build_logo(fonts: dict[str, pathlib.Path]) -> None:
    """Logo: Monogramm in derselben Fläche und Farbe wie die Vorgängermarke."""
    size = 512
    canvas = Image.new("RGB", (size, size), SOOT)

    glyph = text_layer("EP", fonts["display"], 300, -6)
    # Auf die Kantenlänge der Vorgängermarke bringen, damit das Logo in
    # Ergebnislisten gleich groß erscheint (rund 350 px).
    scale = 350 / max(glyph.size)
    glyph = glyph.resize((max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))))
    place(canvas, glyph, (size - glyph.width) // 2, (size - glyph.height) // 2, OXIDE)

    target = ROOT / "public/og/elektroplaner-mark.png"
    canvas.save(target, optimize=True)
    print(f"{target.relative_to(ROOT)} — {canvas.width}×{canvas.height}")


if __name__ == "__main__":
    schriften = ensure_fonts()
    build_og_card(schriften)
    build_logo(schriften)
