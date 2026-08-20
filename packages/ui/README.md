# @namera-ai/ui

Shared React components for Namera applications. This is a private, source-only
package: workspace applications compile its TypeScript and TSX directly, so it
does not have a build output or build script.

See [Dashboard architecture](../../architecture/frontend/dashboard.md) for
shared-versus-route-local component ownership and
[delivery workspace architecture](../../architecture/packages/delivery.md) for
the UI package boundary.

## Structure

- `src/index.ts` — package entry point for intentionally shared exports.
- `src/components/*.tsx` — direct proxies for UIKit component subpaths.
- `src/components/field.tsx` — shared `Field`, `FieldGroup`, `FieldLabel`, and
  resolver-friendly `FieldError` form composition primitives.
- `src/components/icon-picker/` — controlled metadata icon, emoji, and image picker.
- `src/icons/`, `src/hooks.ts`, and `src/utils.ts` — icons and UIKit secondary entry points.
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

Render a protocol-typed chain icon through the shared icon entry point. The
component forwards normal SVG props and resolves every supported chain to its
committed logo component:

```tsx
import { ChainIcon } from "@namera-ai/ui/icons";

<ChainIcon aria-label="Ethereum" chain="ethereum" namespace="eip155" className="size-5" />;
```

The icon picker uses the shared protocol value and can expose any non-empty set
of supported tabs:

```tsx
import { IconPicker } from "@namera-ai/ui/icon-picker";

<IconPicker
  size="sm"
  value={icon}
  setValue={setIcon}
  supportedTypes={["icon", "emoji"]}
  triggerClassName="rounded-full"
/>;
```

Render the same metadata value without the picker using the shared size variants:

```tsx
import { IconPreview } from "@namera-ai/ui/icon-picker";

<IconPreview className="rounded-full" size="lg" value={icon} />;
```

Keep application-specific composition in the consuming app. This package owns
reusable presentation components and their local styling only.

## Adding shared UI

1. Check Namespace UIKit first. Re-export or proxy an upstream component instead
   of recreating it.
2. Add a custom component here only when it is reused across applications or
   unrelated features. Route composition belongs in the consuming app.
3. Keep a small component in one file. Split it into a folder with an
   `index.tsx` entry only when it has real subcomponents, data, or helpers.
4. Use controlled values for reusable inputs, semantic UIKit tokens, and the
   existing `cn` utility. Preserve React Aria behavior and expose accessible
   names for icon-only controls.
5. Export only supported entry points in `package.json` and `src/index.ts`.
   Because this package is source-only, consuming Tailwind builds must scan its
   source and import `@namera-ai/ui/styles.css` once.
6. Chain icons are selected using protocol namespace and chain-name literals.
   Add new assets as typed TSX components in `src/icons/chain/`, wire them in
   `src/icons/chain.tsx`, and keep provider-specific network names out of UI.
   Do not retain raw SVG files after conversion.

## Upstream documentation

`@namera-ai/ui` re-exports Namespace UIKit. Follow its
[component documentation](https://namespace-uikit.vercel.app/llms.txt) and
[complete reference](https://namespace-uikit.vercel.app/llms-full.txt), replacing
`@thenamespace/uikit` imports in examples with `@namera-ai/ui`.

Use semantic design tokens rather than hardcoded colors. Preserve the
accessibility behavior supplied by UIKit and React Aria, including labels,
descriptions, validation messages, focus visibility, keyboard interaction, and
appropriate semantics.
