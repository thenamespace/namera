import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "check1271SignedAction",
  "inputs": [
    { "name": "id", "type": "bytes32", "internalType": "bytes32" },
    { "name": "requestSender", "type": "address", "internalType": "address" },
    { "name": "account", "type": "address", "internalType": "address" },
    { "name": "", "type": "bytes32", "internalType": "bytes32" },
    { "name": "", "type": "bytes", "internalType": "bytes" }
  ],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "view"
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
 * Version 1 of Namera's `SignaturePolicy` contract (`namera.signature-policy.v1`): its ABI, CREATE2
 * address and the record of every chain it is deployed on.
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
  "label": "namera.signature-policy.v1",
  "address": "0x7d929540d7f015F5aa05785d4a9d83BE51E069D3",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xce8fc58e444ee82a57b0a35d3bc9e5ee2a6a356cfbf0270a0e9c48a86cf7e6de",
  "initcodeHash": "0x8482f00ac5ca6d2589d1b264c30e738f2748b8818d7225402f5f58b839686f9c",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": false },
  "abi": abiV1,
  "deployments": {}
}
