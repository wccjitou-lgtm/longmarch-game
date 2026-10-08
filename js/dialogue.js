// 对话引擎：打字机 + 立绘 + 头像
var Dialogue = (function () {
  var lines = [], idx = -1, onDone = null, typing = false, timer = null, box = null;

  function el(id) { return document.getElementById(id); }

  function play(lineArr, doneCb) {
    lines = lineArr; idx = -1; onDone = doneCb;
    box = el('dlg-box');
    el('dlg-stage').style.display = '';
    box.style.display = '';
    el('dlg-actions').style.display = 'none';
    next();
  }

  function cur() { return idx >= 0 && idx < lines.length ? lines[idx] : null; }

  function paint() {
    var L = cur();
    if (!L) return;
    var c = CHARS[L.ch] || CHARS.zhou;
    // 立绘：复用同一 <img>，仅换 src，避免每句重建元素造成解码卡顿
    var stage = el('dlg-stage');
    var img = stage.querySelector('img.dlg-figure');
    if (!img) {
      stage.innerHTML = '';
      img = document.createElement('img');
      img.className = 'dlg-figure';
      img.alt = '';
      stage.appendChild(img);
    }
    var src = charImg(L.ch, L.m || 'full');
    if (img.getAttribute('src') !== src) {
      img.className = 'dlg-figure' + (c.enemy ? ' enemy' : '');
      img.alt = c.name;
      img.src = src;
    }
    el('dlg-name').textContent = c.name + (c.enemy ? '（敌方）' : '·' + c.role);
    el('dlg-ava').src = charImg(L.ch, 'avatar');
    el('dlg-text').textContent = '';
    type(L.t);
  }

  function type(text) {
    typing = true;
    var i = 0;
    el('dlg-next').style.visibility = 'hidden';
    clearInterval(timer);
    timer = setInterval(function () {
      i += 2;
      el('dlg-text').textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(timer); typing = false;
        el('dlg-next').style.visibility = '';
      }
    }, 30);
    el('dlg-text').dataset.full = text;
  }

  function advance() {
    if (typing) { // 快进本句
      clearInterval(timer); typing = false;
      el('dlg-text').textContent = el('dlg-text').dataset.full;
      el('dlg-next').style.visibility = '';
      return;
    }
    next();
  }

  function next() {
    idx++;
    if (idx >= lines.length) {
      box.style.display = 'none';
      el('dlg-stage').style.display = 'none';
      el('dlg-actions').style.display = 'flex';
      if (onDone) onDone();
      return;
    }
    paint();
  }

  function skipAll() {
    idx = lines.length;
    next();
  }

  function init() {
    el('dlg-box').addEventListener('click', advance);
  }

  return { play: play, init: init };
})();
