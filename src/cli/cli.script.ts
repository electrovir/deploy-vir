import {extractRelevantArgs} from '@augment-vir/node';
import {runDeployVirCli} from './cli.js';

await runDeployVirCli(
    extractRelevantArgs({
        binName: 'deploy-vir',
        fileName: import.meta.filename,
        rawArgs: process.argv,
    }),
    process.cwd(),
);
