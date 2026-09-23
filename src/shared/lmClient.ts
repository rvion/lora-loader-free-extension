// the only module that knows LoRA Manager's wire shapes (agent/lora-manager-api.md)
import type { LmPrefix } from "src/shared/civitai.ts";

export type LibraryStatus = { exists: false } | { exists: true; modelType: string };

export type FolderChoices = { roots: string[]; folders: string[] };

export type DownloadRequest = {
  downloadId: string;
  modelId: number;
  versionId: number;
  root: string;
  sub: string;
};

export type DownloadProgress =
  | { kind: "running"; percent: number; stage: string | null }
  | { kind: "failed"; message: string }
  /** the server no longer knows this id: finished long ago, or never started */
  | { kind: "unknown" };

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class LmClient {
  readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private fetchFn: FetchFn = (input, init) => fetch(input, init),
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async version(): Promise<string> {
    const o = await this.getJson("/api/lm/version-info");
    return typeof o.version === "string" ? o.version : "unknown";
  }

  async libraryStatus(modelId: number, versionId: number): Promise<LibraryStatus> {
    const q = new URLSearchParams({ modelId: String(modelId), modelVersionId: String(versionId) });
    const o = await this.getJson(`/api/lm/check-model-exists?${q}`);
    if (o.success !== true) throw new Error(`LoRA Manager: ${errorText(o)}`);
    return o.exists === true
      ? { exists: true, modelType: String(o.modelType ?? "model") }
      : { exists: false };
  }

  async folderChoices(prefix: LmPrefix): Promise<FolderChoices> {
    const [r, f] = await Promise.all([
      this.getJson(`/api/lm/${prefix}/roots`),
      this.getJson(`/api/lm/${prefix}/folders`),
    ]);
    return { roots: stringArray(r.roots), folders: stringArray(f.folders).filter((s) => s !== "") };
  }

  /** resolves only when the file is fully downloaded (or failed) */
  async download(p: DownloadRequest): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/api/lm/download-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        download_id: p.downloadId,
        model_id: p.modelId,
        model_version_id: p.versionId,
        model_root: p.root,
        relative_path: p.sub,
        use_default_paths: false,
      }),
    });
    const o = await readJson(res);
    if (!res.ok || o.success !== true)
      throw new Error(`LoRA Manager download: ${errorText(o, res.status)}`);
  }

  async progress(downloadId: string): Promise<DownloadProgress> {
    const res = await this.fetchFn(
      `${this.baseUrl}/api/lm/download-progress/${encodeURIComponent(downloadId)}`,
    );
    if (res.status === 404) return { kind: "unknown" };
    const o = await readJson(res);
    if (!res.ok) throw new Error(`LoRA Manager progress: ${errorText(o, res.status)}`);
    if (o.status === "failed" || o.status === "cancelled")
      return {
        kind: "failed",
        message: typeof o.message === "string" ? o.message : String(o.status),
      };
    const percent = typeof o.progress === "number" ? o.progress : 0;
    const stage =
      typeof o.stage === "string" ? o.stage : typeof o.message === "string" ? o.message : null;
    return { kind: "running", percent, stage };
  }

  private async getJson(path: string): Promise<Record<string, unknown>> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`);
    const o = await readJson(res);
    if (!res.ok)
      throw new Error(`LoRA Manager GET ${path.split("?")[0]}: ${errorText(o, res.status)}`);
    return o;
  }
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`);
  return url.origin;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    const text = (await res.text()).slice(0, 200);
    return { error: text !== "" ? text : `HTTP ${res.status}` };
  }
  const json: unknown = await res.json();
  return typeof json === "object" && json != null ? (json as Record<string, unknown>) : {};
}

function errorText(o: Record<string, unknown>, status?: number): string {
  if (typeof o.error === "string" && o.error !== "") return o.error;
  return status != null ? `HTTP ${status}` : "unknown error";
}

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}
