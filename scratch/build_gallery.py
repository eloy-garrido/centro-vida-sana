import glob
import os

images = sorted(glob.glob('scratch/shkraba*.jpg') + glob.glob('scratch/pexels*.jpg'))
with open('scratch/view_shkraba.html', 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><body style="background:#222;color:#fff;display:flex;flex-wrap:wrap;gap:10px;">\n')
    for img in images:
        name = os.path.basename(img)
        f.write(f'<div style="width:240px;text-align:center;"><img src="{name}" style="width:100%;height:150px;object-fit:cover;"/><br/><small>{name}</small></div>\n')
    f.write('</body></html>\n')
print('Done. Total images:', len(images))
