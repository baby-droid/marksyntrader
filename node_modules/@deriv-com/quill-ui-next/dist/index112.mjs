import { useState } from "react";
import { useFocusHandling } from "./index44.mjs";
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
  const [focus, setFocus] = useState(showFocusRing);
  const isClickable = state !== "disabled";
  const { handleFocus, handleBlur } = useFocusHandling({
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
export {
  BaseCard as default
};
//# sourceMappingURL=index112.mjs.map
