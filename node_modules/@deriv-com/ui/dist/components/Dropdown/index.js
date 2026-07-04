import '../../assets/Dropdown.css';
import { jsxs as sn, jsx as de } from "react/jsx-runtime";
import Te, { useRef as G, useCallback as W, useEffect as te, useMemo as ln, cloneElement as an, useLayoutEffect as dn, useReducer as cn, Component as pn, useState as dt, isValidElement as fn } from "react";
import { c as Ne } from "../../clsx-OuTLNxxd.js";
import { P as p } from "../../index-CblbdqjE.js";
import { Input as gn } from "../Input/index.js";
import { Text as ct } from "../Text/index.js";
/* empty css                      */
import { F as hn } from "../../LegacyChevronDown2pxIcon-CQ-CdTZp.js";
function ce(t, n) {
  if (t == null) return {};
  var r = {};
  for (var i in t) if ({}.hasOwnProperty.call(t, i)) {
    if (n.indexOf(i) !== -1) continue;
    r[i] = t[i];
  }
  return r;
}
function S() {
  return S = Object.assign ? Object.assign.bind() : function(t) {
    for (var n = 1; n < arguments.length; n++) {
      var r = arguments[n];
      for (var i in r) ({}).hasOwnProperty.call(r, i) && (t[i] = r[i]);
    }
    return t;
  }, S.apply(null, arguments);
}
function Ue(t, n) {
  return Ue = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(r, i) {
    return r.__proto__ = i, r;
  }, Ue(t, n);
}
function mn(t, n) {
  t.prototype = Object.create(n.prototype), t.prototype.constructor = t, Ue(t, n);
}
var je = { exports: {} }, A = {};
/**
 * @license React
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var pt;
function vn() {
  if (pt) return A;
  pt = 1;
  var t = Symbol.for("react.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), e = Symbol.for("react.provider"), s = Symbol.for("react.context"), c = Symbol.for("react.server_context"), d = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), E = Symbol.for("react.suspense_list"), x = Symbol.for("react.memo"), V = Symbol.for("react.lazy"), C = Symbol.for("react.offscreen"), b;
  b = Symbol.for("react.module.reference");
  function N(f) {
    if (typeof f == "object" && f !== null) {
      var B = f.$$typeof;
      switch (B) {
        case t:
          switch (f = f.type, f) {
            case r:
            case o:
            case i:
            case _:
            case E:
              return f;
            default:
              switch (f = f && f.$$typeof, f) {
                case c:
                case s:
                case d:
                case V:
                case x:
                case e:
                  return f;
                default:
                  return B;
              }
          }
        case n:
          return B;
      }
    }
  }
  return A.ContextConsumer = s, A.ContextProvider = e, A.Element = t, A.ForwardRef = d, A.Fragment = r, A.Lazy = V, A.Memo = x, A.Portal = n, A.Profiler = o, A.StrictMode = i, A.Suspense = _, A.SuspenseList = E, A.isAsyncMode = function() {
    return !1;
  }, A.isConcurrentMode = function() {
    return !1;
  }, A.isContextConsumer = function(f) {
    return N(f) === s;
  }, A.isContextProvider = function(f) {
    return N(f) === e;
  }, A.isElement = function(f) {
    return typeof f == "object" && f !== null && f.$$typeof === t;
  }, A.isForwardRef = function(f) {
    return N(f) === d;
  }, A.isFragment = function(f) {
    return N(f) === r;
  }, A.isLazy = function(f) {
    return N(f) === V;
  }, A.isMemo = function(f) {
    return N(f) === x;
  }, A.isPortal = function(f) {
    return N(f) === n;
  }, A.isProfiler = function(f) {
    return N(f) === o;
  }, A.isStrictMode = function(f) {
    return N(f) === i;
  }, A.isSuspense = function(f) {
    return N(f) === _;
  }, A.isSuspenseList = function(f) {
    return N(f) === E;
  }, A.isValidElementType = function(f) {
    return typeof f == "string" || typeof f == "function" || f === r || f === o || f === i || f === _ || f === E || f === C || typeof f == "object" && f !== null && (f.$$typeof === V || f.$$typeof === x || f.$$typeof === e || f.$$typeof === s || f.$$typeof === d || f.$$typeof === b || f.getModuleId !== void 0);
  }, A.typeOf = N, A;
}
var K = {};
/**
 * @license React
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ft;
function _n() {
  return ft || (ft = 1, process.env.NODE_ENV !== "production" && function() {
    var t = Symbol.for("react.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), o = Symbol.for("react.profiler"), e = Symbol.for("react.provider"), s = Symbol.for("react.context"), c = Symbol.for("react.server_context"), d = Symbol.for("react.forward_ref"), _ = Symbol.for("react.suspense"), E = Symbol.for("react.suspense_list"), x = Symbol.for("react.memo"), V = Symbol.for("react.lazy"), C = Symbol.for("react.offscreen"), b = !1, N = !1, f = !1, B = !1, u = !1, a;
    a = Symbol.for("react.module.reference");
    function l(h) {
      return !!(typeof h == "string" || typeof h == "function" || h === r || h === o || u || h === i || h === _ || h === E || B || h === C || b || N || f || typeof h == "object" && h !== null && (h.$$typeof === V || h.$$typeof === x || h.$$typeof === e || h.$$typeof === s || h.$$typeof === d || // This needs to include all possible module reference object
      // types supported by any Flight configuration anywhere since
      // we don't know which Flight build this will end up being used
      // with.
      h.$$typeof === a || h.getModuleId !== void 0));
    }
    function g(h) {
      if (typeof h == "object" && h !== null) {
        var oe = h.$$typeof;
        switch (oe) {
          case t:
            var Q = h.type;
            switch (Q) {
              case r:
              case o:
              case i:
              case _:
              case E:
                return Q;
              default:
                var me = Q && Q.$$typeof;
                switch (me) {
                  case c:
                  case s:
                  case d:
                  case V:
                  case x:
                  case e:
                    return me;
                  default:
                    return oe;
                }
            }
          case n:
            return oe;
        }
      }
    }
    var m = s, O = e, v = t, P = d, M = r, T = V, H = x, F = n, $ = o, I = i, L = _, k = E, ue = !1, se = !1;
    function pe(h) {
      return ue || (ue = !0, console.warn("The ReactIs.isAsyncMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    function he(h) {
      return se || (se = !0, console.warn("The ReactIs.isConcurrentMode() alias has been deprecated, and will be removed in React 18+.")), !1;
    }
    function D(h) {
      return g(h) === s;
    }
    function y(h) {
      return g(h) === e;
    }
    function w(h) {
      return typeof h == "object" && h !== null && h.$$typeof === t;
    }
    function R(h) {
      return g(h) === d;
    }
    function X(h) {
      return g(h) === r;
    }
    function Z(h) {
      return g(h) === V;
    }
    function z(h) {
      return g(h) === x;
    }
    function j(h) {
      return g(h) === n;
    }
    function U(h) {
      return g(h) === o;
    }
    function J(h) {
      return g(h) === i;
    }
    function Y(h) {
      return g(h) === _;
    }
    function ne(h) {
      return g(h) === E;
    }
    K.ContextConsumer = m, K.ContextProvider = O, K.Element = v, K.ForwardRef = P, K.Fragment = M, K.Lazy = T, K.Memo = H, K.Portal = F, K.Profiler = $, K.StrictMode = I, K.Suspense = L, K.SuspenseList = k, K.isAsyncMode = pe, K.isConcurrentMode = he, K.isContextConsumer = D, K.isContextProvider = y, K.isElement = w, K.isForwardRef = R, K.isFragment = X, K.isLazy = Z, K.isMemo = z, K.isPortal = j, K.isProfiler = U, K.isStrictMode = J, K.isSuspense = Y, K.isSuspenseList = ne, K.isValidElementType = l, K.typeOf = g;
  }()), K;
}
process.env.NODE_ENV === "production" ? je.exports = vn() : je.exports = _n();
var gt = je.exports;
const ht = (t) => typeof t == "object" && t != null && t.nodeType === 1, mt = (t, n) => (!n || t !== "hidden") && t !== "visible" && t !== "clip", Be = (t, n) => {
  if (t.clientHeight < t.scrollHeight || t.clientWidth < t.scrollWidth) {
    const r = getComputedStyle(t, null);
    return mt(r.overflowY, n) || mt(r.overflowX, n) || ((i) => {
      const o = ((e) => {
        if (!e.ownerDocument || !e.ownerDocument.defaultView) return null;
        try {
          return e.ownerDocument.defaultView.frameElement;
        } catch {
          return null;
        }
      })(i);
      return !!o && (o.clientHeight < i.scrollHeight || o.clientWidth < i.scrollWidth);
    })(t);
  }
  return !1;
}, Se = (t, n, r, i, o, e, s, c) => e < t && s > n || e > t && s < n ? 0 : e <= t && c <= r || s >= n && c >= r ? e - t - i : s > n && c < r || e < t && c > r ? s - n + o : 0, In = (t) => {
  const n = t.parentElement;
  return n ?? (t.getRootNode().host || null);
}, En = (t, n) => {
  var r, i, o, e;
  if (typeof document > "u") return [];
  const { scrollMode: s, block: c, inline: d, boundary: _, skipOverflowHiddenElements: E } = n, x = typeof _ == "function" ? _ : (L) => L !== _;
  if (!ht(t)) throw new TypeError("Invalid target");
  const V = document.scrollingElement || document.documentElement, C = [];
  let b = t;
  for (; ht(b) && x(b); ) {
    if (b = In(b), b === V) {
      C.push(b);
      break;
    }
    b != null && b === document.body && Be(b) && !Be(document.documentElement) || b != null && Be(b, E) && C.push(b);
  }
  const N = (i = (r = window.visualViewport) == null ? void 0 : r.width) != null ? i : innerWidth, f = (e = (o = window.visualViewport) == null ? void 0 : o.height) != null ? e : innerHeight, { scrollX: B, scrollY: u } = window, { height: a, width: l, top: g, right: m, bottom: O, left: v } = t.getBoundingClientRect(), { top: P, right: M, bottom: T, left: H } = ((L) => {
    const k = window.getComputedStyle(L);
    return { top: parseFloat(k.scrollMarginTop) || 0, right: parseFloat(k.scrollMarginRight) || 0, bottom: parseFloat(k.scrollMarginBottom) || 0, left: parseFloat(k.scrollMarginLeft) || 0 };
  })(t);
  let F = c === "start" || c === "nearest" ? g - P : c === "end" ? O + T : g + a / 2 - P + T, $ = d === "center" ? v + l / 2 - H + M : d === "end" ? m + M : v - H;
  const I = [];
  for (let L = 0; L < C.length; L++) {
    const k = C[L], { height: ue, width: se, top: pe, right: he, bottom: D, left: y } = k.getBoundingClientRect();
    if (s === "if-needed" && g >= 0 && v >= 0 && O <= f && m <= N && g >= pe && O <= D && v >= y && m <= he) return I;
    const w = getComputedStyle(k), R = parseInt(w.borderLeftWidth, 10), X = parseInt(w.borderTopWidth, 10), Z = parseInt(w.borderRightWidth, 10), z = parseInt(w.borderBottomWidth, 10);
    let j = 0, U = 0;
    const J = "offsetWidth" in k ? k.offsetWidth - k.clientWidth - R - Z : 0, Y = "offsetHeight" in k ? k.offsetHeight - k.clientHeight - X - z : 0, ne = "offsetWidth" in k ? k.offsetWidth === 0 ? 0 : se / k.offsetWidth : 0, h = "offsetHeight" in k ? k.offsetHeight === 0 ? 0 : ue / k.offsetHeight : 0;
    if (V === k) j = c === "start" ? F : c === "end" ? F - f : c === "nearest" ? Se(u, u + f, f, X, z, u + F, u + F + a, a) : F - f / 2, U = d === "start" ? $ : d === "center" ? $ - N / 2 : d === "end" ? $ - N : Se(B, B + N, N, R, Z, B + $, B + $ + l, l), j = Math.max(0, j + u), U = Math.max(0, U + B);
    else {
      j = c === "start" ? F - pe - X : c === "end" ? F - D + z + Y : c === "nearest" ? Se(pe, D, ue, X, z + Y, F, F + a, a) : F - (pe + ue / 2) + Y / 2, U = d === "start" ? $ - y - R : d === "center" ? $ - (y + se / 2) + J / 2 : d === "end" ? $ - he + Z + J : Se(y, he, se, R, Z + J, $, $ + l, l);
      const { scrollLeft: oe, scrollTop: Q } = k;
      j = h === 0 ? 0 : Math.max(0, Math.min(Q + j / h, k.scrollHeight - ue / h + Y)), U = ne === 0 ? 0 : Math.max(0, Math.min(oe + U / ne, k.scrollWidth - se / ne + J)), F += Q - j, $ += oe - U;
    }
    I.push({ el: k, top: j, left: U });
  }
  return I;
};
var Ee = function() {
  return Ee = Object.assign || function(n) {
    for (var r, i = 1, o = arguments.length; i < o; i++) {
      r = arguments[i];
      for (var e in r) Object.prototype.hasOwnProperty.call(r, e) && (n[e] = r[e]);
    }
    return n;
  }, Ee.apply(this, arguments);
};
var yn = 0;
function vt(t) {
  return typeof t == "function" ? t : ee;
}
function ee() {
}
function bt(t, n) {
  if (t) {
    var r = En(t, {
      boundary: n,
      block: "nearest",
      scrollMode: "if-needed"
    });
    r.forEach(function(i) {
      var o = i.el, e = i.top, s = i.left;
      o.scrollTop = e, o.scrollLeft = s;
    });
  }
}
function _t(t, n, r) {
  var i = t === n || n instanceof r.Node && t.contains && t.contains(n);
  return i;
}
function Ye(t, n) {
  var r;
  function i() {
    r && clearTimeout(r);
  }
  function o() {
    for (var e = arguments.length, s = new Array(e), c = 0; c < e; c++)
      s[c] = arguments[c];
    i(), r = setTimeout(function() {
      r = null, t.apply(void 0, s);
    }, n);
  }
  return o.cancel = i, o;
}
function q() {
  for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
    n[r] = arguments[r];
  return function(i) {
    for (var o = arguments.length, e = new Array(o > 1 ? o - 1 : 0), s = 1; s < o; s++)
      e[s - 1] = arguments[s];
    return n.some(function(c) {
      return c && c.apply(void 0, [i].concat(e)), i.preventDownshiftDefault || i.hasOwnProperty("nativeEvent") && i.nativeEvent.preventDownshiftDefault;
    });
  };
}
function Ie() {
  for (var t = arguments.length, n = new Array(t), r = 0; r < t; r++)
    n[r] = arguments[r];
  return function(i) {
    n.forEach(function(o) {
      typeof o == "function" ? o(i) : o && (o.current = i);
    });
  };
}
function Ot() {
  return String(yn++);
}
function wn(t) {
  var n = t.isOpen, r = t.resultCount, i = t.previousResultCount;
  return n ? r ? r !== i ? r + " result" + (r === 1 ? " is" : "s are") + " available, use up and down arrow keys to navigate. Press Enter key to select." : "" : "No results are available." : "";
}
function It(t, n) {
  return t = Array.isArray(t) ? (
    /* istanbul ignore next (preact) */
    t[0]
  ) : t, !t && n ? n : t;
}
function Dt(t) {
  return typeof t.type == "string";
}
function xt(t) {
  return t.props;
}
function bn(t, n) {
  console.error('The property "' + n + '" is required in "' + t + '"');
}
var On = ["highlightedIndex", "inputValue", "isOpen", "selectedItem", "type"];
function Me(t) {
  t === void 0 && (t = {});
  var n = {};
  return On.forEach(function(r) {
    t.hasOwnProperty(r) && (n[r] = t[r]);
  }), n;
}
function ke(t, n) {
  return !t || !n ? t : Object.keys(t).reduce(function(r, i) {
    return r[i] = He(n, i) ? n[i] : t[i], r;
  }, {});
}
function He(t, n) {
  return t[n] !== void 0;
}
function We(t) {
  var n = t.key, r = t.keyCode;
  return r >= 37 && r <= 40 && n.indexOf("Arrow") !== 0 ? "Arrow" + n : n;
}
function Dn(t) {
  return Object.prototype.toString.call(t) === "[object Object]";
}
function _e(t, n, r, i, o) {
  var e = r.length;
  if (e === 0)
    return -1;
  var s = e - 1;
  (typeof t != "number" || t < 0 || t > s) && (t = n > 0 ? -1 : s + 1);
  var c = t + n;
  c < 0 ? c = s : c > s && (c = 0);
  var d = ye(c, n < 0, r, i, o);
  return d === -1 ? t >= e ? -1 : t : d;
}
function ye(t, n, r, i, o) {
  o === void 0 && (o = !1);
  var e = r.length;
  if (n) {
    for (var s = t; s >= 0; s--)
      if (!i(r[s], s))
        return s;
  } else
    for (var c = t; c < e; c++)
      if (!i(r[c], c))
        return c;
  return o ? ye(n ? e - 1 : 0, n, r, i) : -1;
}
function Ae(t, n, r, i) {
  return i === void 0 && (i = !0), r && n.some(function(o) {
    return o && (_t(o, t, r) || i && _t(o, r.document.activeElement, r));
  });
}
var ze = ee;
process.env.NODE_ENV !== "production" && (ze = function(n, r, i) {
  var o = "This prop should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled Downshift element for the lifetime of the component. More info: https://github.com/downshift-js/downshift#control-props";
  Object.keys(n).forEach(function(e) {
    r[e] !== void 0 && i[e] === void 0 ? console.error('downshift: A component has changed the controlled prop "' + e + '" to be uncontrolled. ' + o) : r[e] === void 0 && i[e] !== void 0 && console.error('downshift: A component has changed the uncontrolled prop "' + e + '" to be controlled. ' + o);
  });
});
var xn = Ye(function(t) {
  Ct(t).textContent = "";
}, 500);
function Ct(t) {
  var n = t.getElementById("a11y-status-message");
  return n || (n = t.createElement("div"), n.setAttribute("id", "a11y-status-message"), n.setAttribute("role", "status"), n.setAttribute("aria-live", "polite"), n.setAttribute("aria-relevant", "additions text"), Object.assign(n.style, {
    border: "0",
    clip: "rect(0 0 0 0)",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    padding: "0",
    position: "absolute",
    width: "1px"
  }), t.body.appendChild(n), n);
}
function Nt(t, n) {
  if (!(!t || !n)) {
    var r = Ct(n);
    r.textContent = t, xn(n);
  }
}
function Cn(t) {
  var n = t == null ? void 0 : t.getElementById("a11y-status-message");
  n && n.remove();
}
var St = process.env.NODE_ENV !== "production" ? "__autocomplete_unknown__" : 0, Mt = process.env.NODE_ENV !== "production" ? "__autocomplete_mouseup__" : 1, Vt = process.env.NODE_ENV !== "production" ? "__autocomplete_item_mouseenter__" : 2, Ve = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_arrow_up__" : 3, Re = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_arrow_down__" : 4, Rt = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_escape__" : 5, Pt = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_enter__" : 6, Tt = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_home__" : 7, kt = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_end__" : 8, Ht = process.env.NODE_ENV !== "production" ? "__autocomplete_click_item__" : 9, At = process.env.NODE_ENV !== "production" ? "__autocomplete_blur_input__" : 10, Kt = process.env.NODE_ENV !== "production" ? "__autocomplete_change_input__" : 11, $t = process.env.NODE_ENV !== "production" ? "__autocomplete_keydown_space_button__" : 12, qe = process.env.NODE_ENV !== "production" ? "__autocomplete_click_button__" : 13, Lt = process.env.NODE_ENV !== "production" ? "__autocomplete_blur_button__" : 14, Ft = process.env.NODE_ENV !== "production" ? "__autocomplete_controlled_prop_updated_selected_item__" : 15, Bt = process.env.NODE_ENV !== "production" ? "__autocomplete_touchend__" : 16, Nn = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  unknown: St,
  mouseUp: Mt,
  itemMouseEnter: Vt,
  keyDownArrowUp: Ve,
  keyDownArrowDown: Re,
  keyDownEscape: Rt,
  keyDownEnter: Pt,
  keyDownHome: Tt,
  keyDownEnd: kt,
  clickItem: Ht,
  blurInput: At,
  changeInput: Kt,
  keyDownSpaceButton: $t,
  clickButton: qe,
  blurButton: Lt,
  controlledPropUpdatedSelectedItem: Ft,
  touchEnd: Bt
}), Sn = ["refKey", "ref"], Mn = ["onClick", "onPress", "onKeyDown", "onKeyUp", "onBlur"], Vn = ["onKeyDown", "onBlur", "onChange", "onInput", "onChangeText"], Rn = ["refKey", "ref"], Pn = ["onMouseMove", "onMouseDown", "onClick", "onPress", "index", "item"], Tn = /* @__PURE__ */ function() {
  var t = /* @__PURE__ */ function(n) {
    function r(o) {
      var e;
      e = n.call(this, o) || this, e.id = e.props.id || "downshift-" + Ot(), e.menuId = e.props.menuId || e.id + "-menu", e.labelId = e.props.labelId || e.id + "-label", e.inputId = e.props.inputId || e.id + "-input", e.getItemId = e.props.getItemId || function(u) {
        return e.id + "-item-" + u;
      }, e.items = [], e.itemCount = null, e.previousResultCount = 0, e.timeoutIds = [], e.internalSetTimeout = function(u, a) {
        var l = setTimeout(function() {
          e.timeoutIds = e.timeoutIds.filter(function(g) {
            return g !== l;
          }), u();
        }, a);
        e.timeoutIds.push(l);
      }, e.setItemCount = function(u) {
        e.itemCount = u;
      }, e.unsetItemCount = function() {
        e.itemCount = null;
      }, e.isItemDisabled = function(u, a) {
        var l = e.getItemNodeFromIndex(a);
        return l && l.hasAttribute("disabled");
      }, e.setHighlightedIndex = function(u, a) {
        u === void 0 && (u = e.props.defaultHighlightedIndex), a === void 0 && (a = {}), a = Me(a), e.internalSetState(S({
          highlightedIndex: u
        }, a));
      }, e.clearSelection = function(u) {
        e.internalSetState({
          selectedItem: null,
          inputValue: "",
          highlightedIndex: e.props.defaultHighlightedIndex,
          isOpen: e.props.defaultIsOpen
        }, u);
      }, e.selectItem = function(u, a, l) {
        a = Me(a), e.internalSetState(S({
          isOpen: e.props.defaultIsOpen,
          highlightedIndex: e.props.defaultHighlightedIndex,
          selectedItem: u,
          inputValue: e.props.itemToString(u)
        }, a), l);
      }, e.selectItemAtIndex = function(u, a, l) {
        var g = e.items[u];
        g != null && e.selectItem(g, a, l);
      }, e.selectHighlightedItem = function(u, a) {
        return e.selectItemAtIndex(e.getState().highlightedIndex, u, a);
      }, e.internalSetState = function(u, a) {
        var l, g, m = {}, O = typeof u == "function";
        return !O && u.hasOwnProperty("inputValue") && e.props.onInputValueChange(u.inputValue, S({}, e.getStateAndHelpers(), u)), e.setState(function(v) {
          var P;
          v = e.getState(v);
          var M = O ? u(v) : u;
          M = e.props.stateReducer(v, M), l = M.hasOwnProperty("selectedItem");
          var T = {};
          return l && M.selectedItem !== v.selectedItem && (g = M.selectedItem), (P = M).type || (P.type = St), Object.keys(M).forEach(function(H) {
            v[H] !== M[H] && (m[H] = M[H]), H !== "type" && (M[H], He(e.props, H) || (T[H] = M[H]));
          }), O && M.hasOwnProperty("inputValue") && e.props.onInputValueChange(M.inputValue, S({}, e.getStateAndHelpers(), M)), T;
        }, function() {
          vt(a)();
          var v = Object.keys(m).length > 1;
          v && e.props.onStateChange(m, e.getStateAndHelpers()), l && e.props.onSelect(u.selectedItem, e.getStateAndHelpers()), g !== void 0 && e.props.onChange(g, e.getStateAndHelpers()), e.props.onUserAction(m, e.getStateAndHelpers());
        });
      }, e.rootRef = function(u) {
        return e._rootNode = u;
      }, e.getRootProps = function(u, a) {
        var l, g = u === void 0 ? {} : u, m = g.refKey, O = m === void 0 ? "ref" : m, v = g.ref, P = ce(g, Sn), M = a === void 0 ? {} : a, T = M.suppressRefError, H = T === void 0 ? !1 : T;
        e.getRootProps.called = !0, e.getRootProps.refKey = O, e.getRootProps.suppressRefError = H;
        var F = e.getState(), $ = F.isOpen;
        return S((l = {}, l[O] = Ie(v, e.rootRef), l.role = "combobox", l["aria-expanded"] = $, l["aria-haspopup"] = "listbox", l["aria-owns"] = $ ? e.menuId : void 0, l["aria-labelledby"] = e.labelId, l), P);
      }, e.keyDownHandlers = {
        ArrowDown: function(a) {
          var l = this;
          if (a.preventDefault(), this.getState().isOpen) {
            var g = a.shiftKey ? 5 : 1;
            this.moveHighlightedIndex(g, {
              type: Re
            });
          } else
            this.internalSetState({
              isOpen: !0,
              type: Re
            }, function() {
              var m = l.getItemCount();
              if (m > 0) {
                var O = l.getState(), v = O.highlightedIndex, P = _e(v, 1, {
                  length: m
                }, l.isItemDisabled, !0);
                l.setHighlightedIndex(P, {
                  type: Re
                });
              }
            });
        },
        ArrowUp: function(a) {
          var l = this;
          if (a.preventDefault(), this.getState().isOpen) {
            var g = a.shiftKey ? -5 : -1;
            this.moveHighlightedIndex(g, {
              type: Ve
            });
          } else
            this.internalSetState({
              isOpen: !0,
              type: Ve
            }, function() {
              var m = l.getItemCount();
              if (m > 0) {
                var O = l.getState(), v = O.highlightedIndex, P = _e(v, -1, {
                  length: m
                }, l.isItemDisabled, !0);
                l.setHighlightedIndex(P, {
                  type: Ve
                });
              }
            });
        },
        Enter: function(a) {
          if (a.which !== 229) {
            var l = this.getState(), g = l.isOpen, m = l.highlightedIndex;
            if (g && m != null) {
              a.preventDefault();
              var O = this.items[m], v = this.getItemNodeFromIndex(m);
              if (O == null || v && v.hasAttribute("disabled"))
                return;
              this.selectHighlightedItem({
                type: Pt
              });
            }
          }
        },
        Escape: function(a) {
          a.preventDefault(), this.reset(S({
            type: Rt
          }, !this.state.isOpen && {
            selectedItem: null,
            inputValue: ""
          }));
        }
      }, e.buttonKeyDownHandlers = S({}, e.keyDownHandlers, {
        " ": function(a) {
          a.preventDefault(), this.toggleMenu({
            type: $t
          });
        }
      }), e.inputKeyDownHandlers = S({}, e.keyDownHandlers, {
        Home: function(a) {
          var l = this.getState(), g = l.isOpen;
          if (g) {
            a.preventDefault();
            var m = this.getItemCount();
            if (!(m <= 0 || !g)) {
              var O = ye(0, !1, {
                length: m
              }, this.isItemDisabled);
              this.setHighlightedIndex(O, {
                type: Tt
              });
            }
          }
        },
        End: function(a) {
          var l = this.getState(), g = l.isOpen;
          if (g) {
            a.preventDefault();
            var m = this.getItemCount();
            if (!(m <= 0 || !g)) {
              var O = ye(m - 1, !0, {
                length: m
              }, this.isItemDisabled);
              this.setHighlightedIndex(O, {
                type: kt
              });
            }
          }
        }
      }), e.getToggleButtonProps = function(u) {
        var a = u === void 0 ? {} : u, l = a.onClick;
        a.onPress;
        var g = a.onKeyDown, m = a.onKeyUp, O = a.onBlur, v = ce(a, Mn), P = e.getState(), M = P.isOpen, T = {
          onClick: q(l, e.buttonHandleClick),
          onKeyDown: q(g, e.buttonHandleKeyDown),
          onKeyUp: q(m, e.buttonHandleKeyUp),
          onBlur: q(O, e.buttonHandleBlur)
        }, H = v.disabled ? {} : T;
        return S({
          type: "button",
          role: "button",
          "aria-label": M ? "close menu" : "open menu",
          "aria-haspopup": !0,
          "data-toggle": !0
        }, H, v);
      }, e.buttonHandleKeyUp = function(u) {
        u.preventDefault();
      }, e.buttonHandleKeyDown = function(u) {
        var a = We(u);
        e.buttonKeyDownHandlers[a] && e.buttonKeyDownHandlers[a].call(e, u);
      }, e.buttonHandleClick = function(u) {
        if (u.preventDefault(), e.props.environment) {
          var a = e.props.environment.document, l = a.body, g = a.activeElement;
          l && l === g && u.target.focus();
        }
        process.env.NODE_ENV === "test" ? e.toggleMenu({
          type: qe
        }) : e.internalSetTimeout(function() {
          return e.toggleMenu({
            type: qe
          });
        });
      }, e.buttonHandleBlur = function(u) {
        var a = u.target;
        e.internalSetTimeout(function() {
          if (!(e.isMouseDown || !e.props.environment)) {
            var l = e.props.environment.document.activeElement;
            (l == null || l.id !== e.inputId) && l !== a && e.reset({
              type: Lt
            });
          }
        });
      }, e.getLabelProps = function(u) {
        return S({
          htmlFor: e.inputId,
          id: e.labelId
        }, u);
      }, e.getInputProps = function(u) {
        var a = u === void 0 ? {} : u, l = a.onKeyDown, g = a.onBlur, m = a.onChange, O = a.onInput;
        a.onChangeText;
        var v = ce(a, Vn), P, M = {};
        P = "onChange";
        var T = e.getState(), H = T.inputValue, F = T.isOpen, $ = T.highlightedIndex;
        if (!v.disabled) {
          var I;
          M = (I = {}, I[P] = q(m, O, e.inputHandleChange), I.onKeyDown = q(l, e.inputHandleKeyDown), I.onBlur = q(g, e.inputHandleBlur), I);
        }
        return S({
          "aria-autocomplete": "list",
          "aria-activedescendant": F && typeof $ == "number" && $ >= 0 ? e.getItemId($) : void 0,
          "aria-controls": F ? e.menuId : void 0,
          "aria-labelledby": v && v["aria-label"] ? void 0 : e.labelId,
          // https://developer.mozilla.org/en-US/docs/Web/Security/Securing_your_site/Turning_off_form_autocompletion
          // revert back since autocomplete="nope" is ignored on latest Chrome and Opera
          autoComplete: "off",
          value: H,
          id: e.inputId
        }, M, v);
      }, e.inputHandleKeyDown = function(u) {
        var a = We(u);
        a && e.inputKeyDownHandlers[a] && e.inputKeyDownHandlers[a].call(e, u);
      }, e.inputHandleChange = function(u) {
        e.internalSetState({
          type: Kt,
          isOpen: !0,
          inputValue: u.target.value,
          highlightedIndex: e.props.defaultHighlightedIndex
        });
      }, e.inputHandleBlur = function() {
        e.internalSetTimeout(function() {
          var u;
          if (!(e.isMouseDown || !e.props.environment)) {
            var a = e.props.environment.document.activeElement, l = (a == null || (u = a.dataset) == null ? void 0 : u.toggle) && e._rootNode && e._rootNode.contains(a);
            l || e.reset({
              type: At
            });
          }
        });
      }, e.menuRef = function(u) {
        e._menuNode = u;
      }, e.getMenuProps = function(u, a) {
        var l, g = u === void 0 ? {} : u, m = g.refKey, O = m === void 0 ? "ref" : m, v = g.ref, P = ce(g, Rn), M = a === void 0 ? {} : a, T = M.suppressRefError, H = T === void 0 ? !1 : T;
        return e.getMenuProps.called = !0, e.getMenuProps.refKey = O, e.getMenuProps.suppressRefError = H, S((l = {}, l[O] = Ie(v, e.menuRef), l.role = "listbox", l["aria-labelledby"] = P && P["aria-label"] ? void 0 : e.labelId, l.id = e.menuId, l), P);
      }, e.getItemProps = function(u) {
        var a, l = u === void 0 ? {} : u, g = l.onMouseMove, m = l.onMouseDown, O = l.onClick;
        l.onPress;
        var v = l.index, P = l.item, M = P === void 0 ? process.env.NODE_ENV === "production" ? (
          /* istanbul ignore next */
          void 0
        ) : bn("getItemProps", "item") : P, T = ce(l, Pn);
        v === void 0 ? (e.items.push(M), v = e.items.indexOf(M)) : e.items[v] = M;
        var H = "onClick", F = O, $ = (a = {
          // onMouseMove is used over onMouseEnter here. onMouseMove
          // is only triggered on actual mouse movement while onMouseEnter
          // can fire on DOM changes, interrupting keyboard navigation
          onMouseMove: q(g, function() {
            v !== e.getState().highlightedIndex && (e.setHighlightedIndex(v, {
              type: Vt
            }), e.avoidScrolling = !0, e.internalSetTimeout(function() {
              return e.avoidScrolling = !1;
            }, 250));
          }),
          onMouseDown: q(m, function(L) {
            L.preventDefault();
          })
        }, a[H] = q(F, function() {
          e.selectItemAtIndex(v, {
            type: Ht
          });
        }), a), I = T.disabled ? {
          onMouseDown: $.onMouseDown
        } : $;
        return S({
          id: e.getItemId(v),
          role: "option",
          "aria-selected": e.getState().highlightedIndex === v
        }, I, T);
      }, e.clearItems = function() {
        e.items = [];
      }, e.reset = function(u, a) {
        u === void 0 && (u = {}), u = Me(u), e.internalSetState(function(l) {
          var g = l.selectedItem;
          return S({
            isOpen: e.props.defaultIsOpen,
            highlightedIndex: e.props.defaultHighlightedIndex,
            inputValue: e.props.itemToString(g)
          }, u);
        }, a);
      }, e.toggleMenu = function(u, a) {
        u === void 0 && (u = {}), u = Me(u), e.internalSetState(function(l) {
          var g = l.isOpen;
          return S({
            isOpen: !g
          }, g && {
            highlightedIndex: e.props.defaultHighlightedIndex
          }, u);
        }, function() {
          var l = e.getState(), g = l.isOpen, m = l.highlightedIndex;
          g && e.getItemCount() > 0 && typeof m == "number" && e.setHighlightedIndex(m, u), vt(a)();
        });
      }, e.openMenu = function(u) {
        e.internalSetState({
          isOpen: !0
        }, u);
      }, e.closeMenu = function(u) {
        e.internalSetState({
          isOpen: !1
        }, u);
      }, e.updateStatus = Ye(function() {
        var u;
        if ((u = e.props) != null && (u = u.environment) != null && u.document) {
          var a = e.getState(), l = e.items[a.highlightedIndex], g = e.getItemCount(), m = e.props.getA11yStatusMessage(S({
            itemToString: e.props.itemToString,
            previousResultCount: e.previousResultCount,
            resultCount: g,
            highlightedItem: l
          }, a));
          e.previousResultCount = g, Nt(m, e.props.environment.document);
        }
      }, 200);
      var s = e.props, c = s.defaultHighlightedIndex, d = s.initialHighlightedIndex, _ = d === void 0 ? c : d, E = s.defaultIsOpen, x = s.initialIsOpen, V = x === void 0 ? E : x, C = s.initialInputValue, b = C === void 0 ? "" : C, N = s.initialSelectedItem, f = N === void 0 ? null : N, B = e.getState({
        highlightedIndex: _,
        isOpen: V,
        inputValue: b,
        selectedItem: f
      });
      return B.selectedItem != null && e.props.initialInputValue === void 0 && (B.inputValue = e.props.itemToString(B.selectedItem)), e.state = B, e;
    }
    mn(r, n);
    var i = r.prototype;
    return i.internalClearTimeouts = function() {
      this.timeoutIds.forEach(function(e) {
        clearTimeout(e);
      }), this.timeoutIds = [];
    }, i.getState = function(e) {
      return e === void 0 && (e = this.state), ke(e, this.props);
    }, i.getItemCount = function() {
      var e = this.items.length;
      return this.itemCount != null ? e = this.itemCount : this.props.itemCount !== void 0 && (e = this.props.itemCount), e;
    }, i.getItemNodeFromIndex = function(e) {
      return this.props.environment ? this.props.environment.document.getElementById(this.getItemId(e)) : null;
    }, i.scrollHighlightedItemIntoView = function() {
      {
        var e = this.getItemNodeFromIndex(this.getState().highlightedIndex);
        this.props.scrollIntoView(e, this._menuNode);
      }
    }, i.moveHighlightedIndex = function(e, s) {
      var c = this.getItemCount(), d = this.getState(), _ = d.highlightedIndex;
      if (c > 0) {
        var E = _e(_, e, {
          length: c
        }, this.isItemDisabled, !0);
        this.setHighlightedIndex(E, s);
      }
    }, i.getStateAndHelpers = function() {
      var e = this.getState(), s = e.highlightedIndex, c = e.inputValue, d = e.selectedItem, _ = e.isOpen, E = this.props.itemToString, x = this.id, V = this.getRootProps, C = this.getToggleButtonProps, b = this.getLabelProps, N = this.getMenuProps, f = this.getInputProps, B = this.getItemProps, u = this.openMenu, a = this.closeMenu, l = this.toggleMenu, g = this.selectItem, m = this.selectItemAtIndex, O = this.selectHighlightedItem, v = this.setHighlightedIndex, P = this.clearSelection, M = this.clearItems, T = this.reset, H = this.setItemCount, F = this.unsetItemCount, $ = this.internalSetState;
      return {
        // prop getters
        getRootProps: V,
        getToggleButtonProps: C,
        getLabelProps: b,
        getMenuProps: N,
        getInputProps: f,
        getItemProps: B,
        // actions
        reset: T,
        openMenu: u,
        closeMenu: a,
        toggleMenu: l,
        selectItem: g,
        selectItemAtIndex: m,
        selectHighlightedItem: O,
        setHighlightedIndex: v,
        clearSelection: P,
        clearItems: M,
        setItemCount: H,
        unsetItemCount: F,
        setState: $,
        // props
        itemToString: E,
        // derived
        id: x,
        // state
        highlightedIndex: s,
        inputValue: c,
        isOpen: _,
        selectedItem: d
      };
    }, i.componentDidMount = function() {
      var e = this;
      if (process.env.NODE_ENV !== "production" && this.getMenuProps.called && !this.getMenuProps.suppressRefError && Et(this._menuNode, this.getMenuProps), !this.props.environment)
        this.cleanup = function() {
          e.internalClearTimeouts();
        };
      else {
        var s = function() {
          e.isMouseDown = !0;
        }, c = function(C) {
          e.isMouseDown = !1;
          var b = Ae(C.target, [e._rootNode, e._menuNode], e.props.environment);
          !b && e.getState().isOpen && e.reset({
            type: Mt
          }, function() {
            return e.props.onOuterClick(e.getStateAndHelpers());
          });
        }, d = function() {
          e.isTouchMove = !1;
        }, _ = function() {
          e.isTouchMove = !0;
        }, E = function(C) {
          var b = Ae(C.target, [e._rootNode, e._menuNode], e.props.environment, !1);
          !e.isTouchMove && !b && e.getState().isOpen && e.reset({
            type: Bt
          }, function() {
            return e.props.onOuterClick(e.getStateAndHelpers());
          });
        }, x = this.props.environment;
        x.addEventListener("mousedown", s), x.addEventListener("mouseup", c), x.addEventListener("touchstart", d), x.addEventListener("touchmove", _), x.addEventListener("touchend", E), this.cleanup = function() {
          e.internalClearTimeouts(), e.updateStatus.cancel(), x.removeEventListener("mousedown", s), x.removeEventListener("mouseup", c), x.removeEventListener("touchstart", d), x.removeEventListener("touchmove", _), x.removeEventListener("touchend", E);
        };
      }
    }, i.shouldScroll = function(e, s) {
      var c = this.props.highlightedIndex === void 0 ? this.getState() : this.props, d = c.highlightedIndex, _ = s.highlightedIndex === void 0 ? e : s, E = _.highlightedIndex, x = d && this.getState().isOpen && !e.isOpen, V = d !== E;
      return x || V;
    }, i.componentDidUpdate = function(e, s) {
      process.env.NODE_ENV !== "production" && (ze(this.state, e, this.props), this.getMenuProps.called && !this.getMenuProps.suppressRefError && Et(this._menuNode, this.getMenuProps)), He(this.props, "selectedItem") && this.props.selectedItemChanged(e.selectedItem, this.props.selectedItem) && this.internalSetState({
        type: Ft,
        inputValue: this.props.itemToString(this.props.selectedItem)
      }), !this.avoidScrolling && this.shouldScroll(s, e) && this.scrollHighlightedItemIntoView(), this.updateStatus();
    }, i.componentWillUnmount = function() {
      this.cleanup();
    }, i.render = function() {
      var e = It(this.props.children, ee);
      this.clearItems(), this.getRootProps.called = !1, this.getRootProps.refKey = void 0, this.getRootProps.suppressRefError = void 0, this.getMenuProps.called = !1, this.getMenuProps.refKey = void 0, this.getMenuProps.suppressRefError = void 0, this.getLabelProps.called = !1, this.getInputProps.called = !1;
      var s = It(e(this.getStateAndHelpers()));
      if (!s)
        return null;
      if (this.getRootProps.called || this.props.suppressRefError)
        return process.env.NODE_ENV !== "production" && !this.getRootProps.suppressRefError && !this.props.suppressRefError && kn(s, this.getRootProps), s;
      if (Dt(s))
        return /* @__PURE__ */ an(s, this.getRootProps(xt(s)));
      if (process.env.NODE_ENV !== "production")
        throw new Error("downshift: If you return a non-DOM element, you must apply the getRootProps function");
    }, r;
  }(pn);
  return t.defaultProps = {
    defaultHighlightedIndex: null,
    defaultIsOpen: !1,
    getA11yStatusMessage: wn,
    itemToString: function(r) {
      return r == null ? "" : (process.env.NODE_ENV !== "production" && Dn(r) && !r.hasOwnProperty("toString") && console.warn("downshift: An object was passed to the default implementation of `itemToString`. You should probably provide your own `itemToString` implementation. Please refer to the `itemToString` API documentation.", "The object that was passed:", r), String(r));
    },
    onStateChange: ee,
    onInputValueChange: ee,
    onUserAction: ee,
    onChange: ee,
    onSelect: ee,
    onOuterClick: ee,
    selectedItemChanged: function(r, i) {
      return r !== i;
    },
    environment: (
      /* istanbul ignore next (ssr) */
      typeof window > "u" ? void 0 : window
    ),
    stateReducer: function(r, i) {
      return i;
    },
    suppressRefError: !1,
    scrollIntoView: bt
  }, t.stateChangeTypes = Nn, t;
}();
process.env.NODE_ENV !== "production" && (Tn.propTypes = {
  children: p.func,
  defaultHighlightedIndex: p.number,
  defaultIsOpen: p.bool,
  initialHighlightedIndex: p.number,
  initialSelectedItem: p.any,
  initialInputValue: p.string,
  initialIsOpen: p.bool,
  getA11yStatusMessage: p.func,
  itemToString: p.func,
  onChange: p.func,
  onSelect: p.func,
  onStateChange: p.func,
  onInputValueChange: p.func,
  onUserAction: p.func,
  onOuterClick: p.func,
  selectedItemChanged: p.func,
  stateReducer: p.func,
  itemCount: p.number,
  id: p.string,
  environment: p.shape({
    addEventListener: p.func.isRequired,
    removeEventListener: p.func.isRequired,
    document: p.shape({
      createElement: p.func.isRequired,
      getElementById: p.func.isRequired,
      activeElement: p.any.isRequired,
      body: p.any.isRequired
    }).isRequired,
    Node: p.func.isRequired
  }),
  suppressRefError: p.bool,
  scrollIntoView: p.func,
  // things we keep in state for uncontrolled components
  // but can accept as props for controlled components
  /* eslint-disable react/no-unused-prop-types */
  selectedItem: p.any,
  isOpen: p.bool,
  inputValue: p.string,
  highlightedIndex: p.number,
  labelId: p.string,
  inputId: p.string,
  menuId: p.string,
  getItemId: p.func
  /* eslint-enable react/no-unused-prop-types */
});
function Et(t, n) {
  var r = n.refKey;
  t || console.error('downshift: The ref prop "' + r + '" from getMenuProps was not applied correctly on your menu element.');
}
function kn(t, n) {
  var r = n.refKey, i = r !== "ref", o = !Dt(t);
  o && !i && !gt.isForwardRef(t) ? console.error("downshift: You returned a non-DOM element. You must specify a refKey in getRootProps") : !o && i && console.error('downshift: You returned a DOM element. You should not specify a refKey in getRootProps. You specified "' + r + '"'), !gt.isForwardRef(t) && !xt(t)[r] && console.error('downshift: You must apply the ref prop "' + r + '" from getRootProps onto your root element.');
}
var Ut = {
  highlightedIndex: -1,
  isOpen: !1,
  selectedItem: null,
  inputValue: ""
};
function Hn(t, n, r) {
  var i = t.props, o = t.type, e = {};
  Object.keys(n).forEach(function(s) {
    An(s, t, n, r), r[s] !== n[s] && (e[s] = r[s]);
  }), i.onStateChange && Object.keys(e).length && i.onStateChange(S({
    type: o
  }, e));
}
function An(t, n, r, i) {
  var o = n.props, e = n.type, s = "on" + Ge(t) + "Change";
  o[s] && i[t] !== void 0 && i[t] !== r[t] && o[s](S({
    type: e
  }, i));
}
function Kn(t, n) {
  return n.changes;
}
var yt = Ye(function(t, n) {
  Nt(t, n);
}, 200), $n = typeof window < "u" && typeof window.document < "u" && typeof window.document.createElement < "u" ? dn : te, Ln = "useId" in Te ? function(n) {
  var r = n.id, i = n.labelId, o = n.menuId, e = n.getItemId, s = n.toggleButtonId, c = n.inputId, d = "downshift-" + Te.useId();
  r || (r = d);
  var _ = G({
    labelId: i || r + "-label",
    menuId: o || r + "-menu",
    getItemId: e || function(E) {
      return r + "-item-" + E;
    },
    toggleButtonId: s || r + "-toggle-button",
    inputId: c || r + "-input"
  });
  return _.current;
} : function(n) {
  var r = n.id, i = r === void 0 ? "downshift-" + Ot() : r, o = n.labelId, e = n.menuId, s = n.getItemId, c = n.toggleButtonId, d = n.inputId, _ = G({
    labelId: o || i + "-label",
    menuId: e || i + "-menu",
    getItemId: s || function(E) {
      return i + "-item-" + E;
    },
    toggleButtonId: c || i + "-toggle-button",
    inputId: d || i + "-input"
  });
  return _.current;
};
function Fn(t, n, r, i) {
  var o, e;
  if (t === void 0) {
    if (n === void 0)
      throw new Error(i);
    o = r[n], e = n;
  } else
    e = n === void 0 ? r.indexOf(t) : n, o = t;
  return [o, e];
}
function Ge(t) {
  return "" + t.slice(0, 1).toUpperCase() + t.slice(1);
}
function jt(t) {
  var n = G(t);
  return n.current = t, n;
}
function Bn(t, n, r, i) {
  var o = G(), e = G(), s = W(function(C, b) {
    e.current = b, C = ke(C, b.props);
    var N = t(C, b), f = b.props.stateReducer(C, S({}, b, {
      changes: N
    }));
    return f;
  }, [t]), c = cn(s, n, r), d = c[0], _ = c[1], E = jt(n), x = W(function(C) {
    return _(S({
      props: E.current
    }, C));
  }, [E]), V = e.current;
  return te(function() {
    var C = ke(o.current, V == null ? void 0 : V.props), b = V && o.current && !i(C, d);
    b && Hn(V, C, d), o.current = d;
  }, [d, V, i]), [d, x];
}
var Oe = {
  itemToString: function(n) {
    return n ? String(n) : "";
  },
  itemToKey: function(n) {
    return n;
  },
  stateReducer: Kn,
  scrollIntoView: bt,
  environment: (
    /* istanbul ignore next (ssr) */
    typeof window > "u" ? void 0 : window
  )
};
function ie(t, n, r) {
  r === void 0 && (r = Ut);
  var i = t["default" + Ge(n)];
  return i !== void 0 ? i : r[n];
}
function be(t, n, r) {
  r === void 0 && (r = Ut);
  var i = t[n];
  if (i !== void 0)
    return i;
  var o = t["initial" + Ge(n)];
  return o !== void 0 ? o : ie(t, n, r);
}
function Un(t) {
  var n = be(t, "selectedItem"), r = be(t, "isOpen"), i = be(t, "highlightedIndex"), o = be(t, "inputValue");
  return {
    highlightedIndex: i < 0 && n && r ? t.items.findIndex(function(e) {
      return t.itemToKey(e) === t.itemToKey(n);
    }) : i,
    isOpen: r,
    selectedItem: n,
    inputValue: o
  };
}
function De(t, n, r) {
  var i = t.items, o = t.initialHighlightedIndex, e = t.defaultHighlightedIndex, s = t.itemToKey, c = n.selectedItem, d = n.highlightedIndex;
  return i.length === 0 ? -1 : o !== void 0 && d === o ? o : e !== void 0 ? e : c ? i.findIndex(function(_) {
    return s(c) === s(_);
  }) : r === 0 ? -1 : r < 0 ? i.length - 1 : 0;
}
function jn(t, n, r) {
  var i = G({
    isMouseDown: !1,
    isTouchMove: !1,
    isTouchEnd: !1
  });
  return te(function() {
    if (!t)
      return ee;
    var o = n.map(function(E) {
      return E.current;
    });
    function e() {
      i.current.isTouchEnd = !1, i.current.isMouseDown = !0;
    }
    function s(E) {
      i.current.isMouseDown = !1, Ae(E.target, o, t) || r();
    }
    function c() {
      i.current.isTouchEnd = !1, i.current.isTouchMove = !1;
    }
    function d() {
      i.current.isTouchMove = !0;
    }
    function _(E) {
      i.current.isTouchEnd = !0, !i.current.isTouchMove && !Ae(E.target, o, t, !1) && r();
    }
    return t.addEventListener("mousedown", e), t.addEventListener("mouseup", s), t.addEventListener("touchstart", c), t.addEventListener("touchmove", d), t.addEventListener("touchend", _), function() {
      t.removeEventListener("mousedown", e), t.removeEventListener("mouseup", s), t.removeEventListener("touchstart", c), t.removeEventListener("touchmove", d), t.removeEventListener("touchend", _);
    };
  }, [t, r]), i.current;
}
var Wt = function() {
  return ee;
};
process.env.NODE_ENV !== "production" && (Wt = function() {
  for (var n = G(!0), r = arguments.length, i = new Array(r), o = 0; o < r; o++)
    i[o] = arguments[o];
  var e = G(i.reduce(function(c, d) {
    return c[d] = {}, c;
  }, {}));
  te(function() {
    Object.keys(e.current).forEach(function(c) {
      var d = e.current[c];
      if (n.current && !Object.keys(d).length) {
        console.error("downshift: You forgot to call the " + c + " getter function on your component / element.");
        return;
      }
      var _ = d.suppressRefError, E = d.refKey, x = d.elementRef;
      (!x || !x.current) && !_ && console.error('downshift: The ref prop "' + E + '" from ' + c + " was not applied correctly on your element.");
    }), n.current = !1;
  });
  var s = W(function(c, d, _, E) {
    e.current[c] = {
      suppressRefError: d,
      refKey: _,
      elementRef: E
    };
  }, []);
  return s;
});
function Wn(t, n, r, i) {
  i === void 0 && (i = {});
  var o = i.document, e = $e();
  te(function() {
    if (!(!t || e || !o)) {
      var s = t(n);
      yt(s, o);
    }
  }, [r]), te(function() {
    return function() {
      yt.cancel(), Cn(o);
    };
  }, [o]);
}
function qn(t) {
  var n = t.highlightedIndex, r = t.isOpen, i = t.itemRefs, o = t.getItemNodeFromIndex, e = t.menuElement, s = t.scrollIntoView, c = G(!0);
  return $n(function() {
    n < 0 || !r || !Object.keys(i.current).length || (c.current === !1 ? c.current = !0 : s(o(n), e));
  }, [n]), c;
}
var qt = ee;
process.env.NODE_ENV !== "production" && (qt = function(n) {
  var r = n.props, i = n.state, o = G(r), e = $e();
  te(function() {
    e || (ze(i, o.current, r), o.current = r);
  }, [i, r, e]);
});
function wt(t, n, r) {
  var i;
  r === void 0 && (r = !0);
  var o = ((i = t.items) == null ? void 0 : i.length) && n >= 0;
  return S({
    isOpen: !1,
    highlightedIndex: -1
  }, o && S({
    selectedItem: t.items[n],
    isOpen: ie(t, "isOpen"),
    highlightedIndex: ie(t, "highlightedIndex")
  }, r && {
    inputValue: t.itemToString(t.items[n])
  }));
}
function Yn(t, n) {
  return t.isOpen === n.isOpen && t.inputValue === n.inputValue && t.highlightedIndex === n.highlightedIndex && t.selectedItem === n.selectedItem;
}
function $e() {
  var t = Te.useRef(!0);
  return Te.useEffect(function() {
    return t.current = !1, function() {
      t.current = !0;
    };
  }, []), t.current;
}
var Pe = {
  environment: p.shape({
    addEventListener: p.func.isRequired,
    removeEventListener: p.func.isRequired,
    document: p.shape({
      createElement: p.func.isRequired,
      getElementById: p.func.isRequired,
      activeElement: p.any.isRequired,
      body: p.any.isRequired
    }).isRequired,
    Node: p.func.isRequired
  }),
  itemToString: p.func,
  itemToKey: p.func,
  stateReducer: p.func
}, Yt = S({}, Pe, {
  getA11yStatusMessage: p.func,
  highlightedIndex: p.number,
  defaultHighlightedIndex: p.number,
  initialHighlightedIndex: p.number,
  isOpen: p.bool,
  defaultIsOpen: p.bool,
  initialIsOpen: p.bool,
  selectedItem: p.any,
  initialSelectedItem: p.any,
  defaultSelectedItem: p.any,
  id: p.string,
  labelId: p.string,
  menuId: p.string,
  getItemId: p.func,
  toggleButtonId: p.string,
  onSelectedItemChange: p.func,
  onHighlightedIndexChange: p.func,
  onStateChange: p.func,
  onIsOpenChange: p.func,
  scrollIntoView: p.func
});
function zn(t, n, r) {
  var i = n.type, o = n.props, e;
  switch (i) {
    case r.ItemMouseMove:
      e = {
        highlightedIndex: n.disabled ? -1 : n.index
      };
      break;
    case r.MenuMouseLeave:
      e = {
        highlightedIndex: -1
      };
      break;
    case r.ToggleButtonClick:
    case r.FunctionToggleMenu:
      e = {
        isOpen: !t.isOpen,
        highlightedIndex: t.isOpen ? -1 : De(o, t, 0)
      };
      break;
    case r.FunctionOpenMenu:
      e = {
        isOpen: !0,
        highlightedIndex: De(o, t, 0)
      };
      break;
    case r.FunctionCloseMenu:
      e = {
        isOpen: !1
      };
      break;
    case r.FunctionSetHighlightedIndex:
      e = {
        highlightedIndex: n.highlightedIndex
      };
      break;
    case r.FunctionSetInputValue:
      e = {
        inputValue: n.inputValue
      };
      break;
    case r.FunctionReset:
      e = {
        highlightedIndex: ie(o, "highlightedIndex"),
        isOpen: ie(o, "isOpen"),
        selectedItem: ie(o, "selectedItem"),
        inputValue: ie(o, "inputValue")
      };
      break;
    default:
      throw new Error("Reducer called without proper action type.");
  }
  return S({}, t, e);
}
Ee(Ee({}, Yt), { items: p.array.isRequired, isItemDisabled: p.func });
Ee(Ee({}, Oe), { isItemDisabled: function() {
  return !1;
} });
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
var Xe = process.env.NODE_ENV !== "production" ? "__input_keydown_arrow_down__" : 0, Ze = process.env.NODE_ENV !== "production" ? "__input_keydown_arrow_up__" : 1, Je = process.env.NODE_ENV !== "production" ? "__input_keydown_escape__" : 2, Qe = process.env.NODE_ENV !== "production" ? "__input_keydown_home__" : 3, et = process.env.NODE_ENV !== "production" ? "__input_keydown_end__" : 4, tt = process.env.NODE_ENV !== "production" ? "__input_keydown_page_up__" : 5, nt = process.env.NODE_ENV !== "production" ? "__input_keydown_page_down__" : 6, rt = process.env.NODE_ENV !== "production" ? "__input_keydown_enter__" : 7, ot = process.env.NODE_ENV !== "production" ? "__input_change__" : 8, Ke = process.env.NODE_ENV !== "production" ? "__input_blur__" : 9, it = process.env.NODE_ENV !== "production" ? "__input_click__" : 10, zt = process.env.NODE_ENV !== "production" ? "__menu_mouse_leave__" : 11, Gt = process.env.NODE_ENV !== "production" ? "__item_mouse_move__" : 12, ut = process.env.NODE_ENV !== "production" ? "__item_click__" : 13, Xt = process.env.NODE_ENV !== "production" ? "__togglebutton_click__" : 14, Zt = process.env.NODE_ENV !== "production" ? "__function_toggle_menu__" : 15, Jt = process.env.NODE_ENV !== "production" ? "__function_open_menu__" : 16, Qt = process.env.NODE_ENV !== "production" ? "__function_close_menu__" : 17, en = process.env.NODE_ENV !== "production" ? "__function_set_highlighted_index__" : 18, st = process.env.NODE_ENV !== "production" ? "__function_select_item__" : 19, tn = process.env.NODE_ENV !== "production" ? "__function_set_input_value__" : 20, nn = process.env.NODE_ENV !== "production" ? "__function_reset__" : 21, lt = process.env.NODE_ENV !== "production" ? "__controlled_prop_updated_selected_item__" : 22, rn = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  InputKeyDownArrowDown: Xe,
  InputKeyDownArrowUp: Ze,
  InputKeyDownEscape: Je,
  InputKeyDownHome: Qe,
  InputKeyDownEnd: et,
  InputKeyDownPageUp: tt,
  InputKeyDownPageDown: nt,
  InputKeyDownEnter: rt,
  InputChange: ot,
  InputBlur: Ke,
  InputClick: it,
  MenuMouseLeave: zt,
  ItemMouseMove: Gt,
  ItemClick: ut,
  ToggleButtonClick: Xt,
  FunctionToggleMenu: Zt,
  FunctionOpenMenu: Jt,
  FunctionCloseMenu: Qt,
  FunctionSetHighlightedIndex: en,
  FunctionSelectItem: st,
  FunctionSetInputValue: tn,
  FunctionReset: nn,
  ControlledPropUpdatedSelectedItem: lt
});
function Gn(t) {
  var n = Un(t), r = n.selectedItem, i = n.inputValue;
  return i === "" && r && t.defaultInputValue === void 0 && t.initialInputValue === void 0 && t.inputValue === void 0 && (i = t.itemToString(r)), S({}, n, {
    inputValue: i
  });
}
var Xn = S({}, Yt, {
  items: p.array.isRequired,
  isItemDisabled: p.func,
  inputValue: p.string,
  defaultInputValue: p.string,
  initialInputValue: p.string,
  inputId: p.string,
  onInputValueChange: p.func
});
function Zn(t, n, r, i) {
  var o = G(), e = Bn(t, n, r, i), s = e[0], c = e[1], d = $e();
  return te(function() {
    if (He(n, "selectedItem")) {
      if (!d) {
        var _ = n.itemToKey(n.selectedItem) !== n.itemToKey(o.current);
        _ && c({
          type: lt,
          inputValue: n.itemToString(n.selectedItem)
        });
      }
      o.current = s.selectedItem === o.current ? n.selectedItem : s.selectedItem;
    }
  }, [s.selectedItem, n.selectedItem]), [ke(s, n), c];
}
var on = ee;
process.env.NODE_ENV !== "production" && (on = function(n, r) {
  p.checkPropTypes(Xn, n, "prop", r.name);
});
var Jn = S({}, Oe, {
  isItemDisabled: function() {
    return !1;
  }
});
function Qn(t, n) {
  var r, i = n.type, o = n.props, e = n.altKey, s;
  switch (i) {
    case ut:
      s = {
        isOpen: ie(o, "isOpen"),
        highlightedIndex: ie(o, "highlightedIndex"),
        selectedItem: o.items[n.index],
        inputValue: o.itemToString(o.items[n.index])
      };
      break;
    case Xe:
      t.isOpen ? s = {
        highlightedIndex: _e(t.highlightedIndex, 1, o.items, o.isItemDisabled, !0)
      } : s = {
        highlightedIndex: e && t.selectedItem == null ? -1 : De(o, t, 1),
        isOpen: o.items.length >= 0
      };
      break;
    case Ze:
      t.isOpen ? e ? s = wt(o, t.highlightedIndex) : s = {
        highlightedIndex: _e(t.highlightedIndex, -1, o.items, o.isItemDisabled, !0)
      } : s = {
        highlightedIndex: De(o, t, -1),
        isOpen: o.items.length >= 0
      };
      break;
    case rt:
      s = wt(o, t.highlightedIndex);
      break;
    case Je:
      s = S({
        isOpen: !1,
        highlightedIndex: -1
      }, !t.isOpen && {
        selectedItem: null,
        inputValue: ""
      });
      break;
    case tt:
      s = {
        highlightedIndex: _e(t.highlightedIndex, -10, o.items, o.isItemDisabled, !0)
      };
      break;
    case nt:
      s = {
        highlightedIndex: _e(t.highlightedIndex, 10, o.items, o.isItemDisabled, !0)
      };
      break;
    case Qe:
      s = {
        highlightedIndex: ye(0, !1, o.items, o.isItemDisabled)
      };
      break;
    case et:
      s = {
        highlightedIndex: ye(o.items.length - 1, !0, o.items, o.isItemDisabled)
      };
      break;
    case Ke:
      s = S({
        isOpen: !1,
        highlightedIndex: -1
      }, t.highlightedIndex >= 0 && ((r = o.items) == null ? void 0 : r.length) && n.selectItem && {
        selectedItem: o.items[t.highlightedIndex],
        inputValue: o.itemToString(o.items[t.highlightedIndex])
      });
      break;
    case ot:
      s = {
        isOpen: !0,
        highlightedIndex: ie(o, "highlightedIndex"),
        inputValue: n.inputValue
      };
      break;
    case it:
      s = {
        isOpen: !t.isOpen,
        highlightedIndex: t.isOpen ? -1 : De(o, t, 0)
      };
      break;
    case st:
      s = {
        selectedItem: n.selectedItem,
        inputValue: o.itemToString(n.selectedItem)
      };
      break;
    case lt:
      s = {
        inputValue: n.inputValue
      };
      break;
    default:
      return zn(t, n, rn);
  }
  return S({}, t, s);
}
var er = ["onMouseLeave", "refKey", "ref"], tr = ["item", "index", "refKey", "ref", "onMouseMove", "onMouseDown", "onClick", "onPress", "disabled"], nr = ["onClick", "onPress", "refKey", "ref"], rr = ["onKeyDown", "onChange", "onInput", "onBlur", "onChangeText", "onClick", "refKey", "ref"];
at.stateChangeTypes = rn;
function at(t) {
  t === void 0 && (t = {}), on(t, at);
  var n = S({}, Jn, t), r = n.items, i = n.scrollIntoView, o = n.environment, e = n.getA11yStatusMessage, s = Zn(Qn, n, Gn, Yn), c = s[0], d = s[1], _ = c.isOpen, E = c.highlightedIndex, x = c.selectedItem, V = c.inputValue, C = G(null), b = G({}), N = G(null), f = G(null), B = $e(), u = Ln(n), a = G(), l = jt({
    state: c,
    props: n
  }), g = W(function(D) {
    return b.current[u.getItemId(D)];
  }, [u]);
  Wn(e, c, [_, E, x, V], o);
  var m = qn({
    menuElement: C.current,
    highlightedIndex: E,
    isOpen: _,
    itemRefs: b,
    scrollIntoView: i,
    getItemNodeFromIndex: g
  });
  qt({
    props: n,
    state: c
  }), te(function() {
    var D = be(n, "isOpen");
    D && N.current && N.current.focus();
  }, []), te(function() {
    B || (a.current = r.length);
  });
  var O = jn(o, [f, C, N], W(function() {
    l.current.state.isOpen && d({
      type: Ke,
      selectItem: !1
    });
  }, [d, l])), v = Wt("getInputProps", "getMenuProps");
  te(function() {
    _ || (b.current = {});
  }, [_]), te(function() {
    var D;
    !_ || !(o != null && o.document) || !(N != null && (D = N.current) != null && D.focus) || o.document.activeElement !== N.current && N.current.focus();
  }, [_, o]);
  var P = ln(function() {
    return {
      ArrowDown: function(y) {
        y.preventDefault(), d({
          type: Xe,
          altKey: y.altKey
        });
      },
      ArrowUp: function(y) {
        y.preventDefault(), d({
          type: Ze,
          altKey: y.altKey
        });
      },
      Home: function(y) {
        l.current.state.isOpen && (y.preventDefault(), d({
          type: Qe
        }));
      },
      End: function(y) {
        l.current.state.isOpen && (y.preventDefault(), d({
          type: et
        }));
      },
      Escape: function(y) {
        var w = l.current.state;
        (w.isOpen || w.inputValue || w.selectedItem || w.highlightedIndex > -1) && (y.preventDefault(), d({
          type: Je
        }));
      },
      Enter: function(y) {
        var w = l.current.state;
        !w.isOpen || y.which === 229 || (y.preventDefault(), d({
          type: rt
        }));
      },
      PageUp: function(y) {
        l.current.state.isOpen && (y.preventDefault(), d({
          type: tt
        }));
      },
      PageDown: function(y) {
        l.current.state.isOpen && (y.preventDefault(), d({
          type: nt
        }));
      }
    };
  }, [d, l]), M = W(function(D) {
    return S({
      id: u.labelId,
      htmlFor: u.inputId
    }, D);
  }, [u]), T = W(function(D, y) {
    var w, R = D === void 0 ? {} : D, X = R.onMouseLeave, Z = R.refKey, z = Z === void 0 ? "ref" : Z, j = R.ref, U = ce(R, er), J = y === void 0 ? {} : y, Y = J.suppressRefError, ne = Y === void 0 ? !1 : Y;
    return v("getMenuProps", ne, z, C), S((w = {}, w[z] = Ie(j, function(h) {
      C.current = h;
    }), w.id = u.menuId, w.role = "listbox", w["aria-labelledby"] = U && U["aria-label"] ? void 0 : "" + u.labelId, w.onMouseLeave = q(X, function() {
      d({
        type: zt
      });
    }), w), U);
  }, [d, v, u]), H = W(function(D) {
    var y, w, R = D === void 0 ? {} : D, X = R.item, Z = R.index, z = R.refKey, j = z === void 0 ? "ref" : z, U = R.ref, J = R.onMouseMove, Y = R.onMouseDown, ne = R.onClick;
    R.onPress;
    var h = R.disabled, oe = ce(R, tr);
    h !== void 0 && console.warn('Passing "disabled" as an argument to getItemProps is not supported anymore. Please use the isItemDisabled prop from useCombobox.');
    var Q = l.current, me = Q.props, le = Q.state, xe = Fn(X, Z, me.items, "Pass either item or index to getItemProps!"), Le = xe[0], ae = xe[1], we = me.isItemDisabled(Le, ae), Fe = "onClick", Ce = ne, fe = function() {
      O.isTouchEnd || ae === le.highlightedIndex || (m.current = !1, d({
        type: Gt,
        index: ae,
        disabled: we
      }));
    }, ve = function() {
      d({
        type: ut,
        index: ae
      });
    }, ge = function(un) {
      return un.preventDefault();
    };
    return S((y = {}, y[j] = Ie(U, function(re) {
      re && (b.current[u.getItemId(ae)] = re);
    }), y["aria-disabled"] = we, y["aria-selected"] = "" + (ae === le.highlightedIndex), y.id = u.getItemId(ae), y.role = "option", y), !we && (w = {}, w[Fe] = q(Ce, ve), w), {
      onMouseMove: q(J, fe),
      onMouseDown: q(Y, ge)
    }, oe);
  }, [d, u, l, O, m]), F = W(function(D) {
    var y, w = D === void 0 ? {} : D, R = w.onClick;
    w.onPress;
    var X = w.refKey, Z = X === void 0 ? "ref" : X, z = w.ref, j = ce(w, nr), U = l.current.state, J = function() {
      d({
        type: Xt
      });
    };
    return S((y = {}, y[Z] = Ie(z, function(Y) {
      f.current = Y;
    }), y["aria-controls"] = u.menuId, y["aria-expanded"] = U.isOpen, y.id = u.toggleButtonId, y.tabIndex = -1, y), !j.disabled && S({}, {
      onClick: q(R, J)
    }), j);
  }, [d, l, u]), $ = W(function(D, y) {
    var w, R = D === void 0 ? {} : D, X = R.onKeyDown, Z = R.onChange, z = R.onInput, j = R.onBlur;
    R.onChangeText;
    var U = R.onClick, J = R.refKey, Y = J === void 0 ? "ref" : J, ne = R.ref, h = ce(R, rr), oe = y === void 0 ? {} : y, Q = oe.suppressRefError, me = Q === void 0 ? !1 : Q;
    v("getInputProps", me, Y, N);
    var le = l.current.state, xe = function(ge) {
      var re = We(ge);
      re && P[re] && P[re](ge);
    }, Le = function(ge) {
      d({
        type: ot,
        inputValue: ge.target.value
      });
    }, ae = function(ge) {
      if (o != null && o.document && le.isOpen && !O.isMouseDown) {
        var re = ge.relatedTarget === null && o.document.activeElement !== o.document.body;
        d({
          type: Ke,
          selectItem: !re
        });
      }
    }, we = function() {
      d({
        type: it
      });
    }, Fe = "onChange", Ce = {};
    if (!h.disabled) {
      var fe;
      Ce = (fe = {}, fe[Fe] = q(Z, z, Le), fe.onKeyDown = q(X, xe), fe.onBlur = q(j, ae), fe.onClick = q(U, we), fe);
    }
    return S((w = {}, w[Y] = Ie(ne, function(ve) {
      N.current = ve;
    }), w["aria-activedescendant"] = le.isOpen && le.highlightedIndex > -1 ? u.getItemId(le.highlightedIndex) : "", w["aria-autocomplete"] = "list", w["aria-controls"] = u.menuId, w["aria-expanded"] = le.isOpen, w["aria-labelledby"] = h && h["aria-label"] ? void 0 : u.labelId, w.autoComplete = "off", w.id = u.inputId, w.role = "combobox", w.value = le.inputValue, w), Ce, h);
  }, [d, u, o, P, l, O, v]), I = W(function() {
    d({
      type: Zt
    });
  }, [d]), L = W(function() {
    d({
      type: Qt
    });
  }, [d]), k = W(function() {
    d({
      type: Jt
    });
  }, [d]), ue = W(function(D) {
    d({
      type: en,
      highlightedIndex: D
    });
  }, [d]), se = W(function(D) {
    d({
      type: st,
      selectedItem: D
    });
  }, [d]), pe = W(function(D) {
    d({
      type: tn,
      inputValue: D
    });
  }, [d]), he = W(function() {
    d({
      type: nn
    });
  }, [d]);
  return {
    // prop getters.
    getItemProps: H,
    getLabelProps: M,
    getMenuProps: T,
    getInputProps: $,
    getToggleButtonProps: F,
    // actions.
    toggleMenu: I,
    openMenu: k,
    closeMenu: L,
    setHighlightedIndex: ue,
    setInputValue: pe,
    selectItem: se,
    reset: he,
    // state.
    highlightedIndex: E,
    isOpen: _,
    selectedItem: x,
    inputValue: V
  };
}
Pe.stateReducer, Pe.itemToKey, Pe.environment, p.array, p.array, p.array, p.func, p.number, p.number, p.number, p.func, p.func, p.string, p.string;
Oe.itemToKey, Oe.stateReducer, Oe.environment;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
process.env.NODE_ENV;
const pr = ({
  chevronIcon: t,
  disabled: n,
  emptyResultMessage: r = "",
  errorMessage: i,
  icon: o = !1,
  isFullWidth: e = !1,
  label: s,
  list: c,
  listHeight: d = "xs",
  name: _,
  onSearch: E,
  onSelect: x,
  shouldClearValue: V = !1,
  value: C,
  variant: b = "prompt",
  ...N
}) => {
  const [f, B] = dt(c), [u, a] = dt(!1), l = W(() => {
    a(!1), B(c);
  }, [c]), g = function(I) {
    let L = "";
    return typeof I == "string" ? L = I : typeof I == "number" ? L = I.toString() : I instanceof Array ? I.forEach(function(k) {
      L += g(k);
    }) : fn(I) && (L += g(I.props.children)), L;
  }, {
    closeMenu: m,
    getInputProps: O,
    getItemProps: v,
    getMenuProps: P,
    getToggleButtonProps: M,
    isOpen: T,
    openMenu: H,
    setInputValue: F
  } = at({
    defaultSelectedItem: f.find((I) => I.value === C) ?? null,
    items: f,
    itemToString(I) {
      return I ? g(I.text) : "";
    },
    onInputValueChange({ inputValue: I }) {
      E == null || E(I ?? ""), u && B(
        c.filter(
          (L) => g(L.text).toLowerCase().includes((I == null ? void 0 : I.toLowerCase()) ?? "")
        )
      );
    },
    onIsOpenChange({ isOpen: I }) {
      !I && !r && l();
    },
    onSelectedItemChange({ selectedItem: I }) {
      x((I == null ? void 0 : I.value) ?? ""), m();
    }
  }), $ = W(() => {
    b === "prompt" && a(!0), T ? m() : H();
  }, [m, T, H, b]);
  return te(() => {
    var I;
    if (B(c), V && !c.some((L) => L.text === O().value)) {
      const L = C ? (I = c.find((k) => k.value && k.value === C)) == null ? void 0 : I.text : "";
      F(g(L) ?? "");
    }
  }, [c]), /* @__PURE__ */ sn(
    "div",
    {
      className: Ne("deriv-dropdown", {
        "deriv-dropdown--disabled": n,
        "deriv-dropdown--full": e
      }),
      ...M(),
      children: [
        /* @__PURE__ */ de("div", { className: "deriv-dropdown__content", children: /* @__PURE__ */ de(
          gn,
          {
            disabled: n,
            label: g(s),
            leftPlaceholder: o,
            message: T ? " " : i,
            name: _,
            onClickCapture: $,
            onKeyUp: () => a(!0),
            readOnly: b !== "prompt",
            rightPlaceholder: /* @__PURE__ */ de(
              "button",
              {
                className: "deriv-dropdown__button",
                "aria-expanded": T,
                children: t ?? /* @__PURE__ */ de(
                  hn,
                  {
                    className: Ne("deriv-dropdown__chevron", {
                      "deriv-dropdown__chevron--open": T,
                      "deriv-dropdown__chevron--disabled": n
                    }),
                    iconSize: "xs"
                  }
                )
              }
            ),
            type: "text",
            value: C,
            isFullWidth: e,
            error: !!i,
            ...O(),
            ...N
          }
        ) }),
        /* @__PURE__ */ de(
          "ul",
          {
            className: Ne(
              "deriv-dropdown__items",
              `deriv-dropdown__items--${d}`,
              {
                "deriv-dropdown__items--full": e
              }
            ),
            ...P(),
            children: T && (f.length ? f.map((I, L) => /* @__PURE__ */ de(
              "li",
              {
                className: Ne("deriv-dropdown__item", {
                  "deriv-dropdown__item--active": C === I.value
                }),
                onClick: () => l(),
                ...v({ index: L, item: I }),
                children: /* @__PURE__ */ de(
                  ct,
                  {
                    size: "sm",
                    weight: C === I.value ? "bold" : "normal",
                    children: I.text
                  }
                )
              },
              I.value
            )) : r && /* @__PURE__ */ de("li", { className: "deriv-dropdown__item", children: /* @__PURE__ */ de(ct, { size: "sm", children: r }) }))
          }
        )
      ]
    }
  );
};
export {
  pr as Dropdown
};
