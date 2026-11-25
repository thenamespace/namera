// RPC and bundler URLs often carry an API key in the path (`/v2/<key>`) or the query (`?apikey=`), and errors are
// logged and sent to agent tools. Errors show URLs only through these functions.

// A path segment this long made of URL-safe characters is treated as a credential.
const credentialSegment = /^[\w-]{16,}$/

/**
 * Returns the URL without its user info, query, fragment or credential-like path segments.
 *
 * @internal
 */
export const redactUrl = (url: string): string => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "<invalid URL>"
  }
  const path = parsed.pathname
    .split("/")
    .map((segment) => (credentialSegment.test(segment) ? "***" : segment))
    .join("/")
  return `${parsed.protocol}//${parsed.host}${path === "/" ? "" : path}`
}

/**
 * Redacts every URL in a text, such as a viem error message that includes the request URL.
 *
 * @internal
 */
export const redactUrls = (text: string): string =>
  text.replace(/\b(?:https?|wss?):\/\/[^\s"'<>)]+/g, (url) => redactUrl(url))
