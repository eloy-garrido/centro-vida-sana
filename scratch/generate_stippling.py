import random
import math

w = 240
h = 140
random.seed(333)

# Progressive density stippling
# We want 30 layers
dots = []

# Layer 0: solid anchor wave at top
# path from y=0 to y=12 with organic wave

# Layers 1 to 28
num_layers = 28

for step in range(num_layers):
    t = step / (num_layers - 1)  # 0.0 to 1.0
    y_center = 10 + t * (h - 15)
    
    # Radius decays from 5.5 down to 0.7
    # Use smooth easing: slow decay at start, then gradual
    r = 5.2 * (1.0 - 0.86 * (t ** 0.75))
    
    # Count of dots: at top we want dense overlapping dots, at bottom very sparse
    # Top: ~42 dots in 240px width (spacing dx = 5.7px, radius = 5.2px -> heavy overlap!)
    # Bottom: ~4 dots in 240px width (spacing dx = 60px, radius = 0.8px -> very sparse!)
    count = int(44 * (1.0 - 0.92 * (t ** 0.6)))
    count = max(count, 3)
    
    dx = w / count
    for i in range(count):
        # Organic jitter in x and y
        jitter_x = random.uniform(-dx * 0.4, dx * 0.4)
        jitter_y = random.uniform(-2.2, 2.2)
        
        x = (i * dx + dx * 0.5 + jitter_x) % w
        y = y_center + jitter_y
        dot_r = max(0.5, r * random.uniform(0.88, 1.12))
        
        dots.append((round(x, 2), round(y, 2), round(dot_r, 2)))
        
        # Wrap edges for seamless horizontal tiling
        if x < dot_r:
            dots.append((round(x + w, 2), round(y, 2), round(dot_r, 2)))
        elif x > w - dot_r:
            dots.append((round(x - w, 2), round(y, 2), round(dot_r, 2)))

dots.sort(key=lambda d: d[1])

circle_elements = [f'      <circle cx="{x}" cy="{y}" r="{r}" />' for x, y, r in dots]

svg_code = f'''<svg class="w-full h-24 sm:h-32 md:h-40 block -mb-[1px]" viewBox="0 0 {w} {h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="pointillism-fade" width="{w}" height="{h}" patternUnits="userSpaceOnUse">
      <!-- Background matching #profesionales (#FBFDFB) -->
      <rect width="{w}" height="{h}" fill="#FBFDFB" />
      <!-- Solid top anchor connecting seamlessly to intro section (#007231) -->
      <path d="M0,0 L{w},0 L{w},10 Q180,15 120,9 Q60,5 0,10 Z" fill="#007231" />
      <!-- Dense-to-sparse pointillism dots -->
      <g fill="#007231">
{chr(10).join(circle_elements)}
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#pointillism-fade)" />
</svg>'''

with open('scratch/organic_pointillism.svg', 'w', encoding='utf-8') as f:
    f.write(svg_code)

print(f"Generated {len(dots)} stippling dots with smooth progressive density")
