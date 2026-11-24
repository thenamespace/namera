import type * as Contract from "./Contract.ts"

const abiV1 = [
  {
    "type": "function",
    "name": "check1271SignedAction",
    "inputs": [
      { "name": "id", "type": "bytes32", "internalType": "bytes32" },
      { "name": "requestSender", "type": "address", "internalType": "address" },
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "", "type": "bytes32", "internalType": "bytes32" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "check1271TypedData",
    "inputs": [
      { "name": "id", "type": "bytes32", "internalType": "bytes32" },
      { "name": "requestSender", "type": "address", "internalType": "address" },
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" },
      { "name": "contentsData", "type": "bytes", "internalType": "bytes" },
      { "name": "", "type": "bytes", "internalType": "bytes" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initializeWithMultiplexer",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "configId",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "initData", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
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
    "type": "error",
    "name": "InvalidFieldRule",
    "inputs": [{ "name": "typeIndex", "type": "uint256", "internalType": "uint256" }, {
      "name": "ruleIndex",
      "type": "uint256",
      "internalType": "uint256"
    }]
  },
  { "type": "error", "name": "NoVerifiers", "inputs": [] },
  {
    "type": "error",
    "name": "PolicyNotInitialized",
    "inputs": [{ "name": "id", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "multiplexer",
      "type": "address",
      "internalType": "address"
    }, { "name": "account", "type": "address", "internalType": "address" }]
  }
] as const

/**
 * Version 1 of Namera's `SignaturePolicy` contract (`namera.signature-policy.v1`): its ABI, CREATE2
 * address and the record of every chain it is deployed on.
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
  "label": "namera.signature-policy.v1",
  "address": "0x25DAEFfbe1e99Ed50098C5228ecA59961f62d519",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xce8fc58e444ee82a57b0a35d3bc9e5ee2a6a356cfbf0270a0e9c48a86cf7e6de",
  "initcodeHash": "0xda1dc8a0517b4ff614950f6e88da84c2268eb32c547f6b8cb5e5531dc80a6a44",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    8453: {
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "transactionHash": "0x5834e9e630d72b3362d292f6559234e76efe35f6d948936a7b392b2289459063",
      "blockNumber": BigInt("61800554"),
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
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    421614: {
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "transactionHash": "0x994d6b9a4bae47304d99f183d0675c5ae3598ee4b715c7386c359c60c1500d23",
      "blockNumber": BigInt("332385668"),
      "blockHash": "0x2a5533af6d3a21facedd6aa64e9dd6f0302ed01f6f70656384c5cf82647cc887",
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
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "transactionHash": "0x22867f35c644e34ba222616203b1a6e24c4ed71e8b254ed989a821cd5e5d8dae",
      "blockNumber": BigInt("12204736"),
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
      "runtimeCodeHash": "0x51ff49cc1e093b3a65034813c68a7d2ac1432136c270ae4b05cf8b880d19ab87",
      "transactionHash": "0x13505b06711ea540f7b5606d1dbba132e60872228e200ddaf19c788c40dba7b2",
      "blockNumber": BigInt("51873769"),
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
}
