# Chroma-key (#00FF00) removal with pure stdlib: decode PNG, key out green, despill, crop to content, write RGBA PNG.
import struct, zlib, sys

def read_png(p):
    data = open(p, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos, idat, w, h, bit, ctype = 8, b'', 0, 0, 8, 6
    while pos < len(data):
        ln, typ = struct.unpack('>I4s', data[pos:pos+8]); chunk = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b'IHDR':
            w, h, bit, ctype = struct.unpack('>IIBB', chunk[:10])
            assert bit == 8 and ctype in (2, 6), f'unsupported bit={bit} ctype={ctype}'
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
    ch = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    i = 0
    for y in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        if f == 1:
            for x in range(ch, stride): line[x] = (line[x] + line[x-ch]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-ch] if x >= ch else 0
                b = prev[x]; c = prev[x-ch] if x >= ch else 0
                pp = a + b - c
                pa, pb, pc = abs(pp-a), abs(pp-b), abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, ch, out

def write_png(p, w, h, rgba):
    stride = w * 4
    raw = b''.join(b'\x00' + bytes(rgba[y*stride:(y+1)*stride]) for y in range(h))
    def chunk(typ, payload): return struct.pack('>I', len(payload)) + typ + payload + struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBB', w, h, 8, 6) + b'\x00\x00\x00') + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b'')
    open(p, 'wb').write(png)

def keyout(src, dst, lo=40, hi=110):
    w, h, ch, px = read_png(src)
    n = w * h
    rgba = bytearray(n * 4)
    minx, miny, maxx, maxy = w, h, -1, -1
    for i in range(n):
        r, g, b = px[i*ch], px[i*ch+1], px[i*ch+2]
        keyed = g - max(r, b)  # green dominance
        if keyed <= lo: a = 255
        elif keyed >= hi: a = 0
        else: a = int(255 * (hi - keyed) / (hi - lo))
        if a < 255:  # despill: clamp green toward max(r,b)
            m = max(r, b)
            if g > m: g = m + int((g - m) * a / 255)
        o = i * 4
        rgba[o], rgba[o+1], rgba[o+2], rgba[o+3] = r, g, b, a
        if a > 8:
            x, y = i % w, i // w
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
    if maxx < 0: raise SystemExit('nothing left after keying')
    pad = max(2, int(max(maxx-minx+1, maxy-miny+1) * 0.01))  # ~1% padding
    minx, miny = max(0, minx-pad), max(0, miny-pad)
    maxx, maxy = min(w-1, maxx+pad), min(h-1, maxy+pad)
    cw, chh = maxx-minx+1, maxy-miny+1
    crop = bytearray(cw * chh * 4)
    for y in range(chh):
        so = ((miny+y)*w + minx) * 4
        crop[y*cw*4:(y+1)*cw*4] = rgba[so:so+cw*4]
    write_png(dst, cw, chh, crop)
    print(f'{dst} {cw}x{chh}')

if __name__ == '__main__':
    keyout(sys.argv[1], sys.argv[2])
