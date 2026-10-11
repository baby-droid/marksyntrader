type BlocklyWorkspaceLike = {
    strategy_to_load?: string;
    isDisposed?: boolean | (() => boolean);
    getTopBlocks?: (ordered?: boolean) => unknown[];
};

export const isAutoSignalWorkspaceReady = (
    workspace: BlocklyWorkspaceLike | null | undefined,
    expectedXml: string,
): workspace is BlocklyWorkspaceLike => {
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
