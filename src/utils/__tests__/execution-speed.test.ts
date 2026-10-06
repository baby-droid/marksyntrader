describe('execution speed controls', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.resetModules();
    });

    it('makes Fast one-contract-per-live-tick and removes client pacing', async () => {
        const speed = await import('../execution-speed');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(true);

        expect(speed.isFastExecutionEnabled()).toBe(true);
        expect(speed.isTickWiseExecutionEnabled()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);
    });

    it('applies the same tick-wise path to the header A-SPEED preset', async () => {
        const speed = await import('../execution-speed');

        speed.setASpeedBoostEnabled(true);

        expect(speed.isASpeedBoostEnabled()).toBe(true);
        expect(speed.isTickWiseExecutionEnabled()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);
        expect(speed.isFastExecutionEnabled()).toBe(false);

        speed.setASpeedBoostEnabled(false);
    });

    it('keeps Fast scoped to Bot Builder, Scalper, and designated Free Bot contexts', async () => {
        const speed = await import('../execution-speed');
        const { setTradeContext } = await import('../trade-metadata');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(true);

        setTradeContext({ page: 'Auto Trades', bot: 'Odd' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(false);
        expect(speed.getExecutionSpeedDelay()).toBe(200);

        setTradeContext({ page: 'Scalper Bots', bot: 'Rise' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);

        speed.setFastExecutionEnabled(false);
        setTradeContext({ page: 'Bot Builder', bot: '' });
    });

    it('uses zero-delay direct buys for Normal Killer Bot V3 without fan-out', async () => {
        const speed = await import('../execution-speed');
        const { setTradeContext } = await import('../trade-metadata');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(false);
        setTradeContext({ page: 'Free Bots', bot: 'Normal Killer Bot V3' });
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);
        expect(speed.isInstantExecutionForContext()).toBe(true);

        speed.setFastExecutionEnabled(true);
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);

        speed.setFastExecutionEnabled(false);
        for (const tier of ['crazy', 'turbo'] as const) {
            speed.setExecutionSpeed(tier);
            expect(speed.getPurchasesPerTick()).toBe(1);
            expect(speed.getExecutionSpeedDelay()).toBe(0);
            expect(speed.useDirectBuyForSpeed()).toBe(true);
        }
        speed.setExecutionSpeed('normal');
        setTradeContext({ page: 'Bot Builder', bot: '' });
        speed.setExecutionSpeed('normal');
    });

    it('enables zero-delay Fast for 2 Prediction Cycle but not other Free Bots', async () => {
        const speed = await import('../execution-speed');
        const { setTradeContext } = await import('../trade-metadata');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(false);
        speed.setExecutionSpeed('turbo');
        expect(speed.getPurchasesPerTick()).toBe(1);

        speed.setFastExecutionEnabled(true);
        speed.setExecutionSpeed('normal');
        setTradeContext({ page: 'Free Bots', bot: '2 PREDICTION CYCLE' });

        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);

        setTradeContext({ page: 'Free Bots', bot: 'ACC FLIPPER' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(false);
        expect(speed.getExecutionSpeedDelay()).toBe(200);

        speed.setFastExecutionEnabled(false);
        setTradeContext({ page: 'Bot Builder', bot: '' });
    });
});