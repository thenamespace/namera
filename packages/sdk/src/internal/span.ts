import * as Effect from "effect/Effect"

// Namera's spans and what they say about a call, under the `namera.` prefix: the chain, the account type and the
// grant. Never keys, signatures, addresses or endpoint URLs: spans leave the process through the app's exporter.
//
// Effect's span code is about 4.4 KB gzip, which every bundle would carry for spans nobody exports. So functions only
// name their spans here, and `./otel` switches spans on (`enable`) when it is used; until then `traced` and `annotate`
// do nothing, and bundlers drop Effect's span code with `enable`.

interface Attributes {
  readonly chainId?: number | ReadonlyArray<number> | undefined
  readonly accountType?: string | undefined
  readonly grantId?: string | undefined
}

interface Tracing {
  readonly withSpan: (name: string) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly annotate: (attributes: Record<string, unknown>) => Effect.Effect<void>
}

let tracing: Tracing | undefined

/**
 * Switches Namera's spans on, for every later call.
 *
 * @internal
 */
export const enable = (): void => {
  tracing = {
    withSpan: (name) => (effect) => Effect.withSpan(effect, name),
    annotate: (attributes) => Effect.annotateCurrentSpan(attributes)
  }
}

/**
 * Runs an effect in a span of this name once spans are on; for `Effect.fnUntraced`'s pipeline or `pipe`.
 *
 * @internal
 */
export const traced = (name: string) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  tracing === undefined ? effect : Effect.suspend(() => tracing!.withSpan(name)(effect))

/**
 * Adds the attributes that are known to the current span.
 *
 * @internal
 */
export const annotate = ({ accountType, chainId, grantId }: Attributes): Effect.Effect<void> =>
  tracing === undefined ? Effect.void : tracing.annotate({
    ...(chainId === undefined ? {} : { "namera.chain.id": chainId }),
    ...(accountType === undefined ? {} : { "namera.account.type": accountType }),
    ...(grantId === undefined ? {} : { "namera.grant.id": grantId })
  })

/**
 * The chain ids of the clients a call runs on: one id for one client, all of them for several.
 *
 * @internal
 */
export const chainIdsOf = (
  clients:
    | { readonly chain?: { readonly id: number } | undefined }
    | ReadonlyArray<{ readonly chain?: { readonly id: number } | undefined }>
): number | ReadonlyArray<number> | undefined => {
  if (!Array.isArray(clients)) return (clients as { readonly chain?: { readonly id: number } | undefined }).chain?.id
  const ids = clients.flatMap((client) => (client.chain === undefined ? [] : [client.chain.id]))
  return ids.length === 1 ? ids[0] : ids
}

/**
 * A grant's span attributes: its id and account type.
 *
 * @internal
 */
export const ofGrant = (grant: {
  readonly id: string
  readonly accountType: { readonly type: string }
}): Attributes => ({ grantId: grant.id, accountType: grant.accountType.type })
