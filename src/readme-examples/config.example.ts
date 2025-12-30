import {defineDeployVirConfig, NotificationTarget} from '../index.js';

export default defineDeployVirConfig({
    repos: [
        {
            /** This does not need to match the actual repo name. */
            name: 'whatever',
            gitUrl: 'git@github.com:electrovir/deploy-vir.git',
            deploys: [
                {
                    deployName: 'staging',
                    branches: [
                        {
                            fromBranch: 'dev',
                            toBranch: 'staging',
                        },
                    ],
                },
                {
                    deployName: 'prod',
                    branches: [
                        {
                            fromBranch: 'staging',
                            toBranch: 'prod',
                        },
                    ],
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
