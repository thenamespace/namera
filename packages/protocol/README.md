# @namera-ai/protocol

Shared contracts for the Namera backend and its clients. This package owns
runtime Effect schemas and their inferred TypeScript types; it contains no
database queries, HTTP handlers, provider SDKs, or application logic.

## Structure

- `src/common/` — shared primitives such as normalized email and branded IDs.
- `src/model/` — persistence/domain models and insert/update schemas.
- `src/dto/` — public API request and response schemas.
- `src/errors/` — shared typed errors.
- `src/index.ts` — common values and errors.

## Public imports

```ts
import { Email, UserId } from "@namera-ai/protocol";
import { RequestMagicLinkRequest } from "@namera-ai/protocol/dto";
import { User, UserInsert } from "@namera-ai/protocol/model";
```

## Rules

- Decode untrusted input with Effect `Schema`; derive types from schemas.
- Normalize values at the protocol boundary when normalization is a domain rule.
- Brand stable identities and values whose distinction prevents real mistakes.
  Ordinary validated strings do not need brands.
- DTOs describe the public wire contract. Models describe shared domain or
  persistence shapes; do not expose sensitive model fields through DTOs.
- Add errors here when they are shared across package or API boundaries.
- Keep schemas readonly unless mutation is explicitly required.
