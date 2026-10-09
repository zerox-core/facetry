# Downscale RGBA PNG with bilinear sampling (pure stdlib), reusing chromakey's PNG io.
import sys
sys.path.insert(0, r'D:\project\FaceTry\facetry\design')
from chromakey import read_png, write_png

def downscale(src, dst, size):
    w, h, ch, px = read_png(src)
    assert ch == 4
    out = bytearray(size * size * 4)
    for y in range(size):
        sy = (y + 0.5) * h / size - 0.5
        y0 = max(0, int(sy)); y1 = min(h - 1, y0 + 1); fy = sy - y0
        if sy < 0: fy = 0.0
        for x in range(size):
            sx = (x + 0.5) * w / size - 0.5
            x0 = max(0, int(sx)); x1 = min(w - 1, x0 + 1); fx = sx - x0
            if sx < 0: fx = 0.0
            o = (y * size + x) * 4
            for c in range(4):
                p00 = px[(y0 * w + x0) * 4 + c]; p01 = px[(y0 * w + x1) * 4 + c]
                p10 = px[(y1 * w + x0) * 4 + c]; p11 = px[(y1 * w + x1) * 4 + c]
                top = p00 + (p01 - p00) * fx; bot = p10 + (p11 - p10) * fx
                out[o + c] = int(top + (bot - top) * fy)
    write_png(dst, size, size, out)
    print(f'{dst} {size}x{size}')

if __name__ == '__main__':
    downscale(sys.argv[1], sys.argv[2], int(sys.argv[3]))
