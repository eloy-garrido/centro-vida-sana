from pathlib import Path
import re

html_path = Path("index.html")
content = html_path.read_text(encoding="utf-8")

# Normalize newlines
content = content.replace("\r\n", "\n").replace("\r", "\n")
content = re.sub(r"\n{3,}", "\n\n", content)

old_nav_pattern = re.compile(r'<a href="#hero" class="nav-logo" aria-label="Centro Vida Sana Austral - Inicio">[\s\S]*?</a>')
new_nav = """<a href="#hero" class="nav-logo" aria-label="Centro Vida Sana - Inicio">
                <img src="pix/yinyang.webp" alt="Logo Yin Yang Centro Vida Sana" width="38" height="38"
                    class="nav-logo-icon" loading="eager" decoding="async">
                <span class="nav-logo-text">Centro Vida Sana</span>
            </a>"""

res = old_nav_pattern.subn(new_nav, content)
content = res[0]
count = res[1]
print("Replaced nav count:", count)

html_path.write_text(content, encoding="utf-8")
print("Saved index.html successfully")
