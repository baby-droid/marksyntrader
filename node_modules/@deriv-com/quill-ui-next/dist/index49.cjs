"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useHorizontalSwipe = ({
  threshold = 40,
  initialState = false
} = {}) => {
  const [isSwiped, setIsSwiped] = React.useState(initialState);
  const startXRef = React.useRef(0);
  const currentXRef = React.useRef(0);
  const isSwiping = React.useRef(false);
  const resetSwipe = React.useCallback(() => {
    setIsSwiped(false);
  }, []);
  const setSwipeState = React.useCallback((state) => {
    setIsSwiped(state);
  }, []);
  const detectSwipe = React.useCallback((endX) => {
    if (!isSwiping.current) return;
    const diff = startXRef.current - endX;
    if (diff > threshold && !isSwiped) {
      setIsSwiped(true);
    } else if (diff < -threshold && isSwiped) {
      setIsSwiped(false);
    }
    isSwiping.current = false;
  }, [threshold, isSwiped]);
  const handleTouchStart = React.useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    isSwiping.current = true;
  }, []);
  const handleTouchMove = React.useCallback((e) => {
    if (!isSwiping.current) return;
    currentXRef.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = React.useCallback((e) => {
    const endX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : currentXRef.current;
    detectSwipe(endX);
  }, [detectSwipe]);
  const handleMouseDown = React.useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    isSwiping.current = true;
  }, []);
  const handleMouseMove = React.useCallback((e) => {
    if (!isSwiping.current) return;
    currentXRef.current = e.clientX;
    e.preventDefault();
  }, []);
  const handleMouseUp = React.useCallback((e) => {
    detectSwipe(currentXRef.current || e.clientX);
  }, [detectSwipe]);
  const swipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp
    // Handle case when mouse leaves the element
  };
  return {
    isSwiped,
    resetSwipe,
    setIsSwiped: setSwipeState,
    swipeHandlers
  };
};
exports.useHorizontalSwipe = useHorizontalSwipe;
//# sourceMappingURL=index49.cjs.map
