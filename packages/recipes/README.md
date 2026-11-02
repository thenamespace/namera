# @namera-ai/recipes

Private, browser-safe session policy templates. The dashboard presents these as
Templates. This package owns metadata, Effect input schemas, declarative fields
and deterministic builders, without React, API clients or custody dependencies.

## Definitions

`recipes` lists definitions and `getRecipe(id)` resolves one. Each definition has
an ID, version, display metadata, input schema, defaults, fields and
`build(input, { now })`. Builders return the `onchain` and `policies` portion of a
session creation request. Amounts use bigint base units and times use Unix seconds.
The dashboard adds the account, signer and editable session metadata.

The USDC allowance template grants a lifetime allowance independently on each
selected network, using native Circle USDC rather than bridged USDC.e. It validates
six-decimal amounts, uint256 limits and a future UTC expiry. It does not grant
signature authority, reset periodically or share a cross-chain budget.

The ENSv2 renewal template allows `renew((string,uint64,bytes32),address)` on
reviewed Ethereum mainnet and Sepolia registrars. Users select USDC, DAI or both.
Each installation permits `approve(address,uint256)` on those tokens: mainnet
USDC/DAI and ENS mock USDC/DAI on Sepolia, excluding Circle test USDC. Native
transfers and signatures are disabled. Approvals are unrestricted by spender or
amount, survive session expiry and do not constitute a spending budget. Names
and renewal durations are chosen at execution, not restricted by the template.

The ENSv2 registration template uses the same networks, payment tokens and expiry
but grants only the registrar's `commit` and `register` functions. The agent owns
availability checks, commitment-secret storage, the commitment wait and reveal.
The template does not restrict the registered name, owner, resolver or duration,
and does not grant renewal. Both registrar templates share reviewed deployments
and payment validation under `src/ens`. Registration version 2 also offers
"Allow resolver deployments", enabled by default. Its info tooltip explains the
unrestricted implementation and initialization data. It grants only
`deployProxy(address,uint256,bytes)` on the selected networks' VerifiableFactory
contracts. Disabling it removes the factory permission. Implementation, salt and
initialization data remain unrestricted; this permits proxies beyond ENS
Permissioned Resolvers. Initializer calls can configure a new resolver, but
later record edits require separate permissions on its address. Renewal does
not grant factory access.

The ENSv2 subname issuer template takes one network, a nonzero permissioned
registry address and a session expiry. It grants only
`register(string,address,address,address,uint256,uint64)` on that registry, with
zero native value and no signatures or token approvals. The dashboard checks
deployment, ERC-165 support and the account's root registrar role before creation.
The registry still enforces current authority at execution. The template does not
grant the account any ENS roles or constrain labels, owners, resolvers,
subregistries, child role bitmaps or name expiries.

The Uniswap v3 swaps template selects networks and a session expiry. It grants
only SwapRouter02's `exactInputSingle` and `exactInput` selectors on reviewed
Ethereum, Base, Arbitrum and Optimism mainnet/Sepolia deployments. It grants no
token approvals, multicall, exact-output swaps, native value or signatures.
The owner must separately approve input tokens to the router. Existing allowances
determine available input tokens; the template does not constrain recipients,
output tokens, routes, amounts or slippage. SwapRouter02's swap tuples have no
deadline field; session expiry bounds this key's authority.

Optional `approval` metadata provides a prerequisite message and per-chain spender
addresses. The dashboard shows these addresses only for selected networks, with
copy controls. This metadata does not add permissions or submit approvals.

## Adding a template

Add a focused directory under `src/recipes`, define its schema and fields, then
register it in `src/index.ts`. Verify the generated authority and invalid inputs.
Increment the version when input or authority semantics change. Generated session
configuration is persisted; recipe versions are not stored as runtime references.

Fields support single or multiple networks, contract addresses, amounts, expiry
and token selection with CDN-relative icons, plus boolean checkboxes. Field
tooltips appear beside labels; descriptions appear below controls.

Display images are CDN-relative slugs, resolved by the dashboard against
`https://cdn.namera.ai/`. Keep image generation and upload outside the package.
Template headers use `templates/<template-id>/header.webp` on the CDN, matching
their local uploadable path under `assets/templates/`.

## Development

```sh
pnpm --filter @namera-ai/recipes test
pnpm --filter @namera-ai/recipes typecheck
pnpm --filter @namera-ai/recipes build
```

See [policies and templates](../../architecture/wallet-system/policies.md).
