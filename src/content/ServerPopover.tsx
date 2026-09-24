import { useRef } from "react";
import { obs } from "rvlib-mobx";

import type { CardSt } from "src/content/CardSt.ts";
import { usePopoverDismiss } from "src/content/popover.ts";
import { RestartPanel } from "src/shared/RestartPanel.tsx";

/** the ⚙ popover: anchored under the tools, never inline, so the docked row keeps its shape */
export const ServerPopover = obs(function ServerPopover(p: { st: CardSt }) {
  const sv = p.st.server;
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, () => sv.close());
  return (
    <div className="popover" ref={ref}>
      <div className="popover-head">
        <span>LoRA Manager server</span>
        <button className="icon" onClick={() => sv.close()} title="Close">
          ✕
        </button>
      </div>
      {sv.lmUnreachable && <p className="error">LoRA Manager does not answer at {sv.url}</p>}
      <label>
        ComfyUI / LoRA Manager address
        <span className="row">
          <input
            value={sv.draft}
            placeholder="127.0.0.1:8188"
            spellCheck={false}
            onChange={(e) => sv.setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sv.save();
            }}
          />
          <button onClick={() => void sv.save()}>Save</button>
        </span>
      </label>
      {sv.saveError != null && <p className="error">{sv.saveError}</p>}
      <RestartPanel st={p.st.restart} />
    </div>
  );
});
