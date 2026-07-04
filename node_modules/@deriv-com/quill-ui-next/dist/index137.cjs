"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const client = require("./index138.cjs");
const require$$0 = require("react-dom");
var hasRequiredClient;
function requireClient() {
  if (hasRequiredClient) return client.__exports;
  hasRequiredClient = 1;
  var m = require$$0;
  if (process.env.NODE_ENV === "production") {
    client.__exports.createRoot = m.createRoot;
    client.__exports.hydrateRoot = m.hydrateRoot;
  } else {
    var i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    client.__exports.createRoot = function(c, o) {
      i.usingClientEntryPoint = true;
      try {
        return m.createRoot(c, o);
      } finally {
        i.usingClientEntryPoint = false;
      }
    };
    client.__exports.hydrateRoot = function(c, h, o) {
      i.usingClientEntryPoint = true;
      try {
        return m.hydrateRoot(c, h, o);
      } finally {
        i.usingClientEntryPoint = false;
      }
    };
  }
  return client.__exports;
}
exports.__require = requireClient;
//# sourceMappingURL=index137.cjs.map
