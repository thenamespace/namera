export function getOrigin(url: string) {
  try {
    const parsedUrl = new URL(url);
    // For custom URL schemes (like exp://), the origin property returns the string "null"
    // instead of null. We need to handle this case and return null so the fallback logic works.
    return parsedUrl.origin === "null" ? null : parsedUrl.origin;
  } catch {
    return null;
  }
}

export function getProtocol(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol;
  } catch {
    return null;
  }
}

export function getHost(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host;
  } catch {
    return null;
  }
}
