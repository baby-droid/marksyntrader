// @ts-nocheck — Bot Builder store APIs are intentionally flexible across app shells.
import React, { useCallback, useState } from 'react';
import AiCycleGuide from '@/components/ai-cycle-guide/ai-cycle-guide';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base, load, save_types } from '@/external/bot-skeleton';
import { isFastExecutionEnabled } from '@/utils/execution-speed';
import { setTradeContext } from '@/utils/trade-metadata';
import { patchGuidedCycleXml, DiffersCycleBotId } from '@/utils/differs-cycle';
import './cycle-pattern-detector.scss';

const GUIDED_BOTS: Record<DiffersCycleBotId, { name: string; xmlFile: string }> = {
    'differs-edge-scanner': {
        name: 'Differs Edge Scanner — Recovery Matrix',
        xmlFile: '/bots/differs-edge-scanner.xml',
    },
    'ahmed-differs-cycle': {
        name: 'AHMED DIFFERS CYCLE',
        xmlFile: '/bots/ahmed-differs-cycle.xml',
    },
};

const CyclePatternDetector: React.FC = () => {
    const store: any = useStore();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadGuidedBot = useCallback(async (
        botId: DiffersCycleBotId,
        symbol: string,
        differDigit: number,
    ) => {
        const bot = GUIDED_BOTS[botId];
        const runPanel: any = store?.run_panel;
        if (!bot || loading) return;
        if (runPanel?.is_running) {
            console.warn('AI Engine cannot load a guided bot while another bot is running');
            return;
        }

        setLoading(true);
        setTradeContext({ page: 'AI Engine', bot: bot.name });
        try {
            const response = await fetch(bot.xmlFile);
            if (!response.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
            const xml = patchGuidedCycleXml(await response.text(), symbol, differDigit);

            (window as any).__pendingBotXml = xml;
            (window as any).__pendingBotName = bot.name;
            (window as any).__aiCycleGuidance = {
                botId,
                symbol,
                differDigit,
                updatedAt: Date.now(),
            };
            window.dispatchEvent(new CustomEvent('ai:cycle-guidance', {
                detail: (window as any).__aiCycleGuidance,
            }));

            store?.dashboard?.setActiveTab?.(DBOT_TABS.BOT_BUILDER);
            store?.run_panel?.toggleDrawer?.(true);

            let workspace: any = (window as any).Blockly?.derivWorkspace;
            if (!workspace) {
                await new Promise<void>((resolve, reject) => {
                    let attempts = 0;
                    const poll = window.setInterval(() => {
                        attempts += 1;
                        workspace = (window as any).Blockly?.derivWorkspace;
                        if (workspace) {
                            window.clearInterval(poll);
                            resolve();
                        } else if (attempts >= 100) {
                            window.clearInterval(poll);
                            reject(new Error('Bot Builder workspace unavailable after 10 seconds'));
                        }
                    }, 100);
                });
            }
            if (!workspace) throw new Error('Bot Builder workspace unavailable');

            let loaded = false;
            const loadModal: any = store?.load_modal;
            try {
                if (loadModal?.loadStrategyToBuilder) {
                    await loadModal.loadStrategyToBuilder(
                        { id: botId, xml, name: bot.name, save_type: 'unsaved' },
                        false,
                    );
                    loaded = true;
                }
            } catch {}

            if (!loaded) {
                try {
                    await load({
                        block_string: xml,
                        drop_event: null,
                        file_name: bot.name,
                        strategy_id: botId,
                        from: save_types.LOCAL,
                        workspace,
                        showIncompatibleStrategyDialog: false,
                        show_snackbar: false,
                    });
                    loaded = true;
                } catch {}
            }

            if (!loaded) {
                const B: any = (window as any).Blockly;
                const dom = B.Xml.textToDom(xml);
                workspace.asyncClear?.();
                B.Xml.domToWorkspace(dom, workspace);
                B.svgResize?.(workspace);
                workspace.scrollCenter?.();
                loaded = true;
            }

            workspace.strategy_to_load = xml;
            if (loaded) {
                window.setTimeout(() => {
                    if (!runPanel?.is_running) void runPanel?.onRunButtonClick?.();
                }, isFastExecutionEnabled() ? 0 : 900);
            }
        } catch (error) {
            console.error('AI Engine guided Load & Run failed', error);
        } finally {
            setLoading(false);
        }
    }, [loading, store]);

    return (
        <div className='cycle-pattern-detector'>
            <button
                type='button'
                className='run-panel__cycle-trigger'
                title='Open AI Engine Cycle Pattern Detector'
                aria-label='Open AI Engine Cycle Pattern Detector'
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <span /><span /><span /><span />
            </button>
            {open && (
                <section className='cycle-pattern-detector__panel' role='dialog' aria-label='AI Engine Cycle Pattern Detector'>
                    <AiCycleGuide onLoadGuided={loadGuidedBot} />
                </section>
            )}
        </div>
    );
};

export default CyclePatternDetector;