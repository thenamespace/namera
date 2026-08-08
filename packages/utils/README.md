# @namera-ai/utils

Small shared helpers used across Namera. Put a helper here only when it is useful
to multiple packages and does not depend on an Effect service or application
state.

## Structure

- `src/index.ts` — public exports, including `Base64`.
- `src/origin.ts` — URL origin parsing and origin-pattern matching.
- `src/random.ts` — cryptographically secure random-string helpers.
- `src/wildcard.ts` — wildcard matching used by origin utilities.

## Usage

```ts
import { Base64, getOrigin, matchesOriginPattern } from "@namera-ai/utils";
```

Keep this package dependency-light. Effect services, configuration, business
rules, database logic, and provider adapters belong in their owning packages.
