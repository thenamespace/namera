import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest"
import { AllowPolicy, ECDSASessionValidator, SessionHook, SmartSession } from "@namera-ai/contracts"
import { KernelAccount, SmartAccount } from "@namera-ai/sdk"
import { concat, encodeAbiParameters, encodeFunctionData, type Hex, pad, parseAbi, toHex } from "viem"
import { entryPoint07Abi, entryPoint07Address, getUserOperationHash, toSmartAccount } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

import { client, devnet, newOwner } from "./accounts.test-utils.ts"

// Session operations through SessionHook on the devnet, whose alto runs in safe mode: it traces each operation's
// validation and rejects what breaks ERC-7562, as the shared mempool does. A session listing SessionHook (with no
// execution policies of its own) proves the hook's validation (its policy check reading the account) and its
// initialization (enable writes) are accepted, and that the SDK installs the hook on Kernel, deployed through its
// factory or installed by an EIP-7702 account's first operation.

const recipient = privateKeyToAccount(generatePrivateKey()).address
const SINGLE = pad("0x00", { dir: "right", size: 32 })
const execute = parseAbi(["function execute(bytes32 mode, bytes executionCalldata)"])
const sessionFor = (sessionKey: Hex) => ({
  sessionValidator: ECDSASessionValidator.v1.address,
  sessionValidatorInitData: encodeAbiParameters([{ type: "uint256" }, { type: "address[]" }], [1n, [sessionKey]]),
  salt: pad("0x01"),
  userOpPolicies: [{
    policy: SessionHook.v1.address,
    initData: encodeAbiParameters([{ type: "tuple[]", components: [{ type: "address" }, { type: "bytes" }] }], [[]])
  }],
  erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
  // Smart Sessions matches a call without calldata by its value selector, 0xffffffff.
  actions: [{
    actionTargetSelector: "0xffffffff",
    actionTarget: recipient,
    actionPolicies: [{ policy: AllowPolicy.v1.address, initData: "0x" }]
  }],
  permitERC4337Paymaster: false,
  validAfter: 0,
  validUntil: 0
} as const)

// The nonce lane that routes an operation to Smart Sessions on Kernel.
const sessionNonceKey = BigInt(concat(["0x0001", SmartSession.v1.address, "0x0000"]))

describe.each([
  { name: "a Kernel account", build: KernelAccount.from },
  { name: "a Kernel account through EIP-7702", build: KernelAccount.fromEip7702 }
])(
  "SessionHook on $name",
  { concurrent: false },
  ({ build }) => {
    devnet.isolate({ beforeEach, afterEach })

    it("runs tagged session operations under ERC-7562, and refuses untagged ones", async () => {
      const account = await build({ client, owner: newOwner() })
      await devnet.fund(account.address)
      await devnet.sendUserOperation(account, [{ to: recipient, value: 1n }])
      assert.isTrue(await SmartAccount.isSessionsInstalled(client, { address: account.address }))

      // The owner enables a session that lists SessionHook (initialized during this operation).
      const sessionKey = privateKeyToAccount(generatePrivateKey())
      const session = sessionFor(sessionKey.address)
      const enable = encodeFunctionData({ abi: SmartSession.v1.abi, functionName: "enableSessions", args: [[session]] })
      assert.isTrue((await devnet.sendUserOperation(account, [{ to: SmartSession.v1.address, data: enable }])).success)
      const permissionId = await client.readContract({
        ...SmartSession.v1,
        functionName: "getPermissionId",
        args: [session]
      })

      const agent = (tagged: boolean) =>
        toSmartAccount({
          client,
          entryPoint: { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" },
          getAddress: async () => account.address,
          getFactoryArgs: async () => ({ factory: undefined, factoryData: undefined }),
          getNonce: () =>
            client.readContract({
              address: entryPoint07Address,
              abi: entryPoint07Abi,
              functionName: "getNonce",
              args: [account.address, sessionNonceKey]
            }),
          encodeCalls: async (calls) => {
            const call = encodeFunctionData({
              abi: execute,
              args: [SINGLE, concat([calls[0]!.to, toHex(calls[0]!.value ?? 0n, { size: 32 }), calls[0]!.data ?? "0x"])]
            })
            const body = tagged
              ? concat([call, permissionId, await client.readContract({ ...SessionHook.v1, functionName: "TAG" })])
              : call
            // Kernel runs Smart Sessions' operations through `executeUserOp` once SessionHook is bound.
            return concat(["0x8dd7712f", body])
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
              userOperation: { ...operation, sender: account.address, signature: "0x" },
              entryPointAddress: entryPoint07Address,
              entryPointVersion: "0.7",
              chainId
            })
            return concat(["0x00", permissionId, await sessionKey.signMessage({ message: { raw: hash } })])
          }
        })

      const before = await client.getBalance({ address: recipient })
      const sent = await devnet.sendUserOperation(await agent(true), [{ to: recipient, value: 2n }])
      assert.isTrue(sent.success)
      assert.strictEqual(await client.getBalance({ address: recipient }), before + 2n)

      const error = await devnet.sendUserOperation(await agent(false), [{ to: recipient, value: 2n }]).then(
        () => assert.fail("expected the bundler to reject it"),
        (cause: unknown) => cause
      )
      assert.include(String(error), "AA23")
    })
  }
)
