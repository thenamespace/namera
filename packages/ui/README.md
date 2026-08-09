# @namera-ai/ui

Shared React components for Namera applications. This is a private, source-only
package: workspace applications compile its TypeScript and TSX directly, so it
does not have a build output or build script.

## Structure

- `src/index.ts` — package entry point for intentionally shared exports.
- `src/components/*.tsx` — direct proxies for UIKit component subpaths.
- `src/icons.ts`, `src/hooks.ts`, and `src/utils.ts` — UIKit secondary entry points.
- `src/styles/globals.css` — UIKit styles followed by Namera theme overrides.
- `tsconfig.json` — Klarity React library TypeScript configuration.

## Usage

Export broadly reused components from the root entry point:

```ts
import { Button } from "@namera-ai/ui";
```

Components can also be imported directly by source path:

```ts
import { Button } from "@namera-ai/ui/button";
```

Import hooks, icons, utilities, and the Namera stylesheet from their dedicated
entry points:

```ts
import { useTheme } from "@namera-ai/ui/hooks";
import { Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import "@namera-ai/ui/styles.css";
```

Keep application-specific composition in the consuming app. This package owns
reusable presentation components and their local styling only.
