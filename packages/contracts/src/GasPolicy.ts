import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "checkUserOpPolicy",
  "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "userOp",
    "type": "tuple",
    "internalType": "struct ERC4337.PackedUserOperation",
    "components": [
      { "name": "sender", "type": "address", "internalType": "address" },
      { "name": "nonce", "type": "uint256", "internalType": "uint256" },
      { "name": "initCode", "type": "bytes", "internalType": "bytes" },
      { "name": "callData", "type": "bytes", "internalType": "bytes" },
      { "name": "accountGasLimits", "type": "bytes32", "internalType": "bytes32" },
      { "name": "preVerificationGas", "type": "uint256", "internalType": "uint256" },
      { "name": "gasFees", "type": "bytes32", "internalType": "bytes32" },
      { "name": "paymasterAndData", "type": "bytes", "internalType": "bytes" },
      { "name": "signature", "type": "bytes", "internalType": "bytes" }
    ]
  }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "cost",
  "inputs": [{
    "name": "userOp",
    "type": "tuple",
    "internalType": "struct ERC4337.PackedUserOperation",
    "components": [
      { "name": "sender", "type": "address", "internalType": "address" },
      { "name": "nonce", "type": "uint256", "internalType": "uint256" },
      { "name": "initCode", "type": "bytes", "internalType": "bytes" },
      { "name": "callData", "type": "bytes", "internalType": "bytes" },
      { "name": "accountGasLimits", "type": "bytes32", "internalType": "bytes32" },
      { "name": "preVerificationGas", "type": "uint256", "internalType": "uint256" },
      { "name": "gasFees", "type": "bytes32", "internalType": "bytes32" },
      { "name": "paymasterAndData", "type": "bytes", "internalType": "bytes" },
      { "name": "signature", "type": "bytes", "internalType": "bytes" }
    ]
  }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "pure"
}, {
  "type": "function",
  "name": "initializeWithMultiplexer",
  "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
    "name": "configId",
    "type": "bytes32",
    "internalType": "bytes32"
  }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "supportsInterface",
  "inputs": [{ "name": "interfaceId", "type": "bytes4", "internalType": "bytes4" }],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "pure"
}, {
  "type": "event",
  "name": "PolicySet",
  "inputs": [{ "name": "id", "type": "bytes32", "indexed": false, "internalType": "bytes32" }, {
    "name": "multiplexer",
    "type": "address",
    "indexed": false,
    "internalType": "address"
  }, { "name": "account", "type": "address", "indexed": false, "internalType": "address" }],
  "anonymous": false
}, {
  "type": "error",
  "name": "PolicyNotInitialized",
  "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "multiplexer",
    "type": "address",
    "internalType": "address"
  }, { "name": "account", "type": "address", "internalType": "address" }]
}] as const

/**
 * Version 1 of Namera's `GasPolicy` contract (`namera.gas-policy.v1`): its ABI, CREATE2 address and
 * the record of every chain it is deployed on.
 *
 * **Details**
 *
 * The address commits to the salt `keccak256(label)` and to the initcode built with solc
 * 0.8.38+commit.1835d247 for `cancun` (200 optimizer runs, legacy pipeline), so it is the same on
 * every chain.
 *
 * @stability experimental
 * @category contracts
 * @since 0.1.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.gas-policy.v1",
  "address": "0xA92aA3abdA11A96d4fF853c78C489De1a1c6E1de",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xb4a95aa6e40f2775220b21973b7e748b73066ccafe9cccdeee536d0b653f5902",
  "initcodeHash": "0xccfb13d6f267f1cb9eeca284b5905e79da62a38a2643976dc65a7dce526316ed",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": false },
  "abi": abiV1,
  "deployments": {}
}
