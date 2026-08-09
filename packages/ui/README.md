# @namera-ai/ui

Shared React components for Namera applications. This is a private, source-only
package: workspace applications compile its TypeScript and TSX directly, so it
does not have a build output or build script.

## Structure

- `src/index.ts` — package entry point for intentionally shared exports.
- `src/**/*.tsx` — components available through direct package subpath imports.
- `tsconfig.json` — Klarity React library TypeScript configuration.

## Usage

Export broadly reused components from the root entry point:

```ts
import { Button } from "@namera-ai/ui";
```

Components can also be imported directly by source path:

```ts
import { Button } from "@namera-ai/ui/components/button";
```

Keep application-specific composition in the consuming app. This package owns
reusable presentation components and their local styling only.
