import { useEffect, useRef, type RefObject } from "react";

/** closes a popover on a pointerdown outside its anchor (the popover's parent) or on Escape.
 *  our events come from inside a shadow root, so the test runs on the composed path */
export function usePopoverDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const onDown = (e: PointerEvent) => {
      const anchor = el?.parentElement;
      if (anchor != null && !e.composedPath().includes(anchor)) close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    el?.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      el?.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}
