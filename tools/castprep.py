"""Rebuild the team cutouts so they sit together on one stage: same head size and
eye-line, cleaned edges, matching fade. Outputs assets/img/team/cast-*.webp."""
import numpy as np
from PIL import Image, ImageFilter
S='SOURCE_DIR/'  # folder holding the full-res cutouts: toosh-cut.png, vance-isnet-general-use.png
SRC={'jack':'/home/claude/aera-website/assets/img/jack-cutout.png','toosh':S+'toosh-cut.png','vance':S+'vance-isnet-general-use.png'}
CW,CH=1000,1400          # common canvas
HEAD_TOP=70              # every head starts here
HEAD_W=330               # every head (incl. hair) this wide
FADE_FROM=0.60           # alpha starts fading at 60% of canvas height
def refine(im):
    im=im.convert('RGBA')
    if im.height>2000: im=im.resize((round(im.width*2000/im.height),2000),Image.LANCZOS)
    a=im.split()[3]
    a=a.point(lambda v: 0 if v<24 else v)
    a=a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))   # pull the edge in 1px, soften
    rgb=np.asarray(im.convert('RGB')).astype(np.float32); al=np.asarray(a).astype(np.float32)/255
    # colour decontamination: edge pixels take the colour of nearby solid pixels, not the old background
    core=(al>0.97).astype(np.float32)
    from scipy.ndimage import gaussian_filter
    k=lambda x: gaussian_filter(x.astype(np.float32),4)
    num=np.stack([k((rgb[...,c]*core).astype(np.float32)) for c in range(3)],-1); den=k(core)[...,None]+1e-4
    clean=num/den; w=np.clip((0.97-al)/0.97,0,1)[...,None]*(den>0.02)
    rgb=rgb*(1-w)+clean*w
    out=np.dstack([np.clip(rgb,0,255),al*255]).astype(np.uint8)
    return Image.fromarray(out,'RGBA')
def headwidth(a,top):
    H=a.shape[0]; ws=[]
    for y in range(top+10,min(top+int(H*0.16),H)):
        xs=np.where(a[y]>128)[0]
        if len(xs): ws.append(xs[-1]-xs[0])
    return np.percentile(ws,85)
res={}
for n,p in SRC.items():
    im=refine(Image.open(p)); a=np.asarray(im)[:,:,3]
    top=np.where(a.max(1)>128)[0][0]; hw=headwidth(a,top)
    s=HEAD_W/hw; im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    a=np.asarray(im)[:,:,3]; top=np.where(a.max(1)>128)[0][0]
    # head centre = mean x of head band
    band=a[top:top+int(HEAD_W*0.9)]; ys,xs=np.where(band>128); hx=xs.mean()
    canvas=Image.new('RGBA',(CW,CH),(0,0,0,0))
    canvas.paste(im,(round(CW/2-hx),HEAD_TOP-top),im)
    arr=np.asarray(canvas).astype(np.float32)
    bot=np.where(arr[...,3].max(1)>8)[0][-1]-6
    y0=HEAD_TOP+0.52*(bot-HEAD_TOP)
    y=np.arange(CH)[:,None].astype(np.float32); f=np.clip((y-y0)/(bot-y0),0,1); f=1-(f*f*(3-2*f))
    arr[...,3]*=f
    out=Image.fromarray(arr.astype(np.uint8),'RGBA')
    out.save(f'/home/claude/aera-website/assets/img/team/cast-{n}.webp','WEBP',quality=88,method=6)
    res[n]=(round(s,3),out.getbbox())
print(res)
# preview row on site background
bg=Image.new('RGBA',(CW*3-600,CH),(14,10,8,255))
for i,n in enumerate(['jack','toosh','vance']):
    im=Image.open(f'/home/claude/aera-website/assets/img/team/cast-{n}.webp'); bg.alpha_composite(im,(i*(CW-300),0))
bg.convert('RGB').resize(((CW*3-600)//3,CH//3)).save(S+'castprev.jpg',quality=80)
