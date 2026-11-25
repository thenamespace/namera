import { Bundler, Grant } from "@namera-ai/sdk"
import { createPublicClient, http } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const client = createPublicClient({ chain: base, transport: http() })
console.log(client, createBundlerClient, privateKeyToAccount, Grant.parse, Grant.toAccount, Bundler.pimlico)
