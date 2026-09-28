"""Codex 精灵表 → 贴纸。两步：

1. 切图：python tools/make_stickers.py cut art/raw/sheet_a.png 4x2 capy_yuzu,capy_towel,...   （- 表示跳过该格）
   品红抠底（按"已知背景"反推 alpha 和颜色，边缘半透明、不带品红），存到 art/cut/<名字>.png，不加边。
2. 烘焙：python tools/make_stickers.py bake
   读 art/layout.json 的 sizes（每种贴纸在场景卡上的宽度，单位是场景卡像素，卡宽 1536），
   按统一的密度 D 缩放后加白色模切边，这样所有贴纸的白边在屏幕上一样粗；
   输出 art/stickers/*.png 和 assets/stickers.js（webp data URI）。
"""
import sys, json, pathlib, base64, io
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = 1.6            # 贴纸图的像素密度（相对场景卡像素）
BORDER = 7.0       # 白边宽度（场景卡像素）
EDGE = 1.1         # 最外圈浅灰线（场景卡像素）
MAG = np.array([255, 0, 255], dtype=np.float32)


def key_alpha(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = np.minimum(r, b) - g               # 越像品红越大
    return np.clip((200 - m) / (200 - 105), 0, 1)


def unmix(rgb, a):
    a3 = np.maximum(a, 1e-3)[..., None]
    return np.clip((rgb - (1 - a[..., None]) * MAG) / a3, 0, 255)


def cut(path, cols, rows, names):
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = im.shape[:2]
    a = key_alpha(im)
    fg = a > 0.5
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=8))
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    cents = ndimage.center_of_mass(fg, lab, range(1, n + 1))
    cells = {}
    for k in range(n):
        if sizes[k] >= 400:
            cy, cx = cents[k]
            cells.setdefault((int(cx * cols / W), int(cy * rows / H)), []).append(k + 1)
    d = ROOT / 'art' / 'cut'; d.mkdir(parents=True, exist_ok=True)
    for idx, name in enumerate(names):
        if name in ('-', ''):
            continue
        key = (idx % cols, idx // cols)
        if key not in cells:
            print('empty', name); continue
        m = np.isin(lab, cells[key])
        ys, xs = np.nonzero(m & fg)
        y0, y1, x0, x1 = max(0, ys.min() - 3), min(H, ys.max() + 4), max(0, xs.min() - 3), min(W, xs.max() + 4)
        al = a[y0:y1, x0:x1] * m[y0:y1, x0:x1]
        rgb = unmix(im[y0:y1, x0:x1], al)
        Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), 'RGBA').save(d / f'{name}.png')
        print(f'{name}: {x1 - x0}x{y1 - y0}')


def over(dst, rgb, a):
    """把纯色/图像 rgb（alpha=a）叠到 dst 上。dst: HxWx4 float 0..255"""
    a = a[..., None]
    da = dst[..., 3:4] / 255
    oa = a + da * (1 - a)
    col = (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-4)
    return np.concatenate([col, oa * 255], -1)


def bake_one(name, w_card):
    art = Image.open(ROOT / 'art' / 'cut' / f'{name}.png')
    tw = max(8, round(w_card * D))
    th = max(8, round(art.height * tw / art.width))
    art = np.array(art.resize((tw, th), Image.LANCZOS)).astype(np.float32)
    pad = int(np.ceil((BORDER + EDGE) * D)) + 3
    h, w = art.shape[:2]
    cv = np.zeros((h + pad * 2, w + pad * 2, 4), np.float32)
    cv[pad:pad + h, pad:pad + w] = art
    solid = ndimage.binary_fill_holes(cv[..., 3] > 100)
    solid = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=max(2, int(3 * D))))
    dist = ndimage.distance_transform_edt(~solid)
    out = np.zeros_like(cv)
    shape = out.shape[:2] + (3,)
    out = over(out, np.broadcast_to(np.array([212, 204, 192], np.float32), shape), np.clip((BORDER + EDGE) * D + 0.5 - dist, 0, 1))
    out = over(out, np.broadcast_to(np.array([255, 254, 250], np.float32), shape), np.clip(BORDER * D + 0.5 - dist, 0, 1))
    out = over(out, cv[..., :3], cv[..., 3] / 255)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    return img, pad


def bake():
    layout = json.loads((ROOT / 'art' / 'layout.json').read_text(encoding='utf-8'))
    d = ROOT / 'art' / 'stickers'; d.mkdir(parents=True, exist_ok=True)
    items = {}
    for name, w_card in layout['sizes'].items():
        if not (ROOT / 'art' / 'cut' / f'{name}.png').exists():
            print('missing cut', name); continue
        img, pad = bake_one(name, w_card)
        img.save(d / f'{name}.png')
        buf = io.BytesIO(); img.save(buf, 'WEBP', quality=90, method=6)
        items[name] = {'src': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
                       'w': img.width / D, 'h': img.height / D, 'pad': pad / D}
    js = '// 由 tools/make_stickers.py bake 生成，别手改\nwindow.STICKERS = ' + json.dumps(items) + ';\n'
    (ROOT / 'assets' / 'stickers.js').write_text(js, encoding='utf-8')
    print(len(items), 'stickers,', round(len(js) / 1024), 'KB')


if __name__ == '__main__':
    if sys.argv[1] == 'cut':
        c, r = map(int, sys.argv[3].lower().split('x'))
        cut(ROOT / sys.argv[2], c, r, sys.argv[4].split(','))
    else:
        bake()
