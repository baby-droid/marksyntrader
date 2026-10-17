import { subscribeSharedDerivTicks } from './shared-deriv-ticks';

describe('shared authenticated Deriv tick feed', () => {
    it('shares one market subscription, fans ticks out, and releases it after the last consumer', () => {
        let emit: ((message: any) => void) | undefined;
        const unsubscribe = jest.fn();
        const api = {
            subscribe: jest.fn(() => ({
                subscribe: jest.fn((observer: { next: (message: any) => void }) => {
                    emit = observer.next;
                    return { unsubscribe };
                }),
            })),
        };
        const firstTick = jest.fn();
        const secondTick = jest.fn();
        const first = subscribeSharedDerivTicks(api as any, 'R_10', { next: firstTick });
        const second = subscribeSharedDerivTicks(api as any, 'R_10', { next: secondTick });

        expect(api.subscribe).toHaveBeenCalledTimes(1);
        emit?.({ tick: { symbol: 'R_10', id: 'tick-a', epoch: 100, quote: 100.1 } });
        expect(firstTick).toHaveBeenCalledTimes(1);
        expect(secondTick).toHaveBeenCalledTimes(1);

        first.unsubscribe();
        expect(unsubscribe).not.toHaveBeenCalled();
        second.unsubscribe();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('deduplicates by Deriv tick ID while preserving equal-price ticks with distinct IDs', () => {
        let emit: ((message: any) => void) | undefined;
        const api = {
            subscribe: jest.fn(() => ({
                subscribe: jest.fn((observer: { next: (message: any) => void }) => {
                    emit = observer.next;
                    return { unsubscribe: jest.fn() };
                }),
            })),
        };
        const onTick = jest.fn();
        const sub = subscribeSharedDerivTicks(api as any, 'R_10', { next: onTick });

        emit?.({ tick: { symbol: 'R_10', id: 'same-id', epoch: 100, quote: 100.1 } });
        emit?.({ tick: { symbol: 'R_10', id: 'same-id', epoch: 100, quote: 100.1 } });
        emit?.({ tick: { symbol: 'R_10', id: 'next-id', epoch: 100, quote: 100.1 } });

        expect(onTick).toHaveBeenCalledTimes(2);
        sub.unsubscribe();
    });

    it('keeps different symbols on separate authenticated streams', () => {
        const api = {
            subscribe: jest.fn(() => ({
                subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
            })),
        };
        const first = subscribeSharedDerivTicks(api as any, 'R_10', {});
        const second = subscribeSharedDerivTicks(api as any, 'R_25', {});

        expect(api.subscribe).toHaveBeenCalledTimes(2);
        first.unsubscribe();
        second.unsubscribe();
    });

    it('surfaces API error messages instead of silently waiting for a tick', () => {
        let emit: ((message: any) => void) | undefined;
        const unsubscribe = jest.fn();
        const api = {
            subscribe: jest.fn(() => ({
                subscribe: jest.fn((observer: { next: (message: any) => void }) => {
                    emit = observer.next;
                    return { unsubscribe };
                }),
            })),
        };
        const next = jest.fn();
        const error = jest.fn();
        const sub = subscribeSharedDerivTicks(api as any, '1HZ10V', { next, error });

        emit?.({ error: { code: 'InvalidSymbol', message: 'Market unavailable' } });

        expect(next).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Market unavailable' }));
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        sub.unsubscribe();
    });
});
