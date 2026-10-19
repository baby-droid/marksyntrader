describe('execution speed controls', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.resetModules();
    });

    it('allows one Fast purchase per eligible tick and removes client pacing', async () => {
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

    it('keeps Auto-Signals to one purchase per eligible tick in Fast mode', async () => {
        const speed = await import('../execution-speed');
        const { setTradeContext } = await import('../trade-metadata');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(true);

        setTradeContext({ page: 'Auto Trades', bot: 'Odd' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);

        setTradeContext({ page: 'Speed Lab', bot: 'Tick Bot' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);

        setTradeContext({ page: 'Scalper Bots', bot: 'Rise' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);

        setTradeContext({ page: 'Auto-Signals', bot: 'Speed Bot With Entry v2.2' });
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.getMaxInflight()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);
        for (const tier of ['normal', 'crazy', 'turbo'] as const) {
            speed.setExecutionSpeed(tier);
            expect(speed.getPurchasesPerTick()).toBe(1);
            expect(speed.getMaxInflight()).toBe(1);
        }
        const purchaseEpochs = new Map<string, number>();
        expect(speed.shouldSkipDuplicateAutoSignalTick(purchaseEpochs, 'R_10', 100)).toBe(false);
        expect(speed.shouldSkipDuplicateAutoSignalTick(purchaseEpochs, 'R_10', 100)).toBe(true);
        expect(speed.shouldSkipDuplicateAutoSignalTick(purchaseEpochs, 'R_10', 101)).toBe(false);
        expect(speed.shouldSkipDuplicateAutoSignalTick(purchaseEpochs, 'R_25', 100)).toBe(false);
        expect(speed.shouldSkipDuplicateAutoSignalTick(purchaseEpochs, 'R_25', 0)).toBe(false);

        speed.setFastExecutionEnabled(false);
        expect(speed.getPurchasesPerTick()).toBe(1);

        speed.setASpeedBoostEnabled(true);
        expect(speed.getPurchasesPerTick()).toBe(1);
        speed.setASpeedBoostEnabled(false);
        setTradeContext({ page: 'Bot Builder', bot: '' });
    });

    it('keeps V3 to one distinct entry per tick under Fast', async () => {
        const speed = await import('../execution-speed');
        const { setTradeContext } = await import('../trade-metadata');

        speed.setExecutionSpeed('normal');
        speed.setFastExecutionEnabled(false);
        setTradeContext({ page: 'Free Bots', bot: 'Normal Killer Bot V3' });
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);
        expect(speed.isInstantExecutionForContext()).toBe(true);
        expect(speed.isTickWiseExecutionEnabled()).toBe(true);

        speed.setFastExecutionEnabled(true);
        expect(speed.isFastExecutionEnabledForContext()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        expect(speed.useDirectBuyForSpeed()).toBe(true);

        speed.setFastExecutionEnabled(false);
        speed.setASpeedBoostEnabled(true);
        expect(speed.isTickWiseExecutionEnabled()).toBe(true);
        expect(speed.getExecutionSpeedDelay()).toBe(0);
        expect(speed.getPurchasesPerTick()).toBe(1);
        speed.setASpeedBoostEnabled(false);
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
        expect(speed.getExecutionSpeedDelay()).toBe(0);

        speed.setFastExecutionEnabled(false);
        setTradeContext({ page: 'Bot Builder', bot: '' });
    });
});