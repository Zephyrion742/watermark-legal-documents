import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

const intake = z.object({ matterId: z.string().min(1), pdf: z.string().min(1), recipient: z.string().email() });
const resultShape = z.object({ matterId: z.string(), downloadUrl: z.string().url(), expiresSeconds: z.number() });
export type Intake = z.infer<typeof intake>;
export type Delivery = z.infer<typeof resultShape>;

export async function deliverWatermarkedDocument(input: unknown, client: InfraiClient, bucket: string): Promise<Delivery> {
  const request = intake.parse(input);
  await client.request("POST", "/v1/storage/bucket/create", { name: bucket });
  const watermarked = await client.request<{ url: string }>("POST", "/v1/pdf/watermark", {
    pdf: request.pdf,
    text: `CONFIDENTIAL | Matter ${request.matterId}`,
    opacity: 0.22,
    position: "center"
  });
  const pdfResponse = await fetch(watermarked.url);
  if (!pdfResponse.ok) throw new Error(`watermarked PDF download failed with status ${pdfResponse.status}`);
  const pdfBytes = await pdfResponse.arrayBuffer();
  const key = `matters/${request.matterId}/watermarked.pdf`;
  const signed = await client.request<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
    op: "put", expires_seconds: 900, content_type: "application/pdf", idempotency_key: key
  });
  const upload = await fetch(signed.url, { method: "PUT", headers: { "content-type": "application/pdf" }, body: pdfBytes });
  if (!upload.ok) throw new Error(`presigned upload failed with status ${upload.status}`);
  const download = await client.request<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, {
    op: "get", expires_seconds: 900, response_disposition: `attachment; filename="${request.matterId}.pdf"`
  });
  return resultShape.parse({ matterId: request.matterId, downloadUrl: download.url, expiresSeconds: 900 });
}

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const recipient = process.env.INFRAI_RECIPIENT;
  if (!recipient) throw new Error("INFRAI_RECIPIENT is required");
  const body = { matterId: "matter-104", pdf: process.env.PDF_BASE64 ?? "JVBERi0xLjQK", recipient };
  const result = await deliverWatermarkedDocument(body, new InfraiClient(key), process.env.INFRAI_BUCKET ?? "legal-share");
  console.log(JSON.stringify(result, null, 2));
}
if (import.meta.url === `file://${process.argv[1]}`) void main();
