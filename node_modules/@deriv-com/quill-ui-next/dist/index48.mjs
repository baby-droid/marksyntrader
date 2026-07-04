import { useState, useEffect } from "react";
let snackbarQueue = [];
let listeners = [];
const notifyListeners = () => {
  listeners.forEach((listener) => listener(snackbarQueue));
};
const showSnackbar = (props) => {
  const id = `snackbar-${Date.now()}`;
  const snackbarItem = { ...props, id };
  snackbarQueue = [...snackbarQueue, snackbarItem];
  notifyListeners();
  if (props.autoDismiss !== false) {
    const timeout = props.dismissTimeout || 5e3;
    setTimeout(() => {
      hideSnackbar(id);
    }, timeout);
  }
  return id;
};
const hideSnackbar = (id) => {
  snackbarQueue = snackbarQueue.filter((snackbar) => snackbar.id !== id);
  notifyListeners();
};
const useSnackbar = () => {
  const [queue, setQueue] = useState(snackbarQueue);
  useEffect(() => {
    const listener = (newQueue) => {
      setQueue([...newQueue]);
    };
    listeners.push(listener);
    setQueue([...snackbarQueue]);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);
  return {
    queue,
    showSnackbar,
    hideSnackbar
  };
};
export {
  useSnackbar as default,
  hideSnackbar,
  showSnackbar,
  useSnackbar
};
//# sourceMappingURL=index48.mjs.map
