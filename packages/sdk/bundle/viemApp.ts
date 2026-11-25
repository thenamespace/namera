import { createPublicClient, http } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const client = createPublicClient({ chain: base, transport: http() })
console.log(client, createBundlerClient, privateKeyToAccount)
