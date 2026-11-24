import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "MAX_PASSKEYS",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "MULTICHAIN_TYPEHASH",
  "inputs": [],
  "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "REPLAY_SAFE_HASH_TYPEHASH",
  "inputs": [],
  "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "addPasskey",
  "inputs": [{
    "name": "passkey",
    "type": "tuple",
    "internalType": "struct WebAuthnAssertion.Passkey",
    "components": [
      { "name": "x", "type": "bytes32", "internalType": "bytes32" },
      { "name": "y", "type": "bytes32", "internalType": "bytes32" },
      { "name": "requireUserVerification", "type": "bool", "internalType": "bool" },
      { "name": "rpIdHash", "type": "bytes32", "internalType": "bytes32" }
    ]
  }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "credentialId",
  "inputs": [{ "name": "x", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "y",
    "type": "bytes32",
    "internalType": "bytes32"
  }],
  "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
  "stateMutability": "pure"
}, {
  "type": "function",
  "name": "eip712Domain",
  "inputs": [],
  "outputs": [
    { "name": "fields", "type": "bytes1", "internalType": "bytes1" },
    { "name": "name", "type": "string", "internalType": "string" },
    { "name": "version", "type": "string", "internalType": "string" },
    { "name": "chainId", "type": "uint256", "internalType": "uint256" },
    { "name": "verifyingContract", "type": "address", "internalType": "address" },
    { "name": "salt", "type": "bytes32", "internalType": "bytes32" },
    { "name": "extensions", "type": "uint256[]", "internalType": "uint256[]" }
  ],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "getPasskeys",
  "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
  "outputs": [{ "name": "threshold", "type": "uint256", "internalType": "uint256" }, {
    "name": "credentialIds",
    "type": "bytes32[]",
    "internalType": "bytes32[]"
  }, {
    "name": "passkeys",
    "type": "tuple[]",
    "internalType": "struct WebAuthnAssertion.Passkey[]",
    "components": [
      { "name": "x", "type": "bytes32", "internalType": "bytes32" },
      { "name": "y", "type": "bytes32", "internalType": "bytes32" },
      { "name": "requireUserVerification", "type": "bool", "internalType": "bool" },
      { "name": "rpIdHash", "type": "bytes32", "internalType": "bytes32" }
    ]
  }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "isInitialized",
  "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "isModuleType",
  "inputs": [{ "name": "moduleTypeId", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "pure"
}, {
  "type": "function",
  "name": "isValidSignatureWithSender",
  "inputs": [{ "name": "sender", "type": "address", "internalType": "address" }, {
    "name": "hash",
    "type": "bytes32",
    "internalType": "bytes32"
  }, { "name": "signature", "type": "bytes", "internalType": "bytes" }],
  "outputs": [{ "name": "", "type": "bytes4", "internalType": "bytes4" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "multichainChallenge",
  "inputs": [{ "name": "root", "type": "bytes32", "internalType": "bytes32" }],
  "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
  "stateMutability": "pure"
}, {
  "type": "function",
  "name": "onInstall",
  "inputs": [{ "name": "data", "type": "bytes", "internalType": "bytes" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "onUninstall",
  "inputs": [{ "name": "", "type": "bytes", "internalType": "bytes" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "removePasskey",
  "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "replaySafeHash",
  "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
    "name": "hash",
    "type": "bytes32",
    "internalType": "bytes32"
  }],
  "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "setThreshold",
  "inputs": [{ "name": "threshold", "type": "uint256", "internalType": "uint256" }],
  "outputs": [],
  "stateMutability": "nonpayable"
}, {
  "type": "function",
  "name": "validateSignatureWithData",
  "inputs": [{ "name": "hash", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "signature",
    "type": "bytes",
    "internalType": "bytes"
  }, { "name": "data", "type": "bytes", "internalType": "bytes" }],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "view"
}, {
  "type": "function",
  "name": "validateUserOp",
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
  }, { "name": "userOpHash", "type": "bytes32", "internalType": "bytes32" }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view"
}, {
  "type": "event",
  "name": "PasskeyAdded",
  "inputs": [
    { "name": "account", "type": "address", "indexed": true, "internalType": "address" },
    { "name": "credentialId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
    { "name": "x", "type": "bytes32", "indexed": false, "internalType": "bytes32" },
    { "name": "y", "type": "bytes32", "indexed": false, "internalType": "bytes32" }
  ],
  "anonymous": false
}, {
  "type": "event",
  "name": "PasskeyRemoved",
  "inputs": [{ "name": "account", "type": "address", "indexed": true, "internalType": "address" }, {
    "name": "credentialId",
    "type": "bytes32",
    "indexed": true,
    "internalType": "bytes32"
  }],
  "anonymous": false
}, {
  "type": "event",
  "name": "ThresholdSet",
  "inputs": [{ "name": "account", "type": "address", "indexed": true, "internalType": "address" }, {
    "name": "threshold",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
  }],
  "anonymous": false
}, {
  "type": "error",
  "name": "DuplicatePasskey",
  "inputs": [{ "name": "credentialId", "type": "bytes32", "internalType": "bytes32" }]
}, {
  "type": "error",
  "name": "InvalidPasskey",
  "inputs": [{ "name": "x", "type": "bytes32", "internalType": "bytes32" }, {
    "name": "y",
    "type": "bytes32",
    "internalType": "bytes32"
  }]
}, {
  "type": "error",
  "name": "InvalidThreshold",
  "inputs": [{ "name": "threshold", "type": "uint256", "internalType": "uint256" }, {
    "name": "count",
    "type": "uint256",
    "internalType": "uint256"
  }]
}, {
  "type": "error",
  "name": "NotInitialized",
  "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
}, {
  "type": "error",
  "name": "PasskeyNotFound",
  "inputs": [{ "name": "credentialId", "type": "bytes32", "internalType": "bytes32" }]
}, {
  "type": "error",
  "name": "TooManyPasskeys",
  "inputs": [{ "name": "max", "type": "uint256", "internalType": "uint256" }]
}] as const

/**
 * Version 1 of Namera's `WebAuthnValidator` contract (`namera.webauthn-validator.v1`): its ABI,
 * CREATE2 address and the record of every chain it is deployed on.
 *
 * **Details**
 *
 * The address commits to the salt `keccak256(label)` and to the initcode built with solc
 * 0.8.38+commit.1835d247 for `cancun` (10000 optimizer runs, via-IR), so it is the same on every
 * chain.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.webauthn-validator.v1",
  "address": "0x2E041Cf8D0374D339EBaa86774baEEA36Af241a0",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xd3862f8da90336198b92a577df9783ac4b76197d2d8012e294e9305ac2dc45bf",
  "initcodeHash": "0xd8941403e412e1270fd7d52da1cf861834973cd35d7150ffdd0d50ce27a73a9f",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 10000, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    84532: {
      "runtimeCodeHash": "0x958c5e20e85c961dff12912f7d2f0cfb514c9bd7966b0f63477dc89832a1f580",
      "transactionHash": "0xf99d54f2b3ec934ed5a13170f5269f1b98c31519f8d08cb7217bba226d010128",
      "blockNumber": BigInt("63034690"),
      "blockHash": "0x6a68d82d69e524ee8e0ce5613d9a50d6d55c3a0177c79ea3033ef708daf1af32",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "8b58046d8c19a3ef51603cb14140ffe8a4aa9061",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 10000,
        "viaIR": true
      }
    }
  }
}
