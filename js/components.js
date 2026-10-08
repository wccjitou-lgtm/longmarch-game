// 科学信息交互组件（C1 剖面 / C2 气温 / C3 渡江 / C4 行军 / C5 沼泽 / kv 数据）
var Sci = (function () {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderKV(block) {
    var h = '<div class="sci-kv">';
    for (var i = 0; i < block.items.length; i++) {
      h += '<div class="sci-kv-row"><span class="k">' + esc(block.items[i][0]) + '</span><span class="v">' + esc(block.items[i][1]) + '</span></div>';
    }
    return h + '</div>';
  }

  // C1 地形高程剖面
  function renderProfile(block, idx) {
    var W = 320, H = 150, padL = 34, padB = 26, padT = 10;
    var pts = block.pts;
    var maxD = pts[pts.length - 1][0], minE = Infinity, maxE = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][1] < minE) minE = pts[i][1];
      if (pts[i][1] > maxE) maxE = pts[i][1];
    }
    function X(d) { return padL + (d / maxD) * (W - padL - 8); }
    function Y(e) { return padT + (1 - (e - minE + 200) / (maxE - minE + 400)) * (H - padT - padB); }
    var line = '', area = 'M' + X(0) + ' ' + (H - padB) + ' ';
    for (i = 0; i < pts.length; i++) {
      var x = X(pts[i][0]).toFixed(1), y = Y(pts[i][1]).toFixed(1);
      line += (i ? 'L' : 'M') + x + ' ' + y;
      area += 'L' + x + ' ' + y + ' ';
    }
    area += 'L' + X(maxD).toFixed(1) + ' ' + (H - padB) + ' Z';
    var h = '<div class="sci-profile"><svg viewBox="0 0 ' + W + ' ' + H + '" class="prof-svg" data-idx="' + idx + '">';
    h += '<path d="' + area + '" fill="#c8102e22"/><path d="' + line + '" fill="none" stroke="#c8102e" stroke-width="2.5" stroke-linejoin="round"/>';
    // 轴
    h += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - 8) + '" y2="' + (H - padB) + '" stroke="#2b3a4255"/>';
    for (i = 0; i < pts.length; i++) {
      h += '<circle cx="' + X(pts[i][0]).toFixed(1) + '" cy="' + Y(pts[i][1]).toFixed(1) + '" r="3" fill="#2b3a42"/>';
      if (pts[i][2]) {
        h += '<text x="' + X(pts[i][0]).toFixed(1) + '" y="' + (Y(pts[i][1]) - 7).toFixed(1) + '" font-size="8.5" text-anchor="middle" fill="#2b3a42">' + esc(pts[i][2]) + '</text>';
      }
    }
    h += '<text x="' + padL + '" y="' + (H - 8) + '" font-size="8" fill="#2b3a42aa">距离（' + esc(block.unit || '里') + '）→</text>';
    h += '<text x="10" y="' + (padT + 8) + '" font-size="8" fill="#2b3a42aa" transform="rotate(90 10 ' + (padT + 8) + ')">海拔(米)</text>';
    h += '</svg><div class="prof-tip" id="proftip' + idx + '">↖ 沿折线滑动查看海拔</div></div>';
    return h;
  }

  function bindProfile(root) {
    var svgs = root.querySelectorAll('.prof-svg');
    for (var s = 0; s < svgs.length; s++) {
      (function (svg) {
        var idx = svg.getAttribute('data-idx');
        var tip = document.getElementById('proftip' + idx);
        var block = null;
        // 找到对应 block
        var panel = root;
        var bid = svg.closest('.sci-block').getAttribute('data-bi');
        block = currentSci.blocks[+bid];
        function move(ev) {
          var r = svg.getBoundingClientRect();
          var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
          var frac = (cx / r.width) * 320;
          var pts = block.pts;
          var d = null;
          for (var i = 0; i < pts.length; i++) if (frac >= 34 && (pts[i][0] / pts[pts.length - 1][0]) * (320 - 42) + 34 <= frac) d = i;
          if (d === null) return;
          tip.textContent = pts[d][2] ? (pts[d][2] + '：海拔约 ' + pts[d][1] + ' 米') : ('此处海拔约 ' + pts[d][1] + ' 米');
        }
        svg.addEventListener('mousemove', move);
        svg.addEventListener('touchmove', function (e) { move(e); e.preventDefault(); }, { passive: false });
      })(svgs[s]);
    }
  }

  // C2 气温-海拔计算器
  function renderTemp(block, idx) {
    var h = '<div class="sci-calc" id="temp' + idx + '">' +
      '<div class="calc-row"><label>海拔</label><input type="range" min="' + block.baseAlt + '" max="' + block.topAlt + '" value="' + block.topAlt + '" step="1" data-fn="temp"><span class="cv" id="tempAlt' + idx + '">' + block.topAlt + ' 米</span></div>' +
      '<div class="calc-out"><div class="big" id="tempOut' + idx + '">-' + (((block.topAlt - block.baseAlt) / 100 * block.lapseRate).toFixed(1)) + '℃</div>' +
      '<div class="exp" id="tempExp' + idx + '">山脚 ' + block.baseTemp + '℃ 时，这个海拔约 <b>' + (block.baseTemp - (block.topAlt - block.baseAlt) / 100 * block.lapseRate).toFixed(1) + '℃</b>' + (block.topAlt >= 4000 ? '，风一吹体感更冷！' : '') + '</div></div>' +
      '<div class="calc-note">规律：海拔每升高 100 米，气温约下降 ' + block.lapseRate + '℃</div></div>';
    return h;
  }
  function bindTemp(root) {
    var sl = root.querySelector('input[data-fn="temp"]');
    if (!sl) return;
    var idx = sl.closest('.sci-calc').id.replace('temp', '');
    var block = currentSci.blocks[+sl.closest('.sci-block').getAttribute('data-bi')];
    sl.addEventListener('input', function () {
      var alt = +sl.value;
      var d = (alt - block.baseAlt) / 100 * block.lapseRate;
      var t = block.baseTemp - d;
      document.getElementById('tempAlt' + idx).textContent = alt + ' 米';
      document.getElementById('tempOut' + idx).textContent = (d >= 0 ? '-' : '+') + Math.abs(d).toFixed(1) + '℃';
      document.getElementById('tempExp' + idx).innerHTML = '山脚 ' + block.baseTemp + '℃ 时，这个海拔约 <b>' + t.toFixed(1) + '℃</b>' + (alt >= 4000 ? '，风一吹体感更冷！' : '');
    });
  }

  // C3 渡江运力计算器
  function ferryStatus(block, days) {
    if (typeof block.enemyDays !== 'number') {
      return { cls: '', exp: '这里只估算运力；控制渡口、船工轮班和统一组织同样重要。' };
    }
    var bad = days > block.enemyDays;
    return {
      cls: bad ? ' bad' : ' ok',
      exp: '敌军约 <b>' + block.enemyDays + ' 天</b>后赶到' +
        (bad ? ' —— <b class="bad">来不及！</b>' : ' —— 来得及')
    };
  }
  function renderFerry(block, idx) {
    var days = block.troops / (block.boats * block.per * block.tripsPerDay);
    var status = ferryStatus(block, days);
    var h = '<div class="sci-calc ferry" id="ferry' + idx + '">' +
      '<div class="calc-row"><label>船只数</label><input type="range" min="1" max="10" step="1" value="' + block.boats + '" data-fn="ferry"><span class="cv" id="ferryB' + idx + '">' + block.boats + ' 只</span></div>' +
      '<div class="calc-params">每船每趟约 ' + block.per + ' 人 × 每天 ' + block.tripsPerDay + ' 趟 ÷ 全军 ' + block.troops + ' 人</div>' +
      '<div class="calc-out"><div class="big' + status.cls + '" id="ferryOut' + idx + '">约 ' + (Math.round(days * 10) / 10) + ' 天</div>' +
      '<div class="exp">' + status.exp + '</div></div>' +
      (block.hint ? '<div class="calc-note">' + esc(block.hint) + '</div>' : '') + '</div>';
    return h;
  }
  function bindFerry(root) {
    var sl = root.querySelector('input[data-fn="ferry"]');
    if (!sl) return;
    var box = sl.closest('.sci-calc');
    var idx = box.id.replace('ferry', '');
    var block = currentSci.blocks[+sl.closest('.sci-block').getAttribute('data-bi')];
    sl.addEventListener('input', function () {
      var b = +sl.value;
      var days = block.troops / (b * block.per * block.tripsPerDay);
      var status = ferryStatus(block, days);
      document.getElementById('ferryB' + idx).textContent = b + ' 只';
      var out = document.getElementById('ferryOut' + idx);
      out.textContent = '约 ' + (Math.round(days * 10) / 10) + ' 天';
      out.className = 'big' + status.cls;
      box.querySelector('.exp').innerHTML = status.exp;
    });
  }

  // C4 行军速度计算器
  function marchResult(block, speed) {
    var hourly = block.speedUnit === 'hour';
    var duration = block.dist / speed;
    var bad = (hourly ? duration : duration * 24) > block.hoursMax;
    var exp = '';
    if (hourly) {
      exp = '时限 ' + block.hoursMax + ' 小时：' + (bad
        ? '<b class="bad">来不及！每小时需要 ' + Math.round(block.dist / block.hoursMax * 10) / 10 + ' 里</b>'
        : '<b class="ok">按当前速度，可在时限内到达</b>');
    } else {
      exp = '时限约 <b>' + Math.round(block.hoursMax / 24 * 10) / 10 + ' 天</b>' +
        (bad ? ' —— <b class="bad">赶不上渡口！</b>' : ' —— 赶得上');
    }
    return {
      text: hourly ? ('需 ' + Math.round(duration * 10) / 10 + ' 小时') : ('约 ' + Math.round(duration * 100) / 100 + ' 天'),
      cls: 'big ' + (bad ? 'bad' : 'ok'),
      exp: exp
    };
  }
  function renderMarch(block, idx) {
    var hourly = block.speedUnit === 'hour';
    var result = marchResult(block, block.speedDefault);
    var limitDays = block.hoursMax / 24;
    var h = '<div class="sci-calc march" id="march' + idx + '">' +
      '<div class="calc-row"><label>' + (hourly ? '每小时行军' : '每天行军') + '</label><input type="range" min="' + block.speedMin + '" max="' + block.speedMax + '" step="' + (block.speedStep || 5) + '" value="' + block.speedDefault + '" data-fn="march"><span class="cv" id="marchS' + idx + '">' + block.speedDefault + ' 里</span></div>' +
      '<div class="calc-params">总里程 ' + block.dist + ' 里；时限 ' + (limitDays < 1.5 ? block.hoursMax + ' 小时' : limitDays + ' 天') + '内必须到达</div>' +
      '<div class="calc-out"><div class="' + result.cls + '" id="marchOut' + idx + '">' + result.text + '</div>' +
      '<div class="exp" id="marchExp' + idx + '">' + result.exp + '</div></div>' +
      (block.hint ? '<div class="calc-note">' + esc(block.hint) + '</div>' : '') + '</div>';
    return h;
  }
  function bindMarch(root) {
    var sl = root.querySelector('input[data-fn="march"]');
    if (!sl) return;
    var box = sl.closest('.sci-calc');
    var idx = box.id.replace('march', '');
    var block = currentSci.blocks[+sl.closest('.sci-block').getAttribute('data-bi')];
    sl.addEventListener('input', function () {
      var sp = +sl.value;
      var result = marchResult(block, sp);
      document.getElementById('marchS' + idx).textContent = sp + ' 里';
      var out = document.getElementById('marchOut' + idx);
      out.textContent = result.text;
      out.className = result.cls;
      document.getElementById('marchExp' + idx).innerHTML = result.exp;
    });
  }

  // C5 沼泽分层剖面
  var SWAMP_ZONES = [
    { name: '草 丘', color: '#7ca860', safe: '相对安全', desc: '地势略高、草根盘结成网，可以通行——但要跟着侦察兵的标杆走。' },
    { name: '草甸（陷阱层）', color: '#9c8a55', safe: '危险', desc: '表面绿草如茵，和草丘几乎一样！下面却是稀泥，人踩上去会缓缓下陷。' },
    { name: '泥炭泥潭', color: '#6b5335', safe: '致命', desc: '深达 2 米以上的黑色泥浆，越挣扎陷得越深，救的人也会被拖下去。' },
    { name: '明水洼', color: '#5f7d96', safe: '致命', desc: '看似浅水坑，水下是深泥。人和牲口都不能靠近。' }
  ];
  function renderSwamp(block, idx) {
    var h = '<div class="sci-swamp"><svg viewBox="0 0 320 150" class="swamp-svg">';
    h += '<rect x="0" y="0" width="320" height="44" fill="#bfe0f0"/>';
    h += '<path d="M0 44 Q60 34 120 44 T240 42 T320 46 L320 150 L0 150 Z" fill="' + SWAMP_ZONES[1].color + '"/>';
    h += '<path d="M20 44 Q50 28 90 42 T160 40 Q200 30 235 44 Z" fill="' + SWAMP_ZONES[0].color + '" stroke="#5d7a45"/>';
    h += '<ellipse cx="255" cy="70" rx="34" ry="12" fill="' + SWAMP_ZONES[3].color + '"/>';
    h += '<ellipse cx="70" cy="105" rx="46" ry="20" fill="' + SWAMP_ZONES[2].color + '"/>';
    h += '<ellipse cx="200" cy="120" rx="60" ry="22" fill="' + SWAMP_ZONES[2].color + '"/>';
    h += '<rect x="118" y="36" width="3" height="16" fill="#8b5a2b"/><path d="M112 36 L127 36 L119.5 26 Z" fill="#c8102e"/>';
    h += '</svg><div class="swamp-zones">';
    for (var i = 0; i < SWAMP_ZONES.length; i++) {
      h += '<button class="swamp-zone" data-z="' + i + '"><i style="background:' + SWAMP_ZONES[i].color + '"></i>' + SWAMP_ZONES[i].name + ' · ' + SWAMP_ZONES[i].safe + '</button>';
    }
    h += '</div><div class="swamp-desc" id="swampDesc' + idx + '">👆 点击色块，看看每层下面藏着什么</div></div>';
    return h;
  }
  function bindSwamp(root, sci) {
    var btns = root.querySelectorAll('.swamp-zone');
    var idx = root.querySelector('.swamp-desc');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var z = SWAMP_ZONES[+this.getAttribute('data-z')];
        idx.textContent = z.name + '：' + z.desc;
        idx.className = 'swamp-desc show ' + (z.safe === '相对安全' ? 'ok' : (z.safe === '危险' ? 'warn' : 'bad'));
      });
    }
  }

  // ---- 面板总装 ----
  var currentSci = null;
  function render(sci) {
    currentSci = sci;
    var h = '<div class="sci-head"><span class="sci-badge">科学研判</span><h3>' + esc(sci.title) + '</h3></div>';
    for (var i = 0; i < sci.blocks.length; i++) {
      var b = sci.blocks[i];
      h += '<div class="sci-block" data-bi="' + i + '">';
      if (b.type === 'kv') h += renderKV(b);
      else if (b.type === 'profile') h += renderProfile(b, i);
      else if (b.type === 'temp') h += renderTemp(b, i);
      else if (b.type === 'ferry') h += renderFerry(b, i);
      else if (b.type === 'march') h += renderMarch(b, i);
      else if (b.type === 'swamp') h += renderSwamp(b, i);
      h += '</div>';
    }
    h += '<div class="sci-foot">数据为约数，来源见"科学依据"页</div>';
    return h;
  }
  function bind(root, sci) {
    currentSci = sci;
    bindProfile(root);
    bindTemp(root);
    bindFerry(root);
    bindMarch(root);
    bindSwamp(root, sci);
  }
  return { render: render, bind: bind };
})();
