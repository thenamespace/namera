import { Devnet } from "@namera-ai/devnet"

declare module "vitest" {
  interface ProvidedContext {
    readonly [Devnet.contextKey]: Devnet.Context
  }
}

export default Devnet.globalSetup()
