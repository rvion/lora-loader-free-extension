import { useRef } from "react";
import { obs } from "rvlib-mobx";

import type { CardSt } from "src/content/CardSt.ts";
import type { EditSvc } from "src/content/EditSvc.ts";
import { usePopoverDismiss } from "src/content/popover.ts";
import { SubfolderBox } from "src/content/SubfolderBox.tsx";
import { fileLabel, weightFiles } from "src/shared/civitai.ts";
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
  const files = v != null ? weightFiles(v) : [];
  const pickedFile = (v != null ? st.files.get(v.id) : undefined) ?? files[0]?.id;
  const left = Math.max(8, Math.min(req.rect.left, innerWidth - 380));
  const top =
    req.rect.bottom + 6 + 220 > innerHeight ? Math.max(8, req.rect.top - 226) : req.rect.bottom + 6;
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
        {files.length > 1 && v != null && (
          <label className="file-row">
            <span className="cond-field">file</span>
            <select
              value={pickedFile ?? ""}
              onChange={(e) => st.pickFile(Number(e.currentTarget.value))}
            >
              {files.map((f) => (
                <option key={f.id} value={f.id} title={f.name}>
                  {fileLabel(f)}
                  {f.primary ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="save-row">
          {st.isManual ? (
            <button className="small" onClick={() => st.resetToRule()}>
              Reset to rule
            </button>
          ) : (
            <span className="muted">from the rules; any change here applies to this one only</span>
          )}
          <button className="lmf-hot" onClick={() => st.go()}>
            {p.lmDown ? "☆ Mark here" : "⬇ Install here"}
          </button>
        </div>
      </div>
    </div>
  );
});

/** the strip's copy: off model pages the card host is detached, so the editor renders here */
export const TargetEditorHost = obs(function TargetEditorHost(p: { st: CardSt }) {
  if (p.st.page.isModelPage) return null;
  return <TargetEditor st={p.st.edit} lmDown={p.st.listing.isLmDown} />;
});
