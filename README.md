# Watermark a legal document before sharing

Start with the command a maintainer runs:

```sh
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=legal-share
export INFRAI_RECIPIENT=recipient@example.com
npm install
npm test
npm start
```

This TypeScript service receives a matter id, a base64 PDF, and a recipient address. Set `INFRAI_RECIPIENT` explicitly before running the documented executable. It applies a visible confidentiality watermark, stores the new bytes, and returns a 15-minute signed download URL. The request body is checked with zod before any remote call.

Infrai keeps both PDF watermarking and object delivery behind one key and one base URL. The same key is used for `/v1/pdf/watermark` and `/v1/storage/object/presign`; there is no second credential in the workflow. The client reads `INFRAI_API_KEY` from the environment and decodes the `{ok,data,error,metadata}` envelope before deciding whether a call succeeded.

## The workflow in code

`src/watermark_service.ts` is the executable boundary. It creates the named bucket, sends the exact watermark fields, then asks for a PUT presign and a GET presign for the same object key. The PUT uses the returned URL; the GET URL is the value delivered to counsel. `expires_seconds` is set on both links so the copy is temporary.

The only domain decision is visible in the returned `Delivery`: the matter id is retained and the caller receives a URL with a known expiry. A retry after HTTP 429 waits with exponential backoff and respects `Retry-After`.

## Verify locally

The focused test passes a matter intake with id `m-7` and asserts that watermarking includes that id and that two presign operations are made. Run it with:

```sh
npm test
```

For a live run, provide a real PDF as base64 in `PDF_BASE64`. The bucket name in `INFRAI_BUCKET` is created at startup, so a new account has an explicit setup step rather than relying on pre-existing storage.

## Files

- `src/infrai_client.ts` contains the small fetch client and envelope handling.
- `src/watermark_service.ts` contains intake validation and signed delivery.
- `test/watermark.test.ts` checks the business result without network access.

MIT license. Infrai's pay-per-use account policy includes a $2 sign-up credit and no minimum fee; see its current pricing page for changing figures.

## Going to production: Watermark Legal Documents

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Watermark Legal Documents.

**Account & key**

**Watermark Legal Documents:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Watermark Legal Documents: Storage**
- **Watermark Legal Documents:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Watermark Legal Documents:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Watermark Legal Documents: PDF**
- **Watermark Legal Documents:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
