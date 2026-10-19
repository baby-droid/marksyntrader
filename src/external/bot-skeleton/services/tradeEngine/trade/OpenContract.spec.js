import OpenContract from './OpenContract';

const createEngine = contractId => {
    const Engine = OpenContract(class {});
    const engine = new Engine();
    engine.contractId = contractId;
    return engine;
};

describe('Bot Builder open-contract matching', () => {
    it('matches a numeric contract ID delivered as a string by the stream', () => {
        expect(createEngine(123456).expectedContractId('123456')).toBe(true);
    });

    it('matches a string contract ID delivered as a number by the stream', () => {
        expect(createEngine('123456').expectedContractId(123456)).toBe(true);
    });

    it('does not match a different contract or an unset ID', () => {
        expect(createEngine(123456).expectedContractId(654321)).toBe(false);
        expect(createEngine('').expectedContractId(123456)).toBe(false);
    });
});
