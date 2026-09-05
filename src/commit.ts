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

const pullRequestNumberRegExp = /#(\d+)/;

/**
 * Each `gh` lookup is a network request and each commit's author name gets read more than once (CLI
 * output and notifications), so results are cached by their lookup key.
 */
const pullRequestAuthorCache = new Map<string, Promise<string | undefined>>();

/**
 * Extract the owning person's name for a commit: the first assignee on the commit's pull request,
 * or that pull request's author (requires the `gh` CLI). Whoever merged a pull request is often not
 * whoever owns the change, so the commit's own author is only used when no pull request can be
 * read.
 *
 * @category Internal
 */
export async function getCommitAuthorName(
    commit: Readonly<
        Pick<Commit, 'author_name'> & PartialWithUndefined<Pick<Commit, 'hash' | 'message'>>
    >,
): Promise<string> {
    const pullRequestAuthorName = await getPullRequestAuthorName({
        pullRequestNumber: commit.message?.match(pullRequestNumberRegExp)?.[1],
        hash: commit.hash,
    });

    return pullRequestAuthorName || commit.author_name;
}

function getPullRequestAuthorName({
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

    const cached = pullRequestAuthorCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const pending = fetchPullRequestAuthorName(
        pullRequestNumber
            ? `gh pr view ${pullRequestNumber} --json assignees,author`
            : `gh pr list --search ${cacheKey} --state merged --limit 1 --json assignees,author`,
    );
    pullRequestAuthorCache.set(cacheKey, pending);

    return pending;
}

async function fetchPullRequestAuthorName(command: string): Promise<string | undefined> {
    try {
        const output = await runShellCommand(command, {
            rejectOnError: true,
        });

        return extractPullRequestAuthorName(JSON.parse(output.stdout));
    } catch (error) {
        log.faint(`Failed to read a pull request author: ${extractErrorMessage(error)}`);
        return undefined;
    }
}

function extractPullRequestAuthorName(parsedJson: unknown): string | undefined {
    /** `gh pr list` outputs an array, `gh pr view` outputs a single pull request. */
    const pullRequest = check.isArray(parsedJson) ? parsedJson[0] : parsedJson;
    const assignees =
        check.hasKey(pullRequest, 'assignees') && check.isArray(pullRequest.assignees)
            ? pullRequest.assignees
            : [];

    return [
        ...assignees,
        check.hasKey(pullRequest, 'author') ? pullRequest.author : undefined,
    ]
        .map(extractUserName)
        .find((name) => name);
}

function extractUserName(user: unknown): string | undefined {
    const name = check.hasKey(user, 'name') && check.isString(user.name) ? user.name : '';
    const login = check.hasKey(user, 'login') && check.isString(user.login) ? user.login : '';

    return name || login || undefined;
}
