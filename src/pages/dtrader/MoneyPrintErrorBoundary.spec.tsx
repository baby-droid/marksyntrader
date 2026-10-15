import React from 'react';
import { render, screen } from '@testing-library/react';
import MoneyPrintErrorBoundary from './MoneyPrintErrorBoundary';

describe('MoneyPrintErrorBoundary', () => {
    it('contains render failures to the Money Print page', () => {
        const BrokenPage = () => {
            throw new Error('render failure');
        };
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            render(
                <MoneyPrintErrorBoundary>
                    <BrokenPage />
                </MoneyPrintErrorBoundary>,
            );
            expect(screen.getByRole('alert')).toHaveTextContent('Money Print is temporarily unavailable');
            expect(screen.getByRole('button', { name: 'Retry Money Print' })).toBeInTheDocument();
        } finally {
            consoleError.mockRestore();
        }
    });
});
