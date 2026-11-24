import type * as Contract from "./Contract.ts"

const abiV1 = [
  {
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
  },
  {
    "type": "function",
    "name": "check1271TypedData",
    "inputs": [
      { "name": "id", "type": "bytes32", "internalType": "bytes32" },
      { "name": "requestSender", "type": "address", "internalType": "address" },
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" },
      { "name": "contentsData", "type": "bytes", "internalType": "bytes" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initializeWithMultiplexer",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "configId",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [{ "name": "interfaceId", "type": "bytes4", "internalType": "bytes4" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "PolicySet",
    "inputs": [{ "name": "id", "type": "bytes32", "indexed": false, "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "account", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "InvalidFieldRule",
    "inputs": [{ "name": "typeIndex", "type": "uint256", "internalType": "uint256" }, {
      "name": "ruleIndex",
      "type": "uint256",
      "internalType": "uint256"
    }]
  },
  { "type": "error", "name": "NoVerifiers", "inputs": [] },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  }
] as const

/**
 * Version 1 of Namera's `SignaturePolicy` contract (`namera.signature-policy.v1`): its ABI, CREATE2
 * address and the record of every chain it is deployed on.
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
  "label": "namera.signature-policy.v1",
  "address": "0x25DAEFfbe1e99Ed50098C5228ecA59961f62d519",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xce8fc58e444ee82a57b0a35d3bc9e5ee2a6a356cfbf0270a0e9c48a86cf7e6de",
  "initcodeHash": "0xda1dc8a0517b4ff614950f6e88da84c2268eb32c547f6b8cb5e5531dc80a6a44",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    84532: {
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "transactionHash": "0xb2662c37c9eecb20718c52769f13c697b95206f24cf2398e2546dcb332dc51fc",
      "blockNumber": BigInt("63034691"),
      "blockHash": "0x8ff4164a3c0da272e326ab5cac4f06b6cb1c3660cc6a315fce3057ffe86f379d",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "8b58046d8c19a3ef51603cb14140ffe8a4aa9061",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    }
  }
}
