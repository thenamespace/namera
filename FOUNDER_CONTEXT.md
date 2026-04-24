# FOUNDER_CONTEXT.md

## Company

- **Name:** Namera
- **Website:** https://namera.ai
- **Docs:** https://namera.ai/docs
- **GitHub:** https://github.com/thenamespace/namera
- **Category:** Developer infrastructure
- **Subcategory:** Programmable wallet infrastructure, smart account infrastructure, account abstraction tooling, agent wallet infrastructure
- **Open source:** Yes, Apache-2.0

## One-Liner

Namera is a programmable wallet infrastructure layer for autonomous agents. It lets developers create smart accounts, issue scoped session keys, attach programmable policies, and let agents execute onchain actions without exposing the primary signer.

## Short Description

Namera is not a consumer wallet and not a generic payments product. It is developer-first infrastructure for constrained wallet delegation. The core idea is simple: agents should not get raw private keys. They should get scoped capabilities enforced onchain.

Namera builds on top of ZeroDev smart accounts and validator plugins. It extends battle-tested account abstraction infrastructure with agent-native delegation, policy design, local-first tooling, and machine-friendly operational surfaces.

## Core Problem

Most agent wallet setups are structurally unsafe.

The common pattern today is to pass a raw private key through an environment variable or some other secret handoff. Once that key reaches runtime, the agent has broad or total authority. There is no native least privilege model, no clean way to constrain actions to one job, and no safe way to let multiple autonomous systems operate in parallel with different permissions.

Alternative approaches also have tradeoffs:

- API-wrapped wallets and custodial systems reduce direct key exposure, but often move control offchain or into opaque backends
- Card-based or merchant payment layers solve spend, not programmable onchain execution
- Generic account abstraction stacks provide primitives, but are often not packaged for agent workflows

Namera exists to solve the specific problem of safe delegated onchain execution for agents.

## Product Thesis

The right mental model is:

- agents need wallets, not private keys
- execution matters more than ownership
- permissions are better than full control
- wallets should behave like programmable execution environments

Namera turns a wallet from a blunt signer into a programmable execution layer with clear permission boundaries.

## What Namera Is

Namera is a programmable execution layer built on smart accounts.

It does not try to replace wallets or introduce a new wallet standard. It defines a better way to use wallets in agent-driven systems:

- create deterministic smart accounts
- issue delegated session keys
- attach explicit policy sets
- enforce those policies onchain
- execute single, batched, parallel, or multichain transactions
- expose wallet capabilities through SDK, CLI, and MCP

## What Namera Is Not

Namera is not:

- a consumer wallet
- a custodial wallet provider
- a generic agent payments company
- a card issuer
- a merchant checkout layer
- a hype-driven crypto brand

## Products

### 1. Namera SDK

The SDK is the main integration surface for developers.

It is a TypeScript SDK for:

- creating smart accounts
- issuing ECDSA or passkey session keys
- composing policies
- executing transactions
- signing messages and typed data

Key product traits:

- deterministic smart account creation
- ECDSA and passkey account support
- ECDSA multi-chain session approval via Merkle-root-based flow
- passkey-based approval flows for user-prompted UX
- lane-based transaction execution for batching, parallel execution, and multichain routing
- ERC-6492-compatible signing support

### 2. Namera CLI

The CLI is the local-first operational surface.

It is designed for both humans and agents, but modeled in an agent-first way:

- every command can expose a JSON schema
- every command supports deterministic `--params`
- commands return structured output
- interactive prompts are available but optional

The CLI manages:

- encrypted keystores
- smart accounts
- session keys
- command schemas
- local MCP server startup

### 3. Namera MCP Server

The MCP server is started through the CLI and exposes a smart account plus session keys as an agent-usable wallet interface.

This is how Namera becomes directly usable inside MCP-compatible environments. The MCP story matters because it turns Namera from "wallet infrastructure" into a practical interface for real agent systems.

Current MCP positioning:

- local-first
- scoped by session-key policies
- no primary key exposure
- works with MCP-compatible agent clients

## Core Features

Namera should be described as a coherent system, not a loose feature list.

### Smart Accounts

- deterministic addresses
- smart-account-based execution model
- built on ZeroDev account abstraction infrastructure
- ready before deployment

### Session-Key Delegation

- delegated keys for agents, bots, apps, and integrations
- owner signer stays separate from delegated access
- revocation by owner
- lazy validator installation on first use

### Programmable Policies

Supported policy types include:

- call policy
- gas policy
- signature policy
- rate-limit policy
- timestamp policy
- sudo policy for trusted internal flows

Important framing:

- policies compose
- all attached policies must pass
- enforcement happens onchain

### Transaction Execution

- single transaction execution
- atomic batches
- parallel execution through lanes / nonce management
- multichain transaction routing

### Passkeys and Signing

- passkey-based smart accounts
- passkey-based session keys
- ERC-6492 message and typed-data signing utilities

### Local-First Control

- encrypted local keystores
- CLI-first operational workflows
- no required cloud dependency for core local workflows
- MCP surface for agents

## Technical Foundation

- Built on ZeroDev smart accounts and validator plugins
- Uses account abstraction patterns around ERC-4337-style workflows
- TypeScript SDK
- CLI for local ops and agent automation
- Smart account and session-key flows optimized for agent-controlled execution

## Target Customers

Primary audience:

- developers building autonomous agents
- technical founders building crypto x AI products
- wallet teams
- infra teams
- protocol teams
- advanced crypto operators

Best-fit users:

- teams building agentic products that need safe onchain execution
- apps needing constrained delegation instead of broad wallet access
- systems that require revocable, auditable, scoped execution
- teams that want local-first control instead of managed custody

## Core Use Cases

- AI agents that need wallet access without raw key exposure
- trading and rebalancing bots
- treasury operations with narrow permissions
- payroll or recurring onchain automation
- protocol-specific integrations
- partner or vendor access with one session key per integration
- multi-tenant agent systems
- subscription-like flows with rate limits and time windows

## Ideal Positioning

Primary category to own:

**Programmable delegated wallet execution for agents**

Alternative acceptable phrasing:

- programmable wallet infrastructure for autonomous agents
- programmable session key layer for smart accounts
- execution layer for agent wallets
- smart wallets for autonomous agents

Avoid broad category claims like:

- payments for AI agents
- wallets for everyone
- all-in-one agent finance

Those drag Namera into adjacent categories dominated by card rails, checkout layers, or custodial APIs.

## Differentiation

Namera is different because of where control is enforced and how usable that control is.

### Against raw private-key delegation

- keeps the owner signer out of the runtime path
- turns delegated access into a bounded capability
- supports least-privilege execution

### Against API-only or custodial wallet layers

- keeps the execution model onchain
- preserves compatibility with existing protocols
- avoids opaque backend-only control planes

### Against generic account abstraction tooling

- built explicitly for agents and automation
- packages delegation as a first-class product surface
- includes local-first CLI and MCP interfaces

### Against card and merchant payment rails

- solves programmable onchain execution, not just merchant spend
- works as the control plane for what an agent can do with a wallet

## Competitive Context

### Closest direct competitors

- Turnkey
- Openfort
- Privy
- Crossmint
- Sponge

### Important platform/distribution competitors

- Coinbase AgentKit / Agentic Wallets
- Polygon agent tooling / Polygon Agent CLI
- Alchemy agent tooling

### Adjacent but not direct

- Ramp Agent Cards
- PayPal agent commerce products
- Visa Intelligent Commerce
- Mastercard Agent Pay
- AgentCard
- Nevermined Pay
- Payman

### Standards / protocol layer to monitor

- x402
- MPP
- AP2 / ACP
- UCP

## Competitive Framing

Namera should be positioned against products that answer:

**"How do I safely give an agent onchain authority?"**

It should not try to win the entire "agent payments" category.

The standards narrative should be:

- x402 / MPP / AP2 / UCP define how agents pay or transact across interfaces
- Namera defines what the agent is allowed to do with the wallet in the first place

Namera is the wallet authority control plane, not merely another payment endpoint.

## Messaging Anchors

Every strong Namera message should connect to at least one of these:

- Agents need wallets, not private keys
- Execution is more important than ownership
- Permissions are better than full control
- Smart accounts make wallet behavior programmable
- Namera is the execution layer for agents
- Scoped session keys are API keys for wallet authority

## Messaging Do / Don’t

### Do

- speak to developers as peers
- use specific mental models
- make strong technical claims that are defensible
- anchor benefits in concrete execution and security outcomes
- emphasize onchain enforcement and constrained delegation

### Don’t

- use hype language
- sound like a consumer wallet brand
- call Namera a generic payments company
- drift into vague AI futurism
- oversell features beyond what exists in docs and code

## Brand Voice

### Core voice

- confident
- precise
- technical but readable
- minimal
- slightly opinionated
- builder-first

### Voice rules

- prefer short to medium sentences
- open with a sharp point
- avoid filler transitions
- avoid generic Web3 or AI slogans
- simplify without dumbing down
- compress insights instead of padding them

### Tone by channel

- blog: deep, structured, explanatory
- X: sharp, minimal, insight-driven
- LinkedIn: structured, slightly narrative
- Reddit: honest, transparent, discussion-first
- docs: zero ambiguity

## Content Themes

- why agents should not hold private keys
- session keys as the right delegation primitive
- smart accounts vs EOAs
- onchain enforcement vs backend policy
- local-first wallet ops for agents
- programmable execution as infrastructure
- wallet control planes for autonomous systems

## Narrative Constraints

Stay specific to:

- agent-executed onchain actions
- permission systems
- smart-account design
- constrained delegation

Avoid generic content about:

- AI changing everything
- Web3 being the future
- decentralization as a vague virtue

## Source of Truth Priority

When generating content or strategy from this file, prefer sources in this order:

1. Namera website copy in the repo
2. Namera docs in the repo
3. SDK and CLI READMEs / package metadata
4. This founder context
5. External market analysis

If external claims conflict with the repo, prefer the repo.

## Known Facts Useful for Skills

- Namera is developer infrastructure, not a consumer app
- Namera is open source
- Namera is local-first in CLI and MCP workflows
- Namera uses ZeroDev under the hood
- Namera supports smart accounts, session keys, policies, and multichain execution
- Namera supports passkey-based flows
- Namera includes an MCP server through the CLI
- Namera should be framed as agent-native wallet execution infrastructure

## Known Messaging Inconsistencies To Avoid

These exist in the current repo and should not be repeated in future content unless intentionally updated:

- The root `README.md` says the monorepo uses Bun as the package manager, but the repo is clearly `pnpm`-based.
- The homepage FAQ says "Use the managed platform and start immediately," which conflicts with the local-first, self-controlled product story used across the CLI, docs, and positioning.
- Some website copy says "programmable wallets" or "smart wallets," while deeper docs position Namera more precisely as smart-account-based programmable wallet infrastructure. Prefer the more precise framing when accuracy matters.
- The docs mention x402 in navigation/context, but Namera’s strongest documented product surface today is smart accounts, session keys, CLI, SDK, and MCP. Do not overstate x402 support unless a concrete implementation page exists.

## Current Stage

Namera appears to be an early-stage infra product with:

- live website and docs
- published SDK and CLI packages
- clear product thesis
- active positioning around agent wallets and programmable delegation

Do not invent traction metrics, revenue, customer counts, or enterprise claims unless explicitly provided elsewhere.

## Default Assumptions For Skills

Unless the user says otherwise:

- audience is technical
- goal is authority, clarity, and strong positioning
- tone is precise and builder-first
- product emphasis should be on SDK, CLI, MCP, session keys, and policies
- primary differentiation is safe delegated onchain execution for agents
