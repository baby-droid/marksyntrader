type ApiRequest = Record<string, unknown> | null | undefined;

type BudgetGroup = 'trade' | 'account' | 'reports' | 'other';

type GroupLimit = {
    perMinute: number;
    perHour: number;
    spacingMs: number;
};

export type DerivRequestBudgetConfig = {
    totalPerMinute: number;
    totalPerHour: number;
    totalSpacingMs: number;
    maxQueueLength: number;
    maxBuyQueueWaitMs: number;
    requestTimeoutMs: number;
    groups: Record<BudgetGroup, GroupLimit>;
};

type PendingRequest<T = unknown> = {
    request: ApiRequest;
    messageType: string;
    group: BudgetGroup;
    enqueuedAt: number;
    send: () => T | Promise<T>;
    resolve: (result: T) => void;
    reject: (error: unknown) => void;
};

export const DERIV_REQUEST_BUDGET: DerivRequestBudgetConfig = {
    // App-wide cap across all non-ping WebSocket requests. This is deliberately
    // below Deriv's shared trade budget and leaves room for other tabs/clients.
    totalPerMinute: 300,
    totalPerHour: 14_000,
    totalSpacingMs: 200,
    maxQueueLength: 512,
    requestTimeoutMs: 20_000,
    // A queued buy that misses its originating tick is not sent later as a
    // stale trade. Other requests remain queued until their budget permits.
    maxBuyQueueWaitMs: 5_000,
    groups: {
        trade: { perMinute: 300, perHour: 14_000, spacingMs: 200 },
        account: { perMinute: 80, perHour: 1_900, spacingMs: 750 },
        reports: { perMinute: 25, perHour: 1_400, spacingMs: 2_400 },
        // Deriv's documented "all other calls" budget is 220/minute. Contract
        // updates are conservatively kept here, while also counting toward the
        // app-wide 300/minute ceiling.
        other: { perMinute: 180, perHour: 12_000, spacingMs: 334 },
    },
};

const TRADE_MESSAGES = new Set(['proposal', 'proposal_open_contract', 'buy', 'sell']);
const ACCOUNT_MESSAGES = new Set(['balance', 'statement']);
const REPORT_MESSAGES = new Set(['portfolio', 'profit_table']);

export const getDerivRequestType = (request: ApiRequest): string => {
    if (!request || typeof request !== 'object') return '';
    const knownTypes = [
        'ping',
        'proposal',
        'proposal_open_contract',
        'buy',
        'sell',
        'contract_update',
        'balance',
        'statement',
        'portfolio',
        'profit_table',
    ];
    const knownType = knownTypes.find(type => Object.prototype.hasOwnProperty.call(request, type));
    if (knownType) return knownType;
    return typeof request.msg_type === 'string' ? request.msg_type : Object.keys(request)[0] ?? '';
};

const getBudgetGroup = (messageType: string): BudgetGroup => {
    if (TRADE_MESSAGES.has(messageType)) return 'trade';
    if (ACCOUNT_MESSAGES.has(messageType)) return 'account';
    if (REPORT_MESSAGES.has(messageType)) return 'reports';
    return 'other';
};

export class DerivRequestBudgetError extends Error {
    code = 'RequestBudgetExceeded';
    msg_type: string;
    echo_req: ApiRequest;
    error: { code: string; message: string };

    constructor(messageType: string, request: ApiRequest, message = 'The Deriv request was not sent because the local safety queue is full.') {
        super(message);
        this.name = 'DerivRequestBudgetError';
        this.msg_type = messageType;
        this.echo_req = request;
        this.error = { code: this.code, message };
    }
}

export class DerivRequestTimeoutError extends Error {
    code = 'RequestTimeout';
    msg_type: string;
    echo_req: ApiRequest;
    error: { code: string; message: string };

    constructor(messageType: string, request: ApiRequest) {
        const message = `Deriv did not respond to ${messageType || 'the request'} within the safety timeout.`;
        super(message);
        this.name = 'DerivRequestTimeoutError';
        this.msg_type = messageType;
        this.echo_req = request;
        this.error = { code: this.code, message };
    }
}

export class DerivRequestBudget {
    private readonly config: DerivRequestBudgetConfig;
    private queue: PendingRequest[] = [];
    private sentTotal: number[] = [];
    private sentByGroup: Record<BudgetGroup, number[]> = {
        trade: [],
        account: [],
        reports: [],
        other: [],
    };
    private lastTotalSentAt = Number.NEGATIVE_INFINITY;
    private lastSentAtByGroup: Record<BudgetGroup, number> = {
        trade: Number.NEGATIVE_INFINITY,
        account: Number.NEGATIVE_INFINITY,
        reports: Number.NEGATIVE_INFINITY,
        other: Number.NEGATIVE_INFINITY,
    };
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: DerivRequestBudgetConfig = DERIV_REQUEST_BUDGET) {
        this.config = config;
    }

    send<T>(request: ApiRequest, send: () => T | Promise<T>): Promise<T> {
        const messageType = getDerivRequestType(request);
        if (messageType === 'ping') return Promise.resolve().then(send);

        if (this.queue.length >= this.config.maxQueueLength) {
            return Promise.reject(new DerivRequestBudgetError(messageType, request));
        }

        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                request,
                messageType,
                group: getBudgetGroup(messageType),
                enqueuedAt: Date.now(),
                send,
                resolve,
                reject,
            });
            this.pump();
        });
    }

    getQueuedCount(): number {
        return this.queue.length;
    }

    reset(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.queue = [];
        this.sentTotal = [];
        this.sentByGroup = { trade: [], account: [], reports: [], other: [] };
        this.lastTotalSentAt = Number.NEGATIVE_INFINITY;
        this.lastSentAtByGroup = {
            trade: Number.NEGATIVE_INFINITY,
            account: Number.NEGATIVE_INFINITY,
            reports: Number.NEGATIVE_INFINITY,
            other: Number.NEGATIVE_INFINITY,
        };
    }

    private prune(now: number): void {
        this.sentTotal = this.sentTotal.filter(time => now - time < 3_600_000);
        (Object.keys(this.sentByGroup) as BudgetGroup[]).forEach(group => {
            this.sentByGroup[group] = this.sentByGroup[group].filter(time => now - time < 3_600_000);
        });
    }

    private waitForWindow(sent: number[], limit: number, windowMs: number, now: number): number {
        const sentInWindow = sent.filter(time => now - time < windowMs);
        if (sentInWindow.length < limit) return 0;
        return Math.max(1, sentInWindow[0] + windowMs - now + 1);
    }

    private waitForRequest(request: PendingRequest, now: number): number {
        const groupLimit = this.config.groups[request.group];
        return Math.max(
            this.config.totalSpacingMs - (now - this.lastTotalSentAt),
            groupLimit.spacingMs - (now - this.lastSentAtByGroup[request.group]),
            this.waitForWindow(this.sentTotal, this.config.totalPerMinute, 60_000, now),
            this.waitForWindow(this.sentTotal, this.config.totalPerHour, 3_600_000, now),
            this.waitForWindow(this.sentByGroup[request.group], groupLimit.perMinute, 60_000, now),
            this.waitForWindow(this.sentByGroup[request.group], groupLimit.perHour, 3_600_000, now),
        );
    }

    private pump = (): void => {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const now = Date.now();
        this.prune(now);

        // Don't keep an expired buy queued until after its tick is no longer
        // relevant. Explicitly fail it so the Bot Builder can report the cause.
        const expiredBuys = this.queue.filter(
            request => request.messageType === 'buy'
                && now - request.enqueuedAt >= this.config.maxBuyQueueWaitMs,
        );
        if (expiredBuys.length) {
            const expiredSet = new Set(expiredBuys);
            this.queue = this.queue.filter(request => !expiredSet.has(request));
            expiredBuys.forEach(request => request.reject(
                new DerivRequestBudgetError(
                    request.messageType,
                    request.request,
                    'The buy was not sent because the safe request window arrived after its triggering tick.',
                ),
            ));
        }

        if (!this.queue.length) return;

        let eligibleIndex = -1;
        let earliestWait = Number.POSITIVE_INFINITY;
        let bestPriority = Number.POSITIVE_INFINITY;
        this.queue.forEach((request, index) => {
            const wait = this.waitForRequest(request, now);
            if (wait <= 0) {
                const priority = this.priority(request.messageType);
                if (priority < bestPriority) {
                    bestPriority = priority;
                    eligibleIndex = index;
                }
            } else {
                earliestWait = Math.min(earliestWait, wait);
            }
        });

        if (eligibleIndex < 0) {
            const nextBuyExpiry = this.queue
                .filter(request => request.messageType === 'buy')
                .reduce(
                    (soonest, request) => Math.min(
                        soonest,
                        request.enqueuedAt + this.config.maxBuyQueueWaitMs - now,
                    ),
                    Number.POSITIVE_INFINITY,
                );
            this.timer = setTimeout(this.pump, Math.max(1, Math.min(earliestWait, nextBuyExpiry)));
            return;
        }

        const [request] = this.queue.splice(eligibleIndex, 1);
        this.sentTotal.push(now);
        this.sentByGroup[request.group].push(now);
        this.lastTotalSentAt = now;
        this.lastSentAtByGroup[request.group] = now;

        try {
            Promise.resolve(request.send()).then(request.resolve, request.reject);
        } catch (error) {
            request.reject(error);
        }

        if (this.queue.length) this.pump();
    };

    private priority(messageType: string): number {
        if (messageType === 'sell') return 0;
        if (messageType === 'buy' || messageType === 'proposal_open_contract' || messageType === 'contract_update') return 1;
        if (messageType === 'proposal') return 2;
        if (messageType === 'balance' || messageType === 'statement') return 3;
        return 4;
    }
}

const sharedDerivRequestBudget = new DerivRequestBudget();
const wrappedApis = new WeakSet<object>();

export const installDerivRequestBudget = (api: { send: (request: any) => any } | null | undefined): void => {
    if (!api || typeof api.send !== 'function' || wrappedApis.has(api)) return;
    const originalSend = api.send.bind(api);
    api.send = (request: ApiRequest) => {
        const messageType = getDerivRequestType(request);
        return sharedDerivRequestBudget.send(request, () => {
            if (messageType === 'ping') return originalSend(request);
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new DerivRequestTimeoutError(messageType, request)),
                    DERIV_REQUEST_BUDGET.requestTimeoutMs,
                );
                try {
                    Promise.resolve(originalSend(request)).then(
                        result => {
                            clearTimeout(timeout);
                            resolve(result);
                        },
                        error => {
                            clearTimeout(timeout);
                            reject(error);
                        },
                    );
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
        });
    };
    wrappedApis.add(api);
};
