# EVM policy catalog

Every denial contains a stable code and the exact policy instance ID. API/MCP errors should expose those human-actionable fields without leaking internal exceptions.

## `evm.time-window`

Applies only to signatures, using the operation timestamp.

| Condition                                       | Decision                  |
| ----------------------------------------------- | ------------------------- |
| `startsAt` present and timestamp is earlier     | `TIME_WINDOW_NOT_STARTED` |
| timestamp is equal to or later than `expiresAt` | `TIME_WINDOW_EXPIRED`     |
| otherwise                                       | allow                     |

Start is inclusive; expiry is exclusive. It is stateless because absolute bounds do not reset or accumulate.

`Evm.policy.authorizationDeadline` caps signature preparation at this policy’s expiry without extending the signing TTL. This is not an onchain expiry rule.

## `evm.chain-allowlist`

Applies only to signatures. It permits only a chain ID contained in `chainIds`; otherwise it returns `CHAIN_NOT_ALLOWED`. It restricts but does not grant signature access.

## `evm.signature`

Applies only to signatures and is the explicit signature-access grant. `allowedTypes` contains `message`, `typed-data`, or both. Missing type returns `SIGNATURE_TYPE_NOT_ALLOWED`. An entire session key without this policy returns `SIGNATURE_POLICY_REQUIRED` before signing.

Optional `typedDataRules` narrows typed-data requests. Each rule contains a
supported CAIP-2 `chainId`, `verifyingContract`, non-empty `primaryTypes`, and
optional exact domain `name` and `version`. One complete rule must match; fields
from different rules cannot be combined. Both the operation chain and the
payload's domain chain must match the rule. Contract comparison ignores hex case;
domain names, versions, and primary types are case-sensitive. Missing required
domain fields or no matching rule returns `TYPED_DATA_NOT_ALLOWED` with the
policy ID. Omitting `typedDataRules` allows all typed data when that signature
type is enabled, subject to the session's other authorization checks. An explicit
rule list must be nonempty. The dashboard omits the field when no rules are added
and displays “All typed data is allowed.” Adding rules narrows access; malformed
rules remain invalid rather than becoming unrestricted. Message requests are
unaffected by typed-data rules.

These are API policies, not onchain EIP-712 validation hooks. A user-controlled
key can still sign outside Namera, and domain matching does not constrain values
inside a Permit or other message. The dashboard editor requires at least one
rule when typed data is selected and displays all rule tuples in the shared
summary. Existing unrestricted policies show an explicit warning. Domain matching
checkboxes distinguish unrestricted fields from exact values, including an empty
string; editing preserves that distinction. Message types are entered as a comma-separated
list. The shared creation contract enforces these rules for API callers as well.
