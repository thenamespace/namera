# EVM policy catalog

Every denial contains a stable code and the exact policy instance ID. API/MCP errors should expose those human-actionable fields without leaking internal exceptions.

## `evm.time-window`

Applies to executions using simulated block timestamp and signatures using operation timestamp.

| Condition                                       | Decision                  |
| ----------------------------------------------- | ------------------------- |
| `startsAt` present and timestamp is earlier     | `TIME_WINDOW_NOT_STARTED` |
| timestamp is equal to or later than `expiresAt` | `TIME_WINDOW_EXPIRED`     |
| otherwise                                       | allow                     |

Start is inclusive; expiry is exclusive. It is stateless because absolute bounds do not reset or accumulate.

`Evm.policy.executionDeadline` caps a detached execution preparation's signing
deadline at this policy's `expiresAt`. It never extends the caller's deadline
(which also accounts for the signing TTL and onchain session expiry). This
prevents delayed signature acceptance from relying on a still-valid historical
simulation timestamp after the API policy expires. Submission acceptance must
enforce the resulting deadline atomically; this is not an onchain expiry rule.

## `evm.chain-allowlist`

Applies to executions and signatures. It permits only a chain ID contained in `chainIds`; otherwise it returns `CHAIN_NOT_ALLOWED`. It restricts but does not grant signature access.

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

## `evm.native-spend-limit`

Applies to executions. Native spend is the sum of `call.value` across the complete batch.

| Period      | Behavior                                       | State key                         |
| ----------- | ---------------------------------------------- | --------------------------------- |
| `operation` | Compare this batch only; no state/reservation. | None                              |
| `hour`      | Cumulative within UTC hour.                    | `<chain>:hour:<window-start-ms>`  |
| `day`       | Cumulative within UTC day.                     | `<chain>:day:<window-start-ms>`   |
| `week`      | Cumulative week starting Monday.               | `<chain>:week:<window-start-ms>`  |
| `month`     | Cumulative within UTC calendar month.          | `<chain>:month:<window-start-ms>` |
| `lifetime`  | Cumulative for session key lifetime.           | `<chain>:lifetime`                |

Rules:

- If no limit exists for the chain and total native value is zero, allow. This permits token/contract calls that send no native value.
- If native value is nonzero and chain is unconfigured, deny `NATIVE_SPEND_CHAIN_NOT_CONFIGURED`.
- Every applicable limit must accommodate the per-operation amount; otherwise `NATIVE_SPEND_LIMIT_EXCEEDED`.
- Stateful reserve requires `spent + reserved + amount <= maxAmount`.
- Successful settlement moves reserved amount to spent; failure release subtracts reserved only.

## `evm.gas-budget`

Applies to executions. Maximum pessimistic cost is:

```text
(callGasLimit
 + verificationGasLimit
 + preVerificationGas)
* maxFeePerGas
```

The calculation uses the regular Rundler simulation estimate retained in policy
context, not the zero fee fields in a BSO submission payload. Budgets are per
chain and support `hour`, `day`, `week` (Monday start), or `lifetime`, with the
analogous state keys. Missing chain returns
`GAS_BUDGET_CHAIN_NOT_CONFIGURED`. Per-operation maximum or cumulative
`spent + reserved + maximumCost` over budget returns `GAS_BUDGET_EXCEEDED`.

Settlement charges `actualGasCost` and removes the full pessimistic reservation. It rejects a result whose actual cost exceeds the reservation because that would violate the authorization assumption.

## Offchain call restrictions

`evm.contract-access` allows only calls to its `address`.
`evm.functions-on-contract` additionally requires a listed four-byte selector.
`evm.functions-on-all-contracts` allows listed selectors on non-management targets.
`evm.account-functions` allows listed non-management selectors on the account itself.
Every call in a batch must match; otherwise the decision is `CALL_NOT_ALLOWED`.
The existing session permission safety rules reject account self-dispatch through
external-target rules and known management modules/selectors. Selector lists are
nonempty, bounded to 64, and case-insensitively unique.

These are singleton, intersecting API restrictions, not additive grants. For
example, contract access for A plus contract functions for B denies every call
when A and B differ. They do not grant missing onchain authority or restrict calls
submitted outside Namera. Root authority has no offchain counterpart: omitting an
API restriction already leaves that dimension unrestricted.

## `evm.erc20-token-transfer`

An offchain token-only restriction with a cumulative `allowance` in base units,
separate per chain. Only canonical direct `transfer`, `approve`, and
wallet-owned `transferFrom` calls to `address`, with zero native value, are allowed.
Other targets, unknown selectors, malformed/trailing calldata, and transferFrom
using another source address return `TOKEN_CALL_NOT_ALLOWED`. This deliberately
does not infer spending from potentially incomplete simulation asset changes.

All amounts in the batch are summed, including the full amount of each approval.
`spent + reserved + amount` must not exceed the allowance; otherwise return
`TOKEN_SPEND_LIMIT_EXCEEDED`. The state key is `<chain>:<lowercase-token>:lifetime`.
Successful settlement consumes the reservation; failure releases it. Approval
reductions do not refund the budget. Existing approvals, routers, permit-based
spending, and operations outside Namera are not tracked. Use an onchain token
permission for enforcement outside the API.

The protocol union feeds creation, persisted JSONB, SDK transport, audit and
notification policy types. No new table is needed. Handler tests cover mixed
batches, canonical encoding, pending budget exhaustion, settlement, release and
chain separation. The server registration test covers public API round-trip,
persistence, audit payloads and duplicate rejection.

## Policy interaction examples

| Session-key policies                                     | Example operation                             | Result                                                  |
| -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Time window + chain allowlist + zero native spend policy | ERC-20 transfer on allowed chain with value 0 | Allowed if simulation succeeds and other policies pass. |
| Native limit only for Base                               | ETH transfer on Ethereum                      | Denied: chain not configured.                           |
| Signature type + chain allowlist                         | Typed-data signature on allowed chain         | Allowed if typed data is enabled.                       |
| Time window + chain allowlist, no signature policy       | Message signature                             | Denied: explicit signature policy required.             |
| Daily gas budget + lifetime gas budget for same chain    | Operation under daily but over lifetime       | Denied; all applicable budgets must pass.               |
