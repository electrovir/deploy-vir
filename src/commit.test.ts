import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {getCommitAuthorName} from './commit.js';

describe(getCommitAuthorName.name, () => {
    it('uses the commit author when there is no pull request to read', async () => {
        assert.strictEquals(
            await getCommitAuthorName({
                author_name: 'Benjamin DeMann',
            }),
            'Benjamin DeMann',
        );
    });
});
