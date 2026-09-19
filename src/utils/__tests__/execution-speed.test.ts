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
});