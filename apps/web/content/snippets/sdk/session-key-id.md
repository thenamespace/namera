### sessionKeyId

- **Type:** `string`
- **Required**

The session-key UUID returned by `sessionKeys.list()` or `sessionKeys.get()`.
This identifies the delegated session, not its signing key or network installation.
Execution and signing require an active grant for this key. Management reads may
instead use explicit workspace `session-key:read` permission.

For execution or signing, choose a key belonging to `walletId` with a confirmed
installation on `chainId` and permissions that allow the requested operation.
