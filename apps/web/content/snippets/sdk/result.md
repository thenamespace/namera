API methods return a `Promise<NameraResult<T, E>>`. When `success` is `true`,
`data` contains the value described below and `error` is `null`. On failure,
`data` is `null` and `error` describes the failure.

The JSON example shows the complete successful `data`, with illustrative values.
Date-time values use ISO strings in JSON; bigint values use decimal strings.
See [Handling Results and Errors](/docs/sdk/handling-results-and-errors) for the error shape.
