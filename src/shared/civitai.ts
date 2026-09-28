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

export type CivitaiVersion = {
  id: number;
  name: string;
  baseModel: string | null;
  /** iso date, null when civitai gives none */
  publishedAt: string | null;
  files: CivitaiFile[];
};

export type CivitaiModel = {
  id: number;
  name: string;
  type: string;
  /** lowercased */
  tags: string[];
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

export function formatSize(kb: number): string {
  return kb >= 1024 * 1024 ? `${(kb / 1024 / 1024).toFixed(1)} GB` : `${Math.round(kb / 1024)} MB`;
}

/** the short name of a variant, as the chip shows it: bf16, int8, pruned… */
export function variantName(f: CivitaiFile): string {
  const v = f.fp ?? f.size ?? f.format ?? f.name;
  return f.type !== "Model" ? `${f.type} ${v}` : v;
}

/** one civitai file to download. fileId null: the version has no weight file listed, LoRA Manager picks */
export type FilePick = { versionId: number; fileId: number | null };

/** jobs, marks and active downloads are keyed per file: two variants of a version are two downloads */
export function fileKey(p: FilePick): string {
  return `${p.versionId}:${p.fileId ?? ""}`;
}

export function defaultPicks(v: CivitaiVersion): FilePick[] {
  return [{ versionId: v.id, fileId: weightFiles(v)[0]?.id ?? null }];
}

/** the versions a chip of this base model can pick files from, latest first */
export function sameBase(versions: CivitaiVersion[], v: CivitaiVersion): CivitaiVersion[] {
  return versions
    .filter((x) => x.baseModel === v.baseModel)
    .sort((a, b) => (isLater(a, b) ? -1 : 1));
}

export function pickedFile(
  versions: CivitaiVersion[],
  p: FilePick,
): { version: CivitaiVersion; file: CivitaiFile | null } | null {
  const version = versions.find((v) => v.id === p.versionId);
  if (version == null) return null;
  return { version, file: version.files.find((f) => f.id === p.fileId) ?? null };
}

/** agent/spec.md "listing cards": what Get downloads, its size, and how many files there are to pick from */
export function picksLabel(
  picks: FilePick[],
  versions: CivitaiVersion[],
  chipVersion: CivitaiVersion,
): string {
  const resolved = picks.flatMap((p) => pickedFile(versions, p) ?? []);
  const total = sameBase(versions, chipVersion).reduce((n, v) => n + weightFiles(v).length, 0);
  const kb = resolved.reduce((n, r) => n + (r.file?.sizeKB ?? 0), 0);
  const size = kb > 0 ? formatSize(kb) : null;
  const one = resolved.length === 1 ? resolved[0] : undefined;
  const what =
    one != null
      ? [
          one.version.id !== chipVersion.id ? one.version.name : null,
          one.file != null ? variantName(one.file) : null,
        ]
          .filter((x): x is string => x != null)
          .join(" ")
      : `${resolved.length} files`;
  const parts = [what, size, total > 1 ? `${resolved.length} of ${total}` : null];
  return parts.filter((x): x is string => x != null && x !== "").join(" · ");
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
            baseModel: typeof r.baseModel === "string" && r.baseModel !== "" ? r.baseModel : null,
            publishedAt:
              typeof r.publishedAt === "string" && r.publishedAt !== "" ? r.publishedAt : null,
            files: parseFiles(r.files),
          },
        ]
      : [];
  });
  const tags = (Array.isArray(o.tags) ? o.tags : []).flatMap((t: unknown) => {
    const name =
      typeof t === "string"
        ? t
        : typeof t === "object" && t != null
          ? (t as { name?: unknown }).name
          : null;
    return typeof name === "string" && name !== "" ? [name.toLowerCase()] : [];
  });
  return { id: o.id, name: o.name, type: o.type, tags, versions };
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

/** up to 100 models in one call; models civitai does not return are simply absent */
export async function fetchCivitaiModels(
  origin: string,
  ids: number[],
): Promise<Map<number, CivitaiModel>> {
  const out = new Map<number, CivitaiModel>();
  if (ids.length === 0) return out;
  const res = await fetch(`${origin}/api/v1/models?ids=${ids.join(",")}&limit=100&nsfw=true`);
  if (!res.ok) throw new Error(`civitai: GET models → HTTP ${res.status}`);
  const json: unknown = await res.json();
  const items =
    typeof json === "object" && json != null ? (json as { items?: unknown }).items : null;
  for (const it of Array.isArray(items) ? items : []) {
    try {
      const m = parseCivitaiModel(it);
      out.set(m.id, m);
    } catch {
      // one malformed item must not hide the others
    }
  }
  return out;
}

/** agent/spec.md "newer versions": same base model, published later; the latest such wins */
export function newerVersion(
  versions: CivitaiVersion[],
  localIds: number[],
): CivitaiVersion | null {
  const local = new Set(localIds);
  const mine = versions.filter((v) => local.has(v.id));
  let best: CivitaiVersion | null = null;
  for (const v of versions) {
    if (local.has(v.id)) continue;
    if (!mine.some((m) => m.baseModel === v.baseModel && isLater(v, m))) continue;
    if (best == null || isLater(v, best)) best = v;
  }
  return best;
}

function isLater(a: CivitaiVersion, b: CivitaiVersion): boolean {
  if (a.publishedAt != null && b.publishedAt != null && a.publishedAt !== b.publishedAt)
    return a.publishedAt > b.publishedAt;
  return a.id > b.id;
}

export type BaseGroup = {
  /** civitai's base model name, null when it gives none */
  base: string | null;
  /** the latest version for this base */
  latest: CivitaiVersion;
  /** the latest version for this base that is in the library, null when none is */
  have: CivitaiVersion | null;
};

/** one group per base model, in civitai's order of first appearance */
export function baseGroups(versions: CivitaiVersion[], localIds: number[]): BaseGroup[] {
  const local = new Set(localIds);
  const groups = new Map<string, BaseGroup>();
  for (const v of versions) {
    const key = v.baseModel ?? "";
    const g = groups.get(key);
    const mine = local.has(v.id) ? v : null;
    if (g == null) {
      groups.set(key, { base: v.baseModel, latest: v, have: mine });
      continue;
    }
    if (isLater(v, g.latest)) g.latest = v;
    if (mine != null && (g.have == null || isLater(mine, g.have))) g.have = mine;
  }
  return [...groups.values()];
}

export function hasNewer(g: BaseGroup): boolean {
  return g.have != null && g.have.id !== g.latest.id && isLater(g.latest, g.have);
}
