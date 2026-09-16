/**
 * Transport layer wrapper for SmartCharts Champion Adapter
 * Wraps the authenticated main api_base.api connection to match the
 * TTransport interface.
 */

import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import type { TTransport } from './types';

// Logger utility for transport layer
const logger = {
    log: () => {}, // Disabled in production
    warn: console.warn.bind(console, '[SmartCharts Transport]'),
    error: console.error.bind(console, '[SmartCharts Transport]'),
};

/**
 * Create transport wrapper around the main authenticated API.
 * @returns TTransport implementation
 */
export function createTransport(): TTransport {
    const subscriptions = new Map<string, any>();

    return {
        /**
         * Send one-shot API request
         */
        async send(request: any): Promise<any> {
            if (!api_base.api) {
                throw new Error('Main authenticated API is not initialized');
            }
            return api_base.api.send(request);
        },

        /**
         * Subscribe to streaming data
         * @param request - API request with subscribe: 1
         * @param callback - Callback for streaming updates
         * @returns subscription ID
         */
        subscribe(request: any, callback: (response: any) => void): string {
            if (!api_base.api) {
                throw new Error('Main authenticated API is not initialized');
            }
            // Generate a unique temporary ID for tracking
            const tempId = `temp-${Date.now()}-${Math.random()}`;

            // Send initial subscription request
            const subscribeRequest = { ...request, subscribe: 1 };

            // Set up global message listener first (before sending request)
            const messageSubscription = api_base.api.onMessage()?.subscribe(({ data }: { data: any }) => {
                const subscriptionId = data?.subscription?.id;

                // Check if this message belongs to our subscription
                const storedSub = subscriptions.get(tempId);
                if (storedSub && subscriptionId) {
                    // Update the subscription with the real ID
                    if (!storedSub.realSubscriptionId) {
                        storedSub.realSubscriptionId = subscriptionId;
                        subscriptions.set(tempId, storedSub);
                    }

                    // Forward the message if it matches our subscription
                    if (subscriptionId === storedSub.realSubscriptionId) {
                        callback(data);
                    }
                }
            });

            // Store subscription info with temp ID
            subscriptions.set(tempId, {
                request: subscribeRequest,
                callback,
                messageSubscription,
                realSubscriptionId: null, // Will be set when we get the first response
            });

            // Send the subscription request
            (api_base.api as any)
                .send(subscribeRequest)
                .then((response: any) => {
                    const subscriptionId = response?.subscription?.id;

                    if (subscriptionId) {
                        // Update stored subscription with real ID
                        const storedSub = subscriptions.get(tempId);
                        if (storedSub) {
                            storedSub.realSubscriptionId = subscriptionId;
                            subscriptions.set(tempId, storedSub);
                        }

                        // Call callback with initial response
                        callback(response);
                    } else {
                        logger.error('No subscription ID in response:', response);
                    }
                })
                .catch((error: any) => {
                    logger.error('Subscription failed:', error);
                    // Clean up failed subscription
                    const storedSub = subscriptions.get(tempId);
                    if (storedSub?.messageSubscription) {
                        storedSub.messageSubscription.unsubscribe();
                    }
                    subscriptions.delete(tempId);
                });

            return tempId;
        },

        /**
         * Unsubscribe from streaming data
         * @param subscriptionId - Subscription ID to cancel (temp ID)
         */
        unsubscribe(subscriptionId: string): void {
            const subscription = subscriptions.get(subscriptionId);

            if (subscription) {
                // Cancel RxJS subscription
                if (subscription.messageSubscription) {
                    subscription.messageSubscription.unsubscribe();
                }

                // Send forget request to server using the real subscription ID
                if (api_base.api && subscription.realSubscriptionId) {
                    (api_base.api as any).forget(subscription.realSubscriptionId);
                }

                // Clean up local storage
                subscriptions.delete(subscriptionId);
            } else {
                logger.warn('No subscription found for ID:', subscriptionId);
            }
        },

        /**
         * Unsubscribe from all streaming data of a specific type
         * @param msgType - Message type to unsubscribe from (optional)
         */
        unsubscribeAll(msgType?: string): void {
            if (api_base.api) {
                if (msgType) {
                    (api_base.api as any).forgetAll(msgType);
                } else {
                    // Forget all ticks by default
                    (api_base.api as any).forgetAll('ticks');
                }
            }

            // Clean up local subscriptions
            subscriptions.clear();
        },
    };
}
