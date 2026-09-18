import { useState, useEffect } from "react";
const useTheme = () => {
  const getInitialTheme = () => {
    try {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) return savedTheme;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (error) {
      console.warn("Failed to get initial theme:", error);
      return "light";
    }
  };
  const [theme, setTheme] = useState(getInitialTheme);
  const updateTheme = (newTheme) => {
    try {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
      localStorage.setItem("theme", newTheme);
      setTheme(newTheme);
    } catch (error) {
      console.warn("Failed to update theme:", error);
      setTheme(newTheme);
    }
  };
  useEffect(() => {
    updateTheme(theme);
  }, []);
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    updateTheme(newTheme);
  };
  return {
    theme,
    setTheme: updateTheme,
    toggleTheme,
    isDarkMode: theme === "dark"
  };
};
export {
  useTheme as default,
  useTheme
};
//# sourceMappingURL=index46.mjs.map
