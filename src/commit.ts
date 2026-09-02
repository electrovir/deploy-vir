import {check} from '@augment-vir/assert';
import {extractErrorMessage, log, type PartialWithUndefined} from '@augment-vir/common';
import {runShellCommand} from '@augment-vir/node';
import {type DefaultLogFields, type ListLogLine} from 'simple-git';

/**
 * A git commit.
 *
 * @category Internal
 */
export type Commit = DefaultLogFields & ListLogLine;

const coAuthorRegExp = /^co[- \t]*authored[- \t]*by:(.*)$/gim;
const pullRequestNumberRegExp = /#(\d+)/;
const botNameSuffix = '[bot]';
/**
 * AI agents write their own `Co-authored-by:` trailer with a person-like name that has no `[bot]`
 * suffix (like `Claude <noreply@anthropic.com>`), so their email domain is the only reliable signal
 * that the co-author isn't a human.
 */
const botEmailDomains = [
    'anthropic.com',
    'cursor.com',
    'openai.com',
];

/**
 * Each `gh` lookup is a network request and each commit's author name gets read more than once (CLI
 * output and notifications), so results are cached by their lookup key.
 */
const pullRequestAssigneeCache = new Map<string, Promise<string | undefined>>();

/**
 * Extract the human author name for a commit. The first non-bot assignee on the commit's pull
 * request wins, since whoever merged a pull request is often not whoever owns the change (requires
 * the `gh` CLI). Failing that, commits authored by a bot (a name with a `[bot]` suffix, like
 * GitHub's merge queue bot) are attributed to their first non-bot `Co-authored-by:` trailer. A
 * co-author counts as a bot when its name has the `[bot]` suffix or its email is on a known agent
 * domain. All fallbacks resolve to the commit's own author name.
 *
 * @category Internal
 */
export async function getCommitAuthorName(
    commit: Readonly<
        Pick<Commit, 'author_name' | 'body'> &
            PartialWithUndefined<Pick<Commit, 'hash' | 'message'>>
    >,
): Promise<string> {
    const isBotAuthor = commit.author_name.endsWith(botNameSuffix);
    const pullRequestNumber = commit.message?.match(pullRequestNumberRegExp)?.[1];
    /**
     * Searching for a pull request by commit hash is much slower than reading one by number, so
     * it's reserved for bot commits, where the commit's own author is never the right answer.
     */
    const assigneeName =
        pullRequestNumber || isBotAuthor
            ? await getPullRequestAssigneeName({
                  pullRequestNumber,
                  hash: commit.hash,
              })
            : undefined;

    if (assigneeName) {
        return assigneeName;
    } else if (!isBotAuthor) {
        return commit.author_name;
    }

    const coAuthorName = Array.from(commit.body.matchAll(coAuthorRegExp))
        .map((match) => parseCoAuthor(match[1] || ''))
        .find((coAuthor) => coAuthor.name && !isBotCoAuthor(coAuthor))?.name;

    return coAuthorName || commit.author_name;
}

/** Split a `Co-authored-by:` trailer value into its name and its optional `<email>`. */
function parseCoAuthor(trailerValue: string) {
    const [
        namePart,
        emailPart,
    ] = trailerValue.split('<');

    return {
        name: (namePart || '').trim(),
        email: (emailPart || '').split('>')[0]?.trim().toLowerCase() || '',
    };
}

function isBotCoAuthor({name, email}: Readonly<{name: string; email: string}>) {
    return (
        name.endsWith(botNameSuffix) ||
        botEmailDomains.some((botEmailDomain) => email.endsWith(`@${botEmailDomain}`))
    );
}

function getPullRequestAssigneeName({
    pullRequestNumber,
    hash,
}: Readonly<
    PartialWithUndefined<{
        pullRequestNumber: string;
        hash: string;
    }>
>): Promise<string | undefined> {
    const cacheKey = pullRequestNumber || hash;

    if (!cacheKey) {
        return Promise.resolve(undefined);
    }

    const cached = pullRequestAssigneeCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const pending = fetchPullRequestAssigneeName(
        pullRequestNumber
            ? `gh pr view ${pullRequestNumber} --json assignees`
            : `gh pr list --search ${cacheKey} --state merged --limit 1 --json assignees`,
    );
    pullRequestAssigneeCache.set(cacheKey, pending);

    return pending;
}

async function fetchPullRequestAssigneeName(command: string): Promise<string | undefined> {
    try {
        const output = await runShellCommand(command, {
            rejectOnError: true,
        });

        return extractAssigneeName(JSON.parse(output.stdout));
    } catch (error) {
        log.faint(`Failed to read a pull request assignee: ${extractErrorMessage(error)}`);
        return undefined;
    }
}

function extractAssigneeName(parsedJson: unknown): string | undefined {
    /** `gh pr list` outputs an array, `gh pr view` outputs a single pull request. */
    const pullRequest = check.isArray(parsedJson) ? parsedJson[0] : parsedJson;

    if (!check.hasKey(pullRequest, 'assignees') || !check.isArray(pullRequest.assignees)) {
        return undefined;
    }

    return pullRequest.assignees
        .map((assignee) => {
            const name =
                check.hasKey(assignee, 'name') && check.isString(assignee.name)
                    ? assignee.name
                    : '';
            const login =
                check.hasKey(assignee, 'login') && check.isString(assignee.login)
                    ? assignee.login
                    : '';

            return name || login;
        })
        .find((name) => name && !name.endsWith(botNameSuffix));
}
