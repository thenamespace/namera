### --params

- **Type:** JSON string
- **Required:** only when replacing individual input flags

Pass the complete request as one JSON object. Use this for batch calls or
scripts that already construct requests. JSON uses `eip155` for the namespace,
CAIP-2 chain IDs, and decimal strings for bigint quantities.

Do not combine it with individual transaction or signature input flags. It can
be used with `--profile` and global output options. Supplying JSON skips the
interactive selection and its extra account/session-key reads; authorization
and request validation still apply.
