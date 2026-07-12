#!/usr/bin/env python3
"""Genera styles/bundle.min.css concatenando y minificando las hojas de estilo.

El sitio no tiene build pipeline: este script se ejecuta a mano cada vez que
se edita un CSS fuente, y el bundle resultante se sube al repo.

    python scripts/build-css.py

Luego incrementar ?v= del bundle en index.html para invalidar cache.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLES = ROOT / "styles"

# Orden de cascada: replica el orden original de los <link> en index.html.
# responsive.css se envuelve en @media (max-width: 1024px) porque su <link>
# original llevaba ese atributo media (sus reglas min-width:1400px nunca
# aplicaban y no deben empezar a aplicar).
SOURCES = [
    ("fonts.css", None),
    ("animations.css", None),
    ("hero.css", None),
    ("core.css", None),
    ("responsive.css", "(max-width: 1024px)"),
    ("pathologies.css", None),
    ("services.css", None),
    ("study.css", None),
]


def minify(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)          # comentarios
    css = re.sub(r"\s+", " ", css)                            # espacios
    css = re.sub(r"\s*([{}:;,>~])\s*", r"\1", css)            # alrededor de símbolos
    css = re.sub(r";}", "}", css)                             # ; final
    return css.strip()


def main() -> None:
    parts = []
    for name, media in SOURCES:
        css = (STYLES / name).read_text(encoding="utf-8")
        css = minify(css)
        if media:
            css = f"@media {media}{{{css}}}"
        parts.append(css)
    out = STYLES / "bundle.min.css"
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"OK {out} ({out.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
