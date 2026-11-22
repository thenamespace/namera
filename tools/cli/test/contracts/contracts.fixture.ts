import { String as Str } from "effect"

import { getContractAddress, type Hex, keccak256, stringToHex } from "viem"

import { type BuiltContract, factory } from "@namera-ai/tools/contracts/workspace"

export const initcode: Hex = "0x6080604052348015600e575f5ffd5b50"

export const runtimeCode: Hex = "0x6080604052"

const salt = keccak256(stringToHex("namera.example.v1"))

export const contract = {
  label: "namera.example.v1",
  initcode,
  artifact: "Example.sol:Example",
  contract: "Example",
  version: 1,
  abi: [{ type: "function", name: "ping", inputs: [], outputs: [], stateMutability: "view" }],
  salt,
  initcodeHash: keccak256(initcode),
  address: getContractAddress({
    opcode: "CREATE2",
    from: factory,
    salt,
    bytecodeHash: keccak256(initcode)
  }),
  compiler: {
    compiler: "0.8.38+commit.1835d247",
    evmVersion: "cancun",
    optimizerRuns: 200,
    viaIR: false
  }
} satisfies BuiltContract

export const transaction = {
  transactionHash: `0x${Str.repeat(32)("ab")}`,
  blockNumber: 1234,
  blockHash: `0x${Str.repeat(32)("cd")}`,
  deployer: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1F38"
} as const

export const external = {
  kernel: {
    description: "ZeroDev's Kernel smart account.",
    versions: { "3.3": { factory: "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9" } }
  }
} as const
