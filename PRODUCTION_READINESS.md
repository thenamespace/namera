# Beta readiness

This checklist tracks only application work still required in the Namera server
and dashboard before inviting beta users. Deployment infrastructure, provider
account setup, email deliverability, operational runbooks, paid plans, and
post-beta product work are intentionally not tracked here. Stable technical
architecture remains documented in [`architecture/`](architecture/README.md).

## Beta scope

The beta supports Alchemy Modular Account V2 wallets on four mainnets and their
four corresponding testnets:

| Network family | Mainnet          | Testnet          |
| -------------- | ---------------- | ---------------- |
| Ethereum       | Ethereum Mainnet | Ethereum Sepolia |
| Base           | Base Mainnet     | Base Sepolia     |
| Arbitrum       | Arbitrum One     | Arbitrum Sepolia |
| Optimism       | OP Mainnet       | Optimism Sepolia |

The beta otherwise remains limited to the Free plan and the account, session
key, policy, execution, signature, authorization, portfolio, billing, inbox,
and workspace features already exposed by the dashboard.

## Current baseline

Verified on 2026-08-24:

- [x] `pnpm check` passes all 59 workspace tasks.
- [x] `pnpm test` passes all 32 test tasks, including 27 server suites and 124
      server tests.
- [x] A clean PGlite database loads the full schema and bundled `pg_trgm`
      extension.
- [x] The dashboard and server production builds complete.

## 1. Server correctness and security

### Route authorization

- [ ] Complete one route matrix covering actor type, permission, organization
      isolation, resource ownership, and session-key grant requirements for
      every public server endpoint.
- [ ] Close any uncovered tenant-isolation or privilege-escalation paths found
      by that review.
- [ ] Apply `Cache-Control: no-store` to authentication, OAuth, credential,
      signing, execution, and other sensitive responses.
- [ ] Bound request bodies for JSON, form, RPC, MCP, and browser telemetry
      endpoints.
- [ ] Add the browser security headers that are independent of deployment:
      content type, framing, referrer, permissions, and content security policy.

### Authentication and delegated access

- [ ] Add the missing race tests for magic-link double consumption and the final
      failed attempt; the conditional consume is already implemented.
- [ ] Add the missing OAuth tests for redirect, state, PKCE, resource, and client
      substitution; concurrent code redemption; simultaneous device approval or
      denial; final polling; and refresh-token-family reuse.

### Wallet and signing safety

- [ ] Decide and implement the beta recovery path for a wallet whose primary
      P-256 owner is unavailable. If recovery is deferred, prevent meaningful
      mainnet use and disclose the limitation in the account UI.
- [ ] Add a recovery worker for signature operations left in `reserved` after a
      process interruption, including billing and policy-reservation release.
- [ ] Restrict EIP-712 signing by domain, verifying contract, and primary type
      before general typed-data signing is enabled on mainnet.
- [ ] Confirm wallet creation, reconstruction, message signing, typed-data
      signing, ERC-1271/ERC-6492 verification, and revocation behave identically
      on every enabled network.

### Execution and policies

- [ ] Add an EVM destination/contract allowlist policy before enabling general
      mainnet session-key execution.
- [ ] Add an EVM function-selector allowlist policy before enabling general
      mainnet contract calls.
- [ ] Add ERC-20 spend limits before presenting token transfer as a safe
      delegated mainnet workflow.
- [ ] Define a stable result when policy-required simulation data is unavailable
      or incomplete; never silently evaluate against missing asset changes.
- [ ] Give submitted executions a bounded reconciliation lifetime and an
      explicit terminal state when the provider outcome remains unknown.
- [ ] Ensure an interrupted execution can settle or release billing and policy
      reservations without double settlement.
- [ ] Add a code-owned enable/disable state for each of the eight beta networks
      and reject disabled chains consistently across API, SDK-backed flows, CLI,
      MCP, and dashboard data.

### Billing and data reads

- [ ] Prove Free-plan wallet, signature, mainnet execution, testnet execution,
      and sponsored-gas limits cannot be exceeded by concurrent requests.
- [ ] Verify anniversary rollover and stale-reservation recovery preserve the
      ledger-derived balance for every Free-plan meter.

## 2. Dashboard completeness

### Global route behavior

- [ ] Add global TanStack Router error and not-found components.
- [ ] Replace indefinite spinners and blank regions with retryable error,
      not-found, permission-denied, offline, and provider-unavailable states.
- [ ] Hide unfinished routes and navigation entries rather than exposing empty
      beta surfaces.
- [ ] Handle an organization or permission change while a protected page is
      open by invalidating stale atoms and redirecting or re-rendering safely.

### Wallet operations

- [ ] Provide clear states for disabled networks, sponsorship exhaustion,
      insufficient unsponsored funds, unavailable signing, submitted execution,
      reconciliation, revert, and unknown terminal outcome.
- [ ] Surface the wallet recovery limitation or recovery controls on account
      overview before mainnet use.
- [ ] Keep policy create, edit, display, duplicate detection, and validation
      consistent for every policy available in the beta.

### Tables and forms

- [ ] Fix any beta table or form that still lacks a retryable error state,
      invalidates the wrong atom family after mutation, or reports success before
      refreshed server state is visible.
- [ ] Complete keyboard navigation, visible focus, accessible icon-button names,
      and live announcements on the five browser journeys below. A dashboard-wide
      accessibility audit is not a beta gate.

## 3. Tests required before beta

These are the remaining beta gates. Broad snapshot coverage, exhaustive visual
regression, every browser/OS combination, and tests for deferred features are
not required for the beta.

### Server integration tests

- [ ] Add table-driven authorization tests for the route matrix, prioritizing
      cross-organization access, revoked credentials, missing grants, and
      owner/admin/member boundaries.
- [ ] Add PostgreSQL concurrency tests for magic-link consumption, OAuth code
      redemption, billing hard limits, idempotent execution submission, and
      policy/billing reservation settlement. These behaviors depend on database
      locking and must not be certified only with PGlite.
- [ ] Add crash-recovery tests for signatures reserved before signing and
      executions interrupted before submission, after submission, and before
      settlement.
- [ ] Add policy tests only for the new destination, selector, and ERC-20 spend
      policies plus missing simulation context and UTC period boundaries. The
      existing policy behavior remains covered by the current server suite.

### Eight-network capability test

- [ ] Run the same live capability suite on all four mainnets and four testnets:
      account derivation and reconstruction, deployment, simulation, sponsored
      and unsponsored execution, receipt normalization, message and typed-data
      signing, signature verification, Blockscout metadata, portfolio reads, and
      explorer links.
- [ ] Exercise provider timeout, rejected submission, reverted operation,
      delayed receipt, duplicate idempotency key, and sponsorship denial at least
      once in the live suite where the provider can produce the condition.

### Dashboard browser journeys

- [ ] Authentication and workspace: sign in, create/switch workspace, update
      profile/workspace, invite a member, accept the invitation, and sign out.
- [ ] Wallet lifecycle: create an ENS-labelled wallet, load overview/assets,
      create a session key with policies, revoke it, and verify the UI updates.
- [ ] Operation lifecycle: simulate and execute sponsored and unsponsored calls,
      sign and verify, inspect activity/detail pages, and render a policy denial.
- [ ] Credentials and delegation: create/revoke an API key, approve/revoke MCP
      and CLI authorization, and confirm revoked access is removed from default
      views.
- [ ] Billing and inbox: display current Free usage, enforce one exhausted limit,
      open/read/archive a notification, and verify retryable partial portfolio
      failure.

Each journey only needs one maintained happy path plus the security- or
recovery-critical failure stated above. Component-level tests should be added
only when they cover logic that is difficult to exercise through these journeys.

## Beta gate

The application is ready for beta when:

- [ ] every server and dashboard item above is complete or explicitly removed
      from the beta product surface;
- [ ] `pnpm check` and `pnpm test` remain green;
- [ ] the required PostgreSQL concurrency and recovery tests pass;
- [ ] all eight networks pass the capability suite;
- [ ] the five critical dashboard journeys pass against a production build; and
- [ ] any unresolved wallet-recovery limitation is enforced in product behavior,
      not only described in documentation.

## Deliberately outside this checklist

- deployment platform, containers, ingress, DNS, TLS, backups, and rollback;
- provider account configuration and email-domain verification;
- observability vendor setup, alert routing, and on-call procedures;
- CI/release workflow implementation;
- Stripe, paid plans, invoices, overages, and webhook processing;
- multi-replica scaling and shared rate limiting;
- SDK/CLI publication and broad platform compatibility;
- non-EVM namespaces, additional chains, and additional account types; and
- post-beta administrative, audit-export, NFT, and analytics features.
