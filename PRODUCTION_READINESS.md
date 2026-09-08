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

Wallet owners are user-held passkeys only. Session keys are user-held secp256k1
keys with onchain authorization and optional additional API policies. Managed
providers remain in code but are disabled in the beta product. The SDK, CLI,
encrypted local keystore and loopback HTTP `namera mcp start` are beta gates;
the hosted MCP transport is removed while its OAuth service remains.

## Current baseline

Verified on 2026-09-08:

- [x] `pnpm check` passes all 66 workspace tasks.
- [x] `pnpm test` passes all 37 task-graph entries. The default server lane passes
      36 suites / 150 tests and skips the three PostgreSQL-only billing tests.
      SDK: 50 tests; CLI: 38; dashboard: 21; EVM: 59 passing / four opt-in
      Anvil tests skipped. Cached tasks are included in the task-graph total.
- [x] A clean PGlite database loads the full schema and bundled `pg_trgm`
      extension.
- [x] The dashboard and server production builds complete.

An additional PostgreSQL 17 run passed all 37 server suites and 151 tests,
including the three billing concurrency scenarios. This proves the tested
driver/migration and billing boundaries, not every possible race.

These checks do not certify live networks or browser journeys.
The default EVM run skips four opt-in Anvil account-abstraction
tests. A separate Sepolia-fork run on 2026-09-08 passed all four: detached passkey
deployment, session installation/native limits/revocation, execution lifetime,
and ERC-1271 message/typed-data authority. This does not certify bundler/BSO
behavior or the other seven networks. Task-graph entries include dependency
build/typecheck tasks, not just test suites.

## 1. Server correctness and security

### Route authorization

- [x] Verify every protected typed API endpoint rejects credential-free requests
      before payload decoding, with no-store responses. The reflected contract
      regression rejects new public endpoints outside the explicit allowlist.
- [ ] Complete one route matrix covering actor type, permission, organization
      isolation, resource ownership, and session-key grant requirements for
      every public server endpoint.
- [ ] Close any uncovered tenant-isolation or privilege-escalation paths found
      by that review.
- [x] Apply `Cache-Control: no-store` to authentication, OAuth, credential,
      signing, execution, and other sensitive responses. The outer API middleware
      defaults to no-store, including pre-authentication failures and defects;
      successful public OAuth discovery retains its explicit cache policy.
- [x] Bound request bodies for JSON, form, RPC, MCP, and browser telemetry
      endpoints. API buffered readers enforce 2 MiB / OAuth 64 KiB while reading;
      local MCP has separate bounded readers. Real-socket overflow tests cover
      omitted Content-Length and listener recovery. New streaming routes must
      provide their own byte bounds.
- [ ] Add the browser security headers that are independent of deployment:
      content type, framing, referrer, permissions, and content security policy.
      Dashboard build/preview now owns the policy and emits `_headers`, with a
      meta CSP fallback. Verify all critical browser journeys under this policy
      and confirm the actual static host applies its HTTP headers before closing.

### Authentication and delegated access

- [x] Verify mixed token/manual-code magic-link double consumption and OAuth
      authorization-code redemption with eight concurrent requests on PostgreSQL.
- [x] Verify the final failed magic-link attempt under concurrent token/code
      redemption on PostgreSQL: consumption and lockout remain mutually exclusive.
- [x] Verify competing-user device claims and approval-versus-denial races on
      PostgreSQL, including persisted authorization and token-exchange outcomes.
- [ ] Finish OAuth redirect, state, PKCE, resource, and client-substitution
      coverage.
      Duplicate approval, final polling, and refresh-token reuse races pass on
      PostgreSQL; they do not cover these remaining transitions.

### Wallet and signing safety

- [ ] Decide and implement the beta recovery path for a wallet whose primary
      P-256 owner is unavailable. If recovery is deferred, prevent meaningful
      mainnet use and disclose the limitation in the account UI.
- [x] Expire abandoned reserved signatures and release their billing capacity.
      The composed billing worker performs this recovery; the signature HTTP
      suite verifies expiry, rejection of late completion, and restored quota.
      Current signature policies do not reserve stateful policy capacity.
- [x] Verify concurrent late signature completions and expiry recovery on
      PostgreSQL: eight completion attempts fail and eight recovery passes
      release exactly one hold without consumed or reserved signature quota.
- [x] Verify an in-flight signature completion crosses expiry while provider
      verification is pending: recovery releases the hold, and late verification
      cannot settle it. The delayed-provider HTTP regression passes on PostgreSQL.
- [ ] Restrict EIP-712 signing by domain, verifying contract, and primary type
      before general typed-data signing is enabled on mainnet.
- [ ] Confirm wallet creation, reconstruction, message signing, typed-data
      signing, ERC-1271/ERC-6492 verification, and revocation behave identically
      on every enabled network.

### Execution and policies

- [x] Expose destination, function-selector and ERC-20 allowance permissions in
      the session contract, Alchemy compiler and dashboard policy catalog.
      Permission translation, overlap rejection and privileged-target protection
      have unit coverage. These are onchain grants/hooks, not new API policies.
- [x] Add real-contract enforcement tests for selector grants and ERC-20
      allowances, including denial and allowance exhaustion. Translation tests
      alone do not prove deployed-contract behavior. Target denial already has
      coverage in the Sepolia-fork session lifecycle suite. Token tests also
      verify transfer-plus-approval exhaustion and unchanged token state after
      denied transfers/approvals on that fork; this is not an eight-chain gate.
- [ ] Define a stable result when policy-required simulation data is unavailable
      or incomplete; never silently evaluate against missing asset changes.
- [x] Verify a simulation adapter failure stops preview and preparation with
      `EXECUTION_FAILED`, without policy state or billing holds. Live-provider
      incomplete asset discovery still needs separate validation above.
- [ ] Give submitted executions a bounded reconciliation lifetime and an
      explicit terminal state when the provider outcome remains unknown.
- [ ] Ensure an interrupted execution can settle or release billing and policy
      reservations without double settlement.
- [x] Verify eight competing execution workers claim and settle two queued
      operations once on PostgreSQL, with exactly two confirmation events,
      expected policy/billing totals and no remaining reservations. This covers
      competing live workers, not crashes or expired-lease takeover.
- [x] Verify abandoned prepared/submitted lease takeover on PostgreSQL, including
      stale-write rejection and one final billed confirmation. Actual provider
      submission interrupted before persistence still needs separate coverage.
- [ ] Add a code-owned enable/disable state for each of the eight beta networks
      and reject disabled chains consistently across API, SDK-backed flows, CLI,
      MCP, and dashboard data.

### Billing and data reads

- [x] Verify concurrent admission at the Free signature, mainnet execution,
      testnet execution, and sponsored-gas meter limits on PostgreSQL.
- [ ] Verify concurrent wallet creation at the Free local-wallet resource cap.
      The PostgreSQL admission test passes with 49 existing wallets: one of
      eight locked insertion transactions succeeds and seven hit the cap. Full
      concurrent registration-ceremony coverage remains pending.
- [x] Verify concurrent billing reservation/settlement retries produce one hold
      and one ledger debit; release after settlement does not return used quota.
- [x] Verify concurrent anniversary rollover creates one new period and one
      set of balances on PostgreSQL.
- [ ] Verify anniversary rollover and stale-reservation recovery preserve the
      ledger-derived balance for every Free-plan meter.

## 2. Dashboard completeness

### Global route behavior

- [x] Add global TanStack Router error and not-found components.
- [ ] Replace indefinite spinners and blank regions with retryable error,
      not-found, permission-denied, offline, and provider-unavailable states.
- [x] Hide unfinished routes and navigation entries rather than exposing empty
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
      Magic-link mixed token/code consumption and OAuth HTTP code redemption
      now have eight-way race coverage; execution and recovery races remain.
- [x] Verify concurrent refresh-token reuse invalidates the winning rotation's
      access and refresh tokens, with committed revocation before the error.
- [x] Verify duplicate CLI device approvals create one authorization and
      concurrent final polls issue one token response on PostgreSQL.
- [x] Verify concurrent signature completion and expiry recovery on PostgreSQL.
      Eight valid completions settle/audit once; eight expired completions racing
      eight cleanup passes release once. Delayed verification after recovery
      cannot settle the released hold.
- [ ] Complete execution crash-recovery tests before submission, after
      submission, and before settlement.
- [ ] Complete real-contract selector/ERC-20 enforcement coverage plus missing
      simulation context and UTC period boundaries. Existing permission schema
      and compiler tests do not replace real-contract enforcement tests.

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
- [ ] Wallet lifecycle: create a passkey wallet, load overview/assets, generate
      and export an encrypted local session key, approve its onchain policies,
      import it in the CLI, revoke it and verify per-chain state updates.
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
