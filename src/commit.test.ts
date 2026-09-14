import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {buildPullRequestAuthorCommand, getCommitAuthorName} from './commit.js';

describe(getCommitAuthorName.name, () => {
    it('uses the commit author when there is no pull request to read', async () => {
        assert.strictEquals(
            await getCommitAuthorName({
                commit: {
                    author_name: 'Benjamin DeMann',
                },
                gitUrl: 'git@github.com:electrovir/deploy-vir.git',
            }),
            'Benjamin DeMann',
        );
    });
});

describe(buildPullRequestAuthorCommand.name, () => {
    it('pins the deployed repo when reading a pull request by number', () => {
        assert.strictEquals(
            buildPullRequestAuthorCommand({
                gitUrl: 'git@github.com:electrovir/deploy-vir.git',
                pullRequestNumber: '123',
            }),
            "gh pr view 123 --repo 'git@github.com:electrovir/deploy-vir.git' --json assignees,author",
        );
    });

    it('pins the deployed repo when searching by commit hash', () => {
        assert.strictEquals(
            buildPullRequestAuthorCommand({
                gitUrl: 'https://github.com/electrovir/deploy-vir.git',
                hash: 'abc1234',
            }),
            "gh pr list --search abc1234 --repo 'https://github.com/electrovir/deploy-vir.git' --state merged --limit 1 --json assignees,author",
        );
    });
});
