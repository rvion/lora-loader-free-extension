import { makeAutoObservable } from "mobx";

import type { HostMode } from "src/content/dock.ts";
import { getPlacement, setPlacement, type OverlayId, type ScreenPos } from "src/shared/storage.ts";

const DOCK_MISS_NOTE_MS = 4000;

/** dock or free mode of one overlay (agent/spec.md "dock and free mode") */
export class PlacementSvc {
  mode: "dock" | "free" = "dock";
  /** free mode spot, null = the overlay's default corner */
  pos: ScreenPos | null = null;
  /** what placeHost actually did last */
  actual: HostMode = "floating";
  /** true a few seconds after a dock attempt found no spot */
  dockMiss = false;
  private checkNextPlacement = false;
  private missTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private id: OverlayId) {
    makeAutoObservable<PlacementSvc, "id" | "checkNextPlacement" | "missTimer">(this, {
      id: false,
      checkNextPlacement: false,
      missTimer: false,
    });
    void getPlacement(id).then((p) => this.restore(p));
  }

  restore(p: { mode: "dock" | "free"; pos: ScreenPos | null } | null): void {
    if (p == null) return;
    this.mode = p.mode;
    this.pos = p.pos;
  }

  get isDocked(): boolean {
    return this.actual === "docked";
  }

  /** live while dragging: any move is a free mode move */
  moveTo(pos: ScreenPos): void {
    this.mode = "free";
    this.pos = pos;
  }

  commit(): void {
    void setPlacement(this.id, { mode: this.mode, pos: this.pos });
  }

  dock(): void {
    this.mode = "dock";
    this.checkNextPlacement = true;
    this.commit();
  }

  undock(): void {
    this.mode = "free";
    this.commit();
  }

  /** fed by the placement pass; reports a dock attempt that found nothing */
  setActual(m: HostMode): void {
    if (this.actual !== m) this.actual = m;
    if (!this.checkNextPlacement) return;
    this.checkNextPlacement = false;
    this.dockMiss = m !== "docked";
    if (this.missTimer != null) clearTimeout(this.missTimer);
    if (this.dockMiss) this.missTimer = setTimeout(() => this.clearMiss(), DOCK_MISS_NOTE_MS);
  }

  clearMiss(): void {
    this.dockMiss = false;
  }
}
