import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ExecutionSpeedControl from './execution-speed-control';
import {
    getExecutionSpeed,
    isFastExecutionEnabled,
    setExecutionSpeed,
    setFastExecutionEnabled,
} from '@/utils/execution-speed';

describe('ExecutionSpeedControl', () => {
    beforeEach(() => {
        setExecutionSpeed('normal');
        setFastExecutionEnabled(false);
    });

    afterEach(() => {
        cleanup();
        setExecutionSpeed('normal');
        setFastExecutionEnabled(false);
    });

    it('renders Normal, Crazy, Turbo, and Fast and updates the shared execution settings', () => {
        render(<ExecutionSpeedControl />);

        fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
        expect(getExecutionSpeed()).toBe('crazy');
        expect(screen.getByRole('button', { name: 'Crazy' }).getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Turbo' }));
        expect(getExecutionSpeed()).toBe('turbo');

        fireEvent.click(screen.getByRole('button', { name: 'Fast' }));
        expect(isFastExecutionEnabled()).toBe(true);
        expect(screen.getByRole('button', { name: 'Fast' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('disables mode changes while a bot is running', () => {
        render(<ExecutionSpeedControl disabled />);

        expect(screen.getByRole('button', { name: 'Normal' }).hasAttribute('disabled')).toBe(true);
        expect(screen.getByRole('button', { name: 'Fast' }).hasAttribute('disabled')).toBe(true);
    });
});
