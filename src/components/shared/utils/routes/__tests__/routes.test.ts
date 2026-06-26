import { getDerivDomain } from '../routes';

describe('getDerivDomain', () => {
    const ORIGINAL_LOCATION = window.location;
    const ORIGINAL_ENV = process.env.NEXT_PUBLIC_DERIV_ENV;

    const setHostname = (hostname: string) => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...ORIGINAL_LOCATION, hostname },
        });
    };

    const setEnv = (env: string | undefined) => {
        if (env === undefined) {
            delete process.env.NEXT_PUBLIC_DERIV_ENV;
        } else {
            process.env.NEXT_PUBLIC_DERIV_ENV = env;
        }
    };

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION });
        setEnv(ORIGINAL_ENV);
    });

    describe('NEXT_PUBLIC_DERIV_ENV is authoritative', () => {
        it('resolves staging-home when preview, even on a non-staging partner hostname', () => {
            setEnv('preview');
            setHostname('mybot.partner.com');
            expect(getDerivDomain('derivHome')).toBe('https://staging-home.deriv.com');
        });

        it('treats legacy "staging" value the same as preview', () => {
            setEnv('staging');
            setHostname('mybot.partner.com');
            expect(getDerivDomain('derivHome')).toBe('https://staging-home.deriv.com');
        });

        it('resolves production home when production, on any hostname', () => {
            setEnv('production');
            setHostname('staging.something.com');
            expect(getDerivDomain('derivHome')).toBe('https://home.deriv.com');
        });
    });

    describe('hostname fallback when env var is unset (local dev)', () => {
        it('resolves dev-home on localhost', () => {
            setEnv(undefined);
            setHostname('localhost');
            expect(getDerivDomain('derivHome')).toBe('https://dev-home.deriv.com');
        });

        it('resolves dev-dtrader on localhost', () => {
            setEnv(undefined);
            setHostname('localhost');
            expect(getDerivDomain('derivDtrader')).toBe('https://dev-dtrader.deriv.com');
        });

        it('resolves staging-home when hostname contains "staging"', () => {
            setEnv(undefined);
            setHostname('staging-app.deriv.com');
            expect(getDerivDomain('derivHome')).toBe('https://staging-home.deriv.com');
        });

        it('resolves production home on a production-like hostname', () => {
            setEnv(undefined);
            setHostname('mybot.partner.com');
            expect(getDerivDomain('derivHome')).toBe('https://home.deriv.com');
        });
    });
});
