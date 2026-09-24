import { obs } from "rvlib-mobx";

import type { CardSt } from "src/content/CardSt.ts";
import { DockButton, DockMiss, Movable, startDrag } from "src/content/Movable.tsx";
import { RestartPanel } from "src/shared/RestartPanel.tsx";

export const CardShell = obs(function CardShell(p: { st: CardSt }) {
  return (
    <Movable place={p.st.placement} className="wrap">
      <Card st={p.st} />
    </Movable>
  );
});

export const Card = obs(function Card(p: { st: CardSt }) {
  const st = p.st;
  if (!st.page.isModelPage) return null;
  if (st.collapsed)
    return (
      <button
        className={`pill ${st.library.inLibrary ? "lmf-cool" : "lmf-hot"}`}
        onClick={() => st.toggleCollapsed()}
        title="LoRA Manager"
      >
        <StatusDot st={st} /> {st.library.inLibrary ? "✓ LM" : "⬇ LM"}
      </button>
    );
  return (
    <div className="card">
      <header onPointerDown={(e) => startDrag(e, st.placement)} title="Drag to move">
        <span className="brand">LoRA Manager</span>
        <span>
          <DockButton place={st.placement} />
          <button
            className={st.server.isEditing ? "icon on" : "icon"}
            onClick={() => st.server.toggleEditing()}
            title="Server address"
          >
            ⚙
          </button>
          <button className="icon" onClick={() => st.toggleCollapsed()} title="Collapse">
            –
          </button>
        </span>
      </header>
      <DockMiss place={st.placement} />
      {st.server.isOpen && <ServerField st={st} />}
      <Body st={st} />
    </div>
  );
});

const ServerField = obs(function ServerField(p: { st: CardSt }) {
  const sv = p.st.server;
  return (
    <div className="server">
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

const StatusDot = obs(function StatusDot(p: { st: CardSt }) {
  const s = p.st.library.status;
  const cls =
    s.error != null ? "bad" : p.st.library.inLibrary ? "good" : s.result != null ? "none" : "wait";
  return <span className={`dot ${cls}`} />;
});

const Body = obs(function Body(p: { st: CardSt }) {
  const st = p.st;
  const model = st.page.model;
  if (model.error != null) return <p className="error">Civitai: {model.error.message}</p>;
  const m = model.result;
  const v = st.page.version;
  if (m == null || v == null) return <p className="muted">Loading model…</p>;
  return (
    <>
      <div className="title" title={m.name}>
        {m.name}
      </div>
      <div className="sub">
        {v.name} · {m.type}
      </div>
      {st.page.prefix == null ? (
        <p className="muted">Type {m.type} is not handled.</p>
      ) : (
        <>
          <LibraryLine st={st} />
          {!st.library.inLibrary && <Controls st={st} />}
        </>
      )}
    </>
  );
});

const LibraryLine = obs(function LibraryLine(p: { st: CardSt }) {
  const st = p.st;
  const s = st.library.status;
  if (s.error != null)
    return (
      <p className="error">
        {s.error.message}
        <button className="link" onClick={() => void st.refreshForVersion()}>
          Retry
        </button>
      </p>
    );
  if (s.isRunning && s.result == null) return <p className="muted">Checking library…</p>;
  if (s.result?.exists === true)
    return <p className="status lmf-cool">✓ In library ({s.result.modelType})</p>;
  return <p className="muted">Not in library</p>;
});

const Controls = obs(function Controls(p: { st: CardSt }) {
  const st = p.st;
  const d = st.download.state;
  return (
    <>
      <FilePicker st={st} />
      <FolderPicker st={st} />
      {d.kind === "running" && (
        <div className="progress">
          <div className="bar" style={{ width: `${Math.max(2, Math.min(100, d.percent))}%` }} />
          <span>{d.stage ?? `${Math.round(d.percent)}%`}</span>
        </div>
      )}
      {d.kind === "failed" && <p className="error">{d.message}</p>}
      <div className="actions">
        <button
          className="primary lmf-hot"
          disabled={st.download.isBusy || st.folder.pick.root === ""}
          onClick={() => void st.download.start()}
        >
          {d.kind === "starting" ? "Starting…" : d.kind === "running" ? "Downloading…" : "Download"}
        </button>
        <button disabled={st.download.isBusy} onClick={() => void st.marks.toggle()}>
          {st.marks.isMarked ? "Unmark" : "Mark"}
        </button>
      </div>
    </>
  );
});

const FilePicker = obs(function FilePicker(p: { st: CardSt }) {
  const f = p.st.file;
  if (f.files.length < 2) return null;
  return (
    <div className="folder">
      <label>
        File
        <select value={f.picked?.id ?? ""} onChange={(e) => f.pick(Number(e.currentTarget.value))}>
          {f.files.map((file) => (
            <option key={file.id} value={file.id} title={file.name}>
              {f.label(file)}
              {file.primary ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
});

const FolderPicker = obs(function FolderPicker(p: { st: CardSt }) {
  const f = p.st.folder;
  const c = f.choices;
  if (c.error != null) return <p className="error">Folders: {c.error.message}</p>;
  const roots = c.result?.roots ?? [];
  if (roots.length === 0)
    return <p className="muted">{c.isRunning ? "Loading folders…" : "No model root configured"}</p>;
  return (
    <div className="folder">
      <label>
        Root
        <select
          value={f.pick.root}
          onChange={(e) => f.setRoot(e.currentTarget.value)}
          title={f.pick.root}
        >
          {roots.map((r) => (
            <option key={r} value={r}>
              {shortRoot(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subfolder
        <input
          list="lmf-subfolders"
          placeholder="(root)"
          value={f.pick.sub}
          onChange={(e) => f.setSub(e.currentTarget.value)}
        />
        <datalist id="lmf-subfolders">
          {(c.result?.folders ?? []).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      {f.via != null && <p className="rule">Folder from rule: {f.via}</p>}
    </div>
  );
});

function shortRoot(root: string): string {
  const parts = root.split(/[\\/]/).filter((s) => s !== "");
  return parts.length <= 2 ? root : `…/${parts.slice(-2).join("/")}`;
}

export const TagBar = obs(function TagBar(p: { st: CardSt }) {
  const t = p.st.tag;
  if (t.pageTag == null) return null;
  if (t.minimized)
    return (
      <Movable place={t.placement} className="tagwrap">
        <button className="tagpill lmf-hot" onClick={() => t.toggleMinimized()} title="Tag rule">
          # {t.pageTag}
          {t.rule != null ? " ✓" : ""}
        </button>
      </Movable>
    );
  const roots = t.roots.result?.roots ?? [];
  return (
    <Movable place={t.placement} className="tagwrap">
      <div className="tagbar">
        <span
          className="grip"
          onPointerDown={(e) => startDrag(e, t.placement)}
          title="Drag to move"
        >
          ⠿
        </span>
        <span className="tagname">
          Tag <b>{t.pageTag}</b> →
        </span>
        <select
          value={t.draftRoot}
          onChange={(e) => t.setDraftRoot(e.currentTarget.value)}
          title={t.draftRoot}
        >
          <option value="">(last used root)</option>
          {roots.map((r) => (
            <option key={r} value={r}>
              {shortRoot(r)}
            </option>
          ))}
        </select>
        <span>/</span>
        <input
          value={t.draftSub}
          placeholder="(root)"
          spellCheck={false}
          onChange={(e) => t.setDraftSub(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void t.save();
          }}
        />
        {t.isDirty ? (
          <button className="lmf-hot" onClick={() => void t.save()}>
            {t.rule == null ? "Save rule" : "Update rule"}
          </button>
        ) : (
          <span className="saved lmf-cool">✓ rule saved</span>
        )}
        {t.rule != null && (
          <button onClick={() => void t.remove()} title="Delete this rule">
            Delete
          </button>
        )}
        <DockButton place={t.placement} />
        <button className="icon" onClick={() => t.toggleMinimized()} title="Fold">
          –
        </button>
        {t.roots.error != null && <span className="error">{t.roots.error.message}</span>}
        {t.saveError != null && <span className="error">{t.saveError}</span>}
        <DockMiss place={t.placement} />
      </div>
    </Movable>
  );
});
