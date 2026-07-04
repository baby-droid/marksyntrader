import { passwordRegex as i, passwordValues as r } from "./PasswordConstants.js";
const c = (t) => i.isPasswordValid.test(t), n = (t) => i.isPasswordValid.test(t) && i.isLengthValid.test(t), g = (t) => {
  const e = (t.match(/\W/g) ?? []).length > 1;
  return n(t) && e && t.length >= r.minLength && t.length < r.longPassword && i.isLengthValid;
}, l = (t) => {
  const e = (t.match(/\W/g) ?? []).length > 1;
  return n(t) && e && t.length >= r.longPassword && i.isLengthValid;
}, o = (t, e = "") => {
  if ((t == null ? void 0 : t.length) === 0) return 0;
  if (e) return 5;
  if (!n(t)) return 1;
  if (!l(t) && n(t) && !g(t))
    return 2;
  if (!l(t) && n(t) && g(t))
    return 3;
  if (l(t)) return 4;
};
export {
  o as calculateScore,
  g as isPasswordModerate,
  l as isPasswordStrong,
  n as isPasswordValid,
  c as validPassword
};
