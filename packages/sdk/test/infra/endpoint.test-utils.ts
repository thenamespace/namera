import type { HttpTransportConfig } from "viem"

/** One JSON-RPC request an endpoint received. */
export interface Call {
  readonly url: string
  readonly method: string
  readonly params: ReadonlyArray<unknown>
  readonly headers: Readonly<Record<string, string>>
}

/** What the endpoint answers: a result, a JSON-RPC error, or an HTTP failure. */
export type Answer =
  | { readonly result: unknown }
  | { readonly error: { readonly code: number; readonly message: string; readonly data?: unknown } }
  | { readonly status: number; readonly body: string }

/**
 * A vendor endpoint answering from `answer`, through viem's own HTTP transport (its `fetchFn`), so no request leaves
 * the process. `calls` records every request.
 */
export const endpoint = (answer: (call: Call) => Answer) => {
  const calls: Array<Call> = []
  const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params?: ReadonlyArray<unknown> }
    const call = {
      url: String(url),
      method: body.method,
      params: body.params ?? [],
      headers: (init?.headers ?? {}) as Record<string, string>
    }
    calls.push(call)
    const reply = answer(call)
    if ("status" in reply) return new Response(reply.body, { status: reply.status })
    return Response.json({ jsonrpc: "2.0", id: body.id, ...reply })
  }
  const http: HttpTransportConfig = { fetchFn, retryCount: 0 }
  return { calls, http }
}
