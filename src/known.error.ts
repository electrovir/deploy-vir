/**
 * A known error that won't get its full stack trace logged.
 *
 * @category Internal
 */
export class KnownError extends Error {
    public override readonly name = 'KnownError';
}
