/**
 * URL sanitisation for links that originate from untrusted data.
 *
 * OpenStreetMap tags (e.g. a reserve's `website`) are world-editable, and we
 * render them into an anchor's `href` inside a map popup. HTML-escaping the
 * value is not enough: it stops attribute break-out but still lets a
 * `javascript:`/`data:` scheme execute on click. `safeHttpUrl` returns the URL
 * only when it parses as an absolute http(s) URL, and null otherwise, so such
 * links are simply dropped.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.href;
}
