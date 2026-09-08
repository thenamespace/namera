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

## Policy interaction examples

| Session-key policies                                     | Example operation                             | Result                                                  |
| -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Time window + chain allowlist + zero native spend policy | ERC-20 transfer on allowed chain with value 0 | Allowed if simulation succeeds and other policies pass. |
| Native limit only for Base                               | ETH transfer on Ethereum                      | Denied: chain not configured.                           |
| Signature type + chain allowlist                         | Typed-data signature on allowed chain         | Allowed if typed data is enabled.                       |
| Time window + chain allowlist, no signature policy       | Message signature                             | Denied: explicit signature policy required.             |
| Daily gas budget + lifetime gas budget for same chain    | Operation under daily but over lifetime       | Denied; all applicable budgets must pass.               |

## Pending before production

- Confirm period boundaries and timezone presentation in dashboard documentation.
- Add externally documented examples for every denial code.
- Reconcile Alchemy BSO service-fee invoice variance against the persisted quote
  and product-priced units before enabling paid gas overage.
