import { useCallback } from 'react';
import { useStore } from './useStore';

const useThemeSwitcher = () => {
    const { ui } = useStore() ?? {
        ui: {
            setDarkMode: () => {},
            is_dark_mode_on: false,
        },
    };
    const { setDarkMode, is_dark_mode_on } = ui;

    // Applies a specific theme. Updates localStorage, the body class, and the ui
    // store so everything that reads is_dark_mode_on (incl. the chart) follows.
    const setTheme = useCallback(
        (theme: 'light' | 'dark') => {
            const body = document.querySelector('body');
            if (!body) return;
            const isDark = theme === 'dark';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            body.classList.remove('theme--light', 'theme--dark');
            body.classList.add(isDark ? 'theme--dark' : 'theme--light');
            setDarkMode(isDark);
        },
        [setDarkMode]
    );

    const toggleTheme = useCallback(() => {
        const isCurrentlyDark = document.querySelector('body')?.classList.contains('theme--dark');
        setTheme(isCurrentlyDark ? 'light' : 'dark');
    }, [setTheme]);

    return {
        toggleTheme,
        setTheme,
        is_dark_mode_on,
        setDarkMode,
    };
};

export default useThemeSwitcher;
