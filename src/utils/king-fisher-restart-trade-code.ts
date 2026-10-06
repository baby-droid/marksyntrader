/**
 * Generate the complete statement body for the King Fisher session guard.
 * Statement generators must return one string so Blockly keeps every guard.
 */
export const buildKingFisherRestartTradeCode = (
    takeProfit: string,
    stopLoss: string,
    multiplier: number,
): string =>
    [
        `if (Number(${takeProfit}) > 0 && Bot.getTotalProfit(false) >= Number(${takeProfit})) { if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "WIN", label: "TAKE PROFIT HIT", detail: "Keep trading with the best — TP reached" }); if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "take-profit", profit: Bot.getTotalProfit(false) }); return false; }`,
        `if (Number(${stopLoss}) > 0 && Bot.getTotalProfit(false) <= -Number(${stopLoss})) { if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "LOSS", label: "STOP LOSS HIT", detail: "Trading stopped at the configured limit" }); if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "stop-loss", profit: Bot.getTotalProfit(false) }); return false; }`,
        `if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: Bot.isResult("win") ? "WIN" : "LOSS", label: Bot.isResult("win") ? "TRADE WON" : "TRADE LOST", detail: Bot.isResult("win") ? "Stake reset to base" : "Next stake uses ${multiplier}× martingale" });`,
        `/* The following King Fisher result blocks own the stake variable. The ${multiplier}× setting is retained here for the journal and XML-visible risk control. */`,
    ].join('\n');
