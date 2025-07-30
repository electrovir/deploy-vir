import {addPrefix} from '@augment-vir/common';
import {type ChatPostMessageArguments} from '@slack/web-api';
import {joinUrlPaths} from 'url-vir';
import {type SlackNotificationConfig} from '../config.js';
import {type Commit} from '../git.js';
import {type NotificationParams} from './notification-params.js';

export {type ChatPostMessageArguments} from '@slack/web-api';

function truncateString(value: string, truncateAt = 100): string {
    if (value.length > truncateAt) {
        return `${value.slice(0, Math.max(0, truncateAt))}...`;
    } else {
        return value;
    }
}

function formatCommit(baseCommitUrl: string | undefined, commit: Readonly<Commit>) {
    const commitLine = `${commit.hash.slice(0, 7)} (${commit.author_name}) - ${truncateString(commit.message)}`;

    if (baseCommitUrl) {
        return `<${joinUrlPaths(baseCommitUrl, commit.hash)}|${commitLine}>`;
    } else {
        return commitLine;
    }
}

/**
 * Send a notification to Slack.
 *
 * @category Internal
 */
export async function sendNotificationToSlack({
    branchConfig,
    deployCommits: {deployedCommits, overwrittenCommits},
    notification,
    repoConfig,
}: Readonly<NotificationParams>) {
    const deployedCommitBullets = deployedCommits.map((commit) =>
        formatCommit(repoConfig.commitBaseUrl, commit),
    );
    const overwrittenCommitBullets = overwrittenCommits.map((commit) =>
        formatCommit(repoConfig.commitBaseUrl, commit),
    );

    const deployedCommitBulletsText = deployedCommitBullets
        .map((bullet) => `• ${bullet}`)
        .join('\n');

    const overwrittenCommitBulletsText = overwrittenCommitBullets.length
        ? overwrittenCommitBullets.map((bullet) => `• ${bullet}`).join('\n')
        : undefined;

    const blocks: any[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${branchConfig.deployName}* Deployed`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `\n*Deployed Commits*\n${deployedCommitBulletsText}`,
            },
        },
        ...(overwrittenCommitBulletsText
            ? [
                  {
                      type: 'section',
                      text: {
                          type: 'mrkdwn',
                          text: `\n*Overwritten Commits*\n${overwrittenCommitBulletsText}`,
                      },
                  },
              ]
            : []),
    ];

    await sendSlackMessage(notification, {
        attachments: [],
        channel: addPrefix({value: notification.channelName, prefix: '#'}),
        blocks,
    });
}

async function sendSlackMessage(
    slackConfig: Readonly<Pick<SlackNotificationConfig, 'avatarEmoji' | 'webhookUrl' | 'username'>>,
    body: Readonly<ChatPostMessageArguments>,
) {
    try {
        const response = await fetch(slackConfig.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...body,
                ...(slackConfig.avatarEmoji
                    ? {
                          icon_emoji: slackConfig.avatarEmoji,
                      }
                    : {}),
                ...(slackConfig.username
                    ? {
                          username: slackConfig.username,
                      }
                    : {}),
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to send Slack webhook: ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending Slack message:', error);
    }
}
