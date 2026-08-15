# @namera-ai/email-templates

React Email templates for Namera transactional emails. Templates mirror the
typed variables in `@namera-ai/protocol/model` and are designed for publishing
to the matching Resend templates used by `@namera-ai/emails`.

## Structure

- `src/emails/` — one template per email job type.
- `src/components/` — email-safe, reusable presentation primitives.
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
  the browser UI package.
- Use semantic colors from `src/theme.ts` and provide both light and dark styles.
- Keep transactional copy concise and always include a safe fallback when the
  primary action is a link.
- Add realistic `PreviewProps` without real credentials or personal data.
