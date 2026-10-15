# 生成立绘多尺寸变体：public/presets/sizes/<名>-sm.webp（160w，缩略/列表）与 <名>-md.webp（480w，卡片/详情）
# 原图保留给全屏/放大。同时重写 lib/portrait-manifest.ts（有变体的原图 URL 清单，供 portraitSrc 判断）。
# 用法：python3 scripts/portrait-sizes.py     （在仓库根目录运行；新增/替换立绘后重跑）
import glob, os
from PIL import Image

SRC_DIR = 'public/presets'
OUT_DIR = 'public/presets/sizes'
SIZES = {'sm': (160, 80), 'md': (480, 82)}  # 名称: (宽度, webp 质量)

os.makedirs(OUT_DIR, exist_ok=True)
sources = sorted(f for f in glob.glob(f'{SRC_DIR}/*') if os.path.isfile(f) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))
urls, before, after = [], 0, {k: 0 for k in SIZES}
for f in sources:
    stem = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    W, H = im.size
    before += os.path.getsize(f)
    for name, (w, q) in SIZES.items():
        h = round(H * w / W)
        out = f'{OUT_DIR}/{stem}-{name}.webp'
        im.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=q, method=6)
        after[name] += os.path.getsize(out)
        print(f'{out}  {w}x{h}  {os.path.getsize(out)} B')
    urls.append('/' + os.path.relpath(f, 'public').replace(os.sep, '/'))

with open('lib/portrait-manifest.ts', 'w') as fh:
    fh.write('// 自动生成：scripts/portrait-sizes.py。有 sm/md 变体的立绘原图 URL（变体在 /presets/sizes/<名>-<尺寸>.webp）\n')
    fh.write('export const PORTRAIT_VARIANT_SOURCES: readonly string[] = [\n')
    for u in urls: fh.write(f"  '{u}',\n")
    fh.write(']\n')

print(f'originals: {len(sources)} files, {before} B')
for k, v in after.items(): print(f'{k}: {v} B')
