### sessionKeyId

- **Type:** `string`
- **Required**

The session-key UUID returned by `sessionKeys.list()` or `sessionKeys.get()`.
This identifies the delegated session, not its signing key or network installation.
Your credential must have an active grant for this key.

For execution or signing, choose a key belonging to `walletId` with a confirmed
installation on `chainId` and permissions that allow the requested operation.
