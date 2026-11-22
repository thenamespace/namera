// Namera's policies inside ERC-4337 validation, checked against ERC-7562 as public bundlers check it: a JS tracer on
// anvil records every opcode and storage slot the policy contracts touch while the account validates a real session
// operation, and the test asserts no banned opcode (TIMESTAMP, NUMBER, BALANCE, …) and only storage associated with
// the account (`keccak256(account ‖ x) + n`). The devnet's alto enforces ERC-7562 on every operation too; this test
// pins the rules to the policy contracts themselves, so a regression names the policy and the slot.
import { afterEach, assert, beforeEach, describe, inject, it } from "@effect/vitest"
import {
  AllowPolicy,
  ApprovalPolicy,
  ArgPolicy,
  ECDSASessionValidator,
  GasPolicy,
  RateLimitPolicy,
  SmartSession,
  SpendPolicy,
  ValuePolicy
} from "@namera-ai/contracts"
import { Devnet } from "@namera-ai/devnet"
import { toKernelSmartAccount } from "permissionless/accounts"
import { concat, encodeAbiParameters, encodeFunctionData, type Hex, pad, parseAbi, parseEther, toHex } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  toPackedUserOperation,
  toSmartAccount,
  type UserOperation
} from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const devnet = await Devnet.from(inject(Devnet.contextKey))
const { client } = devnet

const DAY = 86_400n
const token = privateKeyToAccount(generatePrivateKey()).address
const spender = privateKeyToAccount(generatePrivateKey()).address
const recipient = privateKeyToAccount(generatePrivateKey()).address
const sessionKey = privateKeyToAccount(generatePrivateKey())

const erc20 = parseAbi(["function transfer(address to, uint256 amount)", "function approve(address, uint256)"])
const execute = parseAbi(["function execute(bytes32 mode, bytes executionCalldata)"])
const SINGLE = pad("0x00", { dir: "right", size: 32 })
const BATCH = pad("0x01", { dir: "right", size: 32 })

const policy = (address: Hex, initData: Hex) => ({ policy: address, initData })

// The session: transfers of at most 100 (ArgPolicy) within 100 per day (SpendPolicy), approvals of the one spender
// (ApprovalPolicy), native transfers (AllowPolicy) within 1 ether per day (ValuePolicy), 10 operations per hour and a
// gas budget.
const session = {
  sessionValidator: ECDSASessionValidator.v1.address,
  sessionValidatorInitData: encodeAbiParameters([{ type: "uint256" }, { type: "address[]" }], [1n, [
    sessionKey.address
  ]]),
  salt: pad("0x01"),
  userOpPolicies: [
    policy(
      SpendPolicy.v1.address,
      encodeAbiParameters(
        [{
          type: "tuple[]",
          components: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }]
        }],
        [[[token, 100n, DAY, false]]]
      )
    ),
    policy(
      ValuePolicy.v1.address,
      encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [parseEther("1"), DAY])
    ),
    policy(RateLimitPolicy.v1.address, encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [10n, 3600n])),
    policy(
      GasPolicy.v1.address,
      encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [parseEther("1"), DAY])
    )
  ],
  erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
  actions: [
    {
      actionTargetSelector: "0xa9059cbb",
      actionTarget: token,
      actionPolicies: [
        policy(
          ArgPolicy.v1.address,
          encodeAbiParameters(
            [{ type: "tuple[]", components: [{ type: "uint8" }, { type: "uint256" }, { type: "bytes32[]" }] }],
            [[[3, 32n, [pad(toHex(100))]]]]
          )
        )
      ]
    },
    {
      actionTargetSelector: "0x095ea7b3",
      actionTarget: token,
      actionPolicies: [
        policy(
          ApprovalPolicy.v1.address,
          encodeAbiParameters([{ type: "address[]" }, { type: "uint256" }, { type: "address[]" }], [[spender], 50n, []])
        )
      ]
    },
    // Smart Sessions matches a call without calldata by its value selector, 0xffffffff.
    {
      actionTargetSelector: "0xffffffff",
      actionTarget: recipient,
      actionPolicies: [policy(AllowPolicy.v1.address, "0x")]
    }
  ],
  permitERC4337Paymaster: false,
  validAfter: 0,
  validUntil: 0
} as const

const smartSessionAbi = SmartSession.v1.abi

const policies = [AllowPolicy, ArgPolicy, ApprovalPolicy, SpendPolicy, ValuePolicy, RateLimitPolicy, GasPolicy].map(
  (contract) => contract.v1.address.toLowerCase()
)

// ERC-7562 [OP-011] and [OP-080]: opcodes an entity may not use during validation.
const banned = new Set([
  "GASPRICE",
  "GASLIMIT",
  "DIFFICULTY",
  "PREVRANDAO",
  "TIMESTAMP",
  "BASEFEE",
  "BLOCKHASH",
  "NUMBER",
  "SELFBALANCE",
  "BALANCE",
  "ORIGIN",
  "GAS",
  "CREATE",
  "CREATE2",
  "COINBASE",
  "SELFDESTRUCT",
  "BLOBHASH",
  "BLOBBASEFEE",
  "INVALID"
])

// Records, per step in a policy contract, banned opcodes and storage slots, and every keccak preimage with its hash.
const tracer = `{
  steps: [], hashes: [], pending: null, policies: ${JSON.stringify(policies)}, banned: ${JSON.stringify([...banned])},
  step: function(log) {
    if (this.pending !== null) {
      this.hashes.push({ input: this.pending, output: log.stack.peek(0).toString(16) });
      this.pending = null;
    }
    var op = log.op.toString();
    if (op === "KECCAK256") {
      var offset = log.stack.peek(0).valueOf();
      var length = log.stack.peek(1).valueOf();
      this.pending = toHex(log.memory.slice(offset, offset + length));
    }
    var address = toHex(log.contract.getAddress()).toLowerCase();
    if (this.policies.indexOf(address) === -1) return;
    if (op === "SLOAD" || op === "SSTORE") this.steps.push({ address: address, op: op, slot: log.stack.peek(0).toString(16) });
    else if (this.banned.indexOf(op) !== -1) this.steps.push({ address: address, op: op });
  },
  fault: function() {},
  result: function() { return { steps: this.steps, hashes: this.hashes }; }
}`

type Trace = {
  readonly steps: ReadonlyArray<{ readonly address: string; readonly op: string; readonly slot?: string }>
  readonly hashes: ReadonlyArray<{ readonly input: Hex; readonly output: string }>
}

// A slot is associated with `account` if it is the account's address or `keccak256(account ‖ x) + n`, n < 128.
const associated = (trace: Trace, account: Hex) => {
  const prefix = pad(account.toLowerCase() as Hex).toLowerCase()
  const bases = trace.hashes.filter(({ input }) => input.toLowerCase().startsWith(prefix)).map(({ output }) =>
    BigInt(`0x${output}`)
  )
  return (slot: string) => {
    const value = BigInt(`0x${slot}`)
    return value === BigInt(account) || bases.some((base) => value >= base && value - base < 128n)
  }
}

describe("Namera's policies under ERC-7562", { concurrent: false }, () => {
  devnet.isolate({ beforeEach, afterEach })

  const setUp = async () => {
    const owner = privateKeyToAccount(generatePrivateKey())
    const kernel = await toKernelSmartAccount({
      client,
      owners: [owner],
      version: "0.3.3",
      entryPoint: { address: entryPoint07Address, version: "0.7" }
    })
    await devnet.fund(kernel.address, parseEther("10"))

    // The owner installs Smart Sessions (as a validator for `execute`) and enables the session directly.
    const installData = concat([
      "0x0000000000000000000000000000000000000001",
      encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }], ["0x", "0x", "0xe9ae5c53"])
    ])
    const install = encodeFunctionData({
      abi: parseAbi(["function installModule(uint256, address, bytes)"]),
      args: [1n, SmartSession.v1.address, installData]
    })
    assert.isTrue((await devnet.sendUserOperation(kernel, [{ to: kernel.address, data: install }])).success)
    const enable = encodeFunctionData({ abi: smartSessionAbi, functionName: "enableSessions", args: [[session]] })
    assert.isTrue((await devnet.sendUserOperation(kernel, [{ to: SmartSession.v1.address, data: enable }])).success)

    const permissionId = await client.readContract({
      address: SmartSession.v1.address,
      abi: smartSessionAbi,
      functionName: "getPermissionId",
      args: [session]
    })
    return { kernel, permissionId }
  }

  // The session key's view of the account: Kernel's nonce lane for Smart Sessions, USE-mode signatures, and the
  // agent's time appended to `execute`.
  const sessionAccount = (address: Hex, permissionId: Hex, time: () => Promise<bigint>) =>
    toSmartAccount({
      client,
      entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
      getAddress: async () => address,
      getFactoryArgs: async () => ({ factory: undefined, factoryData: undefined }),
      getNonce: () =>
        client.readContract({
          address: entryPoint07Address,
          abi: entryPoint07Abi,
          functionName: "getNonce",
          args: [address, BigInt(concat(["0x0001", SmartSession.v1.address, "0x0000"]))]
        }),
      encodeCalls: async (calls) => {
        const data = calls.length === 1
          ? encodeFunctionData({
            abi: execute,
            args: [SINGLE, concat([calls[0]!.to, toHex(calls[0]!.value ?? 0n, { size: 32 }), calls[0]!.data ?? "0x"])]
          })
          : encodeFunctionData({
            abi: execute,
            args: [
              BATCH,
              encodeAbiParameters(
                [{ type: "tuple[]", components: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }] }],
                [calls.map((call) => [call.to, call.value ?? 0n, call.data ?? "0x"] as const)]
              )
            ]
          })
        return concat([data, toHex(await time(), { size: 32 })])
      },
      getStubSignature: async () =>
        concat([
          "0x00",
          permissionId,
          "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
        ]),
      signMessage: async () => "0x",
      signTypedData: async () => "0x",
      signUserOperation: async ({ chainId = devnet.chain.id, ...operation }) => {
        const hash = getUserOperationHash({
          userOperation: { ...operation, sender: address, signature: "0x" },
          entryPointAddress: entryPoint07Address,
          entryPointVersion: "0.7",
          chainId
        })
        return concat(["0x00", permissionId, await sessionKey.signMessage({ message: { raw: hash } })])
      }
    })

  const now = async () => (await client.getBlock()).timestamp

  it("validate a session operation without banned opcodes or unassociated storage, and enforce its budget", async () => {
    const { kernel, permissionId } = await setUp()
    const agent = await sessionAccount(kernel.address, permissionId, now)
    const calls = [
      { to: token, data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [recipient, 60n] }) },
      { to: token, data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [spender, 50n] }) },
      { to: recipient, value: 1n }
    ]

    const bundler = devnet.bundlerClient(agent)
    const prepared = (await bundler.prepareUserOperation({ calls })) as UserOperation<"0.7">
    const operation = { ...prepared, signature: await agent.signUserOperation(prepared) }
    const hash = getUserOperationHash({
      userOperation: operation,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: "0.7",
      chainId: devnet.chain.id
    })
    const validate = encodeFunctionData({
      abi: parseAbi([
        "struct PackedUserOperation { address sender; uint256 nonce; bytes initCode; bytes callData; bytes32 accountGasLimits; uint256 preVerificationGas; bytes32 gasFees; bytes paymasterAndData; bytes signature; }",
        "function validateUserOp(PackedUserOperation userOp, bytes32 userOpHash, uint256 missingAccountFunds) returns (uint256)"
      ]),
      args: [toPackedUserOperation(operation), hash, 0n]
    })
    const trace = await client.request({
      method: "debug_traceCall" as "eth_chainId",
      params: [{ from: entryPoint07Address, to: kernel.address, data: validate }, "latest", { tracer }] as never
    }) as unknown as Trace

    const isAssociated = associated(trace, kernel.address)
    const storage = trace.steps.filter(({ op }) => op === "SLOAD" || op === "SSTORE")
    assert.isAbove(storage.length, 0)
    assert.deepStrictEqual(trace.steps.filter(({ op }) => banned.has(op)), [])
    assert.deepStrictEqual(storage.filter(({ slot }) => !isAssociated(slot!)), [])
    assert.deepStrictEqual(
      [...new Set(storage.map(({ address }) => address))].sort(),
      [...policies].filter((address) => address !== AllowPolicy.v1.address.toLowerCase()).concat(
        AllowPolicy.v1.address.toLowerCase()
      ).filter((address) => storage.some((step) => step.address === address)).sort()
    )

    const first = await devnet.sendUserOperation(agent, calls)
    assert.isTrue(first.success)
    assert.strictEqual(await client.getBalance({ address: recipient }), 1n)

    const overBudget = devnet.sendUserOperation(agent, [calls[0]!])
    const error = await overBudget.then(
      () => assert.fail("expected the bundler to reject it"),
      (cause: unknown) => cause
    )
    assert.include(String(error), "AA23")
  })

  it("refuse an operation that claims a time in a later period", async () => {
    const { kernel, permissionId } = await setUp()
    const agent = await sessionAccount(kernel.address, permissionId, async () => (await now()) + DAY)
    const transfer = {
      to: token,
      data: encodeFunctionData({ abi: erc20, functionName: "transfer", args: [recipient, 1n] })
    }

    const error = await devnet.sendUserOperation(agent, [transfer]).then(
      () => assert.fail("expected the bundler to reject it"),
      (cause: unknown) => cause
    )
    assert.match(String(error), /AA22|not due|validAfter/i)
  })
})
