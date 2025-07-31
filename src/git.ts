import {assert, assertWrap, check} from '@augment-vir/assert';
import {extractErrorMessage, log, logColors} from '@augment-vir/common';
import {askQuestion} from '@augment-vir/node';
import {type DefaultLogFields, type ListLogLine, type SimpleGit} from 'simple-git';
import {type DeployVirBranchConfig, type DeployVirRepoConfig} from './config.js';
import {KnownError} from './known.error.js';

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

    const remoteMatchByUrl = remotes.find(
        (remote) =>
            remote.refs.fetch === repoConfig.gitUrl || remote.refs.push === repoConfig.gitUrl,
    );

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
 * A git commit.
 *
 * @category Internal
 */
export type Commit = DefaultLogFields & ListLogLine;

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
};

/**
 * Push the deploy via git.
 *
 * @category Internal
 */
export async function pushDeploy(
    git: Readonly<SimpleGit>,
    {deployName, fromBranch, toBranch}: Readonly<DeployVirBranchConfig>,
    remoteName: string,
): Promise<DeployResult> {
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

    try {
        await git.push(remoteName, pushString);

        return {
            deployCommits: {
                deployedCommits: commitsAhead,
                overwrittenCommits: [],
            },
            branchStatus: {
                before: beforeCommit,
                after: afterCommit,
            },
        };
    } catch (error) {
        log.error(`Push failed: ${extractErrorMessage(error)}`);

        /** Get commits that are on {@link toBranch} but not on {@link fromBranch}. */
        const commitsBehind = (
            await git.log([
                `${remoteName}/${fromBranch}..${remoteName}/${toBranch}`,
            ])
        ).all;

        if (commitsBehind.length > 0) {
            log.info(`\nOnly on ${logColors.bold}${fromBranch}${logColors.reset}:`);
            commitsAhead.forEach((commit, index) => {
                log.faint(
                    `    ${index + 1}. ${commit.hash.slice(0, 7)} (${commit.author_name}) - ${commit.message}`,
                );
            });

            log.info(`\nOnly on ${logColors.bold}${toBranch}${logColors.reset}:`);
            commitsBehind.forEach((commit, index) => {
                log.faint(
                    `    ${index + 1}. ${commit.hash.slice(0, 7)} (${commit.author_name}) - ${commit.message}`,
                );
            });
        }

        const shouldForcePush = await askQuestion(
            `\nDo you want to force push ${logColors.bold}${fromBranch}${logColors.reset} to ${logColors.bold}${toBranch}${logColors.reset}?\n\n${logColors.warning}This will overwrite the commits only on ${logColors.bold}${toBranch}${logColors.normalWeight}.${logColors.reset} (y/N): `,
        );

        if (shouldForcePush.toLowerCase() === 'y' || shouldForcePush.toLowerCase() === 'yes') {
            await git.push(remoteName, pushString, ['--force']);
            log.warning(
                `Force pushed ${logColors.bold}${fromBranch}${logColors.reset} to ${logColors.bold}${toBranch}${logColors.reset}.`,
            );
        } else {
            throw new KnownError(`Deploy aborted.`);
        }

        return {
            deployCommits: {
                deployedCommits: commitsAhead,
                overwrittenCommits: commitsBehind,
            },
            branchStatus: {
                before: beforeCommit,
                after: afterCommit,
            },
        };
    }
}
