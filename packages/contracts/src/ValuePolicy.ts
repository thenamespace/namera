import type * as Contract from "./Contract.ts"

/**
 * The ABI of version 1 of Namera's `ValuePolicy` contract (`namera.value-policy.v1`): `v1.abi`,
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
 * The CREATE2 address of version 1 of Namera's `ValuePolicy` contract (`namera.value-policy.v1`),
 * the same on every chain: `v1.address`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const addressV1 = "0xAa695DFe4370EEa38bf1c0a0b39aF1E885a5bEa3" as const

/**
 * The record of every chain version 1 of Namera's `ValuePolicy` contract (`namera.value-policy.v1`)
 * is deployed on, keyed by chain id: `v1.deployments`.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const deploymentsV1: Contract.Version<typeof abiV1>["deployments"] = {
  8453: {
    "runtimeCodeHash": "0x61e6037bc8f1b36b2163d862f572c14cd2b0582b9e96ad219afe4f69ed4202b8",
    "transactionHash": "0x897ee78b2ac2c8e7ce779463b87cde45040de601cec0fc772c882e360f8ae6bd",
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
    "runtimeCodeHash": "0x61e6037bc8f1b36b2163d862f572c14cd2b0582b9e96ad219afe4f69ed4202b8",
    "transactionHash": "0xda6259659d66398def0438eaae4702c396d7f473740e793d0f286f4a2b340bd2",
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
    "runtimeCodeHash": "0x61e6037bc8f1b36b2163d862f572c14cd2b0582b9e96ad219afe4f69ed4202b8",
    "transactionHash": "0x7b62b97052b937196266f7a409ccdc86633d13b8ac6b5a3ad77ae9ed5b080d64",
    "blockNumber": /* @__PURE__ */ BigInt("332385653"),
    "blockHash": "0xe141d36ddd367afdd166625110c3ec1ecc867e784e98d7c1eea009ce1aa2c05e",
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
    "runtimeCodeHash": "0x61e6037bc8f1b36b2163d862f572c14cd2b0582b9e96ad219afe4f69ed4202b8",
    "transactionHash": "0xf1df57d4f82da145c953cc8503eba70c9a20398442fb1a5c90cfffdbf404fd1d",
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
    "runtimeCodeHash": "0x61e6037bc8f1b36b2163d862f572c14cd2b0582b9e96ad219afe4f69ed4202b8",
    "transactionHash": "0xb2c7a91586cf74e001e259f67105aa5cdb9d7ad042674b2d38c7edf6ccd33b9d",
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
  "address": addressV1,
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x9bad4ebaeb715215ff6a7c2a57fde4acfe56bac9f9e8b6b227eeab6130ca3f40",
  "initcodeHash": "0x50c667998eee0c5218f298e74395e780cb092d4e9051c60a96d6ca4371806db2",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": deploymentsV1
}
