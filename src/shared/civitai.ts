export type LmPrefix = "loras" | "checkpoints" | "embeddings";

export type CivitaiPageRef = {
  modelId: number;
  /** null when the url names no version: the model's first version is meant */
  versionId: number | null;
};

export type CivitaiModel = {
  id: number;
  name: string;
  type: string;
  versions: { id: number; name: string }[];
};

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
      ? [{ id: r.id, name: typeof r.name === "string" ? r.name : String(r.id) }]
      : [];
  });
  return { id: o.id, name: o.name, type: o.type, versions };
}

export async function fetchCivitaiModel(origin: string, modelId: number): Promise<CivitaiModel> {
  const res = await fetch(`${origin}/api/v1/models/${modelId}`);
  if (!res.ok) throw new Error(`civitai: GET model ${modelId} → HTTP ${res.status}`);
  return parseCivitaiModel(await res.json());
}
