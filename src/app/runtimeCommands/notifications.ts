import {
    dismissExchangeNotificationOp,
    type DismissExchangeNotificationInput,
    markNotificationReadOp,
    type MarkNotificationReadInput,
} from '../../workflows/notifications.op';
import type {
    RequestSignalOptions,
    RuntimeCommandContext,
} from './types';

export interface NotificationRuntimeCommands {
    dismissExchange(
        input: DismissExchangeNotificationInput,
        options?: RequestSignalOptions
    ): Promise<void>;
    markRead(
        input: MarkNotificationReadInput,
        options?: RequestSignalOptions
    ): Promise<void>;
}

/**
 * Route-facing notification commands.
 */
export const createNotificationRuntimeCommands = (
    context: RuntimeCommandContext
): NotificationRuntimeCommands => ({
    dismissExchange: dismissExchangeNotification(context),
    markRead: markNotificationRead(context),
});

const dismissExchangeNotification =
    (context: RuntimeCommandContext) =>
    (
        input: DismissExchangeNotificationInput,
        options: RequestSignalOptions = {}
    ): Promise<void> =>
        context.runWorkflow(() => dismissExchangeNotificationOp(input), {
            ...options,
            kind: 'workflow',
            track: false,
        });

const markNotificationRead =
    (context: RuntimeCommandContext) =>
    (
        input: MarkNotificationReadInput,
        options: RequestSignalOptions = {}
    ): Promise<void> =>
        context.runWorkflow(() => markNotificationReadOp(input), {
            ...options,
            kind: 'workflow',
            track: false,
        });
