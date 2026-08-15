# @namera-ai/sdk

Publishable TypeScript SDK scaffold for Namera's public API. No supported client
API is implemented yet; the current source export is only a placeholder and
must not be treated as a stable contract.

## Intended responsibility

- Provide a typed client for API-key-authenticated execution, submission status,
  execution reads, and policy-gated signatures.
- Decode public protocol responses and typed API errors.
- Provide small client-side conveniences such as confirmed-execution polling.
- Keep business rules, policy evaluation, credential persistence, and provider
  clients on the server.

## Structure

- `src/index.ts` — future public entry point.
- `package.json` — package metadata, scripts, source condition, and publish exports.
- `tsconfig.json` — Node package TypeScript configuration.
- `tsdown.config.ts` — unbundled ESM build and declaration output.

## Development

Expose only intentional public APIs from `src/index.ts`. Use `protocol`
contracts instead of duplicating request or response types. Preserve the
`namera-source` condition for monorepo development and verify publish output
with `pnpm --filter @namera-ai/sdk build` before making the package public.
