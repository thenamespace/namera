import { smoke } from "./smoke.test-utils.ts"

// A Cloudflare Workers module: answers every request with what `smoke` observed inside workerd.
export default {
  fetch: async (): Promise<Response> => Response.json(await smoke())
}
