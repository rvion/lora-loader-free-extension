export type LmPrefix = "loras" | "checkpoints" | "embeddings";

export type CivitaiPageRef = {
  modelId: number;
  /** null when the url names no version: the model's first version is meant */
  versionId: number | null;
};

export type CivitaiFile = {
  id: number;
  name: string;
  type: string;
  sizeKB: number | null;
  primary: boolean;
  fp: string | null;
  size: string | null;
  format: string | null;
};

export type CivitaiVersion = { id: number; name: string; files: CivitaiFile[] };

export type CivitaiModel = {
  id: number;
  name: string;
  type: string;
  versions: CivitaiVersion[];
};

/** mirrors MODEL_WEIGHT_FILE_TYPES in LoRA Manager's py/utils/constants.py */
const WEIGHT_FILE_TYPES = new Set([
  "Model",
  "Pruned Model",
  "Negative",
  "UNet",
  "Diffusion Model",
  "Enhancement LoRA",
]);

/** the files a download can pick between, primary first */
export function weightFiles(v: CivitaiVersion): CivitaiFile[] {
  return v.files
    .filter((f) => WEIGHT_FILE_TYPES.has(f.type))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

export function fileLabel(f: CivitaiFile): string {
  const parts = [f.fp, f.size, f.format].filter((s): s is string => s != null && s !== "");
  if (f.type !== "Model") parts.unshift(f.type);
  if (f.sizeKB != null) parts.push(formatSize(f.sizeKB));
  return parts.length > 0 ? parts.join(" · ") : f.name;
}

function formatSize(kb: number): string {
  return kb >= 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(kb / 1024)} MB`;
}

/** a model id from any link civitai renders: relative or absolute, with or without slug */
export function modelIdFromHref(href: string): number | null {
  const m = /^(?:https?:\/\/(?:www\.)?civitai\.(?:com|red))?\/models\/(\d+)(?:[/?#]|$)/.exec(href);
  return m?.[1] != null ? Number(m[1]) : null;
}

export const CIVITAI_HOSTS = ["civitai.com", "civitai.red"] as const;

export function parseCivitaiModelUrl(href: string): CivitaiPageRef | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (!CIVITAI_HOSTS.some((h) => h === host)) return null;
  const m = /^\/models\/(\d+)(?:\/|$)/.exec(url.pathname);
  if (m?.[1] == null) return null;
  const rawVersion = url.searchParams.get("modelVersionId");
  const versionId = rawVersion != null && /^\d+$/.test(rawVersion) ? Number(rawVersion) : null;
  return { modelId: Number(m[1]), versionId };
}

const PREFIX_BY_TYPE: Record<string, LmPrefix> = {
  lora: "loras",
  locon: "loras",
  dora: "loras",
  checkpoint: "checkpoints",
  textualinversion: "embeddings",
};

export function lmPrefixForCivitaiType(type: string): LmPrefix | null {
  return PREFIX_BY_TYPE[type.toLowerCase()] ?? null;
}

export function parseCivitaiModel(json: unknown): CivitaiModel {
  if (typeof json !== "object" || json == null)
    throw new Error("civitai: model answer is not an object");
  const o = json as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.name !== "string" || typeof o.type !== "string")
    throw new Error("civitai: model answer lacks id, name or type");
  const rawVersions = Array.isArray(o.modelVersions) ? o.modelVersions : [];
  const versions = rawVersions.flatMap((v: unknown) => {
    if (typeof v !== "object" || v == null) return [];
    const r = v as Record<string, unknown>;
    return typeof r.id === "number"
      ? [
          {
            id: r.id,
            name: typeof r.name === "string" ? r.name : String(r.id),
            files: parseFiles(r.files),
          },
        ]
      : [];
  });
  return { id: o.id, name: o.name, type: o.type, versions };
}

function parseFiles(raw: unknown): CivitaiFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f: unknown) => {
    if (typeof f !== "object" || f == null) return [];
    const r = f as Record<string, unknown>;
    if (typeof r.id !== "number") return [];
    const meta =
      typeof r.metadata === "object" && r.metadata != null
        ? (r.metadata as Record<string, unknown>)
        : {};
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return [
      {
        id: r.id,
        name: str(r.name) ?? String(r.id),
        type: str(r.type) ?? "Model",
        sizeKB: typeof r.sizeKB === "number" ? r.sizeKB : null,
        primary: r.primary === true,
        fp: str(meta.fp),
        size: str(meta.size),
        format: str(meta.format),
      },
    ];
  });
}

export async function fetchCivitaiModel(origin: string, modelId: number): Promise<CivitaiModel> {
  const res = await fetch(`${origin}/api/v1/models/${modelId}`);
  if (!res.ok) throw new Error(`civitai: GET model ${modelId} → HTTP ${res.status}`);
  return parseCivitaiModel(await res.json());
}
