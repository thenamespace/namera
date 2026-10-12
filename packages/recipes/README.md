# @namera-ai/recipes

Private, browser-safe session policy recipes. This package owns code-defined
display metadata, tags, Effect input schemas, declarative form fields and pure
builders. It depends on protocol, not React, the catalog, custody or API clients.

`recipes` lists available definitions; `getRecipe(id)` looks one up. Each recipe
has a stable `id`, a definition `version`, `display`, `inputSchema`, `defaults`,
`fields` and `build(input, { now })`. Times are Unix seconds. Builders return the
decoded `onchain` and `policies` portion of the current creation request; amounts
are bigint base units. `metadata` supplies optional session-key name, description
and logo defaults, separately from the recipe's `display` identity. The dashboard
lets the user edit those defaults and supplies account and public signer,
and the normal creation schema encodes the final request.

## USDC lifetime allowance

Inputs are networks, a decimal-string allowance, and `expiresAt`, a UTC ISO timestamp
in the future. The dashboard date picker selects local midnight at the start of
the chosen date. Each network receives the full allowance independently.
There is no periodic reset or shared cross-chain budget. Only Circle-issued native
USDC is selected; bridged USDC.e is excluded. Mainnet and testnet deployments are
code-owned and sourced in `deployments.ts`. No catalog lookup is required.

The builder validates inputs, preserves exact six-decimal amounts and rejects
uint256 overflow. It creates only ERC-20 spending authority, with signatures off.
Owner installation approval remains mandatory. Recipe versions are not persisted;
the generated immutable session configuration is the authoritative record.

## Adding a recipe

Add a focused folder under `src/recipes`, define its schema and typed field list,
test the generated authority and unsafe inputs, then register it in `src/index.ts`.
Increment a recipe version when changing inputs or generated authority. Add field
kinds only when needed by a recipe; the dashboard owns their accessible rendering.
`display.banner` optionally supplies a replaceable card cover image.

```sh
pnpm --filter @namera-ai/recipes test
pnpm --filter @namera-ai/recipes typecheck
pnpm --filter @namera-ai/recipes typecheck:test
pnpm --filter @namera-ai/recipes build
```
