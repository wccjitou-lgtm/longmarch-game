// 主状态机：开始 → 地图 → 节点（对话/科学/决策/反馈）→ 结算 → 重挑战
var Game = (function () {
  var SAVE_KEY = 'longmarch_v1';
  var state = { nodeIndex: 0, firstWrong: {}, finished: false };

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }


  // ---------- 安全存储（隐私模式下 localStorage 可能被禁用） ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ---------- 存档 ----------
  function save() {
    lsSet(SAVE_KEY, JSON.stringify(state));
  }
  function load() {
    try {
      var s = lsGet(SAVE_KEY);
      if (s) {
        s = JSON.parse(s);
        if (!s || typeof s !== 'object' || Array.isArray(s) ||
            !Number.isInteger(s.nodeIndex) || s.nodeIndex < 0 || s.nodeIndex >= NODES.length ||
            !s.firstWrong || typeof s.firstWrong !== 'object' || Array.isArray(s.firstWrong) ||
            typeof s.finished !== 'boolean' ||
            (s.finished && s.nodeIndex !== NODES.length - 1)) return false;
        var wrong = {}, ids = Object.keys(s.firstWrong);
        for (var i = 0; i < ids.length; i++) {
          var index = nodeIndexById(ids[i]);
          if (index < 0 || index > s.nodeIndex || !NODES[index].decision ||
              s.firstWrong[ids[i]] !== true) return false;
          wrong[ids[i]] = true;
        }
        state = { nodeIndex: s.nodeIndex, firstWrong: wrong, finished: s.finished };
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ---------- 屏幕切换 ----------
  function show(id) {
    var ss = document.querySelectorAll('.screen');
    for (var i = 0; i < ss.length; i++) ss[i].classList.remove('active');
    el(id).classList.add('active');
  }

  // ---------- 标题页 ----------
  function toTitle() {
    show('screen-title');
    var has = load() && !state.finished;
    el('btn-continue').style.display = has ? '' : 'none';
  }
  function newGame() {
    state = { nodeIndex: 0, firstWrong: {}, finished: false };
    save();
    toMap();
  }
  function continueGame() {
    if (!load()) { newGame(); return; }
    toMap();
  }

  // ---------- 地图页 ----------
  function toMap() {
    show('screen-map');
    renderTopbar();
    MapView.updateStates();
    var nd = NODES[state.nodeIndex];
    if (nd.terminal && state.finished) { toSettle(); return; }
    renderNodeCard();
    // 每次回到地图都复位到全图视角，避免缩放/平移后"找不到自己在哪"
    setTimeout(MapView.resetView, 60);
  }
  function renderTopbar() {
    var total = NODES.length;
    var doneN = state.nodeIndex;
    var wrongN = Object.keys(state.firstWrong).length;
    el('tb-progress').textContent = '第 ' + Math.min(state.nodeIndex + 1, total) + ' / ' + total + ' 站';
    el('tb-bar').style.width = (doneN / (total - 1) * 100) + '%';
    var wb = el('tb-wrong');
    wb.textContent = wrongN ? '失误 ' + wrongN + ' 次' : '零失误';
    wb.className = 'wrong-badge' + (wrongN ? ' has' : '');
  }
  function renderNodeCard() {
    var nd = NODES[state.nodeIndex];
    var h = '<div class="nc-head"><span class="nc-date">' + nd.date + '</span><h3>' + nd.name + '</h3><span class="nc-place">' + nd.place + '</span></div>' +
      '<p class="nc-brief">' + nd.brief + '</p>';
    if (nd.terminal) {
      h += '<button class="btn btn-primary" id="nc-go">到达终点</button>';
    } else {
      h += '<button class="btn btn-primary" id="nc-go">进入节点</button>';
    }
    el('node-card').innerHTML = h;
    el('nc-go').addEventListener('click', function () { enterNode(); });
  }
  function openNodeCard() { enterNode(); }

  // ---------- 历史照片（每站一张） ----------
  var pvList = [], pvIdx = 0;
  function renderPhotos(nd) {
    var strip = el('photo-strip');
    var list = (typeof PHOTOS !== 'undefined' && PHOTOS[nd.id]) ? PHOTOS[nd.id] : [];
    var p = list[0];
    strip.innerHTML = '';
    strip.style.display = p ? 'flex' : 'none';
    if (p) {
      var card = document.createElement('div');
      card.className = 'photo-main';
      card.innerHTML = '<img loading="lazy" src="' + p.src + '" alt="历史照片"><span>' + esc(p.cap) + '</span>';
      card.addEventListener('click', function () { openViewer(nd.id, 0); });
      strip.appendChild(card);
    }
  }
  function openViewer(nodeId, idx) {
    pvList = (typeof PHOTOS !== 'undefined' && PHOTOS[nodeId]) || [];
    if (!pvList.length) return;
    pvIdx = idx;
    el('photo-viewer').style.display = '';
    var multi = pvList.length > 1;
    el('pv-prev').style.display = multi ? '' : 'none';
    el('pv-next').style.display = multi ? '' : 'none';
    showPv();
  }
  function showPv() {
    var p = pvList[pvIdx];
    if (!p) return;
    el('pv-img').src = p.src;
    el('pv-cap').textContent = p.cap;
  }
  function closeViewer() { el('photo-viewer').style.display = 'none'; }

  // ---------- 节点流程 ----------
  function enterNode() {
    show('screen-node');
    var nd = NODES[state.nodeIndex];
    el('nd-title').textContent = nd.name;
    el('nd-meta').textContent = nd.date + ' · ' + nd.place;
    el('sci-panel').classList.remove('open');
    el('fb-wrap').style.display = 'none';
    closeViewer();
    Decision.hide();
    renderPhotos(nd);
    // 剧情对话结束后显示操作
    Dialogue.play(nd.dialogue, function () {
      showNodeActions(nd);
    });
  }
  function showNodeActions(nd) {
    var bar = el('dlg-actions');
    if (nd.terminal) {
      bar.innerHTML = '<button class="btn btn-primary" id="act-end">翻开终点之页</button>';
    } else {
      bar.innerHTML =
        '<button class="btn btn-ghost" id="act-sci">📊 科学研判</button>' +
        '<button class="btn btn-primary" id="act-dec">⚔ 做出决策</button>';
    }
    // 防连点穿透：对话最后一下"继续"的连击可能误触刚出现的按钮
    bar.style.pointerEvents = 'none';
    setTimeout(function () { bar.style.pointerEvents = ''; }, 320);
    if (nd.terminal) {
      el('act-end').addEventListener('click', finishGame);
    } else {
      el('act-sci').addEventListener('click', openScience);
      el('act-dec').addEventListener('click', startDecision);
    }
  }
  function openScience() {
    var nd = NODES[state.nodeIndex];
    var body = el('sci-body');
    body.innerHTML = Sci.render(nd.science);
    Sci.bind(body, nd.science);
    el('sci-panel').classList.add('open');
  }
  function startDecision() {
    el('sci-panel').classList.remove('open');
    var nd = NODES[state.nodeIndex];
    Decision.start(nd);
  }

  // 决策回调：记录首次对错
  function onDecide(nodeId, correct) {
    if (!correct && !state.firstWrong[nodeId]) {
      state.firstWrong[nodeId] = true;
      save();
      renderTopbar();
    } else if (correct) {
      save();
    }
  }
  function completeNode() {
    state.nodeIndex++;
    save();
    renderTopbar();
    var nd = NODES[state.nodeIndex];
    if (nd.terminal) { toMap(); renderNodeCard(); }
    else { toMap(); }
  }

  // ---------- 结算 ----------
  function finishGame() {
    state.finished = true;
    state.nodeIndex = NODES.length - 1; // 停在吴起镇
    save();
    toSettle();
  }
  function toSettle() {
    show('screen-settle');
    var wrongIds = Object.keys(state.firstWrong);
    var total = DECISION_NODE_COUNT;
    var right = total - wrongIds.length;
    var rate = Math.round(right / total * 100);
    var perfect = wrongIds.length === 0;

    el('st-rate').textContent = rate + '%';
    el('st-rate-sub').textContent = right + ' / ' + total + ' 个决策首次答对';
    // 圆环
    var ring = el('st-ring-fg');
    var C = 2 * Math.PI * 52;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C * (1 - right / total);
    ring.style.stroke = perfect ? '#2e7d32' : '#c8102e';
    el('st-title').textContent = perfect ? '长征胜利！' : '到达陕北，但历史已被改写';
    el('st-figure').src = perfect ? charImg('zhou', 'smile') : charImg('zhou', 'serious');
    el('st-figure').className = 'st-figure' + (perfect ? ' win' : '');

    var h = '';
    if (perfect) {
      h += '<p class="st-epi">368 天、二万五千里、11 个省。三大主力红军于 1936 年 10 月在甘肃会宁胜利会师。<br>每一代人有每一代人的长征路，祝贺你走完了这一程。</p>';
    } else {
      h += '<p class="st-epi warn">你有 ' + wrongIds.length + ' 个决策靠"重来"才走对。当年的红军没有重来机会——看看这些关口：</p><ul class="st-list">';
      for (var i = 0; i < wrongIds.length; i++) {
        var nd = NODES[nodeIndexById(wrongIds[i])];
        h += '<li><b>' + nd.name + '</b>（' + nd.date + '）</li>';
      }
      h += '</ul>';
    }
    el('st-detail').innerHTML = h;
    el('btn-retry').textContent = perfect ? '再走一遍长征路' : '重新挑战（目标：100%）';
  }
  function retry() {
    if (!confirm('确定重新开始长征吗？当前进度将被清除。')) return;
    lsDel(SAVE_KEY);
    newGame();
  }

  // ---------- 辅助 ----------
  var toastTimer = null;
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function showHistory(nd) {
    var h = '<div class="his-card"><h3>' + esc(nd.name) + '<span>' + esc(nd.date) + '</span></h3>' +
      '<p>' + esc(nd.brief) + '</p>';
    if (nd.decision && nd.decision.note) h += '<p class="his-note">' + esc(nd.decision.note) + '</p>';
    h += '<button class="btn btn-ghost" id="his-close">关闭</button></div>';
    var w = el('his-wrap');
    w.innerHTML = h;
    w.style.display = '';
    el('his-close').addEventListener('click', function () { w.style.display = 'none'; });
  }

  // ---------- 背景音乐 ----------
  function initBgm() {
    var ctrl = el('bgm-ctrl');
    if (typeof MUSIC === 'undefined' || !MUSIC || !MUSIC.src) return;
    var audio = el('bgm-audio');
    var btn = el('bgm-btn'), pop = el('bgm-pop'), vol = el('bgm-vol'), tog = el('bgm-toggle');
    var on = lsGet('bgm_on') !== '0';
    var storedVolume = lsGet('bgm_vol2');
    var v = +(storedVolume || 10);
    if (!Number.isFinite(v)) v = 10;
    v = Math.min(100, Math.max(0, v));
    audio.src = MUSIC.src;
    audio.loop = true;
    ctrl.style.display = '';

    function icon() {
      btn.textContent = (!on || v === 0) ? '🔇' : (v < 50 ? '🔉' : '🔊');
      tog.textContent = on ? '⏸ 暂停' : '▶ 播放';
    }
    function apply() {
      audio.volume = v / 100;
      if (on) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
      else audio.pause();
      icon();
      lsSet('bgm_on', on ? '1' : '0');
      lsSet('bgm_vol2', String(v));
    }
    // 浏览器自动播放策略：任何一次用户点击都尝试恢复播放
    document.addEventListener('pointerdown', function () {
      if (on && audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      pop.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!ctrl.contains(e.target)) pop.classList.remove('open');
    });
    vol.value = v;
    vol.addEventListener('input', function () { v = +vol.value; apply(); });
    tog.addEventListener('click', function () { on = !on; apply(); });
    apply();
  }

  // ---------- 初始化 ----------
  function init() {
    Dialogue.init();
    MapView.build();
    initBgm();

    el('btn-start').addEventListener('click', function () {
      if (load() && !state.finished) {
        if (confirm('检测到上次的长征进度，是否继续？\n（确定=继续上次进度，取消=从头开始）')) { continueGame(); return; }
      }
      newGame();
    });
    el('btn-continue').addEventListener('click', continueGame);
    var helpReturn = 'screen-title';
    el('btn-help').addEventListener('click', function () { helpReturn = 'screen-title'; show('screen-help'); });
    el('help-close').addEventListener('click', function () { show(helpReturn); });
    el('tb-home').addEventListener('click', toTitle);
    el('tb-help').addEventListener('click', function () { helpReturn = 'screen-map'; show('screen-help'); });
    el('map-reset').addEventListener('click', MapView.resetView);
    el('sci-close').addEventListener('click', function () { el('sci-panel').classList.remove('open'); });
    el('pv-close').addEventListener('click', closeViewer);
    el('photo-viewer').addEventListener('click', function (e) { if (e.target === this) closeViewer(); });
    el('pv-prev').addEventListener('click', function () { pvIdx = (pvIdx - 1 + pvList.length) % pvList.length; showPv(); });
    el('pv-next').addEventListener('click', function () { pvIdx = (pvIdx + 1) % pvList.length; showPv(); });
    document.addEventListener('keydown', function (e) {
      if (el('photo-viewer').style.display === 'none') return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') el('pv-prev').click();
      if (e.key === 'ArrowRight') el('pv-next').click();
    });
    el('btn-retry').addEventListener('click', retry);
    el('st-home').addEventListener('click', toTitle);

    load();
    toTitle();
  }

  return {
    init: init,
    get state() { return state; },
    toTitle: toTitle, newGame: newGame, continueGame: continueGame,
    toMap: toMap, enterNode: enterNode, openNodeCard: openNodeCard,
    onDecide: onDecide, completeNode: completeNode,
    toast: toast, showHistory: showHistory
  };
})();

window.addEventListener('DOMContentLoaded', Game.init);
