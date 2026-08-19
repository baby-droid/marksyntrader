// ========================================
// MENU ITEMS PLACEHOLDER FOR WHITE-LABELING
// ========================================
//
// This component has been simplified for white-labeling.
// Third-party developers can add custom menu items here.
//
// EXAMPLE USAGE:
// --------------
// import { observer } from 'mobx-react-lite';
// import { useStore } from '@/hooks/useStore';
// import { useTranslations } from '@deriv-com/translations';
// import { MenuItem, Text } from '@deriv-com/ui';
//
// export const MenuItems = observer(() => {
//     const { localize } = useTranslations();
//     const store = useStore();
//     const is_logged_in = store?.client?.is_logged_in ?? false;
//
//     if (!is_logged_in) return null;
//
//     return (
//         <>
//             <MenuItem
//                 as='a'
//                 className='app-header__menu'
//                 href='/your-page'
//                 leftComponent={YourIcon}
//             >
//                 <Text>{localize('Your Menu Item')}</Text>
//             </MenuItem>
//         </>
//     );
// });
//
// For mobile menu items, see:
// src/components/layout/header/mobile-menu/use-mobile-menu-config.tsx

import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { LegacySettings1pxIcon } from '@deriv/quill-icons/Legacy';
import { useTranslations } from '@deriv-com/translations';
import { MenuItem, Text } from '@deriv-com/ui';
import { DBOT_TABS } from '@/constants/bot-contents';

const MAIN_MENU_ITEMS = [
    { tab: DBOT_TABS.DASHBOARD, icon: '🏠', label: 'Dashboard' },
    { tab: DBOT_TABS.BOT_BUILDER, icon: '🧱', label: 'Bot Builder' },
    { tab: DBOT_TABS.FREE_BOTS, icon: '🤖', label: 'Free Bots & Personal Bots' },
    { tab: DBOT_TABS.AHMED_SCALPER_BOTS, icon: '⚡', label: 'Scalper Bots' },
    { tab: DBOT_TABS.DCIRCLES, icon: '⬤', label: 'D-Circles' },
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

export const MenuItems = observer(() => {
    const { localize } = useTranslations();
    const store = useStore() ?? {};
    const { ui, dashboard } = store as any;

    return (
        <>
            {MAIN_MENU_ITEMS.map(item => (
                <MenuItem
                    key={item.tab}
                    as='button'
                    className='app-header__menu'
                    disableHover
                    leftComponent={<span style={{ fontSize: '1rem', lineHeight: 1 }}>{item.icon}</span>}
                    onClick={() => dashboard?.setActiveTab?.(item.tab)}
                >
                    <Text size='sm'>{localize(item.label)}</Text>
                </MenuItem>
            ))}
            <MenuItem
                as='button'
                className='app-header__menu'
                disableHover
                leftComponent={<LegacySettings1pxIcon iconSize='xs' />}
                onClick={() => ui?.setSettingsPanelOpen?.(true)}
            >
                <Text size='sm'>{localize('Settings')}</Text>
            </MenuItem>
        </>
    );
});

export const TradershubLink = observer(() => {
    // No default Traders Hub link - add your custom navigation here if needed
    return null;
});

// Create a namespace for MenuItems to include TradershubLink
type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};

// Assign TradershubLink to MenuItems
(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
// [/AI]
