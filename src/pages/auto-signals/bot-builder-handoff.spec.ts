import { isAutoSignalWorkspaceReady } from './bot-builder-handoff';

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
});
