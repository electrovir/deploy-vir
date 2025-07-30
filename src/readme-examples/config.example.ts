import {defineDeployVirConfig, NotificationTarget} from '../index.js';

export default defineDeployVirConfig({
    repos: [
        {
            /** This does not need to match the actual repo name. */
            name: 'whatever',
            girUrl: 'git@github.com:electrovir/deploy-vir.git',
            deploys: [
                {
                    deployName: 'staging',
                    fromBranch: 'dev',
                    toBranch: 'staging',
                },
                {
                    deployName: 'prod',
                    fromBranch: 'staging',
                    toBranch: 'prod',
                },
            ],
        },
    ],
    notifications: [
        {
            target: NotificationTarget.Slack,
            webhookUrl: 'https://hooks.slack.com/services/X/X/X',
            channelName: '#deploys',
        },
    ],
});
