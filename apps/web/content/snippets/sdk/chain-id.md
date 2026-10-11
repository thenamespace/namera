### chainId

- **Type:** `SupportedEvmChainId`
- **Required**

The target network in CAIP-2 format. For Base Sepolia, use `"eip155:84532"`,
not `84532` or `"84532"`. Use the network on which the account will execute, sign, or verify the payload.

The SDK restricts this field to the [supported network IDs](/docs/sdk/supported-networks).
Network availability is also checked by the API.
