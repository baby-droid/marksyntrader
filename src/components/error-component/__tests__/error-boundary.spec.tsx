import { render } from '@testing-library/react';
import ErrorBoundary from '../error-boundary';
import { isChunkLoadFailure, reloadAfterChunkFailure } from '@/utils/chunk-recovery';

jest.mock('../index', () => () => null);

jest.mock('@/utils/chunk-recovery', () => ({
    isChunkLoadFailure: jest.fn(),
    reloadAfterChunkFailure: jest.fn(),
}));

const ThrowError = ({ error }: { error: Error }) => {
    throw error;
};

describe('<ErrorBoundary />', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('tries the guarded reload when a lazy chunk fails', () => {
        jest.mocked(isChunkLoadFailure).mockReturnValue(true);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        render(
            <ErrorBoundary root_store={{}}>
                <ThrowError error={new Error('Loading CSS chunk failed')} />
            </ErrorBoundary>,
        );

        expect(reloadAfterChunkFailure).toHaveBeenCalled();
    });

    it('does not reload for ordinary render errors', () => {
        jest.mocked(isChunkLoadFailure).mockReturnValue(false);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        render(
            <ErrorBoundary root_store={{}}>
                <ThrowError error={new Error('Ordinary render error')} />
            </ErrorBoundary>,
        );

        expect(reloadAfterChunkFailure).not.toHaveBeenCalled();
    });
});
