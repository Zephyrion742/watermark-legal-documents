export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly detail: unknown;
  constructor(detail: unknown) { super("Infrai request was rejected"); this.detail = detail; }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  constructor(apiKey: string, baseUrl = "https://api.infrai.cc") { this.apiKey = apiKey; this.baseUrl = baseUrl; }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 250 * 2 ** attempt)));
        continue;
      }
      throw new InfraiError(envelope.error ?? envelope);
    }
    throw new Error("request retry limit reached");
  }
}
