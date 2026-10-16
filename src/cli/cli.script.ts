import {FlagRequirement, parseArgs} from 'cli-vir';
import {join} from 'node:path';
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
            packageJsonPath: join(import.meta.dirname, '..', '..', 'package.json'),
            importMeta: import.meta,
        },
    ),
    process.cwd(),
);
