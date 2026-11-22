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
 * 0.8.38+commit.1835d247 for `cancun` (200 optimizer runs, legacy pipeline), so it is the same on
 * every chain.
 *
 * @stability experimental
 * @category contracts
 * @since 0.1.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.ecdsa-session-validator.v1",
  "address": "0xc0bB929AF162F26ffC5854e67F0D613B6Ba6B662",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0x317181fa593b3ec3fd5cba008d6b64516fa33ab19626ca9e69977b90381a8172",
  "initcodeHash": "0x13cce3eb9627bc613c0724e061d1fb81c0c14257034c02239f1fd7d2bf4beeea",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": false },
  "abi": abiV1,
  "deployments": {}
}
