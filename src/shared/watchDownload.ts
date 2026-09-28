import type { DownloadProgress, LibraryStatus } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";

export type DownloadState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; percent: number; stage: string | null }
  | { kind: "failed"; message: string }
  | { kind: "done" };

const POLL_MS = 1000;
/** a download waiting behind LM's 5 slot semaphore has no progress entry yet, so unknown is normal for a while */
const MAX_UNKNOWN_TICKS = 1800;

export type WatchParams = {
  modelId: number;
  versionId: number;
  downloadId: string;
  /** fileKey of the download: the active entry to clear */
  key: string;
  /** the civitai file id, null when LoRA Manager picked the file */
  fileId: number | null;
  /** false once the caller moved on: the loop stops at its next await */
  isAlive: () => boolean;
  onState: (s: DownloadState) => void;
};

/** a version with two variants exists as soon as the first lands: the second is done only once its own file id is listed.
 *  names differ between LoRA Manager and civitai's page data, the file id does not.
 *  an id LoRA Manager forgot means it finished long ago, so the version existing is enough then */
export function isFileDone(
  progress: DownloadProgress,
  status: LibraryStatus,
  fileId: number | null,
): boolean {
  if (!status.exists) return false;
  if (fileId == null || progress.kind === "unknown") return true;
  return status.files.some((f) => f.fileId === fileId);
}

/** polls until the file is in the library or the download failed */
export function watchDownload(p: WatchParams): void {
  let unknownTicks = 0;
  const finish = async (s: DownloadState): Promise<void> => {
    await send({ kind: "clearActive", key: p.key });
    if (p.isAlive()) p.onState(s);
  };
  const tick = async (): Promise<void> => {
    if (!p.isAlive()) return;
    let progress: DownloadProgress;
    try {
      progress = await send({ kind: "progress", downloadId: p.downloadId });
    } catch (e) {
      if (p.isAlive()) p.onState({ kind: "failed", message: errorMessage(e) });
      return;
    }
    if (!p.isAlive()) return;
    if (progress.kind === "failed") return finish({ kind: "failed", message: progress.message });
    if (progress.kind === "unknown" && ++unknownTicks > MAX_UNKNOWN_TICKS)
      return finish({
        kind: "failed",
        message: "LoRA Manager has no record of this download any more",
      });
    const maybeDone =
      progress.kind === "unknown" || (progress.percent >= 100 && progress.stage == null);
    if (maybeDone) {
      try {
        const status = await send({
          kind: "libraryStatus",
          modelId: p.modelId,
          versionId: p.versionId,
        });
        if (isFileDone(progress, status, p.fileId)) return finish({ kind: "done" });
      } catch {
        // a transient check failure is retried on the next tick
      }
      if (!p.isAlive()) return;
    }
    p.onState(
      progress.kind === "running"
        ? { kind: "running", percent: progress.percent, stage: progress.stage }
        : { kind: "running", percent: 0, stage: "queued" },
    );
    setTimeout(() => void tick(), POLL_MS);
  };
  void tick();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
