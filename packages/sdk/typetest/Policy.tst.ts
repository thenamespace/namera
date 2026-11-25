import { Policy } from "@namera-ai/sdk"
import { describe, expect, it } from "tstyche"

const abi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [{
      name: "params",
      type: "tuple",
      components: [
        { name: "tokenIn", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "amountIn", type: "uint256" },
        { name: "path", type: "bytes" }
      ]
    }],
    outputs: []
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "flag", type: "bool" }, { name: "delta", type: "int256" }, { name: "ids", type: "uint256[]" }],
    outputs: []
  }
] as const

const address = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"

describe("Policy.function", () => {
  it("infers argument conditions from a const ABI", () => {
    expect<Policy.ArgsOf<typeof abi, "exactInputSingle">>().type.toBe<{
      readonly params?: {
        readonly tokenIn?: Policy.Equality<`0x${string}`>
        readonly fee?: Policy.Condition<bigint>
        readonly amountIn?: Policy.Condition<bigint>
        readonly path?: never
      }
    }>()
    expect(Policy.function).type.toBeCallableWith({
      address,
      abi,
      functionName: "exactInputSingle",
      args: { params: { tokenIn: address, amountIn: { lte: 50n } } }
    })
  })

  it("refuses unknown functions, unknown arguments and conditions a word can't hold", () => {
    expect(Policy.function).type.not.toBeCallableWith({ address, abi, functionName: "swap" })
    expect(Policy.function).type.not.toBeCallableWith({
      address,
      abi,
      functionName: "exactInputSingle",
      args: { params: { recipient: address } }
    })
    expect(Policy.function).type.not.toBeCallableWith({
      address,
      abi,
      functionName: "exactInputSingle",
      args: { params: { tokenIn: { lte: address } } }
    })
    expect(Policy.function).type.not.toBeCallableWith({
      address,
      abi,
      functionName: "settle",
      args: { delta: 1n }
    })
    expect(Policy.function).type.not.toBeCallableWith({ address, abi, functionName: "settle", args: { ids: [1n] } })
    expect(Policy.function).type.toBeCallableWith({ address, abi, functionName: "settle", args: { flag: [true] } })
  })

  it("takes any arguments with an ABI that isn't const", () => {
    const loose: ReadonlyArray<unknown> = abi
    expect(Policy.function).type.toBeCallableWith({ address, abi: loose, functionName: "anything", args: { x: 1 } })
  })
})

describe("Policy builders", () => {
  it("return tagged plain values", () => {
    expect(Policy.spend({ token: address, amount: 1n, period: "day" }).type).type.toBe<"spend">()
    expect(Policy.anyCall).type.not.toBeCallableWith({ unsafe: false })
    expect(Policy.rateLimit).type.not.toBeCallableWith({ count: 1, period: "fortnight" })
  })
})
