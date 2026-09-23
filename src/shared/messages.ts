// content/popup → background protocol. every LoRA Manager call crosses here
// (agent/architecture.md, "why the background owns every LM call")
import type { LmPrefix } from "src/shared/civitai.ts";
import type {
  DownloadProgress,
  FolderChoices,
  LibraryBatch,
  LibraryStatus,
  Ping,
} from "src/shared/lmClient.ts";
import type { FolderPick } from "src/shared/storage.ts";

export type DownloadTarget = {
  modelId: number;
  versionId: number;
  prefix: LmPrefix;
  folder: FolderPick;
  fileId: number | null;
};

export type Protocol = {
  lmVersion: { req: { url: string }; res: string };
  libraryStatus: { req: { modelId: number; versionId: number }; res: LibraryStatus };
  libraryBatch: { req: { modelIds: number[] }; res: LibraryBatch };
  folderChoices: { req: { prefix: LmPrefix }; res: FolderChoices };
  startDownload: { req: { target: DownloadTarget }; res: { downloadId: string } };
  progress: { req: { downloadId: string }; res: DownloadProgress };
  activeDownload: { req: { versionId: number }; res: string | null };
  ping: { req: Record<never, never>; res: Ping };
  restartComfy: { req: Record<never, never>; res: string };
  clearActive: { req: { versionId: number }; res: null };
};

export type Kind = keyof Protocol;
export type Request<K extends Kind = Kind> = { [P in K]: { kind: P } & Protocol[P]["req"] }[K];
export type Reply<K extends Kind> =
  | { ok: true; data: Protocol[K]["res"] }
  | { ok: false; error: string };

/** throws the background's error text, so callers surface it as is */
export async function send<K extends Kind>(req: Request<K>): Promise<Protocol[K]["res"]> {
  const reply = (await chrome.runtime.sendMessage(req)) as Reply<K> | undefined;
  if (reply == null) throw new Error(`no answer from the extension background for ${req.kind}`);
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
