import type * as Contract from "./Contract.ts"

const abiV1 = [
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
  "address": "0x3367e433495e2647ceC24f284131d0d73C4a0EE1",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xecc31949170d266f6a92e1bddbb52b24cfe72376b7ad77cf3a90f87480d3af24",
  "initcodeHash": "0xe76461b36618395bb168efc68edd859b365c516227673aab9ff8f10fd854cd0c",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {}
}
