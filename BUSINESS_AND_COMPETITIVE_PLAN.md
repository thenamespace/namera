# Namera Business and Competitive Plan

Last updated: 2026-05-14

## Executive Summary

Namera should not monetize like a generic paymaster. Paymaster margin is useful, but it is too narrow and too easy for infrastructure vendors to compress.

The stronger business is to become the **wallet authority control plane for autonomous agents**:

- developers use Namera to create smart accounts
- teams issue scoped session keys to agents, bots, services, and integrations
- policies define what each actor can do
- Namera provides local tooling, hosted policy operations, monitoring, audit trails, simulation, and enterprise controls

The open-source SDK, CLI, and MCP server should stay the adoption engine. Revenue should come from managed infrastructure around policy operations, fleet management, observability, compliance, hosted execution, and premium policy modules.

## Market Position

Namera's sharpest category:

**Programmable delegated wallet execution for agents.**

The core customer question:

> How do I safely give an agent onchain authority without giving it my private key?

Namera should avoid positioning as:

- a consumer wallet
- a generic account abstraction vendor
- a generic agent payment API
- a custodial wallet provider
- only a paymaster or bundler reseller

The durable wedge is not "gasless transactions." It is **least-privilege wallet authority for automated systems**.

## ZeroDev Alternatives

ZeroDev is a strong default because it has Kernel smart accounts, session keys, policies, bundler/paymaster infra, and good ERC-4337 ergonomics. The alternatives below are realistic options if Namera wants vendor optionality, policy extensibility, or a migration path away from a single smart-account provider.

### Summary Table

| Option | What It Gives Namera | Policy Support | Can Deploy More Policies? | Fit |
|---|---|---|---|---|
| Rhinestone Smart Sessions + ERC-7579 | Vendor-neutral smart sessions across ERC-7579 accounts | Call, gas, rate limit, timestamp, signature, sudo, spending limits, and more via modules | Yes. ERC-7579 modules and Smart Session policies are designed for extension | Best strategic direction |
| Biconomy Nexus / Smart Sessions / MEE | Smart accounts, multichain sessions, paymasters, automation, orchestration | Smart Sessions policies, payment policy, spending limits, automation policies | Yes, through ERC-7579-style modules and Biconomy session stack | Strong productized alternative |
| Alchemy Account Kit / Modular Account | Wallet API, session keys, gas manager, bundler, embedded wallet infra | Native session-key permissions, spend limits, contract/function constraints | Partially. Powerful if using Alchemy Modular Account / ERC-6900 model, less neutral than ERC-7579 | Strong infra vendor, weaker neutrality |
| Safe + Safe7579 Adapter | Safe account compatibility with ERC-7579 modules | Depends on installed modules; can use Rhinestone audited modules | Yes via Safe7579 adapter and ERC-7579 modules | Best enterprise/account-owner compatibility |
| Pimlico + permissionless.js + ERC-7579 modules | Bundler/paymaster infra, smart-account tooling, Safe/7579 examples | Not a policy system by itself; pairs with Rhinestone/Biconomy modules | Yes if Namera owns module/policy layer | Best infra unbundling option |
| thirdweb Smart Wallets / Session Keys | App-facing smart wallets, session keys, account permissions, Engine | Target/function restrictions, native token limits, ERC20 limits, timestamp windows | Limited compared with ERC-7579 module ecosystems | Good app-dev DX, less ideal for Namera's control-plane thesis |
| Coinbase/Base Spend Permissions | Spend authorization for Base Account-style flows | Spend permissions, recurring/limited spend use cases | Limited and narrower than smart-session policy engines | Useful reference, not a full Namera backend |
| OpenZeppelin ERC-7579 Account Modules | Contract primitives for modular smart accounts | Depends on modules used | Yes, if Namera builds/contracts its own modules | Good long-term self-hosting path |

### 1. Rhinestone Smart Sessions + ERC-7579

Rhinestone is the most strategically aligned ZeroDev alternative because it moves Namera toward a vendor-neutral module standard instead of another full-stack provider lock-in.

Why it matters:

- Smart Sessions work with ERC-7579 smart accounts.
- ERC-7579 standardizes modular smart-account extensions.
- Policies can be composed per action.
- The module ecosystem already includes call, gas, rate-limit, signature, sudo, timestamp, spending-limit, recovery, automation, and validator modules.
- Safe, Biconomy, ZeroDev Kernel, Rhinestone accounts, and OpenZeppelin AccountERC7579 are part of the broader 7579 path.

Best use:

- Make Namera's policy model ERC-7579-first.
- Treat ZeroDev as one account backend, not the product foundation.
- Build Namera-specific policies as ERC-7579-compatible modules where possible.

Sources:

- [Rhinestone Smart Sessions overview](https://docs.rhinestone.dev/smart-wallet/smart-sessions/overview)
- [ERC-7579 Smart Sessions](https://erc7579.com/tooling/module-sdk/modules/smart-sessions)
- [ERC-7579 modules list](https://erc7579.com/modules)

### 2. Biconomy Nexus / Smart Sessions / MEE

Biconomy is a strong commercial alternative because it has a productized smart-session stack, multichain execution focus, and paymaster/orchestration infrastructure.

Why it matters:

- Biconomy Smart Sessions are built for multichain usage.
- MEE combines account abstraction, paymaster capabilities, and cross-chain orchestration.
- Session setup supports policies and payment-policy handling.
- It is closer to a managed execution platform than a low-level module toolkit.

Best use:

- Use as a managed backend option for customers who want multichain orchestration.
- Compare against ZeroDev for session creation, policy expressiveness, reliability, and chain coverage.
- Consider an adapter if Namera wants a "bring your AA provider" architecture.

Sources:

- [Biconomy Smart Sessions introduction](https://docs.biconomy.io/new/smart-sessions/introduction)
- [Biconomy Smart Sessions SDK reference](https://docs.biconomy.io/sdk-reference/sessions)
- [Biconomy gasless / MEE overview](https://docs.biconomy.io/faq/gasless-transactions-evm)

### 3. Alchemy Account Kit / Modular Account

Alchemy is a strong infrastructure provider, especially for teams that want wallet APIs, bundlers, gas sponsorship, and dashboard-driven operations.

Why it matters:

- Alchemy Wallet APIs support session keys.
- Modular Account V2 has built-in session-key permission types.
- Gas Manager has programmable sponsorship policies.
- Pricing is usage-based, with an 8% gas sponsorship admin fee listed on the public pricing page as of this update.

Tradeoff:

- Alchemy is excellent infrastructure, but Namera should avoid becoming a thin wrapper around Alchemy.
- Alchemy's model is more vertically integrated and less obviously neutral than ERC-7579 module-first architecture.

Best use:

- Support as an enterprise infra backend.
- Use Alchemy for customers that already run on Alchemy.
- Study its dashboard/paymaster policy model for Namera's managed console.

Sources:

- [Alchemy session keys](https://www.alchemy.com/docs/wallets/reference/wallet-apis-session-keys)
- [Alchemy session-key permissions](https://www.alchemy.com/docs/wallets/smart-contracts/modular-account-v2/session-key-permissions)
- [Alchemy pricing](https://www.alchemy.com/pricing)

### 4. Safe + Safe7579 Adapter

Safe matters because many serious teams already use Safe for treasury and operational accounts. If Namera wants enterprise adoption, Safe compatibility is more important than replacing Safe.

Why it matters:

- The Safe7579 Adapter makes Safe accounts compatible with ERC-7579 modules.
- Safe can use audited modules from Rhinestone.
- This lets Namera sell policy-controlled agent access to existing Safe users.

Best use:

- Build "Namera for Safe" as an enterprise product path.
- Let a company delegate scoped permissions from its existing Safe to agents.
- Target treasury automation, DAO ops, market maker operations, protocol maintenance, and recurring payments.

Source:

- [Safe and ERC-7579](https://docs.safefoundation.org/features/erc-7579/7579-safe)

### 5. Pimlico + permissionless.js

Pimlico is not a full policy competitor by itself. It is excellent account abstraction infrastructure: bundlers, paymasters, and permissionless.js tooling.

Why it matters:

- Namera could own the policy/session layer while using Pimlico for bundler/paymaster execution.
- ERC-7579 guides already show Smart Sessions being used with Pimlico clients.
- This is the cleanest way to avoid being dependent on a single vertically integrated provider.

Best use:

- Use Pimlico as one infrastructure backend.
- Keep policies, account abstractions, session objects, and customer-facing workflows inside Namera.

Sources:

- [Pimlico docs](https://docs.pimlico.io/)
- [ERC-7579 Smart Sessions guide using Pimlico](https://erc7579.com/tooling/module-sdk/using-modules/smart-sessions)

### 6. thirdweb Smart Wallets / Session Keys

thirdweb is a strong developer-experience product for app builders. It supports smart wallets, account permissions, session keys, and backend execution flows through Engine.

Why it matters:

- Good for teams that want fast wallet integration.
- Session permissions include targets, native token limits, ERC20 limits, and time windows.
- Strong distribution among app developers.

Tradeoff:

- Less aligned with Namera's agent-native, local-first, policy-control-plane thesis.
- More of a broad app platform than a neutral policy layer.

Sources:

- [thirdweb session keys](https://portal.thirdweb.com/transactions/session-keys)
- [thirdweb wallet session keys](https://portal.thirdweb.com/wallets/session-keys)

### 7. Coinbase/Base Spend Permissions

Coinbase/Base spend permissions are worth tracking because they teach mainstream developers the permissions mental model.

Why it matters:

- Good user-facing primitive for recurring or limited spend.
- Strong Base distribution.
- Useful for consumer and payment flows.

Tradeoff:

- Narrower than Namera's programmable policy model.
- Not a general session-key policy engine for arbitrary agent execution.

Source:

- [Coinbase spend permissions](https://docs.cdp.coinbase.com/wallets/using-wallets/spend-permissions)

### 8. OpenZeppelin ERC-7579 Account Modules

OpenZeppelin is important for long-term credibility and self-hosting.

Why it matters:

- It provides a conservative contract base for ERC-7579 smart accounts/modules.
- It can support a future where Namera deploys more of its own audited policy contracts.

Best use:

- Use as a reference path for Namera-owned modules.
- Consider for enterprise self-hosted deployments.

Source:

- [OpenZeppelin account modules](https://docs.openzeppelin.com/community-contracts/account-modules)

## Strategic Recommendation

Namera should evolve from:

> Namera on top of ZeroDev

to:

> Namera as an agent-native policy and session layer over ERC-7579-compatible smart accounts, with ZeroDev as one backend.

Recommended architecture direction:

1. Define a Namera policy interface independent of ZeroDev SDK types.
2. Build adapters for ZeroDev first, then Rhinestone/ERC-7579 Smart Sessions.
3. Add Safe7579 support for enterprise users.
4. Add Biconomy and Pimlico execution adapters where useful.
5. Keep local-first SDK/CLI/MCP as the open-source core.
6. Sell managed operations, observability, policy governance, and enterprise modules.

This gives Namera leverage. The product becomes the control plane, not an infra reseller.

## Monetization Thesis

The best revenue model is layered:

- **Open source core**: SDK, CLI, MCP, basic policies, local workflows
- **Hosted control plane**: teams, projects, policy registry, audit logs, monitoring
- **Execution infrastructure margin**: bundler/paymaster/routing with transparent markup
- **Premium policy modules**: advanced policies, audited modules, compliance modules
- **Enterprise governance**: approvals, roles, SIEM exports, SLAs, private deployments

The main customer willingness to pay is not "I want cheaper gas." It is:

- "I need to give agents wallet access safely."
- "I need to know what agents can do before they do it."
- "I need auditability when autonomous systems move funds."
- "I need policy controls my security team can understand."
- "I need this integrated into my agent stack without building AA infra."

## Revenue Streams

### 1. Hosted Policy Control Plane

This should be the flagship paid product.

Sell:

- project dashboard
- smart-account fleet view
- session-key inventory
- policy templates
- policy deployment flows
- session issuance/revocation
- policy simulation
- policy diffing
- alerting
- audit logs
- team roles
- environment separation
- API keys and webhooks

Why customers pay:

- once a team has more than a few agents or wallets, local JSON files and manual CLI operations do not scale
- security and finance teams need visibility
- production teams need alerts before funds move incorrectly

Example pricing:

| Plan | Price | Target |
|---|---:|---|
| Developer | Free | local SDK, CLI, MCP, testnet, small session limit |
| Team | $99/month | 3 projects, 20 smart accounts, 100 active sessions, logs |
| Growth | $499/month | 20 projects, 1,000 smart accounts, 10,000 active sessions, webhooks, monitoring |
| Scale | $1,499/month | 100,000 active sessions, policy simulation, premium support, custom limits |
| Enterprise | Custom | SLA, SSO, SIEM, private modules, dedicated support, private deployment |

Core meter:

- active delegated sessions
- policy evaluations
- monitored smart accounts
- retained audit log volume

### 2. Policy Simulation and Risk Scoring

Before an agent receives a session key, developers should be able to ask:

> What can this agent actually do?

Sell:

- policy dry runs
- transaction simulation against current onchain state
- "blast radius" reports
- target/selector analysis
- token exposure estimate
- route and protocol risk labels
- policy linting
- unsafe-policy warnings
- CI checks for policy manifests

Why customers pay:

- mistakes in wallet delegation are expensive
- this is security budget, not gas budget
- CI and compliance workflows need deterministic reports

Packaging:

- included lightly in Growth
- charged by simulation volume above limits
- enterprise-grade reports in Scale/Enterprise

Example usage pricing:

- first 10,000 simulations/month included in Growth
- $0.50 per 1,000 additional basic simulations
- $5-25 per advanced portfolio/blast-radius report

### 3. Managed Session-Key Fleet Ops

Agents create operational sprawl. Every service, sub-agent, environment, user, strategy, or integration can need a different key.

Sell:

- session lifecycle automation
- scheduled expiry/rotation
- bulk revocation
- compromised-key quarantine
- per-agent wallet manifests
- environment promotion: dev -> staging -> prod
- session templates
- agent identity mapping
- "who can spend what" reports

Why customers pay:

- production agent teams need key governance
- security teams care about revocation and rotation
- operations teams need clear ownership

Pricing meter:

- active sessions
- rotations/month
- managed agents
- monitored accounts

### 4. Hosted MCP Wallet Gateway

The local MCP server is a great adoption wedge. Paid version should be a hosted, policy-enforced wallet gateway for teams.

Sell:

- managed MCP endpoint per project
- auth and team access
- rate limits
- agent-specific tool permissions
- session-key-backed execution
- audit trail per MCP tool call
- allowlisted actions
- webhook callbacks
- cloud logs and replay

Why customers pay:

- local MCP is great for dev, but production agents need stable endpoints
- teams do not want every agent runtime managing wallet credentials locally
- auditability at the MCP tool-call layer is valuable

Packaging:

- Team: hosted MCP for dev/test agents
- Growth: production MCP endpoints and webhooks
- Enterprise: VPC/private deployment, SSO, SIEM, custom auth

### 5. Premium Policy Modules

Basic policies should stay open source:

- call policy
- gas policy
- timestamp policy
- rate-limit policy
- signature-caller policy
- sudo policy

Premium policies should solve high-value business problems:

- token exposure caps across chains
- portfolio drawdown limits
- DEX route allowlists
- protocol-specific policies for Uniswap, Aave, Morpho, Hyperliquid-style flows, bridges
- human approval above threshold
- two-agent approval
- oracle-based price bounds
- compliance allow/block lists
- vendor/integration-specific scopes
- recurring payment/subscription policies
- emergency pause and circuit breaker policies
- treasury policy packs for Safe

Revenue options:

- subscription-gated hosted use
- paid audited module packages
- enterprise module license
- module marketplace take rate later

Important:

Do not overcharge for basic policy primitives. Charge for trust, audits, operational convenience, and higher-level policy packs.

### 6. Execution Infrastructure Margin

Namera can charge for:

- bundler usage
- paymaster sponsorship
- chain routing
- transaction relaying
- priority lanes
- SLA-backed execution
- retries and nonce management

But this should not be the only business.

Possible model:

- pass through gas at cost
- add 5-10% sponsorship admin fee for hosted paymaster usage
- add per-UserOperation platform fee for high-volume customers
- bundle included monthly execution credits into plans

Reference:

- ZeroDev publicly lists bundled credits and gas sponsorship by plan.
- Alchemy publicly lists usage-based compute pricing and an 8% gas sponsorship admin fee.

Sources:

- [ZeroDev pricing](https://zerodev.app/pricing)
- [Alchemy pricing](https://www.alchemy.com/pricing)

### 7. Enterprise Safe / Treasury Automation

This could be Namera's highest-ACV wedge.

Sell to:

- protocols
- DAOs
- market makers
- funds
- onchain businesses
- agent teams managing treasury or revenue wallets

Product:

- connect existing Safe
- install Safe7579-compatible policy modules
- issue scoped session keys to agents/operators
- require human approval above thresholds
- audit every action
- revoke instantly
- generate monthly reports

Example use cases:

- payroll agent can transfer USDC only to approved addresses, max monthly cap
- treasury agent can rebalance only between approved protocols, max slippage
- market agent can trade only listed assets, max daily drawdown
- ops agent can claim rewards and compound, cannot withdraw principal
- vendor agent can invoice/collect only from one account

Pricing:

- $2,000-10,000/month per organization
- setup fee for custom policy design
- optional audit/review package

### 8. Compliance and Audit Add-ons

Some teams will pay for proof, not execution.

Sell:

- immutable audit exports
- SIEM export
- SOC 2 evidence package
- policy change approvals
- onchain/offchain log reconciliation
- KYB/KYC integration hooks
- sanctioned address screening integrations
- incident timeline generation

Target customers:

- fintech-like crypto products
- institutions
- agent platforms serving enterprise customers
- protocols with public treasuries

Pricing:

- Enterprise add-on
- $1,000-5,000/month depending on volume and retention

### 9. Marketplace / Registry Revenue

Longer term, Namera can create a policy/module marketplace.

Marketplace participants:

- protocol teams publishing official policy packs
- auditors attesting modules
- developers selling specialized policy modules
- agent frameworks distributing wallet capability templates

Possible revenue:

- 10-20% marketplace take rate
- paid verification/attestation listing
- sponsored protocol policy packs
- enterprise private registry

Do this later. A marketplace is only useful after Namera has distribution.

## Recommended Packaging

### Open Source

Purpose: adoption, trust, developer love.

Included:

- SDK
- CLI
- local MCP server
- basic policies
- local keystore
- local manifests
- testnet examples
- self-hosted examples

### Namera Cloud: Team

Purpose: first paid conversion.

Price: $99/month.

Included:

- hosted dashboard
- 3 projects
- 20 smart accounts
- 100 active sessions
- 30-day logs
- policy templates
- hosted MCP dev endpoint
- basic alerts

### Namera Cloud: Growth

Purpose: production agent teams.

Price: $499/month.

Included:

- 20 projects
- 1,000 smart accounts
- 10,000 active sessions
- 1-year logs
- webhooks
- policy simulation
- session rotation
- production hosted MCP
- team roles
- 5M policy evaluations/month

### Namera Cloud: Scale

Purpose: serious infra teams.

Price: $1,499/month.

Included:

- custom project/account limits
- 100,000 active sessions
- advanced policy simulation
- premium policy packs
- Safe integration
- priority support
- 25M policy evaluations/month
- SLA option

### Enterprise

Purpose: high-trust deployments.

Price: custom, likely $30,000-250,000/year.

Included:

- SSO/SAML
- SIEM exports
- VPC/private deployment
- dedicated support
- custom policy modules
- custom chain support
- contract review/audit coordination
- legal/security review support
- SLA

## Pricing Meters

Use a simple primary meter and a few secondary meters.

Primary meter:

- active delegated sessions

Secondary meters:

- policy evaluations
- smart accounts monitored
- execution volume / UserOps
- audit log retention
- simulation volume
- hosted MCP endpoints

Avoid charging primarily by wallet created. Wallet creation should feel cheap and abundant. Namera should monetize ongoing authority, policy evaluation, and operational trust.

## Go-To-Market Plan

### Phase 1: Developer Adoption

Goal:

- make Namera the default local-first way to give agents smart-account access

Actions:

- publish agent examples for Claude/Codex/Cursor-style MCP clients
- create "agent wallet without private keys" quickstart
- ship policy recipes for common tasks
- keep CLI and MCP friction extremely low
- produce security-focused content around scoped delegation

Primary CTA:

- install CLI
- create smart account
- issue session key
- start MCP server

### Phase 2: Production Teams

Goal:

- convert teams running real agents to hosted ops

Actions:

- build dashboard around sessions, policies, and logs
- ship hosted MCP endpoint
- ship policy simulation
- ship session rotation and revocation
- create team/project API keys

Primary CTA:

- connect project to Namera Cloud
- monitor session keys in production

### Phase 3: Enterprise / Safe

Goal:

- land higher ACV customers with existing treasuries

Actions:

- Safe7579 support
- treasury policy packs
- approval workflows
- audit exports
- private deployments
- compliance integrations

Primary CTA:

- "delegate limited Safe authority to agents"

## ICPs

### Best Initial ICP

Small technical teams building onchain agents.

Traits:

- 2-20 engineers
- already using smart wallets or raw private keys
- wants MCP or agent-framework integration
- needs to move real funds but not at institutional scale yet

Why they buy:

- raw private keys are too risky
- building policy/session infrastructure internally is too much work
- local-first open source earns trust

### High-ACV ICP

Protocols, DAOs, trading teams, and funds using Safe.

Traits:

- existing treasury
- onchain workflows already happen
- automation is useful but risky
- need approvals and auditability

Why they buy:

- they need constrained delegation more than cheap gas
- security and auditability justify real budget

### Platform ICP

Agent platforms and wallet platforms.

Traits:

- many downstream users
- need wallet capabilities for agents
- want to embed policy/session functionality

Why they buy:

- Namera becomes their wallet authority layer
- white-label / API pricing can scale with their usage

## Product Roadmap For Revenue

### Must Build First

1. Provider-agnostic policy model
2. Hosted session inventory
3. Policy template registry
4. Audit logs
5. Hosted MCP endpoint
6. Policy simulation
7. Billing meter for active sessions and policy evaluations

### Build Next

1. ERC-7579 Smart Sessions adapter
2. Safe7579 support
3. Session rotation and bulk revocation
4. Webhooks and alerts
5. Premium policy packs
6. Team roles

### Build Later

1. Marketplace
2. Private module registry
3. Compliance integrations
4. Dedicated chain/routing SLAs
5. Custom policy module builder

## Competitive Strategy

### Against ZeroDev

Do not compete head-on as "another smart account stack."

Position:

- ZeroDev is infrastructure.
- Namera is the agent wallet authority control plane.
- Namera can run on ZeroDev and other backends.

### Against Alchemy

Do not compete on raw infra breadth.

Position:

- Alchemy gives wallet APIs and gas infrastructure.
- Namera gives agent-native session governance, policy simulation, MCP, and operational controls.

### Against Biconomy

Do not compete only on multichain execution.

Position:

- Biconomy is strong execution/orchestration infra.
- Namera is the policy and authority layer agents use before execution.

### Against Privy / Turnkey / Dynamic

Do not compete as an embedded wallet/auth provider.

Position:

- they help create or hold keys
- Namera controls what delegated keys can do onchain

### Against Agent Payment Products

Do not compete on checkout or card rails.

Position:

- payment protocols define how agents pay
- Namera defines what the wallet permits the agent to do

## Risks

### Risk: Paymaster Margins Compress

Mitigation:

- treat paymaster fees as secondary revenue
- monetize policy ops, logs, simulation, enterprise controls

### Risk: Account Abstraction Providers Add Similar Dashboards

Mitigation:

- go deeper on agent workflows, MCP, policy simulation, and Safe treasury use cases
- support multiple providers so Namera remains neutral

### Risk: Policy Modules Become Commoditized

Mitigation:

- keep basic modules open source
- charge for audited packs, operational controls, monitoring, and enterprise workflows

### Risk: Enterprise Customers Distrust Hosted Wallet Infra

Mitigation:

- keep self-hosted/local-first story strong
- sell private deployments
- use onchain enforcement where possible
- keep owner keys outside Namera

### Risk: Too Many Customer Segments

Mitigation:

- start with agent developers
- use Safe/enterprise as the high-ACV expansion path
- avoid consumer wallet and generic payments distractions

## 90-Day Plan

### Days 0-30

- Write provider-agnostic policy spec.
- Map ZeroDev policy objects to Namera policy objects.
- Create public "Agent Wallet Without Private Keys" guide.
- Add examples for CLI + MCP + session policies.
- Define Cloud MVP billing meters.

### Days 31-60

- Build hosted session inventory MVP.
- Add audit logs for session creation, revocation, and execution.
- Build policy templates.
- Prototype policy simulation.
- Research and spike ERC-7579 Smart Sessions adapter.

### Days 61-90

- Launch private beta for Namera Cloud Team/Growth.
- Ship hosted MCP endpoint beta.
- Add webhooks and basic alerts.
- Start Safe7579 technical spike.
- Recruit 5-10 agent teams using raw keys or ad hoc wallets.

## The Business In One Sentence

Namera should make money by selling the operational trust layer around programmable wallet delegation: policy control, session governance, simulation, monitoring, hosted agent access, and enterprise-grade auditability.
