#!/usr/bin/env python3
"""Compila las hojas de estilo y las incrusta INLINE en index.html.

El sitio no tiene build pipeline: este script se ejecuta a mano cada vez que
se edita un CSS fuente. Concatena y minifica los archivos de styles/, escribe
styles/bundle.min.css (solo como referencia/depuracion) y reemplaza el bloque
<style> entre los marcadores bundle-css de index.html. Al ir inline, no hay
solicitud de CSS bloqueante ni cadena critica, y no hace falta versionar.

    python scripts/build-css.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLES = ROOT / "styles"
HTML = ROOT / "index.html"

BUNDLE_START = "<!-- bundle-css:start (generado por scripts/build-css.py; no editar a mano) -->"
BUNDLE_END = "<!-- bundle-css:end -->"

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


def build_bundle() -> str:
    parts = []
    for name, media in SOURCES:
        css = (STYLES / name).read_text(encoding="utf-8")
        css = minify(css)
        if media:
            css = f"@media {media}{{{css}}}"
        parts.append(css)
    return "\n".join(parts)


def inline_into_html(css: str) -> None:
    html = HTML.read_text(encoding="utf-8")
    try:
        start = html.index(BUNDLE_START) + len(BUNDLE_START)
        end = html.index(BUNDLE_END)
    except ValueError:
        raise SystemExit(
            f"No se encontraron los marcadores bundle-css en {HTML}. "
            "Restaura los comentarios bundle-css:start / bundle-css:end."
        )
    html = html[:start] + f"\n    <style>{css}</style>\n    " + html[end:]
    HTML.write_text(html, encoding="utf-8")


def main() -> None:
    css = build_bundle()
    out = STYLES / "bundle.min.css"
    out.write_text(css, encoding="utf-8")
    inline_into_html(css)
    print(f"OK bundle: {len(css) / 1024:.1f} KiB minificado")
    print(f"OK escrito {out} (referencia) e incrustado inline en {HTML}")


if __name__ == "__main__":
    main()
