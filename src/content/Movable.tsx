import type React from "react";
import type { ReactNode } from "react";
import { obs } from "rvlib-mobx";

import type { PlacementSvc } from "src/content/PlacementSvc.ts";

/** the positioned box of an overlay: css places it (docked, default corner), or the dragged spot does */
export const Movable = obs(function Movable(p: {
  place: PlacementSvc;
  className: string;
  children: ReactNode;
}) {
  const pl = p.place;
  const pos = pl.pos;
  // clamp keeps a saved spot reachable after the window shrinks
  const style =
    pl.actual === "custom" && pos != null
      ? {
          left: `clamp(0px, ${pos.x}px, calc(100vw - 120px))`,
          top: `clamp(0px, ${pos.y}px, calc(100vh - 48px))`,
        }
      : undefined;
  return (
    <div className={p.className} style={style} data-movable="">
      {p.children}
    </div>
  );
});

/** drag from a handle. listens on window, not with pointer capture: undocking re-parents the
 *  host on the first move, and moving a node releases its capture */
export function startDrag(e: React.PointerEvent<HTMLElement>, place: PlacementSvc): void {
  if (
    e.button !== 0 ||
    (e.target instanceof Element && e.target.closest("button, input, select") != null)
  )
    return;
  const box = e.currentTarget.closest("[data-movable]")?.getBoundingClientRect();
  if (box == null) return;
  const dx = e.clientX - box.left;
  const dy = e.clientY - box.top;
  const move = (ev: PointerEvent) =>
    place.moveTo({ x: Math.round(ev.clientX - dx), y: Math.round(ev.clientY - dy) });
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    place.commit();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  e.preventDefault();
}

/** ⇱ while docked, ⇲ while floating */
export const DockButton = obs(function DockButton(p: { place: PlacementSvc }) {
  const pl = p.place;
  return pl.isDocked ? (
    <button className="icon" onClick={() => pl.undock()} title="Undock: float and move freely">
      ⇱
    </button>
  ) : (
    <button className="icon" onClick={() => pl.dock()} title="Dock into the page">
      ⇲
    </button>
  );
});

export const DockMiss = obs(function DockMiss(p: { place: PlacementSvc }) {
  return p.place.dockMiss ? (
    <p className="muted docknote">Nothing to dock into on this page</p>
  ) : null;
});
