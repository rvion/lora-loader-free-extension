import { useState } from "react";
import { obs } from "rvlib-mobx";

import type { CardSt } from "src/content/CardSt.ts";
import { DockButton, DockMiss, Movable, startDrag } from "src/content/Movable.tsx";
import { SubfolderBox } from "src/content/SubfolderBox.tsx";
import { shortRoot, whereInLibrary } from "src/shared/paths.ts";
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
        <span className="brand" title="LoRA Manager">
          LM
        </span>
      </header>
      <DockMiss place={st.placement} />
      <Body st={st} />
      <span className="tools">
        <DockButton place={st.placement} />
        <button
          className={st.server.isEditing ? "icon on" : "icon"}
          onClick={() => st.server.toggleEditing()}
          title="Server address"
        >
          ⚙
        </button>
        {!st.placement.isDocked && (
          <button className="icon" onClick={() => st.toggleCollapsed()} title="Collapse">
            –
          </button>
        )}
      </span>
      {st.server.isOpen && <ServerField st={st} />}
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
      <VersionChip st={st} />
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

/** the version the card acts on: details on hover, every other version on click */
const VersionChip = obs(function VersionChip(p: { st: CardSt }) {
  const [open, setOpen] = useState(false);
  const st = p.st;
  const m = st.page.model.result;
  const v = st.page.version;
  if (m == null || v == null) return null;
  const file = st.file.picked;
  const tip = [
    `Version: ${v.name}`,
    `Base model: ${v.baseModel ?? "unknown"}`,
    `Type: ${m.type}`,
    `File: ${file != null ? st.file.label(file) : "none listed"}`,
    m.versions.length > 1 ? `Click to pick another of ${m.versions.length} versions` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
  return (
    <span className="vchip-wrap">
      <button
        className="vchip"
        title={tip}
        onClick={() => setOpen((o) => !o && m.versions.length > 1)}
        onBlur={() => setOpen(false)}
      >
        {v.name}
        {v.baseModel != null && <span className="vchip-base">{v.baseModel}</span>}
        {m.versions.length > 1 && " ▾"}
      </button>
      {open && (
        <ul className="combo-list vlist" role="listbox">
          {m.versions.map((ver) => (
            <li
              key={ver.id}
              role="option"
              aria-selected={ver.id === v.id}
              className={ver.id === v.id ? "hi" : undefined}
              // mousedown: the button blur would close the list before a click lands
              onMouseDown={(e) => {
                e.preventDefault();
                st.pickVersion(ver.id);
                setOpen(false);
              }}
            >
              {ver.name}
              {ver.baseModel != null && <span className="muted"> · {ver.baseModel}</span>}
            </li>
          ))}
        </ul>
      )}
    </span>
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
  if (s.result?.exists === true) {
    const roots = st.folder.choices.result?.roots ?? [];
    return (
      <>
        <p className="status lmf-cool" title={`LoRA Manager type: ${s.result.modelType}`}>
          ✓ In library
        </p>
        {s.result.files.map((f) => (
          <WhereLine key={f.filePath} path={f.filePath} roots={roots} />
        ))}
      </>
    );
  }
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
        <span className="lbl">File</span>
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

/** "loras › krea2/styles" then the file name: the root by its own folder name, then the path inside it */
function WhereLine(p: { path: string; roots: string[] }) {
  const w = whereInLibrary(p.path, p.roots);
  return (
    <p className="where" title={p.path}>
      <span className="where-dir">
        {w.rootName}
        {w.dir !== "" && <> › {w.dir}</>}
      </span>
      <span className="where-file">{w.fileName}</span>
      <button
        className="link"
        onClick={() => void navigator.clipboard.writeText(p.path)}
        title="Copy the full path"
      >
        Copy
      </button>
    </p>
  );
}

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
        <span className="lbl">Root</span>
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
      <span className="sep">/</span>
      <label>
        <span className="lbl">Subfolder</span>
        <SubfolderBox
          value={f.pick.sub}
          folders={c.result?.folders ?? []}
          onChange={(v) => f.setSub(v)}
        />
      </label>
      {f.via != null && <p className="rule">Folder from rule: {f.via}</p>}
    </div>
  );
});

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
        <SubfolderBox
          value={t.draftSub}
          folders={t.roots.result?.folders ?? []}
          onChange={(v) => t.setDraftSub(v)}
          onEnter={() => void t.save()}
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
        {!t.placement.isDocked && (
          <button className="icon" onClick={() => t.toggleMinimized()} title="Fold">
            –
          </button>
        )}
        {t.roots.error != null && <span className="error">{t.roots.error.message}</span>}
        {t.saveError != null && <span className="error">{t.saveError}</span>}
        <DockMiss place={t.placement} />
      </div>
    </Movable>
  );
});
