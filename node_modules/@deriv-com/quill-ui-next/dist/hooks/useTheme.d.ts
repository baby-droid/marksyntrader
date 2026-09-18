type Theme = 'light' | 'dark';
export declare const useTheme: () => {
    theme: Theme;
    setTheme: (newTheme: Theme) => void;
    toggleTheme: () => void;
    isDarkMode: boolean;
};
export default useTheme;
