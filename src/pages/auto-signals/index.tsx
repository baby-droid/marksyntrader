import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import AutoSignalsPage from './AutoSignalsPage';
import { useAutoSignalsEngine } from './useAutoSignalsEngine';

const AutoSignals = observer(() => {
    const { dashboard, run_panel } = useStore();
    const setActiveTab = useCallback(
        (tab: number) => dashboard.setActiveTab(tab),
        [dashboard],
    );
    const pageProps = useAutoSignalsEngine({
        setActiveTab,
        runPanel: run_panel,
    });

    return <AutoSignalsPage {...pageProps} />;
});

export default AutoSignals;
