import '../../assets/index27.css';
import { jsx as he } from "react/jsx-runtime";
import { a as je, g as ze } from "../../_commonjsHelpers-BkfeUUK-.js";
import Se from "react";
import Ye from "react-dom";
import { p as Me } from "../../index-CblbdqjE.js";
import { c as Ge } from "../../clsx-OuTLNxxd.js";
import { ModalHeader as Je } from "./ModalHeader.js";
import { ModalBody as Qe } from "./ModalBody.js";
import { ModalFooter as Xe } from "./ModalFooter.js";
var se = { exports: {} }, H = {}, ie = { exports: {} }, R = {}, ue = { exports: {} };
(function(t, e) {
  Object.defineProperty(e, "__esModule", {
    value: !0
  }), e.default = v;
  /*!
   * Adapted from jQuery UI core
   *
   * http://jqueryui.com
   *
   * Copyright 2014 jQuery Foundation and other contributors
   * Released under the MIT license.
   * http://jquery.org/license
   *
   * http://api.jqueryui.com/category/ui-core/
   */
  var o = "none", r = "contents", l = /input|select|textarea|button|object|iframe/;
  function d(c, p) {
    return p.getPropertyValue("overflow") !== "visible" || // if 'overflow: visible' set, check if there is actually any overflow
    c.scrollWidth <= 0 && c.scrollHeight <= 0;
  }
  function y(c) {
    var p = c.offsetWidth <= 0 && c.offsetHeight <= 0;
    if (p && !c.innerHTML) return !0;
    try {
      var h = window.getComputedStyle(c), C = h.getPropertyValue("display");
      return p ? C !== r && d(c, h) : C === o;
    } catch {
      return console.warn("Failed to inspect element style"), !1;
    }
  }
  function a(c) {
    for (var p = c, h = c.getRootNode && c.getRootNode(); p && p !== document.body; ) {
      if (h && p === h && (p = h.host.parentNode), y(p)) return !1;
      p = p.parentNode;
    }
    return !0;
  }
  function g(c, p) {
    var h = c.nodeName.toLowerCase(), C = l.test(h) && !c.disabled || h === "a" && c.href || p;
    return C && a(c);
  }
  function m(c) {
    var p = c.getAttribute("tabindex");
    p === null && (p = void 0);
    var h = isNaN(p);
    return (h || p >= 0) && g(c, !h);
  }
  function v(c) {
    var p = [].slice.call(c.querySelectorAll("*"), 0).reduce(function(h, C) {
      return h.concat(C.shadowRoot ? v(C.shadowRoot) : [C]);
    }, []);
    return p.filter(m);
  }
  t.exports = e.default;
})(ue, ue.exports);
var Ne = ue.exports;
Object.defineProperty(R, "__esModule", {
  value: !0
});
R.resetState = nt;
R.log = ot;
R.handleBlur = j;
R.handleFocus = z;
R.markForFocusLater = rt;
R.returnFocus = at;
R.popWithoutFocus = lt;
R.setupScopedFocus = st;
R.teardownScopedFocus = it;
var Ze = Ne, et = tt(Ze);
function tt(t) {
  return t && t.__esModule ? t : { default: t };
}
var I = [], k = null, fe = !1;
function nt() {
  I = [];
}
function ot() {
  process.env.NODE_ENV !== "production" && (console.log("focusManager ----------"), I.forEach(function(t) {
    var e = t || {};
    console.log(e.nodeName, e.className, e.id);
  }), console.log("end focusManager ----------"));
}
function j() {
  fe = !0;
}
function z() {
  if (fe) {
    if (fe = !1, !k)
      return;
    setTimeout(function() {
      if (!k.contains(document.activeElement)) {
        var t = (0, et.default)(k)[0] || k;
        t.focus();
      }
    }, 0);
  }
}
function rt() {
  I.push(document.activeElement);
}
function at() {
  var t = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : !1, e = null;
  try {
    I.length !== 0 && (e = I.pop(), e.focus({ preventScroll: t }));
    return;
  } catch {
    console.warn(["You tried to return focus to", e, "but it is not in the DOM anymore"].join(" "));
  }
}
function lt() {
  I.length > 0 && I.pop();
}
function st(t) {
  k = t, window.addEventListener ? (window.addEventListener("blur", j, !1), document.addEventListener("focus", z, !0)) : (window.attachEvent("onBlur", j), document.attachEvent("onFocus", z));
}
function it() {
  k = null, window.addEventListener ? (window.removeEventListener("blur", j), document.removeEventListener("focus", z)) : (window.detachEvent("onBlur", j), document.detachEvent("onFocus", z));
}
var ce = { exports: {} };
(function(t, e) {
  Object.defineProperty(e, "__esModule", {
    value: !0
  }), e.default = y;
  var o = Ne, r = l(o);
  function l(a) {
    return a && a.__esModule ? a : { default: a };
  }
  function d() {
    var a = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : document;
    return a.activeElement.shadowRoot ? d(a.activeElement.shadowRoot) : a.activeElement;
  }
  function y(a, g) {
    var m = (0, r.default)(a);
    if (!m.length) {
      g.preventDefault();
      return;
    }
    var v = void 0, c = g.shiftKey, p = m[0], h = m[m.length - 1], C = d();
    if (a === C) {
      if (!c) return;
      v = h;
    }
    if (h === C && !c && (v = p), p === C && c && (v = h), v) {
      g.preventDefault(), v.focus();
      return;
    }
    var D = /(\bChrome\b|\bSafari\b)\//.exec(navigator.userAgent), K = D != null && D[1] != "Chrome" && /\biPod\b|\biPad\b/g.exec(navigator.userAgent) == null;
    if (K) {
      var q = m.indexOf(C);
      if (q > -1 && (q += c ? -1 : 1), v = m[q], typeof v > "u") {
        g.preventDefault(), v = c ? h : p, v.focus();
        return;
      }
      g.preventDefault(), v.focus();
    }
  }
  t.exports = e.default;
})(ce, ce.exports);
var ut = ce.exports, T = {}, ft = process.env.NODE_ENV !== "production", Re = function() {
};
if (ft) {
  var ct = function(e, o) {
    var r = arguments.length;
    o = new Array(r > 1 ? r - 1 : 0);
    for (var l = 1; l < r; l++)
      o[l - 1] = arguments[l];
    var d = 0, y = "Warning: " + e.replace(/%s/g, function() {
      return o[d++];
    });
    typeof console < "u" && console.error(y);
    try {
      throw new Error(y);
    } catch {
    }
  };
  Re = function(t, e, o) {
    var r = arguments.length;
    o = new Array(r > 2 ? r - 2 : 0);
    for (var l = 2; l < r; l++)
      o[l - 2] = arguments[l];
    if (e === void 0)
      throw new Error(
        "`warning(condition, format, ...args)` requires a warning message argument"
      );
    t || ct.apply(null, [e].concat(o));
  };
}
var dt = Re, N = {}, Te = { exports: {} };
/*!
  Copyright (c) 2015 Jed Watson.
  Based on code that is Copyright 2013-2015, Facebook, Inc.
  All rights reserved.
*/
(function(t) {
  (function() {
    var e = !!(typeof window < "u" && window.document && window.document.createElement), o = {
      canUseDOM: e,
      canUseWorkers: typeof Worker < "u",
      canUseEventListeners: e && !!(window.addEventListener || window.attachEvent),
      canUseViewport: e && !!window.screen
    };
    t.exports ? t.exports = o : window.ExecutionEnvironment = o;
  })();
})(Te);
var pt = Te.exports;
Object.defineProperty(N, "__esModule", {
  value: !0
});
N.canUseDOM = N.SafeNodeList = N.SafeHTMLCollection = void 0;
var mt = pt, vt = ht(mt);
function ht(t) {
  return t && t.__esModule ? t : { default: t };
}
var ne = vt.default, yt = ne.canUseDOM ? window.HTMLElement : {};
N.SafeHTMLCollection = ne.canUseDOM ? window.HTMLCollection : {};
N.SafeNodeList = ne.canUseDOM ? window.NodeList : {};
N.canUseDOM = ne.canUseDOM;
N.default = yt;
Object.defineProperty(T, "__esModule", {
  value: !0
});
T.resetState = Et;
T.log = Ct;
T.assertNodeList = De;
T.setElement = wt;
T.validateElement = pe;
T.hide = St;
T.show = Mt;
T.documentNotReadyOrSSRTesting = Nt;
var bt = dt, gt = _t(bt), Ot = N;
function _t(t) {
  return t && t.__esModule ? t : { default: t };
}
var S = null;
function Et() {
  S && (S.removeAttribute ? S.removeAttribute("aria-hidden") : S.length != null ? S.forEach(function(t) {
    return t.removeAttribute("aria-hidden");
  }) : document.querySelectorAll(S).forEach(function(t) {
    return t.removeAttribute("aria-hidden");
  })), S = null;
}
function Ct() {
  if (process.env.NODE_ENV !== "production") {
    var t = S || {};
    console.log("ariaAppHider ----------"), console.log(t.nodeName, t.className, t.id), console.log("end ariaAppHider ----------");
  }
}
function De(t, e) {
  if (!t || !t.length)
    throw new Error("react-modal: No elements were found for selector " + e + ".");
}
function wt(t) {
  var e = t;
  if (typeof e == "string" && Ot.canUseDOM) {
    var o = document.querySelectorAll(e);
    De(o, e), e = o;
  }
  return S = e || S, S;
}
function pe(t) {
  var e = t || S;
  return e ? Array.isArray(e) || e instanceof HTMLCollection || e instanceof NodeList ? e : [e] : ((0, gt.default)(!1, ["react-modal: App element is not defined.", "Please use `Modal.setAppElement(el)` or set `appElement={el}`.", "This is needed so screen readers don't see main content", "when modal is opened. It is not recommended, but you can opt-out", "by setting `ariaHideApp={false}`."].join(" ")), []);
}
function St(t) {
  var e = !0, o = !1, r = void 0;
  try {
    for (var l = pe(t)[Symbol.iterator](), d; !(e = (d = l.next()).done); e = !0) {
      var y = d.value;
      y.setAttribute("aria-hidden", "true");
    }
  } catch (a) {
    o = !0, r = a;
  } finally {
    try {
      !e && l.return && l.return();
    } finally {
      if (o)
        throw r;
    }
  }
}
function Mt(t) {
  var e = !0, o = !1, r = void 0;
  try {
    for (var l = pe(t)[Symbol.iterator](), d; !(e = (d = l.next()).done); e = !0) {
      var y = d.value;
      y.removeAttribute("aria-hidden");
    }
  } catch (a) {
    o = !0, r = a;
  } finally {
    try {
      !e && l.return && l.return();
    } finally {
      if (o)
        throw r;
    }
  }
}
function Nt() {
  S = null;
}
var $ = {};
Object.defineProperty($, "__esModule", {
  value: !0
});
$.resetState = Rt;
$.log = Tt;
var L = {}, U = {};
function ye(t, e) {
  t.classList.remove(e);
}
function Rt() {
  var t = document.getElementsByTagName("html")[0];
  for (var e in L)
    ye(t, L[e]);
  var o = document.body;
  for (var r in U)
    ye(o, U[r]);
  L = {}, U = {};
}
function Tt() {
  if (process.env.NODE_ENV !== "production") {
    var t = document.getElementsByTagName("html")[0].className, e = `Show tracked classes:

`;
    e += "<html /> (" + t + `):
  `;
    for (var o in L)
      e += "  " + o + " " + L[o] + `
  `;
    t = document.body.className, e += `

doc.body (` + t + `):
  `;
    for (var r in U)
      e += "  " + r + " " + U[r] + `
  `;
    e += `
`, console.log(e);
  }
}
var Dt = function(e, o) {
  return e[o] || (e[o] = 0), e[o] += 1, o;
}, At = function(e, o) {
  return e[o] && (e[o] -= 1), o;
}, Pt = function(e, o, r) {
  r.forEach(function(l) {
    Dt(o, l), e.add(l);
  });
}, xt = function(e, o, r) {
  r.forEach(function(l) {
    At(o, l), o[l] === 0 && e.remove(l);
  });
};
$.add = function(e, o) {
  return Pt(e.classList, e.nodeName.toLowerCase() == "html" ? L : U, o.split(" "));
};
$.remove = function(e, o) {
  return xt(e.classList, e.nodeName.toLowerCase() == "html" ? L : U, o.split(" "));
};
var B = {};
Object.defineProperty(B, "__esModule", {
  value: !0
});
B.log = Lt;
B.resetState = Ut;
function Ft(t, e) {
  if (!(t instanceof e))
    throw new TypeError("Cannot call a class as a function");
}
var Ae = function t() {
  var e = this;
  Ft(this, t), this.register = function(o) {
    if (e.openInstances.indexOf(o) !== -1) {
      process.env.NODE_ENV !== "production" && console.warn("React-Modal: Cannot register modal instance that's already open");
      return;
    }
    e.openInstances.push(o), e.emit("register");
  }, this.deregister = function(o) {
    var r = e.openInstances.indexOf(o);
    if (r === -1) {
      process.env.NODE_ENV !== "production" && console.warn("React-Modal: Unable to deregister " + o + " as it was never registered");
      return;
    }
    e.openInstances.splice(r, 1), e.emit("deregister");
  }, this.subscribe = function(o) {
    e.subscribers.push(o);
  }, this.emit = function(o) {
    e.subscribers.forEach(function(r) {
      return r(
        o,
        // shallow copy to avoid accidental mutation
        e.openInstances.slice()
      );
    });
  }, this.openInstances = [], this.subscribers = [];
}, Z = new Ae();
function Lt() {
  console.log("portalOpenInstances ----------"), console.log(Z.openInstances.length), Z.openInstances.forEach(function(t) {
    return console.log(t);
  }), console.log("end portalOpenInstances ----------");
}
function Ut() {
  Z = new Ae();
}
B.default = Z;
var me = {};
Object.defineProperty(me, "__esModule", {
  value: !0
});
me.resetState = qt;
me.log = kt;
var Wt = B, Ht = It(Wt);
function It(t) {
  return t && t.__esModule ? t : { default: t };
}
var E = void 0, M = void 0, W = [];
function qt() {
  for (var t = [E, M], e = 0; e < t.length; e++) {
    var o = t[e];
    o && o.parentNode && o.parentNode.removeChild(o);
  }
  E = M = null, W = [];
}
function kt() {
  console.log("bodyTrap ----------"), console.log(W.length);
  for (var t = [E, M], e = 0; e < t.length; e++) {
    var o = t[e], r = o || {};
    console.log(r.nodeName, r.className, r.id);
  }
  console.log("edn bodyTrap ----------");
}
function be() {
  if (W.length === 0) {
    process.env.NODE_ENV !== "production" && console.warn("React-Modal: Open instances > 0 expected");
    return;
  }
  W[W.length - 1].focusContent();
}
function $t(t, e) {
  !E && !M && (E = document.createElement("div"), E.setAttribute("data-react-modal-body-trap", ""), E.style.position = "absolute", E.style.opacity = "0", E.setAttribute("tabindex", "0"), E.addEventListener("focus", be), M = E.cloneNode(), M.addEventListener("focus", be)), W = e, W.length > 0 ? (document.body.firstChild !== E && document.body.insertBefore(E, document.body.firstChild), document.body.lastChild !== M && document.body.appendChild(M)) : (E.parentElement && E.parentElement.removeChild(E), M.parentElement && M.parentElement.removeChild(M));
}
Ht.default.subscribe($t);
(function(t, e) {
  Object.defineProperty(e, "__esModule", {
    value: !0
  });
  var o = Object.assign || function(f) {
    for (var u = 1; u < arguments.length; u++) {
      var b = arguments[u];
      for (var n in b)
        Object.prototype.hasOwnProperty.call(b, n) && (f[n] = b[n]);
    }
    return f;
  }, r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(f) {
    return typeof f;
  } : function(f) {
    return f && typeof Symbol == "function" && f.constructor === Symbol && f !== Symbol.prototype ? "symbol" : typeof f;
  }, l = /* @__PURE__ */ function() {
    function f(u, b) {
      for (var n = 0; n < b.length; n++) {
        var s = b[n];
        s.enumerable = s.enumerable || !1, s.configurable = !0, "value" in s && (s.writable = !0), Object.defineProperty(u, s.key, s);
      }
    }
    return function(u, b, n) {
      return b && f(u.prototype, b), n && f(u, n), u;
    };
  }(), d = Se, y = Me, a = G(y), g = R, m = re(g), v = ut, c = G(v), p = T, h = re(p), C = $, D = re(C), K = N, q = G(K), We = B, ve = G(We);
  function re(f) {
    if (f && f.__esModule)
      return f;
    var u = {};
    if (f != null)
      for (var b in f)
        Object.prototype.hasOwnProperty.call(f, b) && (u[b] = f[b]);
    return u.default = f, u;
  }
  function G(f) {
    return f && f.__esModule ? f : { default: f };
  }
  function He(f, u) {
    if (!(f instanceof u))
      throw new TypeError("Cannot call a class as a function");
  }
  function Ie(f, u) {
    if (!f)
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return u && (typeof u == "object" || typeof u == "function") ? u : f;
  }
  function qe(f, u) {
    if (typeof u != "function" && u !== null)
      throw new TypeError("Super expression must either be null or a function, not " + typeof u);
    f.prototype = Object.create(u && u.prototype, { constructor: { value: f, enumerable: !1, writable: !0, configurable: !0 } }), u && (Object.setPrototypeOf ? Object.setPrototypeOf(f, u) : f.__proto__ = u);
  }
  var ae = {
    overlay: "ReactModal__Overlay",
    content: "ReactModal__Content"
  }, ke = function(u) {
    return u.code === "Tab" || u.keyCode === 9;
  }, $e = function(u) {
    return u.code === "Escape" || u.keyCode === 27;
  }, J = 0, le = function(f) {
    qe(u, f);
    function u(b) {
      He(this, u);
      var n = Ie(this, (u.__proto__ || Object.getPrototypeOf(u)).call(this, b));
      return n.setOverlayRef = function(s) {
        n.overlay = s, n.props.overlayRef && n.props.overlayRef(s);
      }, n.setContentRef = function(s) {
        n.content = s, n.props.contentRef && n.props.contentRef(s);
      }, n.afterClose = function() {
        var s = n.props, _ = s.appElement, w = s.ariaHideApp, O = s.htmlOpenClassName, P = s.bodyOpenClassName, x = s.parentSelector, Q = x && x().ownerDocument || document;
        P && D.remove(Q.body, P), O && D.remove(Q.getElementsByTagName("html")[0], O), w && J > 0 && (J -= 1, J === 0 && h.show(_)), n.props.shouldFocusAfterRender && (n.props.shouldReturnFocusAfterClose ? (m.returnFocus(n.props.preventScroll), m.teardownScopedFocus()) : m.popWithoutFocus()), n.props.onAfterClose && n.props.onAfterClose(), ve.default.deregister(n);
      }, n.open = function() {
        n.beforeOpen(), n.state.afterOpen && n.state.beforeClose ? (clearTimeout(n.closeTimer), n.setState({ beforeClose: !1 })) : (n.props.shouldFocusAfterRender && (m.setupScopedFocus(n.node), m.markForFocusLater()), n.setState({ isOpen: !0 }, function() {
          n.openAnimationFrame = requestAnimationFrame(function() {
            n.setState({ afterOpen: !0 }), n.props.isOpen && n.props.onAfterOpen && n.props.onAfterOpen({
              overlayEl: n.overlay,
              contentEl: n.content
            });
          });
        }));
      }, n.close = function() {
        n.props.closeTimeoutMS > 0 ? n.closeWithTimeout() : n.closeWithoutTimeout();
      }, n.focusContent = function() {
        return n.content && !n.contentHasFocus() && n.content.focus({ preventScroll: !0 });
      }, n.closeWithTimeout = function() {
        var s = Date.now() + n.props.closeTimeoutMS;
        n.setState({ beforeClose: !0, closesAt: s }, function() {
          n.closeTimer = setTimeout(n.closeWithoutTimeout, n.state.closesAt - Date.now());
        });
      }, n.closeWithoutTimeout = function() {
        n.setState({
          beforeClose: !1,
          isOpen: !1,
          afterOpen: !1,
          closesAt: null
        }, n.afterClose);
      }, n.handleKeyDown = function(s) {
        ke(s) && (0, c.default)(n.content, s), n.props.shouldCloseOnEsc && $e(s) && (s.stopPropagation(), n.requestClose(s));
      }, n.handleOverlayOnClick = function(s) {
        n.shouldClose === null && (n.shouldClose = !0), n.shouldClose && n.props.shouldCloseOnOverlayClick && (n.ownerHandlesClose() ? n.requestClose(s) : n.focusContent()), n.shouldClose = null;
      }, n.handleContentOnMouseUp = function() {
        n.shouldClose = !1;
      }, n.handleOverlayOnMouseDown = function(s) {
        !n.props.shouldCloseOnOverlayClick && s.target == n.overlay && s.preventDefault();
      }, n.handleContentOnClick = function() {
        n.shouldClose = !1;
      }, n.handleContentOnMouseDown = function() {
        n.shouldClose = !1;
      }, n.requestClose = function(s) {
        return n.ownerHandlesClose() && n.props.onRequestClose(s);
      }, n.ownerHandlesClose = function() {
        return n.props.onRequestClose;
      }, n.shouldBeClosed = function() {
        return !n.state.isOpen && !n.state.beforeClose;
      }, n.contentHasFocus = function() {
        return document.activeElement === n.content || n.content.contains(document.activeElement);
      }, n.buildClassName = function(s, _) {
        var w = (typeof _ > "u" ? "undefined" : r(_)) === "object" ? _ : {
          base: ae[s],
          afterOpen: ae[s] + "--after-open",
          beforeClose: ae[s] + "--before-close"
        }, O = w.base;
        return n.state.afterOpen && (O = O + " " + w.afterOpen), n.state.beforeClose && (O = O + " " + w.beforeClose), typeof _ == "string" && _ ? O + " " + _ : O;
      }, n.attributesFromObject = function(s, _) {
        return Object.keys(_).reduce(function(w, O) {
          return w[s + "-" + O] = _[O], w;
        }, {});
      }, n.state = {
        afterOpen: !1,
        beforeClose: !1
      }, n.shouldClose = null, n.moveFromContentToOverlay = null, n;
    }
    return l(u, [{
      key: "componentDidMount",
      value: function() {
        this.props.isOpen && this.open();
      }
    }, {
      key: "componentDidUpdate",
      value: function(n, s) {
        process.env.NODE_ENV !== "production" && (n.bodyOpenClassName !== this.props.bodyOpenClassName && console.warn('React-Modal: "bodyOpenClassName" prop has been modified. This may cause unexpected behavior when multiple modals are open.'), n.htmlOpenClassName !== this.props.htmlOpenClassName && console.warn('React-Modal: "htmlOpenClassName" prop has been modified. This may cause unexpected behavior when multiple modals are open.')), this.props.isOpen && !n.isOpen ? this.open() : !this.props.isOpen && n.isOpen && this.close(), this.props.shouldFocusAfterRender && this.state.isOpen && !s.isOpen && this.focusContent();
      }
    }, {
      key: "componentWillUnmount",
      value: function() {
        this.state.isOpen && this.afterClose(), clearTimeout(this.closeTimer), cancelAnimationFrame(this.openAnimationFrame);
      }
    }, {
      key: "beforeOpen",
      value: function() {
        var n = this.props, s = n.appElement, _ = n.ariaHideApp, w = n.htmlOpenClassName, O = n.bodyOpenClassName, P = n.parentSelector, x = P && P().ownerDocument || document;
        O && D.add(x.body, O), w && D.add(x.getElementsByTagName("html")[0], w), _ && (J += 1, h.hide(s)), ve.default.register(this);
      }
      // Don't steal focus from inner elements
    }, {
      key: "render",
      value: function() {
        var n = this.props, s = n.id, _ = n.className, w = n.overlayClassName, O = n.defaultStyles, P = n.children, x = _ ? {} : O.content, Q = w ? {} : O.overlay;
        if (this.shouldBeClosed())
          return null;
        var Be = {
          ref: this.setOverlayRef,
          className: this.buildClassName("overlay", w),
          style: o({}, Q, this.props.style.overlay),
          onClick: this.handleOverlayOnClick,
          onMouseDown: this.handleOverlayOnMouseDown
        }, Ve = o({
          id: s,
          ref: this.setContentRef,
          style: o({}, x, this.props.style.content),
          className: this.buildClassName("content", _),
          tabIndex: "-1",
          onKeyDown: this.handleKeyDown,
          onMouseDown: this.handleContentOnMouseDown,
          onMouseUp: this.handleContentOnMouseUp,
          onClick: this.handleContentOnClick,
          role: this.props.role,
          "aria-label": this.props.contentLabel
        }, this.attributesFromObject("aria", o({ modal: !0 }, this.props.aria)), this.attributesFromObject("data", this.props.data || {}), {
          "data-testid": this.props.testId
        }), Ke = this.props.contentElement(Ve, P);
        return this.props.overlayElement(Be, Ke);
      }
    }]), u;
  }(d.Component);
  le.defaultProps = {
    style: {
      overlay: {},
      content: {}
    },
    defaultStyles: {}
  }, le.propTypes = {
    isOpen: a.default.bool.isRequired,
    defaultStyles: a.default.shape({
      content: a.default.object,
      overlay: a.default.object
    }),
    style: a.default.shape({
      content: a.default.object,
      overlay: a.default.object
    }),
    className: a.default.oneOfType([a.default.string, a.default.object]),
    overlayClassName: a.default.oneOfType([a.default.string, a.default.object]),
    parentSelector: a.default.func,
    bodyOpenClassName: a.default.string,
    htmlOpenClassName: a.default.string,
    ariaHideApp: a.default.bool,
    appElement: a.default.oneOfType([a.default.instanceOf(q.default), a.default.instanceOf(K.SafeHTMLCollection), a.default.instanceOf(K.SafeNodeList), a.default.arrayOf(a.default.instanceOf(q.default))]),
    onAfterOpen: a.default.func,
    onAfterClose: a.default.func,
    onRequestClose: a.default.func,
    closeTimeoutMS: a.default.number,
    shouldFocusAfterRender: a.default.bool,
    shouldCloseOnOverlayClick: a.default.bool,
    shouldReturnFocusAfterClose: a.default.bool,
    preventScroll: a.default.bool,
    role: a.default.string,
    contentLabel: a.default.string,
    aria: a.default.object,
    data: a.default.object,
    children: a.default.node,
    shouldCloseOnEsc: a.default.bool,
    overlayRef: a.default.func,
    contentRef: a.default.func,
    id: a.default.string,
    overlayElement: a.default.func,
    contentElement: a.default.func,
    testId: a.default.string
  }, e.default = le, t.exports = e.default;
})(ie, ie.exports);
var Bt = ie.exports;
function Pe() {
  var t = this.constructor.getDerivedStateFromProps(this.props, this.state);
  t != null && this.setState(t);
}
function xe(t) {
  function e(o) {
    var r = this.constructor.getDerivedStateFromProps(t, o);
    return r ?? null;
  }
  this.setState(e.bind(this));
}
function Fe(t, e) {
  try {
    var o = this.props, r = this.state;
    this.props = t, this.state = e, this.__reactInternalSnapshotFlag = !0, this.__reactInternalSnapshot = this.getSnapshotBeforeUpdate(
      o,
      r
    );
  } finally {
    this.props = o, this.state = r;
  }
}
Pe.__suppressDeprecationWarning = !0;
xe.__suppressDeprecationWarning = !0;
Fe.__suppressDeprecationWarning = !0;
function Vt(t) {
  var e = t.prototype;
  if (!e || !e.isReactComponent)
    throw new Error("Can only polyfill class components");
  if (typeof t.getDerivedStateFromProps != "function" && typeof e.getSnapshotBeforeUpdate != "function")
    return t;
  var o = null, r = null, l = null;
  if (typeof e.componentWillMount == "function" ? o = "componentWillMount" : typeof e.UNSAFE_componentWillMount == "function" && (o = "UNSAFE_componentWillMount"), typeof e.componentWillReceiveProps == "function" ? r = "componentWillReceiveProps" : typeof e.UNSAFE_componentWillReceiveProps == "function" && (r = "UNSAFE_componentWillReceiveProps"), typeof e.componentWillUpdate == "function" ? l = "componentWillUpdate" : typeof e.UNSAFE_componentWillUpdate == "function" && (l = "UNSAFE_componentWillUpdate"), o !== null || r !== null || l !== null) {
    var d = t.displayName || t.name, y = typeof t.getDerivedStateFromProps == "function" ? "getDerivedStateFromProps()" : "getSnapshotBeforeUpdate()";
    throw Error(
      `Unsafe legacy lifecycles will not be called for components using new component APIs.

` + d + " uses " + y + " but also contains the following legacy lifecycles:" + (o !== null ? `
  ` + o : "") + (r !== null ? `
  ` + r : "") + (l !== null ? `
  ` + l : "") + `

The above lifecycles should be removed. Learn more about this warning here:
https://fb.me/react-async-component-lifecycle-hooks`
    );
  }
  if (typeof t.getDerivedStateFromProps == "function" && (e.componentWillMount = Pe, e.componentWillReceiveProps = xe), typeof e.getSnapshotBeforeUpdate == "function") {
    if (typeof e.componentDidUpdate != "function")
      throw new Error(
        "Cannot polyfill getSnapshotBeforeUpdate() for components that do not define componentDidUpdate() on the prototype"
      );
    e.componentWillUpdate = Fe;
    var a = e.componentDidUpdate;
    e.componentDidUpdate = function(m, v, c) {
      var p = this.__reactInternalSnapshotFlag ? this.__reactInternalSnapshot : c;
      a.call(this, m, v, p);
    };
  }
  return t;
}
const Kt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  polyfill: Vt
}, Symbol.toStringTag, { value: "Module" })), jt = /* @__PURE__ */ je(Kt);
Object.defineProperty(H, "__esModule", {
  value: !0
});
H.bodyOpenClassName = H.portalClassName = void 0;
var ge = Object.assign || function(t) {
  for (var e = 1; e < arguments.length; e++) {
    var o = arguments[e];
    for (var r in o)
      Object.prototype.hasOwnProperty.call(o, r) && (t[r] = o[r]);
  }
  return t;
}, zt = /* @__PURE__ */ function() {
  function t(e, o) {
    for (var r = 0; r < o.length; r++) {
      var l = o[r];
      l.enumerable = l.enumerable || !1, l.configurable = !0, "value" in l && (l.writable = !0), Object.defineProperty(e, l.key, l);
    }
  }
  return function(e, o, r) {
    return o && t(e.prototype, o), r && t(e, r), e;
  };
}(), Le = Se, ee = Y(Le), Yt = Ye, te = Y(Yt), Gt = Me, i = Y(Gt), Jt = Bt, Oe = Y(Jt), Qt = T, Xt = en(Qt), A = N, _e = Y(A), Zt = jt;
function en(t) {
  if (t && t.__esModule)
    return t;
  var e = {};
  if (t != null)
    for (var o in t)
      Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
  return e.default = t, e;
}
function Y(t) {
  return t && t.__esModule ? t : { default: t };
}
function tn(t, e) {
  if (!(t instanceof e))
    throw new TypeError("Cannot call a class as a function");
}
function Ee(t, e) {
  if (!t)
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e && (typeof e == "object" || typeof e == "function") ? e : t;
}
function nn(t, e) {
  if (typeof e != "function" && e !== null)
    throw new TypeError("Super expression must either be null or a function, not " + typeof e);
  t.prototype = Object.create(e && e.prototype, { constructor: { value: t, enumerable: !1, writable: !0, configurable: !0 } }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(t, e) : t.__proto__ = e);
}
var on = H.portalClassName = "ReactModalPortal", rn = H.bodyOpenClassName = "ReactModal__Body--open", F = A.canUseDOM && te.default.createPortal !== void 0, de = function(e) {
  return document.createElement(e);
}, Ce = function() {
  return F ? te.default.createPortal : te.default.unstable_renderSubtreeIntoContainer;
};
function X(t) {
  return t();
}
var V = function(t) {
  nn(e, t);
  function e() {
    var o, r, l, d;
    tn(this, e);
    for (var y = arguments.length, a = Array(y), g = 0; g < y; g++)
      a[g] = arguments[g];
    return d = (r = (l = Ee(this, (o = e.__proto__ || Object.getPrototypeOf(e)).call.apply(o, [this].concat(a))), l), l.removePortal = function() {
      !F && te.default.unmountComponentAtNode(l.node);
      var m = X(l.props.parentSelector);
      m && m.contains(l.node) ? m.removeChild(l.node) : console.warn('React-Modal: "parentSelector" prop did not returned any DOM element. Make sure that the parent element is unmounted to avoid any memory leaks.');
    }, l.portalRef = function(m) {
      l.portal = m;
    }, l.renderPortal = function(m) {
      var v = Ce(), c = v(l, ee.default.createElement(Oe.default, ge({ defaultStyles: e.defaultStyles }, m)), l.node);
      l.portalRef(c);
    }, r), Ee(l, d);
  }
  return zt(e, [{
    key: "componentDidMount",
    value: function() {
      if (A.canUseDOM) {
        F || (this.node = de("div")), this.node.className = this.props.portalClassName;
        var r = X(this.props.parentSelector);
        r.appendChild(this.node), !F && this.renderPortal(this.props);
      }
    }
  }, {
    key: "getSnapshotBeforeUpdate",
    value: function(r) {
      var l = X(r.parentSelector), d = X(this.props.parentSelector);
      return { prevParent: l, nextParent: d };
    }
  }, {
    key: "componentDidUpdate",
    value: function(r, l, d) {
      if (A.canUseDOM) {
        var y = this.props, a = y.isOpen, g = y.portalClassName;
        r.portalClassName !== g && (this.node.className = g);
        var m = d.prevParent, v = d.nextParent;
        v !== m && (m.removeChild(this.node), v.appendChild(this.node)), !(!r.isOpen && !a) && !F && this.renderPortal(this.props);
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function() {
      if (!(!A.canUseDOM || !this.node || !this.portal)) {
        var r = this.portal.state, l = Date.now(), d = r.isOpen && this.props.closeTimeoutMS && (r.closesAt || l + this.props.closeTimeoutMS);
        d ? (r.beforeClose || this.portal.closeWithTimeout(), setTimeout(this.removePortal, d - l)) : this.removePortal();
      }
    }
  }, {
    key: "render",
    value: function() {
      if (!A.canUseDOM || !F)
        return null;
      !this.node && F && (this.node = de("div"));
      var r = Ce();
      return r(ee.default.createElement(Oe.default, ge({
        ref: this.portalRef,
        defaultStyles: e.defaultStyles
      }, this.props)), this.node);
    }
  }], [{
    key: "setAppElement",
    value: function(r) {
      Xt.setElement(r);
    }
    /* eslint-disable react/no-unused-prop-types */
    /* eslint-enable react/no-unused-prop-types */
  }]), e;
}(Le.Component);
V.propTypes = {
  isOpen: i.default.bool.isRequired,
  style: i.default.shape({
    content: i.default.object,
    overlay: i.default.object
  }),
  portalClassName: i.default.string,
  bodyOpenClassName: i.default.string,
  htmlOpenClassName: i.default.string,
  className: i.default.oneOfType([i.default.string, i.default.shape({
    base: i.default.string.isRequired,
    afterOpen: i.default.string.isRequired,
    beforeClose: i.default.string.isRequired
  })]),
  overlayClassName: i.default.oneOfType([i.default.string, i.default.shape({
    base: i.default.string.isRequired,
    afterOpen: i.default.string.isRequired,
    beforeClose: i.default.string.isRequired
  })]),
  appElement: i.default.oneOfType([i.default.instanceOf(_e.default), i.default.instanceOf(A.SafeHTMLCollection), i.default.instanceOf(A.SafeNodeList), i.default.arrayOf(i.default.instanceOf(_e.default))]),
  onAfterOpen: i.default.func,
  onRequestClose: i.default.func,
  closeTimeoutMS: i.default.number,
  ariaHideApp: i.default.bool,
  shouldFocusAfterRender: i.default.bool,
  shouldCloseOnOverlayClick: i.default.bool,
  shouldReturnFocusAfterClose: i.default.bool,
  preventScroll: i.default.bool,
  parentSelector: i.default.func,
  aria: i.default.object,
  data: i.default.object,
  role: i.default.string,
  contentLabel: i.default.string,
  shouldCloseOnEsc: i.default.bool,
  overlayRef: i.default.func,
  contentRef: i.default.func,
  id: i.default.string,
  overlayElement: i.default.func,
  contentElement: i.default.func
};
V.defaultProps = {
  isOpen: !1,
  portalClassName: on,
  bodyOpenClassName: rn,
  role: "dialog",
  ariaHideApp: !0,
  closeTimeoutMS: 0,
  shouldFocusAfterRender: !0,
  shouldCloseOnEsc: !0,
  shouldCloseOnOverlayClick: !0,
  shouldReturnFocusAfterClose: !0,
  preventScroll: !1,
  parentSelector: function() {
    return document.body;
  },
  overlayElement: function(e, o) {
    return ee.default.createElement(
      "div",
      e,
      o
    );
  },
  contentElement: function(e, o) {
    return ee.default.createElement(
      "div",
      e,
      o
    );
  }
};
V.defaultStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.75)"
  },
  content: {
    position: "absolute",
    top: "40px",
    left: "40px",
    right: "40px",
    bottom: "40px",
    border: "1px solid #ccc",
    background: "#fff",
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    borderRadius: "4px",
    outline: "none",
    padding: "20px"
  }
};
(0, Zt.polyfill)(V);
process.env.NODE_ENV !== "production" && (V.setCreateHTMLElement = function(t) {
  return de = t;
});
H.default = V;
(function(t, e) {
  Object.defineProperty(e, "__esModule", {
    value: !0
  });
  var o = H, r = l(o);
  function l(d) {
    return d && d.__esModule ? d : { default: d };
  }
  e.default = r.default, t.exports = e.default;
})(se, se.exports);
var an = se.exports;
const Ue = /* @__PURE__ */ ze(an), we = {
  content: {
    background: "none",
    border: "none",
    borderRadius: 0,
    bottom: "auto",
    left: "50%",
    margin: 0,
    marginRight: "-50%",
    padding: 0,
    right: "auto",
    top: "50%",
    transform: "translate(-50%, -50%)",
    transition: "all 0.35s ease-in-out",
    boxShadow: "0px 32px 64px 0px rgba(14, 14, 14, 0.14)"
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    zIndex: 9999
  }
}, oe = ({ children: t, style: e, className: o, ...r }) => /* @__PURE__ */ he(
  Ue,
  {
    style: {
      content: {
        ...we.content,
        ...e == null ? void 0 : e.content
      },
      overlay: {
        ...we.overlay,
        ...e == null ? void 0 : e.overlay
      }
    },
    ...r,
    children: /* @__PURE__ */ he("div", { className: Ge("deriv-modal__wrapper", o), children: t })
  }
);
oe.Header = Je;
oe.Body = Qe;
oe.Footer = Xe;
oe.setAppElement = Ue.setAppElement;
export {
  we as CUSTOM_STYLES,
  oe as Modal
};
