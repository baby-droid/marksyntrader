import { jsx } from "react/jsx-runtime";
import ModalBase from "./index107.mjs";
const Modal = ({
  className = "",
  height = "hug-content",
  type = "bottom",
  description = "Add the content here",
  title = "Title",
  buttonPrimary,
  buttonSecondary,
  show,
  onClose,
  showCloseButton,
  showHandleBar,
  customIcon,
  customImage,
  content
}) => {
  return /* @__PURE__ */ jsx(
    ModalBase,
    {
      className,
      height,
      type,
      description,
      title,
      buttonPrimary,
      buttonSecondary,
      show,
      onClose,
      showCloseButton,
      showHandleBar,
      customIcon,
      customImage,
      content
    }
  );
};
export {
  Modal,
  Modal as default
};
//# sourceMappingURL=index22.mjs.map
