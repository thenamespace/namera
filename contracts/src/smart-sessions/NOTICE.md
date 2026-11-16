# Smart Sessions — origin and changes

This directory is a port of **SmartSession** from
[erc7579/smartsessions](https://github.com/erc7579/smartsessions) at commit
`f5aaf867f7e22f3b9d746ce6f404f3a56833757f`, the code deployed at
`0x00000000008bDABA73cD9815d79069c247Eb4bDA`. SmartSession is by Rhinestone and Biconomy
(zeroknots.eth, Filipp Makarov). Each file keeps its original SPDX header: most are
AGPL-3.0-only (see `LICENSE`), `IPolicy.sol` and `ISessionValidator.sol` are LGPL-3.0-only, and the
`utils/` libraries, `ExecutionLib.sol`, `ValidationDataLib.sol` and `IRegistry.sol` are MIT.

The unmodified upstream files are in the commit
`chore(contracts): vendor erc7579/smartsessions f5aaf86 core verbatim`; `git diff` against it shows
every change below.

## Not included

`SmartSessionCompatibilityFallback.sol`, `lib/AccountIdLib.sol` (used only by the fallback),
`lib/SubModuleLib.sol` (used only by bundled policies) and `external/policies/` (Namera ships its own
policies).

## Dependency changes

Upstream depended on erc7579-implementation, modulekit, module-bases, flatbytes, OpenZeppelin,
ExcessivelySafeCall and an older Solady. The port uses Solady 0.1.26 and files in `src/interfaces`
and `src/libraries`:

| Upstream                                                    | Port                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `erc7579/lib/ModeLib.sol`, `erc7579/interfaces/*`           | `src/interfaces/IERC7579.sol` (same types, constants, operators)                                                      |
| `modulekit/external/ERC4337.sol` (account-abstraction v0.7) | `src/interfaces/IERC4337.sol` (`PackedUserOperation`, `IAccountExecute`); unused `_packValidationData` import dropped |
| `module-bases/interfaces/IERC1271.sol`                      | `src/interfaces/IERC1271.sol`                                                                                         |
| `forge-std/interfaces/IERC165.sol`                          | `src/interfaces/IERC165.sol`                                                                                          |
| `flatbytes/BytesLib.sol` @ `bb0859e`                        | `src/libraries/FlatBytesLib.sol` (copied)                                                                             |
| OpenZeppelin `ERC165Checker.supportsInterface`              | `src/libraries/ERC165Checker.sol` (same semantics, 30k gas queries)                                                   |
| OpenZeppelin `MessageHashUtils.toTypedDataHash`             | Inlined in `HashLib.multichainDigest`: `keccak256("\x19\x01" ‖ domainSeparator ‖ structHash)`                         |
| ExcessivelySafeCall `excessivelySafeCall`                   | Solady `LibCall.tryCall` in `PolicyLib.callPolicy` (same gas, value, 32-byte return copy cap)                         |
| Solady `EIP712`, `EfficientHashLib`, `LibZip` (0.0.240)     | Solady 0.1.26                                                                                                         |

## Behaviour changes

None in this port commit. Fixes are listed below as they land.
