# EVM policy engine

API policies are immutable, signature-only session-key restrictions. The registry
contains `evm.time-window`, `evm.chain-allowlist`, and `evm.signature`, in that
evaluation order. All are stateless singletons; equal priorities sort by policy ID.

Signature requests require the explicit `evm.signature` grant and must pass every
configured rule. Time and chain restrictions do not grant signing by themselves.
The application also checks grants, installation state and onchain signing authority.
See [catalog](catalog.md) for signature rules and limitations.

## Transaction authority

Transactions use installed onchain permissions, not API policy evaluation.
Preparation checks actor grants, session and installation status, chain, validity
and adapter simulation. Completion rechecks current authority under locks.
The signing deadline is capped by the preparation TTL and installation expiry,
not the signature-only time window.

The seven former API transaction policies and their evaluators were removed
before launch. There is no compatibility migration. Configure transaction limits
through onchain installations; an unrestricted/root installation remains broad.

Billing execution-count and gas-sponsorship reservations remain application-owned.
Cancellation, definitive failure and confirmed receipt settlement retain their
existing atomic lifecycle. Pending or uncertain submissions keep their holds.

## Extending signing rules

Define create/persisted schemas in protocol, implement a focused signature handler,
register priority and grant metadata, and test schema, evaluation and HTTP boundaries.
Do not add duplicate transaction authorization outside the onchain compiler.
