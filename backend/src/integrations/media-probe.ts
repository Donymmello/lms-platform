import fs from "node:fs/promises";

/**
 * Reads enough of an MP4/MOV container to answer one question: will a browser
 * show a picture when this plays?
 *
 * The extension and the MIME type both lie freely — an audio-only recording
 * exported as `.mp4` arrives as `video/mp4` and passes every check that does
 * not look inside. That is not hypothetical: it is how a lesson ended up
 * playing sound over a blank frame.
 *
 * Only ISO base media files (mp4, m4v, mov) are parsed. WebM and Ogg use
 * entirely different container formats, and writing two more parsers to catch
 * a much rarer mistake is not worth it — those are accepted unexamined.
 */

/** Atoms whose payload is more atoms rather than data. */
const CONTAINER_ATOMS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "udta"]);

/**
 * Video codecs a browser will not decode, however well-formed the file is.
 * HEVC leads the list because it is what an iPhone records by default and
 * what most editors export when asked for "high quality".
 */
const UNPLAYABLE_VIDEO_CODECS: Record<string, string> = {
  hvc1: "H.265/HEVC",
  hev1: "H.265/HEVC",
  dvh1: "Dolby Vision",
  dvhe: "Dolby Vision",
  apch: "Apple ProRes",
  apcn: "Apple ProRes",
  apcs: "Apple ProRes",
  ap4h: "Apple ProRes",
};

export interface MediaTrack {
  /** `vide` for picture, `soun` for sound. */
  handler: string;
  /** Sample-entry fourCC, e.g. `avc1` for H.264. */
  codec: string | null;
}

export interface ProbeResult {
  /** False when the container is not ISO BMFF, in which case the tracks are unknown rather than absent. */
  inspected: boolean;
  tracks: MediaTrack[];
}

const ISO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov"]);

/**
 * Only the head and tail are read. The track metadata lives in `moov`, which
 * sits at one end or the other; the payload between them can be gigabytes and
 * is of no interest here.
 */
const PROBE_WINDOW_BYTES = 2 * 1024 * 1024;

async function readEnds(filePath: string): Promise<Buffer> {
  const handle = await fs.open(filePath, "r");
  try {
    const { size } = await handle.stat();
    if (size <= PROBE_WINDOW_BYTES * 2) {
      return (await handle.read(Buffer.alloc(size), 0, size, 0)).buffer;
    }

    const head = Buffer.alloc(PROBE_WINDOW_BYTES);
    const tail = Buffer.alloc(PROBE_WINDOW_BYTES);
    await handle.read(head, 0, PROBE_WINDOW_BYTES, 0);
    await handle.read(tail, 0, PROBE_WINDOW_BYTES, size - PROBE_WINDOW_BYTES);
    // Parsed separately by the caller walking from each end; concatenating is
    // enough because a truncated atom simply stops the walk.
    return Buffer.concat([head, tail]);
  } finally {
    await handle.close();
  }
}

function walk(buffer: Buffer, start: number, end: number, tracks: MediaTrack[]): void {
  let offset = start;

  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) return;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    }
    if (size === 0) size = end - offset;
    // A size that runs past the buffer means this is a truncated window, not a
    // malformed file — stop rather than guess.
    if (size < headerSize || offset + size > end) return;

    if (type === "hdlr" && offset + 20 <= end) {
      tracks.push({ handler: buffer.toString("latin1", offset + 16, offset + 20), codec: null });
    }

    if (type === "stsd" && offset + 24 <= end) {
      const track = tracks[tracks.length - 1];
      // The first sample entry's fourCC sits just past the entry count.
      if (track) track.codec = buffer.toString("latin1", offset + 20, offset + 24);
    }

    if (CONTAINER_ATOMS.has(type)) {
      walk(buffer, offset + headerSize, offset + size, tracks);
    }

    offset += size;
  }
}

export async function probeMedia(filePath: string, originalName: string): Promise<ProbeResult> {
  const extension = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  if (!ISO_EXTENSIONS.has(extension)) {
    return { inspected: false, tracks: [] };
  }

  const buffer = await readEnds(filePath);
  const tracks: MediaTrack[] = [];
  walk(buffer, 0, buffer.length, tracks);

  return { inspected: true, tracks };
}

/**
 * Returns a human-readable reason to refuse the file, or null to accept it.
 * Only called when the video will be served as-is; a CDN that transcodes
 * makes every one of these moot.
 */
export function rejectionReason(probe: ProbeResult): string | null {
  if (!probe.inspected) return null;

  const videoTrack = probe.tracks.find((track) => track.handler === "vide");

  if (!videoTrack) {
    const soundOnly = probe.tracks.some((track) => track.handler === "soun");
    return soundOnly
      ? "Este ficheiro só tem áudio, não traz imagem nenhuma. Verifica o que exportaste."
      : "Não foi encontrada nenhuma faixa de vídeo neste ficheiro.";
  }

  const unplayable = videoTrack.codec ? UNPLAYABLE_VIDEO_CODECS[videoTrack.codec] : undefined;
  if (unplayable) {
    return `O vídeo está em ${unplayable}, que os navegadores não conseguem reproduzir. Converte para H.264 (MP4) ou configura o Bunny Stream, que trata disso automaticamente.`;
  }

  return null;
}
