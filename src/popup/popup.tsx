import { configure } from "mobx";
import { createRoot } from "react-dom/client";
import { obs } from "rvlib-mobx";

import { PopupSt, type Launched } from "src/popup/PopupSt.ts";
import { RestartPanel } from "src/shared/RestartPanel.tsx";
import { summarizeCond } from "src/shared/rules.ts";
import { markedKey, type MarkedItem } from "src/shared/storage.ts";
import { GLOW_CSS } from "src/shared/theme.ts";
import type { DownloadState } from "src/shared/watchDownload.ts";

configure({ enforceActions: "always" });

const Popup = obs(function Popup(p: { st: PopupSt }) {
  const st = p.st;
  return (
    <main>
      <h1>LoRA Manager</h1>
      <Connection st={st} />
      <Marked st={st} />
      <Rules st={st} />
    </main>
  );
});

const Connection = obs(function Connection(p: { st: PopupSt }) {
  const st = p.st;
  const t = st.test;
  return (
    <section>
      <label>
        ComfyUI / LoRA Manager address
        <input
          value={st.urlDraft}
          placeholder="127.0.0.1:8188"
          onChange={(e) => st.setUrlDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void st.saveUrl();
          }}
          spellCheck={false}
        />
      </label>
      <p className="muted">Host, IP or full URL, e.g. 192.168.1.20:8188</p>
      {st.saveError != null && <p className="error">{st.saveError}</p>}
      <div className="row">
        <button onClick={() => void t.run()} disabled={t.isRunning}>
          Test
        </button>
        {st.isDirty && (
          <button className="primary lmf-hot" onClick={() => void st.saveUrl()}>
            Save
          </button>
        )}
        <span className="status">
          {t.isRunning ? (
            "Testing…"
          ) : t.error != null ? (
            <span className="error">{t.error.message}</span>
          ) : t.result != null ? (
            <span className="good">Connected, LoRA Manager {t.result}</span>
          ) : null}
        </span>
      </div>
      <RestartPanel st={st.restart} />
    </section>
  );
});

const Marked = obs(function Marked(p: { st: PopupSt }) {
  const st = p.st;
  return (
    <section>
      <h2>Marked ({st.marked.length})</h2>
      {st.marked.length === 0 && st.launched.length === 0 && (
        <p className="muted">Nothing marked. Use Mark on a Civitai model page.</p>
      )}
      <ul>
        {st.marked.map((i) => (
          <MarkedRow key={markedKey(i)} st={st} item={i} />
        ))}
        {st.launched.map((l) => (
          <LaunchedRow key={`l${markedKey(l.item)}`} row={l} />
        ))}
      </ul>
      {st.marked.length > 0 && (
        <button
          className="primary wide lmf-hot"
          disabled={st.isLaunching}
          onClick={() => void st.downloadAll()}
        >
          {st.isLaunching ? "Starting…" : `Download all (${st.marked.length})`}
        </button>
      )}
    </section>
  );
});

const Rules = obs(function Rules(p: { st: PopupSt }) {
  const st = p.st;
  return (
    <section>
      <h2>Rules ({st.rules.length})</h2>
      {st.rules.length === 0 && (
        <p className="muted">No rule yet. Use the Rules button on a Civitai page to add one.</p>
      )}
      <ul>
        {st.rules.map((r, i) => (
          <li key={r.id}>
            <div className="item">
              <div className="name">{summarizeCond(r.cond)}</div>
              <div className="muted">
                → {r.root != null ? (r.root.split(/[\\/]/).pop() ?? r.root) : "default root"}
                {r.sub !== "" ? ` / ${r.sub}` : ""}
              </div>
            </div>
            <button
              className="icon"
              title="Higher priority"
              disabled={i === 0}
              onClick={() => void st.moveRuleUp(r.id)}
            >
              ↑
            </button>
            <button className="icon" title="Delete" onClick={() => void st.deleteRule(r.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
});

const MarkedRow = obs(function MarkedRow(p: { st: PopupSt; item: MarkedItem }) {
  return (
    <li>
      <ItemText item={p.item} />
      <button className="icon" title="Remove" onClick={() => void p.st.unmark(p.item)}>
        ×
      </button>
    </li>
  );
});

const LaunchedRow = obs(function LaunchedRow(p: { row: Launched }) {
  return (
    <li>
      <ItemText item={p.row.item} />
      <StateText state={p.row.state} />
    </li>
  );
});

function ItemText(p: { item: MarkedItem }) {
  const i = p.item;
  const where = [i.folder.root.split(/[\\/]/).pop() ?? i.folder.root, i.folder.sub]
    .filter((s) => s !== "")
    .join("/");
  return (
    <div className="item">
      <div className="name">{i.modelName}</div>
      <div className="muted">
        {i.versionName}
        {i.file != null ? ` (${i.file.label})` : ""} → {where}
      </div>
    </div>
  );
}

function StateText(p: { state: DownloadState }) {
  const s = p.state;
  switch (s.kind) {
    case "idle":
      return null;
    case "starting":
      return <span className="muted">starting…</span>;
    case "running":
      return <span>{s.stage ?? `${Math.round(s.percent)}%`}</span>;
    case "failed":
      return <span className="error">{s.message}</span>;
    case "done":
      return <span className="good">✓</span>;
  }
}

const glow = document.createElement("style");
glow.textContent = GLOW_CSS;
document.head.appendChild(glow);

const rootEl = document.getElementById("root");
if (rootEl == null) throw new Error("popup.html lacks #root");
createRoot(rootEl).render(<Popup st={new PopupSt()} />);
