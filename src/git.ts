import {assert, assertWrap, check} from '@augment-vir/assert';
import {awaitedBlockingMap, awaitedForEach, log, logColors} from '@augment-vir/common';
import {confirm} from '@inquirer/prompts';
import {type SimpleGit} from 'simple-git';
import {getCommitAuthorName, type Commit} from './commit.js';
import {
    type DeployNotificationConfig,
    type DeployVirBranchConfig,
    type DeployVirHooks,
    type DeployVirRepoConfig,
    type NotificationConfig,
} from './config.js';
import {KnownError} from './known.error.js';
import {sendNotifications} from './notifications/send-notifications.js';

/**
 * Find the git remote's name, or create a new one.
 *
 * @category Internal
 */
export async function getGitRemoteName(
    git: Readonly<SimpleGit>,
    repoConfig: Readonly<Pick<DeployVirRepoConfig, 'name' | 'gitUrl'>>,
): Promise<string> {
    assert.isTruthy(repoConfig.name, 'Repo config name cannot be empty.');
    assert.isTruthy(repoConfig.gitUrl, 'Repo git URL cannot be empty.');

    const remotes = await git.getRemotes(true);

    const remoteMatchByUrl = remotes.find((remote) => {
        return remote.refs.fetch === repoConfig.gitUrl || remote.refs.push === repoConfig.gitUrl;
    });

    if (remoteMatchByUrl) {
        return remoteMatchByUrl.name;
    }

    const remoteMatchByNameCount: number = remotes.reduce(
        (count, remote) => count + (remote.name === repoConfig.name ? 1 : 0),
        0,
    );

    const newRemoteName = [
        repoConfig.name,
        remoteMatchByNameCount,
    ]
        .filter(check.isTruthy)
        .join('-');

    await git.addRemote(newRemoteName, repoConfig.gitUrl);

    return newRemoteName;
}

/**
 * All commits involved in a deploy.
 *
 * @category Internal
 */
export type DeployCommits = {
    deployedCommits: ReadonlyArray<Readonly<Commit>>;
    overwrittenCommits: ReadonlyArray<Readonly<Commit>>;
};
/**
 * Before/after of the branch deployed to.
 *
 * @category Internal
 */
export type DeployBranchStatus = {
    before: Readonly<Commit>;
    after: Readonly<Commit>;
};

/**
 * Output from {@link pushDeploy}.
 *
 * @category Internal
 */
export type DeployResult = {
    deployCommits: DeployCommits;
    branchStatus: DeployBranchStatus;
    toBranchName: string;
};

/**
 * Push the deploy via git.
 *
 * @category Internal
 */
// eslint-disable-next-line @virmator/prefer-params-object
export async function pushDeploy(
    git: Readonly<SimpleGit>,
    branchConfig: Readonly<DeployVirBranchConfig>,
    repoConfig: Readonly<DeployVirRepoConfig>,
    remoteName: string,
    notifications: ReadonlyArray<Readonly<NotificationConfig>> | undefined,
    bypassConfirmation = false,
    hooks: Readonly<DeployVirHooks> | undefined,
): Promise<DeployResult[]> {
    const {deployName, branches} = branchConfig;
    return await awaitedBlockingMap(
        branches,
        async ({fromBranch, toBranch, enableNotifications}): Promise<DeployResult> => {
            assert.isTruthy(fromBranch, `Deploy '${deployName}' fromBranch cannot be empty.`);
            assert.isTruthy(toBranch, `Deploy '${deployName}' toBranch cannot be empty.`);
            assert.isTruthy(remoteName, 'Remote name cannot be empty.');

            log.faint(`Pushing ${remoteName}/${fromBranch} to ${toBranch}`);

            await git.fetch(remoteName, fromBranch);
            await git.fetch(remoteName, toBranch);

            const pushString = `${remoteName}/${fromBranch}:${toBranch}`;

            // Get the current commit on the target branch before pushing
            const beforeCommit = assertWrap.isDefined(
                (
                    await git.log([
                        `${remoteName}/${toBranch}`,
                        '-1',
                    ])
                ).latest,
                `Failed to get current commit for ${remoteName}/${toBranch}`,
            );

            const afterCommit = assertWrap.isDefined(
                (
                    await git.log([
                        `${remoteName}/${fromBranch}`,
                        '-1',
                    ])
                ).latest,
                `Failed to get current commit for ${remoteName}/${fromBranch}`,
            );

            /** Get commits that are on {@link toBranch} but not on {@link fromBranch}. */
            const commitsAhead = (
                await git.log([
                    `${remoteName}/${toBranch}..${remoteName}/${fromBranch}`,
                ])
            ).all;

            if (!commitsAhead.length) {
                throw new KnownError('No commit diff: nothing to deploy!');
            }

            /** Get commits that are on {@link toBranch} but not on {@link fromBranch}. */
            const commitsBehind = (
                await git.log([
                    `${remoteName}/${fromBranch}..${remoteName}/${toBranch}`,
                ])
            ).all;

            const requiresForcePush = commitsBehind.length > 0;

            log.info(
                `\n${requiresForcePush ? 'Only on' : 'Releasing from'} ${logColors.bold}${fromBranch}${logColors.reset}:`,
            );
            await awaitedForEach(commitsAhead, async (commit, index) => {
                log.faint(
                    `    ${index + 1}. ${commit.hash.slice(0, 7)} (${await getCommitAuthorName(commit)}) - ${commit.message}`,
                );
            });

            if (requiresForcePush) {
                log.info(`\nOnly on ${logColors.bold}${toBranch}${logColors.reset}:`);
                await awaitedForEach(commitsBehind, async (commit, index) => {
                    log.faint(
                        `    ${index + 1}. ${commit.hash.slice(0, 7)} (${await getCommitAuthorName(commit)}) - ${commit.message}`,
                    );
                });
            }

            const shouldPush =
                bypassConfirmation ||
                (await confirm({
                    message: requiresForcePush
                        ? `\n${logColors.warning}Do you want to force push ${logColors.bold}${fromBranch}${logColors.normalWeight} to ${logColors.bold}${toBranch}${logColors.normalWeight}?\n\nThis will overwrite the commits only on ${logColors.bold}${toBranch}${logColors.normalWeight}.${logColors.reset}?`
                        : 'Ready to deploy?',
                    default: false,
                }));

            if (!shouldPush) {
                throw new KnownError('Deploy aborted.');
            }

            if (requiresForcePush) {
                await git.push(remoteName, pushString, ['--force']);
                log.warning(
                    `Force pushed ${logColors.bold}${fromBranch}${logColors.normalWeight} to ${logColors.bold}${toBranch}${logColors.reset}.`,
                );
            } else {
                await git.push(remoteName, pushString);
            }

            const deployResult: DeployResult = {
                toBranchName: toBranch,
                deployCommits: {
                    deployedCommits: commitsAhead,
                    overwrittenCommits: commitsBehind,
                },
                branchStatus: {
                    before: beforeCommit,
                    after: afterCommit,
                },
            };

            const hookResult =
                (await hooks?.postAccept?.({
                    branchConfig,
                    deployResult,
                    fromBranch,
                    newCommits: commitsAhead,
                    remoteName,
                    repoConfig,
                    toBranch,
                })) || undefined;

            const resolvedNotifications = resolveNotifications({
                branchConfig,
                enableNotifications,
                globalNotifications: notifications,
                repoConfig,
            });

            if (resolvedNotifications.length) {
                await sendNotifications(resolvedNotifications, {
                    branchConfig,
                    deployResult,
                    hookResult: hookResult || undefined,
                    repoConfig,
                });
            }

            return deployResult;
        },
    );
}

function resolveNotifications({
    branchConfig,
    enableNotifications,
    globalNotifications,
    repoConfig,
}: Readonly<{
    branchConfig: Readonly<DeployVirBranchConfig>;
    enableNotifications: boolean | undefined;
    globalNotifications: ReadonlyArray<Readonly<NotificationConfig>> | undefined;
    repoConfig: Readonly<DeployVirRepoConfig>;
}>): NotificationConfig[] {
    if (branchConfig.notifications?.length) {
        return resolveDeployNotifications(branchConfig.notifications, globalNotifications);
    }

    const notificationsEnabled =
        repoConfig.enableNotifications || enableNotifications || branchConfig.enableNotifications;

    if (notificationsEnabled && globalNotifications?.length) {
        return [...globalNotifications];
    }

    return [];
}

function resolveDeployNotifications(
    deployNotifications: ReadonlyArray<Readonly<DeployNotificationConfig>>,
    globalNotifications: ReadonlyArray<Readonly<NotificationConfig>> | undefined,
): NotificationConfig[] {
    return deployNotifications.map((deployNotification): NotificationConfig => {
        if (deployNotification.webhookUrl) {
            return deployNotification as NotificationConfig;
        }

        const globalWebhookUrl = globalNotifications?.[0]?.webhookUrl;

        if (!globalWebhookUrl) {
            throw new KnownError(
                `Deploy notification for target '${deployNotification.target}' is missing webhookUrl and no top-level notification was found to fall back on.`,
            );
        }

        return {
            ...deployNotification,
            webhookUrl: globalWebhookUrl,
        };
    });
}
