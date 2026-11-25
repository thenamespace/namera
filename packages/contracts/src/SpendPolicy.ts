import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `SpendPolicy` contract (`namera.spend-policy.v1`): `v1.abi`,
 * exported on its own so a bundler keeps only what is imported.
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
}, {
  "type": "error",
  "name": "UnsupportedCallType",
  "inputs": [{ "name": "callType", "type": "bytes1", "internalType": "bytes1" }]
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
}, {
  "type": "error",
  "name": "UnsupportedCallType",
  "inputs": [{ "name": "callType", "type": "bytes1", "internalType": "bytes1" }]
}] as const

/**
 * The CREATE2 address of version 1 of Namera's `SpendPolicy` contract (`namera.spend-policy.v1`),
 * the same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0x0D522cc69D8c6bFE5187FC804adD7CD9238A94E7" as const

/**
 * The record of every chain version 1 of Namera's `SpendPolicy` contract (`namera.spend-policy.v1`)
 * is deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x0ea9726e9626a5432e5967b4325bf0dff51c6b45f7ed792dfce78598aab72387",
    "transactionHash": "0xa372549a394af9710204d9995f3e9d9449e77c25428a8298eb43a1a3b6507b25",
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
    "runtimeCodeHash": "0x0ea9726e9626a5432e5967b4325bf0dff51c6b45f7ed792dfce78598aab72387",
    "transactionHash": "0x4b9891c76fd4afb187faa53535267d59abdc3be9f610d44a46231e15cca44f03",
    "blockNumber": /* @__PURE__ */ BigInt("63140054"),
    "blockHash": "0x8518e8e91d40e02fdb2daeab57a710629dc672e99ab3cbce9e6e7e98867dc9dd",
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
    "runtimeCodeHash": "0x0ea9726e9626a5432e5967b4325bf0dff51c6b45f7ed792dfce78598aab72387",
    "transactionHash": "0x4f9530094d22d23ca3cfe101c1c45a10624dfee704db1ae1c2317182c9d2ef45",
    "blockNumber": /* @__PURE__ */ BigInt("332385649"),
    "blockHash": "0xefc992145945c1d5af6369c1b279fdea689db57e8655c8fb71ddf7c000831b68",
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
    "runtimeCodeHash": "0x0ea9726e9626a5432e5967b4325bf0dff51c6b45f7ed792dfce78598aab72387",
    "transactionHash": "0x07d7217cdb3a89969bf8d58bc2c0330eb6db82ebdebd929d208dc194956cd72e",
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
    "runtimeCodeHash": "0x0ea9726e9626a5432e5967b4325bf0dff51c6b45f7ed792dfce78598aab72387",
    "transactionHash": "0xd6b572be25271405008622ac7f4fe50dc1f2eaf819cbf4a97831f90cfe4de795",
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
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x28b0cb2517c65f50fd17c1326d07d9b52a972500e7da985e66b6b75fed311154",
  "initcodeHash": "0x530a8b1b920e392b76092c8226971dac97ff2a98579d0d07f000ea4c0fb6af26",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
