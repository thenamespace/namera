# @namera-ai/wallet-provider-oneclaw

Private Effect adapter for 1Claw organization setup, agents, Ethereum keys and
exact-digest signing. Application uses it for managed account and session signers.
It does not persist credentials, construct smart accounts or broadcast transactions.

## Services

| Service group | Responsibility                                                          |
| ------------- | ----------------------------------------------------------------------- |
| `connections` | Upsert/find connections, bootstrap an empty customer, reissue claims    |
| `customers`   | Redeem claims, verify identity and enable delegation                    |
| `agents`      | Create/read agents and configure raw signing                            |
| `signingKeys` | Create/list/deactivate Ethereum keys; destruction returns `UNSUPPORTED` |
| `signing`     | Exchange an agent credential and sign a 32-byte digest                  |

`OneClawService.layer` uses the SDK. Customer authority is checked against the
organization, connection, credential, configured app, expiry and remote identity.
Bootstrap requires an active empty template with the pinned version and owning
app. Application must persist the returned one-time agent credential before
creating a key or making another external call.

Signing exchanges the agent key for a fresh access token, checks the pinned key
identity and public material, then verifies the 65-byte recoverable signature
against the exact digest. It does not hash again or cache access tokens.

Deactivation uses verified customer authority and lists active keys before DELETE.
It checks the pinned key ID, version and public key because the provider deletes
by agent and chain. A successful list with no active Ethereum key reconciles an
earlier uncertain DELETE; a replacement key or a failed lookup never authorizes
another deletion. Deactivation does not claim permanent key destruction.

`OneClawOidcService` issues 120-second RS256 organization tokens and public JWKS.
The server hosts discovery and JWKS. Subjects use `namera:org:<id>` and emails must
be Namera-controlled because tokens assert verified email.

## Configuration

| Variable                          | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `ONECLAW_PLATFORM_APP_ID`         | Platform application                   |
| `ONECLAW_PLATFORM_API_KEY`        | Platform credential                    |
| `ONECLAW_EMPTY_TEMPLATE_ID`       | Empty bootstrap template               |
| `ONECLAW_EMPTY_TEMPLATE_VERSION`  | Pinned template version                |
| `ONECLAW_OIDC_ISSUER`             | Registered issuer                      |
| `ONECLAW_OIDC_AUDIENCE`           | Registered audience                    |
| `ONECLAW_OIDC_KEY_ID`             | Public signing-key identifier          |
| `ONECLAW_OIDC_PRIVATE_KEY_BASE64` | Base64-encoded complete RSA PKCS#8 PEM |

The server additionally requires `ONECLAW_ORG_EMAIL_DOMAIN`. Customer and agent
credentials are encrypted application records, not deployment variables.
Base64 is encoding, not encryption; keep the encoded PEM secret.

## Failure semantics

Provider errors are sanitized into bounded `OneClawError` codes. Calls have a
30-second deadline, but the SDK cannot cancel a remote request. An interrupted
mutation may have succeeded. The adapter never automatically retries it or claims
that local failure rolled back remote state. Application provisioning tracks
uncertainty and recovery. No automatic x402 payment signer is configured.

## Development

```sh
pnpm --filter @namera-ai/wallet-provider-oneclaw test
pnpm --filter @namera-ai/wallet-provider-oneclaw typecheck
pnpm --filter @namera-ai/wallet-provider-oneclaw build
```

Tests substitute fetch around the SDK. `oneClawTestLayer` supports typed scenarios;
`oneClawAccountTestLayer` provides deterministic keys and real test signatures.
Neither contacts 1Claw. See [account custody](../../../architecture/wallet-system/accounts.md).
