# Policy state and reservations

API transaction policies were removed before launch. The remaining signature
policies are stateless. Execution preparation, completion and reconciliation no
longer read, create, settle or release API policy-state reservations.

The historical `core.session_key_policy_state` and
`core.session_key_policy_reservation` tables remain in the database schema,
but have no active policy consumers. No backfill or destructive database cleanup
is performed by this change. Existing internal data using retired policy shapes
is unsupported; deployment assumes no such active sessions or submissions.

These tables are distinct from billing usage reservations. Billing execution-count
and sponsorship holds remain active, including cancellation races, pending
submission retention and receipt-driven settlement. Onchain permission counters
are maintained by the installed contracts, not these retired API tables.
