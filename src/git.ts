import {assert, check} from '@augment-vir/assert';
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
    repoConfig: Readonly<Pick<DeployVirRepoConfig, 'name' | 'girUrl'>>,
): Promise<string> {
    assert.isTruthy(repoConfig.name, 'Repo config name cannot be empty.');
    assert.isTruthy(repoConfig.girUrl, 'Repo git URL cannot be empty.');

    const remotes = await git.getRemotes(true);

    const remoteMatchByUrl = remotes.find(
        (remote) =>
            remote.refs.fetch === repoConfig.girUrl || remote.refs.push === repoConfig.girUrl,
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

    await git.addRemote(newRemoteName, repoConfig.girUrl);

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
 * Push the deploy via git.
 *
 * @category Internal
 */
export async function pushDeploy(
    git: Readonly<SimpleGit>,
    {deployName, fromBranch, toBranch}: Readonly<DeployVirBranchConfig>,
    remoteName: string,
): Promise<DeployCommits> {
    assert.isTruthy(fromBranch, `Deploy '${deployName}' fromBranch cannot be empty.`);
    assert.isTruthy(toBranch, `Deploy '${deployName}' toBranch cannot be empty.`);
    assert.isTruthy(remoteName, 'Remote name cannot be empty.');

    await git.fetch(remoteName, fromBranch);

    const pushString = `${remoteName}/${fromBranch}:${toBranch}`;

    /** Get commits that are on {@link toBranch} but not on {@link fromBranch}. */
    const commitsAhead = (
        await git.log({
            from: `${remoteName}/${toBranch}`,
            to: `${remoteName}/${fromBranch}`,
        })
    ).all;

    if (!commitsAhead.length) {
        throw new KnownError('No commit diff: nothing to deploy!');
    }

    try {
        await git.push(remoteName, pushString);

        return {
            deployedCommits: commitsAhead,
            overwrittenCommits: [],
        };
    } catch (error) {
        log.error(`Push failed: ${extractErrorMessage(error)}`);

        /** Get commits that are on {@link toBranch} but not on {@link fromBranch}. */
        const commitsBehind = await git.log({
            from: `${remoteName}/${fromBranch}`,
            to: `${remoteName}/${toBranch}`,
        });

        if (commitsBehind.total > 0) {
            log.info(
                `\nThe following ${commitsBehind.total} commit${commitsBehind.total === 1 ? '' : 's'} are on ${logColors.bold}${toBranch}${logColors.reset} but not on ${logColors.bold}${fromBranch}${logColors.reset}:`,
            );
            commitsBehind.all.forEach((commit, index) => {
                log.faint(
                    `    ${index + 1}. ${commit.hash.slice(0, 7)} (${commit.author_name}) - ${commit.message}`,
                );
            });
        }

        const shouldForcePush = await askQuestion(
            `\nDo you want to force push ${logColors.bold}${fromBranch}${logColors.reset} to ${logColors.bold}${toBranch}${logColors.reset}?\n\n${logColors.warning}This will overwrite the commits listed above.${logColors.reset} (y/N): `,
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
            deployedCommits: commitsAhead,
            overwrittenCommits: commitsBehind.all,
        };
    }
}
