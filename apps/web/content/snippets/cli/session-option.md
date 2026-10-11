### --session-key

- **Type:** `string` (session-key ID)
- **Required:** for non-interactive input flags

Choose a key belonging to the selected account. Find IDs with
`namera --output json session-key list --wallet <wallet-id>`. Input flags require
session-key read access to validate the key. Execution and signing also require
a grant, an active installation on the chosen network, and matching permissions.
