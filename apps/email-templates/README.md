# @namera-ai/email-templates

Preview harness for the code-owned React Email templates in `@namera-ai/emails`.
Production delivery imports and renders those same components directly; no
Resend hosted-template publishing step exists.

## Structure

- `src/emails/` — thin preview entries that re-export templates from `@namera-ai/emails`.
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

- Implement templates, components, helpers, and themes in `packages/emails/src/templates`.
- Type template props from the corresponding protocol email variables.
- Use React Email components and primitives from the package template folder;
  do not embed SVG because major email clients do not support it consistently.
  Generate PNGs from the canonical UI icons and upload `assets/email-assets/`
  without changing its paths.
- Use the package-owned semantic theme and provide both light and dark styles.
- Keep transactional copy concise and always include a safe fallback when the
  primary action is a link.
- Keep job variables semantic. Presentation-only date formatting, pluralization,
  labels, asset lookup, and truncation belong in the React component.
- Add realistic `PreviewProps` without real credentials or personal data.

## Templates

- `magic-link` — one-time sign-in link and fallback code.
- `new-sign-in` — security alert with session details.
- `organization-invitation` — organization invitation with a review action.
- `wallet-created` — smart-account creation notification.
- `session-key-created` — scoped session-key creation notification.
- `session-key-revoked` — session-key and grant revocation summary.
- `api-key-created` — API-key creation and authorization summary.
- `api-key-revoked` — API-key and session-key grant revocation summary.
- `execution-confirmed` — confirmed onchain execution receipt.

Update CDN and footer destinations in `packages/emails/src/templates/data.ts`.
