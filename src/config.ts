/**
 * The full deploy-vir config object.
 *
 * @category Config
 */
export type DeployVirConfig = {
    repos: DeployVirRepoConfig[];
    notifications?: NotificationConfig[] | undefined;
};

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
    }[];
};

/**
 * Define a type safe deploy-vir config.
 *
 * @category Internal
 */
export function defineDeployVirConfig(config: Readonly<DeployVirConfig>) {
    return config;
}
