const urlParsingBase = "http://namera.local";
const apiPrefixPattern = /^\/api\/v\d+/;
const trailingSlashPattern = /\/+$/;

const methodVerb: Record<string, string> = {
  GET: "get",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

const actionAliases: Record<string, string> = {
  list: "list",
  get: "get",
  create: "create",
  update: "update",
  delete: "delete",
  verify: "verify",
  "sign-in": "signIn",
  "set-active": "setActive",
};

const toCamel = (value: string) =>
  value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

const parseUrl = (url: string) => new URL(url, urlParsingBase);

const normalizeMethod = (method: string | undefined) =>
  method?.toUpperCase() ?? "HTTP";

export const normalizeHttpPath = (url: string) => {
  const parsed = parseUrl(url);
  const pathname =
    parsed.pathname
      .replace(apiPrefixPattern, "")
      .replace(trailingSlashPattern, "") || "/";

  if (pathname.startsWith("/rpc/")) {
    return "/rpc/:chainId";
  }

  return pathname;
};

export const inferHttpOperationName = (
  method: string | undefined,
  url: string,
) => {
  const normalizedMethod = normalizeMethod(method);

  const parts = normalizeHttpPath(url)
    .split("/")
    .filter(Boolean)
    .map((part) => (part.startsWith(":") ? "byId" : toCamel(part)));

  if (parts.length === 0) {
    return `${normalizedMethod} /`;
  }

  const last = parts.at(-1)!;
  const aliasedAction = actionAliases[last];

  if (aliasedAction && parts.length > 1) {
    return [...parts.slice(0, -1), aliasedAction].join(".");
  }

  const fallbackVerb =
    methodVerb[normalizedMethod] ?? normalizedMethod.toLowerCase();

  return [...parts, fallbackVerb].join(".");
};

const operationOverrides = new Map<string, string>([
  ["GET /auth/me", "auth.currentUser"],
  ["DELETE /auth/sessions/me", "auth.logout"],
]);

export const httpOperationName = (method: string | undefined, url: string) => {
  const normalizedMethod = normalizeMethod(method);
  const pathname = normalizeHttpPath(url);

  return (
    operationOverrides.get(`${normalizedMethod} ${pathname}`) ??
    inferHttpOperationName(normalizedMethod, pathname)
  );
};

const excludedHttpMethods = new Set(["HEAD", "OPTIONS"]);
const excludedStaticAssetExtensions = new Set([
  ".avif",
  ".css",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".map",
  ".png",
  ".svg",
  ".webmanifest",
  ".webp",
  ".woff",
  ".woff2",
]);

const hasExcludedStaticAssetExtension = (pathname: string) => {
  const lastSegment = pathname.split("/").at(-1) ?? "";
  const extensionIndex = lastSegment.lastIndexOf(".");

  if (extensionIndex === -1) return false;
  return excludedStaticAssetExtensions.has(lastSegment.slice(extensionIndex));
};

export type HttpTelemetryFilterInput = {
  method?: string;
  url?: string;
  includeStaticAssets?: boolean;
};

export const shouldSkipHttpTracing = ({
  method,
  url,
  includeStaticAssets = false,
}: HttpTelemetryFilterInput) => {
  if (method && excludedHttpMethods.has(normalizeMethod(method))) {
    return true;
  }

  if (!url) return false;

  const pathname = normalizeHttpPath(url);

  if (
    pathname === "/health" ||
    pathname.startsWith("/telemetry/") ||
    pathname.startsWith("/rpc/")
  ) {
    return true;
  }

  if (
    !includeStaticAssets &&
    hasExcludedStaticAssetExtension(parseUrl(url).pathname)
  ) {
    return true;
  }

  return false;
};

export const shouldIgnoreTelemetry = (method?: string, url?: string) =>
  shouldSkipHttpTracing({ method, url });
