// cspell:word Coauthoredby

import {assert} from '@augment-vir/assert';
import {describe, it} from 'node:test';
import {getCommitAuthorName} from './commit.js';

describe(getCommitAuthorName.name, () => {
    it('uses the author name for a human author', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'Benjamin DeMann',
                body: 'Co-authored-by: electrovir <electrovir@users.noreply.github.com>\n',
            }),
            'Benjamin DeMann',
        );
    });

    it('uses the co-author for a bot author', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'merge-bot[bot]',
                body: 'Co-authored-by: electrovir <electrovir@users.noreply.github.com>\n',
            }),
            'electrovir',
        );
    });

    it('skips bot co-authors', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'merge-bot[bot]',
                body: [
                    'Co-authored-by: deploy-bot[bot] <deploy-bot@users.noreply.github.com>',
                    'Co-authored-by: electrovir <electrovir@users.noreply.github.com>',
                ].join('\n'),
            }),
            'electrovir',
        );
    });

    it('falls back to the bot name when there are no co-authors', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'merge-bot[bot]',
                body: 'just a commit body\n',
            }),
            'merge-bot[bot]',
        );
    });

    it('falls back to the bot name when all co-authors are bots', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'merge-bot[bot]',
                body: 'Co-authored-by: deploy-bot[bot] <deploy-bot@users.noreply.github.com>\n',
            }),
            'merge-bot[bot]',
        );
    });

    it('handles co-author trailer separator variations', () => {
        assert.deepEquals(
            [
                'Coauthored-by:',
                'Co authored by:',
                'Co-authored  by:',
                'Coauthoredby:',
            ].map((trailerStart) => {
                return getCommitAuthorName({
                    author_name: 'merge-bot[bot]',
                    body: `${trailerStart} electrovir <electrovir@users.noreply.github.com>\n`,
                });
            }),
            [
                'electrovir',
                'electrovir',
                'electrovir',
                'electrovir',
            ],
        );
    });

    it('handles co-author trailers without an email', () => {
        assert.strictEquals(
            getCommitAuthorName({
                author_name: 'merge-bot[bot]',
                body: 'co-authored-by:   electrovir  \r\n',
            }),
            'electrovir',
        );
    });
});
