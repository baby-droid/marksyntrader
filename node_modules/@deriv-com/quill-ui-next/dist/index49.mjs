import { useState, useRef, useCallback } from "react";
const useHorizontalSwipe = ({
  threshold = 40,
  initialState = false
} = {}) => {
  const [isSwiped, setIsSwiped] = useState(initialState);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwiping = useRef(false);
  const resetSwipe = useCallback(() => {
    setIsSwiped(false);
  }, []);
  const setSwipeState = useCallback((state) => {
    setIsSwiped(state);
  }, []);
  const detectSwipe = useCallback((endX) => {
    if (!isSwiping.current) return;
    const diff = startXRef.current - endX;
    if (diff > threshold && !isSwiped) {
      setIsSwiped(true);
    } else if (diff < -threshold && isSwiped) {
      setIsSwiped(false);
    }
    isSwiping.current = false;
  }, [threshold, isSwiped]);
  const handleTouchStart = useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    isSwiping.current = true;
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (!isSwiping.current) return;
    currentXRef.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e) => {
    const endX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : currentXRef.current;
    detectSwipe(endX);
  }, [detectSwipe]);
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    isSwiping.current = true;
  }, []);
  const handleMouseMove = useCallback((e) => {
    if (!isSwiping.current) return;
    currentXRef.current = e.clientX;
    e.preventDefault();
  }, []);
  const handleMouseUp = useCallback((e) => {
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
export {
  useHorizontalSwipe
};
//# sourceMappingURL=index49.mjs.map
