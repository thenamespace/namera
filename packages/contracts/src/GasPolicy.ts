import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `GasPolicy` contract (`namera.gas-policy.v1`): `v1.abi`,
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
  "name": "cost",
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
  }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "pure"
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
 * The CREATE2 address of version 1 of Namera's `GasPolicy` contract (`namera.gas-policy.v1`), the
 * same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0xd6eF0526A1Ad1Eb404C442D6355314A5587E78f6" as const

/**
 * The record of every chain version 1 of Namera's `GasPolicy` contract (`namera.gas-policy.v1`) is
 * deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x359edc512b16956c4e1fb34abc9616c92f3e070c499512fb03a4c1d12b033141",
    "transactionHash": "0x295417e4800e33a17737fd86110020e1cad29d133b3cacdb00450f9dc334021a",
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
    "runtimeCodeHash": "0x359edc512b16956c4e1fb34abc9616c92f3e070c499512fb03a4c1d12b033141",
    "transactionHash": "0x825f9c13f34c92cedaf6ee28f75dd8bebc52ee59e158773bfa6d3468e69e422c",
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
    "runtimeCodeHash": "0x359edc512b16956c4e1fb34abc9616c92f3e070c499512fb03a4c1d12b033141",
    "transactionHash": "0x941299192c2f898a140d7dd9be44629cbc61d9bb6a6d619f644def8964d75e91",
    "blockNumber": /* @__PURE__ */ BigInt("332385660"),
    "blockHash": "0x22fa35a4e37be41b4a83c95947b060ff9befbac95bcb1fbc54761a50ad7220a1",
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
    "runtimeCodeHash": "0x359edc512b16956c4e1fb34abc9616c92f3e070c499512fb03a4c1d12b033141",
    "transactionHash": "0xf999b5f0ddc2321ff94efa6cf3d2c6c7f40567ae4279dd0f2f2a2763817e0e1c",
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
    "runtimeCodeHash": "0x359edc512b16956c4e1fb34abc9616c92f3e070c499512fb03a4c1d12b033141",
    "transactionHash": "0x435a8ade0e37befb140acd6642489d9d3957b3c024733cf796c64b5cded1bc7e",
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
 * Version 1 of Namera's `GasPolicy` contract (`namera.gas-policy.v1`): its ABI, CREATE2 address and
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
  "label": "namera.gas-policy.v1",
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xb4a95aa6e40f2775220b21973b7e748b73066ccafe9cccdeee536d0b653f5902",
  "initcodeHash": "0xd2fedd2219358e1d914e0481e640e1faea2f01c828bdc42797e612ef79ecc4bc",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
