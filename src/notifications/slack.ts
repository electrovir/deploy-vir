import {addPrefix, log, setFirstLetterCasing, StringCase} from '@augment-vir/common';
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

const slackMaxSectionLength = 2500;

function pushAndGet<T>(array: T[], item: T) {
    array.push(item);
    return item;
}

function chunkSectionLines(lines: ReadonlyArray<string>): string[][] {
    const sectionLines: {length: number; lines: string[]}[] = [];

    lines.forEach((line) => {
        const latestSection = sectionLines.slice(-1)[0];

        const currentSection =
            latestSection && latestSection.length + line.length < slackMaxSectionLength
                ? latestSection
                : pushAndGet(sectionLines, {
                      length: 0,
                      lines: [],
                  });
        currentSection.length += line.length;
        currentSection.lines.push(line);
    });

    return sectionLines.map(({lines}) => lines);
}

/**
 * Send a notification to Slack.
 *
 * @category Internal
 */
export async function sendNotificationToSlack({
    deployResult: {
        deployCommits: {deployedCommits, overwrittenCommits},
        branchStatus: {after, before},
        toBranchName,
    },
    hookResult,
    notification,
    repoConfig,
}: Readonly<NotificationParams>) {
    const deployedCommitBullets = deployedCommits.map((commit) =>
        formatCommit(repoConfig.commitBaseUrl, commit),
    );
    const overwrittenCommitBullets = overwrittenCommits.map((commit) =>
        formatCommit(repoConfig.commitBaseUrl, commit),
    );

    const deployedCommitBulletLines = deployedCommitBullets.map((bullet) => `- ${bullet}`);

    const overwrittenCommitBulletLines = overwrittenCommitBullets.length
        ? overwrittenCommitBullets.map((bullet) => `- ${bullet}`)
        : undefined;

    const beforeText = repoConfig.commitBaseUrl
        ? `<${joinUrlPaths(repoConfig.commitBaseUrl, before.hash)}|${before.hash.slice(0, 7)}>`
        : before.hash;
    const afterText = repoConfig.commitBaseUrl
        ? `<${joinUrlPaths(repoConfig.commitBaseUrl, after.hash)}|${after.hash.slice(0, 7)}>`
        : before.hash;

    const blocks: KnownBlock[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${setFirstLetterCasing(repoConfig.name, StringCase.Upper)} ${setFirstLetterCasing(toBranchName, StringCase.Upper)}* Pushed`,
            },
        },
        ...(hookResult?.prependToNotification
            ? ([
                  {
                      type: 'section',
                      text: {
                          type: 'mrkdwn',
                          text: hookResult.prependToNotification,
                      },
                  },
              ] satisfies KnownBlock[])
            : []),
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
                text: `\n*Deployed Commits*\n`,
            },
        },
        ...chunkSectionLines(deployedCommitBulletLines).map((lines): KnownBlock => {
            return {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: lines.join('\n'),
                },
            };
        }),
        ...(overwrittenCommitBulletLines?.length
            ? ([
                  {
                      type: 'section',
                      text: {
                          type: 'mrkdwn',
                          text: `\n*Overwritten Commits*\n`,
                      },
                  },

                  ...chunkSectionLines(overwrittenCommitBulletLines).map((lines): KnownBlock => {
                      return {
                          type: 'section',
                          text: {
                              type: 'mrkdwn',
                              text: lines.join('\n'),
                          },
                      };
                  }),
              ] satisfies KnownBlock[])
            : []),
        ...(hookResult?.appendToNotification
            ? ([
                  {
                      type: 'section',
                      text: {
                          type: 'mrkdwn',
                          text: hookResult.appendToNotification,
                      },
                  },
              ] satisfies KnownBlock[])
            : []),
    ];

    await sendSlackMessage(notification, {
        attachments: [],
        channel: addPrefix({
            value: notification.channelName,
            prefix: '#',
        }),
        blocks,
    });
}

async function sendSlackMessage(
    slackConfig: Readonly<Pick<SlackNotificationConfig, 'avatarEmoji' | 'webhookUrl' | 'username'>>,
    body: Readonly<ChatPostMessageArguments>,
) {
    const messageBody = {
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
    };

    try {
        const response = await fetch(slackConfig.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageBody),
        });

        if (!response.ok) {
            throw new Error(`Failed to send Slack webhook: ${response.status}`);
        }
    } catch (error) {
        log.error(JSON.stringify(messageBody, null, 4));
        console.error('Error sending Slack message:', error);
    }
}
