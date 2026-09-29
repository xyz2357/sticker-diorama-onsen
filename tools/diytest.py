"""拖拽测试（无头浏览器里的鼠标）"""
import pathlib, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=d3d11"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto((root / 'index.html').as_uri()); pg.wait_for_function("window.__READY__"); pg.wait_for_timeout(600)
    pg.screenshot(path=str(root / 'shots/d01_start.png'))

    def drag(sel, tx, ty, steps=16, shot=None):
        bx = pg.locator(sel).first.bounding_box()
        sx, sy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
        pg.mouse.move(sx, sy); pg.mouse.down()
        for k in range(1, steps + 1):
            pg.mouse.move(sx + (tx - sx) * k / steps, sy + (ty - sy) * k / steps); pg.wait_for_timeout(16)
        if shot: pg.screenshot(path=str(root / shot))
        pg.mouse.up(); pg.wait_for_timeout(350)

    sc = pg.locator('#scene').bounding_box()
    at = lambda fx, fy: (sc['x'] + sc['width'] * fx, sc['y'] + sc['height'] * fy)
    drag('.onsheet[data-id="pool"]', *at(0.5, 0.72), shot='shots/d02_dragging_pool.png')
    drag('.onsheet[data-id="capy_yuzu"]', *at(0.5, 0.64))
    drag('.onsheet[data-id="capy_towel"]', *at(0.58, 0.7))
    print('placed', sorted(pg.evaluate("Object.keys(__TEST__.placed())")))
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(root / 'shots/d03_three.png'))
    # 把一张从场景拖回贴纸页
    sh = pg.locator('#sheet').bounding_box()
    drag('.stk[data-id="capy_towel"]', sh['x'] + sh['width'] / 2, sh['y'] + sh['height'] / 2)
    print('after return', sorted(pg.evaluate("Object.keys(__TEST__.placed())")))
    # 翻页
    pg.click('#next'); pg.wait_for_timeout(200)
    pg.screenshot(path=str(root / 'shots/d04_page2.png'))
    # 成品参考 + 一键贴好
    pg.click('#btnRef'); pg.wait_for_timeout(500); pg.screenshot(path=str(root / 'shots/d05_ref.png'))
    pg.click('#btnApply'); pg.wait_for_timeout(5000)
    print('after apply', len(pg.evaluate("Object.keys(__TEST__.placed())")))
    pg.screenshot(path=str(root / 'shots/d06_applied.png'))
    # 刷新看存档
    pg.reload(); pg.wait_for_function("window.__READY__"); pg.wait_for_timeout(2500)
    print('after reload', len(pg.evaluate("Object.keys(__TEST__.placed())")))
    pg.screenshot(path=str(root / 'shots/d07_reload.png'))
    print(errs or 'no errors')
    b.close()
