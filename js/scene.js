// scene.js — 把贴纸一张张贴到场景卡上，然后放环境动画（热气、水光、窗外雪、灯笼）
(function () {
  'use strict';
  const CW = 1536, CH = 1024;          // 场景卡像素
  const S = window.STICKERS || {};
  const scene = document.getElementById('scene');

  // 地板四个角（场景卡像素）：后、左、前、右。地板上的位置用 (u, v) 表示：
  // u 沿左后墙从后角(0)到左角(1)，v 沿右后墙从后角(0)到右角(1)。
  const BACK = [770, 380], LEFT = [64, 656], FRONT = [770, 993], RIGHT = [1473, 673];
  const DECK_H = 16;                    // 木地台高出地面的像素
  function floor(u, v) {
    const f = (a, b, c, d) => a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    return [f(BACK[0], LEFT[0], RIGHT[0], FRONT[0]), f(BACK[1], LEFT[1], RIGHT[1], FRONT[1])];
  }

  // 摆放：at = 地板坐标 [u, v]，或 xy = 场景卡像素（墙上的东西）；锚点是贴纸图案的底边中点
  // deck: 在木地台上；flip: 水平翻转；idle: 闲时动画；z: 手动层级（默认按底边 y 排）
  const LAYOUT = [
    // 地面上平铺的
    { id: 'duckboard', at: [0.6, 0.12], flat: 1 },
    { id: 'pool', at: [0.74, 0.62], flat: 1, center: 1 },
    // 更衣区：左后墙
    { id: 'lantern', xy: [236, 352], flip: 1, idle: 'sway 4s ease-in-out infinite', glow: 1 },
    { id: 'scale', at: [0.98, 0.05] },
    { id: 'locker', at: [0.84, 0.05] },
    { id: 'shelf', at: [0.3, 0.05] },
    { id: 'laundry', at: [0.78, 0.17] },
    { id: 'towelrack', at: [0.99, 0.3] },
    { id: 'bench', at: [0.72, 0.3] },
    { id: 'capy_wrap', at: [0.66, 0.36], idle: 'breathe 3.2s ease-in-out infinite' },
    { id: 'sign', at: [0.44, 0.22] },
    { id: 'capy_walk', at: [0.58, 0.14], idle: 'breathe 2.6s ease-in-out infinite' },
    // 冲洗区：右后墙靠里
    { id: 'vanity', at: [0.05, 0.22] },
    { id: 'buckets', at: [0.05, 0.36] },
    { id: 'capy_scrub', at: [0.2, 0.2], idle: 'breathe 3s ease-in-out infinite' },
    { id: 'bucket', at: [0.24, 0.3] },
    { id: 'stool', at: [0.32, 0.36] },
    // 温泉
    { id: 'spout', at: [0.52, 0.52] },
    { id: 'yuzus', at: [0.66, 0.56], idle: 'bob2 5s ease-in-out infinite' },
    { id: 'capy_yuzu', at: [0.78, 0.5], idle: 'bob 4.2s ease-in-out infinite' },
    { id: 'capy_towel', at: [0.72, 0.72], idle: 'bob 3.6s ease-in-out infinite', flip: 1 },
    { id: 'ducks', at: [0.88, 0.66], idle: 'bob2 3.2s ease-in-out infinite' },
    { id: 'capy_tub', at: [0.99, 0.34], idle: 'bob 3.9s ease-in-out infinite' },
    { id: 'capy_babies', at: [0.62, 0.97], idle: 'breathe 2.4s ease-in-out infinite' },
    // 木地台：饮品休息角
    { id: 'fridge', at: [0.04, 0.55], deck: 1 },
    { id: 'fan', at: [0.03, 0.7], deck: 1 },
    { id: 'capy_massage', at: [0.08, 0.86], deck: 1, idle: 'breathe 3.6s ease-in-out infinite' },
    { id: 'monstera', at: [0.05, 0.99], deck: 1, idle: 'sway 6s ease-in-out infinite' },
    { id: 'capy_milk', at: [0.24, 0.52], deck: 1, idle: 'breathe 2.8s ease-in-out infinite' },
    { id: 'capy_fan', at: [0.26, 0.74], deck: 1, idle: 'breathe 2.2s ease-in-out infinite' },
    { id: 'teatable', at: [0.44, 0.66], deck: 1 },
    { id: 'capy_sleep', at: [0.48, 0.9], deck: 1, idle: 'breathe 3.4s ease-in-out infinite' },
  ];

  const pct = (v, total) => (v / total * 100).toFixed(3) + '%';
  const els = [];

  function place() {
    for (const e of els) e.remove();
    els.length = 0;
    const items = LAYOUT.filter(L => S[L.id]).map(L => {
      const s = S[L.id];
      let [x, y] = L.xy || floor(L.at[0], L.at[1]);
      if (L.deck) y -= DECK_H;
      // 贴纸图带白边：宽高是场景卡像素，pad 是白边留白
      const w = s.w, h = s.h, pad = s.pad;
      const left = x - w / 2, top = L.center ? y - h / 2 : y - (h - pad);
      return { L, s, left, top, w, h, key: L.flat ? -1000 + y : y };
    }).sort((a, b) => a.key - b.key);

    items.forEach((it, n) => {
      const d = document.createElement('div');
      d.className = 'stk';
      d.style.left = pct(it.left, CW); d.style.top = pct(it.top, CH);
      d.style.width = pct(it.w, CW); d.style.height = pct(it.h, CH);
      d.style.zIndex = 10 + n;
      d.style.setProperty('--d', (0.5 + n * 0.14).toFixed(2) + 's');
      d.style.setProperty('--sd', (2 + Math.random() * 6).toFixed(2) + 's');
      d.style.setProperty('--m', `url(${it.s.src})`);
      if (it.L.idle) d.style.setProperty('--idle', it.L.idle);
      // 三层：.stk 负责位置和贴上去，.fl 负责翻转，.in 负责闲时动画和反光，互不抢 transform
      const fl = document.createElement('div');
      fl.style.cssText = 'width:100%;height:100%' + (it.L.flip ? ';transform:scaleX(-1)' : '');
      const inner = document.createElement('div');
      inner.className = 'in';
      const img = document.createElement('img');
      img.src = it.s.src; img.alt = it.L.id; img.draggable = false;
      inner.appendChild(img);
      fl.appendChild(inner);
      d.appendChild(fl);
      scene.appendChild(d);
      els.push(d);
      if (it.L.glow) {
        const g = document.createElement('div');
        g.className = 'fx glow';
        const cx = it.left + it.w * 0.42, cy = it.top + it.h * 0.62, r = it.w * 1.1;
        g.style.left = pct(cx - r / 2, CW); g.style.top = pct(cy - r / 2, CH); g.style.width = pct(r, CW); g.style.height = pct(r, CH);
        g.style.zIndex = 9 + n; g.style.animationDelay = (0.5 + n * 0.14 + 0.4).toFixed(2) + 's';
        g.style.opacity = 0;
        scene.appendChild(g); els.push(g);
      }
    });
    return items.length;
  }

  // 温泉上的热气和水面反光
  function poolFx(total) {
    const pool = LAYOUT.find(L => L.id === 'pool');
    if (!pool || !S.pool) return;
    const [cx, cy] = floor(pool.at[0], pool.at[1]);
    const pw = S.pool.w * 0.72, ph = S.pool.h * 0.5;
    const start = 0.5 + total * 0.14 + 0.3;
    for (let n = 0; n < 12; n++) {
      const s = document.createElement('div');
      s.className = 'fx steam';
      const x = cx + (Math.random() - 0.5) * pw, y = cy + (Math.random() - 0.6) * ph * 0.8;
      s.style.left = pct(x - 65, CW); s.style.top = pct(y - 70, CH);
      s.style.setProperty('--t', (5 + Math.random() * 3).toFixed(1) + 's');
      s.style.setProperty('--sd', (start + n * 0.55).toFixed(1) + 's');
      s.style.setProperty('--dx', ((Math.random() - 0.3) * 40).toFixed(0) + 'px');
      s.style.zIndex = 800;
      scene.appendChild(s); els.push(s);
    }
    for (let n = 0; n < 7; n++) {
      const g = document.createElement('div');
      g.className = 'fx glint';
      const x = cx + (Math.random() - 0.5) * pw * 0.9, y = cy + (Math.random() - 0.5) * ph * 0.7;
      g.style.left = pct(x - 24, CW); g.style.top = pct(y, CH);
      g.style.setProperty('--sd', (start + Math.random() * 3).toFixed(1) + 's');
      g.style.zIndex = 12;
      scene.appendChild(g); els.push(g);
    }
  }

  // 窗外的雪：只在玻璃那块平行四边形里下
  function snow() {
    const box = document.getElementById('snow');
    const x0 = 958, y0 = 142, x1 = 1288, y1 = 475;
    box.style.left = pct(x0, CW); box.style.top = pct(y0, CH); box.style.width = pct(x1 - x0, CW); box.style.height = pct(y1 - y0, CH);
    box.style.clipPath = 'polygon(0 0, 100% 38.4%, 100% 100%, 0 66%)';
    box.innerHTML = '';
    for (let n = 0; n < 46; n++) {
      const f = document.createElement('i');
      const s = 2 + Math.random() * 3;
      f.style.left = (Math.random() * 100).toFixed(1) + '%';
      f.style.width = f.style.height = s.toFixed(1) + 'px';
      f.style.opacity = (0.55 + Math.random() * 0.45).toFixed(2);
      f.style.setProperty('--t', (6 + Math.random() * 6).toFixed(1) + 's');
      f.style.setProperty('--sd', (-Math.random() * 12).toFixed(1) + 's');
      f.style.setProperty('--dx', (-10 - Math.random() * 30).toFixed(0) + 'px');
      box.appendChild(f);
    }
  }

  // 卡片按窗口大小缩放，保持 3:2
  function fit() {
    const card = document.getElementById('card');
    const maxW = window.innerWidth - 60, maxH = window.innerHeight - 150;
    const w = Math.min(maxW, maxH * CW / CH, 1480);
    scene.style.width = w + 'px'; scene.style.height = (w * CH / CW) + 'px';
    // 雪花下落的距离 = 窗框高度（按当前缩放算成像素）
    document.getElementById('snow').style.setProperty('--fall', Math.round((475 - 142) / CH * w * CH / CW * 1.08) + 'px');
    const label = document.querySelector('.label');
    const k = Math.max(0.6, Math.min(1, w / 1300));
    label.style.zoom = k;
    void card;
  }

  function build() {
    const n = place();
    poolFx(n);
    snow();
  }
  document.getElementById('replay').onclick = build;
  window.addEventListener('resize', fit);
  fit(); build();
  window.__LAYOUT__ = { LAYOUT, floor, build };
})();
