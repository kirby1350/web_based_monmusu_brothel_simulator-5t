# 生成 public/icons/play/<id>.webp（128×128）与联系表 /workspace/play-icons.png
import glob, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
A = '/home/box/agent-data/agents/6d90e57a-d7ee-4929-bdeb-4f58d9680c04/assets/'
M = dict(deepthroat='8e769691', paizuri='1b4b65a7', positions='a8f63453', long_massage='9a960062', lewd_dance='b1ba16f8',
  endure='f86e275e', drain='94e4a316', race_cat_lick='135f78d6', race_cat_tail='e8cae43a', race_dog_beg='278c9853',
  race_dog_obey='482bf6fc', race_fox_tails='e199d842', race_fox_illusion='7b2f8c04', race_bunny_ride='f3d12beb',
  race_slime_wrap='00ef4a5f', race_slime_inner='dd9682e6', race_lamia_coil='cf2ac5f6', race_lamia_gaze='df658d9e',
  race_lamia_hair='2abaaf37', race_harpy_wing='3383c850', race_harpy_air='aeb5d741', race_spider_bind='7bc35e8f',
  race_dragon_press='ff8ca4f0', race_elf_whisper='13b85431', race_drow_night='1abb5e9c', race_vamp_kiss='75054fba',
  race_witch_crest='c3f165f2', race_oni_press='ae12ee29', race_cow_milk='4c03e8a5', race_wolf_wild='b1b6e2a0')
OVR = {  # id -> (cx, cy, s) 手动修正（源图像素坐标）
  'race_lamia_gaze': (700, 360, 800),  # 蛇瞳魅惑：竖瞳偏左、右侧飘爱心；略放大取景（超出部分用背景色补），让睫毛和爱心入框
  'race_lamia_hair': (700, 360, 720),  # 尾尖撩拨：尾巴从右上入画、爱心在中偏左下，右移让尾巴和爱心都入框
}
os.makedirs('public/icons/play', exist_ok=True)
out = []
for id, pre in M.items():
  f = [x for x in glob.glob(A + pre + '*') if x.lower().endswith('.jpg')]
  if len(f) != 1: print('MISSING', id, f); continue
  im = Image.open(f[0]).convert('RGB'); W, H = im.size
  if id in OVR: cx, cy, s = OVR[id]
  elif True:  # 这批图主体都居中：直接取中间整高的正方形
    cx, cy, s = W // 2, H // 2, H
  else:
    g = im.convert('L').filter(ImageFilter.GaussianBlur(4)).point(lambda v: 255 if v > 70 else 0)
    m = int(H * 0.04); bb = g.crop((m, m, W - m, H - m)).getbbox()
    x0, y0, x1, y1 = (bb[0] + m, bb[1] + m, bb[2] + m, bb[3] + m) if bb else (0, 0, W, H)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    s = int(min(max(max(x1 - x0, y1 - y0) * 1.08, H * 0.6), H))
  bg = im.getpixel((5, 5)); can = Image.new('RGB', (W + 2 * s, H + 2 * s), bg); can.paste(im, (s, s))
  sq = can.crop((cx - s // 2 + s, cy - s // 2 + s, cx + s // 2 + s, cy + s // 2 + s)).resize((128, 128), Image.LANCZOS)
  sq.save(f'public/icons/play/{id}.webp', quality=88); out.append((id, sq, f'{W}x{H}'))
cols = 6; sheet = Image.new('RGB', (cols * 170, ((len(out) + cols - 1) // cols) * 165), (15, 12, 10)); dr = ImageDraw.Draw(sheet)
for i, (id, sq, sz) in enumerate(out):
  x, y = (i % cols) * 170 + 21, (i // cols) * 165 + 6
  sheet.paste(sq, (x, y)); dr.text((x - 15, y + 132), f'{id}', fill=(220, 190, 120)); dr.text((x - 15, y + 145), sz, fill=(140, 120, 90))
sheet.save('/workspace/play-icons.png'); print(len(out))
