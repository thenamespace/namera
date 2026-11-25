import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Result } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"

import type { Chain } from "../../contracts/schema.ts"
import {
  etherscanVerified,
  isVerified,
  sourcifyVerified,
  submissionStatus,
  type Verification,
  verificationProblems,
  verificationTable
} from "../../contracts/verification.ts"

const chain: Chain = {
  id: 84532,
  slug: "base-sepolia",
  name: "Base Sepolia",
  network: "testnet",
  rpcEnv: "RPC_BASE_SEPOLIA",
  publicRpc: "https://sepolia.base.org",
  verifiers: ["sourcify", "etherscan"]
}

const address = "0x0000000000000000000000000000000000001234"

describe("sourcifyVerified", () => {
  it("is verified when the contract has a match", () => {
    assert.deepStrictEqual(sourcifyVerified(200, { match: "exact_match", chainId: "84532" }), Result.succeed(true))
    assert.deepStrictEqual(sourcifyVerified(200, { match: "match" }), Result.succeed(true))
  })

  it("is unverified without a match or when Sourcify does not know the contract", () => {
    assert.deepStrictEqual(sourcifyVerified(200, { match: null }), Result.succeed(false))
    assert.deepStrictEqual(
      sourcifyVerified(404, { customCode: "not_found", message: "Contract not found" }),
      Result.succeed(false)
    )
  })

  it("fails on error responses and unexpected bodies", () => {
    assert.deepStrictEqual(
      sourcifyVerified(400, { customCode: "unsupported_chain", message: "Chain 1 is not supported" }),
      Result.fail("HTTP 400: Chain 1 is not supported")
    )
    assert.deepStrictEqual(sourcifyVerified(502, "Bad Gateway"), Result.fail("HTTP 502"))
    assert.deepStrictEqual(sourcifyVerified(200, { status: "ok" }), Result.fail("unexpected response"))
  })
})

describe("etherscanVerified", () => {
  const sources = (sourceCode: string) => ({
    status: "1",
    message: "OK",
    result: [{ SourceCode: sourceCode, ABI: "[]", ContractName: "SessionHook" }]
  })

  it("is verified when the source code is not empty", () => {
    assert.deepStrictEqual(etherscanVerified(sources("pragma solidity 0.8.30;")), Result.succeed(true))
  })

  it("is unverified when the source code is empty", () => {
    assert.deepStrictEqual(etherscanVerified(sources("")), Result.succeed(false))
  })

  it("fails with the reason Etherscan gives", () => {
    assert.deepStrictEqual(
      etherscanVerified({ status: "0", message: "NOTOK", result: "Max rate limit reached" }),
      Result.fail("Max rate limit reached")
    )
    assert.deepStrictEqual(etherscanVerified({ status: "0", message: "NOTOK", result: "" }), Result.fail("NOTOK"))
    assert.deepStrictEqual(
      etherscanVerified({ status: "1", message: "OK", result: [] }),
      Result.fail("unexpected response")
    )
    assert.deepStrictEqual(etherscanVerified("<html>"), Result.fail("unexpected response"))
  })
})

describe("isVerified", () => {
  const respond = (status: number, body: unknown) => {
    const requested: Array<URL> = []
    const client = HttpClient.make((request, url) => {
      requested.push(url)
      return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json(body, { status })))
    })
    return { client, requested }
  }

  it.effect("reads Sourcify's v2 contract endpoint", () =>
    Effect.gen(function*() {
      const { client, requested } = respond(200, { match: "match" })

      const verified = yield* isVerified("sourcify", chain.id, address, "").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      )

      assert.isTrue(verified)
      assert.strictEqual(String(requested[0]), `https://sourcify.dev/server/v2/contract/84532/${address}`)
    }))

  it.effect("asks Etherscan V2 for the chain's source code and never reports the API key", () =>
    Effect.gen(function*() {
      const { client, requested } = respond(200, { status: "0", message: "NOTOK", result: "Invalid API Key" })

      const exit = yield* isVerified("etherscan", chain.id, address, "secret-key").pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.exit
      )

      const url = requested[0]
      assert.strictEqual(url?.searchParams.get("chainid"), "84532")
      assert.strictEqual(url?.searchParams.get("action"), "getsourcecode")
      assert.strictEqual(url?.searchParams.get("address"), address)
      assert.isTrue(Exit.isFailure(exit))
      assert.include(String(exit), "Invalid API Key")
      assert.notInclude(String(exit), "secret-key")
    }))
})

describe("submissionStatus", () => {
  it("counts a submission the verifier has not processed yet as pending", () => {
    assert.strictEqual(
      submissionStatus("Contract verification status:\nResponse: `NOTOK`\nDetails: `Pending in queue`"),
      "pending"
    )
    assert.strictEqual(submissionStatus("Error: Verification is still pending..."), "pending")
  })

  it("counts any other error as failed", () => {
    assert.strictEqual(
      submissionStatus("Details: `Fail - Unable to verify. Compiled contract deployment bytecode does NOT match`"),
      "failed"
    )
  })
})

describe("verification result", () => {
  const verification = (label: string, verifier: Verification["verifier"], status: Verification["status"]) => ({
    label,
    address,
    verifier,
    status
  })

  it("passes when every contract is verified or skipped", () => {
    const verifications = [
      verification("SessionHook", "sourcify", "verified"),
      verification("SessionHook", "etherscan", "skipped")
    ]

    assert.deepStrictEqual(verificationProblems(chain, verifications), [])
  })

  it("fails on a contract still pending or failed, naming the command to rerun", () => {
    const verifications = [
      verification("SessionHook", "sourcify", "verified"),
      verification("SessionHook", "etherscan", "pending"),
      verification("WebAuthnValidator", "sourcify", "failed"),
      verification("WebAuthnValidator", "etherscan", "verified")
    ]

    assert.deepStrictEqual(verificationProblems(chain, verifications), [
      "SessionHook on etherscan: pending",
      "WebAuthnValidator on sourcify: failed",
      "rerun: pnpm contracts:verify --chain base-sepolia"
    ])
  })

  it("renders one row per contract and one column per verifier", () => {
    const verifications = [
      verification("SessionHook", "sourcify", "verified"),
      verification("SessionHook", "etherscan", "pending"),
      verification("WebAuthnValidator", "sourcify", "failed")
    ]

    assert.strictEqual(
      verificationTable(chain.verifiers, verifications),
      [
        "contract           sourcify  etherscan",
        "SessionHook        verified  pending",
        "WebAuthnValidator  failed    -"
      ].join("\n")
    )
  })
})
