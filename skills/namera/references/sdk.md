# SDK

For a new integration, follow [Getting Started](https://namera.ai/docs/sdk/getting-started.md).
Use [Authentication](https://namera.ai/docs/sdk/authentication.md) for credentials
and [NameraClient](https://namera.ai/docs/sdk/reference/client/namera-client.md)
for client options. Read [Results and Errors](https://namera.ai/docs/sdk/handling-results-and-errors.md)
when handling SDK responses.

## Accounts and session keys

- Find an account or key: [Accounts and Session Keys](https://namera.ai/docs/sdk/accounts-and-session-keys.md).
- Create an account: [Create Accounts](https://namera.ai/docs/sdk/guides/accounts/create-accounts.md).
- Register a signer: [Create Session Keys](https://namera.ai/docs/sdk/guides/accounts/create-session-keys.md).
- Activate its permissions: [Install Session Keys](https://namera.ai/docs/sdk/guides/accounts/install-session-keys.md).
- Remove access: [Revoke Session Keys](https://namera.ai/docs/sdk/guides/accounts/revoke-session-keys.md).

Registration does not install onchain authority. Follow the owner approval and
confirmation flow for each network. Read [Permissions](https://namera.ai/docs/sdk/permissions.md)
when choosing the session's scope.

## Signing

Choose [messages](https://namera.ai/docs/sdk/guides/signing/sign-messages.md),
[typed data](https://namera.ai/docs/sdk/guides/signing/sign-typed-data.md), or
[verification](https://namera.ai/docs/sdk/guides/signing/verify-signatures.md).
A session allowed to transfer assets is not necessarily allowed to sign messages.
