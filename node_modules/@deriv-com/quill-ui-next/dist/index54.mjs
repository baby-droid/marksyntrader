import { useState, useRef, useEffect } from "react";
const useDragToClose = ({
  isEnabled,
  onClose,
  threshold = 150
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  useEffect(() => {
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
export {
  useDragToClose
};
//# sourceMappingURL=index54.mjs.map
