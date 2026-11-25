---
"@namera-ai/contracts": minor
---

The launch policies. They are immutable and admin-free, and one deployment serves every account:

- `AllowPolicy`: a call allowed without conditions;
- `ArgPolicy`: conditions on static argument words and the call's value;
- `ApprovalPolicy`: allowed spenders and a cap per token for ERC-20 and Permit2 `approve`
  (`(address[] spenders, (address token, uint256 maxAmount)[] caps)`), refusing `increaseAllowance`, a zero token
  and a token capped twice;
- `SpendPolicy`: ERC-20 budgets per token and period across every call, counting transfers and approvals (Permit2's
  included) and refusing any other function of a limited token;
- `ValuePolicy`, `RateLimitPolicy` and `GasPolicy`: native-currency, operation-count and gas-cost budgets per period;
- `SignaturePolicy`: which contracts may verify the session's signatures, with conditions on single fields of the
  signed typed data (a permit's spender and value).

ERC-7562 bans `TIMESTAMP` during validation, so a limit charges the epoch-aligned period containing a time the agent
appends to the calldata, and returns the period's bounds for the EntryPoint to enforce. Limit policies have a `usage`
view of the latest period. Budgets are capped at 2^208 − 1, periods and stated times stay below 2^47, and a token
can't have two limits for one period. The contracts README lists what the limits can't see.
