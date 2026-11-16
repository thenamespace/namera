# Smart Sessions — origin, licences and changes

This directory is derived from **SmartSession** in
[erc7579/smartsessions](https://github.com/erc7579/smartsessions) at commit
`f5aaf867f7e22f3b9d746ce6f404f3a56833757f`, the code deployed at
`0x00000000008bDABA73cD9815d79069c247Eb4bDA`. SmartSession is by Rhinestone and Biconomy
(zeroknots.eth, Filipp Makarov).

The unmodified upstream files are in the commit
`chore(contracts): vendor erc7579/smartsessions f5aaf86 core verbatim`; `git diff` against it shows
every change. Comments were rewritten throughout; upstream authorship is kept in each derived file's
header (`Derived from erc7579/smartsessions@f5aaf86 (Rhinestone, Biconomy). Modified by Namera`) and
here. The ERC-7739 assembly in `core/SmartSessionERC7739.sol` is derived from Solady's `ERC1271` (MIT).

## Licences

| Files                                                                                                  | Licence                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `SmartSession.sol`, `core/*`, `DataTypes.sol`, `lib/{ConfigLib,EncodeLib,HashLib,IdLib,PolicyLib}.sol` | AGPL-3.0-only (upstream licence; see `LICENSE`)                                                                       |
| `ISmartSession.sol`                                                                                    | AGPL-3.0-only — upstream marks it `UNLICENSED`; this version is regenerated from the AGPL implementation              |
| `interfaces/IPolicy.sol`, `interfaces/ISessionValidator.sol`                                           | LGPL-3.0-only (upstream licence)                                                                                      |
| `lib/ExecutionLib.sol`, `lib/ValidationDataLib.sol`, `utils/EnumerableSet4337.sol`                     | Apache-2.0; derived from MIT-licensed upstream code (notice below)                                                    |
| `lib/FlatBytesLib.sol`                                                                                 | Apache-2.0; derived from MIT-licensed [rhinestonewtf/flatbytes](https://github.com/rhinestonewtf/flatbytes) `bb0859e` |

AGPL/LGPL files cannot be relicensed without the copyright holders' permission.

MIT notice for the MIT-derived files:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions: The above copyright notice and this
> permission notice shall be included in all copies or substantial portions of the Software.
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

## Not included

`SmartSessionCompatibilityFallback.sol`, `lib/AccountIdLib.sol`, `lib/SubModuleLib.sol`,
`external/policies/` (Namera ships its own policies), `interfaces/IRegistry.sol` (registry checks are
disabled upstream), `utils/EnumerableMap4337.sol` (unused), the `UintSet`, `AddressArray` and
`UintArray` types (unused), and unused helpers, errors, constants and operators.
`utils/AssociatedArrayLib.sol` is merged into `utils/EnumerableSet4337.sol` (same storage layout).

## Dependency changes

Upstream depended on erc7579-implementation, modulekit, module-bases, flatbytes, OpenZeppelin,
ExcessivelySafeCall and Solady 0.0.240. This version depends only on **Solady 0.1.26**:

| Upstream                                                                     | Now                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| account-abstraction `PackedUserOperation`                                    | Solady `ERC4337.PackedUserOperation` (same ABI)                                               |
| erc7579 `ModeLib`, `CallType`/`ExecType`                                     | Solady `LibERC7579` (`getCallType`, `getExecType`, constants); errors use `bytes1` (same ABI) |
| `ExecutionLib.decodeSingle`                                                  | Solady `LibERC7579.decodeSingle`                                                              |
| `IERC7579Account.execute.selector`, `IAccountExecute.executeUserOp.selector` | Constants in `DataTypes.sol`                                                                  |
| module-bases `IERC1271` call in the enable flow                              | Solady `SignatureCheckerLib.isValidERC1271SignatureNow`                                       |
| OpenZeppelin `ERC165Checker.supportsInterface`                               | Direct `IPolicy.supportsInterface` call (`supportsInterface` declared in `IPolicy`)           |
| OpenZeppelin `MessageHashUtils.toTypedDataHash`                              | Inlined `keccak256("\x19\x01" ‖ domainSeparator ‖ structHash)`                                |
| ExcessivelySafeCall                                                          | Solady `LibCall.tryCall` (same gas, value, 32-byte return copy cap)                           |
| IModule (erc7579)                                                            | `ISessionValidator` declares the two functions SmartSession calls                             |

Batches are still decoded into `Execution[] calldata` (typed) so Solidity validates `target`; Solady's
`getExecution` does not clean upper address bits.

## Security fixes

- **ERC-7739 hash binding.** Upstream `_erc1271IsValidSignatureViaNestedEIP712` rebuilt the hash from
  the signature and never compared it with the requested `hash`, so one session-key signature validated
  for any hash. It now requires `keccak256(\x19\x01 ‖ APP_DOMAIN_SEPARATOR ‖ contents) == hash` and,
  as in Solady, that the appended data fits in the signature and is non-empty; otherwise the signature
  is invalid. The ERC-7739 support probe returns `0x77390002` (upstream `0x77390001`).
- **FlatBytes.** Upstream wrote `length / 32 + 1` slots, one past its 10-slot struct for a 320-byte
  value. Slots are now exact, unused tail bytes are zeroed, and capacity is 16 slots (512 bytes) so
  P-256/WebAuthn session validator configs fit.
- **Removal revokes enable signatures.** `removeSession` (and so `onUninstall`) increments the enable
  nonce. Upstream left an unused owner ENABLE signature valid, so a removed session could enable itself
  again.
- **No fallback for account self-calls.** The generic fallback action (`FALLBACK_ACTIONID`) no longer
  covers executions whose target is the account (module installs, upgrades, owner changes); those need
  an explicit `(account, selector)` action. Upstream let a fallback meant for spending limits authorize
  admin calls.
- **Policy return data.** A policy call must return exactly 32 bytes. Upstream read missing return data
  as zero (valid), so a policy without the function, e.g. a broken proxy, approved everything.
- **Execution mode.** `execute` user operations must use the default exec type with a zero mode
  selector and payload (upstream checked only the exec type); an account interpreting them (ERC-7821
  batch of batches) could decode the execution data differently.

## Additions

- **Session validity window.** `Session` has `uint48 validAfter, uint48 validUntil` (owner-signed; part of
  the `SignedSession` EIP-712 type, so `SESSION_TYPEHASH`, `CHAIN_SESSION_TYPEHASH` and
  `MULTICHAIN_SESSION_TYPEHASH` differ from upstream). The window is stored per permission and account
  (`getSessionValidity`, `SessionValiditySet`), intersected into the validation data of every user
  operation (enforced by the EntryPoint), and checked with `block.timestamp` for ERC-1271 signatures
  (`validAfter <= block.timestamp <= validUntil` as in EntryPoint v0.7, `validUntil = 0` = unbounded). Because the ERC-1271 path reads
  `TIMESTAMP`, a session-key ERC-1271 signature cannot be verified inside another user operation's
  validation phase (ERC-7562); it works in execution and off-chain.
- This changes the `Session` ABI and EIP-712 hashes; upstream SmartSession tooling cannot build Namera
  sessions.

## Known limitations

- **ERC-7739 content names are advisory.** `contents` is an opaque struct hash, so a session key can sign
  any struct of an allowed app domain under an allowed content name. Content names protect honest
  signers from phishing; the enforced bounds are the app domain and the ERC-1271 policies (which receive
  the nested hash only). Same as upstream.

## Behaviour changes

- **Enable order (checks-effects-interactions).** After the enable signature is verified, the session
  is recorded (enabled set, paymaster flag, session validator, ERC-7739 contents) before policies are
  called. Final state is unchanged; event order differs (session events before policy events).
  `PolicyEnabled` is emitted before `initializeWithMultiplexer` is called.
- **Policy interface check.** A policy that does not implement `supportsInterface` (or reverts) now
  makes enabling revert with that error instead of `UnsupportedPolicy`; OpenZeppelin's extra check that
  `supportsInterface(0xffffffff)` is false is not performed.
- **Enable signature check.** An account whose `isValidSignature` reverts now fails with
  `InvalidEnableSignature` instead of bubbling the revert.
- **Renames.** `EnumerableSet.at` → `valueAt` (`at` becomes a reserved word).

## Simplifications (no ABI change)

- One `_enableSession` routine shared by `enableSessions`/`onInstall` and the ENABLE mode (upstream
  repeated it). `PolicyLib.check` reuses `tryCheck`. Small hash helpers are inlined in `HashLib`.
- `EnumerableSet.removeAll` clears the array in one pass instead of swap-and-pop per element.
- `disableERC1271Policies` drops a duplicate enabled-check (its modifier already reverts).
- `FlatBytesLib.store` no longer clears first; configs are only stored on cleared storage.
- Externally-only functions are `external`. The full ABI (74 entries) is unchanged by these steps.

## Static analysis

`forge lint` excludes `calls-loop` and `require-revert-in-loop` (policies are checked in a loop and
must revert on violation). Reviewed false positives are suppressed inline with the reason:
Solady-derived ERC-7739/ERC-6492 assembly (`incorrect-shift`, `divide-before-multiply`,
`write-after-write`, `too-many-digits`), ignored set/`eip712Domain` return values (`unused-return`),
and events after policy calls in loops (`reentrancy-*`; a reentrant policy runs with
`msg.sender = policy` and cannot change the account's state). Slither excludes `assembly`,
`naming-convention` (upstream `$storage` naming) and `unindexed-event-address` (keeps the upstream
event ABI).
