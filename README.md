# deploy-vir

Deploy from branch to branch via git.

## Install

```sh
npm i -D deploy-vir
```

## Setup

Add a TypeScript or JavaScript config file somewhere in your repo. Its default export should be your config:

<!-- example-link: src/readme-examples/config.example.ts -->

```TypeScript
import {defineDeployVirConfig, NotificationTarget} from 'deploy-vir';

export default defineDeployVirConfig({
    repos: [
        {
            /** This does not need to match the actual repo name. */
            name: 'whatever',
            gitUrl: 'git@github.com:electrovir/deploy-vir.git',
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
```

## Running

Then just run the CLI:

```sh
npx deploy-vir <path-to-config> <repo-name-to-deploy> <deploy-name-to-deploy>
```
