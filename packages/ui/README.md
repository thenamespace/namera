# @namera-ai/ui

Private, source-only React UI shared by Namera applications. Re-exports Namespace
UIKit and adds metadata icons, copy controls, email-code input, transitions, and
Namera theme tokens.

## Usage

Consuming applications compile this package directly. There is no build output.

```tsx
import { Button } from "@namera-ai/ui";
import "@namera-ai/ui/styles.css";

export function SaveButton() {
  return <Button type="submit">Save</Button>;
}
```

Secondary entry points include `/icons`, `/hooks`, `/utils`, `/icon-picker`,
and component subpaths. Check [package exports](package.json).
Tailwind consumers must include this package's source.

## Ownership

Keep reusable presentation here: controls, styling, accessibility, and controlled
inputs. Queries, authorization, domain feedback, and transaction orchestration
stay in applications.

Use semantic tokens and preserve keyboard, focus, validation, and reduced-motion
behavior. Metadata/status components accept domain values rather than fetching them.

- `src/components`: UIKit proxies and shared custom components.
- `src/icons`: typed chain and brand icons.
- `src/styles/globals.css`: UIKit styles and Namera overrides.
- `src/index.ts`: supported root exports.

## Checks

```sh
pnpm --filter @namera-ai/ui typecheck
pnpm --filter @namera-ai/ui lint
```

Check consuming apps when changing shared props or styles.
The dashboard browser lane exercises shared copy controls, icon-picker keyboard
selection and search, metadata fallbacks, and reduced-motion step transitions.
Picker dialogs use the trigger's accessible label; clearing icon search and
closing the dialog remain separate actions.
