// diy.js — 自己动手贴：从贴纸页撕下贴纸，贴到场景卡上
(function () {
  'use strict';
  const CW = 1536, CH = 1024;          // 场景卡像素
  const S = window.STICKERS || {};
  const PB = window.PB || {};
  const sfx = (n, d) => { if (PB.sfx && !muted) PB.sfx(n, d); };
  const $ = s => document.querySelector(s);
  const scene = $('#scene'), sheetEl = $('#sheet'), stage = $('#stage');

  // ---------- 成品参考（也是"照这个贴好"用的摆放） ----------
  // 地板四个角：后、左、前、右。u 沿左后墙，v 沿右后墙，0 在后墙角。
  const BACK = [770, 380], LEFT = [64, 656], FRONT = [770, 993], RIGHT = [1473, 673];
  const DECK_H = 16;
  function floor(u, v) {
    const f = (a, b, c, d) => a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    return [f(BACK[0], LEFT[0], RIGHT[0], FRONT[0]), f(BACK[1], LEFT[1], RIGHT[1], FRONT[1])];
  }
  const LAYOUT = [
    { id: 'duckboard', at: [0.6, 0.12] }, { id: 'pool', at: [0.74, 0.62], center: 1 },
    { id: 'lantern', xy: [236, 352] }, { id: 'scale', at: [0.98, 0.05] }, { id: 'locker', at: [0.84, 0.05] },
    { id: 'shelf', at: [0.3, 0.05] }, { id: 'laundry', at: [0.78, 0.17] }, { id: 'towelrack', at: [0.99, 0.3] },
    { id: 'bench', at: [0.72, 0.3] }, { id: 'capy_wrap', at: [0.66, 0.36] }, { id: 'sign', at: [0.44, 0.22] },
    { id: 'capy_walk', at: [0.58, 0.14] }, { id: 'vanity', at: [0.05, 0.22] }, { id: 'buckets', at: [0.05, 0.36] },
    { id: 'capy_scrub', at: [0.2, 0.2] }, { id: 'bucket', at: [0.24, 0.3] }, { id: 'stool', at: [0.32, 0.36] },
    { id: 'spout', at: [0.52, 0.52] }, { id: 'yuzus', at: [0.66, 0.56] }, { id: 'capy_yuzu', at: [0.78, 0.5] },
    { id: 'capy_towel', at: [0.72, 0.72] }, { id: 'ducks', at: [0.88, 0.66] }, { id: 'capy_tub', at: [0.99, 0.34] },
    { id: 'capy_babies', at: [0.62, 0.97] }, { id: 'fridge', at: [0.04, 0.55], deck: 1 }, { id: 'fan', at: [0.03, 0.7], deck: 1 },
    { id: 'capy_massage', at: [0.08, 0.86], deck: 1 }, { id: 'monstera', at: [0.05, 0.99], deck: 1 },
    { id: 'capy_milk', at: [0.24, 0.52], deck: 1 }, { id: 'capy_fan', at: [0.26, 0.74], deck: 1 },
    { id: 'teatable', at: [0.44, 0.66], deck: 1 }, { id: 'capy_sleep', at: [0.48, 0.9], deck: 1 },
  ];
  // 摆放 → 贴纸中心（场景卡像素）
  function finished() {
    const out = {};
    for (const L of LAYOUT) {
      const s = S[L.id]; if (!s) continue;
      let [x, y] = L.xy || floor(L.at[0], L.at[1]);
      if (L.deck) y -= DECK_H;
      out[L.id] = { cx: x, cy: L.center ? y : y - (s.h - s.pad) + s.h / 2 };
    }
    return out;
  }

  // ---------- 贴纸页 ----------
  const PAGES = [
    { name: '温泉', ids: ['pool', 'capy_yuzu', 'capy_towel', 'capy_tub', 'yuzus', 'ducks', 'spout', 'capy_babies'] },
    { name: '冲洗区', ids: ['capy_scrub', 'vanity', 'bucket', 'buckets', 'stool', 'shelf', 'locker', 'scale'] },
    { name: '更衣区', ids: ['capy_walk', 'capy_wrap', 'bench', 'towelrack', 'laundry', 'duckboard', 'sign', 'lantern'] },
    { name: '休息角', ids: ['capy_massage', 'fridge', 'fan', 'monstera', 'capy_milk', 'capy_fan', 'teatable', 'capy_sleep'] },
  ];
  const FLAT = { pool: 1, duckboard: 1 };                               // 永远垫在最下面
  const WATER = { capy_yuzu: 1, capy_towel: 1, yuzus: 1, ducks: 1 };    // 贴在池子里会浮动
  const CAPY = id => id.startsWith('capy_');
  const SWAY = { monstera: 1, lantern: 1 };
  const ALL = PAGES.flatMap(p => p.ids).filter(id => S[id]);

  // ---------- 存档 ----------
  const KEY = 'onsen.diy.v1';
  let placed = {}, page = 0, muted = false;
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o) { placed = o.placed || {}; page = o.page || 0; muted = !!o.muted; } } catch (e) { /* 新开 */ }
  for (const id of Object.keys(placed)) if (!S[id]) delete placed[id];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ placed, page, muted })); } catch (e) { /* ignore */ } };

  // ---------- 尺寸 ----------
  let cardW = 1000;   // 场景卡显示宽度（px）
  const k = () => cardW / CW;
  function fit() {
    const sheetW = Math.min(360, Math.max(250, window.innerWidth * 0.22));
    const maxW = window.innerWidth - sheetW - 110, maxH = window.innerHeight - 130;
    cardW = Math.max(420, Math.min(maxW, maxH * CW / CH, 1400));
    scene.style.width = cardW + 'px'; scene.style.height = (cardW * CH / CW) + 'px';
    sheetEl.style.width = sheetW + 'px';
    sheetEl.style.height = (cardW * CH / CW + 28) + 'px';
    $('.label').style.zoom = Math.max(0.55, Math.min(1, cardW / 1300));
    $('#snow').style.setProperty('--fall', Math.round((475 - 142) / CH * cardW * CH / CW * 1.08) + 'px');
    renderSheet();
  }
  const pct = (v, t) => (v / t * 100).toFixed(3) + '%';

  // ---------- 场景上的贴纸 ----------
  const els = {};      // id -> 场景里的元素
  let fxEls = [];
  function bottomOf(id) { const s = S[id], p = placed[id]; return p.cy + s.h / 2 - s.pad; }
  function poolRect() {
    const p = placed.pool; if (!p) return null;
    const s = S.pool; return { cx: p.cx, cy: p.cy + s.h * 0.02, rx: s.w * 0.4, ry: s.h * 0.34 };
  }
  function inPool(id) {
    const r = poolRect(); if (!r) return false;
    const p = placed[id], y = bottomOf(id) - S[id].h * 0.12;
    return ((p.cx - r.cx) / r.rx) ** 2 + ((y - r.cy) / r.ry) ** 2 < 1;
  }
  function idleOf(id) {
    if (WATER[id] || id === 'capy_tub') return inPool(id) || id === 'capy_tub' ? `${id === 'yuzus' || id === 'ducks' ? 'bob2' : 'bob'} ${(3.2 + (id.length % 5) * 0.4).toFixed(1)}s ease-in-out infinite` : '';
    if (CAPY(id)) return `breathe ${(2.4 + (id.length % 4) * 0.35).toFixed(2)}s ease-in-out infinite`;
    if (SWAY[id]) return `sway ${id === 'lantern' ? 4 : 6}s ease-in-out infinite`;
    return '';
  }
  function makeSticker(id, cls) {
    const s = S[id];
    const d = document.createElement('div');
    d.className = cls; d.dataset.id = id;
    d.style.setProperty('--m', `url(${s.src})`);
    d.style.setProperty('--sd', (2 + Math.random() * 6).toFixed(2) + 's');
    d.innerHTML = `<div class="in"><img src="${s.src}" alt="" draggable="false"></div>`;
    return d;
  }
  function positionPlaced(id) {
    const s = S[id], p = placed[id], e = els[id];
    e.style.left = pct(p.cx - s.w / 2, CW); e.style.top = pct(p.cy - s.h / 2, CH);
    e.style.width = pct(s.w, CW); e.style.height = pct(s.h, CH);
  }
  // 层级：平铺的在最下面，其余按底边前后
  function restack() {
    const ids = Object.keys(placed).sort((a, b) => (FLAT[b] ? 1 : 0) - (FLAT[a] ? 1 : 0) || bottomOf(a) - bottomOf(b));
    ids.forEach((id, n) => { if (els[id]) { els[id].style.zIndex = 20 + n; els[id].querySelector('.in').style.animation = idleOf(id) || ''; } });
    renderFx();
  }
  function putOnScene(id, anim) {
    let e = els[id];
    if (!e) { e = els[id] = makeSticker(id, 'stk'); scene.appendChild(e); }
    positionPlaced(id);
    e.classList.remove('stuck', 'landed'); void e.offsetWidth;
    e.classList.add(anim ? 'landed' : 'stuck');
    if (typeof anim === 'number') e.style.animationDelay = anim + 's'; else e.style.animationDelay = '0s';
  }
  function removeFromScene(id) { if (els[id]) { els[id].remove(); delete els[id]; } }

  // 热气、水光跟着池子走；灯笼的光跟着灯笼走
  function renderFx() {
    for (const e of fxEls) e.remove();
    fxEls = [];
    const r = poolRect();
    if (r) {
      for (let n = 0; n < 11; n++) {
        const s = document.createElement('div'); s.className = 'fx steam';
        const x = r.cx + (Math.random() - 0.5) * r.rx * 1.7, y = r.cy + (Math.random() - 0.6) * r.ry * 1.2;
        s.style.left = pct(x - 65, CW); s.style.top = pct(y - 70, CH);
        s.style.setProperty('--t', (5 + Math.random() * 3).toFixed(1) + 's');
        s.style.setProperty('--sd', (n * 0.55).toFixed(1) + 's');
        s.style.setProperty('--dx', ((Math.random() - 0.3) * 40).toFixed(0) + 'px');
        s.style.zIndex = 800; scene.appendChild(s); fxEls.push(s);
      }
      for (let n = 0; n < 7; n++) {
        const g = document.createElement('div'); g.className = 'fx glint';
        const x = r.cx + (Math.random() - 0.5) * r.rx * 1.6, y = r.cy + (Math.random() - 0.5) * r.ry * 1.3;
        g.style.left = pct(x - 24, CW); g.style.top = pct(y, CH);
        g.style.setProperty('--sd', (Math.random() * 3).toFixed(1) + 's');
        g.style.zIndex = +(els.pool && els.pool.style.zIndex || 20) + 1; scene.appendChild(g); fxEls.push(g);
      }
    }
    if (placed.lantern) {
      const s = S.lantern, p = placed.lantern, g = document.createElement('div');
      g.className = 'fx glow';
      const cx = p.cx - s.w * 0.08, cy = p.cy + s.h * 0.12, rr = s.w * 1.1;
      g.style.left = pct(cx - rr / 2, CW); g.style.top = pct(cy - rr / 2, CH); g.style.width = pct(rr, CW); g.style.height = pct(rr, CH);
      g.style.zIndex = +(els.lantern && els.lantern.style.zIndex || 20) - 1; scene.appendChild(g); fxEls.push(g);
    }
  }

  // ---------- 贴纸页渲染 ----------
  function renderSheet() {
    const P = PAGES[page];
    $('#pageName').textContent = `${page + 1} / ${PAGES.length} · ${P.name}`;
    $('#pageDots').innerHTML = PAGES.map((p, n) => `<i class="${n === page ? 'on' : ''}" data-p="${n}" title="${p.name}"></i>`).join('');
    const grid = $('#slots'); grid.innerHTML = '';
    const gw = grid.clientWidth || 280, gh = grid.clientHeight || 600;
    const hasPool = P.ids.includes('pool');
    const rows = Math.ceil((P.ids.length - (hasPool ? 1 : 0)) / 2), units = rows + (hasPool ? 1.6 : 0);
    const cellW = (gw - 12) / 2, cellH = (gh - 12 * (rows + (hasPool ? 1 : 0) - 1)) / units;
    for (const id of P.ids) {
      if (!S[id]) continue;
      const s = S[id], wide = id === 'pool';
      const cw = wide ? gw : cellW, ch = wide ? cellH * 1.6 : cellH;
      const sc = Math.min((cw - 10) / s.w, (ch - 6) / s.h, k() * 1.05);
      const cell = document.createElement('div');
      cell.className = 'slot' + (wide ? ' wide' : '');
      cell.style.height = ch + 'px';
      const w = s.w * sc, h = s.h * sc;
      if (placed[id]) {
        cell.innerHTML = `<div class="hole" style="width:${w}px;height:${h}px;--m:url(${s.src})"></div>`;
      } else {
        const st = makeSticker(id, 'onsheet');
        st.style.width = w + 'px'; st.style.height = h + 'px';
        cell.appendChild(st);
      }
      grid.appendChild(cell);
    }
    updateCount();
  }
  function updateCount() {
    const n = Object.keys(placed).length;
    $('#count').textContent = `已贴 ${n} / ${ALL.length}`;
    PAGES.forEach((p, i) => { const dot = document.querySelector(`#pageDots i[data-p="${i}"]`); if (dot) dot.classList.toggle('done', p.ids.every(id => placed[id])); });
  }
  $('#pageDots').addEventListener('click', e => { const d = e.target.closest('[data-p]'); if (d) { page = +d.dataset.p; save(); renderSheet(); sfx('tick'); } });
  $('#prev').onclick = () => { page = (page + PAGES.length - 1) % PAGES.length; save(); renderSheet(); sfx('tick'); };
  $('#next').onclick = () => { page = (page + 1) % PAGES.length; save(); renderSheet(); sfx('tick'); };

  // ---------- 拖拽 ----------
  const hand = $('#hand');
  let drag = null;
  function sceneRect() { return scene.getBoundingClientRect(); }
  function startDrag(id, e, fromScene) {
    if (PB.unlockAudio && !muted) PB.unlockAudio();
    const s = S[id];
    const rect = (fromScene ? els[id] : e.target.closest('.onsheet')).getBoundingClientRect();
    const w = s.w * k(), h = s.h * k();
    // 手里捏着的位置：按在贴纸上的相对位置
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    drag = { id, fromScene, w, h, fx, fy, x: e.clientX, y: e.clientY, vx: 0, start: [e.clientX, e.clientY], moved: false, prev: placed[id] ? { ...placed[id] } : null };
    hand.innerHTML = `<div class="in"><img src="${s.src}" alt=""></div>`;
    hand.style.setProperty('--m', `url(${s.src})`);
    hand.style.width = w + 'px'; hand.style.height = h + 'px';
    hand.style.display = 'block';
    // 从贴纸页拿起来时从小变大
    drag.scale0 = fromScene ? 1 : rect.width / w;
    moveHand(e.clientX, e.clientY, true);
    if (fromScene) { els[id].classList.add('lifting'); }
    else e.target.closest('.onsheet').style.visibility = 'hidden';
    sfx('peel');
  }
  function moveHand(x, y, first) {
    const dx = x - drag.x; drag.x = x; drag.y = y;
    drag.vx = drag.vx * 0.75 + dx * 0.25;
    const lean = Math.max(-14, Math.min(14, drag.vx * 0.9));
    const overSheet = pointIn(sheetEl.getBoundingClientRect(), x, y);
    const sc = first ? drag.scale0 : overSheet ? 0.6 : 1.04;
    hand.style.transform = `translate(${x - drag.fx * drag.w}px, ${y - drag.fy * drag.h}px) rotate(${lean}deg) scale(${sc})`;
    hand.style.transformOrigin = `${drag.fx * 100}% ${drag.fy * 100}%`;
    hand.classList.toggle('back', overSheet);
  }
  const pointIn = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  function endDrag(e) {
    const d = drag; drag = null;
    const id = d.id, s = S[id], R = sceneRect();
    // 贴纸中心（场景卡像素）
    const cxScr = e.clientX - d.fx * d.w + d.w / 2, cyScr = e.clientY - d.fy * d.h + d.h / 2;
    const onScene = pointIn(R, e.clientX, e.clientY);
    hand.style.display = 'none'; hand.classList.remove('back');
    if (onScene) {
      const cx = (cxScr - R.left) / R.width * CW, cy = (cyScr - R.top) / R.height * CH;
      placed[id] = { cx: Math.round(Math.max(0, Math.min(CW, cx))), cy: Math.round(Math.max(0, Math.min(CH, cy))) };
      if (els[id]) els[id].classList.remove('lifting');
      putOnScene(id, true);
      restack(); sfx('stick');
      burst(e.clientX, e.clientY);
    } else {
      // 放回贴纸页
      delete placed[id];
      removeFromScene(id);
      restack(); sfx(d.fromScene ? 'tear' : 'tick');
      page = PAGES.findIndex(p => p.ids.includes(id));
    }
    save(); renderSheet(); checkDone();
  }
  sheetEl.addEventListener('pointerdown', e => {
    const st = e.target.closest('.onsheet'); if (!st || e.button !== 0) return;
    e.preventDefault(); startDrag(st.dataset.id, e, false);
  });
  scene.addEventListener('pointerdown', e => {
    const st = e.target.closest('.stk'); if (!st || e.button !== 0) return;
    e.preventDefault(); startDrag(st.dataset.id, e, true);
  });
  window.addEventListener('pointermove', e => { if (drag) moveHand(e.clientX, e.clientY); });
  window.addEventListener('pointerup', e => { if (drag) endDrag(e); });
  window.addEventListener('pointercancel', () => {
    if (!drag) return;
    const d = drag; drag = null; hand.style.display = 'none';
    if (d.fromScene && els[d.id]) els[d.id].classList.remove('lifting');
    renderSheet();
  });

  // 贴上去时冒几颗小亮点
  function burst(x, y) {
    for (let n = 0; n < 8; n++) {
      const p = document.createElement('i'); p.className = 'spark';
      const a = n / 8 * Math.PI * 2 + Math.random() * 0.4, r = 26 + Math.random() * 18;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--tx', Math.cos(a) * r + 'px'); p.style.setProperty('--ty', Math.sin(a) * r + 'px');
      document.body.appendChild(p); setTimeout(() => p.remove(), 700);
    }
  }

  // ---------- 全部贴完 ----------
  let doneShown = false;
  function checkDone() {
    const all = Object.keys(placed).length === ALL.length;
    $('#done').classList.toggle('show', all && !doneShown);
    if (all && !doneShown) { doneShown = true; sfx('fanfare', 0.2); setTimeout(() => $('#done').classList.remove('show'), 3800); }
    if (!all) doneShown = false;
  }

  // ---------- 按钮 ----------
  $('#btnRef').onclick = () => { $('#ref').classList.add('show'); buildRef(); sfx('tick'); };
  $('#ref').addEventListener('pointerdown', e => { if (e.target.id === 'ref' || e.target.closest('[data-close]')) $('#ref').classList.remove('show'); });
  $('#btnApply').onclick = () => {
    $('#ref').classList.remove('show');
    const f = finished();
    for (const id of Object.keys(placed)) removeFromScene(id);
    placed = {};
    const order = Object.keys(f).sort((a, b) => (FLAT[b] ? 1 : 0) - (FLAT[a] ? 1 : 0) || (f[a].cy + S[a].h / 2) - (f[b].cy + S[b].h / 2));
    order.forEach((id, n) => { placed[id] = f[id]; putOnScene(id, 0.1 + n * 0.09); });
    restack(); save(); renderSheet(); doneShown = true;
    order.forEach((id, n) => setTimeout(() => sfx('stick'), (100 + n * 90)));
  };
  $('#btnClear').onclick = () => {
    if (!Object.keys(placed).length) return;
    if (!confirm('把贴好的贴纸全部撕下来放回贴纸页？')) return;
    const ids = Object.keys(placed);
    ids.forEach((id, n) => { const e = els[id]; if (e) { e.style.animationDelay = (n * 0.02) + 's'; e.classList.add('peeloff'); } });
    sfx('tear');
    setTimeout(() => { for (const id of ids) removeFromScene(id); placed = {}; restack(); save(); page = 0; renderSheet(); }, 450 + ids.length * 20);
  };
  function syncMute() { $('#btnMute').textContent = muted ? '声音：关' : '声音：开'; if (PB.setMuted) PB.setMuted(muted); }
  $('#btnMute').onclick = () => { muted = !muted; syncMute(); save(); };

  // 成品参考：同一套贴纸按成品位置摆好，静止显示
  function buildRef() {
    const box = $('#refScene');
    if (box.dataset.built) return;
    box.dataset.built = 1;
    const f = finished();
    Object.keys(f).sort((a, b) => (FLAT[b] ? 1 : 0) - (FLAT[a] ? 1 : 0) || (f[a].cy + S[a].h / 2) - (f[b].cy + S[b].h / 2)).forEach((id, n) => {
      const s = S[id], im = document.createElement('img');
      im.src = s.src; im.className = 'refstk';
      im.style.left = pct(f[id].cx - s.w / 2, CW); im.style.top = pct(f[id].cy - s.h / 2, CH);
      im.style.width = pct(s.w, CW); im.style.zIndex = n + 1;
      box.appendChild(im);
    });
  }

  // ---------- 启动 ----------
  window.addEventListener('resize', fit);
  fit();
  Object.keys(placed).sort((a, b) => bottomOf(a) - bottomOf(b)).forEach((id, n) => putOnScene(id, 0.2 + n * 0.03));
  restack(); syncMute(); updateCount();
  window.__TEST__ = { placed: () => placed, finished, S, apply: () => $('#btnApply').click(), page: n => { page = n; renderSheet(); } };
  window.__READY__ = true;
})();
