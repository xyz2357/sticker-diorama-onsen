# 美术提示词与生成流程

场景卡和 32 张贴纸都由 Codex 的图像生成画。原图在 `art/raw/`，每张旁边都有同名 `.prompt.txt`，里面是原文提示词；两者对不上时以 `.prompt.txt` 为准。

## 生成顺序

1. **`backdrop.png` 场景卡**：一张空房间，等距剖面、蓝白格子地砖、雪山窗景、靛蓝门帘、右侧木地台。它是整套的风格锚点。
2. **`sheet_a` / `sheet_b` / `sheet_c` / `pool` 四张并行生成**，都带 `-i backdrop.png`，要求贴合房间的角度和配色。
   - `sheet_a`（水豚）又画成了深色光晕背景，用 `-i sheet_a_darkbg.png` 让它"原样重画、只换成品红背景"，一次成功。
3. **`sheet_d`（补画的水豚和小物）**：带 `-i sheet_a.png sheet_b.png` 两张参考，保证水豚形象和家具风格一致。

命令模板：

```bash
codex exec --approve-for-me -C art/raw --skip-git-repo-check --json "<提示词>" -i backdrop.png </dev/null
```

## 共用的画风段

> Match the art style of the attached reference image EXACTLY: the same clean cute flat vector illustration with soft gradients and gentle soft shading, thin slightly darker outlines, the same pastel palette (sky blue, cream, white, light wood, soft brown), and the same classic 2:1 isometric angle … Background: perfectly flat solid pure magenta #FF00FF … no glow, no vignette, no halo, no cast shadow …

水豚角色段：

> chubby round kawaii capybaras with warm brown fur, small round ears, tiny black dot eyes, a big blunt nose and soft pink cheeks, all drawn with the same character design.

## 各表内容（格子顺序 = 切图时的名字顺序）

| 表 | 网格 | 名字 |
|---|---|---|
| sheet_a | 4×2 | capy_yuzu, capy_towel, capy_tub, capy_scrub, capy_milk, capy_sleep, capy_walk, ducks |
| sheet_b | 4×2 | locker, shelf, vanity, fridge, massage（空按摩椅，没用上）, bench, monstera, sign |
| sheet_c | 4×2 | bucket, buckets, stool, spout, yuzus, towelrack, lantern, duckboard |
| sheet_d | 4×2 | capy_massage, capy_fan, capy_babies, capy_wrap, fan, scale, teatable, laundry |
| pool | 1×1 | pool |

## 处理

1. **切图**：`python tools/make_stickers.py cut <表> <列x行> <名字,...>`
   - 抠底时按"背景一定是品红"来反推每个像素的透明度和原色，所以边缘是半透明的，也不会留品红边。
   - 结果存进 `art/cut/`。
2. **烘焙**：`python tools/make_stickers.py bake`
   - 读 `art/layout.json` 里每张贴纸在场景卡上的宽度，按统一密度缩放，所以每张贴纸的白边在屏幕上一样粗。
   - 用距离场加白色模切边和一圈浅灰细边。
   - 输出 `assets/stickers.js`，里面是 webp 格式的 data URI。PET 反光要用 CSS mask 引用贴纸图，走 file:// 时只有 data URI 能被 mask 读到。

## 摆放

在 `js/scene.js` 的 `LAYOUT` 里改：
- 地上的东西用地板坐标 `at: [u, v]`：u 沿左后墙，v 沿右后墙，0 是后墙角；
- 墙上的东西用场景卡像素 `xy`；
- 放在木地台上的加 `deck: 1`。
