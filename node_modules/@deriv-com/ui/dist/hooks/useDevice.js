import { u as t } from "../index-EY1gwl5O.js";
const d = () => {
  const i = t("(min-width: 1280px)"), a = t("(max-width: 600px)"), n = t(
    "(min-width: 601px) and (max-width: 1279px)"
  ), e = t(
    "(min-width: 601px) and (max-width: 1279px) and (orientation: portrait)"
  ), o = t(
    "(max-width: 1279px) and (orientation: landscape)"
  );
  return {
    /** returns Larger screen tablets [min-width: 1280px] */
    isDesktop: i,
    /**  returns Smaller screen tablets [max-width: 600px] */
    isMobile: a,
    /** returns Larger screen phones and smaller screen desktop [min-width: 601px and max-width: 1279px] */
    isTablet: n,
    /** returns tablet screen with portrait orientation [min-width: 601px and max-width: 1279px and orientation: portrait] */
    isTabletPortrait: e,
    /** returns mobile or medium screens in landscape orientation [max-width: 1279px and orientation: landscape] */
    isMobileOrTabletLandscape: o
  };
};
export {
  d as useDevice
};
