import '../../assets/index28.css';
import { jsxs as Ie, Fragment as bt, jsx as Ue } from "react/jsx-runtime";
import * as G from "react";
import { forwardRef as xt, useRef as ze, useState as Xe, useImperativeHandle as Ot } from "react";
import * as Et from "react-dom";
import { g as At } from "../../_commonjsHelpers-BkfeUUK-.js";
import { c as Ye } from "../../clsx-OuTLNxxd.js";
var Ge = function(t) {
  return t.reduce(function(r, n) {
    var a = n[0], o = n[1];
    return r[a] = o, r;
  }, {});
}, Je = typeof window < "u" && window.document && window.document.createElement ? G.useLayoutEffect : G.useEffect, D = "top", M = "bottom", L = "right", $ = "left", Se = "auto", ue = [D, M, L, $], Z = "start", se = "end", Pt = "clippingParents", ot = "viewport", ae = "popper", jt = "reference", Ke = /* @__PURE__ */ ue.reduce(function(e, t) {
  return e.concat([t + "-" + Z, t + "-" + se]);
}, []), it = /* @__PURE__ */ [].concat(ue, [Se]).reduce(function(e, t) {
  return e.concat([t, t + "-" + Z, t + "-" + se]);
}, []), St = "beforeRead", Rt = "read", Dt = "afterRead", $t = "beforeMain", Bt = "main", Ct = "afterMain", Tt = "beforeWrite", Mt = "write", Lt = "afterWrite", kt = [St, Rt, Dt, $t, Bt, Ct, Tt, Mt, Lt];
function F(e) {
  return e ? (e.nodeName || "").toLowerCase() : null;
}
function C(e) {
  if (e == null)
    return window;
  if (e.toString() !== "[object Window]") {
    var t = e.ownerDocument;
    return t && t.defaultView || window;
  }
  return e;
}
function K(e) {
  var t = C(e).Element;
  return e instanceof t || e instanceof Element;
}
function T(e) {
  var t = C(e).HTMLElement;
  return e instanceof t || e instanceof HTMLElement;
}
function Re(e) {
  if (typeof ShadowRoot > "u")
    return !1;
  var t = C(e).ShadowRoot;
  return e instanceof t || e instanceof ShadowRoot;
}
function Wt(e) {
  var t = e.state;
  Object.keys(t.elements).forEach(function(r) {
    var n = t.styles[r] || {}, a = t.attributes[r] || {}, o = t.elements[r];
    !T(o) || !F(o) || (Object.assign(o.style, n), Object.keys(a).forEach(function(u) {
      var s = a[u];
      s === !1 ? o.removeAttribute(u) : o.setAttribute(u, s === !0 ? "" : s);
    }));
  });
}
function Ht(e) {
  var t = e.state, r = {
    popper: {
      position: t.options.strategy,
      left: "0",
      top: "0",
      margin: "0"
    },
    arrow: {
      position: "absolute"
    },
    reference: {}
  };
  return Object.assign(t.elements.popper.style, r.popper), t.styles = r, t.elements.arrow && Object.assign(t.elements.arrow.style, r.arrow), function() {
    Object.keys(t.elements).forEach(function(n) {
      var a = t.elements[n], o = t.attributes[n] || {}, u = Object.keys(t.styles.hasOwnProperty(n) ? t.styles[n] : r[n]), s = u.reduce(function(i, c) {
        return i[c] = "", i;
      }, {});
      !T(a) || !F(a) || (Object.assign(a.style, s), Object.keys(o).forEach(function(i) {
        a.removeAttribute(i);
      }));
    });
  };
}
const Ft = {
  name: "applyStyles",
  enabled: !0,
  phase: "write",
  fn: Wt,
  effect: Ht,
  requires: ["computeStyles"]
};
function H(e) {
  return e.split("-")[0];
}
var J = Math.max, we = Math.min, _ = Math.round;
function Pe() {
  var e = navigator.userAgentData;
  return e != null && e.brands && Array.isArray(e.brands) ? e.brands.map(function(t) {
    return t.brand + "/" + t.version;
  }).join(" ") : navigator.userAgent;
}
function st() {
  return !/^((?!chrome|android).)*safari/i.test(Pe());
}
function ee(e, t, r) {
  t === void 0 && (t = !1), r === void 0 && (r = !1);
  var n = e.getBoundingClientRect(), a = 1, o = 1;
  t && T(e) && (a = e.offsetWidth > 0 && _(n.width) / e.offsetWidth || 1, o = e.offsetHeight > 0 && _(n.height) / e.offsetHeight || 1);
  var u = K(e) ? C(e) : window, s = u.visualViewport, i = !st() && r, c = (n.left + (i && s ? s.offsetLeft : 0)) / a, f = (n.top + (i && s ? s.offsetTop : 0)) / o, l = n.width / a, m = n.height / o;
  return {
    width: l,
    height: m,
    top: f,
    right: c + l,
    bottom: f + m,
    left: c,
    x: c,
    y: f
  };
}
function De(e) {
  var t = ee(e), r = e.offsetWidth, n = e.offsetHeight;
  return Math.abs(t.width - r) <= 1 && (r = t.width), Math.abs(t.height - n) <= 1 && (n = t.height), {
    x: e.offsetLeft,
    y: e.offsetTop,
    width: r,
    height: n
  };
}
function ft(e, t) {
  var r = t.getRootNode && t.getRootNode();
  if (e.contains(t))
    return !0;
  if (r && Re(r)) {
    var n = t;
    do {
      if (n && e.isSameNode(n))
        return !0;
      n = n.parentNode || n.host;
    } while (n);
  }
  return !1;
}
function V(e) {
  return C(e).getComputedStyle(e);
}
function Vt(e) {
  return ["table", "td", "th"].indexOf(F(e)) >= 0;
}
function q(e) {
  return ((K(e) ? e.ownerDocument : (
    // $FlowFixMe[prop-missing]
    e.document
  )) || window.document).documentElement;
}
function be(e) {
  return F(e) === "html" ? e : (
    // this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    e.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    e.parentNode || // DOM Element detected
    (Re(e) ? e.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    q(e)
  );
}
function Qe(e) {
  return !T(e) || // https://github.com/popperjs/popper-core/issues/837
  V(e).position === "fixed" ? null : e.offsetParent;
}
function Nt(e) {
  var t = /firefox/i.test(Pe()), r = /Trident/i.test(Pe());
  if (r && T(e)) {
    var n = V(e);
    if (n.position === "fixed")
      return null;
  }
  var a = be(e);
  for (Re(a) && (a = a.host); T(a) && ["html", "body"].indexOf(F(a)) < 0; ) {
    var o = V(a);
    if (o.transform !== "none" || o.perspective !== "none" || o.contain === "paint" || ["transform", "perspective"].indexOf(o.willChange) !== -1 || t && o.willChange === "filter" || t && o.filter && o.filter !== "none")
      return a;
    a = a.parentNode;
  }
  return null;
}
function ce(e) {
  for (var t = C(e), r = Qe(e); r && Vt(r) && V(r).position === "static"; )
    r = Qe(r);
  return r && (F(r) === "html" || F(r) === "body" && V(r).position === "static") ? t : r || Nt(e) || t;
}
function $e(e) {
  return ["top", "bottom"].indexOf(e) >= 0 ? "x" : "y";
}
function oe(e, t, r) {
  return J(e, we(t, r));
}
function qt(e, t, r) {
  var n = oe(e, t, r);
  return n > r ? r : n;
}
function ut() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}
function ct(e) {
  return Object.assign({}, ut(), e);
}
function pt(e, t) {
  return t.reduce(function(r, n) {
    return r[n] = e, r;
  }, {});
}
var It = function(t, r) {
  return t = typeof t == "function" ? t(Object.assign({}, r.rects, {
    placement: r.placement
  })) : t, ct(typeof t != "number" ? t : pt(t, ue));
};
function Ut(e) {
  var t, r = e.state, n = e.name, a = e.options, o = r.elements.arrow, u = r.modifiersData.popperOffsets, s = H(r.placement), i = $e(s), c = [$, L].indexOf(s) >= 0, f = c ? "height" : "width";
  if (!(!o || !u)) {
    var l = It(a.padding, r), m = De(o), p = i === "y" ? D : $, y = i === "y" ? M : L, h = r.rects.reference[f] + r.rects.reference[i] - u[i] - r.rects.popper[f], v = u[i] - r.rects.reference[i], g = ce(o), x = g ? i === "y" ? g.clientHeight || 0 : g.clientWidth || 0 : 0, O = h / 2 - v / 2, d = l[p], w = x - m[f] - l[y], b = x / 2 - m[f] / 2 + O, E = oe(d, b, w), j = i;
    r.modifiersData[n] = (t = {}, t[j] = E, t.centerOffset = E - b, t);
  }
}
function zt(e) {
  var t = e.state, r = e.options, n = r.element, a = n === void 0 ? "[data-popper-arrow]" : n;
  a != null && (typeof a == "string" && (a = t.elements.popper.querySelector(a), !a) || ft(t.elements.popper, a) && (t.elements.arrow = a));
}
const Xt = {
  name: "arrow",
  enabled: !0,
  phase: "main",
  fn: Ut,
  effect: zt,
  requires: ["popperOffsets"],
  requiresIfExists: ["preventOverflow"]
};
function te(e) {
  return e.split("-")[1];
}
var Yt = {
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto"
};
function Gt(e, t) {
  var r = e.x, n = e.y, a = t.devicePixelRatio || 1;
  return {
    x: _(r * a) / a || 0,
    y: _(n * a) / a || 0
  };
}
function Ze(e) {
  var t, r = e.popper, n = e.popperRect, a = e.placement, o = e.variation, u = e.offsets, s = e.position, i = e.gpuAcceleration, c = e.adaptive, f = e.roundOffsets, l = e.isFixed, m = u.x, p = m === void 0 ? 0 : m, y = u.y, h = y === void 0 ? 0 : y, v = typeof f == "function" ? f({
    x: p,
    y: h
  }) : {
    x: p,
    y: h
  };
  p = v.x, h = v.y;
  var g = u.hasOwnProperty("x"), x = u.hasOwnProperty("y"), O = $, d = D, w = window;
  if (c) {
    var b = ce(r), E = "clientHeight", j = "clientWidth";
    if (b === C(r) && (b = q(r), V(b).position !== "static" && s === "absolute" && (E = "scrollHeight", j = "scrollWidth")), b = b, a === D || (a === $ || a === L) && o === se) {
      d = M;
      var P = l && b === w && w.visualViewport ? w.visualViewport.height : (
        // $FlowFixMe[prop-missing]
        b[E]
      );
      h -= P - n.height, h *= i ? 1 : -1;
    }
    if (a === $ || (a === D || a === M) && o === se) {
      O = L;
      var A = l && b === w && w.visualViewport ? w.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        b[j]
      );
      p -= A - n.width, p *= i ? 1 : -1;
    }
  }
  var S = Object.assign({
    position: s
  }, c && Yt), k = f === !0 ? Gt({
    x: p,
    y: h
  }, C(r)) : {
    x: p,
    y: h
  };
  if (p = k.x, h = k.y, i) {
    var R;
    return Object.assign({}, S, (R = {}, R[d] = x ? "0" : "", R[O] = g ? "0" : "", R.transform = (w.devicePixelRatio || 1) <= 1 ? "translate(" + p + "px, " + h + "px)" : "translate3d(" + p + "px, " + h + "px, 0)", R));
  }
  return Object.assign({}, S, (t = {}, t[d] = x ? h + "px" : "", t[O] = g ? p + "px" : "", t.transform = "", t));
}
function Jt(e) {
  var t = e.state, r = e.options, n = r.gpuAcceleration, a = n === void 0 ? !0 : n, o = r.adaptive, u = o === void 0 ? !0 : o, s = r.roundOffsets, i = s === void 0 ? !0 : s, c = {
    placement: H(t.placement),
    variation: te(t.placement),
    popper: t.elements.popper,
    popperRect: t.rects.popper,
    gpuAcceleration: a,
    isFixed: t.options.strategy === "fixed"
  };
  t.modifiersData.popperOffsets != null && (t.styles.popper = Object.assign({}, t.styles.popper, Ze(Object.assign({}, c, {
    offsets: t.modifiersData.popperOffsets,
    position: t.options.strategy,
    adaptive: u,
    roundOffsets: i
  })))), t.modifiersData.arrow != null && (t.styles.arrow = Object.assign({}, t.styles.arrow, Ze(Object.assign({}, c, {
    offsets: t.modifiersData.arrow,
    position: "absolute",
    adaptive: !1,
    roundOffsets: i
  })))), t.attributes.popper = Object.assign({}, t.attributes.popper, {
    "data-popper-placement": t.placement
  });
}
const Kt = {
  name: "computeStyles",
  enabled: !0,
  phase: "beforeWrite",
  fn: Jt,
  data: {}
};
var he = {
  passive: !0
};
function Qt(e) {
  var t = e.state, r = e.instance, n = e.options, a = n.scroll, o = a === void 0 ? !0 : a, u = n.resize, s = u === void 0 ? !0 : u, i = C(t.elements.popper), c = [].concat(t.scrollParents.reference, t.scrollParents.popper);
  return o && c.forEach(function(f) {
    f.addEventListener("scroll", r.update, he);
  }), s && i.addEventListener("resize", r.update, he), function() {
    o && c.forEach(function(f) {
      f.removeEventListener("scroll", r.update, he);
    }), s && i.removeEventListener("resize", r.update, he);
  };
}
const Zt = {
  name: "eventListeners",
  enabled: !0,
  phase: "write",
  fn: function() {
  },
  effect: Qt,
  data: {}
};
var _t = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function ye(e) {
  return e.replace(/left|right|bottom|top/g, function(t) {
    return _t[t];
  });
}
var er = {
  start: "end",
  end: "start"
};
function _e(e) {
  return e.replace(/start|end/g, function(t) {
    return er[t];
  });
}
function Be(e) {
  var t = C(e), r = t.pageXOffset, n = t.pageYOffset;
  return {
    scrollLeft: r,
    scrollTop: n
  };
}
function Ce(e) {
  return ee(q(e)).left + Be(e).scrollLeft;
}
function tr(e, t) {
  var r = C(e), n = q(e), a = r.visualViewport, o = n.clientWidth, u = n.clientHeight, s = 0, i = 0;
  if (a) {
    o = a.width, u = a.height;
    var c = st();
    (c || !c && t === "fixed") && (s = a.offsetLeft, i = a.offsetTop);
  }
  return {
    width: o,
    height: u,
    x: s + Ce(e),
    y: i
  };
}
function rr(e) {
  var t, r = q(e), n = Be(e), a = (t = e.ownerDocument) == null ? void 0 : t.body, o = J(r.scrollWidth, r.clientWidth, a ? a.scrollWidth : 0, a ? a.clientWidth : 0), u = J(r.scrollHeight, r.clientHeight, a ? a.scrollHeight : 0, a ? a.clientHeight : 0), s = -n.scrollLeft + Ce(e), i = -n.scrollTop;
  return V(a || r).direction === "rtl" && (s += J(r.clientWidth, a ? a.clientWidth : 0) - o), {
    width: o,
    height: u,
    x: s,
    y: i
  };
}
function Te(e) {
  var t = V(e), r = t.overflow, n = t.overflowX, a = t.overflowY;
  return /auto|scroll|overlay|hidden/.test(r + a + n);
}
function lt(e) {
  return ["html", "body", "#document"].indexOf(F(e)) >= 0 ? e.ownerDocument.body : T(e) && Te(e) ? e : lt(be(e));
}
function ie(e, t) {
  var r;
  t === void 0 && (t = []);
  var n = lt(e), a = n === ((r = e.ownerDocument) == null ? void 0 : r.body), o = C(n), u = a ? [o].concat(o.visualViewport || [], Te(n) ? n : []) : n, s = t.concat(u);
  return a ? s : (
    // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    s.concat(ie(be(u)))
  );
}
function je(e) {
  return Object.assign({}, e, {
    left: e.x,
    top: e.y,
    right: e.x + e.width,
    bottom: e.y + e.height
  });
}
function nr(e, t) {
  var r = ee(e, !1, t === "fixed");
  return r.top = r.top + e.clientTop, r.left = r.left + e.clientLeft, r.bottom = r.top + e.clientHeight, r.right = r.left + e.clientWidth, r.width = e.clientWidth, r.height = e.clientHeight, r.x = r.left, r.y = r.top, r;
}
function et(e, t, r) {
  return t === ot ? je(tr(e, r)) : K(t) ? nr(t, r) : je(rr(q(e)));
}
function ar(e) {
  var t = ie(be(e)), r = ["absolute", "fixed"].indexOf(V(e).position) >= 0, n = r && T(e) ? ce(e) : e;
  return K(n) ? t.filter(function(a) {
    return K(a) && ft(a, n) && F(a) !== "body";
  }) : [];
}
function or(e, t, r, n) {
  var a = t === "clippingParents" ? ar(e) : [].concat(t), o = [].concat(a, [r]), u = o[0], s = o.reduce(function(i, c) {
    var f = et(e, c, n);
    return i.top = J(f.top, i.top), i.right = we(f.right, i.right), i.bottom = we(f.bottom, i.bottom), i.left = J(f.left, i.left), i;
  }, et(e, u, n));
  return s.width = s.right - s.left, s.height = s.bottom - s.top, s.x = s.left, s.y = s.top, s;
}
function vt(e) {
  var t = e.reference, r = e.element, n = e.placement, a = n ? H(n) : null, o = n ? te(n) : null, u = t.x + t.width / 2 - r.width / 2, s = t.y + t.height / 2 - r.height / 2, i;
  switch (a) {
    case D:
      i = {
        x: u,
        y: t.y - r.height
      };
      break;
    case M:
      i = {
        x: u,
        y: t.y + t.height
      };
      break;
    case L:
      i = {
        x: t.x + t.width,
        y: s
      };
      break;
    case $:
      i = {
        x: t.x - r.width,
        y: s
      };
      break;
    default:
      i = {
        x: t.x,
        y: t.y
      };
  }
  var c = a ? $e(a) : null;
  if (c != null) {
    var f = c === "y" ? "height" : "width";
    switch (o) {
      case Z:
        i[c] = i[c] - (t[f] / 2 - r[f] / 2);
        break;
      case se:
        i[c] = i[c] + (t[f] / 2 - r[f] / 2);
        break;
    }
  }
  return i;
}
function fe(e, t) {
  t === void 0 && (t = {});
  var r = t, n = r.placement, a = n === void 0 ? e.placement : n, o = r.strategy, u = o === void 0 ? e.strategy : o, s = r.boundary, i = s === void 0 ? Pt : s, c = r.rootBoundary, f = c === void 0 ? ot : c, l = r.elementContext, m = l === void 0 ? ae : l, p = r.altBoundary, y = p === void 0 ? !1 : p, h = r.padding, v = h === void 0 ? 0 : h, g = ct(typeof v != "number" ? v : pt(v, ue)), x = m === ae ? jt : ae, O = e.rects.popper, d = e.elements[y ? x : m], w = or(K(d) ? d : d.contextElement || q(e.elements.popper), i, f, u), b = ee(e.elements.reference), E = vt({
    reference: b,
    element: O,
    strategy: "absolute",
    placement: a
  }), j = je(Object.assign({}, O, E)), P = m === ae ? j : b, A = {
    top: w.top - P.top + g.top,
    bottom: P.bottom - w.bottom + g.bottom,
    left: w.left - P.left + g.left,
    right: P.right - w.right + g.right
  }, S = e.modifiersData.offset;
  if (m === ae && S) {
    var k = S[a];
    Object.keys(A).forEach(function(R) {
      var I = [L, M].indexOf(R) >= 0 ? 1 : -1, U = [D, M].indexOf(R) >= 0 ? "y" : "x";
      A[R] += k[U] * I;
    });
  }
  return A;
}
function ir(e, t) {
  t === void 0 && (t = {});
  var r = t, n = r.placement, a = r.boundary, o = r.rootBoundary, u = r.padding, s = r.flipVariations, i = r.allowedAutoPlacements, c = i === void 0 ? it : i, f = te(n), l = f ? s ? Ke : Ke.filter(function(y) {
    return te(y) === f;
  }) : ue, m = l.filter(function(y) {
    return c.indexOf(y) >= 0;
  });
  m.length === 0 && (m = l);
  var p = m.reduce(function(y, h) {
    return y[h] = fe(e, {
      placement: h,
      boundary: a,
      rootBoundary: o,
      padding: u
    })[H(h)], y;
  }, {});
  return Object.keys(p).sort(function(y, h) {
    return p[y] - p[h];
  });
}
function sr(e) {
  if (H(e) === Se)
    return [];
  var t = ye(e);
  return [_e(e), t, _e(t)];
}
function fr(e) {
  var t = e.state, r = e.options, n = e.name;
  if (!t.modifiersData[n]._skip) {
    for (var a = r.mainAxis, o = a === void 0 ? !0 : a, u = r.altAxis, s = u === void 0 ? !0 : u, i = r.fallbackPlacements, c = r.padding, f = r.boundary, l = r.rootBoundary, m = r.altBoundary, p = r.flipVariations, y = p === void 0 ? !0 : p, h = r.allowedAutoPlacements, v = t.options.placement, g = H(v), x = g === v, O = i || (x || !y ? [ye(v)] : sr(v)), d = [v].concat(O).reduce(function(Q, N) {
      return Q.concat(H(N) === Se ? ir(t, {
        placement: N,
        boundary: f,
        rootBoundary: l,
        padding: c,
        flipVariations: y,
        allowedAutoPlacements: h
      }) : N);
    }, []), w = t.rects.reference, b = t.rects.popper, E = /* @__PURE__ */ new Map(), j = !0, P = d[0], A = 0; A < d.length; A++) {
      var S = d[A], k = H(S), R = te(S) === Z, I = [D, M].indexOf(k) >= 0, U = I ? "width" : "height", B = fe(t, {
        placement: S,
        boundary: f,
        rootBoundary: l,
        altBoundary: m,
        padding: c
      }), W = I ? R ? L : $ : R ? M : D;
      w[U] > b[U] && (W = ye(W));
      var pe = ye(W), z = [];
      if (o && z.push(B[k] <= 0), s && z.push(B[W] <= 0, B[pe] <= 0), z.every(function(Q) {
        return Q;
      })) {
        P = S, j = !1;
        break;
      }
      E.set(S, z);
    }
    if (j)
      for (var le = y ? 3 : 1, xe = function(N) {
        var ne = d.find(function(de) {
          var X = E.get(de);
          if (X)
            return X.slice(0, N).every(function(Oe) {
              return Oe;
            });
        });
        if (ne)
          return P = ne, "break";
      }, re = le; re > 0; re--) {
        var ve = xe(re);
        if (ve === "break") break;
      }
    t.placement !== P && (t.modifiersData[n]._skip = !0, t.placement = P, t.reset = !0);
  }
}
const ur = {
  name: "flip",
  enabled: !0,
  phase: "main",
  fn: fr,
  requiresIfExists: ["offset"],
  data: {
    _skip: !1
  }
};
function tt(e, t, r) {
  return r === void 0 && (r = {
    x: 0,
    y: 0
  }), {
    top: e.top - t.height - r.y,
    right: e.right - t.width + r.x,
    bottom: e.bottom - t.height + r.y,
    left: e.left - t.width - r.x
  };
}
function rt(e) {
  return [D, L, M, $].some(function(t) {
    return e[t] >= 0;
  });
}
function cr(e) {
  var t = e.state, r = e.name, n = t.rects.reference, a = t.rects.popper, o = t.modifiersData.preventOverflow, u = fe(t, {
    elementContext: "reference"
  }), s = fe(t, {
    altBoundary: !0
  }), i = tt(u, n), c = tt(s, a, o), f = rt(i), l = rt(c);
  t.modifiersData[r] = {
    referenceClippingOffsets: i,
    popperEscapeOffsets: c,
    isReferenceHidden: f,
    hasPopperEscaped: l
  }, t.attributes.popper = Object.assign({}, t.attributes.popper, {
    "data-popper-reference-hidden": f,
    "data-popper-escaped": l
  });
}
const pr = {
  name: "hide",
  enabled: !0,
  phase: "main",
  requiresIfExists: ["preventOverflow"],
  fn: cr
};
function lr(e, t, r) {
  var n = H(e), a = [$, D].indexOf(n) >= 0 ? -1 : 1, o = typeof r == "function" ? r(Object.assign({}, t, {
    placement: e
  })) : r, u = o[0], s = o[1];
  return u = u || 0, s = (s || 0) * a, [$, L].indexOf(n) >= 0 ? {
    x: s,
    y: u
  } : {
    x: u,
    y: s
  };
}
function vr(e) {
  var t = e.state, r = e.options, n = e.name, a = r.offset, o = a === void 0 ? [0, 0] : a, u = it.reduce(function(f, l) {
    return f[l] = lr(l, t.rects, o), f;
  }, {}), s = u[t.placement], i = s.x, c = s.y;
  t.modifiersData.popperOffsets != null && (t.modifiersData.popperOffsets.x += i, t.modifiersData.popperOffsets.y += c), t.modifiersData[n] = u;
}
const dr = {
  name: "offset",
  enabled: !0,
  phase: "main",
  requires: ["popperOffsets"],
  fn: vr
};
function mr(e) {
  var t = e.state, r = e.name;
  t.modifiersData[r] = vt({
    reference: t.rects.reference,
    element: t.rects.popper,
    strategy: "absolute",
    placement: t.placement
  });
}
const hr = {
  name: "popperOffsets",
  enabled: !0,
  phase: "read",
  fn: mr,
  data: {}
};
function yr(e) {
  return e === "x" ? "y" : "x";
}
function gr(e) {
  var t = e.state, r = e.options, n = e.name, a = r.mainAxis, o = a === void 0 ? !0 : a, u = r.altAxis, s = u === void 0 ? !1 : u, i = r.boundary, c = r.rootBoundary, f = r.altBoundary, l = r.padding, m = r.tether, p = m === void 0 ? !0 : m, y = r.tetherOffset, h = y === void 0 ? 0 : y, v = fe(t, {
    boundary: i,
    rootBoundary: c,
    padding: l,
    altBoundary: f
  }), g = H(t.placement), x = te(t.placement), O = !x, d = $e(g), w = yr(d), b = t.modifiersData.popperOffsets, E = t.rects.reference, j = t.rects.popper, P = typeof h == "function" ? h(Object.assign({}, t.rects, {
    placement: t.placement
  })) : h, A = typeof P == "number" ? {
    mainAxis: P,
    altAxis: P
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, P), S = t.modifiersData.offset ? t.modifiersData.offset[t.placement] : null, k = {
    x: 0,
    y: 0
  };
  if (b) {
    if (o) {
      var R, I = d === "y" ? D : $, U = d === "y" ? M : L, B = d === "y" ? "height" : "width", W = b[d], pe = W + v[I], z = W - v[U], le = p ? -j[B] / 2 : 0, xe = x === Z ? E[B] : j[B], re = x === Z ? -j[B] : -E[B], ve = t.elements.arrow, Q = p && ve ? De(ve) : {
        width: 0,
        height: 0
      }, N = t.modifiersData["arrow#persistent"] ? t.modifiersData["arrow#persistent"].padding : ut(), ne = N[I], de = N[U], X = oe(0, E[B], Q[B]), Oe = O ? E[B] / 2 - le - X - ne - A.mainAxis : xe - X - ne - A.mainAxis, dt = O ? -E[B] / 2 + le + X + de + A.mainAxis : re + X + de + A.mainAxis, Ee = t.elements.arrow && ce(t.elements.arrow), mt = Ee ? d === "y" ? Ee.clientTop || 0 : Ee.clientLeft || 0 : 0, Me = (R = S == null ? void 0 : S[d]) != null ? R : 0, ht = W + Oe - Me - mt, yt = W + dt - Me, Le = oe(p ? we(pe, ht) : pe, W, p ? J(z, yt) : z);
      b[d] = Le, k[d] = Le - W;
    }
    if (s) {
      var ke, gt = d === "x" ? D : $, wt = d === "x" ? M : L, Y = b[w], me = w === "y" ? "height" : "width", We = Y + v[gt], He = Y - v[wt], Ae = [D, $].indexOf(g) !== -1, Fe = (ke = S == null ? void 0 : S[w]) != null ? ke : 0, Ve = Ae ? We : Y - E[me] - j[me] - Fe + A.altAxis, Ne = Ae ? Y + E[me] + j[me] - Fe - A.altAxis : He, qe = p && Ae ? qt(Ve, Y, Ne) : oe(p ? Ve : We, Y, p ? Ne : He);
      b[w] = qe, k[w] = qe - Y;
    }
    t.modifiersData[n] = k;
  }
}
const wr = {
  name: "preventOverflow",
  enabled: !0,
  phase: "main",
  fn: gr,
  requiresIfExists: ["offset"]
};
function br(e) {
  return {
    scrollLeft: e.scrollLeft,
    scrollTop: e.scrollTop
  };
}
function xr(e) {
  return e === C(e) || !T(e) ? Be(e) : br(e);
}
function Or(e) {
  var t = e.getBoundingClientRect(), r = _(t.width) / e.offsetWidth || 1, n = _(t.height) / e.offsetHeight || 1;
  return r !== 1 || n !== 1;
}
function Er(e, t, r) {
  r === void 0 && (r = !1);
  var n = T(t), a = T(t) && Or(t), o = q(t), u = ee(e, a, r), s = {
    scrollLeft: 0,
    scrollTop: 0
  }, i = {
    x: 0,
    y: 0
  };
  return (n || !n && !r) && ((F(t) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
  Te(o)) && (s = xr(t)), T(t) ? (i = ee(t, !0), i.x += t.clientLeft, i.y += t.clientTop) : o && (i.x = Ce(o))), {
    x: u.left + s.scrollLeft - i.x,
    y: u.top + s.scrollTop - i.y,
    width: u.width,
    height: u.height
  };
}
function Ar(e) {
  var t = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), n = [];
  e.forEach(function(o) {
    t.set(o.name, o);
  });
  function a(o) {
    r.add(o.name);
    var u = [].concat(o.requires || [], o.requiresIfExists || []);
    u.forEach(function(s) {
      if (!r.has(s)) {
        var i = t.get(s);
        i && a(i);
      }
    }), n.push(o);
  }
  return e.forEach(function(o) {
    r.has(o.name) || a(o);
  }), n;
}
function Pr(e) {
  var t = Ar(e);
  return kt.reduce(function(r, n) {
    return r.concat(t.filter(function(a) {
      return a.phase === n;
    }));
  }, []);
}
function jr(e) {
  var t;
  return function() {
    return t || (t = new Promise(function(r) {
      Promise.resolve().then(function() {
        t = void 0, r(e());
      });
    })), t;
  };
}
function Sr(e) {
  var t = e.reduce(function(r, n) {
    var a = r[n.name];
    return r[n.name] = a ? Object.assign({}, a, n, {
      options: Object.assign({}, a.options, n.options),
      data: Object.assign({}, a.data, n.data)
    }) : n, r;
  }, {});
  return Object.keys(t).map(function(r) {
    return t[r];
  });
}
var nt = {
  placement: "bottom",
  modifiers: [],
  strategy: "absolute"
};
function at() {
  for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++)
    t[r] = arguments[r];
  return !t.some(function(n) {
    return !(n && typeof n.getBoundingClientRect == "function");
  });
}
function Rr(e) {
  e === void 0 && (e = {});
  var t = e, r = t.defaultModifiers, n = r === void 0 ? [] : r, a = t.defaultOptions, o = a === void 0 ? nt : a;
  return function(s, i, c) {
    c === void 0 && (c = o);
    var f = {
      placement: "bottom",
      orderedModifiers: [],
      options: Object.assign({}, nt, o),
      modifiersData: {},
      elements: {
        reference: s,
        popper: i
      },
      attributes: {},
      styles: {}
    }, l = [], m = !1, p = {
      state: f,
      setOptions: function(g) {
        var x = typeof g == "function" ? g(f.options) : g;
        h(), f.options = Object.assign({}, o, f.options, x), f.scrollParents = {
          reference: K(s) ? ie(s) : s.contextElement ? ie(s.contextElement) : [],
          popper: ie(i)
        };
        var O = Pr(Sr([].concat(n, f.options.modifiers)));
        return f.orderedModifiers = O.filter(function(d) {
          return d.enabled;
        }), y(), p.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function() {
        if (!m) {
          var g = f.elements, x = g.reference, O = g.popper;
          if (at(x, O)) {
            f.rects = {
              reference: Er(x, ce(O), f.options.strategy === "fixed"),
              popper: De(O)
            }, f.reset = !1, f.placement = f.options.placement, f.orderedModifiers.forEach(function(A) {
              return f.modifiersData[A.name] = Object.assign({}, A.data);
            });
            for (var d = 0; d < f.orderedModifiers.length; d++) {
              if (f.reset === !0) {
                f.reset = !1, d = -1;
                continue;
              }
              var w = f.orderedModifiers[d], b = w.fn, E = w.options, j = E === void 0 ? {} : E, P = w.name;
              typeof b == "function" && (f = b({
                state: f,
                options: j,
                name: P,
                instance: p
              }) || f);
            }
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: jr(function() {
        return new Promise(function(v) {
          p.forceUpdate(), v(f);
        });
      }),
      destroy: function() {
        h(), m = !0;
      }
    };
    if (!at(s, i))
      return p;
    p.setOptions(c).then(function(v) {
      !m && c.onFirstUpdate && c.onFirstUpdate(v);
    });
    function y() {
      f.orderedModifiers.forEach(function(v) {
        var g = v.name, x = v.options, O = x === void 0 ? {} : x, d = v.effect;
        if (typeof d == "function") {
          var w = d({
            state: f,
            name: g,
            instance: p,
            options: O
          }), b = function() {
          };
          l.push(w || b);
        }
      });
    }
    function h() {
      l.forEach(function(v) {
        return v();
      }), l = [];
    }
    return p;
  };
}
var Dr = [Zt, hr, Kt, Ft, dr, ur, wr, Xt, pr], $r = /* @__PURE__ */ Rr({
  defaultModifiers: Dr
}), Br = typeof Element < "u", Cr = typeof Map == "function", Tr = typeof Set == "function", Mr = typeof ArrayBuffer == "function" && !!ArrayBuffer.isView;
function ge(e, t) {
  if (e === t) return !0;
  if (e && t && typeof e == "object" && typeof t == "object") {
    if (e.constructor !== t.constructor) return !1;
    var r, n, a;
    if (Array.isArray(e)) {
      if (r = e.length, r != t.length) return !1;
      for (n = r; n-- !== 0; )
        if (!ge(e[n], t[n])) return !1;
      return !0;
    }
    var o;
    if (Cr && e instanceof Map && t instanceof Map) {
      if (e.size !== t.size) return !1;
      for (o = e.entries(); !(n = o.next()).done; )
        if (!t.has(n.value[0])) return !1;
      for (o = e.entries(); !(n = o.next()).done; )
        if (!ge(n.value[1], t.get(n.value[0]))) return !1;
      return !0;
    }
    if (Tr && e instanceof Set && t instanceof Set) {
      if (e.size !== t.size) return !1;
      for (o = e.entries(); !(n = o.next()).done; )
        if (!t.has(n.value[0])) return !1;
      return !0;
    }
    if (Mr && ArrayBuffer.isView(e) && ArrayBuffer.isView(t)) {
      if (r = e.length, r != t.length) return !1;
      for (n = r; n-- !== 0; )
        if (e[n] !== t[n]) return !1;
      return !0;
    }
    if (e.constructor === RegExp) return e.source === t.source && e.flags === t.flags;
    if (e.valueOf !== Object.prototype.valueOf && typeof e.valueOf == "function" && typeof t.valueOf == "function") return e.valueOf() === t.valueOf();
    if (e.toString !== Object.prototype.toString && typeof e.toString == "function" && typeof t.toString == "function") return e.toString() === t.toString();
    if (a = Object.keys(e), r = a.length, r !== Object.keys(t).length) return !1;
    for (n = r; n-- !== 0; )
      if (!Object.prototype.hasOwnProperty.call(t, a[n])) return !1;
    if (Br && e instanceof Element) return !1;
    for (n = r; n-- !== 0; )
      if (!((a[n] === "_owner" || a[n] === "__v" || a[n] === "__o") && e.$$typeof) && !ge(e[a[n]], t[a[n]]))
        return !1;
    return !0;
  }
  return e !== e && t !== t;
}
var Lr = function(t, r) {
  try {
    return ge(t, r);
  } catch (n) {
    if ((n.message || "").match(/stack|recursion/i))
      return console.warn("react-fast-compare cannot handle circular refs"), !1;
    throw n;
  }
};
const kr = /* @__PURE__ */ At(Lr);
var Wr = [], Hr = function(t, r, n) {
  n === void 0 && (n = {});
  var a = G.useRef(null), o = {
    onFirstUpdate: n.onFirstUpdate,
    placement: n.placement || "bottom",
    strategy: n.strategy || "absolute",
    modifiers: n.modifiers || Wr
  }, u = G.useState({
    styles: {
      popper: {
        position: o.strategy,
        left: "0",
        top: "0"
      },
      arrow: {
        position: "absolute"
      }
    },
    attributes: {}
  }), s = u[0], i = u[1], c = G.useMemo(function() {
    return {
      name: "updateState",
      enabled: !0,
      phase: "write",
      fn: function(p) {
        var y = p.state, h = Object.keys(y.elements);
        Et.flushSync(function() {
          i({
            styles: Ge(h.map(function(v) {
              return [v, y.styles[v] || {}];
            })),
            attributes: Ge(h.map(function(v) {
              return [v, y.attributes[v]];
            }))
          });
        });
      },
      requires: ["computeStyles"]
    };
  }, []), f = G.useMemo(function() {
    var m = {
      onFirstUpdate: o.onFirstUpdate,
      placement: o.placement,
      strategy: o.strategy,
      modifiers: [].concat(o.modifiers, [c, {
        name: "applyStyles",
        enabled: !1
      }])
    };
    return kr(a.current, m) ? a.current || m : (a.current = m, m);
  }, [o.onFirstUpdate, o.placement, o.strategy, o.modifiers, c]), l = G.useRef();
  return Je(function() {
    l.current && l.current.setOptions(f);
  }, [f]), Je(function() {
    if (!(t == null || r == null)) {
      var m = n.createPopper || $r, p = m(t, r, f);
      return l.current = p, function() {
        p.destroy(), l.current = null;
      };
    }
  }, [t, r, n.createPopper]), {
    state: l.current ? l.current.state : null,
    styles: s.styles,
    attributes: s.attributes,
    update: l.current ? l.current.update : null,
    forceUpdate: l.current ? l.current.forceUpdate : null
  };
};
const Fr = {
  error: "deriv-tooltip--error",
  general: "deriv-tooltip--general"
}, Vr = xt(
  ({
    as: e = "div",
    children: t,
    hideTooltip: r = !1,
    tooltipContainerClassName: n,
    tooltipContent: a,
    tooltipOffset: o = 8,
    tooltipPosition: u = "top",
    variant: s = "general",
    ...i
  }, c) => {
    const f = ze(null), l = ze(null), [m, p] = Xe(
      null
    ), { styles: y, attributes: h } = Hr(
      f.current,
      l.current,
      {
        placement: u,
        strategy: "fixed",
        modifiers: [
          { name: "arrow", options: { element: m } },
          {
            name: "offset",
            options: { offset: [0, o] }
          },
          { name: "hide", enabled: r }
        ]
      }
    ), [v, g] = Xe(!1), x = () => g(!0), O = () => g(!1);
    return Ot(c, () => f.current), /* @__PURE__ */ Ie(bt, { children: [
      /* @__PURE__ */ Ue(
        e,
        {
          ref: f,
          className: Ye("deriv-tooltip__trigger", i.className),
          onMouseEnter: x,
          onMouseLeave: O,
          ...i,
          children: t
        }
      ),
      v && /* @__PURE__ */ Ie(
        "div",
        {
          className: Ye(
            "deriv-tooltip",
            Fr[s],
            n
          ),
          ref: l,
          style: y.popper,
          ...h.popper,
          children: [
            a,
            /* @__PURE__ */ Ue(
              "div",
              {
                className: "deriv-tooltip__arrow",
                "data-popper-arrow": !0,
                ref: p,
                style: y.arrow
              }
            )
          ]
        }
      )
    ] });
  }
);
Vr.displayName = "Tooltip";
export {
  Vr as Tooltip
};
