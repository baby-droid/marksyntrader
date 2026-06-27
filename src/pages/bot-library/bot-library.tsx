import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSavedWorkspaces } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './bot-library.scss';

interface BotEntry {
    id: string;
    name: string;
    xml: string;
    timestamp: number;
    source: 'workspace' | 'upload';
    size: number;
}

const STORAGE_KEY = 'marksyntrader_bot_library';

function loadLibrary(): BotEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as BotEntry[]) : [];
    } catch {
        return [];
    }
}

function saveLibrary(bots: BotEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
}

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function xmlPreview(xml: string) {
    const match = xml.match(/<block[^>]+type="([^"]+)"/);
    return match ? `Root: ${match[1]}` : xml.slice(0, 60).trim();
}

function iconFor(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes('martingale')) return { icon: '📈', bg: 'rgba(16, 185, 129, 0.15)', badge: 'Martingale', badgeBg: 'rgba(16, 185, 129, 0.2)', badgeColor: '#10b981' };
    if (lower.includes('dAlembertl') || lower.includes('dalembert')) return { icon: '📊', bg: 'rgba(14, 165, 233, 0.15)', badge: "D'Alembert", badgeBg: 'rgba(14, 165, 233, 0.2)', badgeColor: '#0ea5e9' };
    if (lower.includes('oscar') || lower.includes('grind')) return { icon: '🎯', bg: 'rgba(168, 85, 247, 0.15)', badge: 'Oscar', badgeBg: 'rgba(168, 85, 247, 0.2)', badgeColor: '#a855f7' };
    if (lower.includes('accum')) return { icon: '💰', bg: 'rgba(245, 158, 11, 0.15)', badge: 'Accumulators', badgeBg: 'rgba(245, 158, 11, 0.2)', badgeColor: '#f59e0b' };
    if (lower.includes('digit')) return { icon: '🔢', bg: 'rgba(239, 68, 68, 0.15)', badge: 'Digits', badgeBg: 'rgba(239, 68, 68, 0.2)', badgeColor: '#ef4444' };
    return { icon: '🤖', bg: 'rgba(56, 189, 248, 0.15)', badge: 'Custom', badgeBg: 'rgba(56, 189, 248, 0.2)', badgeColor: '#38bdf8' };
}

interface ToastProps { message: string; type: 'success' | 'error'; }

const BotLibrary: React.FC = () => {
    const { load_modal, dashboard } = useStore();
    const [bots, setBots] = useState<BotEntry[]>([]);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<ToastProps | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const refreshBots = useCallback(async () => {
        const library = loadLibrary();
        try {
            const workspaces = (await getSavedWorkspaces()) as Array<{ id: string; name: string; xml: string; timestamp: number }>;
            const wsBots: BotEntry[] = workspaces.map(w => ({
                id: `ws_${w.id}`,
                name: w.name || 'Untitled Bot',
                xml: w.xml || '',
                timestamp: w.timestamp || Date.now(),
                source: 'workspace' as const,
                size: (w.xml || '').length,
            }));
            const wsIds = new Set(wsBots.map(b => b.id));
            const merged = [...wsBots, ...library.filter(b => !wsIds.has(b.id))];
            merged.sort((a, b) => b.timestamp - a.timestamp);
            setBots(merged);
        } catch {
            setBots(library);
        }
    }, []);

    useEffect(() => { refreshBots(); }, [refreshBots]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.name.endsWith('.xml')) {
                showToast(`${file.name} is not an XML file`, 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = ev => {
                const xml = ev.target?.result as string;
                if (!xml) return;
                const newBot: BotEntry = {
                    id: `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    name: file.name.replace(/\.xml$/i, ''),
                    xml,
                    timestamp: Date.now(),
                    source: 'upload',
                    size: file.size,
                };
                const current = loadLibrary();
                saveLibrary([newBot, ...current]);
                refreshBots();
                showToast(`"${newBot.name}" added to library`);
            };
            reader.readAsText(file);
        });
        e.target.value = '';
    };

    const handleLoad = useCallback(async (bot: BotEntry) => {
        try {
            if (load_modal && 'previewRecentStrategy' in load_modal) {
                (load_modal as any).previewRecentStrategy({ xml: bot.xml, id: bot.id.replace('ws_', ''), name: bot.name });
            } else if (window.Blockly?.derivWorkspace) {
                const xmlDom = window.Blockly.Xml.textToDom(bot.xml);
                window.Blockly.Xml.clearWorkspaceAndLoadFromXml(xmlDom, window.Blockly.derivWorkspace);
            }
            dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            showToast(`"${bot.name}" loaded into workspace`);
        } catch (err) {
            showToast('Failed to load bot into workspace', 'error');
        }
    }, [load_modal, dashboard]);

    const handleDelete = useCallback((bot: BotEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        if (bot.source === 'upload') {
            const current = loadLibrary().filter(b => b.id !== bot.id);
            saveLibrary(current);
            refreshBots();
            showToast(`"${bot.name}" deleted`);
        } else {
            showToast('Use the Dashboard to delete workspace bots', 'error');
        }
    }, [refreshBots]);

    const filtered = bots.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

    const uploadedBots = filtered.filter(b => b.source === 'upload');
    const workspaceBots = filtered.filter(b => b.source === 'workspace');

    return (
        <div className='bot-library'>
            <div className='bot-library__header'>
                <div className='bot-library__title-group'>
                    <h2>🤖 Bot Library</h2>
                    <p>Manage, upload and load your trading bot XML files</p>
                </div>
                <div className='bot-library__actions'>
                    <div className='bot-library__search-bar'>
                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                            <circle cx='11' cy='11' r='8' /><line x1='21' y1='21' x2='16.65' y2='16.65' />
                        </svg>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder='Search bots…'
                        />
                    </div>
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='.xml'
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleUpload}
                    />
                    <button className='bot-library__upload-btn' onClick={() => fileInputRef.current?.click()}>
                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                            <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' />
                            <polyline points='17 8 12 3 7 8' /><line x1='12' y1='3' x2='12' y2='15' />
                        </svg>
                        Upload XML
                    </button>
                </div>
            </div>

            <div className='bot-library__content'>
                {filtered.length === 0 ? (
                    <div className='bot-library__empty'>
                        <div className='bot-library__empty-icon'>🤖</div>
                        <h3>{search ? 'No bots match your search' : 'No bots yet'}</h3>
                        <p>
                            {search
                                ? 'Try a different search term.'
                                : 'Upload XML bot files or save your workspace bots from the Bot Builder tab.'}
                        </p>
                        {!search && (
                            <button onClick={() => fileInputRef.current?.click()}>
                                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                    <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' />
                                    <polyline points='17 8 12 3 7 8' /><line x1='12' y1='3' x2='12' y2='15' />
                                </svg>
                                Upload your first bot
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {workspaceBots.length > 0 && (
                            <>
                                <p className='bot-library__section-title'>Saved Workspaces ({workspaceBots.length})</p>
                                <div className='bot-library__grid'>
                                    {workspaceBots.map(bot => <BotCard key={bot.id} bot={bot} onLoad={handleLoad} onDelete={handleDelete} />)}
                                </div>
                            </>
                        )}
                        {uploadedBots.length > 0 && (
                            <>
                                <p className='bot-library__section-title'>Uploaded Bots ({uploadedBots.length})</p>
                                <div className='bot-library__grid'>
                                    {uploadedBots.map(bot => <BotCard key={bot.id} bot={bot} onLoad={handleLoad} onDelete={handleDelete} />)}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {toast && (
                <div className={`toast-notification toast-notification--${toast.type}`}>
                    {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.message}
                </div>
            )}
        </div>
    );
};

interface BotCardProps {
    bot: BotEntry;
    onLoad: (bot: BotEntry) => void;
    onDelete: (bot: BotEntry, e: React.MouseEvent) => void;
}

const BotCard: React.FC<BotCardProps> = ({ bot, onLoad, onDelete }) => {
    const { icon, bg, badge, badgeBg, badgeColor } = iconFor(bot.name);
    return (
        <div className='bot-card' onClick={() => onLoad(bot)}>
            <div className='bot-card__top'>
                <div className='bot-card__icon' style={{ background: bg }}>{icon}</div>
                <span
                    className='bot-card__badge'
                    style={{ background: badgeBg, color: badgeColor }}
                >
                    {badge}
                </span>
            </div>

            <h3 className='bot-card__name' title={bot.name}>{bot.name}</h3>

            <div className='bot-card__meta'>
                <span>
                    <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <rect x='3' y='4' width='18' height='18' rx='2' ry='2' /><line x1='16' y1='2' x2='16' y2='6' /><line x1='8' y1='2' x2='8' y2='6' /><line x1='3' y1='10' x2='21' y2='10' />
                    </svg>
                    {formatDate(bot.timestamp)}
                </span>
                <span>
                    <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' /><polyline points='14 2 14 8 20 8' />
                    </svg>
                    {formatBytes(bot.size)}
                </span>
                <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '10px' }}>
                    {bot.source === 'upload' ? '↑ uploaded' : '💾 saved'}
                </span>
            </div>

            {bot.xml && (
                <div className='bot-card__preview'>{xmlPreview(bot.xml)}</div>
            )}

            <div className='bot-card__actions'>
                <button className='load-btn' onClick={e => { e.stopPropagation(); onLoad(bot); }}>
                    ▶ Load
                </button>
                <button className='delete-btn' onClick={e => onDelete(bot, e)}>
                    🗑 Delete
                </button>
            </div>
        </div>
    );
};

export default BotLibrary;
