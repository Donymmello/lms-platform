/**
 * How to play one lesson's video. The two kinds come from the two storage
 * backends: Bunny hands back a signed URL meant for an <iframe>, while a
 * video kept on the server's own disk is streamed and belongs in a <video>.
 */
export interface SignedPlayback {
  kind: "embed" | "file";
  url: string;
  /** ISO 8601. Only set for `embed` — a signed Bunny URL stops working after this. */
  expiresAt: string | null;
}
