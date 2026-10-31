/* ============================================================
   录音室设计 · H5
   - 750×1334 舞台等比缩放
   - 一屏一屏吸附滚动
   - 图片淡入 + 上移 20px（0.6s ease-out）
   - 文字逐行淡入
   ============================================================ */
(function () {
  'use strict';

  var DESIGN_W = 750;
  var DESIGN_H = 1334;

  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var rail = document.getElementById('rail');
  var indexList = document.getElementById('indexList');
  var indexPanel = document.getElementById('index');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 0. 单屏预览（调试用：index.html?only=8 只看第 8 屏） ---------- */
  var onlyOne = new URLSearchParams(location.search).get('only');
  if (onlyOne !== null) {
    var keep = parseInt(onlyOne, 10) || 0;
    screens.forEach(function (s, i) { if (i !== keep) s.style.display = 'none'; });
    document.documentElement.style.scrollSnapType = 'none';
    document.documentElement.style.setProperty('--s', '1');
    var hh = new URLSearchParams(location.search).get('h');
    if (hh) document.documentElement.style.setProperty('--h', hh + 'px');
    if (new URLSearchParams(location.search).get('static') === '1') {
      document.documentElement.classList.add('no-anim');
    }
    window.addEventListener('load', function () { screens[keep] && screens[keep].classList.add('in'); });
  }

  /* ---------- 1. 缩放：宽定比例，高自适应（竖屏手机不留黑边） ---------- */
  var lastScale = 0;
  function fitStage() {
    if (onlyOne !== null) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var s = Math.min(w / DESIGN_W, h / DESIGN_H);
    if (Math.abs(s - lastScale) > 0.001) {
      // 面板高度 = 视口高度换算成设计像素，保证铺满一屏
      var panelH = Math.max(DESIGN_H, Math.round(h / s));
      document.documentElement.style.setProperty('--s', s.toFixed(4));
      document.documentElement.style.setProperty('--h', panelH + 'px');
      lastScale = s;
    }
  }
  fitStage();
  window.addEventListener('resize', fitStage, { passive: true });
  window.addEventListener('orientationchange', function () {
    setTimeout(fitStage, 260);
  });

  /* ---------- 2. 逐行拆字：按视觉行切开，让文字一行一行浮现 ---------- */
  function splitLines(el) {
    if (el.dataset.raw) return true;
    var raw = el.textContent.replace(/\s+$/, '');
    if (!raw) return false;
    el.dataset.raw = raw;

    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return false;

    // 用 Range 逐字量行位置：不改动排版，中文避头尾规则仍由浏览器负责
    var range = document.createRange();
    var tops = [];
    for (var i = 0; i < raw.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      tops.push(Math.round(range.getBoundingClientRect().top));
    }

    var groups = [];
    var start = 0;
    for (var k = 1; k < tops.length; k++) {
      if (Math.abs(tops[k] - tops[start]) > 2) {
        groups.push([start, k]);
        start = k;
      }
    }
    groups.push([start, tops.length]);

    el.textContent = '';
    groups.forEach(function (g, idx) {
      var line = document.createElement('span');
      line.className = 'ln';
      var inner = document.createElement('span');
      inner.textContent = raw.slice(g[0], g[1]);
      inner.style.setProperty('--i', idx);
      line.appendChild(inner);
      el.appendChild(line);
    });

    // 如果某一行放不下（挂标点等情况），退回整段淡入，保证排版不出错
    var limit = el.clientWidth + 1;
    var lines = el.querySelectorAll('.ln > span');
    for (var m = 0; m < lines.length; m++) {
      if (lines[m].getBoundingClientRect().width > limit) {
        el.textContent = raw;
        return false;
      }
    }
    return true;
  }

  function prepare(section) {
    if (section.dataset.ready === '1') return;
    section.dataset.ready = '1';
    if (reduceMotion) return;
    section.querySelectorAll('.js-split').forEach(function (el) {
      if (el.children.length > 0) return;
      el.classList.remove('rv');
      if (!splitLines(el)) el.classList.add('rv');
    });
  }

  /* ---------- 3. 入场 / 出场 ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          var sec = en.target;
          if (en.intersectionRatio > 0.5) {
            prepare(sec);
            // 触发一次重排，让初始状态先生效，随后的 .in 才会真正产生过渡
            void sec.offsetHeight;
            sec.classList.add('in');
            setActive(screens.indexOf(sec));
          } else if (en.intersectionRatio < 0.35) {
            sec.classList.remove('in');
          }
        });
      },
      { threshold: [0, 0.35, 0.5, 0.75] }
    );
    screens.forEach(function (s) { io.observe(s); });
  } else {
    screens.forEach(function (s) { s.classList.add('in'); });
  }

  /* ---------- 4. 右侧进度条 ---------- */
  var dots = [];
  screens.forEach(function (sec, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', sec.dataset.label || '第 ' + i + ' 屏');
    b.addEventListener('click', function () { goTo(i); });
    rail.appendChild(b);
    dots.push(b);
  });

  function setActive(i) {
    dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
  }

  /* ---------- 5. 跳转 ---------- */
  function goTo(i) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    var y = screens[i].offsetTop;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function current() {
    var mid = window.scrollY + window.innerHeight * 0.5;
    for (var i = 0; i < screens.length; i++) {
      var s = screens[i];
      if (mid >= s.offsetTop && mid < s.offsetTop + s.offsetHeight) return i;
    }
    return 0;
  }

  /* ---------- 6. 目录 ---------- */
  screens.forEach(function (sec, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    var no = i === 0 ? '00' : String(i).padStart(2, '0');
    var label = (sec.dataset.label || '').replace(/^\d{2}\s*/, '');
    b.innerHTML = '<span>' + no + '</span>' + label;
    b.addEventListener('click', function () {
      closeIndex();
      goTo(i);
    });
    li.appendChild(b);
    indexList.appendChild(li);
  });

  function openIndex() {
    indexPanel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeIndex() {
    indexPanel.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('menuBtn').addEventListener('click', openIndex);
  document.getElementById('closeBtn').addEventListener('click', closeIndex);

  /* ---------- 7. 键盘 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeIndex(); return; }
    if (indexPanel.classList.contains('open')) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown' || k === ' ') {
      e.preventDefault();
      goTo(current() + 1);
    } else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault();
      goTo(current() - 1);
    } else if (k === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (k === 'End') {
      e.preventDefault();
      goTo(screens.length - 1);
    }
  });

  /* ---------- 8. 支持 #s5 这类深链接 ---------- */
  function jumpHash() {
    var id = location.hash.replace('#', '');
    if (!id) return;
    var t = document.getElementById(id);
    if (t && t.classList.contains('screen')) {
      var i = screens.indexOf(t);
      setTimeout(function () { window.scrollTo(0, screens[i].offsetTop); }, 60);
    }
  }
  window.addEventListener('hashchange', jumpHash);

  /* ---------- 9. 首屏预热 ---------- */
  window.addEventListener('load', function () {
    fitStage();
    prepare(screens[0]);
    screens[0].classList.add('in');
    jumpHash();
  });
})();
