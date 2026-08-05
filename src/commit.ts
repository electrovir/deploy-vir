import {type DefaultLogFields, type ListLogLine} from 'simple-git';

/**
 * A git commit.
 *
 * @category Internal
 */
export type Commit = DefaultLogFields & ListLogLine;

const coAuthorRegExp = /^co[- \t]*authored[- \t]*by:(.*)$/gim;
const botNameSuffix = '[bot]';

/**
 * Extract the human author name for a commit. Commits authored by a bot (a name with a `[bot]`
 * suffix, like GitHub's merge queue bot) are attributed to their first non-bot `Co-authored-by:`
 * trailer instead.
 *
 * @category Internal
 */
export function getCommitAuthorName(
    commit: Readonly<Pick<Commit, 'author_name' | 'body'>>,
): string {
    if (!commit.author_name.endsWith(botNameSuffix)) {
        return commit.author_name;
    }

    const coAuthorName = Array.from(commit.body.matchAll(coAuthorRegExp))
        /** Strip the trailing `<email>` from each trailer. */
        .map((match) => (match[1] || '').split('<')[0]?.trim())
        .find((name) => name && !name.endsWith(botNameSuffix));

    return coAuthorName || commit.author_name;
}
