import './assets/PasswordInput.css';
const R = (i, e) => (
  // eslint-disable-next-line prefer-spread
  i.push.apply(i, e)
), x = (i) => i.sort((e, t) => e.i - t.i || e.j - t.j), c = (i) => {
  const e = {};
  let t = 1;
  return i.forEach((s) => {
    e[s] = t, t += 1;
  }), e;
};
var u = {
  4: [
    // for length-4 strings, eg 1191 or 9111, two ways to split:
    [1, 2],
    [2, 3]
    // 91 1 1
  ],
  5: [
    [1, 3],
    [2, 3],
    //  [2, 3], // 91 1 11    <- duplicate previous one
    [2, 4]
    // 91 11 1    <- New and must be added as bug fix
  ],
  6: [
    [1, 2],
    [2, 4],
    [4, 5]
    // 1991 1 1
  ],
  //  1111991
  7: [
    [1, 3],
    [2, 3],
    [4, 5],
    [4, 6]
    // 1991 11 1
  ],
  8: [
    [2, 4],
    [4, 6]
    // 1991 11 11
  ]
};
const T = 2050, S = 1e3, b = u, m = 10, y = 1e4, A = 10, p = 50, g = 20, _ = /^[A-Z\xbf-\xdf][^A-Z\xbf-\xdf]+$/, D = /^[^A-Z\xbf-\xdf]+[A-Z\xbf-\xdf]$/, I = /^[A-Z\xbf-\xdf]+$/, L = /^[^a-z\xdf-\xff]+$/, k = /^[a-z\xdf-\xff]+$/, C = /^[^A-Z\xbf-\xdf]+$/, M = /[a-z\xdf-\xff]/, v = /[A-Z\xbf-\xdf]/, N = /[^A-Za-z\xbf-\xdf]/gi, w = /^\d+$/, z = (/* @__PURE__ */ new Date()).getFullYear(), O = {
  recentYear: /19\d\d|200\d|201\d|202\d/g
}, f = [" ", ",", ";", ":", "|", "/", "\\", "_", ".", "-"], P = f.length;
var h = {
  a: ["4", "@"],
  b: ["8"],
  c: ["(", "{", "[", "<"],
  d: ["6", "|)"],
  e: ["3"],
  f: ["#"],
  g: ["6", "9", "&"],
  h: ["#", "|-|"],
  i: ["1", "!", "|"],
  k: ["<", "|<"],
  l: ["!", "1", "|", "7"],
  m: ["^^", "nn", "2n", "/\\\\/\\\\"],
  n: ["//"],
  o: ["0", "()"],
  q: ["9"],
  u: ["|_|"],
  s: ["$", "5"],
  t: ["+", "7"],
  v: ["<", ">", "/"],
  w: ["^/", "uu", "vv", "2u", "2v", "\\\\/\\\\/"],
  x: ["%", "><"],
  z: ["2"]
}, d = {
  warnings: {
    straightRow: "straightRow",
    keyPattern: "keyPattern",
    simpleRepeat: "simpleRepeat",
    extendedRepeat: "extendedRepeat",
    sequences: "sequences",
    recentYears: "recentYears",
    dates: "dates",
    topTen: "topTen",
    topHundred: "topHundred",
    common: "common",
    similarToCommon: "similarToCommon",
    wordByItself: "wordByItself",
    namesByThemselves: "namesByThemselves",
    commonNames: "commonNames",
    userInputs: "userInputs",
    pwned: "pwned"
  },
  suggestions: {
    l33t: "l33t",
    reverseWords: "reverseWords",
    allUppercase: "allUppercase",
    capitalization: "capitalization",
    dates: "dates",
    recentYears: "recentYears",
    associatedYears: "associatedYears",
    sequences: "sequences",
    repeated: "repeated",
    longerKeyboardPattern: "longerKeyboardPattern",
    anotherWord: "anotherWord",
    useWords: "useWords",
    noNeed: "noNeed",
    pwned: "pwned"
  },
  timeEstimation: {
    ltSecond: "ltSecond",
    second: "second",
    seconds: "seconds",
    minute: "minute",
    minutes: "minutes",
    hour: "hour",
    hours: "hours",
    day: "day",
    days: "days",
    month: "month",
    months: "months",
    year: "year",
    years: "years",
    centuries: "centuries"
  }
};
class r {
  constructor(e = []) {
    this.parents = e, this.children = /* @__PURE__ */ new Map();
  }
  addSub(e, ...t) {
    const s = e.charAt(0);
    this.children.has(s) || this.children.set(s, new r([...this.parents, s]));
    let n = this.children.get(s);
    for (let a = 1; a < e.length; a += 1) {
      const o = e.charAt(a);
      n.hasChild(o) || n.addChild(o), n = n.getChild(o);
    }
    return n.subs = (n.subs || []).concat(t), this;
  }
  getChild(e) {
    return this.children.get(e);
  }
  isTerminal() {
    return !!this.subs;
  }
  addChild(e) {
    this.hasChild(e) || this.children.set(e, new r([...this.parents, e]));
  }
  hasChild(e) {
    return this.children.has(e);
  }
}
var l = (i, e) => (Object.entries(i).forEach(([t, s]) => {
  s.forEach((n) => {
    e.addSub(n, t);
  });
}), e);
class E {
  constructor() {
    this.matchers = {}, this.l33tTable = h, this.trieNodeRoot = l(h, new r()), this.dictionary = {
      userInputs: []
    }, this.rankedDictionaries = {}, this.rankedDictionariesMaxWordSize = {}, this.translations = d, this.graphs = {}, this.useLevenshteinDistance = !1, this.levenshteinThreshold = 2, this.l33tMaxSubstitutions = 100, this.maxLength = 256, this.setRankedDictionaries();
  }
  // eslint-disable-next-line max-statements,complexity
  setOptions(e = {}) {
    e.l33tTable && (this.l33tTable = e.l33tTable, this.trieNodeRoot = l(e.l33tTable, new r())), e.dictionary && (this.dictionary = e.dictionary, this.setRankedDictionaries()), e.translations && this.setTranslations(e.translations), e.graphs && (this.graphs = e.graphs), e.useLevenshteinDistance !== void 0 && (this.useLevenshteinDistance = e.useLevenshteinDistance), e.levenshteinThreshold !== void 0 && (this.levenshteinThreshold = e.levenshteinThreshold), e.l33tMaxSubstitutions !== void 0 && (this.l33tMaxSubstitutions = e.l33tMaxSubstitutions), e.maxLength !== void 0 && (this.maxLength = e.maxLength);
  }
  setTranslations(e) {
    if (this.checkCustomTranslations(e))
      this.translations = e;
    else
      throw new Error("Invalid translations object fallback to keys");
  }
  checkCustomTranslations(e) {
    let t = !0;
    return Object.keys(d).forEach((s) => {
      if (s in e) {
        const n = s;
        Object.keys(d[n]).forEach((a) => {
          a in e[n] || (t = !1);
        });
      } else
        t = !1;
    }), t;
  }
  setRankedDictionaries() {
    const e = {}, t = {};
    Object.keys(this.dictionary).forEach((s) => {
      e[s] = c(this.dictionary[s]), t[s] = this.getRankedDictionariesMaxWordSize(this.dictionary[s]);
    }), this.rankedDictionaries = e, this.rankedDictionariesMaxWordSize = t;
  }
  getRankedDictionariesMaxWordSize(e) {
    const t = e.map((s) => typeof s != "string" ? s.toString().length : s.length);
    return t.length === 0 ? 0 : t.reduce((s, n) => Math.max(s, n), -1 / 0);
  }
  buildSanitizedRankedDictionary(e) {
    const t = [];
    return e.forEach((s) => {
      const n = typeof s;
      (n === "string" || n === "number" || n === "boolean") && t.push(s.toString().toLowerCase());
    }), c(t);
  }
  extendUserInputsDictionary(e) {
    this.dictionary.userInputs || (this.dictionary.userInputs = []);
    const t = [...this.dictionary.userInputs, ...e];
    this.rankedDictionaries.userInputs = this.buildSanitizedRankedDictionary(t), this.rankedDictionariesMaxWordSize.userInputs = this.getRankedDictionariesMaxWordSize(t);
  }
  addMatcher(e, t) {
    this.matchers[e] ? console.info(`Matcher ${e} already exists`) : this.matchers[e] = t;
  }
}
const U = new E();
export {
  N as A,
  m as B,
  S as D,
  D as E,
  A as M,
  v as O,
  z as R,
  _ as S,
  T as a,
  b,
  O as c,
  p as d,
  g as e,
  C as f,
  M as g,
  L as h,
  P as i,
  y as j,
  k,
  I as l,
  w as m,
  R as n,
  f as o,
  x as s,
  U as z
};
