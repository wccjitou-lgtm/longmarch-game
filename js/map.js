// 地图交互层：标准底图 + SVG 路线/节点 + 平移缩放
var MapView = (function () {
  var svg = null, pan = { x: 0, y: 0, s: 1 }, drag = null, pointers = {}, pinch = null, suppressClick = false;
  var animPath = null, animLen = 0, animTotal = 0;

  function el(id) { return document.getElementById(id); }

  function nodeRouteIdx(nodeId) {
    for (var i = 0; i < ROUTE.points.length; i++) {
      if (ROUTE.points[i].node === nodeId) return i;
    }
    return 0;
  }
  // 依据当前进度：返回已完成节点列表与当前节点 id
  function nodeState(id) {
    var cur = NODES[Game.state.nodeIndex];
    var ci = nodeRouteIdx(cur.id);
    var i = nodeRouteIdx(id);
    if (i < ci) return 'done';
    if (i === ci) return 'current';
    return 'locked';
  }

  function pt(p) { return [p.x * ROUTE.vbW, p.y * ROUTE.vbH]; }

  function pathTo(idx) {
    var d = '';
    for (var i = 0; i <= idx && i < ROUTE.points.length; i++) {
      var q = pt(ROUTE.points[i]);
      d += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    }
    return d;
  }

  function starPath(cx, cy, R, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 === 0 ? R : r;
      d += (i ? 'L' : 'M') + (cx + Math.cos(ang) * rad).toFixed(1) + ' ' + (cy + Math.sin(ang) * rad).toFixed(1);
    }
    return d + 'Z';
  }

  function build() {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + ROUTE.vbW + ' ' + ROUTE.vbH);
    svg.setAttribute('class', 'route-svg');
    svg.innerHTML =
      '<g id="mg-feints"></g>' +
      '<path id="mg-todo" class="route todo" d=""/>' +
      '<path id="mg-done" class="route done" d=""/>' +
      '<g id="mg-nodes"></g>';
    el('map-canvas').appendChild(svg);

    var cur = NODES[Game.state.nodeIndex];
    var ci = nodeRouteIdx(cur.id);
    el('mg-todo').setAttribute('d', pathTo(ROUTE.points.length - 1));
    el('mg-done').setAttribute('d', pathTo(ci));

    // 佯动虚线
    var fg = document.getElementById('mg-feints');
    for (var f = 0; f < ROUTE.feints.length; f++) {
      var a = routePoint(ROUTE.feints[f].from), b = routePoint(ROUTE.feints[f].to);
      if (!a || !b) continue;
      var p1 = pt(a), p2 = pt(b);
      var mx = (p1[0] + p2[0]) / 2 - ROUTE.feints[f].bend * ROUTE.vbW,
          my = (p1[1] + p2[1]) / 2 - ROUTE.feints[f].bend * ROUTE.vbH;
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + p1[0] + ' ' + p1[1] + ' Q' + mx + ' ' + my + ' ' + p2[0] + ' ' + p2[1]);
      path.setAttribute('class', 'route feint');
      fg.appendChild(path);
    }

    var ng = document.getElementById('mg-nodes');
    // 相邻太近的节点：标签错位显示，避免文字重叠（安顺场/泸定桥相距很近）
    var LABEL_BELOW = { anshunchang: true, luding: true };
    var LABEL_DX = { anshunchang: -14, luding: 14 };
    for (var i = 0; i < NODES.length; i++) {
      (function (nd) {
        var p = pt(routePointOf(nd.id) || nd);
        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'map-node');
        g.setAttribute('data-id', nd.id);
        g.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ')');
        var dx = LABEL_DX[nd.id] || 0;
        g.innerHTML =
          '<circle r="18" class="hit" fill="transparent"/>' +
          '<circle r="14" class="badge"/>' +
          '<circle r="14" class="halo"/>' +
          '<path class="star" d="' + starPath(0, 0, 11, 4.6) + '"/>' +
          '<text class="nlabel" x="' + dx + '" y="' + (LABEL_BELOW[nd.id] ? 30 : -21) + '">' + nd.name + '</text>';
        g.addEventListener('click', function (ev) { ev.stopPropagation(); onNode(nd); });
        ng.appendChild(g);
      })(NODES[i]);
    }
    updateStates();
    bindPanZoom();
  }

  function routePointOf(nodeId) {
    for (var i = 0; i < ROUTE.points.length; i++) if (ROUTE.points[i].node === nodeId) return ROUTE.points[i];
    return null;
  }

  function updateStates() {
    var gs = svg.querySelectorAll('.map-node');
    for (var i = 0; i < gs.length; i++) {
      gs[i].setAttribute('data-state', nodeState(gs[i].getAttribute('data-id')));
    }
    var cur = NODES[Game.state.nodeIndex];
    var ci = nodeRouteIdx(cur.id);
    var done = el('mg-done');
    done.setAttribute('d', pathTo(ci));
    // 路径描边动画
    var L = done.getTotalLength();
    done.style.strokeDasharray = L;
    done.style.strokeDashoffset = L;
    done.getBoundingClientRect();
    done.style.transition = 'stroke-dashoffset 1.6s ease';
    done.style.strokeDashoffset = '0';
  }

  function onNode(nd) {
    var st = nodeState(nd.id);
    if (st === 'current') {
      Game.openNodeCard(nd);
    } else if (st === 'done') {
      Game.showHistory(nd);
    } else {
      Game.toast('红军还没有到达「' + nd.name + '」');
    }
  }

  // ---- 平移缩放 ----
  function apply() {
    var c = el('map-canvas');
    c.style.transform = 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + pan.s + ')';
  }
  function clampPan() {
    var stage = el('map-stage').getBoundingClientRect();
    var cw = stage.width, ch = stage.height;
    var w = cw * pan.s, h = ch * pan.s;
    var mx = Math.min(0, (cw - w) / 2), Mx = Math.max(0, (cw - w) / 2);
    var my = Math.min(0, (ch - h) / 2), My = Math.max(0, (ch - h) / 2);
    pan.x = Math.max(mx, Math.min(Mx, pan.x));
    pan.y = Math.max(my, Math.min(My, pan.y));
  }
  function bindPanZoom() {
    var stage = el('map-stage');
    stage.addEventListener('click', function (e) {
      if (suppressClick && e.detail !== 0) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    }, true);
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var old = pan.s;
      pan.s = Math.max(1, Math.min(4.5, pan.s * (e.deltaY < 0 ? 1.15 : 0.87)));
      var r = stage.getBoundingClientRect();
      var cx = e.clientX - r.left, cy = e.clientY - r.top;
      pan.x = cx - (cx - pan.x) * (pan.s / old);
      pan.y = cy - (cy - pan.y) * (pan.s / old);
      clampPan(); apply();
    }, { passive: false });

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button')) { suppressClick = false; return; }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        suppressClick = false;
        drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
      } else if (ids.length === 2) {
        drag = null;
        suppressClick = true;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: pan.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, px: pan.x, py: pan.y };
        if (stage.setPointerCapture) {
          for (var i = 0; i < ids.length; i++) stage.setPointerCapture(+ids[i]);
        }
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in pointers)) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var r = stage.getBoundingClientRect();
        pan.s = Math.max(1, Math.min(4.5, pinch.s * d / pinch.d));
        var cx = pinch.cx - r.left, cy = pinch.cy - r.top;
        pan.x = cx - (cx - pinch.px) * (pan.s / pinch.s);
        pan.y = cy - (cy - pinch.py) * (pan.s / pinch.s);
        clampPan(); apply();
      } else if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          drag.moved = true;
          suppressClick = true;
          // 只有实际拖动才捕获指针，普通点击仍由星标或按钮接收。
          if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
        }
        pan.x = drag.px + dx; pan.y = drag.py + dy;
        clampPan(); apply();
      }
    });
    function up(e) {
      if (e.type === 'pointercancel') suppressClick = false;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (Object.keys(pointers).length === 0) drag = null;
    }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // 将当前节点在视口中居中
  function focusCurrent() {
    var nd = NODES[Game.state.nodeIndex];
    var p = pt(routePointOf(nd.id));
    var stage = el('map-stage').getBoundingClientRect();
    var svgR = svg.getBoundingClientRect();
    // 归一化到视口
    var nx = p[0] / ROUTE.vbW, ny = p[1] / ROUTE.vbH;
    var cx = (svgR.left - stage.left) + svgR.width * nx;
    var cy = (svgR.top - stage.top) + svgR.height * ny;
    pan.x += stage.width / 2 - cx;
    pan.y += stage.height / 2 - cy;
    clampPan(); apply();
  }

  function resetView() { pan = { x: 0, y: 0, s: 1 }; apply(); }

  return { build: build, updateStates: updateStates, focusCurrent: focusCurrent, resetView: resetView };
})();
