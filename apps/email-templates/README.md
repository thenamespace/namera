# @namera-ai/email-templates

Preview and asset-generation app for React Email templates in
`@namera-ai/emails`. Production delivery renders those same package components.

## Preview

```sh
pnpm --filter @namera-ai/email-templates dev
```

Runs on port 4000. Entries in `src/emails` expose package templates with preview
props. Implement templates in `packages/emails/src/templates`, not in this app.

## Email assets

```sh
pnpm --filter @namera-ai/email-templates email:assets
```

Converts canonical artwork to email-safe PNGs in the ignored root
`assets/email-assets` directory. Upload those files to the paths expected by
the package's template asset configuration. The command neither publishes
assets nor sends email.

Use React Email components and package theme primitives. Avoid embedded SVG in
messages, keep preview data non-sensitive, and review light/dark rendering.

## Checks

```sh
pnpm --filter @namera-ai/email-templates typecheck
pnpm --filter @namera-ai/email-templates build
```

Delivery and retry behavior are tested at the server boundary. See
[notifications and email](../../architecture/services/notifications.md).
