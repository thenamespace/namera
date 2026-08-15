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
- `script/generate-assets.tsx` — renders email-safe PNGs from canonical SVG
  sources into the gitignored root `assets/email-assets/` directory.

## Usage

Start the React Email preview server:

```sh
pnpm --filter @namera-ai/email-templates email:dev
```

The preview is available at `http://localhost:4000`.

Generate the PNG assets before uploading them to the configured CDN:

```sh
pnpm --filter @namera-ai/email-templates email:assets
```

## Template guidelines

- Type template props from the corresponding protocol email variables.
- Use React Email components and primitives from `src/components`; do not embed
  SVG because major email clients do not support it consistently. Generate PNGs
  from the canonical UI icons, upload `assets/email-assets/` without changing
  its paths, then update `emailAssetCdnBaseUrl` in `src/data.ts`.
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

Update the placeholder CDN base URL and footer destinations in `src/data.ts`
before publishing.
