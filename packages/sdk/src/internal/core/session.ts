/**
 * Converts a time in milliseconds to the whole seconds sessions use on chain (`validAfter`, `validUntil`).
 *
 * @internal
 */
export const secondsFromMillis = (millis: number): number => Math.floor(millis / 1000)
