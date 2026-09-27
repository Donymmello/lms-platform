/**
 * Builds a `Content-Disposition` header for a file name that came from an
 * upload — which may contain anything at all.
 *
 * The plain `filename` is reduced to safe ASCII: a quote, backslash, newline
 * or semicolon in there would end the parameter early and let the name inject
 * header parameters of its own. `filename*` (RFC 5987) then carries the real
 * name, percent-encoded, which every browser in current use prefers.
 *
 * Always `attachment`: these bytes are served from the API's own origin, the
 * one holding the session cookie, so the browser must never render them there.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName
    // Anything outside printable ASCII, plus the characters that carry meaning
    // inside a quoted header parameter.
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\;]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
