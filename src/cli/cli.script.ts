import {FlagRequirement, parseArgs} from 'cli-vir';
import {runDeployVirCli} from './cli.js';

await runDeployVirCli(
    parseArgs(
        process.argv,
        {
            y: {
                flag: {
                    valueRequirement: FlagRequirement.Blocked,
                },
                description: 'If set, bypass manual validation.',
            },
            args: {
                position: {
                    rest: true,
                },
            },
        },
        {
            binName: 'deploy-vir',
            importMeta: import.meta,
        },
    ),
    process.cwd(),
);
