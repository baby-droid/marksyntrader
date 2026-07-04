import { __exports as client } from "./index138.mjs";
import require$$0 from "react-dom";
var hasRequiredClient;
function requireClient() {
  if (hasRequiredClient) return client;
  hasRequiredClient = 1;
  var m = require$$0;
  if (process.env.NODE_ENV === "production") {
    client.createRoot = m.createRoot;
    client.hydrateRoot = m.hydrateRoot;
  } else {
    var i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    client.createRoot = function(c, o) {
      i.usingClientEntryPoint = true;
      try {
        return m.createRoot(c, o);
      } finally {
        i.usingClientEntryPoint = false;
      }
    };
    client.hydrateRoot = function(c, h, o) {
      i.usingClientEntryPoint = true;
      try {
        return m.hydrateRoot(c, h, o);
      } finally {
        i.usingClientEntryPoint = false;
      }
    };
  }
  return client;
}
export {
  requireClient as __require
};
//# sourceMappingURL=index137.mjs.map
