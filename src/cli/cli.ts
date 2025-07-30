import {assertWrap} from '@augment-vir/assert';
import {extractErrorMessage, log} from '@augment-vir/common';
import simpleGit from 'simple-git';
import {type DeployVirConfig} from '../config.js';
import {getGitRemoteName, pushDeploy} from '../git.js';
import {KnownError} from '../known.error.js';
import {sendNotifications} from '../notifications/send-notifications.js';

/**
 * Run the deploy-vir CLI.
 *
 * @category Internal
 */
export async function runDeployVirCli(args: ReadonlyArray<string>, cwd = process.cwd()) {
    const configPath = assertWrap.isTruthy(args[0], 'Missing config path.');
    const repoName = assertWrap.isTruthy(args[1], 'Missing repo name.');
    const deployName = assertWrap.isTruthy(args[2], 'Missing deploy name.');

    const config = (await import(configPath)).default;

    await runDeployVir({cwd, deployName, repoName}, config);
}

/**
 * Args for {@link runDeployVir}.
 *
 * @category Internal
 */
export type DeployVirArgs = {
    /** This must match a repo name in your config. */
    repoName: string;
    /** This much match a deploy name in your config. */
    deployName: string;
    cwd: string;
};

/**
 * Run a deploy.
 *
 * @category Main
 */
export async function runDeployVir(
    args: Readonly<DeployVirArgs>,
    config: Readonly<DeployVirConfig>,
) {
    try {
        const git = simpleGit(args.cwd);

        const repoConfig = assertWrap.isDefined(
            config.repos.find(
                (repo) => repo.name === args.repoName,
                `Failed to find a repo config by name '${args.repoName}'`,
            ),
        );
        const branchConfig = assertWrap.isDefined(
            repoConfig.deploys.find(
                (deploy) => deploy.deployName === args.deployName,
                `Failed to find a deploy named '${args.deployName}' in repo '${args.repoName}'.`,
            ),
        );
        const remoteName = await getGitRemoteName(git, repoConfig);
        log.faint(`Remote: ${remoteName}`);

        const deployCommits = await pushDeploy(git, branchConfig, remoteName);

        if (config.notifications?.length) {
            await sendNotifications(config.notifications, {
                branchConfig,
                deployCommits,
                repoConfig,
            });
        }
    } catch (error) {
        if (error instanceof KnownError) {
            /** If its a known error, don't log the whole stack trace. */
            log.error(extractErrorMessage(error));
        } else {
            log.error(error);
        }
    }
}
