/** Signed, time-limited Bunny Stream embed URL for one lesson's video. */
export interface SignedPlayback {
  embedUrl: string;
  /** ISO 8601 timestamp — the URL stops working after this instant. */
  expiresAt: string;
}
