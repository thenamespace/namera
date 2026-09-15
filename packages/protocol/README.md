# @namera-ai/protocol

Shared contracts for the Namera backend and its clients. This package owns
runtime Effect schemas and their inferred TypeScript types; it contains no
database queries, HTTP handlers, provider SDKs, or application logic.

See [contract package architecture](../../architecture/packages/contracts.md)
for protocol/API ownership, schema rules, and public-change sequencing.

## Structure

- `src/common/` — shared primitives such as normalized email and branded IDs.
- `src/model/` — persistence/domain models and insert/update schemas, including
  discriminated audit-event unions and provider-neutral durable jobs.
- `src/dto/` — public API request and response schemas.
- `src/dto/mcp.ts` — safe structured results returned by MCP tools.
- `src/evm/` — CAIP identifiers and reusable EVM execution primitives.
- `src/local/` — client-only local signer bindings and encrypted export format;
  never include these key-material schemas in HTTP contracts or audit data.
- `src/errors/` — typed errors used across the project.
- `src/policy/` — provider-neutral policy handler contracts and normalized
  namespace-specific evaluation contexts.
- `src/index.ts` — common values and errors.

## Public imports

```ts
import { Email, UserId } from "@namera-ai/protocol";
import { RequestMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Eip155ChainId, EvmCall } from "@namera-ai/protocol/evm";
import { User, UserInsert } from "@namera-ai/protocol/model";
```

## Rules

- Decode untrusted input with Effect `Schema`; derive types from schemas.
- Normalize values at the protocol boundary when normalization is a domain rule.
- Brand stable identities and values whose distinction prevents real mistakes.
  Ordinary validated strings do not need brands.
- DTOs describe the public wire contract. Models describe shared domain or
  persistence shapes; do not expose sensitive model fields through DTOs.
- Session responses expose their creation time as the login timestamp while
  keeping token hashes private.
- Define typed project errors here and import them from the owning package.
- Give public `HttpApi` errors their semantic status in schema annotations and
  add each union alternative to endpoints so statuses are preserved in OpenAPI
  and runtime responses.
- Keep schemas readonly unless mutation is explicitly required.
- Audit event payloads are versioned discriminated unions. Their `data` is
  required and must contain only safe historical context, never credentials or
  provider secrets.
- Email job payloads are closed discriminated unions decoded again by the
  worker after decryption. Add template variables to that union rather than
  storing an untyped object. Keep values semantic so code-owned React Email
  templates can format them at delivery time.
- Notification payloads are versioned discriminated unions. Add a concrete
  payload before persisting a new notification type. Preferences use typed
  category/topic pairs and currently allow only the email channel; in-app
  delivery is mandatory. Keep legacy audit payload versions decodable when the
  preference taxonomy changes.
- Billing models are provider-neutral and organization-scoped. Persist the
  code-owned plan key and plan version on subscription history; do not put plan
  state back on the organization model. Subscription components and usage
  meters use stable code-owned discriminators. Periods snapshot plan versions,
  balances normalize usage by meter, reservations protect concurrent capacity,
  immutable debit/credit events preserve billing evidence, and delivery rows
  track outbound provider reporting separately from inbound provider events.
- Wallet responses are namespace-discriminated unions. Add each new chain
  namespace as its own response member, then discriminate implementation data
  within that namespace. Never expose wallet-key provider identifiers or
  provider metadata through public wallet DTOs.
- API keys are organization-owned authentication subtypes of `Actor`. Their
  persistence model contains the credential hash, while create/get/list/revoke DTOs
  expose only safe key identification data and return the raw credential only
  from creation. Session-key grants remain attached to `ActorId`; do not copy
  grant permissions into API-key metadata.
- OAuth clients are software identities, not Namera actors. An approved OAuth
  authorization creates an organization-scoped `mcp` or `cli` actor;
  session-key access continues through ordinary grants. Authorization codes,
  device codes, and bearer tokens are represented only by hashes. OAuth models
  live under `model/auth/oauth` and
  keep PKCE, resource indicators, scopes, token families, and lifecycle state
  explicit without exposing credentials through public DTOs. RFC 7591 dynamic
  registration accepts only public clients and exact HTTPS or loopback HTTP
  redirect URIs; it never issues a client secret. PKCE schemas enforce the
  complete verifier grammar and the exact base64url-encoded `S256` challenge
  shape.
- Session keys belong to one wallet, are discriminated by chain namespace, and
  carry an immutable namespace-specific `policies` array.
  Each policy instance has a stable `PolicyId` so its handler can address typed
  state and in-flight reservations. The EVM model supports stateless
  `evm.time-window`, stateless `evm.chain-allowlist`, and stateful
  `evm.native-spend-limit` and `evm.gas-budget` policies. Time-window
  dates encode as ISO strings, while native amounts encode as decimal strings.
  Native-spend limits are unique per chain and allowance period and support
  per-operation, fixed UTC hour/day/week/month, and lifetime ceilings. The
  public creation DTO supports time-window, chain-allowlist, gas-budget,
  native-spend-limit, and signature policies and
  requires a time window. SQL timestamp columns continue using date-backed
  schemas. Policy reservations use a discriminated execution-or-signature
  operation reference while their persisted model exposes the corresponding
  nullable foreign-key pair. Grants are
  organization-scoped actor-to-session-key records and preserve revoked
  history.
- Wallet metadata updates replace only presentation metadata. Session-key
  revocation is idempotent and returns the same expanded response contract as
  create/get/list while preserving the immutable policy set.
- Execution submissions are mutable operational records discriminated by
  namespace. They preserve actor/grant authorization, idempotency, lifecycle,
  and the namespace payload required for crash recovery. Executions reference
  exactly one submission and remain append-only successful onchain records;
  rejected or failed submissions are not execution records.
- EVM execution contracts model the EntryPoint 0.7 UserOperation used by the
  installed Viem adapter. Quantities decode to `bigint` and encode to strings so
  signed operations remain safe to store in JSONB and can be reconstructed
  exactly for submission or reconciliation. Confirmed execution list items
  expand the safe account response, session-key summary, and initiating actor
  identity needed by activity consumers without exposing credential data.
- Execution simulation contracts return normalized call results separately from
  point-in-time session-key policy eligibility. Allowed responses identify the
  explicitly selected installed session key; denied responses identify that session's
  first deterministic policy ID and bounded denial code.
- Execution requests expose an optional `sponsor` flag. Omission is canonically
  equivalent to `true`; `false` requests a self-funded UserOperation. Both modes
  consume execution usage, while only sponsored mainnet operations consume the
  sponsored-gas meter.
- Local execution signing contracts live in `dto/execution-signing.ts`.
  Preparation explicitly selects a session and returns a stored operation with
  an EIP-191 signing message; completion accepts only its submission identity
  and raw secp256k1 signature. The HTTP prepare/complete workflow is implemented;
  the legacy execute entry point fails closed while clients migrate.
- EVM policy handlers receive `EvmIntentContext`, which separates normalized
  calls, the prepared UserOperation gas envelope, the standardized bundler
  gas-estimation result, and normalized `simulateCalls` outcomes. The latter
  includes bounded account-relative asset changes and traced native transfers
  at the simulated block. Policy evaluation returns a typed allowed decision or
  the first policy ID and bounded denial code. Keep Viem clients, provider
  errors, signatures, raw logs, and raw provider responses outside this
  contract.
- Signature DTOs are namespace-discriminated and expose only EVM `message` and
  EIP-712 `typed-data` operations. Raw digest signing is intentionally absent.
  Signature authorization uses its own `EvmSignatureContext` and requires an
  explicit `evm.signature` policy listing the allowed operation types. New
  policies enabling typed data may omit `typedDataRules` to allow all typed data.
  When supplied, the allowlist must be nonempty and specifies chain, verifying
  contract and primary types; domain name/version are optional exact matches.
  The dashboard omits the allowlist when no rules are added. Matching
  verification DTOs include the original payload and signature and return the
  resolved smart-account address with a boolean validity result.
- EVM chain contracts distinguish the stable supported-network key, the chain
  name used for presentation/icons, and the exact supported CAIP-2 chain ID.
  Provider-specific RPC slugs do not belong in protocol.

## Adding a contract

1. Put reusable primitives and branded identities in `common`, persistence
   shapes in `model`, public wire shapes in `dto`, and expected tagged failures
   in `errors`.
2. Define the Effect `Schema` first and derive its TypeScript type. Do not keep a
   parallel handwritten interface for the same data.
3. Annotate public DTOs and errors with stable identifiers and useful OpenAPI
   descriptions. Keep hashes, encrypted values, provider metadata, and opaque
   persistence data out of DTOs.
4. Keep validation proportionate to the boundary. Enforce important wire and
   persistence invariants here; avoid elaborate checks for code-owned values.
5. When adding a mutation, extend the relevant versioned audit-event union if a
   historical record is required. Adding a new payload shape is preferred to
   changing the meaning of an existing version.
6. Export through only the intended root, `dto`, `model`, `evm`, or client-only
   `local` entry point.
