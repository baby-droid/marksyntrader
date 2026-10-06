import { configure } from 'mobx';
import { getSavedWorkspaces } from '@/external/bot-skeleton';
import BlocklyStore from './blockly-store';

jest.mock('@/external/bot-skeleton', () => ({
    getSavedWorkspaces: jest.fn(),
    onWorkspaceResize: jest.fn(),
}));

describe('BlocklyStore.checkForSavedBots', () => {
    const getSavedWorkspacesMock = getSavedWorkspaces as jest.MockedFunction<typeof getSavedWorkspaces>;

    afterEach(() => {
        configure({ enforceActions: 'observed' });
        jest.restoreAllMocks();
    });

    it('updates the observable cache in an action after the async lookup resolves', async () => {
        configure({ enforceActions: 'always' });
        getSavedWorkspacesMock.mockResolvedValue([{}] as Awaited<ReturnType<typeof getSavedWorkspaces>>);
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const store = new BlocklyStore({} as never);

        await store.checkForSavedBots();

        expect(store.has_saved_bots).toBe(true);
        expect(warning).not.toHaveBeenCalledWith(
            expect.stringContaining('changing (observed) observable values without using an action')
        );
    });

    it('clears the cache in an action when the async lookup fails', async () => {
        configure({ enforceActions: 'always' });
        getSavedWorkspacesMock.mockRejectedValue(new Error('storage unavailable'));
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const store = new BlocklyStore({} as never);

        await store.checkForSavedBots();

        expect(store.has_saved_bots).toBe(false);
    });
});
