# Namera developer GTM research (namera-core)

Research date: 2026-09-15  
Subject: `thenamespace/namera-core` (this repository), not the public `thenamespace/namera` / `@namera-ai/sdk` stack currently advertised on namera.ai.  
Audience: Namespace developer marketing / DevRel.  
Constraint: positioning must be stand-behind-able from this repo. ZeroDev Kernel is an account implementation detail, not the product foundation.

---

## Product truth (from namera-core)

### What this product actually is

Namera is a **multi-tenant programmable-wallet backend**. A human manages an organization in a browser. The organization creates **ERC-4337 smart accounts** whose **owner keys never leave a wallet-key provider**. Humans then create **immutable session keys** (policy envelopes, not secret keys) and **grant** those envelopes to machine actors: API keys, MCP OAuth clients, or the Namera CLI. Every execution or signature is allowed only when one active grant points at one active session key whose **complete** policy set accepts the operation.

That last sentence is the architecture, not a slogan. Namera never combines rules from multiple session keys to synthesize extra authority.

### One-liner a DevRel can stand behind

**Namera is a hosted org wallet for agents: you define immutable policies, grant them to MCP/CLI/API clients, and Namera simulates, enforces, and signs — without handing the agent a key.**

### Stack (accurate)

| Layer | Reality in this repo |
| --- | --- |
| Runtime | pnpm/Turborepo TypeScript monorepo, Node.js 24, Effect v4 |
| Transport | Effect `HttpApi` in `packages/api`; handlers in `apps/server`; Scalar at `/reference` |
| Clients | `@namera-ai/sdk` Promise client; `@namera-ai/cli` OAuth device flow; hosted MCP at `/mcp` |
| Human product | Vite/React dashboard (`apps/dashboard`) — accounts, session keys, API keys, MCP/CLI consent, billing usage |
| Persistence | PostgreSQL + Drizzle; audit, notifications, email outbox, billing ledger |
| Custody | `packages/wallet-keys`: local PKCS#8 files (dev) or Google Cloud KMS (software/HSM). Application never imports provider SDKs |
| Chain adapter | `packages/evm`: Viem + permissionless.js accounts, Alchemy HTTP, Alchemy Rundler (ERC-4337 EntryPoint 0.7), Alchemy Gas Manager (EIP-7677) |
| Account implementations | Kernel **0.3.3** and Safe **1.4.1**, both EntryPoint **0.7**, one owner. Validators: `webauthn_p256` or `ecdsa_secp256k1` |
| Chains (runtime) | Ethereum, Base, Arbitrum, Optimism — each with matching testnet. Eight CAIP-2 IDs total |
| Namespace | Only `eip155`. Other families are an adapter extension point, not implemented |

### ZeroDev / Kernel: what is true vs what to say

- Kernel is **one of two smart-account implementations**, alongside Safe. Creation/reconstruction uses `permissionless/accounts` (`toKernelSmartAccount`, `toSafeSmartAccount`).
- `@zerodev/sdk` is listed in `packages/evm/package.json` (catalog version 5.5.10) but **is not imported by EVM source**. Account construction does not go through ZeroDev’s product SDK or permission plugins.
- Bundling, paymaster, and RPC are **Alchemy**, not ZeroDev.
- Session-key “permissions” are **not** Kernel onchain permission validators. Session keys here are **offchain, immutable policy rows** evaluated in `packages/evm` with Postgres state reservations. The **wallet owner key** remains the only signer.
- Public namera.ai, npm `@namera-ai/sdk`, and `thenamespace/namera` still describe a **local ZeroDev session-key toolkit** (onchain policies, agent holds a session signer, `namera mcp start`). **That is a different product.** Do not mix claims.

**Say:** “ERC-4337 smart accounts (Kernel or Safe) with provider-managed owner keys.”  
**Do not say:** “Built on ZeroDev,” “ZeroDev Kernel packaging,” “onchain session keys,” or “the agent signs with a session key.”

### Session keys, grants, and actors (the unique model)

Four principals: `user`, `api-key`, `mcp`, `cli`.

1. Humans authenticate with magic-link sessions and org roles.
2. A **session key** is an immutable policy bundle on one wallet. It is **not** a secret. Policy hash is canonical JSON (order-invariant, IDs excluded).
3. Machine actors receive **grants** to specific session keys. No credential alone grants wallet authority.
4. For one operation, Namera evaluates complete granted keys independently, in deterministic order, and selects the first fully eligible key.
5. Revoking a session key revokes all its grants in the same transaction.

API keys: 1–365 day duration, grants chosen at creation, raw secret shown once, hashed at rest. Grant editing is unsupported (replace then revoke).

MCP: OAuth 2.1 authorization code + PKCE S256, resource-bound tokens, Streamable HTTP at `/mcp`. Dashboard consent lets the user pick session keys. Scopes `mcp:read` / `mcp:execute` are **capability classes**; grants + policies still bound the wallet.

CLI: RFC 8628 device authorization, OS keyring for tokens, `NAMERA_API_KEY` for headless automation.

### Policy catalog that actually exists

| Policy | Applies to | Notes |
| --- | --- | --- |
| `evm.time-window` | execution + signature | Inclusive start, exclusive expiry |
| `evm.chain-allowlist` | execution + signature | Restricts; does not grant signature access |
| `evm.gas-budget` | execution | Stateful; pessimistic UserOp envelope; periods hour/day/week/lifetime |
| `evm.native-spend-limit` | execution | Sum of `call.value`; operation or rolling/lifetime windows per chain |
| `evm.signature` | signature only | Explicit grant of `message` and/or `typed-data` |

Every applicable policy must allow. Denials return a **stable code + policy instance ID**. Simulation reports the first denial per candidate without mutating state.

**Not shipped:** contract/selector allowlists, token spend limits, EIP-712 domain/verifying-contract restrictions, rate-limit policies, sudo policies. Architecture explicitly defers contract/selector/token policies until simulation-context semantics are fixed across chains.

### Execution and signing pipeline

Execute: reconstruct account → prepare UserOp (Alchemy) → simulate calls → evaluate policies → **transactionally reserve** billing + policy state → integrity-check and **owner-sign** the exact prepared UserOp → submit bundler → bounded receipt wait → settle or release. Uncertain submissions are not released. A leased worker reconciles prepared/submitted rows.

Simulate (`POST /executions/simulate`): same unsigned simulation + policy preview; no persistence, no billing, no signature.

Sponsorship defaults **on** (Alchemy paymaster). `sponsor: false` is self-funded. Both consume an execution meter; only sponsored **mainnet** consumes the gas-sponsorship meter.

Signatures: message or EIP-712 typed data only (no public raw digest). Verification is ERC-1271 (deployed) / ERC-6492 (counterfactual), unmetered, `valid: false` rather than a defect.

SDK/CLI/MCP generate internal UUIDv7 idempotency keys; users never manage them. Retries only for network / 408 / 5xx.

### MCP tool surface (hosted, compact)

`list_wallets`, `get_wallet`, `list_session_keys`, `get_session_key`, `simulate_transaction`, `execute_transaction`, `get_transaction_status`, `get_executions`, `sign`, `verify_signature`.

Tools do **not** accept organization, actor, session-key selector, or idempotency key. Those come from the bearer grant. Namera auto-selects an eligible session key. There are no high-level “transfer token / swap” tools.

### SDK surface

`wallets.list/get`, `sessionKeys.list/get`, `executions.simulate/execute/getStatus/list`, root `sign`, `verifySignature`. Returns `NameraResult` discriminated unions with tagged API errors. Package version in-repo: `0.1.0`. Release/provenance automation is **pending**.

### Billing (Free v1, implemented)

Code-owned plan `free@1`. Hard caps: 5 members, 5 software wallets, 0 HSM wallets, 100 mainnet executions, 1,000 testnet executions, 10,000 signatures, **$3.00** sponsored gas. Stripe/paid plans are schema-ready and **dormant**. No billing dashboard UI.

### Maturity signals

**Strong (engineering, not GTM-ready GA):**

- Architecture knowledge base is unusually complete (`architecture/` is the source of truth).
- Boundary tests: protocol, database, wallet-keys, evm policies/execution, SDK, CLI OAuth I/O, and a large `apps/server/tests` suite (auth, OAuth, MCP, wallets, session keys, executions, signatures, billing, RPC proxy, telemetry). ~36 `*.test.ts` files; PGlite + real application layers; provider test Layers instead of mocking workflows.
- Workers for email, execution reconciliation, billing rollover/recovery.
- Audit events + in-app notifications + durable encrypted email outbox.
- Telemetry: OTLP; browser exports only through server `/t/*` proxy.

**Weak / not yet public product:**

- Production doc: **controlled single-replica staging and private-beta**. Public multi-replica production is gated (in-memory rate limiter, live KMS/Alchemy chain smoke, backups, alerts, immutable image, etc.).
- No examples/quickstarts/apps in this repo (only `.env.example`).
- No npm/versioning/release automation for protocol/API/SDK/CLI of **this** stack.
- Dashboard browser/a11y tests pending; packaged CLI keyring tests on macOS/Windows/Linux pending; live provider tests opt-in and not the default CI story.
- Capability suite for all eight launch chains × both implementations is still a production pending item.
- Public marketing (namera.ai, npm, Kris Kocic blog) describes the **legacy** local ZeroDev product. Shipping this stack without a docs cutover will immediately contradict DevRel copy.

### Capability list a DevRel can stand behind

- Organization-owned ERC-4337 wallets on ETH / Base / Arbitrum / Optimism (and matching testnets).
- Owner keys in GCP KMS or local files; agents never receive owner or session private keys.
- Immutable policy envelopes (time, chain, native spend, gas budget, signature type).
- Explicit grants from those envelopes to API keys, MCP clients, and CLI installs.
- Simulate-before-execute with per-candidate policy denial codes.
- Hosted MCP (OAuth + consent UI) and device-flow CLI sharing the same grant model.
- Typed TypeScript SDK with tagged errors and internal idempotency.
- Default Alchemy gas sponsorship with an explicit self-fund path.
- Dashboard for humans: create accounts/keys, approve MCP/CLI, revoke, inspect activity.
- Usage metering on a free plan (executions, signatures, sponsored gas).

### Explicit “do not claim” list

Do **not** claim until the matching boundary exists and is tested:

1. **ZeroDev / Kernel as the product** — Kernel is optional account bytecode; enforcement is Namera’s policy engine + owner signer.
2. **Onchain policy enforcement / onchain session keys** — policies are evaluated offchain with DB reservations; the account is a standard Kernel/Safe owner account.
3. **Contract, selector, token, or protocol allowlists** — not in the catalog.
4. **“The agent signs” / “session key is a key”** — the agent presents a grant; Namera’s owner key signs.
5. **Local MCP server / `namera mcp start`** — this stack’s MCP is a **hosted** `/mcp` resource.
6. **High-level agent tools** (swap, bridge, native_transfer, get_balance, read_contract) — not in the MCP/SDK surface.
7. **Multichain in one request / parallel lanes** — one execution is one chain, one call batch.
8. **Solana / Bitcoin / non-EVM** — `eip155` only.
9. **Public production, SLA, multi-region** — private beta / single replica.
10. **Paid plans, Stripe, overage** — Free v1 only.
11. **HSM wallets in the free product** — included HSM count is 0.
12. **Published npm packages for namera-core** — in-repo `0.1.0`; release automation pending. Treat current npm `@namera-ai/sdk` as **legacy**.
13. **Broad typed-data signing in production** — architecture pending EIP-712 domain restrictions.
14. **Audit history UI, notification inbox, wallet freeze/archive, custom roles, org deletion, IdPs.**
15. **Self-serve public docs that match this architecture** — current namera.ai/llms.txt is legacy copy.
16. **Both Kernel and Safe certified on every advertised chain** — capability suite still pending.
17. **“No backend to run” for Namespace itself** — this **is** the backend; customers of a hosted Namera would not run it, but that hosted GA is not documented as live.

---

## TLDR

Namera-core is **not** another Kernel session-key SDK. It is an **org-controlled signing and policy control plane** for agents: hosted API + dashboard + OAuth MCP + device CLI, with simulate-then-sign, quota reservations, and KMS custody.

The GTM problem is not “explain ERC-4337.” It is **win the Cursor/Claude “agent needs a wallet” slot** against Alchemy CLI, Phantom MCP, Openfort, and Coinbase AgentKit — with a story only this repo can tell: **humans define envelopes; agents get grants, not keys.**

Lead with **hosted MCP for developer agents** (one use case). Do not lead with Kernel, ZeroDev, or “onchain policies.” Do not reuse namera.ai copy until docs are rewritten against this architecture.

Biggest near-term competitive threats: **Alchemy Agent Wallets (CLI)** and **Openfort (CLI-as-MCP + policies)**. Biggest credibility risk: **legacy public Namera still saying ZeroDev.**

This week: freeze new-stack messaging, cut a private-beta MCP walkthrough that never mentions ZeroDev, and stop mixing npm/legacy claims into namera-core GTM.

---

## Positioning

### One-liner

**Give coding agents a wallet they cannot steal: org-owned accounts, immutable policies, MCP/CLI/API grants — Namera simulates and signs.**

### Category

**Programmable agent-wallet control plane** (hosted). Adjacent labels that are true but incomplete: ERC-4337 AA, embedded/server wallets, MCP wallet.

Not: consumer wallet, Kernel packaging, session-key SDK, AgentKit clone, paymaster company.

### Three pillars (grounded)

1. **Grants, not keys.** Session keys are policy documents. The owner signer stays in KMS. Revoke the grant or the envelope; the agent never held signing material.
2. **Simulate, then enforce the whole envelope.** Every execution is one batch, one session key, after call simulation. Denials are typed (`TIME_WINDOW_EXPIRED`, `GAS_BUDGET_EXCEEDED`, …) so agents can correct instead of retrying blindly.
3. **The same authority on MCP, CLI, and API.** OAuth consent and API-key grants attach to the same session keys. Dashboard is the human control surface; machines share one policy brain.

### Competitive edge (only if you keep the claims tight)

| Edge | Why it is real in this repo | How rivals usually differ |
| --- | --- | --- |
| Session key ≠ signer | Owner always signs; policies + grants are the ACL | ZeroDev/Rhinestone/legacy Namera: session *keys* sign under onchain modules |
| Org + consent UX | MCP PKCE, CLI device flow, API keys, members, revoke | Phantom: consumer dedicated wallet; AgentKit: env secrets; wallet-agent: import key |
| Policy preview without spend | `simulate` returns first denial per candidate | Many CLIs execute or only simulate chain effects, not your ACL |
| Reservation accounting | Gas + native spend + billing reserved in one DB transaction | Offchain policy APIs often check-then-act without pessimistic holds |
| Compact MCP, strict schemas | Object-root tools, domain error codes, no org/id leakage | Openfort exposes the whole CLI as tools behind a secret key |

### Messaging hierarchy

1. Problem: agents in Cursor/Claude need to transact; pasting keys is malpractice.
2. Mechanism: you create an org wallet, attach policies, approve the agent in the browser.
3. Proof: simulate shows what would be denied; execute is sponsored by default on testnets/mainnet within Free caps.
4. Footnote for technical buyers: ERC-4337 Kernel or Safe; Alchemy bundler/paymaster; GCP KMS.

Avoid leading with the footnote.

### Positioning vs Namespace (company)

Namespace (namespace.ninja) is ENS subnames/identity. Namera is wallets/permissions/execution. **Do not merge them in the headline.** Partnership story (P1/P2): agent wallets + `agent.brand.eth` identity, not “Namera is ENS.”

---

## Competitive landscape

Threat = distribution overlap × narrative overlap × maturity, **given namera-core’s architecture** (not given legacy Namera).

### Direct (agent can transact from Cursor/Claude/CLI)

#### Alchemy Agent Wallets / Alchemy CLI — threat **high**

- **What they are:** Dashboard-created wallets; CLI `wallet connect --mode session` mints a device P-256 key; dashboard attaches it as a scoped, expiring session signer. Agent uses Alchemy CLI (`--json --no-interactive`, `agent-prompt` manifest). Keys: Alchemy says the wallet private key never touches the CLI; session signer is local. Custody of the wallet is described as **Privy**. EVM via smart-wallet prepare/send; swaps/bridges on EVM mainnet. Live, no waitlist.
- **Overlap:** Exact job-to-be-done: stop pasting keys into Cursor; dashboard approval; revoke; sponsored gas; agent-native CLI.
- **How namera-core differs:** Namera’s machine actors **do not become signers**. Alchemy’s model is “attach this CLI’s pubkey to the wallet.” Namera’s model is “grant a policy envelope; Namera’s KMS owner signs.” Namera has org session-key catalogs, simulate+policy preview, MCP as first-class OAuth resource, typed SDK. Alchemy has broader CLI (swap/bridge/data), Solana, live GA, and the distribution of Alchemy’s developer base.
- **Implication:** Do not pick a fight as “better AA.” Pick **org policy envelopes + hosted MCP + no extra device signer.** Co-market as a layer **on** Alchemy infra (you already depend on Rundler/Gas Manager) rather than as a replacement CLI.

#### Phantom MCP — threat **high** (consumer) / **medium** (org/dev teams)

- **What they are:** `@phantom/mcp-server` in Claude/Cursor. Device-code login. Agent gets a **new dedicated wallet**, not the user’s Phantom. Fund it separately. High-level tools: balances, transfers, swaps, perps, simulate-then-confirm. Solana + EVM (+ BTC; Sui sunsetting). KMS + OIDC stamper.
- **Overlap:** One-command MCP wallet for agents; simulation-first sends.
- **How namera-core differs:** Namera is **org programmable wallets with human-defined envelopes**, not “here is a fresh hot wallet for the agent.” Phantom wins consumer UX and Solana. Namera wins (if it ships) team control, revoke-by-policy, API+CLI parity, no “fund a random agent address and hope.”
- **Implication:** Different ICP. Do not compete on swap tools. Compete on **shared org treasury with grants.**

#### Openfort — threat **high**

- **What they are:** Embedded + backend wallets, session keys, paymasters, `openfort mcp add` exposing **every CLI command as a tool** (`accounts_evm_create`, `policies_evaluate`, `transactions_create`, `sessions_create`) behind `OPENFORT_API_KEY`. Docs pitch policy-bounded agent wallets and `policies_evaluate` preflight. Founder quote on namespace.ninja — existing relationship.
- **Overlap:** MCP + policies + gasless EVM + session keys + agent workflows.
- **How namera-core differs:** Openfort MCP is **secret-key superuser over the Openfort account** (create wallets, policies, users). Namera MCP cannot create wallets or policies; it can only operate **inside consented grants**. That is a sharper security story for “drop this into Cursor.” Openfort is live with docs/skills; Namera-core is private-beta shaped.
- **Implication:** Steal the **least-privilege MCP** narrative. Do not claim more policy types than you have (they have contract whitelist session keys in product docs).

#### Coinbase AgentKit / CDP wallets — threat **high-medium**

- **What they are:** Framework (LangChain, Vercel AI SDK, MCP extension) + CDP server wallets / smart wallets, 50+ actions (transfer, swap, deploy). MCP is a **template you host** with CDP secrets in env. Brand, Base, x402 facilitator.
- **Overlap:** “Onchain agents” default Google result; MCP; gasless Base.
- **How namera-core differs:** AgentKit is an **action framework** with a wallet provider. Namera is a **permissioned wallet service**. AgentKit’s MCP typically holds CDP secrets; Namera’s MCP holds an OAuth grant the user approved in a dashboard.
- **Implication:** Complement, don’t clone actions. Position as the **wallet/policy backend** an AgentKit-style agent should call instead of env-key CDP for anything that isn’t a toy.

#### wallet-agent (wallet-agent.ai) — threat **low-medium**

- **What they are:** Open-source EVM MCP for Cursor/Claude; mock wallets; **private-key import** for real wallets; transfers, ABI/wagmi helpers.
- **Overlap:** MCP install command for coding agents.
- **How namera-core differs:** Importing a private key is the anti-pattern Namera exists to kill. Easy contrast in DevRel, but they occupy the “five-minute MCP” slot you do not yet occupy.
- **Implication:** Publish a safer five-minute path or they remain the default `claude mcp add`.

### Adjacent wallet / AA / policy infra

#### ZeroDev (Kernel + permissions SDK) — threat **medium** (adjacent, not foundation)

- **What they are:** Smart-account vendor. Kernel permissions = **signer + onchain policies + actions**. Session keys are real keys the agent holds. Docs cover transaction automation: agent creates key, owner approves address.
- **Overlap:** Vocabulary (session keys, gas/time/call policies). Account bytecode Namera can deploy (Kernel 0.3.3).
- **How namera-core differs:** Namera did **not** productize `@zerodev/permissions`. Enforcement and actor model live in Namera. ZeroDev is a toolkit for **app developers embedding Kernel**; Namera is a **hosted control plane**.
- **Implication:** Competitor/adjacent for teams who want to DIY. **Not a P0 co-marketing foundation.** Mention Kernel the way you mention Safe: implementation choice.

#### Rhinestone Smart Sessions — threat **medium**

- **What they are:** ERC-7579 modules; onchain session keys scoped by protocol/token/amount/selector; Warp cross-chain intents. Explicit “user-owned wallet + session key” thesis.
- **Overlap:** Agent delegation narrative.
- **How namera-core differs:** Rhinestone enforces **onchain**; Namera enforces **offchain then owner-signs**. Rhinestone is modular account OS; Namera is org SaaS. Namera currently **cannot** do selector/token allowlists they use as hero examples.
- **Implication:** Honest split: Namera = fastest org + MCP path; Rhinestone = trust-minimized onchain permissions. Do not claim equivalent scoping until those policies exist.

#### Safe — threat **low** (infra) / **medium** if Safe{Wallet} ships agent MCP

- Namera already constructs Safe 1.4.1 accounts. Safe is a **trusted account brand**, not an agent-MCP product today. Use as implementation credibility (“Safe or Kernel”), not as the enemy.

#### Privy (Stripe) — threat **medium**

- Embedded + server wallets, TEE/SSS, **offchain** policies (limits, protocols, recipients, windows). Alchemy CLI uses Privy under the hood. Stripe acquisition (2025) + machine payments gravity.
- **Diff:** Privy is a **signer/wallet primitive** for apps. Namera is the **agent grant + simulate + execute** product. Could even be a future `WalletKeys` provider; today Namera is KMS/local.
- **Implication:** Partner-or-ignore. Do not out-feature Privy’s chain coverage.

#### Turnkey — threat **medium**

- Org policies, sub-orgs, allowlists, KMS-like TEEs, SOC2, construction/sign/broadcast. Developer wallets for companies, not MCP-first.
- **Diff:** Turnkey = **policy at the signer**. Namera = **policy at the session-key grant + ERC-4337 execution**. Overlap for “backend automation wallets.”
- **Implication:** Lose if the buyer wants raw signing infra. Win if they want agents + 4337 + dashboard grants.

#### Crossmint — threat **medium**

- Agent wallets: TEE signer + **onchain** caps/allowlists; x402; cards. Full-stack commerce.
- **Diff:** Commerce + cards vs developer MCP control plane. Stronger if Namera’s ICP becomes “agent that pays.” Weaker for Cursor-native builders who want least privilege, not a Visa stack.

#### Dynamic (Fireblocks) — threat **low-medium**

- Server wallets vs agent wallets vs delegated access; JWT-shaped agent auth; onboarding UX.
- **Diff:** Embedded-wallet suite for hybrid human+agent apps. Namera’s dashboard is operator UX, not consumer wallet modal.

#### x402 / Stripe machine payments / MPP — threat **adjacent (low as wallet, high as narrative)**

- HTTP 402, USDC on Base, CDP facilitator, Stripe PaymentIntents. Agents as **payers of APIs**, not owners of org treasuries.
- **Diff:** Payment protocol vs wallet control plane. Namera could **become** an x402 signer later; today it has no x402, no token allowlist, no pay-to-address policy.
- **Implication:** P2 partnership after native/token policies exist. Do not put x402 on the homepage.

### Snapshot table

| Player | Overlap | Namera-core difference | Threat |
| --- | --- | --- | --- |
| Alchemy CLI agent wallets | Cursor/CLI, dashboard session, gas | Device session **signer** vs Namera owner-sign + policy grants + hosted MCP | High |
| Phantom MCP | MCP wallet in agents | Consumer dedicated wallet vs org envelopes | High / med |
| Openfort | MCP + policies + AA | Secret-key CLI-MCP vs grant-scoped MCP | High |
| Coinbase AgentKit/CDP | Onchain agents default | Action SDK + env secrets vs permissioned service | High-med |
| ZeroDev | Session-key vocab, Kernel | Onchain permission keys vs offchain envelopes | Med |
| Rhinestone | Agent sessions | Onchain 7579 vs hosted control plane | Med |
| Privy | Offchain policy wallets | Primitive vs product; Stripe gravity | Med |
| Turnkey | Org signing policy | Signer infra vs 4337 agent grants | Med |
| Crossmint | Agent wallets + x402 | Commerce rails vs DevRel MCP | Med |
| Dynamic | Agent wallet patterns | Embedded UX vs org backend | Low-med |
| wallet-agent MCP | Cursor MCP | Private key import vs no agent keys | Low-med |
| Safe | Account type | Brand/infra, not agent MCP | Low |
| x402/Stripe | Agent payments | Protocol, not wallet ACL | Adjacent |

---

## Lead use cases

### Lead (pick one): Cursor/Claude coding agent with a hosted Namera MCP grant

**Why this one:** Developer distribution is the goal. The unique mechanism (OAuth consent → session-key grants → simulate/execute tools, no key material) is visible in five minutes **if** a hosted environment exists. Alchemy and Phantom are already teaching this job. Namera’s wedge is **least privilege for a team wallet**, not a new hot wallet and not a device-bound session signer.

**Happy path to document (and only this path in week-one DevRel):**

1. Human creates org + account in dashboard (testnet).
2. Human creates a session key: time window + chain allowlist + native spend = 0 (or tiny) + optional gas budget. No signature policy if the agent should not sign messages.
3. Agent’s MCP client hits Namera `/mcp`; human consents and selects that session key.
4. Agent `simulate_transaction` then `execute_transaction` (sponsor default true).
5. Human revokes MCP authorization or session key; agent stops.

**Success metric:** private-beta developers complete a testnet UserOp from Cursor without ever seeing a private key.

**Do not** demo sudo, mainnet, typed-data, or “call Uniswap” until selector policies exist.

### Secondary 1: Headless backend agent via API key

Same envelopes, `x-api-key`, SDK `executions.simulate/execute`. ICP: product engineers wiring a single worker (keepers, agents in CI, support bots). Differentiator vs Turnkey/Privy: 4337 + simulation + grant-scoped keys that cannot see the rest of the org.

### Secondary 2: Terminal agent via Namera CLI device flow

`namera login` → approve session keys in browser → `namera execution simulate/execute`. Competes with Alchemy CLI on the same surface; win on **policy catalogs and no extra local signer**. Lose on swap/bridge/data commands until you deliberately stay narrow.

### Explicitly not lead (yet)

- Consumer “chat to your Phantom.”
- Agent commerce / x402.
- Cross-chain intents.
- End-user embedded wallets in a dapp (no consumer wallet SDK in this repo).

---

## Partnerships

Do **not** put ZeroDev as P0 co-marketing foundation.

### P0 (this quarter, distribution or already in the runtime)

1. **Alchemy** — You already require Alchemy RPC, Rundler, Gas Manager, and ETH/USD quotes. Joint story: “Agent wallets with org policy, running on Alchemy AA.” Ask for CLI/Agents blog cross-link **as a distinct model** (grant + server sign), not as a Kernel case study. Risk: they compete with Agent Wallets CLI; keep the relationship infra + co-sell to teams that need org ACL.
2. **MCP clients / IDEs** — Cursor, Claude Desktop/Code, and the MCP directory/registry. Ship a Cursor MCP config snippet against the **hosted** resource URL (not npx stdio). This is the distribution channel.
3. **Private-beta design partners** — 5–10 teams already running agents in Cursor who today paste keys or use wallet-agent. Product learning > logo hunting.

### P1

1. **Safe** — Account-implementation credibility (“Safe 1.4.1 or Kernel 0.3.3”). Docs + dashboard copy. Optional Safe{Core} ecosystem listing. Not an MCP partner.
2. **Effect / TypeScript agent ecosystem** — Namera is Effect-native. High-signal, small audience (Effect Discord, OSS Effect HTTP). Good for SDK quality reputation, not volume.
3. **Base / OP DevRel** — Launch registry is ETH + Base + Arb + OP. Base is where AgentKit/x402 gravity sits; a Base-only testnet tutorial is enough.
4. **Namespace ENS** — Sibling product. After MCP works: optional `agent.org.eth` naming. Do not block wallet GTM on it.
5. **Openfort (careful)** — Existing Namespace relationship. Not a wallet co-sell (overlap). Possible identity/ENS collaboration only.

### P2

- **Stripe / x402 / CDP facilitator** — after token/call policies and a payee allowlist.
- **Rhinestone** — only if you add onchain modules later; today the models conflict in messaging.
- **Privy / Turnkey** — alternative `WalletKeys` backends, not GTM heroes.
- **ZeroDev** — optional Kernel compatibility testing / chain matrix **engineering** contact; **not** a launch partner brand.

---

## Distribution playbook

Developer distribution is primary. Assume **private beta**, not public npm GA, until release automation and docs match namera-core.

### Days 1–30 — Freeze the story, instrument one path

- **Rewrite public claims internally.** One-pager from this brief. Ban: ZeroDev foundation, onchain session keys, local MCP, contract allowlists, published SDK version from npm.
- **Hosted environment** that DevRel can point Cursor at (even single replica). Without this, MCP GTM is vapor.
- **MCP install snippet** + consent screenshots + a testnet “send 0 value call / tiny native transfer” tutorial. Include simulate denial examples (`CHAIN_NOT_ALLOWED`).
- **llms.txt / Cursor rule** generated from **this** architecture (wallet, grant, simulate, execute, errors) — not from namera.ai.
- **Do not** publish npm `@namera-ai/sdk@0.1.0` until it is this client and the old package is renamed or sunset-messaged.
- Measure: invited users who complete MCP consent + one simulated + one executed UserOp.

### Days 31–60 — Compare and occupy the slot

- **Comparison pages (honest):** vs Alchemy CLI (signer vs grant), vs Phantom (dedicated wallet vs org envelope), vs Openfort (secret MCP vs grant MCP), vs wallet-agent (key import).
- **CLI second:** device-flow login matching Alchemy’s three-command muscle memory, but `namera execution simulate` as the hero.
- **SDK third:** one backend TypeScript sample (API key + simulate/execute). No Effect required in the public sample.
- **Office hours** with design partners; collect denial-code confusion (your actual DX surface).
- Optional: Alchemy co-blog if legal/partnership allows, titled around org policy not Kernel.

### Days 61–90 — Expand only what the catalog supports

- If contract/selector policies ship, **then** Uniswap/token examples. If not, stay on native spend + chain + time + gas.
- MCP registry listing; “Namera” skill/rule for Cursor once the hosted URL is stable.
- Sunset plan for **legacy** namera.ai/npm (redirect, changelog, “Namera 2 / namera-core” naming — pick one name and stop dual-stack confusion).
- Only then: conference/Twitter volume. Shipping mixed-stack content in month 1 is negative distribution.

### Channels ranked

1. Cursor MCP configs + Claude connectors (highest intent).
2. Private Slack/Discord of design partners.
3. Alchemy/Base technical content (borrowed audience).
4. SDK npm (after cutover).
5. ENS/Namespace audience (identity, not wallets).

---

## Next 5 actions this week

1. **Publish an internal “namera-core vs namera.ai” claim sheet** (this document’s Product truth + Do not claim). Make it the only source DevRel uses. Stop linking npm/docs that mention ZeroDev as Namera’s foundation.
2. **Stand up or confirm a private-beta API origin** with `/mcp`, `/reference`, and dashboard consent working on **Base Sepolia**. If it does not work end-to-end, do not write public MCP tutorials.
3. **Record one Cursor walkthrough** (screen): consent → list wallets → simulate a denied chain → simulate allowed → execute sponsored. No Kernel/ZeroDev words. Capture typed MCP errors.
4. **Draft the MCP install JSON** (url, not npx) and a 40-line `llms.txt` from architecture/clients + policy catalog denial codes.
5. **Pick 8 design-partner accounts** (Cursor-heavy crypto/agent teams). Outreach offer: org wallet + revoke story vs Alchemy session signer / Phantom dedicated wallet. Do not promise selector policies or GA.

---

## Sources

### namera-core (this repository)

- `README.md`, `AGENTS.md`
- `architecture/README.md`, `architecture/clients/sdk-cli-mcp.md`
- `architecture/wallets/accounts.md`, `session-keys.md`, `wallet-keys.md`
- `architecture/evm/README.md`, `accounts/README.md`, `policies/README.md`, `policies/catalog.md`, `supported-chains.md`, `execution/README.md`
- `architecture/operations/executions.md`, `signatures.md`
- `architecture/auth/README.md`, `auth/oauth/README.md`, `auth/oauth/authorization-code.md`, `auth/core/api-keys.md`
- `architecture/billing/README.md`, `architecture/platform/production.md`, `architecture/frontend/dashboard.md`, `architecture/engineering/testing.md`
- `packages/evm/src/accounts/kernel.ts` (permissionless `toKernelSmartAccount`; unused `@zerodev/sdk` in `packages/evm/package.json`)
- `packages/sdk/README.md`, `apps/cli/README.md`, `apps/server/README.md`

### Legacy Namera (do not use for namera-core claims)

- https://namera.ai/
- https://www.namera.ai/llms.txt
- https://github.com/thenamespace/namera
- https://www.npmjs.com/package/@namera-ai/sdk
- https://kriskocic.com/blog/namera-session-keys-smart-wallets

### Company

- https://namespace.ninja

### Competitors and adjacent (web, 2026)

- Alchemy Agent Wallets: https://www.alchemy.com/docs/agent-wallets , https://www.alchemy.com/blog/agent-wallets-alchemy-cli , https://www.alchemy.com/overviews/stop-pasting-private-keys-into-cursor
- Phantom MCP: https://docs.phantom.com/phantom-mcp-server/index , https://www.npmjs.com/package/@phantom/mcp-server
- Openfort: https://www.openfort.io/docs/products/server/workflows/agentic-wallets , https://www.openfort.io/docs/overview/building-with-ai
- Coinbase AgentKit: https://docs.cdp.coinbase.com/agent-kit/core-concepts/model-context-protocol , https://docs.cdp.coinbase.com/agent-kit/core-concepts/wallet-management
- wallet-agent: https://github.com/wallet-agent/wallet-agent , https://wallet-agent.ai/
- ZeroDev permissions: https://docs.zerodev.app/smart-accounts/permissions/intro
- Rhinestone: https://www.rhinestone.dev/blog/your-agent-needs-a-wallet
- Privy / Crossmint / Turnkey / Dynamic roundups: https://www.crossmint.com/learn/agent-wallets-compared , https://www.openfort.io/blog/best-agent-wallets-for-developers , https://www.dynamic.xyz/docs/overview/agents/overview
- x402 / Stripe: https://docs.stripe.com/payments/machine/x402 , https://stripe.com/blog/machine-payments-protocol , https://x402.org
