/**
 * ABI of Namera's `ECDSASessionValidator` contract, generated from the Foundry build.
 *
 * @stability experimental
 * @category abis
 * @since 0.1.0
 */
export const ecdsaSessionValidatorAbi = [
  {
    type: "function",
    name: "isModuleType",
    inputs: [{ name: "moduleTypeId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "validateSignatureWithData",
    inputs: [
      { name: "hash", type: "bytes32", internalType: "bytes32" },
      { name: "signature", type: "bytes", internalType: "bytes" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
] as const;
