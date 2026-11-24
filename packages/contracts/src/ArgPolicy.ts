import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "VALUE",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "checkAction",
  "inputs": [
    { "name": "id", "type": "bytes32", "internalType": "bytes32" },
    { "name": "account", "type": "address", "internalType": "address" },
    { "name": "", "type": "address", "internalType": "address" },
    { "name": "value", "type": "uint256", "internalType": "uint256" },
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
  "name": "InvalidRule",
  "inputs": [{ "name": "index", "type": "uint256", "internalType": "uint256" }]
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
 * Version 1 of Namera's `ArgPolicy` contract (`namera.arg-policy.v1`): its ABI, CREATE2 address and
 * the record of every chain it is deployed on.
 *
 * **Details**
 *
 * The address commits to the salt `keccak256(label)` and to the initcode built with solc
 * 0.8.38+commit.1835d247 for `cancun` (200 optimizer runs, via-IR), so it is the same on every
 * chain.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.arg-policy.v1",
  "address": "0x8E3607918B495D93727196a6B2ab9517656169f3",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x86cb2fca3452e08063e76eb7505a593ec49ba9782e895c8844f3628349e4fbf4",
  "initcodeHash": "0x08f0787d4f476dab27f0f342aec954c3e721f5defc90a9b0f0677043ae1da1cf",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {}
}
