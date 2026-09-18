import { useCallback as F, useEffect as P } from "react";
import { c as v, g as A } from "../_commonjsHelpers-BkfeUUK-.js";
function H(e) {
  var t = typeof e;
  return e != null && (t == "object" || t == "function");
}
var G = H, D = typeof v == "object" && v && v.Object === Object && v, U = D, X = U, q = typeof self == "object" && self && self.Object === Object && self, z = X || q || Function("return this")(), M = z, J = M, K = function() {
  return J.Date.now();
}, Q = K, V = /\s/;
function Y(e) {
  for (var t = e.length; t-- && V.test(e.charAt(t)); )
    ;
  return t;
}
var Z = Y, ee = Z, te = /^\s+/;
function re(e) {
  return e && e.slice(0, ee(e) + 1).replace(te, "");
}
var ne = re, ie = M, oe = ie.Symbol, N = oe, x = N, R = Object.prototype, ae = R.hasOwnProperty, ce = R.toString, m = x ? x.toStringTag : void 0;
function fe(e) {
  var t = ae.call(e, m), i = e[m];
  try {
    e[m] = void 0;
    var a = !0;
  } catch {
  }
  var n = ce.call(e);
  return a && (t ? e[m] = i : delete e[m]), n;
}
var se = fe, ue = Object.prototype, de = ue.toString;
function le(e) {
  return de.call(e);
}
var be = le, _ = N, me = se, ge = be, ve = "[object Null]", Te = "[object Undefined]", I = _ ? _.toStringTag : void 0;
function ye(e) {
  return e == null ? e === void 0 ? Te : ve : I && I in Object(e) ? me(e) : ge(e);
}
var je = ye;
function Se(e) {
  return e != null && typeof e == "object";
}
var pe = Se, Oe = je, $e = pe, he = "[object Symbol]";
function xe(e) {
  return typeof e == "symbol" || $e(e) && Oe(e) == he;
}
var _e = xe, Ie = ne, E = G, Ee = _e, k = NaN, ke = /^[-+]0x[0-9a-f]+$/i, Le = /^0b[01]+$/i, Ge = /^0o[0-7]+$/i, Me = parseInt;
function Ne(e) {
  if (typeof e == "number")
    return e;
  if (Ee(e))
    return k;
  if (E(e)) {
    var t = typeof e.valueOf == "function" ? e.valueOf() : e;
    e = E(t) ? t + "" : t;
  }
  if (typeof e != "string")
    return e === 0 ? e : +e;
  e = Ie(e);
  var i = Le.test(e);
  return i || Ge.test(e) ? Me(e.slice(2), i ? 2 : 8) : ke.test(e) ? k : +e;
}
var Re = Ne, we = G, S = Q, L = Re, Be = "Expected a function", Ce = Math.max, We = Math.min;
function Fe(e, t, i) {
  var a, n, c, f, o, s, d = 0, p = !1, l = !1, T = !0;
  if (typeof e != "function")
    throw new TypeError(Be);
  t = L(t) || 0, we(i) && (p = !!i.leading, l = "maxWait" in i, c = l ? Ce(L(i.maxWait) || 0, t) : c, T = "trailing" in i ? !!i.trailing : T);
  function y(r) {
    var u = a, b = n;
    return a = n = void 0, d = r, f = e.apply(b, u), f;
  }
  function w(r) {
    return d = r, o = setTimeout(g, t), p ? y(r) : f;
  }
  function B(r) {
    var u = r - s, b = r - d, h = t - u;
    return l ? We(h, c - b) : h;
  }
  function O(r) {
    var u = r - s, b = r - d;
    return s === void 0 || u >= t || u < 0 || l && b >= c;
  }
  function g() {
    var r = S();
    if (O(r))
      return $(r);
    o = setTimeout(g, B(r));
  }
  function $(r) {
    return o = void 0, T && a ? y(r) : (a = n = void 0, f);
  }
  function C() {
    o !== void 0 && clearTimeout(o), d = 0, a = s = n = o = void 0;
  }
  function W() {
    return o === void 0 ? f : $(S());
  }
  function j() {
    var r = S(), u = O(r);
    if (a = arguments, n = this, s = r, u) {
      if (o === void 0)
        return w(s);
      if (l)
        return clearTimeout(o), o = setTimeout(g, t), y(s);
    }
    return o === void 0 && (o = setTimeout(g, t)), f;
  }
  return j.cancel = C, j.flush = W, j;
}
var Pe = Fe;
const Ae = /* @__PURE__ */ A(Pe), Ue = ({ loadMore: e, ref: t }) => {
  const i = Ae(e, 100), a = F(
    (n) => {
      if (n) {
        const { clientHeight: c, scrollHeight: f, scrollTop: o } = n;
        f - o - c < 200 && i();
      }
    },
    [i]
  );
  return P(() => {
    const n = t.current, c = () => a(n);
    return n && n.addEventListener("scroll", c), () => {
      n && n.removeEventListener("scroll", c);
    };
  }, [a, t]), {
    fetchMoreOnBottomReached: a
  };
};
export {
  Ue as useFetchMore
};
