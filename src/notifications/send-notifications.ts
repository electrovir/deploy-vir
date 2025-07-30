import {type NotificationConfig, NotificationTarget} from '../config.js';
import {KnownError} from '../known.error.js';
import {type NotificationParams} from './notification-params.js';
import {sendNotificationToSlack} from './slack.js';

/**
 * Send all configured notifications.
 *
 * @category Internal
 */
export async function sendNotifications(
    notifications: ReadonlyArray<Readonly<NotificationConfig>>,
    params: Readonly<Omit<NotificationParams, 'notification'>>,
) {
    await Promise.all(
        notifications.map(async (notification) => {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (notification.target === NotificationTarget.Slack) {
                await sendNotificationToSlack({
                    ...params,
                    notification,
                });
            } else {
                throw new KnownError(
                    `Unexpected notification target: '${String(notification.target)}'`,
                );
            }
        }),
    );
}
