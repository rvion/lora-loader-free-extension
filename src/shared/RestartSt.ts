import { makeAutoObservable, runInAction } from "mobx";

import type { Ping } from "src/shared/lmClient.ts";
import { errorMessage } from "src/shared/watchDownload.ts";

export type RestartPhase =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "sending" }
  | { kind: "goingDown"; seconds: number }
  | { kind: "comingBack"; seconds: number }
  | { kind: "back"; seconds: number; version: string }
  | { kind: "failed"; message: string };

export type RestartDeps = {
  restart: () => Promise<string>;
  ping: () => Promise<Ping>;
  onBack?: () => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const DOWN_POLL_MS = 500;
const UP_POLL_MS = 1000;
const MAX_WAIT_DOWN_MS = 30_000;
const MAX_WAIT_UP_MS = 300_000;

/** restart ComfyUI, then watch it stop and come back. down is required first: an unchanged server proves nothing */
export class RestartSt {
  phase: RestartPhase = { kind: "idle" };
  private generation = 0;

  constructor(private deps: RestartDeps) {
    makeAutoObservable<RestartSt, "deps" | "generation">(this, { deps: false, generation: false });
  }

  get isBusy(): boolean {
    const k = this.phase.kind;
    return k === "sending" || k === "goingDown" || k === "comingBack";
  }

  ask(): void {
    if (!this.isBusy) this.phase = { kind: "confirming" };
  }

  cancel(): void {
    if (this.phase.kind === "confirming") this.phase = { kind: "idle" };
  }

  dispose(): void {
    this.generation++;
  }

  setPhase(gen: number, p: RestartPhase): void {
    if (gen === this.generation) this.phase = p;
  }

  async confirm(): Promise<void> {
    const gen = ++this.generation;
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const now = this.deps.now ?? (() => Date.now());
    const alive = () => gen === this.generation;
    this.phase = { kind: "sending" };
    try {
      await this.deps.restart();
    } catch (e) {
      this.setPhase(gen, { kind: "failed", message: errorMessage(e) });
      return;
    }
    const start = now();
    const secs = () => Math.round((now() - start) / 1000);

    for (;;) {
      if (!alive()) return;
      if (now() - start > MAX_WAIT_DOWN_MS) {
        this.setPhase(gen, {
          kind: "failed",
          message: "ComfyUI never stopped: the restart did not happen (check the ComfyUI console)",
        });
        return;
      }
      runInAction(() => this.setPhase(gen, { kind: "goingDown", seconds: secs() }));
      if (!(await this.deps.ping()).up) break;
      await sleep(DOWN_POLL_MS);
    }

    for (;;) {
      if (!alive()) return;
      if (now() - start > MAX_WAIT_UP_MS) {
        this.setPhase(gen, {
          kind: "failed",
          message: "ComfyUI is not back after 5 minutes: check the ComfyUI console",
        });
        return;
      }
      runInAction(() => this.setPhase(gen, { kind: "comingBack", seconds: secs() }));
      const p = await this.deps.ping();
      if (p.up) {
        if (!alive()) return;
        this.setPhase(gen, { kind: "back", seconds: secs(), version: p.version });
        this.deps.onBack?.();
        return;
      }
      await sleep(UP_POLL_MS);
    }
  }
}
