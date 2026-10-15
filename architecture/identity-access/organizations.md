# Organizations and permissions

An organization is the tenant boundary for wallets, session keys, machine actors,
and billing. A user can belong to multiple organizations. Their browser session
selects one active organization; it does not grant access to other memberships.

## Roles

Membership references an organization role. A role either references a code-owned
system role (`owner`, `admin`, `member`) or contains organization-local permissions.
System roles are synchronized at database startup without changing their IDs.

Handlers enforce the requested permission and actor kind. Application workflows
also enforce business invariants under transaction locks where authority can
change concurrently. Database composite foreign keys bind actors and role
references to the same organization.

Member administration uses permission dominance: the actor must have every target
role permission and at least one additional permission. The same rule applies to
the role being assigned. Equal roles cannot manage one another. Generic member
and invitation operations cannot assign, edit, or remove the system Owner.
Organization creation establishes its Owner; ownership transfer is not exposed.

## Membership lifecycle

Invitations target a normalized email and organization role and expire after seven
days. Acceptance checks identity, invitation state, role scope, and the current
member allowance before inserting membership. There is at most one active
membership per user and organization and one pending invitation per email and
organization.

Removal retains historical membership and actor rows. It revokes the removed
membership's personal CLI/MCP authorizations, tokens, and grants atomically.
Shared API keys and session keys are retained. Rejoining creates a new membership
and does not restore prior personal authorizations. Signed or pending operation
records remain available for reconciliation.

## Resource admission

Organization creation is capped by owned-organization count. Member and wallet
creation use billing resource limits. Workflows repeat resource admission under
the billing account lock before committing, including after remote provisioning.
See [billing](../services/billing.md).

## Source

- [Organization workflows](../../packages/application/src/auth/organization/)
- [Role authority](../../packages/application/src/auth/organization/permissions.ts)
- [Membership and role schema](../../packages/database/src/schema/auth/organization/)
