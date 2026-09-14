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
export async function getCommitAuthorName({
    commit,
    gitUrl,
}: Readonly<{
    commit: Readonly<
        Pick<Commit, 'author_name'> & PartialWithUndefined<Pick<Commit, 'hash' | 'message'>>
    >;
    gitUrl: string;
}>): Promise<string> {
    const pullRequestAuthorName = await getPullRequestAuthorName({
        pullRequestNumber: commit.message?.match(pullRequestNumberRegExp)?.[1],
        hash: commit.hash,
        gitUrl,
    });

    return pullRequestAuthorName || commit.author_name;
}

function getPullRequestAuthorName({
    pullRequestNumber,
    hash,
    gitUrl,
}: Readonly<
    {
        gitUrl: string;
    } & PartialWithUndefined<{
        pullRequestNumber: string;
        hash: string;
    }>
>): Promise<string | undefined> {
    const pullRequestKey = pullRequestNumber || hash;

    if (!pullRequestKey) {
        return Promise.resolve(undefined);
    }

    /** Each repo gets its own cache entry because pull request numbers repeat across repos. */
    const cacheKey = [
        gitUrl,
        pullRequestKey,
    ].join(' ');

    const cached = pullRequestAuthorCache.get(cacheKey);

    if (cached) {
        return cached;
    }

    const pending = fetchPullRequestAuthorName(
        buildPullRequestAuthorCommand({
            gitUrl,
            hash,
            pullRequestNumber,
        }),
    );
    pullRequestAuthorCache.set(cacheKey, pending);

    return pending;
}

/**
 * Build the `gh` command that reads a pull request's assignees and author.
 *
 * `gh` picks its repo from the current directory's git remotes, which is not necessarily the repo
 * being deployed, so the repo is always pinned with `--repo`. Without that, a pull request number
 * from the deployed repo silently resolves to whatever unrelated pull request shares that number in
 * the current directory's repo.
 *
 * @category Internal
 */
export function buildPullRequestAuthorCommand({
    pullRequestNumber,
    hash,
    gitUrl,
}: Readonly<
    {
        gitUrl: string;
    } & PartialWithUndefined<{
        pullRequestNumber: string;
        hash: string;
    }>
>): string {
    const repoFlag = `--repo '${gitUrl}'`;

    return pullRequestNumber
        ? `gh pr view ${pullRequestNumber} ${repoFlag} --json assignees,author`
        : `gh pr list --search ${hash} ${repoFlag} --state merged --limit 1 --json assignees,author`;
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
