import { obs } from "rvlib-mobx";

import type { ErrorRow, ErrorSvc } from "src/content/ErrorSvc.ts";

const COPIED_MS = 1500;

/** bottom right, over civitai: every failure, each copyable (agent/spec.md "errors") */
export const ErrorPanel = obs(function ErrorPanel(p: { st: ErrorSvc }) {
  const st = p.st;
  if (!st.isOpen || st.rows.length === 0) return null;
  const n = st.rows.length;
  return (
    <div className="err-panel" role="alert">
      <div className="err-head">
        <span>
          ⚠ LoRA Manager Free · {n} error{n > 1 ? "s" : ""}
        </span>
        <span className="row">
          {st.needsReload && (
            <button className="primary" onClick={() => location.reload()}>
              Reload page
            </button>
          )}
          <button onClick={() => void copy(st, "all", st.rows)}>
            {st.copied === "all" ? "Copied" : "Copy all"}
          </button>
          <button className="icon" onClick={() => st.close()} title="Close">
            ✕
          </button>
        </span>
      </div>
      <div className="err-rows">
        {st.rows.map((r) => (
          <div className="err-row" key={r.key}>
            <div className="err-text">
              <div className="err-where">{r.where}</div>
              <div className="error">{r.message}</div>
              <div className="muted">
                {r.count > 1 ? `×${r.count} · ` : ""}
                {new Date(r.lastAt).toLocaleTimeString()}
              </div>
            </div>
            <button onClick={() => void copy(st, r.key, [r])}>
              {st.copied === r.key ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

async function copy(st: ErrorSvc, key: string, rows: ErrorRow[]): Promise<void> {
  const text = st.copyText(rows);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // the async clipboard can be refused on a page without focus: the old path still works
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  st.setCopied(key);
  setTimeout(() => {
    if (st.copied === key) st.setCopied(null);
  }, COPIED_MS);
}
