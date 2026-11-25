import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `RateLimitPolicy` contract (`namera.rate-limit-policy.v1`):
 * `v1.abi`, exported on its own so a bundler keeps only what is imported.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const abiV1 = [{
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
}] as const

/**
 * The CREATE2 address of version 1 of Namera's `RateLimitPolicy` contract
 * (`namera.rate-limit-policy.v1`), the same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0xb0DCFE056023Cc5b4B7f9fCe2BCC5EAffA8110dC" as const

/**
 * The record of every chain version 1 of Namera's `RateLimitPolicy` contract
 * (`namera.rate-limit-policy.v1`) is deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x236d80459bdd2b92ae621789b44f1e92e0a22c49d7fe5317c0cc547465fee8f7",
    "transactionHash": "0x08ca9ff15fbb62a77fef9e1ca312bdcba1aaf824c51af576eef960def3776a95",
    "blockNumber": /* @__PURE__ */ BigInt("61800554"),
    "blockHash": "0xe6c388e40301a4db133c8214e8f607f6eb0969ce92f1af062c5eb3d61d3fa019",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 200,
      "viaIR": true
    }
  },
  84532: {
    "runtimeCodeHash": "0x236d80459bdd2b92ae621789b44f1e92e0a22c49d7fe5317c0cc547465fee8f7",
    "transactionHash": "0x3c1bb4baed4c1b260eb1be4ea4dceb898d163c703cae7e30b3df1561e31b2015",
    "blockNumber": /* @__PURE__ */ BigInt("63140057"),
    "blockHash": "0xc1ebd326d4a6ed150f52080b8a6c9b2146541f57c446188fa2de86f4236179b1",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 200,
      "viaIR": true
    }
  },
  421614: {
    "runtimeCodeHash": "0x236d80459bdd2b92ae621789b44f1e92e0a22c49d7fe5317c0cc547465fee8f7",
    "transactionHash": "0x49fcfeea061b562afc40f9cb0f0dcbe9fedc110ac289054561d272939879e9bb",
    "blockNumber": /* @__PURE__ */ BigInt("332385657"),
    "blockHash": "0x3234c0fd498d8a7fd77b1e2cf5440dba9dc5f5d883ccdac784c7f2e2ece70272",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 200,
      "viaIR": true
    }
  },
  11155111: {
    "runtimeCodeHash": "0x236d80459bdd2b92ae621789b44f1e92e0a22c49d7fe5317c0cc547465fee8f7",
    "transactionHash": "0x252e56dfb29d8a87e1ad00c16f80b42570cacdfb5e8990041dab45e125902be5",
    "blockNumber": /* @__PURE__ */ BigInt("12204736"),
    "blockHash": "0xd7caf178dd4d80e07a0cc19c2c366b932059983d3456bc317f88a136e2a8c4c8",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 200,
      "viaIR": true
    }
  },
  11155420: {
    "runtimeCodeHash": "0x236d80459bdd2b92ae621789b44f1e92e0a22c49d7fe5317c0cc547465fee8f7",
    "transactionHash": "0xdc04fa6c2ef9f4fb1192c6dd9a37344514823913e50e5ca01d91b11cf7b2ff15",
    "blockNumber": /* @__PURE__ */ BigInt("51873769"),
    "blockHash": "0xdf4cfcc9422a6c731c8bcfd676ab4fe5bb7a367ad99640020cf913b6e757570b",
    "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
    "source": {
      "commit": "34564781592a433d7fea777752d8c0854b5aed55",
      "compiler": "0.8.38+commit.1835d247",
      "evmVersion": "cancun",
      "optimizerRuns": 200,
      "viaIR": true
    }
  }
}

/**
 * Version 1 of Namera's `RateLimitPolicy` contract (`namera.rate-limit-policy.v1`): its ABI,
 * CREATE2 address and the record of every chain it is deployed on.
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
  "label": "namera.rate-limit-policy.v1",
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xdbd0569b0e7e44b8c6b608bf1feed56dfd06157b869d84a31f4c4a93a30fffa4",
  "initcodeHash": "0xfafc523d5ee4862be2c6d33d1b82644e19cc5db3b68a8b34cdfdaa76f4a4e5c5",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
