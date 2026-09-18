import { ArrayElement, OHLCStreamResponse, TBinaryAPIRequest, TGetQuotesResult,   Candles,
    History,
    TGetQuotesRequest,
    TickSpotData,
    TicksStreamResponse, } from 'src/types';
import ConnectionManager from './ConnectionManager';
import Stream from './Stream';

class StreamManager {
    MAX_CACHE_TICKS = 5000;
    _connection: ConnectionManager;
    _streams: Record<string, Stream> = {};
    _streamIds: Record<string, string | undefined> = {};
    _tickHistoryCache: Record<string, Required<TGetQuotesResult>> = {};
    _tickHistoryPromises: Record<string, Promise<Required<TGetQuotesResult>>> = {};
    _beingForgotten: Record<string, boolean> = {};

    constructor(connection: ConnectionManager) {
        this._connection = connection;

        for (const msgType of ['tick', 'ohlc']) {
            this._connection.on(msgType, this._onTick.bind(this));
        }
        this._connection.onClosed(this._onConnectionClosed.bind(this));
    }

    _onTick(data: TicksStreamResponse & { 
        echo_req: any, 
        msg_type: string,
        [key: string]: { id?: string } | any 
    }) {
        const key = this._getKey(data.echo_req as TGetQuotesRequest);

        if (this._streams[key] && this._tickHistoryCache[key]) {
            this._streamIds[key] = data[data.msg_type]?.id;
            this._cacheTick(key, data);
            this._streams[key].emitTick(data as any);
        } else if (!(key in this._beingForgotten)) {
            // There could be the possibility a stream could still enter even though
            // it is no longer in used. This is because we can't know the stream ID
            // from the initial response; we have to wait for the next tick to retrieve it.
            // In such scenario we need to forget these "orphaned" streams:
            this._streamIds[key] = data[data.msg_type]?.id;
            this._forgetStream(key);
        }
    }

    _onConnectionClosed() {
        // StreamManager simply discards all streams upon disconnection;
        // It is not its responsibility to reestablish the streams upon reconnection.
        this._streamIds = {}; // set it to blank so that forget requests do not get called
        for (const key of Object.keys(this._streams)) {
            if (this._streams[key].subscriberCount !== 0) {
                this._forgetStream(key);
            }
        }
    }

    _onReceiveTickHistory(data: Required<TGetQuotesResult> & { echo_req?: any }) {
        const key = this._getKey(data.echo_req as TGetQuotesRequest);
        const cache = StreamManager.cloneTickTicksHistoryResponse(data);
        if (cache) {
            this._tickHistoryCache[key] = cache;
        }
        delete this._tickHistoryPromises[key];
    }

    _cacheTick(key: string, response: TicksStreamResponse | OHLCStreamResponse) {
        if ('ohlc' in response) {
            const { ohlc } = response as OHLCStreamResponse;
            const candles = this._tickHistoryCache[key].candles as Candles;
            const { close, open_time: epoch, high, low, open } = ohlc;
            const candle: ArrayElement<Candles> = {
                close: (close as unknown) as number,
                high: (high as unknown) as number,
                low: (low as unknown) as number,
                open: (open as unknown) as number,
                epoch,
            };
            const lastCandle = candles[candles.length - 1] as Required<Candles[0]>;
            if (lastCandle && candle.epoch && +lastCandle.epoch === +candle.epoch) {
                candles[candles.length - 1] = candle;
            } else {
                candles.push(candle);

                if (candles.length > this.MAX_CACHE_TICKS) {
                    candles.shift();
                }
            }
        } else if ('tick' in response) {
            const { tick } = response;
            const history = this._tickHistoryCache[key].history;

            const { prices, times } = history as any;
            const { quote: price, epoch: time } = tick as Required<TickSpotData>;

            prices.push(price);
            times.push(time);

            if (prices.length > this.MAX_CACHE_TICKS) {
                prices.shift();
                times.shift();
            }
        }
    }

    _forgetStream(key: string) {
        const stream = this._streams[key];
        if (stream) {
            // Note that destroying a stream also removes all subscribed events
            stream.destroy();
            delete this._streams[key];
        }

        if (this._streamIds[key]) {
            const id = this._streamIds[key];
            this._beingForgotten[key] = true;
            this._connection.send({ forget: id }).then(() => {
                delete this._beingForgotten[key];
                delete this._streamIds[key];
            });
        }

        if (this._tickHistoryCache[key]) {
            delete this._tickHistoryCache[key];
        }
    }

    _createNewStream(request: TGetQuotesRequest) {
        const key = this._getKey(request);
        const stream = new Stream();
        this._streams[key] = stream;
        const subscribePromise = this._connection.send((request as unknown) as TBinaryAPIRequest);
        this._tickHistoryPromises[key] = subscribePromise as unknown as Promise<Required<TGetQuotesResult>>;

        subscribePromise
            .then(response => {
                this._onReceiveTickHistory(response as unknown as Required<TGetQuotesResult>);
                if (response.error) {
                    this._forgetStream(key);
                }
            })
            .catch(() => {
                this._forgetStream(key);
            });

        stream.onNoSubscriber(() => this._forgetStream(key));

        return stream;
    }

    subscribe(req: TBinaryAPIRequest, callback: (response: TGetQuotesResult) => void) {
        const request = (req as unknown) as TGetQuotesRequest;
        const key = this._getKey(request);
        let stream = this._streams[key];
        if (!stream) {
            stream = this._createNewStream(request);
        }

        // Register the callback to receive stream updates
        stream.onStream(callback);
    }

    forget(request: TBinaryAPIRequest, callback?: (response: TGetQuotesResult) => void) {
        const key = this._getKey((request as unknown) as TGetQuotesRequest);
        const stream = this._streams[key];
        delete this._streams[key];
        if (stream && callback) {
            stream.offStream(callback);
        }
    }

    _getKey({ symbol, granularity, ticks_history}: TGetQuotesRequest) {
        return `${symbol || ticks_history}-${granularity || 0}`;
    }

    static cloneTickTicksHistoryResponse({ history, candles, ...others }: Required<TGetQuotesResult> & { echo_req?: any }) {
        let clone: TGetQuotesResult | null = null;

        if (history) {
            const { prices, times } = history as Required<History>;
            clone = {
                ...others,
                history: {
                    prices: prices.slice(0),
                    times: times.slice(0),
                },
            };
        } else if (candles) {
            clone = { ...others, candles: candles.slice(0) };
        }

        return clone as any;
    }
}

export default StreamManager;
