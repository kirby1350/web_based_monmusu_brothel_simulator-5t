import os,glob
from PIL import Image, ImageFilter
A='/home/box/agent-data/agents/6d90e57a-d7ee-4929-bdeb-4f58d9680c04/assets/'
M={'outfit':dict(maid='adc3f723',kimono='0253887a',regular='4fd008a0',crotchless='272c9238',restraint='e8586827',queen='a004e8a8'),
'stocking':dict(black='0d09a69f',white='3888158777b2'),
'recovery':dict(hot_meal='b9108280',tonic_soup='64945399',vigor_potion='bcd65351'),
'sculpt':dict(bust_up='89d3db6b',bust_down='23b711193',hip_up='cc881c85',hip_down='f9513ae6',waist_down='79eaaac6',waist_up='4b7046a1'),
'prop':dict(whip='73ae79f6',rack='53a24397',massage_table='4723e6c4',censer='3a4dcb2b',sculpt_frame='43cadf07',mirror='b85dd106',feather='ec6ed391',vibrator='58c7167c',nipple_clamps='3cfffafc',gag='f2338c79',plug='3cc7d10e',horn_comb='da961988')}
FRAMED={'maid','kimono','regular'}
out=[]
for cat,d in M.items():
  os.makedirs(f'public/icons/{cat}',exist_ok=True)
  for id,pre in d.items():
    f=[x for x in glob.glob(A+pre+'*') if x.endswith('.jpg')]; assert len(f)==1,(id,f)
    im=Image.open(f[0]).convert('RGB'); W,H=im.size
    if id in FRAMED:
      s=int(H*0.72); cx,cy=W//2,H//2
    else:
      g=im.convert('L').filter(ImageFilter.GaussianBlur(3)).point(lambda v:255 if v>60 else 0)
      # ignore outer 3% border
      m=int(H*0.03); g=g.crop((m,m,W-m,H-m)); bb=g.getbbox()
      if bb: x0,y0,x1,y1=bb[0]+m,bb[1]+m,bb[2]+m,bb[3]+m
      else: x0,y0,x1,y1=0,0,W,H
      cx,cy=(x0+x1)//2,(y0+y1)//2; s=max(x1-x0,y1-y0)
      s=int(min(max(s*1.12,400),W))
    if id=='rack': s=640; cx,cy=640,344
    if id=='nipple_clamps': s=680; cx,cy=640,330
    if id=='whip': s=720; cx,cy=680,385
    if id=='maid': s=650; cx,cy=638,345
    # pad canvas with bg colour if square exceeds image
    bg=im.getpixel((5,5))
    can=Image.new('RGB',(W+2*s,H+2*s),bg); can.paste(im,(s,s))
    sq=can.crop((cx-s//2+s,cy-s//2+s,cx+s//2+s,cy+s//2+s)).resize((128,128),Image.LANCZOS)
    p=f'public/icons/{cat}/{id}.webp'; sq.save(p,quality=88); out.append((cat,id,sq))
sheet=Image.new('RGB',(8*140,((len(out)+7)//8)*160),(15,12,10))
from PIL import ImageDraw
dr=ImageDraw.Draw(sheet)
for i,(c,id,sq) in enumerate(out):
  x,y=(i%8)*140+6,(i//8)*160+6; sheet.paste(sq,(x,y)); dr.text((x,y+132),f'{c}/{id}',fill=(220,190,120))
sheet.save('/workspace/stage7-icons.png'); print(len(out))
