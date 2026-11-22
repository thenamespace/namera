// Fetches the deployed bytecode of EntryPoint 0.7 and the smart accounts used by test/accounts into
// test/fixtures/accounts/<name>@<address>.hex, so account tests run locally without an RPC.
//
//   node script/fixtures/fetch-account-fixtures.ts
//
// Reads RPC_BASE_SEPOLIA, falling back to the public Base Sepolia RPC. Every contract below is deployed at the
// same address on all launch chains (checked by the chain scan), so Base Sepolia is representative.
import { mkdirSync, rmSync, writeFileSync } from "node:fs"

const RPC = process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org"

const CONTRACTS: Record<string, string> = {
  "entrypoint-0.7": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  "entrypoint-0.7-sender-creator": "0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C",
  "kernel-3.3-factory": "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9",
  "kernel-3.3-implementation": "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28",
  "kernel-ecdsa-validator": "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57",
  "nexus-1.3.3-factory": "0x0000b1C08f1418dA76B5E99c1Bf5718486cf8c53",
  "nexus-1.3.3-implementation": "0x0000B1c01cB3b5770D8806f0D214d50131a08a5B",
  "nexus-1.3-bootstrap": "0x0000B1c0A80cb7DD166a15e7390b8A4Ced4500C6",
  "nexus-k1-mee-validator": "0x0000B1C0790E5a28293276C320d2B95D651dBaD6",
  "safe-1.4.1-l2-singleton": "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
  "safe-1.4.1-proxy-factory": "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
  "safe7579-v2-adapter": "0x7579f2AD53b01c3D8779Fe17928e0D48885B0003",
  "safe7579-v2-launchpad": "0x75798463024Bda64D83c94A64Bc7D7eaB41300eF",
  "safe7579-v2-delegatecall-util": "0x3fB7a8Bee59D8C5b2F1Cf6CE93e5E694Cb233B57",
  "ownable-validator": "0x000000000013fdB5234E4E3162a810F54d9f7E98",
  "erc7484-registry": "0x000000000069E2a187AEFFb852bF3cCdC95151B2"
}

async function getCode(address: string): Promise<string> {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"]
    })
  })
  const { result, error } = (await response.json()) as { result?: string; error?: unknown }
  if (!result || result === "0x") {
    throw new Error(`no code at ${address}: ${JSON.stringify(error)}`)
  }
  return result
}

const DIR = "test/fixtures/accounts"

const contracts = await Promise.all(
  Object.entries(CONTRACTS).map(async ([name, address]) => ({
    name,
    address,
    code: await getCode(address)
  }))
)
rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
for (const { name, address, code } of contracts) {
  writeFileSync(`${DIR}/${name}@${address}.hex`, `${code}\n`)
}
console.log(`wrote ${contracts.length} contracts to ${DIR}`)
