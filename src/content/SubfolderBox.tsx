import { useState } from "react";

import { folderOptions } from "src/shared/paths.ts";

/** subfolder combobox: filters existing folders, free text always allowed (agent/spec.md "subfolder combobox").
 *  open and highlight are view only state, so they stay in react */
export function SubfolderBox(p: {
  value: string;
  folders: string[];
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  // opening lists every folder, like a select; typing starts filtering
  const [filtering, setFiltering] = useState(false);
  const typed = p.value.trim();
  const isNew = typed !== "" && !p.folders.some((f) => f.toLowerCase() === typed.toLowerCase());
  const rows = filtering
    ? folderOptions(p.folders, p.value)
    : [
        ...(isNew ? [{ value: typed, depth: 0, isNew: true }] : []),
        ...folderOptions(p.folders, ""),
      ];
  const current = Math.max(
    0,
    rows.findIndex((r) => r.value.toLowerCase() === typed.toLowerCase()),
  );
  const openList = () => {
    setOpen(true);
    setFiltering(false);
    setHi(current);
  };
  const pick = (v: string) => {
    p.onChange(v);
    setOpen(false);
  };
  return (
    <span className="combo">
      <input
        value={p.value}
        placeholder="(root)"
        spellCheck={false}
        onFocus={openList}
        onMouseDown={() => {
          if (!open) openList();
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          p.onChange(e.currentTarget.value);
          setOpen(true);
          setFiltering(true);
          setHi(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            if (!open) openList();
            setHi((h) => Math.min(h + 1, rows.length - 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setHi((h) => Math.max(h - 1, 0));
            e.preventDefault();
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter") {
            const row = open ? rows[hi] : undefined;
            if (row != null) pick(row.value);
            else p.onEnter?.();
            e.preventDefault();
          }
        }}
      />
      {isNew && <span className="newtag">new</span>}
      <span className="chev" aria-hidden="true">
        ▾
      </span>
      {open && rows.length > 0 && (
        <ul className="combo-list" role="listbox">
          {rows.map((r, i) => (
            <li
              key={`${r.isNew ? "+" : ""}${r.value}`}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? "hi" : undefined}
              style={{ paddingLeft: 8 + r.depth * 12 }}
              // mousedown, not click: the input blur would close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r.value);
              }}
              onMouseEnter={() => setHi(i)}
            >
              {r.isNew ? (
                <span className="create">＋ new folder: {r.value}</span>
              ) : r.value === "" ? (
                <span className="muted">(root)</span>
              ) : (
                r.value
              )}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
