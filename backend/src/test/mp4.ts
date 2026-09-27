/**
 * Builds minimal but structurally real ISO base media files, so tests that
 * upload a "video" produce something the probe accepts — a few hundred bytes
 * of correctly-nested atoms rather than a binary fixture in the repository.
 */

function atom(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
}

/** `hdlr` carries the handler fourCC 8 bytes into its payload. */
function hdlr(handler: string): Buffer {
  const payload = Buffer.alloc(24);
  payload.write(handler, 8, "latin1");
  return atom("hdlr", payload);
}

/** `stsd` carries the first sample entry's fourCC 12 bytes into its payload. */
function stsd(codec: string): Buffer {
  const payload = Buffer.alloc(24);
  payload.writeUInt32BE(1, 4);
  payload.write(codec, 12, "latin1");
  return atom("stsd", payload);
}

export function mp4Track(handler: string, codec: string): Buffer {
  return atom(
    "trak",
    atom("mdia", Buffer.concat([hdlr(handler), atom("minf", atom("stbl", stsd(codec)))]))
  );
}

/**
 * `moov` is placed after the payload, which is where most exports leave it and
 * the case a head-only parser would miss. `payloadBytes` pads the file out so
 * range requests have something to slice.
 */
export function buildMp4(tracks: Buffer[], payloadBytes = 512): Buffer {
  const ftyp = atom("ftyp", Buffer.from("isomiso2avc1mp41", "latin1"));
  const payload = Buffer.from(Array.from({ length: payloadBytes }, (_, i) => i % 251));
  return Buffer.concat([ftyp, atom("mdat", payload), atom("moov", Buffer.concat(tracks))]);
}

/** The ordinary case: H.264 picture plus AAC sound. */
export function playableMp4(payloadBytes = 512): Buffer {
  return buildMp4([mp4Track("vide", "avc1"), mp4Track("soun", "mp4a")], payloadBytes);
}
