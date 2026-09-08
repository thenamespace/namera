import { Schema } from "effect";

const Port = Schema.Int.check(Schema.isBetween({ minimum: 1024, maximum: 65535 }));

/** The listener and every advertised local OAuth URL share one literal authority. */
export const localMcpUrls = (port: number) => {
  const origin = `http://127.0.0.1:${Schema.decodeUnknownSync(Port)(port)}`;
  return {
    hostname: "127.0.0.1",
    port,
    origin,
    authority: new URL(origin).host,
    resource: `${origin}/mcp`,
    callback: `${origin}/oauth/callback`,
    resourceMetadata: `${origin}/.well-known/oauth-protected-resource/mcp`,
  } as const;
};

export type LocalMcpUrls = ReturnType<typeof localMcpUrls>;

/** Forwarded headers must never relax the authority accepted by a local listener. */
export const acceptsLocalMcpRequest = (
  urls: LocalMcpUrls,
  headers: { readonly host?: string; readonly origin?: string },
) =>
  headers.host === urls.authority &&
  (headers.origin === undefined || headers.origin === urls.origin);

const redirectAllowed = (value: string) => {
  const url = URL.parse(value);
  if (url === null || url.username !== "" || url.password !== "" || value.includes("#"))
    return false;

  // HTTPS callbacks support remote agent hosts; HTTP is restricted to literal
  // loopback addresses, never a hostname that could resolve to another machine.
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]"))
  );
};

export const LocalMcpRedirectUri = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(2048),
  Schema.makeFilter(redirectAllowed, {
    message: "Use an HTTPS or literal loopback callback without credentials or a fragment",
  }),
);

/** Bind the exact registered string; URL normalization is not redirect matching. */
export const matchesRegisteredRedirect = (registered: readonly string[], requested: string) =>
  registered.includes(requested);

export const LocalMcpCodeChallenge = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));

export const LocalMcpCodeVerifier = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9._~-]{43,128}$/),
);
