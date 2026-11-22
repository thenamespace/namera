import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "checkAction",
  "inputs": [
    { "name": "id", "type": "bytes32", "internalType": "bytes32" },
    { "name": "account", "type": "address", "internalType": "address" },
    { "name": "", "type": "address", "internalType": "address" },
    { "name": "", "type": "uint256", "internalType": "uint256" },
    { "name": "data", "type": "bytes", "internalType": "bytes" }
  ],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
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
 * Version 1 of Namera's `ApprovalPolicy` contract (`namera.approval-policy.v1`): its ABI, CREATE2
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
  "label": "namera.approval-policy.v1",
  "address": "0x88762DEcb9cCf7b567aE4e0D441B9B58A779871a",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x2db51a453faf429ee58c1081555990b0dec71ca173a8a25f8e167959ede95a14",
  "initcodeHash": "0xbab521f7415034ed67de7477a815d5465575bbacb0da058c03e8ed26f7f7a76d",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": false },
  "abi": abiV1,
  "deployments": {}
}
