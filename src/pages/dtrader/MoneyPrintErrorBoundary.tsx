import React from 'react';

type Props = {
    children: React.ReactNode;
};

type State = {
    hasError: boolean;
};

export default class MoneyPrintErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Money Print failed to render; the error was isolated to this page.', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <main className='mp-page'>
                    <section className='mp-card' role='alert' aria-live='assertive'>
                        <h1>Money Print is temporarily unavailable</h1>
                        <p>This page error is contained. Other parts of Marksyntrader remain available.</p>
                        <button
                            type='button'
                            className='mp-button mp-button--primary'
                            onClick={() => this.setState({ hasError: false })}
                        >
                            Retry Money Print
                        </button>
                    </section>
                </main>
            );
        }
        return this.props.children;
    }
}
