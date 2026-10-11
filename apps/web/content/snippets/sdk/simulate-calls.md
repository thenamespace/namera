### calls

- **Type:** `readonly { to: EthereumAddress; value: bigint; data: Hex }[]`
- **Required**

One or more EVM calls, in execution order. Every call uses the same account,
network, and session key. Supply all three fields on each call; there are no
implicit values for `value` or `data`.

```ts title="index.ts"
import { namera } from "./client";
import { parseEther } from "viem";

const execution = await namera.executions.simulate({
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [
    {
      to: "0x2222222222222222222222222222222222222222",
      value: parseEther("0.001"), // [!code focus]
      data: "0x",
    },
  ],
});

if (!execution.success) throw new Error(execution.error.message);

console.log(execution.data);
```

#### calls.to

- **Type:** `EthereumAddress` (`` `0x${string}` ``)
- **Required**

The 20-byte recipient or contract address. Native transfers target the recipient;
contract calls target the contract, not the recipient encoded in its arguments.
The session’s permissions must allow this target.

```ts title="index.ts"
import { namera } from "./client";
import { parseEther } from "viem";

const execution = await namera.executions.simulate({
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [
    {
      to: "0x2222222222222222222222222222222222222222", // [!code focus]
      value: parseEther("0.001"),
      data: "0x",
    },
  ],
});

if (!execution.success) throw new Error(execution.error.message);

console.log(execution.data);
```

#### calls.value

- **Type:** `bigint`
- **Required**

The native-token amount in wei. Use `parseEther("0.001")` for 0.001 ETH or `0n`
for a call that sends no native tokens. Negative amounts are rejected. ERC-20
amounts belong in encoded calldata, not this field.

```ts title="index.ts"
import { namera } from "./client";
import { parseEther } from "viem";

const execution = await namera.executions.simulate({
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [
    {
      to: "0x2222222222222222222222222222222222222222",
      value: parseEther("0.001"), // [!code focus]
      data: "0x",
    },
  ],
});

if (!execution.success) throw new Error(execution.error.message);

console.log(execution.data);
```

#### calls.data

- **Type:** `Hex` (`` `0x${string}` ``)
- **Required**

The encoded contract call. Use `"0x"` for a native transfer. For contract functions,
use viem’s `encodeFunctionData`; the SDK does not accept `abi`, `functionName`, or
`args` directly in a call.

```ts title="index.ts"
import { namera } from "./client";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";

const result = await namera.executions.simulate({
  namespace: "eip155",
  walletId: "0199dfe1-0000-7000-8000-000000000001",
  sessionKeyId: "0199dfe1-0000-7000-8000-000000000002",
  chainId: "eip155:84532",
  calls: [
    {
      to: "0x3333333333333333333333333333333333333333",
      value: 0n,
      data: encodeFunctionData({
        // [!code focus:5]
        abi: erc20Abi,
        functionName: "transfer",
        args: ["0x2222222222222222222222222222222222222222", parseUnits("1", 6)],
      }),
    },
  ],
});
if (!result.success) throw new Error(result.error.message);

console.log(result.data);
```

This encodes a transfer of one token with six decimals. Use your token’s actual
decimals and pass its contract address as `to`.
