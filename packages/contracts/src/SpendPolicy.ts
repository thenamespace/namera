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
  "name": "InvalidLimit",
  "inputs": [{ "name": "index", "type": "uint256", "internalType": "uint256" }]
}, {
  "type": "error",
  "name": "PolicyNotInitialized",
  "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "multiplexer",
    "type": "address",
    "internalType": "address"
  }, { "name": "account", "type": "address", "internalType": "address" }]
}, {
  "type": "error",
  "name": "UnsupportedCallType",
  "inputs": [{ "name": "callType", "type": "bytes1", "internalType": "bytes1" }]
}] as const

/**
 * Version 1 of Namera's `SpendPolicy` contract (`namera.spend-policy.v1`): its ABI, CREATE2 address
 * and the record of every chain it is deployed on.
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
  "label": "namera.spend-policy.v1",
  "address": "0x9F61409D6fc9781774E3a0Baa32E090b1298e099",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x28b0cb2517c65f50fd17c1326d07d9b52a972500e7da985e66b6b75fed311154",
  "initcodeHash": "0x177726ba102ec5d99d0da918d3dd6e7bbf6c2c7a636c746fda2c746a833c1395",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": false },
  "abi": abiV1,
  "deployments": {}
}
