import { useState, useEffect } from "react";
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768
};
const useDevice = () => {
  const [device, setDevice] = useState("desktop");
  const [isDeviceDetected, setIsDeviceDetected] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.mobile) {
        setDevice("mobile");
      } else if (width < BREAKPOINTS.tablet) {
        setDevice("tablet");
      } else {
        setDevice("desktop");
      }
    };
    handleResize();
    setIsDeviceDetected(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return {
    device,
    isMobile: device === "mobile",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    isDeviceDetected
  };
};
export {
  useDevice
};
//# sourceMappingURL=index51.mjs.map
