# @namera-ai/utils

Small shared helpers used across Namera. Put a helper here only when it is useful
to multiple packages and does not depend on an Effect service or application
state.

## Structure

- `src/index.ts` — public exports, including `Base64`.
- `src/id.ts` — shared UUIDv7 generation for application and persistence IDs.
- `src/origin.ts` — URL origin parsing and origin-pattern matching.
- `src/random.ts` — cryptographically secure random-string helpers.
- `src/wildcard.ts` — wildcard matching used by origin utilities.

## Usage

```ts
import { Base64, generateUniqueId, getOrigin, matchesOriginPattern } from "@namera-ai/utils";
```

Keep this package dependency-light. Effect services, configuration, business
rules, database logic, and provider adapters belong in their owning packages.

## Adding a helper

- Add a helper only when at least two packages need the same dependency-light
  behavior.
- Keep inputs and outputs explicit and deterministic when possible. A helper
  that requires configuration, resources, retries, logging, or substitution in
  tests should be an Effect service in its owning package instead.
- Use platform cryptography for security-sensitive randomness; do not add
  `Math.random` helpers.
- Export the helper from `src/index.ts` and keep provider-specific or domain
  policy code out of this package.
