import {addPrefix, capitalizeFirstLetter} from '@augment-vir/common';
import {type ChatPostMessageArguments, type KnownBlock} from '@slack/web-api';
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
    if (baseCommitUrl) {
        return `<${joinUrlPaths(baseCommitUrl, commit.hash)}|${commit.hash.slice(0, 7)}> (${commit.author_name}) ${truncateString(commit.message)}`;
    } else {
        return `${commit.hash.slice(0, 7)} (${commit.author_name}) ${truncateString(commit.message)}`;
    }
}

/**
 * Send a notification to Slack.
 *
 * @category Internal
 */
export async function sendNotificationToSlack({
    branchConfig,
    deployResult: {
        deployCommits: {deployedCommits, overwrittenCommits},
        branchStatus: {after, before},
    },
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
        .map((bullet) => `- ${bullet}`)
        .join('\n');

    const overwrittenCommitBulletsText = overwrittenCommitBullets.length
        ? overwrittenCommitBullets.map((bullet) => `- ${bullet}`).join('\n')
        : undefined;

    const beforeText = repoConfig.commitBaseUrl
        ? `<${joinUrlPaths(repoConfig.commitBaseUrl, before.hash)}|${before.hash.slice(0, 7)}>`
        : before.hash;
    const afterText = repoConfig.commitBaseUrl
        ? `<${joinUrlPaths(repoConfig.commitBaseUrl, after.hash)}|${after.hash.slice(0, 7)}>`
        : before.hash;

    const overwrittenCommitBlocks: KnownBlock[] = overwrittenCommitBulletsText
        ? [
              {
                  type: 'section',
                  text: {
                      type: 'mrkdwn',
                      text: `\n*Overwritten Commits*\n${overwrittenCommitBulletsText}`,
                  },
              },
          ]
        : [];

    const blocks: KnownBlock[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${capitalizeFirstLetter(branchConfig.deployName)}* Pushed`,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `${beforeText} :arrow_right: ${afterText}`,
                },
            ],
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `\n*Deployed Commits*\n${deployedCommitBulletsText}`,
            },
        },
        ...overwrittenCommitBlocks,
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
