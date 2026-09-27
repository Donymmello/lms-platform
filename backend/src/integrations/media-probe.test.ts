import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { probeMedia, rejectionReason } from "./media-probe";
import { buildMp4, mp4Track as track } from "../test/mp4";

/**
 * The fixtures are hand-built ISO base media files rather than real footage:
 * a few hundred bytes of correctly-nested atoms is enough to exercise the
 * parser, and it keeps binary blobs out of the repository.
 */

const written: string[] = [];

afterEach(async () => {
  await Promise.all(written.splice(0).map((file) => fs.unlink(file).catch(() => undefined)));
});

async function writeMp4(tracks: Buffer[], name = "aula.mp4"): Promise<string> {
  const filePath = path.join(os.tmpdir(), `probe-${randomUUID()}-${name}`);
  await fs.writeFile(filePath, buildMp4(tracks));
  written.push(filePath);
  return filePath;
}

describe("probeMedia", () => {
  it("finds both tracks in an ordinary H.264 file", async () => {
    const filePath = await writeMp4([track("vide", "avc1"), track("soun", "mp4a")]);

    const probe = await probeMedia(filePath, "aula.mp4");

    expect(probe.inspected).toBe(true);
    expect(probe.tracks).toEqual([
      { handler: "vide", codec: "avc1" },
      { handler: "soun", codec: "mp4a" },
    ]);
  });

  it("reads a moov that sits after the payload, as most exports produce", async () => {
    // The fixtures already place moov last, which is the case that would break
    // a parser that only looked at the head of the file.
    const filePath = await writeMp4([track("vide", "avc1")]);

    expect((await probeMedia(filePath, "aula.mp4")).tracks).toHaveLength(1);
  });

  it("does not claim to have inspected a container it cannot parse", async () => {
    const filePath = await writeMp4([track("vide", "avc1")], "aula.webm");

    const probe = await probeMedia(filePath, "aula.webm");

    // WebM is a different format entirely; saying "no video track" would be a lie.
    expect(probe.inspected).toBe(false);
    expect(probe.tracks).toEqual([]);
  });
});

describe("rejectionReason", () => {
  it("accepts H.264 with sound", async () => {
    const filePath = await writeMp4([track("vide", "avc1"), track("soun", "mp4a")]);

    expect(rejectionReason(await probeMedia(filePath, "aula.mp4"))).toBeNull();
  });

  it("rejects an audio-only file, saying so plainly", async () => {
    // Exactly the file that played sound over a blank frame.
    const filePath = await writeMp4([track("soun", "mp4a")]);

    const reason = rejectionReason(await probeMedia(filePath, "aula.mp4"));

    expect(reason).toContain("só tem áudio");
  });

  it("rejects HEVC, which is what phones record by default", async () => {
    const filePath = await writeMp4([track("vide", "hvc1"), track("soun", "mp4a")]);

    const reason = rejectionReason(await probeMedia(filePath, "aula.mp4"));

    expect(reason).toContain("H.265");
    // The message has to say what to do about it, not just that it failed.
    expect(reason).toContain("H.264");
  });

  it("rejects Apple ProRes", async () => {
    const filePath = await writeMp4([track("vide", "apcn")]);

    expect(rejectionReason(await probeMedia(filePath, "aula.mp4"))).toContain("ProRes");
  });

  it("lets an uninspected container through rather than guessing", async () => {
    const filePath = await writeMp4([track("soun", "mp4a")], "aula.webm");

    expect(rejectionReason(await probeMedia(filePath, "aula.webm"))).toBeNull();
  });
});
