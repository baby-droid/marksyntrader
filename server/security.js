const crypto = require('node:crypto');

const ALLOWED_STRATEGIES = new Set([
    'Multimarket',
    'RC Even/Odd',
    'RC Over4/Under5',
    '%Even/Odd',
    'Matches/Differs',
    'Rise/Fall',
]);

function constantTimeStringEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signTicket(payload, key) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}

function readTicket(ticket, key) {
    if (typeof ticket !== 'string') return null;
    const [encoded, signature, extra] = ticket.split('.');
    if (!encoded || !signature || extra !== undefined) return null;
    const expected = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
    if (!constantTimeStringEqual(signature, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!payload || typeof payload !== 'object' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function hashAccount(loginId, key) {
    if (typeof loginId !== 'string' || !/^[A-Z0-9]{4,20}$/.test(loginId)) {
        throw new Error('Deriv returned an invalid account identifier.');
    }
    return crypto.createHmac('sha256', key).update(`money-print-account:${loginId}`).digest('hex');
}

function hashIp(ip, key) {
    return crypto.createHmac('sha256', key).update(`money-print-admin-ip:${ip || 'unknown'}`).digest('hex');
}

function cleanStrategy(value) {
    return ALLOWED_STRATEGIES.has(value) ? value : null;
}

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');
        if (separator < 1) return cookies;
        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (!name) return cookies;
        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = '';
        }
        return cookies;
    }, {});
}

function extractBarrier(transaction) {
    const contractType = String(transaction?.contract_type || '').toUpperCase();
    const explicit = transaction?.barrier;
    if (explicit != null && /^-?\d{1,3}$/.test(String(explicit))) return String(explicit);
    const shortcode = String(transaction?.shortcode || '');
    if (/^DIGIT(?:OVER|UNDER|MATCH|DIFF)/.test(contractType)) {
        const shortcodeBarrier = shortcode.match(/_(-?\d{1,3})$/);
        if (shortcodeBarrier) return shortcodeBarrier[1];
    }
    const description = `${shortcode} ${String(transaction?.longcode || '')}`;
    const words = description.match(/(?:greater than|less than|equal(?:s| to)?|digit)\s*(-?\d{1,3})/i);
    return words?.[1] ?? null;
}

function extractDuration(transaction) {
    const shortcode = String(transaction?.shortcode || '');
    const match = shortcode.match(/_(\d{1,4})([tsmhd])_/i);
    if (match) return { duration: Number(match[1]), durationUnit: match[2].toLowerCase() };
    const description = String(transaction?.longcode || '');
    const textMatch = description.match(/(?:for|after|within)\s+(\d{1,4})\s+(tick|second|minute|hour|day)/i);
    if (!textMatch) return { duration: null, durationUnit: null };
    const unit = textMatch[2].toLowerCase();
    return {
        duration: Number(textMatch[1]),
        durationUnit: ({ tick: 't', second: 's', minute: 'm', hour: 'h', day: 'd' })[unit] || null,
    };
}

module.exports = {
    cleanStrategy,
    constantTimeStringEqual,
    extractBarrier,
    extractDuration,
    hashAccount,
    hashIp,
    parseCookies,
    readTicket,
    signTicket,
};
