type BlocklyWorkspaceLike = {
    strategy_to_load?: string;
    isDisposed?: boolean | (() => boolean);
    getTopBlocks?: (ordered?: boolean) => unknown[];
};

const waitForWorkspaceFrame = () => new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
    } else {
        setTimeout(resolve, 0);
    }
});

export type AutoSignalsRunPanel = {
    is_running?: boolean;
    onRunButtonClick?: () => void | Promise<void>;
};

export const isAutoSignalWorkspaceReady = (
    workspace: BlocklyWorkspaceLike | null | undefined,
    expectedXml: string,
): boolean => {
    if (!workspace || typeof workspace.getTopBlocks !== 'function') return false;

    try {
        const disposed = typeof workspace.isDisposed === 'function'
            ? workspace.isDisposed()
            : workspace.isDisposed;
        return !disposed
            && workspace.strategy_to_load === expectedXml
            && workspace.getTopBlocks(false).length > 0;
    } catch {
        return false;
    }
};

export const ensureAutoSignalWorkspaceLoaded = async (
    workspace: BlocklyWorkspaceLike,
    expectedXml: string,
    loadStrategy: (workspace: BlocklyWorkspaceLike, xml: string) => void | Promise<void>,
) => {
    const loadAlreadyInProgress = workspace.strategy_to_load === expectedXml;
    if (!isAutoSignalWorkspaceReady(workspace, expectedXml) && !loadAlreadyInProgress) {
        await loadStrategy(workspace, expectedXml);
        workspace.strategy_to_load = expectedXml;
    }

    // The official Blockly loader can finish its promise before the next paint
    // has created all workspace blocks. Wait for the imported bot to become
    // available instead of treating that short render window as a load failure.
    for (let attempt = 0; attempt < 300; attempt += 1) {
        if (isAutoSignalWorkspaceReady(workspace, expectedXml)) return workspace;
        await waitForWorkspaceFrame();
    }
    throw new Error('Bot Builder did not load the selected strategy.');
};

export const startAutoSignalsBot = async (
    runPanel: AutoSignalsRunPanel,
    onBackgroundError: (error: unknown) => void,
) => {
    if (!runPanel.onRunButtonClick) throw new Error('Bot Builder Run control is unavailable.');

    const startAttempt = runPanel.onRunButtonClick();
    // The app's Run Panel begins synchronously. Do not await its promise when
    // it represents a bot run that can remain pending until the bot is stopped.
    if (runPanel.is_running) {
        void Promise.resolve(startAttempt).catch(onBackgroundError);
        return;
    }

    await startAttempt;
    if (!runPanel.is_running) {
        throw new Error('Bot Builder did not start this bot. Check the selected account and bot trade settings.');
    }
};
