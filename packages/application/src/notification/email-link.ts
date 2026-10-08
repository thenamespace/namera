export const dashboardEmailLink = (origin: URL, path: string): string => {
  // The auth route preserves the destination through sign-in, or redirects
  // immediately when the recipient already has a session.
  const url = new URL("/auth", origin);
  url.searchParams.set("returnTo", path);
  return url.href;
};
