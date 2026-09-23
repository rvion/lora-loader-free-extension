import type { DownloadProgress } from "src/shared/lmClient.ts";
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
  /** false once the caller moved on: the loop stops at its next await */
  isAlive: () => boolean;
  onState: (s: DownloadState) => void;
};

/** polls until the version is in the library or the download failed */
export function watchDownload(p: WatchParams): void {
  let unknownTicks = 0;
  const finish = async (s: DownloadState): Promise<void> => {
    await send({ kind: "clearActive", versionId: p.versionId });
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
        if (status.exists) return finish({ kind: "done" });
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
