import { useState as d, useLayoutEffect as m, useEffect as u, useRef as l } from "react";
import { c as a } from "./_commonjsHelpers-BkfeUUK-.js";
var v = typeof a == "object" && a && a.Object === Object && a, E = typeof self == "object" && self && self.Object === Object && self;
v || E || Function("return this")();
var f = typeof window < "u" ? m : u;
function L(t, s, o, i) {
  const c = l(s);
  f(() => {
    c.current = s;
  }, [s]), u(() => {
    const n = window;
    if (!(n && n.addEventListener))
      return;
    const r = (e) => {
      c.current(e);
    };
    return n.addEventListener(t, r, i), () => {
      n.removeEventListener(t, r, i);
    };
  }, [t, o, i]);
}
var h = typeof window > "u";
function O(t, {
  defaultValue: s = !1,
  initializeWithValue: o = !0
} = {}) {
  const i = (e) => h ? s : window.matchMedia(e).matches, [c, n] = d(() => o ? i(t) : s);
  function r() {
    n(i(t));
  }
  return f(() => {
    const e = window.matchMedia(t);
    return r(), e.addListener ? e.addListener(r) : e.addEventListener("change", r), () => {
      e.removeListener ? e.removeListener(r) : e.removeEventListener("change", r);
    };
  }, [t]), c;
}
function g(t, s, o = "mousedown", i = {}) {
  L(
    o,
    (c) => {
      const n = c.target;
      if (!n || !n.isConnected)
        return;
      (Array.isArray(t) ? t.filter((e) => !!e.current).every((e) => e.current && !e.current.contains(n)) : t.current && !t.current.contains(n)) && s(c);
    },
    void 0,
    i
  );
}
export {
  g as a,
  O as u
};
