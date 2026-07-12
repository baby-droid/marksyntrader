// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import manifest from '../../../public/bots/scalpers/manifest.json';
import './scalper-bots.scss';

type TScalperBot = {
    key: string;
    name: string;
    category: 'Even/Odd' | 'Over/Under';
    contractType: string;
    prediction: number | null;
    multiple: boolean;
    xmlFile: string;
};

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];

const CATEGORIES = ['All', 'Even/Odd', 'Over/Under'];

const iconFor = (bot: TScalperBot) => {
    if (bot.contractType === 'DIGITEVEN') return '2️⃣';
    if (bot.contractType === 'DIGITODD') return '1️⃣';
    if (bot.contractType === 'DIGITOVER') return '⬆️';
    return '⬇️';
};

const badgeFor = (bot: TScalperBot) => (bot.multiple ? 'MULTIPLE' : 'SINGLE RUN');
const badgeColorFor = (bot: TScalperBot) => (bot.multiple ? '#00c8ff' : '#00ff88');

const ScalperBots = observer(() => {
    const store = useStore();
    const [category, setCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);
    const [disclaimer, setDisclaimer] = useState(true);

    const filtered = useMemo(
        () =>
            SCALPER_BOTS.filter(b => {
                const matchCat = category === 'All' || b.category === category;
                const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
                return matchCat && matchSearch;
            }),
        [category, search]
    );

    const loadXmlIntoWorkspace = useCallback(
        async (bot: TScalperBot, xml: string) => {
            const workspace = (window as any).Blockly?.derivWorkspace;
            if (!workspace) return false;
            const lm: any = store?.load_modal;
            if (lm?.loadStrategyToBuilder) {
                try {
                    await lm.loadStrategyToBuilder({ id: bot.key, xml, name: bot.name, save_type: 'unsaved' }, false);
                    return true;
                } catch {
                    /* fall through to manual load */
                }
            }
            try {
                const B = (window as any).Blockly;
                const dom = B.Xml.textToDom(xml);
                B.derivWorkspace.asyncClear?.();
                B.Xml.domToWorkspace(dom, B.derivWorkspace);
                B.derivWorkspace.strategy_to_load = xml;
                B.svgResize?.(B.derivWorkspace);
                try {
                    B.derivWorkspace.scrollCenter?.();
                } catch (_) {
                    /* ignore */
                }
                return true;
            } catch (err) {
                console.error('domToWorkspace error', err);
                return false;
            }
        },
        [store]
    );

    const autoRun = useCallback(async () => {
        const run_panel: any = store?.run_panel;
        if (!run_panel?.onRunButtonClick) return;
        if (run_panel.is_running) return;
        // Retry up to 6 times with 500ms gaps — the workspace may still be
        // initialising right after XML is injected
        for (let attempt = 0; attempt < 6; attempt++) {
            try {
                if (run_panel.is_running) return; // already started
                await run_panel.onRunButtonClick();
                return; // success
            } catch {
                if (attempt < 5) await new Promise(r => setTimeout(r, 500));
            }
        }
    }, [store]);

    const loadBot = useCallback(
        async (bot: TScalperBot, andRun: boolean) => {
            setLoadingId(bot.key);
            try {
                const response = await fetch(bot.xmlFile);
                if (!response.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
                const xml = await response.text();

                store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
                store?.run_panel?.toggleDrawer?.(true);

                let loaded = await loadXmlIntoWorkspace(bot, xml);
                if (!loaded) {
                    loaded = await new Promise<boolean>(resolve => {
                        let attempts = 0;
                        const poll = setInterval(async () => {
                            attempts++;
                            const ok = await loadXmlIntoWorkspace(bot, xml);
                            if (ok || attempts >= 50) {
                                clearInterval(poll);
                                resolve(ok);
                            }
                        }, 100);
                    });
                }
                setLoadedId(bot.key);
                setTimeout(() => setLoadedId(null), andRun ? 4000 : 3000);
                if (andRun && loaded) setTimeout(() => autoRun(), 900);
            } catch (e) {
                console.error('Scalper bot load error', e);
                store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            } finally {
                setLoadingId(null);
            }
        },
        [store, loadXmlIntoWorkspace, autoRun]
    );

    return (
        <div className='scalper-bots'>
            {disclaimer && (
                <div className='scalper-bots__disclaimer'>
                    <span className='scalper-bots__disclaimer-icon'>⚠</span>
                    <div className='scalper-bots__disclaimer-text'>
                        <strong>RISK DISCLAIMER</strong> — Scalper bots trade a single run to completion: on a loss the
                        stake is multiplied (martingale) and the bot retries immediately; the run stops automatically
                        the moment it wins. &quot;Multiple&quot; bots restart this cycle after every win. Trading involves
                        risk — trade responsibly.
                    </div>
                    <button className='scalper-bots__disclaimer-close' onClick={() => setDisclaimer(false)}>
                        ✕
                    </button>
                </div>
            )}

            <div className='scalper-bots__header'>
                <div className='scalper-bots__header-left'>
                    <h1>
                        ⚡ <span>AHMED SCALPER BOTS</span>
                    </h1>
                    <p>{SCALPER_BOTS.length} built-in scalper strategies • Single win auto-stop, martingale on loss</p>
                </div>
            </div>

            <div className='scalper-bots__filters'>
                <div className='scalper-bots__search-box'>
                    <span>🔍</span>
                    <input
                        type='text'
                        placeholder='Search scalpers...'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`scalper-bots__filter-btn ${category === cat ? 'active' : ''}`}
                        onClick={() => setCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
                <span className='scalper-bots__count'>{filtered.length} bots</span>
            </div>

            <div className='scalper-bots__grid'>
                {filtered.map(bot => (
                    <div
                        key={bot.key}
                        className={`scalper-bots__card ${loadedId === bot.key ? 'scalper-bots__card--loaded' : ''}`}
                        style={{ '--accent': badgeColorFor(bot) } as React.CSSProperties}
                    >
                        <div className='scalper-bots__card-glow' />
                        <div className='scalper-bots__card-icon-ring'>
                            <div className='scalper-bots__card-icon'>{iconFor(bot)}</div>
                        </div>
                        <div className='scalper-bots__badge' style={{ background: badgeColorFor(bot) }}>
                            {badgeFor(bot)}
                        </div>
                        <div className='scalper-bots__card-body'>
                            <span className='scalper-bots__category-tag'>{bot.category}</span>
                            <h3 className='scalper-bots__bot-name'>{bot.name}</h3>
                            <p className='scalper-bots__bot-desc'>
                                {bot.multiple
                                    ? 'Auto-restarts after every win — repeats the win-then-stop cycle continuously.'
                                    : 'Runs until the first win, then stops automatically.'}
                            </p>
                        </div>
                        <div className='scalper-bots__card-meta'>
                            <div className='scalper-bots__meta-item'>
                                <span className='scalper-bots__meta-label'>TYPE</span>
                                <span className='scalper-bots__meta-val'>{bot.contractType}</span>
                            </div>
                            {bot.prediction !== null && (
                                <div className='scalper-bots__meta-item'>
                                    <span className='scalper-bots__meta-label'>BARRIER</span>
                                    <span className='scalper-bots__meta-val'>{bot.prediction}</span>
                                </div>
                            )}
                            <div className='scalper-bots__meta-item'>
                                <span className='scalper-bots__meta-label'>MARTINGALE</span>
                                <span className='scalper-bots__meta-val'>2x</span>
                            </div>
                        </div>
                        <div className='scalper-bots__btn-row'>
                            <button
                                className='scalper-bots__load-btn scalper-bots__load-btn--secondary'
                                onClick={() => loadBot(bot, false)}
                                disabled={loadingId === bot.key}
                                title='Load into Bot Builder (without running)'
                            >
                                {loadingId === bot.key ? '⏳' : '📂 Load Bot'}
                            </button>
                            <button
                                className={`scalper-bots__load-btn ${loadedId === bot.key ? 'loaded' : ''}`}
                                onClick={() => loadBot(bot, true)}
                                disabled={loadingId === bot.key}
                                title='Load & Auto-Run'
                            >
                                {loadingId === bot.key ? (
                                    <span>⏳ Loading...</span>
                                ) : loadedId === bot.key ? (
                                    <span>🚀 Running!</span>
                                ) : (
                                    <>▶ Load &amp; Run</>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default ScalperBots;
