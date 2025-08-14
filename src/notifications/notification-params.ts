import {
    type DeployVirBranchConfig,
    type DeployVirRepoConfig,
    type NotificationConfig,
    type NotificationTarget,
} from '../config.js';
import {type DeployResult} from '../git.js';

/**
 * Params for sending a notification.
 *
 * @category Internal
 */
export type NotificationParams<Target extends NotificationTarget = NotificationTarget> = {
    deployResult: Readonly<DeployResult>;
    branchConfig: Readonly<DeployVirBranchConfig>;
    repoConfig: Readonly<Pick<DeployVirRepoConfig, 'commitBaseUrl' | 'name'>>;
    notification: Readonly<Extract<NotificationConfig, {target: Target}>>;
};
