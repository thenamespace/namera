# TypeScript SDK

The SDK is a promise-based adapter over the generated Effect HTTP client. Its
public methods return `NameraResult`, not raw HTTP responses. It depends on
protocol/API contracts and client-side cryptography, not backend application
services or custody-provider credentials.

## Surface

| Client        | Methods                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `auth`        | `currentActor`                                                                                                                     |
| `wallets`     | `list`, `get`, `create`, `createPasskeyRegistrationOptions`, `getPasskeyOwner`                                                     |
| `sessionKeys` | `list`, `get`, `create`, `revoke`, `prepareOperation`, `approveOperation`, `getOperation`, `getActiveOperation`, `cancelOperation` |
| `executions`  | `simulate`, `prepare`, `complete`, `execute`, `getStatus`, `get`, `list`                                                           |
| `signatures`  | `prepare`, `complete`, `sign`                                                                                                      |
| Root client   | `sign`, `verifySignature`                                                                                                          |

Account-owner transactions and session installation approval are not delegated
execution methods. Installation management has explicit API-key permissions and
is separate from session execution grants. The browser uses the corresponding HTTP contracts and owner
approval validation helpers.

## Transport

The configuration accepts exactly one API key, bearer token, or asynchronous
bearer-token supplier. API keys use `x-api-key`; OAuth uses `Authorization`.
The default origin is `https://api.namera.ai`.

Inputs are schema-decoded before requests or signer access. Successful responses
are decoded by HttpApi. Expected API errors preserve their tagged cause;
transport, contract, signer, and unexpected failures use separate result kinds.

Requests use manual redirects. Redirect responses fail rather than forwarding
credentials or mutation payloads. Injected Fetch implementations are trusted and
must preserve this policy.

Retry-enabled methods use three retries with exponential delays starting at
100 ms for transport failures, declared internal-server errors, and raw HTTP
408/5xx responses. Classification uses the received response status even when an
undeclared error body fails decoding. Malformed successful responses, redirects,
and business failures are not automatically retried. Each preparation creates one
random UUID idempotency key shared by its retries; a new method call gets a new key.

## Provisioning and owner operations

Managed account/session creation generates one internal idempotency key per SDK
invocation, reused across transient retries. Passkey and local registration do
not automatically retry single-use/non-idempotent creation. Public creation inputs
do not expose an idempotency key. Never submit private keys or custody credentials.

Session operation targets use `sessionKeyId`, `chainId`, and `kind`. The SDK reads
the session, selects its installation and owner type, then dispatches to the
existing managed/passkey endpoint. Passkey preparations gain `approval: "passkey"`
for a uniform discriminated SDK result. These are low-level methods: callers
validate independently reviewed owner/call/fee expectations with the existing
owner-approval helpers before signing or approving.

Recovery reads the active operation and re-prepares an unsigned operation using
the server's stored retry request. The public SDK result exposes a preparation,
never an idempotency key. Approval retries retain the same operation and assertion;
only receipt confirmation establishes installation or removal. Cancellation is
limited to unsigned work. Passkey ceremony and assertion browser calls go through
the integrating application's authenticated backend, which keeps the API key.

## Execution

1. Decode the caller's wallet, session, chain, calls, and sponsorship request.
2. Prepare through the API.
3. For managed signing, validate the returned request and gas consent, then
   complete without a client signature.
4. For local signing, resolve the trusted local binding; compare authority,
   calls, chain, expiry, deployment data, and gas consent; recompute the UserOp
   hash; sign and verify the signature.
5. Recheck expiry after signing, then complete the same submission.

Completion retries reuse the submission and exact signature. The SDK does not
treat successful submission as chain confirmation. Status reads use the server's
submission resource, and confirmed details use the execution resource.

Self-funded operations require an explicit fee ceiling. Managed execution uses
the client's `maxGasCostWei`; automatic Node resolution forwards that ceiling
to its local signer. Custom resolvers supply their own approved ceiling.

## Signatures

Local signatures require `allowSignatures: true` in the trusted binding and a
typed-data signer. The SDK validates the wrapped challenge, verifies the local
signature, then verifies that the completed account signature matches the expected
wrapper and requested account/network/type.

Managed signature completion is not automatically retried because the result is
not stored for replay. Repeating a new signing operation after response loss may
consume another signature allowance.

Low-level prepare/complete methods provide transport without the high-level
signing validation. Their caller owns that validation.

## Node and browser behavior

Node's entry point supplies an automatic local resolver. It imports the native
keystore only when a local challenge needs a signer. Reads and managed signing
do not open it. An explicit resolver takes precedence; `localSigning: false`
disables automatic resolution. Browsers supply their own resolver.

[Local keys](local-keys.md) describes encrypted storage and independent bindings.

## Source map

- [Client and exports](../../packages/sdk/src/client.ts)
- [Transport and retries](../../packages/sdk/src/transport.ts)
- [Execution orchestration](../../packages/sdk/src/executions.ts)
- [Signature orchestration](../../packages/sdk/src/signatures.ts)
- [Prepared-payload validation](../../packages/sdk/src/signing/execution-validation.ts)
- [Owner approval validation](../../packages/sdk/src/signing/owner-approval.ts)
