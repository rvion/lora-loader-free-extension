import { useRef } from "react";
import { obs } from "rvlib-mobx";

import type { CardSt } from "src/content/CardSt.ts";
import type { EditSvc } from "src/content/EditSvc.ts";
import { usePopoverDismiss } from "src/content/popover.ts";
import { SubfolderBox } from "src/content/SubfolderBox.tsx";
import { fileKey, formatSize, variantName, weightFiles } from "src/shared/civitai.ts";
import { rootLabels } from "src/shared/paths.ts";

/** the chip target editor, floating next to the chip that opened it (agent/spec.md "target editor") */
export const TargetEditor = obs(function TargetEditor(p: { st: EditSvc; lmDown: boolean }) {
  const st = p.st;
  if (st.req == null) return null;
  return <EditorBox st={st} lmDown={p.lmDown} />;
});

const EditorBox = obs(function EditorBox(p: { st: EditSvc; lmDown: boolean }) {
  const st = p.st;
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, () => st.close());
  const req = st.req;
  const v = st.version;
  const t = st.target;
  if (req == null) return null;
  const roots = st.choices?.roots ?? [];
  const labels = rootLabels(roots);
  const picks = st.currentPicks;
  const left = Math.max(8, Math.min(req.rect.left, innerWidth - 380));
  const rows = st.versions.reduce((n, x) => n + weightFiles(x).length, 0);
  const height = 160 + Math.min(rows, 12) * 22;
  const top =
    req.rect.bottom + 6 + height > innerHeight
      ? Math.max(8, req.rect.top - height - 6)
      : req.rect.bottom + 6;
  return (
    // the anchor for outside clicks is this wrapper, so a click anywhere else closes
    <div className="editor-anchor">
      <div className="popover target-pop" ref={ref} style={{ left, top }}>
        <div className="popover-head">
          <span>
            {st.modelName} · {v?.name ?? ""}
            {v?.baseModel != null && <span className="vchip-base">{v.baseModel}</span>}
          </span>
          <button className="icon" onClick={() => st.close()} title="Close">
            ✕
          </button>
        </div>
        {st.loadError != null && <p className="error">{st.loadError}</p>}
        {t == null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="target-row">
            <select
              autoFocus={req.part === "root"}
              value={t.root}
              onChange={(e) => st.setRoot(e.currentTarget.value)}
              title={t.root}
            >
              {!roots.includes(t.root) && <option value={t.root}>{t.root}</option>}
              {roots.map((r) => (
                <option key={r} value={r} title={r}>
                  {labels.get(r) ?? r}
                </option>
              ))}
            </select>
            <span className="sep-inline">/</span>
            <SubfolderBox
              autoFocus={req.part === "sub"}
              value={t.sub}
              folders={st.choices?.folders ?? []}
              onChange={(x) => st.setSub(x)}
              onEnter={() => st.go()}
            />
            <button
              className="icon basebtn"
              onClick={() => st.insertBase()}
              title="Put the base model folder in front"
            >
              {"{base}"}
            </button>
          </div>
        )}
        {v != null && <FileList st={st} />}
        <div className="save-row">
          {st.isManual ? (
            <button className="small" onClick={() => st.resetToRule()}>
              Reset to rule
            </button>
          ) : (
            <span className="muted">from the rules; any change here applies to this one only</span>
          )}
          <button className="lmf-hot" onClick={() => st.go()}>
            {p.lmDown ? "☆ Mark" : "⬇ Install"}
            {picks.length > 1 ? ` ${picks.length} files` : ""} here
          </button>
        </div>
      </div>
    </div>
  );
});

/** every version of the chip's base model and every weight file of each, as checkboxes (agent/spec.md "target editor") */
const FileList = obs(function FileList(p: { st: EditSvc }) {
  const st = p.st;
  const versions = st.versions;
  const picks = st.currentPicks;
  const kb = picks.reduce((n, x) => {
    const f = versions.find((v) => v.id === x.versionId)?.files.find((f) => f.id === x.fileId);
    return n + (f?.sizeKB ?? 0);
  }, 0);
  if (versions.every((v) => weightFiles(v).length === 0)) return null;
  return (
    <div className="file-list">
      <div className="file-head">
        <span className="cond-field">files</span>
        <span className="muted">
          {picks.length} picked{kb > 0 ? ` · ${formatSize(kb)}` : ""}
        </span>
      </div>
      {versions.map((v) =>
        weightFiles(v).map((f, i) => {
          const pick = { versionId: v.id, fileId: f.id };
          const key = fileKey(pick);
          return (
            <label key={key} className="file-row" title={f.name}>
              <span className="file-ver">{i === 0 ? v.name : ""}</span>
              <input
                type="checkbox"
                checked={st.isPicked(pick)}
                onChange={() => st.togglePick(pick)}
              />
              <span className="file-name">
                <b>{variantName(f)}</b>
                <span className="muted">
                  {f.format != null && f.format !== variantName(f) ? ` · ${f.format}` : ""}
                  {f.primary ? " (default)" : ""}
                </span>
              </span>
              <span className="file-size">{f.sizeKB != null ? formatSize(f.sizeKB) : ""}</span>
              {st.owned.has(key) && <span className="file-have">✓ have</span>}
            </label>
          );
        }),
      )}
    </div>
  );
});

/** the editor lives in the bar's shadow root, the one host on every page */
export const TargetEditorHost = obs(function TargetEditorHost(p: { st: CardSt }) {
  return <TargetEditor st={p.st.edit} lmDown={p.st.listing.isLmDown} />;
});
