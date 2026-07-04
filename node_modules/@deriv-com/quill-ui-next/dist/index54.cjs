"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useDragToClose = ({
  isEnabled,
  onClose,
  threshold = 150
}) => {
  const [dragOffset, setDragOffset] = React.useState(0);
  const dragStartY = React.useRef(0);
  React.useEffect(() => {
    setDragOffset(0);
  }, [isEnabled]);
  const handleTouchStart = (e) => {
    if (!isEnabled) return;
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (!isEnabled) return;
    const currentY = e.touches[0].clientY;
    const deltaY = Math.max(0, currentY - dragStartY.current);
    setDragOffset(deltaY);
  };
  const handleTouchEnd = () => {
    if (!isEnabled) return;
    if (dragOffset > threshold) {
      onClose == null ? void 0 : onClose();
    }
    setDragOffset(0);
  };
  return {
    dragHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    },
    dragStyles: {
      transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : void 0,
      transition: dragOffset > 0 ? "none" : "transform 0.3s ease"
    }
  };
};
exports.useDragToClose = useDragToClose;
//# sourceMappingURL=index54.cjs.map
