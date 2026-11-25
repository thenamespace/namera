import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `WebAuthnValidator` contract (`namera.webauthn-validator.v1`):
 * `v1.abi`, exported on its own so a bundler keeps only what is imported.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const abiV1 = [{
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
 * The error fragments of `abiV1`, in ABI order: what decoding a revert needs, without the rest of
 * the ABI.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const errorsV1 = [{
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
 * The CREATE2 address of version 1 of Namera's `WebAuthnValidator` contract
 * (`namera.webauthn-validator.v1`), the same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0x2E041Cf8D0374D339EBaa86774baEEA36Af241a0" as const

/**
 * The record of every chain version 1 of Namera's `WebAuthnValidator` contract
 * (`namera.webauthn-validator.v1`) is deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x7f38e0f43f7dcea268d66c1f0da6196fc6f10cd46d4deab07fffb3229a6cf874",
    "transactionHash": "0xc41cdc6092f3439cf630314cc1b48626ebcc7054aee5bf1ddc0b2a68c2509957",
    "blockNumber": /* @__PURE__ */ BigInt("61800554"),
    "blockHash": "0xe6c388e40301a4db133c8214e8f607f6eb0969ce92f1af062c5eb3d61d3fa019",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 10000,
      "viaIR": true
    }
  },
  84532: {
    "runtimeCodeHash": "0x958c5e20e85c961dff12912f7d2f0cfb514c9bd7966b0f63477dc89832a1f580",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 10000,
      "viaIR": true
    }
  },
  421614: {
    "runtimeCodeHash": "0xd9bb1d16f2a4e0c8a30b6fa89944cda5a4cbe3506ea8a06d38ab4a669d466de6",
    "transactionHash": "0x7b47875ef8e9a483e66a2642e599ecad200dd5aae95489ecd478c1e2a6c6973a",
    "blockNumber": /* @__PURE__ */ BigInt("332385633"),
    "blockHash": "0x4111dca506f35beecb71adb7451c5381971de900a4f204763bd88b4f016d05fd",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 10000,
      "viaIR": true
    }
  },
  11155111: {
    "runtimeCodeHash": "0xc9d417234afb7dbcfcb3c7715e889e6a5cfe3b32c2464c14d82821fb87839d3f",
    "transactionHash": "0x21f53e32f3b7f3cb90915d88197de7d97fe6048a2c953bfc5feda996e4928a42",
    "blockNumber": /* @__PURE__ */ BigInt("12204736"),
    "blockHash": "0xd7caf178dd4d80e07a0cc19c2c366b932059983d3456bc317f88a136e2a8c4c8",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 10000,
      "viaIR": true
    }
  },
  11155420: {
    "runtimeCodeHash": "0xed58d81c179037e39a3429c0d0e630301023ae45ba091b40e8c3f8cca12b6653",
    "transactionHash": "0x35b1862bf54a29f7c43f67162376aed035ad60bfbd582612f0b7fe049086419b",
    "blockNumber": /* @__PURE__ */ BigInt("51873769"),
    "blockHash": "0xdf4cfcc9422a6c731c8bcfd676ab4fe5bb7a367ad99640020cf913b6e757570b",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 10000,
      "viaIR": true
    }
  }
}

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
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xd3862f8da90336198b92a577df9783ac4b76197d2d8012e294e9305ac2dc45bf",
  "initcodeHash": "0xd8941403e412e1270fd7d52da1cf861834973cd35d7150ffdd0d50ce27a73a9f",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 10000, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
