import { ComponentProps, ReactNode, useMemo } from 'react';
import { useStore } from '@/hooks/useStore';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import RootStore from '@/stores/root-store';
import { LegacyLogout1pxIcon, LegacySettings1pxIcon, LegacyTheme1pxIcon } from '@deriv/quill-icons/Legacy';
import { useTranslations } from '@deriv-com/translations';
import { ToggleSwitch } from '@deriv-com/ui';
import { DBOT_TABS } from '@/constants/bot-contents';

export type TSubmenuSection = 'accountSettings' | 'cashier' | 'reports';

//IconTypes
type TMenuConfig = {
    LeftComponent: React.ElementType;
    RightComponent?: ReactNode;
    as: 'a' | 'button';
    href?: string;
    label: ReactNode;
    onClick?: () => void;
    removeBorderBottom?: boolean;
    submenu?: TSubmenuSection;
    target?: ComponentProps<'a'>['target'];
    isActive?: boolean;
}[];

const useMobileMenuConfig = (
    client?: RootStore['client'],
    onLogout?: () => void,
    enableThemeToggle: boolean = true
) => {
    const { localize } = useTranslations();
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();
    const store = useStore() ?? {};
    const { ui, dashboard } = store as any;

    const menuConfig = useMemo((): TMenuConfig[] => {
        const mainPages = [
            { tab: DBOT_TABS.DASHBOARD, icon: '🏠', label: 'Dashboard' },
            { tab: DBOT_TABS.BOT_BUILDER, icon: '🧱', label: 'Bot Builder' },
            { tab: DBOT_TABS.FREE_BOTS, icon: '🤖', label: 'Free Bots & Personal Bots' },
            { tab: DBOT_TABS.AHMED_SCALPER_BOTS, icon: '⚡', label: 'Scalper Bots' },
            { tab: DBOT_TABS.AUTO_DIGITS, icon: '◉', label: 'Auto-Digits' },
            { tab: DBOT_TABS.DCIRCLES, icon: '⬤', label: 'D-Circles' },
            { tab: DBOT_TABS.DTRADER, icon: '📊', label: 'D-Trader' },
            { tab: DBOT_TABS.SPEEDLAB, icon: '🚀', label: 'Speed Lab' },
            { tab: DBOT_TABS.HEDGE, icon: '🔀', label: 'Hedge Trading' },
            { tab: DBOT_TABS.CHART, icon: '📈', label: 'Charts' },
            { tab: DBOT_TABS.MANUAL_TRADER, icon: '🎯', label: 'Manual Trader' },
            { tab: DBOT_TABS.AUTO_TRADES, icon: '🔄', label: 'Auto Trades' },
            { tab: DBOT_TABS.COPY_TRADING, icon: '📋', label: 'Copy Trading' },
            { tab: DBOT_TABS.REPORT, icon: '📄', label: 'Reports' },
            { tab: DBOT_TABS.BULK_TRADE, icon: '📦', label: 'Bulk Trade' },
            { tab: DBOT_TABS.ANALYSIS, icon: '🔍', label: 'Analysis' },
            { tab: DBOT_TABS.TUTORIAL, icon: '📚', label: 'Tutorials' },
            { tab: DBOT_TABS.TRADING_SOFTWARE, icon: '💻', label: 'Trading Software' },
        ];

        return [
            [
                ...mainPages.map(page => ({
                    as: 'button' as const,
                    label: localize(page.label),
                    LeftComponent: () => <span style={{ fontSize: '1rem', lineHeight: 1 }}>{page.icon}</span>,
                    onClick: () => dashboard?.setActiveTab?.(page.tab),
                })),
                {
                    as: 'button',
                    label: localize('Settings'),
                    LeftComponent: LegacySettings1pxIcon,
                    onClick: () => ui?.setSettingsPanelOpen?.(true),
                },

                // Conditionally include theme toggle based on brand config
                enableThemeToggle && {
                    as: 'button',
                    label: localize('Dark theme'),
                    LeftComponent: LegacyTheme1pxIcon,
                    RightComponent: <ToggleSwitch value={is_dark_mode_on} onChange={toggleTheme} />,
                },
            ].filter(Boolean) as TMenuConfig,
            [
                client?.is_logged_in &&
                    onLogout && {
                        as: 'button',
                        label: localize('Log out'),
                        LeftComponent: LegacyLogout1pxIcon,
                        onClick: onLogout,
                        removeBorderBottom: true,
                    },
            ].filter(Boolean) as TMenuConfig,
        ].filter(section => section.length > 0);
    }, [
        client,
        onLogout,
        is_dark_mode_on,
        toggleTheme,
        localize,
        enableThemeToggle, // [AI] Added to recalculate menu when theme toggle config changes
    ]);

    // [AI] Check if menu has any items to determine if mobile menu should be shown
    const hasMenuItems = menuConfig.some(section => section.length > 0);
    // [/AI]

    return {
        config: menuConfig,
        // [AI] Return flag indicating if menu has any items
        hasMenuItems,
        // [/AI]
    };
};

export default useMobileMenuConfig;
