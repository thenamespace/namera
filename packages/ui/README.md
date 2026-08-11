# @namera-ai/ui

Shared React components for Namera applications. This is a private, source-only
package: workspace applications compile its TypeScript and TSX directly, so it
does not have a build output or build script.

## Structure

- `src/index.ts` — package entry point for intentionally shared exports.
- `src/components/*.tsx` — direct proxies for UIKit component subpaths.
- `src/components/icon-picker` — controlled metadata icon, emoji, and image picker.
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

The icon picker uses the shared protocol value and can expose any non-empty set
of supported tabs:

```tsx
import { IconPicker } from "@namera-ai/ui/icon-picker";

<IconPicker value={icon} setValue={setIcon} supportedTypes={["icon", "emoji"]} />;
```

Keep application-specific composition in the consuming app. This package owns
reusable presentation components and their local styling only.

## Upstream documentation

`@namera-ai/ui` re-exports Namespace UIKit. Follow its
[component documentation](https://namespace-uikit.vercel.app/llms.txt) and
[complete reference](https://namespace-uikit.vercel.app/llms-full.txt), replacing
`@thenamespace/uikit` imports in examples with `@namera-ai/ui`.

Use semantic design tokens rather than hardcoded colors. Preserve the
accessibility behavior supplied by UIKit and React Aria, including labels,
descriptions, validation messages, focus visibility, keyboard interaction, and
appropriate semantics.
