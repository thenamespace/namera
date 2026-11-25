import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `SessionHook` contract (`namera.session-hook.v1`): `v1.abi`,
 * exported on its own so a bundler keeps only what is imported.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const abiV1 = [
  {
    "type": "function",
    "name": "MAX_EXECUTION_POLICIES",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "TAG",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
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
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "configId",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "bytes32"
    }],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "getExecutionPolicies",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "bytes32"
    }],
    "outputs": [{ "name": "policies", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSmartSession",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initializeWithMultiplexer",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "sessionConfigId",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isInitialized",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isModuleType",
    "inputs": [{ "name": "moduleTypeId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "onInstall",
    "inputs": [{ "name": "data", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onUninstall",
    "inputs": [{ "name": "", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "policyConfigId",
    "inputs": [{ "name": "sessionConfigId", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "index",
      "type": "uint256",
      "internalType": "uint256"
    }],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "postCheck",
    "inputs": [{ "name": "context", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "preCheck",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }, {
      "name": "",
      "type": "uint256",
      "internalType": "uint256"
    }, { "name": "msgData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [{ "name": "context", "type": "bytes", "internalType": "bytes" }],
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
    "type": "function",
    "name": "tag",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "bytes", "internalType": "bytes" }],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "ExecutionPoliciesSet",
    "inputs": [{ "name": "account", "type": "address", "indexed": true, "internalType": "address" }, {
      "name": "configId",
      "type": "bytes32",
      "indexed": true,
      "internalType": "bytes32"
    }, { "name": "policies", "type": "address[]", "indexed": false, "internalType": "address[]" }],
    "anonymous": false
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
    "type": "event",
    "name": "SessionHookInstalled",
    "inputs": [{ "name": "account", "type": "address", "indexed": true, "internalType": "address" }, {
      "name": "smartSession",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionHookUninstalled",
    "inputs": [{ "name": "account", "type": "address", "indexed": true, "internalType": "address" }],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ExecutionPolicyViolation",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "policy",
      "type": "address",
      "internalType": "address"
    }, { "name": "reason", "type": "bytes", "internalType": "bytes" }]
  },
  {
    "type": "error",
    "name": "InvalidContext",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "InvalidInstall", "inputs": [] },
  {
    "type": "error",
    "name": "NotExecutionPolicy",
    "inputs": [{ "name": "policy", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OnlySmartSession",
    "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PermissionNotEnabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "bytes32" }]
  },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ReentrantCheck",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "SessionHookNotInstalled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "TooManyExecutionPolicies",
    "inputs": [{ "name": "count", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "UnsupportedAccount",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  }
] as const

/**
 * The error fragments of `abiV1`, in ABI order: what decoding a revert needs, without the rest of
 * the ABI.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const errorsV1 = [
  {
    "type": "error",
    "name": "ExecutionPolicyViolation",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "policy",
      "type": "address",
      "internalType": "address"
    }, { "name": "reason", "type": "bytes", "internalType": "bytes" }]
  },
  {
    "type": "error",
    "name": "InvalidContext",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "InvalidInstall", "inputs": [] },
  {
    "type": "error",
    "name": "NotExecutionPolicy",
    "inputs": [{ "name": "policy", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OnlySmartSession",
    "inputs": [{ "name": "caller", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "PermissionNotEnabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "bytes32" }]
  },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ReentrantCheck",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "SessionHookNotInstalled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "TooManyExecutionPolicies",
    "inputs": [{ "name": "count", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "UnsupportedAccount",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  }
] as const

/**
 * The CREATE2 address of version 1 of Namera's `SessionHook` contract (`namera.session-hook.v1`),
 * the same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0xC4a0D4dB5F4f51E19F4D164389Dbdd35c9743519" as const

/**
 * The record of every chain version 1 of Namera's `SessionHook` contract (`namera.session-hook.v1`)
 * is deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x5a96158d6cdf7bb1709ae5b67f9427196e40d8c36a5e082d4aabbd469bfd3d5c",
    "transactionHash": "0x8922d28b8fe6c3263f321f509d4a10df0249102aa1860a25fde127714095018b",
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
    "runtimeCodeHash": "0x5a96158d6cdf7bb1709ae5b67f9427196e40d8c36a5e082d4aabbd469bfd3d5c",
    "transactionHash": "0xc8976b34867740082ce8c4ea1d5b6ed02feb81e3c44d299eb1821b0c4908f064",
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
    "runtimeCodeHash": "0x5a96158d6cdf7bb1709ae5b67f9427196e40d8c36a5e082d4aabbd469bfd3d5c",
    "transactionHash": "0x050f59c6e970a9b8fa4295915deea658d182099c88b553296a11dde4881525fa",
    "blockNumber": /* @__PURE__ */ BigInt("332385637"),
    "blockHash": "0xca02ceca3f628a7cc410110783b9dfeda60e4c9ba52174257e115bfa0fe04ee6",
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
    "runtimeCodeHash": "0x5a96158d6cdf7bb1709ae5b67f9427196e40d8c36a5e082d4aabbd469bfd3d5c",
    "transactionHash": "0x9ef797ae5dc148f8042b26abce238aeb1dc69c074a003ae16ee53fb5e0b6178f",
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
    "runtimeCodeHash": "0x5a96158d6cdf7bb1709ae5b67f9427196e40d8c36a5e082d4aabbd469bfd3d5c",
    "transactionHash": "0x321a3ed5f108323320ccbdd60b43b23c7ece7f76cbb0db88541d31b49a9dd686",
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
 * Version 1 of Namera's `SessionHook` contract (`namera.session-hook.v1`): its ABI, CREATE2 address
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
  "label": "namera.session-hook.v1",
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xecc31949170d266f6a92e1bddbb52b24cfe72376b7ad77cf3a90f87480d3af24",
  "initcodeHash": "0xd85fd4426de7a8e83e7babebd21cea7bd56558ba2f4a37cf3a659d533c44427d",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
