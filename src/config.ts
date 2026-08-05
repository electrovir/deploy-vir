import {type MaybePromise, type PartialWithUndefined} from '@augment-vir/common';
import {type Commit} from './commit.js';
import {type DeployResult} from './git.js';

/**
 * The full deploy-vir config object.
 *
 * @category Config
 */
export type DeployVirConfig = {
    repos: DeployVirRepoConfig[];
    notifications?: NotificationConfig[] | undefined;
    hooks?: DeployVirHooks | undefined;
};

/**
 * Hooks to run at various points during a deploy.
 *
 * @category Config
 */
export type DeployVirHooks = {
    /**
     * Runs after the user accepts (or bypasses confirmation for) a deploy and the push has
     * completed successfully. Fires once per branch deploy. May optionally return values that
     * modify the resulting notification message.
     */
    postAccept?:
        | ((
              params: Readonly<PostAcceptHookParams>,
          ) => MaybePromise<PostAcceptHookResult | void | undefined>)
        | undefined;
};

/**
 * Params passed to a {@link DeployVirHooks.postAccept} hook.
 *
 * @category Config
 */
export type PostAcceptHookParams = {
    repoConfig: Readonly<DeployVirRepoConfig>;
    branchConfig: Readonly<DeployVirBranchConfig>;
    fromBranch: string;
    toBranch: string;
    remoteName: string;
    deployResult: Readonly<DeployResult>;
    /**
     * All commits included in this deploy (the commits being pushed from `fromBranch` to
     * `toBranch`).
     */
    newCommits: ReadonlyArray<Readonly<Commit>>;
};

/**
 * Optional values that a {@link DeployVirHooks.postAccept} hook can return to augment the resulting
 * notification message.
 *
 * @category Config
 */
export type PostAcceptHookResult = PartialWithUndefined<{
    /** Inserted into the notification immediately after the "<X> Pushed" header line. */
    prependToNotification: string;
    /** Appended to the very end of the notification message. */
    appendToNotification: string;
}>;

/**
 * All available targets for sending notifications to.
 *
 * @category Internal
 */
export enum NotificationTarget {
    Slack = 'slack',
}

/**
 * Notification config for Slack.
 *
 * @category Internal
 */
export type SlackNotificationConfig = {
    target: NotificationTarget;
    /**
     * Find or create this by going to:
     *
     * Apps and workflows > Custom Integrations > Incoming WebHooks
     */
    webhookUrl: string;
    /**
     * An emoji string for the Webhook's message. If not provided, the Webhook integration's avatar
     * that you set will be used.
     */
    avatarEmoji?: string | undefined;
    /**
     * A username for the Webhook's message. If not provided, the Webhook integration's avatar that
     * you set will be used.
     */
    username?: string | undefined;
    /** A channel for the Webhook's message. If not provided, the Webhook integration */
    channelName: string | undefined;
    /**
     * By default the notification will list out all commits that are getting deployed. This will
     * turn that off.
     */
    hideAllCommits?: boolean | undefined;
};

/**
 * Config for a notification when a deploy runs.
 *
 * @category Config
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases
export type NotificationConfig = SlackNotificationConfig;

/**
 * A deploy-level notification override. Same as {@link NotificationConfig} but `webhookUrl` is
 * optional — when omitted, the first matching top-level notification's `webhookUrl` is used.
 *
 * @category Config
 */
export type DeployNotificationConfig = Omit<SlackNotificationConfig, 'webhookUrl'> & {
    webhookUrl?: string | undefined;
};

/**
 * A repo config for deploying.
 *
 * @category Config
 */
export type DeployVirRepoConfig = {
    /**
     * Does not need to match the actual repo name in GitHub, it can just be whatever name you want
     * to call it for deploy-vir.
     */
    name: string;
    /**
     * A git URL to the repo.
     *
     * @example
     *
     * - 'git@github.com:electrovir/deploy-vir.git'
     * - 'https://github.com/electrovir/deploy-vir.git'
     */
    gitUrl: string;
    /**
     * A url to the base commit path for links. The commit hash will be appended to this for links
     * in notifications. If this is omitted, there simply won't be any links.
     *
     * @example
     *
     * - 'https://github.com/electrovir/deploy-vir/commit'
     */
    commitBaseUrl?: string | undefined;
    deploys: DeployVirBranchConfig[];
    enableNotifications?: boolean | undefined;
};

/**
 * A deploy configuration.
 *
 * @category Config
 */
export type DeployVirBranchConfig = {
    deployName: string;
    branches: {
        fromBranch: string;
        toBranch: string;
        enableNotifications?: boolean | undefined;
    }[];
    enableNotifications?: boolean | undefined;
    /**
     * Deploy-level notification overrides. When set, these are used instead of the top-level
     * notifications. If a notification here omits `webhookUrl`, the first top-level notification
     * with the same `target` provides it. Setting this also implicitly enables notifications for
     * this deploy.
     */
    notifications?: DeployNotificationConfig[] | undefined;
};

/**
 * Define a type safe deploy-vir config.
 *
 * @category Internal
 */
export function defineDeployVirConfig(config: Readonly<DeployVirConfig>) {
    return config;
}
