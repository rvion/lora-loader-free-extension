// the only module that knows LoRA Manager's wire shapes (agent/lora-manager-api.md)
import type { LmPrefix } from "src/shared/civitai.ts";

/** fileId: the civitai file LoRA Manager matched it to, null when its cached civitai data has no file list
 *  (after any restart). sha256: looked up only then, from LoRA Manager's model list */
export type LocalFile = {
  fileId: number | null;
  fileName: string;
  filePath: string;
  sha256: string | null;
};

export type LibraryStatus =
  | { exists: false }
  | { exists: true; modelType: string; files: LocalFile[] };

export type FolderChoices = { roots: string[]; folders: string[] };

export type LocalVersion = { versionId: number; name: string; fileName: string };

/** models present in the library, by civitai model id. absent ids are simply missing */
export type LibraryBatch = Record<string, { modelType: string; versions: LocalVersion[] }>;

export type DownloadRequest = {
  downloadId: string;
  /** a civitai file id, null lets LoRA Manager take the primary file */
  fileId: number | null;
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

export type Ping = { up: false } | { up: true; version: string };

const PING_TIMEOUT_MS = 3000;
/** an unreachable network host never refuses: without a deadline a read hangs until the OS connect timeout (~50 s) */
const READ_TIMEOUT_MS = 5000;

/** newest first. ComfyUI mirrors every custom route under /api, older builds do not */
const RESTART_ROUTES = [
  { method: "POST", path: "/api/manager/reboot" },
  { method: "POST", path: "/manager/reboot" },
  { method: "GET", path: "/api/manager/reboot" },
  { method: "GET", path: "/manager/reboot" },
] as const;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class LmClient {
  readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private fetchFn: FetchFn = (input, init) => fetch(input, init),
    private readTimeoutMs = READ_TIMEOUT_MS,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  /** never throws: a hung or refused server is simply down */
  async ping(): Promise<Ping> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/lm/version-info`, {
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      });
      if (!res.ok) return { up: false };
      const o = await readJson(res);
      return { up: true, version: typeof o.version === "string" ? o.version : "unknown" };
    } catch {
      return { up: false };
    }
  }

  /** asks ComfyUI-Manager to restart ComfyUI (core ComfyUI has no such route) */
  async restartComfy(): Promise<string> {
    for (const r of RESTART_ROUTES) {
      let res: Response;
      try {
        res = await this.fetchFn(`${this.baseUrl}${r.path}`, {
          method: r.method,
          headers: r.method === "POST" ? { "Content-Type": "application/json" } : {},
        });
      } catch {
        // the process died while answering: the restart is under way
        return `${r.method} ${r.path}`;
      }
      if (res.status === 404 || res.status === 405) continue;
      if (res.status === 403)
        throw new Error(
          "ComfyUI-Manager refused the restart: set its security_level to normal (ComfyUI-Manager config.ini)",
        );
      if (!res.ok) throw new Error(`restart: ${errorText(await readJson(res), res.status)}`);
      return `${r.method} ${r.path}`;
    }
    throw new Error(
      "no restart route: install the ComfyUI-Manager custom node to restart from here",
    );
  }

  async version(): Promise<string> {
    const o = await this.getJson("/api/lm/version-info");
    return typeof o.version === "string" ? o.version : "unknown";
  }

  async libraryStatus(modelId: number, versionId: number): Promise<LibraryStatus> {
    const q = new URLSearchParams({ modelId: String(modelId), modelVersionId: String(versionId) });
    const o = await this.getJson(`/api/lm/check-model-exists?${q}`);
    if (o.success !== true) throw new Error(`LoRA Manager: ${errorText(o)}`);
    if (o.exists !== true) return { exists: false };
    const files = (Array.isArray(o.downloadedFiles) ? o.downloadedFiles : []).flatMap(
      (f: unknown): LocalFile[] => {
        if (typeof f !== "object" || f == null) return [];
        const r = f as Record<string, unknown>;
        if (typeof r.filePath !== "string") return [];
        const fileName =
          typeof r.fileName === "string"
            ? r.fileName
            : (r.filePath.split(/[\\/]/).pop() ?? r.filePath);
        const fileId = typeof r.fileId === "number" ? r.fileId : null;
        return [{ fileId, fileName, filePath: r.filePath, sha256: null }];
      },
    );
    const modelType = String(o.modelType ?? "model");
    const prefix = PREFIX_BY_LM_TYPE[modelType];
    if (prefix != null)
      await Promise.all(
        files
          .filter((f) => f.fileId == null)
          .map(async (f) => (f.sha256 = await this.localSha256(prefix, f.filePath))),
      );
    return { exists: true, modelType, files };
  }

  /** null when LoRA Manager's list does not answer or has no such path: the file then stays unmatched */
  private async localSha256(prefix: LmPrefix, filePath: string): Promise<string | null> {
    const stem = (filePath.split(/[\\/]/).pop() ?? filePath).replace(/\.[^.]+$/, "");
    const q = new URLSearchParams({ page: "1", page_size: "20", search: stem });
    try {
      const o = await this.getJson(`/api/lm/${prefix}/list?${q}`);
      for (const it of Array.isArray(o.items) ? o.items : []) {
        if (typeof it !== "object" || it == null) continue;
        const r = it as Record<string, unknown>;
        if (r.file_path === filePath && typeof r.sha256 === "string") return r.sha256.toLowerCase();
      }
    } catch {
      // an unmatched file only loses its ✓ have, never the status itself
    }
    return null;
  }

  async libraryBatch(modelIds: number[]): Promise<LibraryBatch> {
    const out: LibraryBatch = {};
    if (modelIds.length === 0) return out;
    const o = await this.getJson(`/api/lm/check-models-exist?modelIds=${modelIds.join(",")}`);
    if (o.success !== true) throw new Error(`LoRA Manager: ${errorText(o)}`);
    for (const r of Array.isArray(o.results) ? o.results : []) {
      if (typeof r !== "object" || r == null) continue;
      const row = r as Record<string, unknown>;
      const versions = Array.isArray(row.versions) ? row.versions : [];
      if (typeof row.modelId === "number" && versions.length > 0)
        out[String(row.modelId)] = {
          modelType: String(row.modelType ?? "model"),
          versions: versions.flatMap((v: unknown) => {
            if (typeof v !== "object" || v == null) return [];
            const r = v as Record<string, unknown>;
            if (typeof r.versionId !== "number") return [];
            return [
              {
                versionId: r.versionId,
                name: typeof r.name === "string" ? r.name : String(r.versionId),
                fileName: typeof r.fileName === "string" ? r.fileName : "",
              },
            ];
          }),
        };
    }
    return out;
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
        ...(p.fileId != null ? { file_params: { id: p.fileId } } : {}),
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
    const route = path.split("?")[0];
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.readTimeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError")
        throw new Error(
          `LoRA Manager GET ${route}: did not answer in ${this.readTimeoutMs / 1000} s at ${this.baseUrl}`,
        );
      throw e;
    }
    const o = await readJson(res);
    if (!res.ok) throw new Error(`LoRA Manager GET ${route}: ${errorText(o, res.status)}`);
    return o;
  }
}

const PREFIX_BY_LM_TYPE: Record<string, LmPrefix> = {
  lora: "loras",
  checkpoint: "checkpoints",
  embedding: "embeddings",
};

/** by civitai file id, else by SHA256. names never work: civitai's api, LoRA Manager and the disk each use their own */
export function ownsFile(files: LocalFile[], file: { id: number; sha256: string | null }): boolean {
  return files.some(
    (f) => f.fileId === file.id || (file.sha256 != null && f.sha256 === file.sha256),
  );
}

/** LoRA Manager refuses a file (or, without file_params, a version) it already has */
export function alreadyInLibrary(message: string): boolean {
  return /already exists in \w+ library/.test(message);
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  // scheme detection runs before any slash trimming: "http://" must stay hostless and throw
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(`unsupported scheme ${url.protocol}`);
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
