from pathlib import Path

index_path = Path("index.html")
content = index_path.read_text(encoding="utf-8")

c_normalized = content.replace("\r\n", "\n")

nav_old = """            <div class="nav-logo">
                <picture>
                    <source srcset="pix/logo-sin-texto-96.webp" type="image/webp">
                    <img src="pix/logo-sin-texto-96.webp" alt="Logo Centro Vida Sana Austral" width="40"
                        height="40">
                </picture>
                <span>Centro Vida Sana Austral</span>
            </div>"""

nav_new = """            <a href="#hero" class="nav-logo" aria-label="Centro Vida Sana Austral - Inicio">
                <img src="pix/logo-horizontal.png" alt="Centro Vida Sana Austral" width="819" height="82"
                    class="nav-logo-img" loading="eager" decoding="async">
            </a>"""

footer_old = """                <div class="footer-logo">
                    <picture>
                        <source srcset="pix/yinyang.webp" type="image/webp">
                        <img src="pix/yinyang.webp" alt="Centro Vida Sana Austral - Logo Yin Yang" class="logo-footer"
                            loading="lazy" width="120" height="120">
                    </picture>
                </div>"""

footer_new = """                <div class="footer-logo">
                    <a href="#hero" class="footer-logo-badge" aria-label="Centro Vida Sana Austral - Inicio">
                        <img src="pix/logo-horizontal2.png" alt="Centro Vida Sana Austral - centrovidasana.cl"
                            class="logo-footer-horizontal" loading="lazy" width="620" height="171" decoding="async">
                    </a>
                </div>"""

if nav_old in c_normalized:
    c_normalized = c_normalized.replace(nav_old, nav_new)
    print("Navbar OK")
else:
    print("Navbar FAIL")

if footer_old in c_normalized:
    c_normalized = c_normalized.replace(footer_old, footer_new)
    print("Footer OK")
else:
    print("Footer FAIL")

index_path.write_text(c_normalized.replace("\n", "\r\n"), encoding="utf-8")
print("Saved index.html")
