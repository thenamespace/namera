import { inject } from "@effect/vitest"
import { Devnet } from "@namera-ai/devnet"
import type { Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

export const devnet: Devnet.Devnet = await Devnet.from(inject(Devnet.contextKey))

export const client: Devnet.Devnet["client"] = devnet.client

/** A fresh owner key, so every test's accounts are new. */
export const newOwner = () => privateKeyToAccount(generatePrivateKey())

/** Compares two hex strings as bytes: ox writes lowercase hex, viem keeps checksummed addresses. */
export const sameBytes = (a: Hex | undefined, b: Hex | undefined) => a?.toLowerCase() === b?.toLowerCase()
