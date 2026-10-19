import OpenContract from './OpenContract';
import { Subject } from 'rxjs';

jest.mock('../../api/api-base', () => ({
    api_base: {
        api: null,
        account_info: { loginid: 'VRTC12345' },
        pushSubscription: jest.fn(),
    },
}));

jest.mock('../utils/broadcast', () => ({
    contract: jest.fn(),
    contractStatus: jest.fn(),
}));

jest.mock('./state/actions', () => ({
    openContractReceived: jest.fn(() => ({ type: 'OPEN_CONTRACT_RECEIVED' })),
    sell: jest.fn(() => ({ type: 'CONTRACT_SOLD' })),
}));

import { api_base } from '../../api/api-base';

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

    it('resumes the XML interpreter only after the matching contract settles', () => {
        const messages = new Subject();
        api_base.api = { onMessage: () => messages };
        const engine = createEngine(123456);
        const resumed = jest.fn();
        engine.data = { contract: null };
        engine.store = { dispatch: jest.fn() };
        engine.updateTotals = jest.fn();
        engine.afterPromise = resumed;
        engine.observeOpenContract();

        messages.next({
            data: {
                msg_type: 'proposal_open_contract',
                proposal_open_contract: {
                    contract_id: '123456',
                    is_sold: 0,
                    is_expired: 0,
                    is_valid_to_sell: 1,
                },
            },
        });
        expect(resumed).not.toHaveBeenCalled();

        messages.next({
            data: {
                msg_type: 'proposal_open_contract',
                proposal_open_contract: {
                    contract_id: '123456',
                    is_sold: 1,
                    is_expired: 1,
                    is_valid_to_sell: 0,
                    transaction_ids: { sell: 987654 },
                    buy_price: 0.35,
                    sell_price: 0.7,
                    currency: 'USD',
                },
            },
        });

        expect(resumed).toHaveBeenCalledTimes(1);
        expect(engine.afterPromise).toBeNull();
        expect(engine.store.dispatch).toHaveBeenLastCalledWith({ type: 'CONTRACT_SOLD' });
    });
});
