import { useCallback } from "react";
const useActionSheetDetection = () => {
  const isInsideActionSheet = useCallback((target) => {
    if (!target) return false;
    return !!target.closest(".quill-ui-next-actionsheet-full-width");
  }, []);
  return { isInsideActionSheet };
};
export {
  useActionSheetDetection as default,
  useActionSheetDetection
};
//# sourceMappingURL=index50.mjs.map
