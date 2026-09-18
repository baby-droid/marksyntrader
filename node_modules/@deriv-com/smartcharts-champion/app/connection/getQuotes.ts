import { TGetQuotesResult } from '../../src/types/props.types';
import { TBinaryAPIRequest, Candles, History } from '../../src/types';
import ConnectionManager from './ConnectionManager';

// Define a specific interface for the parameters
interface HistoryParams {
    symbol: string;
    granularity: number;
    count: number;
    start?: number;
    end?: number;
    style?: string;
}

export type TicksHistoryResponse = {
    candles?: Candles;
    history?: History;
    pip_size?: number;
    status?: string;
    error?: {
        code: string;
        message: string;
    };
};

// We'll use the connectionManager instance that's created in app/index.tsx
// This function is called from app/index.tsx where connectionManager is available
let connectionManagerInstance: ConnectionManager;

const getQuotes = async ({ symbol, granularity, count, start, end }: HistoryParams): Promise<TGetQuotesResult> => {
    if (!connectionManagerInstance) {
        throw new Error('ConnectionManager instance not set. Call setConnectionManager first.');
    }

    // Create a request object for the tick history API with all required fields
    const request: TBinaryAPIRequest = {
        ticks_history: symbol,
        style: granularity ? 'candles' : 'ticks',
        count,
        end: end ? String(end) : 'latest',
        adjust_start_time: 1,
        req_id: Math.floor(Math.random() * 1000000), // Generate a random request ID
    };

    if (granularity) {
        request.granularity = granularity;
    }

    if (start) {
        request.start = String(start);
    }

    try {
        // Use the ConnectionManager instance from the app
        const response = await connectionManagerInstance.send(request);

        // Return the response in the expected format
        if (response.error) {
            console.error('Error fetching tick history:', response.error);
            // Handle error object safely
            const errorMessage =
                typeof response.error === 'object' && response.error !== null && 'message' in response.error
                    ? String(response.error.message)
                    : 'Unknown error in tick history';
            throw new Error(errorMessage);
        }

        // Convert the response to the expected TGetQuotesResult format
        const result: TGetQuotesResult = {};
        const ticksResponse = response as unknown as TicksHistoryResponse;

        if (ticksResponse.candles && Array.isArray(ticksResponse.candles)) {
            result.candles = ticksResponse.candles.map(candle => ({
                open: +(candle.open || 0),
                high: +(candle.high || 0),
                low: +(candle.low || 0),
                close: +(candle.close || 0),
                epoch: +(candle.epoch || 0),
            }));
        } else if (ticksResponse.history && ticksResponse.history.prices && ticksResponse.history.times) {
            result.history = {
                prices: ticksResponse.history.prices.map(price => +price),
                times: ticksResponse.history.times.map(time => +time),
            };
        }

        return result;
    } catch (error) {
        console.error('Error in getQuotes:', error);
        throw error;
    }
};

// Function to set the connection manager instance
export const setConnectionManager = (instance: ConnectionManager) => {
    connectionManagerInstance = instance;
};

export default getQuotes;
