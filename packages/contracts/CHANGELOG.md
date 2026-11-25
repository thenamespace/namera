# @namera-ai/contracts

## 2.0.0-rc.0

### Minor Changes

- First release: the ABIs, CREATE2 addresses and deployment records of Namera's v2 contracts, deployed and verified
  (Sourcify and Etherscan) at the same address on Base, Sepolia, Base Sepolia, Arbitrum Sepolia and OP Sepolia. The
  contracts are unaudited: they have had internal security reviews only.
  
  - Each contract is a namespace with one export per version (`SmartSession.v1`: `abi`, `address`, and `deployments` by
    chain id). Each part is also its own export, `abiV1`, `errorsV1` (the ABI's error fragments), `addressV1` (a
    literal type) and `deploymentsV1`, so a bundle that imports `@namera-ai/contracts/SmartSession` keeps only what it
    uses. `Contract.Version`, `Contract.Deployment` and `Contract.Compiler` type them.
  - `External`: the addresses of the contracts Namera builds on, by version: EntryPoint 0.7, and Kernel 3.3's factory,
    ZeroDev's staked FactoryStaker, the implementation and the ECDSA validator.

- `SmartSession`, Namera's fork of Rhinestone and Biconomy's Smart Sessions (AGPL-3.0, see its `NOTICE.md`), with
  `ECDSASessionValidator` (k-of-n session signers) and `WebAuthnValidator`. Smart Sessions installs on Kernel 3.3
  (EntryPoint 0.7, deployed or through EIP-7702) only, and refuses any account whose `accountId()` isn't
  `kernel.advanced.v0.3.3` (`UnsupportedAccount`).
  
  - Sessions carry an owner-signed validity window (`validAfter`, `validUntil`). Session-key signatures bind the
    permission id (`keccak256(abi.encode(userOpHash, permissionId))`, and the same for ERC-1271 hashes), so a signed
    operation can't be moved to another session of the same key.
  - ERC-1271 session signatures (ERC-7739, over Kernel's wrapped hash) carry the signed struct's EIP-712 data, checked
    against the hash, for policies implementing `I1271TypedDataPolicy`.
  - Removing a session, every reconfiguration, and uninstalling or reinstalling the module spend unused enable
    signatures (`getNonce` is `epoch ‖ counter`). A session enabled in ENABLE mode emits `NonceIterated` and
    `SessionCreated`.
  - The fallback action (any call) never reaches the account, Smart Sessions, the EntryPoint or the account's installed
    validators and executors. It also refuses module lifecycle and hook functions (`onInstall`, `onUninstall`,
    `preCheck`, `postCheck`) on any target, and calldata ending in the account's or the EntryPoint's address.
  - Also refused: a policy or an action listed twice, calldata of 1 to 3 bytes or starting with the value selector, a
    policy answer that isn't exactly one word, an account asking about itself, and high-s ECDSA session signatures.
    Every set holds at most 127 entries (ERC-7562), and a validator config up to 2,304 bytes (16 passkeys or 69 ECDSA
    signers).
  - `WebAuthnValidator` is Namera's ERC-7579 validator for passkey owners on Kernel, and the stateless passkey verifier
    for session keys. An account holds up to 16 passkeys with a threshold (`addPasskey`, `removePasskey`,
    `setThreshold`). ERC-1271 signatures are bound to the account and chain (`replaySafeHash`), and a multichain mode
    lets one assertion approve user operations on several chains (`multichainChallenge`). P-256 is verified through
    the RIP-7212 / EIP-7951 precompile or in Solidity, as the signer chooses.

- The launch policies. They are immutable and admin-free, and one deployment serves every account:
  
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

- `SessionHook`: execution policies for sessions, which run around a session operation's calls and can check what it
  did. A session lists up to 8 execution policies (contracts implementing `IExecutionPolicy`) in `SessionHook`'s user
  operation policy data, so the owner's signature covers them. Kernel binds the hook to Smart Sessions' validation
  (install data `abi.encode(address smartSession)`, read back with `getSmartSession(account)`) and runs session
  operations through `executeUserOp`; a session operation names its session in a tag at the end of its calldata.
  
  The hook refuses a different reinstall, install or uninstall during a session operation, and session calls to the
  hook, the account, Smart Sessions, the EntryPoint or the session's execution policies, and it holds its lock through
  the policies' `postCheck`. `ExecutionPolicyBase` (Solidity source) is a starting point for writing execution
  policies.
