# @namera-ai/utils

Private dependency-light helpers shared across Namera: UUIDv7 generation,
UTF-8 encoding/decoding and byte lengths, and `Base64` from `js-base64`.

```ts
import { encodeUtf8, generateUniqueId } from "@namera-ai/utils";

const id = generateUniqueId();
const bytes = encodeUtf8("Namera");
```

Keep helpers independent of Effect services, configuration, application state,
and providers. Stateful workflows belong in their owning package.

## Development

```sh
pnpm --filter @namera-ai/utils typecheck
pnpm --filter @namera-ai/utils lint
pnpm --filter @namera-ai/utils build
```

Exports are defined in [src/index.ts](src/index.ts).
