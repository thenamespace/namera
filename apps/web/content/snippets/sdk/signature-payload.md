### type

- **Type:** `"message" | "typed-data"`
- **Required**

Selects the payload format. Use `message` with `"message"` or `typedData` with
`"typed-data"`. Do not supply both payload fields.

### message

- **Type:** `string`
- **Required when:** `type` is `"message"`

The exact UTF-8 text to sign or verify. Whitespace and capitalization are part of
the payload. A string such as `"0x1234"` is text, not raw bytes.

### typedData

- **Type:** `EvmTypedData`
- **Required when:** `type` is `"typed-data"`

An EIP-712 payload containing `domain`, `types`, `primaryType`, and `message`.
Use the identical payload when verifying its signature.

```ts title="index.ts"
import type { EvmTypedData } from "@namera-ai/sdk";

const typedData = {
  domain: {
    // [!code focus:6]
    name: "Namera Example",
    version: "1",
    chainId: 84532,
    verifyingContract: "0x3333333333333333333333333333333333333333",
  },
  types: { Greeting: [{ name: "contents", type: "string" }] },
  primaryType: "Greeting",
  message: { contents: "Hello from Namera" },
} satisfies EvmTypedData;
```

#### typedData.domain

- **Type:** `EvmTypedData["domain"]`
- **Required**

The signing domain. Its fields are optional: `name` and `version` are strings;
`chainId` is a nonnegative integer; `verifyingContract` is a 20-byte address;
`salt` is a 32-byte hex value. Unlike the request’s CAIP-2 `chainId`, this domain
uses a number such as `84532`. Use the domain expected by the verifying application.

#### typedData.types

- **Type:** `Record<string, readonly { name: string; type: string }[]>`
- **Required**

Definitions of the structs used by the payload. Struct names, field names, and
field types must be nonempty strings. Each struct needs at least one field.

#### typedData.primaryType

- **Type:** `string`
- **Required**

The root struct name from `types`, such as `"Greeting"`. It determines how the
message fields are encoded.

#### typedData.message

- **Type:** `Record<string, Json>`
- **Required**

Values matching the root struct. Use JSON-compatible values. Represent large
integers as decimal strings, not JavaScript `bigint`, to preserve precision.
