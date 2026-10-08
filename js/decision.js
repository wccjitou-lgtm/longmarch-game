// 决策系统：选项 + 两段式提示 + 正误反馈（失败推演）
var Decision = (function () {
  var node = null, hintStage = 0, order = [];

  function el(id) { return document.getElementById(id); }

  function start(n, firstTryDone) {
    node = n; hintStage = 0;
    // 打乱选项展示顺序（防"全选A"套路）；同一道题内保持稳定，重选/排除不换位
    order = [];
    for (var i = 0; i < n.decision.options.length; i++) order.push(i);
    for (i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = order[i]; order[i] = order[j]; order[j] = t;
    }
    render();
    el('dec-wrap').style.display = '';
  }

  function hide() { el('dec-wrap').style.display = 'none'; }

  function render() {
    var d = node.decision;
    var h = '<div class="dec-card">' +
      '<div class="dec-q"><span class="dec-badge">关键决策</span><p>' + d.q + '</p></div>' +
      '<div class="dec-opts">';
    for (var k = 0; k < order.length; k++) {
      var i = order[k];
      var dis = (hintStage >= 2 && d.hints[1] && d.hints[1].exclude === i) ? ' disabled' : '';
      h += '<button class="dec-opt' + (dis ? ' eliminated' : '') + '" data-i="' + i + '"' + dis + '><b>' + 'ABC'[k] + '</b>' + d.options[i].label + '</button>';
    }
    var hintHtml = '', hintsDone = hintStage >= d.hints.length;
    for (var j = 0; j < hintStage; j++) hintHtml += '<p>💡 ' + d.hints[j].t + '</p>';
    h += '</div>' +
      '<div class="dec-hint"><button id="hintBtn"' + (hintsDone ? ' disabled' : '') + '>' +
      (hintsDone ? '已无更多提示' : '💡 提示') + '</button><div id="hintTxt">' + hintHtml + '</div></div>' +
      '</div>';
    el('dec-wrap').innerHTML = h;
    el('dec-wrap').style.display = '';
    var btns = el('dec-wrap').querySelectorAll('.dec-opt');
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { choose(+this.getAttribute('data-i')); });
    }
    el('hintBtn').addEventListener('click', showHint);
    // 防连点穿透：从失败推演"重新决策"返回时，连击可能误选选项
    var wrap = el('dec-wrap');
    wrap.style.pointerEvents = 'none';
    setTimeout(function () { wrap.style.pointerEvents = ''; }, 320);
  }

  function showHint() {
    var d = node.decision;
    if (hintStage >= d.hints.length) return;
    var ht = d.hints[hintStage];
    hintStage++;
    var box = el('hintTxt');
    box.innerHTML += '<p>💡 ' + ht.t + '</p>';
    if (hintStage === 2) {
      el('hintBtn').textContent = '已无更多提示';
      el('hintBtn').disabled = true;
      if (d.hints[1] && typeof d.hints[1].exclude === 'number') {
        var b = el('dec-wrap').querySelector('.dec-opt[data-i="' + d.hints[1].exclude + '"]');
        if (b) { b.disabled = true; b.classList.add('eliminated'); }
      }
    }
  }

  function choose(i) {
    var d = node.decision;
    var opt = d.options[i];
    if (opt.correct) {
      Game.onDecide(node.id, true);
      feedbackOK(d.note);
    } else {
      Game.onDecide(node.id, false);
      feedbackFail(opt.fail);
    }
  }

  function feedbackOK(note) {
    var h = '<div class="fb-card ok">' +
      '<div class="fb-head"><span class="fb-tag ok">✓ 决策正确</span></div>' +
      '<h3>历史上的真实选择</h3><p>' + note + '</p>' +
      '<button class="btn btn-primary" id="fbGo">继续前进 →</button></div>';
    show(h);
    el('fbGo').addEventListener('click', function () { hideFb(); Game.completeNode(); });
  }

  function feedbackFail(fail) {
    var e = fail.enemy || 'wang';
    var lines = '';
    for (var i = 0; i < fail.lines.length; i++) lines += '<p>' + fail.lines[i] + '</p>';
    var h = '<div class="fb-card bad">' +
      '<div class="fb-head"><span class="fb-tag bad">✗ 失败推演</span></div>' +
      '<div class="fb-enemy"><img src="' + charImg(e, 'smile') + '" alt=""><div><h3>' + fail.title + '</h3><div class="fb-lines">' + lines + '</div></div></div>' +
      '<div class="fb-retry">历史不容假设——当年的红军没有重来机会，<br>但你可以。回到决策点，再来一次。</div>' +
      '<button class="btn btn-primary" id="fbRetry">重新决策</button></div>';
    show(h);
    el('fbRetry').addEventListener('click', function () {
      hideFb();
      render(); // 重回决策（已排除的选项保持排除）
    });
  }

  function show(html) {
    hide();
    var w = el('fb-wrap');
    w.innerHTML = html;
    w.style.display = '';
  }
  function hideFb() { el('fb-wrap').style.display = 'none'; }

  return { start: start, hide: hide };
})();
