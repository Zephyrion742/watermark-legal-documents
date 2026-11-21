import assert from "node:assert/strict";
import { deliverWatermarkedDocument } from "../src/watermark_service.js";

const calls: Array<{ method: string; path: string; body?: unknown }> = [];
const fake = { request: async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  calls.push({ method, path, body });
  if (path === "/v1/pdf/watermark") return { url: "https://watermarked.example/file.pdf" } as T;
  return { url: "https://signed.example/file" } as T;
} } as never;
globalThis.fetch = async (url, init) => {
  if (url === "https://watermarked.example/file.pdf") {
    assert.equal(init?.method, undefined);
    return new Response("%PDF-watermarked", { status: 200 });
  }
  assert.equal(url, "https://signed.example/file");
  assert.equal(init?.method, "PUT");
  assert.equal(Buffer.from(init?.body as ArrayBuffer).toString(), "%PDF-watermarked");
  return new Response(null, { status: 200 });
};
const out = await deliverWatermarkedDocument({ matterId: "m-7", pdf: "raw", recipient: "a@b.test" }, fake, "bucket");
assert.equal(out.matterId, "m-7");
assert.equal(out.expiresSeconds, 900);
assert.equal(calls.filter((c) => c.path.includes("storage/object/presign")).length, 2);
assert.equal(calls.find((c) => c.path === "/v1/pdf/watermark")?.body && (calls.find((c) => c.path === "/v1/pdf/watermark")!.body as { text: string }).text.includes("m-7"), true);
console.log("watermark decision test passed");
