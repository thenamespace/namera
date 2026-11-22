import { TestChain } from "@namera-ai/sdk/testing"

declare module "vitest" {
  interface ProvidedContext {
    readonly [TestChain.contextKey]: TestChain.Context
  }
}

export default TestChain.globalSetup()
