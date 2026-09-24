import { useRef, useState } from "react";
import { obs } from "rvlib-mobx";

import { DockButton, DockMiss, Movable, startDrag } from "src/content/Movable.tsx";
import { usePopoverDismiss } from "src/content/popover.ts";
import type { FocusSvc } from "src/content/FocusSvc.ts";
import type { RulesSvc } from "src/content/RulesSvc.ts";
import { SubfolderBox } from "src/content/SubfolderBox.tsx";
import type { LmPrefix } from "src/shared/civitai.ts";
import { rootLabels } from "src/shared/paths.ts";
import { summarizeCond, typeName, type CondField, type Rule } from "src/shared/rules.ts";

export type Picks = { tags: string[]; bases: string[] };

/** the strip on listing pages: only the Rules button and what applies here (agent/spec.md "rules strip") */
export const RulesStrip = obs(function RulesStrip(p: { st: RulesSvc; focus: FocusSvc }) {
  const st = p.st;
  if (!st.stripVisible) return null;
  const here = st.pageRule;
  const picks: Picks = {
    tags: st.stats.tags.map((t) => t[0]),
    bases: st.stats.bases.map((b) => b[0]),
  };
  if (st.minimized)
    return (
      <Movable place={st.placement} className="tagwrap">
        <button className="tagpill lmf-hot" onClick={() => st.toggleMinimized()} title="Rules">
          Rules ({st.rules.length})
        </button>
      </Movable>
    );
  return (
    <Movable place={st.placement} className="tagwrap">
      <div className="tagbar">
        <span
          className="grip"
          onPointerDown={(e) => startDrag(e, st.placement)}
          title="Drag to move"
        >
          ⠿
        </span>
        <span className="brand" title="LoRA Manager">
          LM
        </span>
        <RulesButton
          st={st}
          picks={picks}
          onOpen={() => void st.open({ cond: st.pageCond, existing: here })}
        />
        <FocusButton st={p.focus} picks={picks} />
        <span className="here">
          {here != null ? (
            <>
              here: <b>{summarizeCond(here.cond)}</b> → {targetText(here)}
            </>
          ) : st.pageCond != null ? (
            <span className="muted">no rule for this page yet</span>
          ) : null}
        </span>
        <DockButton place={st.placement} />
        {!st.placement.isDocked && (
          <button className="icon" onClick={() => st.toggleMinimized()} title="Fold">
            –
          </button>
        )}
        <DockMiss place={st.placement} />
      </div>
    </Movable>
  );
});

function targetText(r: Rule): string {
  const root =
    r.root != null
      ? (r.root
          .split(/[\\/]/)
          .filter((s) => s !== "")
          .pop() ?? r.root)
      : "default root";
  return `${root} / ${r.sub !== "" ? r.sub : "(root)"}`;
}

/** the button that opens the rules popover; the popover is anchored under it */
export const RulesButton = obs(function RulesButton(p: {
  st: RulesSvc;
  picks?: Picks;
  onOpen: () => void;
}) {
  const st = p.st;
  return (
    <span className="rules-anchor">
      <button
        className={st.isOpen ? "rules-btn on" : "rules-btn"}
        onClick={() => (st.isOpen ? st.close() : p.onOpen())}
        title="Rules: which folder a model goes to by default"
      >
        Rules ({st.rules.length}) ▾
      </button>
      {st.isOpen && <RulesPopover st={st} picks={p.picks ?? { tags: [], bases: [] }} />}
    </span>
  );
});

const RulesPopover = obs(function RulesPopover(p: { st: RulesSvc; picks: Picks }) {
  const st = p.st;
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, () => st.close());
  const d = st.draft;
  const editingIndex = d?.id != null ? st.rules.findIndex((r) => r.id === d.id) : -1;
  return (
    <div className="popover rules-pop" ref={ref}>
      <div className="popover-head">
        <span>Rules</span>
        <span>
          <button className="small" onClick={() => st.newRule()}>
            + New
          </button>
          <button className="icon" onClick={() => st.close()} title="Close">
            ✕
          </button>
        </span>
      </div>
      {st.rules.length === 0 ? (
        <p className="muted">
          No rule yet. The first matching rule picks a model's default folder.
        </p>
      ) : (
        <ol className="rule-list">
          {st.rules.map((r, i) => (
            <li key={r.id} className={r.id === d?.id ? "on" : undefined}>
              <span className="rule-cond">{summarizeCond(r.cond)}</span>
              <span className="rule-target">→ {targetText(r)}</span>
              <span className="rule-tools">
                <button className="icon" title="Edit" onClick={() => st.edit(r.id)}>
                  ✎
                </button>
                <button
                  className="icon"
                  title="Higher priority"
                  disabled={i === 0}
                  onClick={() => void st.moveUp(r.id)}
                >
                  ↑
                </button>
                <button className="icon" title="Delete" onClick={() => void st.remove(r.id)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {d != null && (
        <div className="rule-editor">
          <div className="editor-title">
            {d.id == null ? "New rule" : `Editing rule ${editingIndex + 1}`}
            {st.isDirty && <span className="dirty"> · not saved</span>}
          </div>
          <div className="cond-row">
            <span className="kw">IF</span>
            {(["tags", "words", "bases"] as const).map((f) =>
              d.cond[f].map((v) => (
                <CondChip
                  key={`${f}:${v}`}
                  field={f}
                  value={v}
                  onRemove={() => st.removeCond(f, v)}
                />
              )),
            )}
            {d.cond.types.map((t) => (
              <CondChip
                key={`types:${t}`}
                field="types"
                value={typeName(t)}
                onRemove={() => st.removeCond("types", t)}
              />
            ))}
            <AddCond st={st} picks={p.picks} />
          </div>
          <div className="target-row">
            <span className="kw">→</span>
            <select
              value={d.root}
              onChange={(e) => st.setRoot(e.currentTarget.value)}
              title={d.root}
            >
              {d.root === "" && <option value="">loading roots…</option>}
              {(st.roots.result?.byType ?? []).map((g) => {
                const labels = rootLabels(g.roots);
                return (
                  <optgroup key={g.prefix} label={g.label}>
                    {g.roots.map((r) => (
                      <option key={r} value={r} title={r}>
                        {labels.get(r) ?? r}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <span className="sep-inline">/</span>
            <SubfolderBox
              value={d.sub}
              folders={st.roots.result?.folders ?? []}
              onChange={(v) => st.setSub(v)}
              onEnter={() => void st.save()}
            />
            <button
              className="icon basebtn"
              onClick={() => st.insertBase()}
              title="{base} = the version's base model, folder safe (Krea 2 → krea2). E.g. {base}/styles"
            >
              {"{base}"}
            </button>
          </div>
          <div className="save-row">
            <span className="muted">
              {st.stats.total > 0
                ? `matches ${st.stats.matched} of ${st.stats.total} cards here`
                : ""}
            </span>
            {st.saveError != null && <span className="error">{st.saveError}</span>}
            <button className="lmf-hot" disabled={!st.isDirty} onClick={() => void st.save()}>
              {d.id == null ? "Save rule" : "Update rule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const FIELD_TEXT: Record<CondField, string> = {
  tags: "tag",
  words: "has",
  bases: "base",
  types: "type",
};

function CondChip(p: { field: CondField; value: string; onRemove: () => void }) {
  return (
    <span className={`cond cond-${p.field}`}>
      <span className="cond-field">{FIELD_TEXT[p.field]}</span>
      {p.value}
      <button className="cond-x" onClick={p.onRemove} title="Remove">
        ✕
      </button>
    </span>
  );
}

const TYPES: LmPrefix[] = ["loras", "checkpoints", "embeddings"];

/** + condition: pick a field, type a value or click a quick pick from this page */
const AddCond = obs(function AddCond(p: { st: RulesSvc; picks: Picks }) {
  const [field, setField] = useState<CondField | null>(null);
  const [text, setText] = useState("");
  const st = p.st;
  const d = st.draft;
  if (d == null) return null;
  if (field == null)
    return (
      <button className="small add" onClick={() => setField("tags")}>
        + condition
      </button>
    );
  const add = (v: string) => {
    if (field !== "types") st.addCond(field, v);
    setText("");
  };
  const picks = field === "tags" ? p.picks.tags : field === "bases" ? p.picks.bases : [];
  return (
    <span className="addcond">
      <span className="fields">
        {(["tags", "words", "bases", "types"] as const).map((f) => (
          <button
            key={f}
            className={f === field ? "small on" : "small"}
            onClick={() => setField(f)}
          >
            {f === "tags"
              ? "tag"
              : f === "words"
                ? "name/tag has"
                : f === "bases"
                  ? "base model"
                  : "type"}
          </button>
        ))}
        <button className="icon" onClick={() => setField(null)} title="Done">
          ✓
        </button>
      </span>
      {field === "types" ? (
        <span className="picks">
          {TYPES.map((t) => (
            <button
              key={t}
              className={d.cond.types.includes(t) ? "small on" : "small"}
              onClick={() => st.toggleType(t)}
            >
              {typeName(t)}
            </button>
          ))}
        </span>
      ) : (
        <>
          <input
            autoFocus
            value={text}
            placeholder={
              field === "words"
                ? "text in the name or a tag"
                : field === "bases"
                  ? "Krea 2, Anima…"
                  : "a civitai tag"
            }
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add(text);
            }}
          />
          {picks.length > 0 && (
            <span className="picks">
              {picks.map((v) => (
                <button key={v} className="small" onClick={() => add(v)}>
                  {v}
                </button>
              ))}
            </span>
          )}
        </>
      )}
    </span>
  );
});

/** Focus ▾: which models get install chips (agent/spec.md "focus") */
export const FocusButton = obs(function FocusButton(p: { st: FocusSvc; picks: Picks }) {
  const st = p.st;
  return (
    <span className="rules-anchor">
      <button
        className={
          st.active != null ? "rules-btn focus-on" : st.isOpen ? "rules-btn on" : "rules-btn"
        }
        onClick={() => st.toggleOpen()}
        title="Show install chips only for the models you care about"
      >
        {st.label} ▾
      </button>
      {st.isOpen && <FocusPopover st={st} picks={p.picks} />}
    </span>
  );
});

const FocusPopover = obs(function FocusPopover(p: { st: FocusSvc; picks: Picks }) {
  const st = p.st;
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, () => st.close());
  const [text, setText] = useState("");
  const union = (a: string[], b: string[]) => {
    const out = [...a];
    for (const v of b) if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    return out;
  };
  const bases = union(st.cond.bases, p.picks.bases);
  const tags = union(st.cond.tags, p.picks.tags);
  return (
    <div className="popover rules-pop focus-pop" ref={ref}>
      <div className="popover-head">
        <label className="switch">
          <input
            type="checkbox"
            checked={st.enabled}
            onChange={(e) => st.setEnabled(e.currentTarget.checked)}
          />
          Focus {st.enabled ? "on" : "off"}
        </label>
        <span>
          <button className="small" onClick={() => st.clear()}>
            Clear
          </button>
          <button className="icon" onClick={() => st.close()} title="Close">
            ✕
          </button>
        </span>
      </div>
      <p className="muted">
        Only matching models get ⬇ install chips. Models you have always show.
      </p>
      <div className="focus-field">
        <span className="cond-field">base model</span>
        {bases.length === 0 && <span className="muted">none seen on this page yet</span>}
        {bases.map((b) => (
          <button
            key={b}
            className={st.has("bases", b) ? "small on" : "small"}
            onClick={() => st.toggle("bases", b)}
          >
            {b}
          </button>
        ))}
      </div>
      <div className="focus-field">
        <span className="cond-field">type</span>
        {TYPES.map((t) => (
          <button
            key={t}
            className={st.cond.types.includes(t) ? "small on" : "small"}
            onClick={() => st.toggleType(t)}
          >
            {typeName(t)}
          </button>
        ))}
      </div>
      <div className="focus-field">
        <span className="cond-field">tag</span>
        {tags.map((t) => (
          <button
            key={t}
            className={st.has("tags", t) ? "small on" : "small"}
            onClick={() => st.toggle("tags", t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="focus-field">
        <span className="cond-field">name/tag has</span>
        {st.cond.words.map((w) => (
          <CondChip key={w} field="words" value={w} onRemove={() => st.toggle("words", w)} />
        ))}
        <input
          value={text}
          placeholder="add a text, Enter"
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              st.toggle("words", text);
              setText("");
            }
          }}
        />
      </div>
    </div>
  );
});
