type BlocklyWorkspaceLike = {
    strategy_to_load?: string;
    isDisposed?: boolean | (() => boolean);
    getTopBlocks?: (ordered?: boolean) => unknown[];
};

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
    if (!isAutoSignalWorkspaceReady(workspace, expectedXml)) {
        await loadStrategy(workspace, expectedXml);
        workspace.strategy_to_load = expectedXml;
    }
    if (!isAutoSignalWorkspaceReady(workspace, expectedXml)) {
        throw new Error('Bot Builder did not load the selected strategy.');
    }
    return workspace;
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
