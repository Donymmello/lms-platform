import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env";
import { bunnyStream } from "./bunny-stream";

/**
 * Exercises the Bunny client itself, which every other test mocks away. The
 * network is faked at `fetch`, but the file on disk is real — that is the
 * whole point, since what is being checked is how the body reaches the wire.
 */

const tempFiles: string[] = [];

async function writeTempVideo(bytes: number): Promise<string> {
  const filePath = path.join(os.tmpdir(), `bunny-test-${randomUUID()}.mp4`);
  // A recognisable, non-repeating payload so a truncated or reordered body
  // would change the hash.
  await fs.writeFile(filePath, Buffer.from(Array.from({ length: bytes }, (_, i) => i % 251)));
  tempFiles.push(filePath);
  return filePath;
}

/** Drains whatever `fetch` was handed, so the assertions can look at real bytes. */
async function readBody(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * `config/env` parses `process.env` once, at import, into a plain object — so
 * `vi.stubEnv` after the fact changes nothing. The credentials for these tests
 * come from vitest.config.ts; the one case that needs them missing edits that
 * object directly and puts it back.
 */
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempFiles.splice(0).map((file) => fs.unlink(file).catch(() => undefined)));
});

describe("uploadVideoFile", () => {
  it("streams the file instead of buffering it, and sends every byte", async () => {
    const filePath = await writeTempVideo(64 * 1024);
    const expected = await fs.readFile(filePath);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await bunnyStream.uploadVideoFile("video-guid", filePath);

    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];

    // A Buffer body would mean the whole file sat in memory; a stream does not.
    expect(Buffer.isBuffer(init.body)).toBe(false);
    expect(typeof (init.body as { getReader?: unknown })?.getReader).toBe("function");

    // Sized, not chunked — the bytes on the wire stay identical to before.
    expect((init.headers as Record<string, string>)["Content-Length"]).toBe(String(expected.length));

    const sent = await readBody(init.body);
    expect(createHash("sha256").update(sent).digest("hex")).toBe(
      createHash("sha256").update(expected).digest("hex")
    );
  });

  it("sends the library credentials and targets the video's URL", async () => {
    const filePath = await writeTempVideo(128);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await bunnyStream.uploadVideoFile("abc-123", filePath);

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain(`/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/abc-123`);
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).AccessKey).toBe(env.BUNNY_STREAM_API_KEY);
  });

  it("turns a rejection from Bunny into a 502 rather than a silent success", async () => {
    const filePath = await writeTempVideo(128);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("quota exceeded", { status: 507 })
    );

    await expect(bunnyStream.uploadVideoFile("abc-123", filePath)).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it("refuses to upload at all when the library is not configured", async () => {
    const filePath = await writeTempVideo(128);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const realKey = env.BUNNY_STREAM_API_KEY;
    env.BUNNY_STREAM_API_KEY = "";

    try {
      await expect(bunnyStream.uploadVideoFile("abc-123", filePath)).rejects.toMatchObject({
        statusCode: 503,
      });
      // Nothing should have been sent, least of all the file.
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      env.BUNNY_STREAM_API_KEY = realKey;
    }
  });
});
