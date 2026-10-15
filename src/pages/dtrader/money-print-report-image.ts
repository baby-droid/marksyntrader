import type { MoneyPrintNeuralReport } from './money-print-neural-analysis';

const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
};

export const downloadMoneyPrintReportImage = (
    report: MoneyPrintNeuralReport,
    currency = 'USD',
) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not create the report image.');

    const background = context.createLinearGradient(0, 0, 1200, 1500);
    background.addColorStop(0, '#07162d');
    background.addColorStop(1, '#0b2544');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(94, 175, 255, 0.32)';
    context.lineWidth = 2;
    context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

    let y = 100;
    const left = 78;
    const maxWidth = canvas.width - left * 2;
    const drawWrapped = (text: string, options: { color?: string; font?: string; lineHeight?: number } = {}) => {
        context.fillStyle = options.color ?? '#dceaff';
        context.font = options.font ?? '22px Arial, sans-serif';
        const lineHeight = options.lineHeight ?? 34;
        wrapText(context, text, maxWidth).forEach(line => {
            context.fillText(line, left, y);
            y += lineHeight;
        });
    };

    drawWrapped('MONEY PRINT · NEURAL LINK', { color: '#78d9ff', font: 'bold 25px Arial, sans-serif', lineHeight: 40 });
    drawWrapped('Challenge analysis report', { color: '#f3f8ff', font: 'bold 42px Arial, sans-serif', lineHeight: 62 });
    drawWrapped(new Date(report.generatedAt).toLocaleString(), { color: '#91a9c4', font: '18px Arial, sans-serif', lineHeight: 42 });

    const verdictColor = report.verdict === 'DO NOT TRADE'
        ? '#ff777b'
        : report.verdict === 'WAIT' ? '#ffd17b' : '#80e1b3';
    context.fillStyle = verdictColor;
    context.font = 'bold 25px Arial, sans-serif';
    context.fillText(report.verdict, left, y);
    y += 48;

    drawWrapped(report.summary, { color: '#f3f8ff', font: 'bold 23px Arial, sans-serif', lineHeight: 36 });
    y += 18;

    drawWrapped('CHALLENGE BRIEF', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
    drawWrapped(report.challenge || 'No challenge brief provided.', { lineHeight: 31 });
    y += 12;

    if (report.accountContext) {
        const account = report.accountContext;
        drawWrapped('ACCOUNT & RISK SETTINGS', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
        drawWrapped(
            `${account.accountType} · balance ${account.balance == null ? 'unavailable' : `${account.balance.toFixed(2)} ${account.currency}`} · next stake ${account.nextStake.toFixed(2)} ${account.currency}${account.autoStake ? ` · ${account.riskPercent}% cap` : ' · fixed stake'}`,
            { lineHeight: 30 },
        );
        drawWrapped(
            `TP ${account.takeProfit.toFixed(2)} ${account.currency} · SL ${account.stopLoss.toFixed(2)} ${account.currency} · session P/L ${account.sessionPnl.toFixed(2)} ${account.currency} · ${account.strategyMode}${account.scheduledSessions ? ' · EAT schedule enabled' : ''}`,
            { lineHeight: 30 },
        );
        y += 12;
    }

    if (report.route) {
        drawWrapped('RESEARCH ROUTE', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
        drawWrapped(`${report.route.market} · ${report.route.contract}`, { color: '#f3f8ff', font: 'bold 24px Arial, sans-serif', lineHeight: 38 });
        drawWrapped(report.route.entryRule, { lineHeight: 34 });
        y += 18;
    }

    drawWrapped('STRATEGIES', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
    report.strategies.forEach((strategy, index) => drawWrapped(`${index + 1}. ${strategy}`, { lineHeight: 32 }));
    y += 14;

    drawWrapped('SETTLED SIDE PERFORMANCE', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
    if (!report.sidePerformance.length) {
        drawWrapped('No settled trades are available for this account yet.', { lineHeight: 32 });
    } else {
        report.sidePerformance.slice(0, 6).forEach(side => {
            const winRate = side.winRate == null ? '—' : `${(side.winRate * 100).toFixed(1)}%`;
            drawWrapped(
                `${side.side}: ${side.wins}W / ${side.losses}L · ${winRate} wins · ${side.netProfit.toFixed(2)} ${currency}`,
                { lineHeight: 30 },
            );
        });
    }
    y += 14;

    drawWrapped('EVIDENCE', { color: '#78d9ff', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
    report.evidence.slice(0, 4).forEach(item => drawWrapped(`• ${item}`, { color: '#bdcde1', font: '18px Arial, sans-serif', lineHeight: 27 }));
    y += 14;

    drawWrapped('RISK NOTES', { color: '#ffcc81', font: 'bold 19px Arial, sans-serif', lineHeight: 32 });
    report.riskNotes.forEach(note => drawWrapped(`• ${note}`, { color: '#d5deeb', font: '18px Arial, sans-serif', lineHeight: 27 }));

    canvas.toBlob(blob => {
        const link = document.createElement('a');
        if (blob) {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `money-print-neural-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.png`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            return;
        }
        link.href = canvas.toDataURL('image/png');
        link.download = `money-print-neural-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.png`;
        link.click();
    }, 'image/png');
};
