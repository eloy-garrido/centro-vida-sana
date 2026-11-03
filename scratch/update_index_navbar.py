from pathlib import Path

index_path = Path("index.html")
content = index_path.read_text(encoding="utf-8")
c_normalized = content.replace("\r\n", "\n")

nav_old = """            <a href="#hero" class="nav-logo" aria-label="Centro Vida Sana Austral - Inicio">
                <img src="pix/logo-horizontal.png" alt="Centro Vida Sana Austral" width="819" height="82"
                    class="nav-logo-img" loading="eager" decoding="async">
            </a>"""

nav_new = """            <a href="#hero" class="nav-logo" aria-label="Centro Vida Sana - Inicio">
                <img src="pix/yinyang.webp" alt="Logo Yin Yang Centro Vida Sana" width="38" height="38"
                    class="nav-logo-icon" loading="eager" decoding="async">
                <span class="nav-logo-text">Centro Vida Sana</span>
            </a>"""

if nav_old in c_normalized:
    c_normalized = c_normalized.replace(nav_old, nav_new)
    print("Navbar in index.html updated OK")
else:
    print("Navbar in index.html NOT FOUND")

index_path.write_text(c_normalized.replace("\n", "\r\n"), encoding="utf-8")
print("Saved index.html")
