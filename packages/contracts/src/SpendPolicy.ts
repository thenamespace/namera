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
  "type": "function",
  "name": "usage",
  "inputs": [
    { "name": "configId", "type": "bytes32", "internalType": "bytes32" },
    { "name": "multiplexer", "type": "address", "internalType": "address" },
    { "name": "account", "type": "address", "internalType": "address" },
    { "name": "tag", "type": "bytes32", "internalType": "bytes32" },
    { "name": "period", "type": "uint256", "internalType": "uint256" },
    { "name": "time", "type": "uint256", "internalType": "uint256" }
  ],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view"
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
 * 0.8.38+commit.1835d247 for `cancun` (200 optimizer runs, via-IR), so it is the same on every
 * chain.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.spend-policy.v1",
  "address": "0x45b08000232314C38e3cF0a86A939B6ABcE50658",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x28b0cb2517c65f50fd17c1326d07d9b52a972500e7da985e66b6b75fed311154",
  "initcodeHash": "0x3237135f6c77699f72dbdc7eaa8db0406429960e6e52fd07dbee3f36cfd57fbd",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    84532: {
      "runtimeCodeHash": "0xc27f5d3ae79c66e3bdc475d22d569b2b7d1fc3ed988caf589c630e369e8c5c8b",
      "transactionHash": "0xb0bcceb571d96806b03d2f535462923f43d805612948291601f1c9a0de4322ec",
      "blockNumber": BigInt("63034690"),
      "blockHash": "0x6a68d82d69e524ee8e0ce5613d9a50d6d55c3a0177c79ea3033ef708daf1af32",
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
