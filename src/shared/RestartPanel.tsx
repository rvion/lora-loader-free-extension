import { obs } from "rvlib-mobx";

import type { RestartSt } from "src/shared/RestartSt.ts";

/** used by the card and the popup: both style .restart, .muted, .error, .good */
export const RestartPanel = obs(function RestartPanel(p: { st: RestartSt }) {
  const st = p.st;
  const ph = st.phase;
  return (
    <div className="restart">
      {ph.kind === "confirming" ? (
        <span className="row">
          <button className="danger" onClick={() => void st.confirm()}>
            Really restart?
          </button>
          <button onClick={() => st.cancel()}>Cancel</button>
        </span>
      ) : (
        <button disabled={st.isBusy} onClick={() => st.ask()}>
          Restart ComfyUI
        </button>
      )}
      <PhaseLine st={st} />
    </div>
  );
});

const PhaseLine = obs(function PhaseLine(p: { st: RestartSt }) {
  const ph = p.st.phase;
  switch (ph.kind) {
    case "idle":
    case "confirming":
      return null;
    case "sending":
      return <p className="muted">Asking ComfyUI to restart…</p>;
    case "goingDown":
      return <p className="muted">Waiting for ComfyUI to stop… {ph.seconds}s</p>;
    case "comingBack":
      return <p className="muted">Restarting… {ph.seconds}s</p>;
    case "back":
      return (
        <p className="good">
          ✓ Back in {ph.seconds}s, LoRA Manager {ph.version}
        </p>
      );
    case "failed":
      return <p className="error">{ph.message}</p>;
  }
});
