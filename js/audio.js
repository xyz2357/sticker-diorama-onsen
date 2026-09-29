// audio.js — 全部用 WebAudio 现场合成，不带音频文件
(function () {
  'use strict';
  const PB = window.PB = window.PB || {};
  let ctx = null, master = null, noise = null, ambGain = null, rainNode = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ctx.destination);
      ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
      const len = ctx.sampleRate;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function osc(type, f0, f1, t, dur, peak, dest, a = 0.005) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, a, peak, 0, dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function burst(t, dur, peak, type, f0, f1, q = 1, dest) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, peak, 0, dur);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const SFX = {
    // 从底纸上撕起来
    peel(t) {
      burst(t, 0.22, 0.28, 'bandpass', 700, 3800, 1.4);
      for (let i = 0; i < 4; i++) burst(t + 0.03 + Math.random() * 0.15, 0.025, 0.12, 'highpass', 4000, 4000);
    },
    // 按上去
    stick(t) {
      osc('sine', 190, 70, t, 0.1, 0.45);
      burst(t, 0.06, 0.22, 'lowpass', 1400, 600, 0.7);
    },
    // 撕掉扔掉
    tear(t) {
      for (let i = 0; i < 6; i++) burst(t + i * 0.035, 0.05, 0.16, 'bandpass', 3000 - i * 350, 1500 - i * 150, 2);
      burst(t + 0.2, 0.12, 0.1, 'lowpass', 900, 300);
    },
    pop(t) { osc('sine', 480, 980, t, 0.1, 0.25); osc('triangle', 960, 1400, t + 0.02, 0.08, 0.08); },
    tick(t) { osc('sine', 1300, 1100, t, 0.035, 0.08); },
    chime(t) {
      [72, 76, 79, 84, 88].forEach((m, i) => {
        osc('triangle', N(m), N(m), t + i * 0.085, 0.7, 0.13);
        osc('sine', N(m - 12), N(m - 12), t + i * 0.085, 0.5, 0.05);
      });
    },
    fanfare(t) {
      [60, 64, 67, 72].forEach((m, i) => osc('triangle', N(m), N(m), t + i * 0.1, 0.35, 0.14));
      [72, 76, 79].forEach(m => osc('triangle', N(m), N(m), t + 0.45, 1.2, 0.1));
      [48, 55].forEach(m => osc('sine', N(m), N(m), t + 0.45, 1.2, 0.12));
    },
    shutter(t) {
      burst(t, 0.03, 0.4, 'highpass', 2500, 2500);
      burst(t + 0.07, 0.04, 0.3, 'bandpass', 1800, 1200, 2);
      osc('sine', 90, 60, t + 0.07, 0.05, 0.2);
    },
    whoosh(t) { burst(t, 0.6, 0.12, 'bandpass', 300, 1800, 0.8); },
    grow(t) { [0, 1, 2, 3, 4, 5].forEach(i => osc('sine', 300 + i * 90, 360 + i * 110, t + i * 0.05, 0.07, 0.1)); },
    // 小动物
    quack(t) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 3; f.connect(master);
      osc('sawtooth', 520, 380, t, 0.14, 0.22, f); osc('sawtooth', 500, 360, t + 0.18, 0.12, 0.16, f);
    },
    chirp(t) {
      for (let i = 0; i < 3; i++) osc('sine', 2600 + Math.random() * 400, 3800, t + i * 0.09, 0.05, 0.08);
    },
    meow(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2.5;
      o.frequency.setValueAtTime(560, t); o.frequency.linearRampToValueAtTime(820, t + 0.18); o.frequency.linearRampToValueAtTime(480, t + 0.45);
      env(g, t, 0.04, 0.2, 0.25, 0.2); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
    },
    croak(t) {
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.setValueAtTime(95, t + i * 0.22);
        f.type = 'lowpass'; f.frequency.value = 700;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 38; lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(g.gain);
        env(g, t + i * 0.22, 0.01, 0.12, 0.08, 0.06);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.2); lfo.start(t + i * 0.22); lfo.stop(t + i * 0.22 + 0.2);
      }
    },
    cricket(t) { for (let i = 0; i < 3; i++) osc('sine', 4200, 4300, t + i * 0.06, 0.03, 0.03); },
    boing(t) { osc('sine', 220, 520, t, 0.18, 0.2); },
  };

  PB.sfx = function (name, delay = 0) {
    if (muted) return;
    if (!ac()) return;
    const f = SFX[name]; if (!f) return;
    try { f(ctx.currentTime + 0.01 + delay); } catch (e) { /* 音频失败不影响游戏 */ }
  };

  // 雨声：持续噪声，按场景里雨云数量调音量
  PB.setRain = function (level) {
    if (!ctx) return;
    if (!rainNode && level > 0) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      s.connect(hp); hp.connect(lp); lp.connect(ambGain); s.start();
      rainNode = s;
    }
    ambGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.09, level * 0.045), ctx.currentTime, 0.4);
  };

  PB.setMuted = function (m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
  };
  PB.isMuted = () => muted;
  PB.unlockAudio = () => ac();
})();
