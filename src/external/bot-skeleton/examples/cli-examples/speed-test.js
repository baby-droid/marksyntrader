const token = 'Replace with your own token';

window.Bot.init(token, {
    symbol: 'R_100',
    candleInterval: 60,
    contractTypes: ['CALL', 'PUT'],
});

// eslint-disable-next-line no-constant-condition
while (true) {
    window.Bot.start({
        amount: 1,
        currency: 'USD',
        duration: 2,
        duration_unit: 'h',
        basis: 'stake',
    });

    window.watch('before');

    window.Bot.purchase('CALL');

    while (window.watch('during')) {
        if (window.Bot.isSellAvailable()) {
            window.Bot.sellAtMarket();
        }
    }

    window.sleep(1); // Prevent max sell alert because of trading too fast
}
