const usePortalClick = (ref) => {
  const isPortalClick = (e) => {
    var _a;
    return !((_a = ref.current) == null ? void 0 : _a.contains(e.target));
  };
  return { isPortalClick };
};
export {
  usePortalClick
};
//# sourceMappingURL=index52.mjs.map
