import {
    type DeployVirBranchConfig,
    type DeployVirRepoConfig,
    type NotificationConfig,
    type NotificationTarget,
} from '../config.js';
import {type DeployCommits} from '../git.js';

/**
 * Params for sending a notification.
 *
 * @category Internal
 */
export type NotificationParams<Target extends NotificationTarget = NotificationTarget> = {
    deployCommits: Readonly<DeployCommits>;
    branchConfig: Readonly<DeployVirBranchConfig>;
    repoConfig: Readonly<Pick<DeployVirRepoConfig, 'commitBaseUrl'>>;
    notification: Readonly<Extract<NotificationConfig, {target: Target}>>;
};
