import type * as Contract from "./Contract.ts"

const abiV1 = [{
  "type": "function",
  "name": "isModuleType",
  "inputs": [{ "name": "moduleTypeId", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
  "stateMutability": "pure"
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
}] as const

/**
 * Version 1 of Namera's `ECDSASessionValidator` contract (`namera.ecdsa-session-validator.v1`): its
 * ABI, CREATE2 address and the record of every chain it is deployed on.
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
  "label": "namera.ecdsa-session-validator.v1",
  "address": "0xee0a318cE5B01D2867a90fc216890Ab96cA6490F",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x317181fa593b3ec3fd5cba008d6b64516fa33ab19626ca9e69977b90381a8172",
  "initcodeHash": "0x7e5aec007bb7a84b6a46b71ed3866ef9d28056d598bcd10b7e6a14f12d0c7911",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    8453: {
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "transactionHash": "0x2b8684d9b15d444132739238c72f93032b776151bcfe388a21478f5ed64037bd",
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
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    421614: {
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "transactionHash": "0xfb7477f9ef9b26388ae1b3d054e822fe417c28dfe1ca777f8a1c2f84a0384cb9",
      "blockNumber": BigInt("332385627"),
      "blockHash": "0xb5e2c7c9ca61ded8ad729ca2398f1d99c9c4da12355e0c6e4ef527c66f543acb",
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
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "transactionHash": "0xa139b16e1ea3024ffb2f479dbe8151e698f8370af029b10ed40894e84066d978",
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
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "transactionHash": "0x9978f75a1e0e3df5903ac8b96c4219c36de8101def9e2e0732f596aa191cec1d",
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
