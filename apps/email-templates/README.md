# @namera-ai/email-templates

React Email templates for Namera transactional emails. Templates mirror the
typed variables in `@namera-ai/protocol/model` and are designed for publishing
to the matching Resend templates used by `@namera-ai/emails`.

## Structure

- `src/emails/` — one template per email job type.
- `src/components/` — email-safe, reusable presentation primitives.
- `src/helpers/` — deterministic presentation helpers shared by templates.
- `src/provider.tsx` — shared document, font, Tailwind, and color-scheme setup.
- `src/theme.ts` — light and dark email color tokens.
- `src/fonts.tsx` — hosted Inter font declarations with system fallbacks.

## Usage

Start the React Email preview server:

```sh
pnpm --filter @namera-ai/email-templates email:dev
```

The preview is available at `http://localhost:4000`.

## Template guidelines

- Type template props from the corresponding protocol email variables.
- Use React Email components and primitives from `src/components`; do not import
  browser UI controls. The pure SVG `@namera-ai/ui/chain-icon` entry point is
  intentionally supported for shared chain branding.
- Use semantic colors from `src/theme.ts` and provide both light and dark styles.
- Keep transactional copy concise and always include a safe fallback when the
  primary action is a link.
- Add realistic `PreviewProps` without real credentials or personal data.

## Templates

- `magic-link` — one-time sign-in link and fallback code.
- `new-sign-in` — security alert with session details.
- `organization-invitation` — organization invitation with a review action.
- `wallet-created` — smart-account creation notification.
- `session-key-created` — scoped session-key creation notification.
- `api-key-created` — API-key creation and authorization summary.
- `execution-confirmed` — confirmed onchain execution receipt.

Update the placeholder footer destinations in `src/data.ts` before publishing.
