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
    84532: {
      "runtimeCodeHash": "0x385d0b8465d39b75616f6d984e62ae0890cde95cfc914a88cea9d6bb485d0dcd",
      "transactionHash": "0x3bfae6ae98bea5199f138fae79b4c82329447d1c649469e16ae2889d4bedd9ec",
      "blockNumber": BigInt("63034690"),
      "blockHash": "0x6a68d82d69e524ee8e0ce5613d9a50d6d55c3a0177c79ea3033ef708daf1af32",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "8b58046d8c19a3ef51603cb14140ffe8a4aa9061",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    }
  }
}
