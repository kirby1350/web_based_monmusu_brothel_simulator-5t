# 衣橱图标：public/icons/{outfit,stocking}/<id>.webp（128×128）+ 联系表 /workspace/outfit-icons.png
# 源图放在 /workspace/outfit-icons-src/<id>.png（或 .jpg/.webp），取居中正方形（可在 OVR 里手动指定）后缩放。
# 没有源图、且 public 里也还没有图标的条目，生成一张「占位」图标（深紫暗角 + 金色名字），保证游戏和测试不缺图。
# 用法：python3 scripts/outfit-icons.py            （在仓库根目录运行）
import glob, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = '/workspace/outfit-icons-src/'
ITEMS = [  # (类别, id, 中文名) —— 与 lib/catalog.ts 的 OUTFITS / STOCKINGS 保持一致
  ('outfit', 'regular', '她的常服'), ('outfit', 'maid', '露肩迷你女仆装'), ('outfit', 'kimono', '松襟振袖'),
  ('outfit', 'crotchless', '开裆蕾丝情趣内衣'), ('outfit', 'restraint', '皮带拘束衣'), ('outfit', 'queen', '漆皮女王装'),
  ('outfit', 'bunny', '兔女郎装'), ('outfit', 'qipao', '高开衩旗袍'), ('outfit', 'dancer', '舞娘纱衣'),
  ('outfit', 'babydoll', '透纱睡裙'), ('outfit', 'sling', '吊带泳衣'), ('outfit', 'nurse', '护士装'),
  ('outfit', 'school', '学生制服'), ('outfit', 'miko', '巫女服'), ('outfit', 'nun', '修女服'),
  ('outfit', 'bridal', '纯白婚纱内衣'), ('outfit', 'latex', '乳胶紧身衣'), ('outfit', 'harness', '皮革束带装'),
  ('stocking', 'black', '黑色薄丝裤袜'), ('stocking', 'white', '白色薄丝裤袜'), ('stocking', 'garter', '黑色吊带丝袜'),
  ('stocking', 'fishnet', '渔网袜'), ('stocking', 'lace_white', '白蕾丝过膝袜'),
]
OVR = {}  # id -> (cx, cy, s) 源图像素坐标的手动取景
FONT = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'

def placeholder(name):
  W = 512
  im = Image.new('RGB', (W, W), (24, 14, 24))
  glow = Image.new('L', (W, W), 0); ImageDraw.Draw(glow).ellipse((60, 60, W - 60, W - 60), fill=255)
  glow = glow.filter(ImageFilter.GaussianBlur(90))
  im = Image.composite(Image.new('RGB', (W, W), (70, 36, 52)), im, glow)
  d = ImageDraw.Draw(im)
  d.rounded_rectangle((28, 28, W - 28, W - 28), radius=36, outline=(150, 110, 60), width=6)
  text = name if len(name) <= 4 else name[:len(name) // 2] + '\n' + name[len(name) // 2:]
  size = 96 if len(name) <= 4 else 72
  f = ImageFont.truetype(FONT, size)
  d.multiline_text((W // 2, W // 2), text, font=f, fill=(230, 190, 110), anchor='mm', align='center', spacing=10)
  return im

def from_source(path, id):
  im = Image.open(path).convert('RGB'); W, H = im.size
  cx, cy, s = OVR.get(id, (W // 2, H // 2, min(W, H)))
  return im.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))

out = []
for cat, id, name in ITEMS:
  os.makedirs(f'public/icons/{cat}', exist_ok=True)
  dst = f'public/icons/{cat}/{id}.webp'
  src = [p for p in glob.glob(SRC + id + '.*') if p.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
  kind = 'src'
  if src: sq = from_source(src[0], id)
  elif os.path.exists(dst): sq, kind = Image.open(dst).convert('RGB'), 'kept'
  else: sq, kind = placeholder(name), 'placeholder'
  icon = sq.resize((128, 128), Image.LANCZOS)
  if kind != 'kept': icon.save(dst, 'WEBP', quality=88)
  out.append((name, id, icon, kind))
  print(f'{kind:12s} {dst}')

cols = 6; cw, ch = 176, 200
sheet = Image.new('RGB', (cols * cw, ((len(out) + cols - 1) // cols) * ch), (15, 12, 10)); d = ImageDraw.Draw(sheet)
fn = ImageFont.truetype(FONT, 16); fs = ImageFont.truetype(FONT, 12)
for i, (name, id, icon, kind) in enumerate(out):
  x, y = (i % cols) * cw + (cw - 128) // 2, (i // cols) * ch + 8
  sheet.paste(icon, (x, y))
  d.text((x + 64, y + 140), name, font=fn, fill=(230, 190, 110), anchor='mt')
  d.text((x + 64, y + 162), id + ('（占位）' if kind == 'placeholder' else ''), font=fs, fill=(150, 130, 100) if kind != 'placeholder' else (220, 110, 110), anchor='mt')
sheet.save('/workspace/outfit-icons.png'); print('sheet', sheet.size)
