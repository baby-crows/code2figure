import sys
from PIL import Image, ImageChops

src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
bg = Image.new("RGB", im.size, (255, 255, 255))
b = ImageChops.difference(im, bg).getbbox()
c = im.crop((max(0, b[0] - 12), max(0, b[1] - 12),
             min(im.size[0], b[2] + 12), min(im.size[1], b[3] + 12)))
c.save(outdir + r"\render.png")
w, h = c.size
c.crop((0, 0, w, int(h * 0.30))).save(outdir + r"\zoom-a.png")
c.crop((0, int(h * 0.28), w, int(h * 0.56))).save(outdir + r"\zoom-b.png")
c.crop((0, int(h * 0.54), w, int(h * 0.90))).save(outdir + r"\zoom-c.png")
print("render.png", c.size)
