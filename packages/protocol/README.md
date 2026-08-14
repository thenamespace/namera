# @namera-ai/protocol

Shared contracts for the Namera backend and its clients. This package owns
runtime Effect schemas and their inferred TypeScript types; it contains no
database queries, HTTP handlers, provider SDKs, or application logic.

## Structure

- `src/common/` — shared primitives such as normalized email and branded IDs.
- `src/model/` — persistence/domain models and insert/update schemas, including
  discriminated audit-event unions and provider-neutral durable jobs.
- `src/dto/` — public API request and response schemas.
- `src/evm/` — CAIP identifiers and reusable EVM execution primitives.
- `src/errors/` — typed errors used across the project.
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
  storing an untyped object.
- Notification payloads are versioned discriminated unions. Add a concrete
  payload before persisting a new notification type. Preferences use typed
  category/topic pairs and currently allow only the email channel; in-app
  delivery is mandatory. Keep legacy audit payload versions decodable when the
  preference taxonomy changes.
- Billing models are provider-neutral and organization-scoped. Persist the
  code-owned plan key and plan version on subscription history; do not put plan
  state back on the organization model.
- Wallet responses are namespace-discriminated unions. Add each new chain
  namespace as its own response member, then discriminate implementation data
  within that namespace. Never expose wallet-key provider identifiers or
  provider metadata through public wallet DTOs.
- Session keys belong to one wallet and carry an immutable `policies` array.
  Until namespace-specific policy members are defined, the policy schema allows
  only an empty array. Grants are organization-scoped actor-to-session-key
  records and preserve revoked history.
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
6. Export through only the intended root, `dto`, `model`, or `evm` entry point.
