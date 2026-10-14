import { isAutoSignalWorkspaceReady, startAutoSignalsBot } from './bot-builder-handoff';

describe('Auto-Signals Bot Builder handoff readiness', () => {
    const xml = '<xml><block type="trade_definition" /></xml>';

    it('waits for a live workspace containing the selected bot XML', () => {
        expect(isAutoSignalWorkspaceReady(null, xml)).toBe(false);
        expect(isAutoSignalWorkspaceReady({
            strategy_to_load: '<xml />',
            getTopBlocks: () => [{}],
        }, xml)).toBe(false);
        expect(isAutoSignalWorkspaceReady({
            strategy_to_load: xml,
            getTopBlocks: () => [],
        }, xml)).toBe(false);
        expect(isAutoSignalWorkspaceReady({
            strategy_to_load: xml,
            isDisposed: () => true,
            getTopBlocks: () => [{}],
        }, xml)).toBe(false);
    });

    it('accepts the selected XML once Blockly has finished creating its blocks', () => {
        expect(isAutoSignalWorkspaceReady({
            strategy_to_load: xml,
            isDisposed: () => false,
            getTopBlocks: () => [{}],
        }, xml)).toBe(true);
    });

    it('automatically runs the bot as soon as the loaded workspace is ready', async () => {
        const runPanel: { is_running: boolean; onRunButtonClick: jest.Mock } = {
            is_running: false,
            onRunButtonClick: jest.fn(() => {
                runPanel.is_running = true;
            }),
        };

        await startAutoSignalsBot(runPanel, jest.fn());

        expect(runPanel.onRunButtonClick).toHaveBeenCalledTimes(1);
        expect(runPanel.is_running).toBe(true);
    });

    it('does not treat a completed Run click as a start unless the panel is actually running', async () => {
        await expect(startAutoSignalsBot({
            is_running: false,
            onRunButtonClick: async () => undefined,
        }, jest.fn())).rejects.toThrow('Bot Builder did not start this bot');
    });

    it('reports a later start failure without waiting for the bot run to finish', async () => {
        let rejectRun: (error: Error) => void = () => undefined;
        let backgroundError: unknown;
        const runPanel: { is_running: boolean; onRunButtonClick: jest.Mock } = {
            is_running: false,
            onRunButtonClick: jest.fn(() => {
                runPanel.is_running = true;
                return new Promise<void>((_resolve, reject) => {
                    rejectRun = reject;
                });
            }),
        };

        await startAutoSignalsBot(runPanel, (error) => {
            backgroundError = error;
        });
        rejectRun(new Error('Run failed'));
        await Promise.resolve();

        expect(backgroundError).toEqual(new Error('Run failed'));
    });
});
