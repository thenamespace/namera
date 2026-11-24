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
 * Version 1 of Namera's `ValuePolicy` contract (`namera.value-policy.v1`): its ABI, CREATE2 address
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
  "label": "namera.value-policy.v1",
  "address": "0x98286E6568D03dC8EeFF9664E2F8B9e632e5CFF2",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x9bad4ebaeb715215ff6a7c2a57fde4acfe56bac9f9e8b6b227eeab6130ca3f40",
  "initcodeHash": "0x7b45bc6a8193c63e23dac1440f7fbdbc5f75992dff0eca8984932ef96df95edf",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    84532: {
      "runtimeCodeHash": "0xe0f02c9f058ec4c61e51677317e9c8a24ac9275035d7c45b953273152f416cb4",
      "transactionHash": "0xae8f959e008c6a2680a9daf474f6d6f9ced55ec2c0856557ffaf78378443070f",
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
