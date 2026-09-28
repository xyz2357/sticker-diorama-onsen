"""截图工具：python tools/shot.py <相对 html 路径+query> <输出 png> [宽 高] [等待ms] [js表达式]
例：python tools/shot.py "sheet.html?only=tree" shots/tree.png 1400 900
    python tools/shot.py index.html shots/game.png 1440 900 800 "__TEST__.demo()"
"""
import sys, pathlib, time
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
target = sys.argv[1]
out = sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1400
h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
wait = int(sys.argv[5]) if len(sys.argv) > 5 else 400
js = sys.argv[6] if len(sys.argv) > 6 else None

path, _, query = target.partition('?')
url = (root / path).as_uri() + (('?' + query) if query else '')

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": w, "height": h})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(url)
    pg.wait_for_timeout(wait)
    if js:
        r = pg.evaluate(js)
        if r is not None:
            print("eval:", r)
        pg.wait_for_timeout(wait)
    pg.screenshot(path=str(root / out), full_page=(path.startswith('sheet')))
    for l in logs:
        print(l)
    b.close()
print("saved", out)
