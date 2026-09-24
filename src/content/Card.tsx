import { obs } from "rvlib-mobx";
import { useRef } from "react";

import type { CardSt } from "src/content/CardSt.ts";
import type { Chip } from "src/content/ListingSvc.ts";
import { DockButton, DockMiss, Movable, startDrag } from "src/content/Movable.tsx";
import { usePopoverDismiss } from "src/content/popover.ts";
import { FocusButton, RulesButton } from "src/content/RulesUi.tsx";
import { TargetEditor } from "src/content/TargetEditor.tsx";
import { lmPrefixForCivitaiType } from "src/shared/civitai.ts";
import { RestartPanel } from "src/shared/RestartPanel.tsx";

export const CardShell = obs(function CardShell(p: { st: CardSt }) {
  return (
    <>
      <Movable place={p.st.placement} className="wrap">
        <Card st={p.st} />
      </Movable>
      {/* only in the attached host: a copy in a detached root sees every click as outside and closes */}
      {p.st.page.isModelPage && <TargetEditor st={p.st.edit} lmDown={p.st.listing.isLmDown} />}
    </>
  );
});

/** the model page row: Rules, Focus, then this model's chips, the same ones its tile gets */
export const Card = obs(function Card(p: { st: CardSt }) {
  const st = p.st;
  if (!st.page.isModelPage) return null;
  if (st.collapsed)
    return (
      <button className="pill lmf-hot" onClick={() => st.toggleCollapsed()} title="LoRA Manager">
        LM
      </button>
    );
  return (
    <div className="card">
      <header onPointerDown={(e) => startDrag(e, st.placement)} title="Drag to move">
        <span className="brand" title="LoRA Manager">
          LM
        </span>
      </header>
      <span className="bar-buttons">
        <RulesButton st={st.rules} picks={st.page.picks} onOpen={() => void st.openRules()} />
        <FocusButton st={st.focus} picks={st.page.picks} />
      </span>
      <DockMiss place={st.placement} />
      <ModelChips st={st} />
      <span className="tools">
        <DockButton place={st.placement} />
        <button
          className={st.server.isOpen ? "icon on" : "icon"}
          onClick={() => st.server.toggleEditing()}
          title="Server address"
        >
          ⚙
        </button>
        {st.server.isOpen && <ServerPopover st={st} />}
        {!st.placement.isDocked && (
          <button className="icon" onClick={() => st.toggleCollapsed()} title="Collapse">
            –
          </button>
        )}
      </span>
    </div>
  );
});

const ModelChips = obs(function ModelChips(p: { st: CardSt }) {
  const st = p.st;
  const model = st.page.model;
  if (model.error != null) return <span className="error">Civitai: {model.error.message}</span>;
  const m = model.result;
  if (m == null) return <span className="muted">Loading model…</span>;
  if (lmPrefixForCivitaiType(m.type) == null)
    return <span className="muted">Type {m.type} is not handled</span>;
  const chips = st.listing.chipsForModel(m.id);
  if (chips.length === 0)
    return (
      <span className="muted">
        {st.listing.isLmDown ? "LoRA Manager unreachable (⚙)" : "Checking library…"}
      </span>
    );
  return (
    <span className="row-chips" onPointerLeave={() => st.listing.hideTip()}>
      {chips.map((c, i) => (
        <ChipView
          key={`${i}:${c.text}`}
          chip={c}
          onAct={() => c.act != null && void st.listing.run(m.id, c.act)}
          onEdit={(rect) =>
            c.editVersion != null &&
            void st.edit.open({ modelId: m.id, versionId: c.editVersion, rect })
          }
          onHover={(el) => st.listing.showTip(el, m.id)}
        />
      ))}
    </span>
  );
});

/** a chip as react renders it; tiles render the same Chip data as plain dom (ListingSvc chipEl) */
function ChipView(p: {
  chip: Chip;
  onAct: () => void;
  onEdit: (rect: { left: number; top: number; bottom: number }) => void;
  onHover: (el: HTMLElement) => void;
}) {
  const c = p.chip;
  return (
    <span
      className={`lmf-chip ${c.cls}`}
      role={c.act != null ? "button" : undefined}
      data-act={c.act != null ? "1" : undefined}
      onClick={p.onAct}
      onPointerEnter={(e) => p.onHover(e.currentTarget)}
    >
      {c.text}
      {c.target != null && (
        <span
          className="lmf-target"
          data-edit="1"
          title="Change where this one goes"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            p.onEdit({ left: r.left, top: r.top, bottom: r.bottom });
          }}
        >
          <span className="lmf-root">{c.target.rootLabel}</span>
          <span className="lmf-sub">
            {c.target.manual === true ? "✎ " : ""}
            {c.target.sub !== "" ? c.target.sub : "(root)"}
          </span>
        </span>
      )}
    </span>
  );
}

/** the ⚙ popover: anchored under the tools, never inline, so the docked row keeps its shape */
const ServerPopover = obs(function ServerPopover(p: { st: CardSt }) {
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
