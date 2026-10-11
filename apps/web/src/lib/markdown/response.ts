export function absoluteMarkdownLinks(body: string, url: string) {
  return body.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (match, before, href, after) => {
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) return match;
    return `${before}${new URL(href, url).href}${after}`;
  });
}

export function markdownResponse(body: string, canonical?: string) {
  return new Response(canonical ? absoluteMarkdownLinks(body, canonical) : body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Robots-Tag": "noindex, follow",
      "X-Content-Type-Options": "nosniff",
      ...(canonical ? { Link: `<${canonical}>; rel="canonical"` } : {}),
    },
  });
}
