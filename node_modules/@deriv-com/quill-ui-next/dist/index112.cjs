"use strict";
const React = require("react");
const useFocusHandling = require("./index44.cjs");
const BaseCard = ({
  className = "",
  size = "sm",
  state = "default",
  type = "elevate",
  title,
  subtitle,
  description = "Your description goes here.",
  image,
  showFocusRing = false,
  iconLeft,
  iconRight,
  linkLabel,
  linkIcon,
  linkOnClick,
  primaryVerticalButton,
  secondaryVerticalButton,
  primaryHorizontalButton,
  secondaryHorizontalButton,
  layout,
  renderLayout
}) => {
  const cardId = `quill-card-${layout}-${size}-${state}-${type}`;
  const [focus, setFocus] = React.useState(showFocusRing);
  const isClickable = state !== "disabled";
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: !isClickable,
    setHighlight: setFocus
  });
  const renderProps = {
    cardId,
    className,
    size,
    state,
    type,
    focus,
    handleFocus,
    handleBlur,
    isClickable,
    title,
    subtitle,
    description,
    image,
    iconLeft,
    iconRight,
    linkLabel,
    linkIcon,
    linkOnClick,
    primaryVerticalButton,
    secondaryVerticalButton,
    primaryHorizontalButton,
    secondaryHorizontalButton
  };
  return renderLayout(renderProps);
};
module.exports = BaseCard;
//# sourceMappingURL=index112.cjs.map
